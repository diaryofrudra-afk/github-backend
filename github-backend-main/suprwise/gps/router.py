from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from ..auth.dependencies import get_current_user
from ..database import get_db
from .service import fetch_blackbuck_telemetry, clear_credentials_cache
from .crypto import encrypt_token
import asyncio
import uuid

router = APIRouter(prefix="/api/gps", tags=["gps"])


class BlackbuckCredentials(BaseModel):
    auth_token: str
    fleet_owner_id: str


class BlackbuckStatus(BaseModel):
    configured: bool = False
    token_preview: str = ""
    fleet_owner_id: str = ""
    vehicle_count: int = 0
    last_error: str = ""


@router.get("/blackbuck")
async def get_blackbuck_telemetry(user=Depends(get_current_user)):
    """Fetch live Blackbuck GPS telemetry for this user only."""
    return await fetch_blackbuck_telemetry(user_id=user["user_id"])


@router.get("/blackbuck/health", response_model=BlackbuckStatus)
async def blackbuck_health_check(user=Depends(get_current_user), db=Depends(get_db)):
    """Check this user's Blackbuck integration status."""
    status = BlackbuckStatus()
    try:
        cursor = await db.execute(
            "SELECT auth_token_encrypted, fleet_owner_id FROM blackbuck_credentials WHERE user_id = ?",
            (user["user_id"],),
        )
        row = await cursor.fetchone()
    except Exception:
        row = None

    if row:
        status.configured = True
        status.fleet_owner_id = row[1]
        try:
            data = await fetch_blackbuck_telemetry(user_id=user["user_id"])
            status.vehicle_count = len(data.vehicles)
            if data.error:
                status.last_error = data.error
        except Exception as e:
            status.last_error = str(e)
    else:
        # .env fallback
        from ..config import settings
        if settings.BLACKBUCK_AUTH_TOKEN and settings.BLACKBUCK_FLEET_OWNER_ID:
            status.configured = True
            status.token_preview = "(.env)"
            status.fleet_owner_id = settings.BLACKBUCK_FLEET_OWNER_ID
            try:
                data = await fetch_blackbuck_telemetry(user_id=user["user_id"])
                status.vehicle_count = len(data.vehicles)
                if data.error:
                    status.last_error = data.error
            except Exception:
                pass

    return status


@router.put("/blackbuck/credentials")
async def set_blackbuck_credentials(
    creds: BlackbuckCredentials,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """Store encrypted Blackbuck credentials for THIS user only."""
    from playwright.async_api import async_playwright
    import json as _json

    pw = await async_playwright().start()
    browser = await pw.chromium.launch(headless=True)
    page = await browser.new_page()
    try:
        await page.goto("https://blackbuck.com", wait_until="domcontentloaded", timeout=10000)
        await page.evaluate(f"""() => {{
            localStorage.setItem('accessToken', JSON.stringify('{creds.auth_token}'));
        }}""")
        result = await page.evaluate("""async () => {
            try {
                const token = JSON.parse(localStorage.getItem('accessToken') || 'null');
                const resp = await fetch('https://api-fms.blackbuck.com/fms/api/freight_supply/userProfile/v1', {
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
                });
                return { status: resp.status, body: await resp.text() };
            } catch(e) { return { error: e.message }; }
        }""")

        if result.get("status") != 200:
            raise HTTPException(status_code=400, detail=f"Token validation failed (HTTP {result.get('status')}). Check your token.")

        profile = _json.loads(result["body"])
        if str(profile.get("fleet_owner_id")) != str(creds.fleet_owner_id):
            raise HTTPException(status_code=400, detail=f"Fleet ID mismatch. API returned fleet_owner_id={profile.get('fleet_owner_id')}")
    finally:
        await browser.close()

    encrypted = encrypt_token(creds.auth_token)

    try:
        cursor = await db.execute(
            "SELECT id FROM blackbuck_credentials WHERE user_id = ?", (user["user_id"],)
        )
        existing = await cursor.fetchone()
    except Exception:
        existing = None

    if existing:
        await db.execute(
            "UPDATE blackbuck_credentials SET auth_token_encrypted = ?, fleet_owner_id = ?, updated_at = datetime('now') WHERE user_id = ?",
            (encrypted, creds.fleet_owner_id, user["user_id"]),
        )
    else:
        await db.execute(
            "INSERT INTO blackbuck_credentials (id, user_id, tenant_id, auth_token_encrypted, fleet_owner_id) VALUES (?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), user["user_id"], user["tenant_id"], encrypted, creds.fleet_owner_id),
        )
    await db.commit()
    clear_credentials_cache(user["user_id"])
    return {"ok": True, "message": "Credentials saved successfully"}


@router.get("/blackbuck/credentials")
async def get_blackbuck_credentials(
    user=Depends(get_current_user), db=Depends(get_db)
):
    """Get THIS user's credential status (no raw token exposed)."""
    try:
        cursor = await db.execute(
            "SELECT fleet_owner_id, updated_at FROM blackbuck_credentials WHERE user_id = ?",
            (user["user_id"],),
        )
        row = await cursor.fetchone()
    except Exception:
        row = None

    if row:
        return {"configured": True, "token_preview": "(encrypted)", "fleet_owner_id": row[0], "updated_at": row[1]}
    return {"configured": False, "token_preview": "", "fleet_owner_id": "", "updated_at": ""}


@router.delete("/blackbuck/credentials")
async def delete_blackbuck_credentials(
    user=Depends(get_current_user), db=Depends(get_db)
):
    """Delete THIS user's Blackbuck credentials."""
    await db.execute("DELETE FROM blackbuck_credentials WHERE user_id = ?", (user["user_id"],))
    await db.commit()
    clear_credentials_cache(user["user_id"])
    return {"ok": True, "message": "Credentials removed"}


@router.websocket("/ws/blackbuck")
async def websocket_blackbuck_telemetry(websocket: WebSocket):
    """WebSocket for live GPS updates (5s interval), scoped to the authenticated user."""
    await websocket.accept()
    try:
        from ..auth.service import decode_jwt
        from urllib.parse import parse_qs

        # Parse query params from the full URL
        query_string = str(websocket.url.query)
        params = parse_qs(query_string)
        token_list = params.get("token", [])
        token = token_list[0] if token_list else None

        user_id = None
        if token:
            try:
                payload = decode_jwt(token)
                user_id = payload.get("user_id")
            except Exception:
                pass

        while True:
            data = await fetch_blackbuck_telemetry(user_id=user_id)
            await websocket.send_json(data.model_dump())
            await asyncio.sleep(5)
    except WebSocketDisconnect:
        pass
    except Exception:
        try:
            await websocket.close()
        except Exception:
            pass


@router.post("/sync-to-fleet")
async def sync_all_gps_to_fleet(
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Sync ALL GPS vehicles (Blackbuck + Trak N Tell) to the fleet (cranes table).
    Performs an UPSERT: Adds new vehicles and updates existing ones with live GPS telemetry.
    Normalizes registration numbers by removing spaces and uppercasing.
    """
    from ..trakntell.service import fetch_trakntell_vehicle_data

    added = 0
    updated = 0
    errors = []

    # Helper to sync a single vehicle
    async def sync_vehicle(reg: str, provider: str, status: str, notes: str,
                           type_str: str = "Heavy Equipment", make_str: str = "", model_str: str = "Truck"):
        nonlocal added, updated
        reg = reg.replace(" ", "").strip().upper()
        if not reg:
            return

        cursor = await db.execute(
            "SELECT id, reg FROM cranes WHERE (reg = ? OR replace(reg, ' ', '') = ?) AND tenant_id = ?",
            (reg, reg, user["tenant_id"]),
        )
        existing = await cursor.fetchone()

        try:
            if existing:
                await db.execute(
                    "UPDATE cranes SET status = ?, notes = ?, reg = ? WHERE id = ?",
                    (status, notes, reg, existing[0]),
                )
                updated += 1
            else:
                await db.execute(
                    "INSERT INTO cranes (id, reg, type, make, model, capacity, year, rate, ot_rate, daily_limit, operator, site, status, notes, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (
                        str(uuid.uuid4()),
                        reg,
                        type_str,
                        make_str,
                        model_str,
                        "",
                        "",
                        0.0,
                        0.0,
                        8.0,
                        "",
                        "",
                        status,
                        notes,
                        user["tenant_id"],
                    ),
                )
                added += 1
        except Exception as e:
            errors.append(f"{reg}: {str(e)}")

    # ── Sync Blackbuck vehicles ──
    bb_data = await fetch_blackbuck_telemetry(user_id=user["user_id"])
    if not bb_data.error:
        for v in bb_data.vehicles:
            reg = v.registration_number.replace(" ", "").strip().upper()
            if not reg:
                continue
            status_text = v.status.replace("_", " ").title()
            if v.engine_on:
                status_text = f"{status_text} (Engine ON)"
            notes = f"Blackbuck GPS | Signal: {v.signal} | Ignition: {v.ignition_status} | Last updated: {v.last_updated}"
            if v.address:
                notes += f" | Location: {v.address[:100]}"
            await sync_vehicle(reg, "blackbuck", status_text, notes, "Heavy Equipment", "Blackbuck GPS", "Truck")

    # ── Sync Trak N Tell vehicles ──
    tnt_data = await fetch_trakntell_vehicle_data(user_id=user["user_id"])
    if not tnt_data.error:
        for v in tnt_data.vehicles:
            reg = v.registration_number.replace(" ", "").strip().upper()
            if not reg:
                continue
            status_text = v.status.replace("_", " ").title()
            ign_display = "🟢 ON" if v.ignition == "on" else "🔴 OFF" if v.ignition == "off" else "⚪ UNKNOWN"
            notes = (
                f"Trak N Tell GPS | Ignition: {ign_display} | "
                f"GSM: {v.gsm_signal} ({v.network_status}) | "
                f"Power: {v.main_voltage:.2f}V | "
                f"GPS: {'OK' if v.is_gps_working else 'LOST'} | "
                f"Last updated: {v.last_updated}"
            )
            if v.address:
                notes += f" | Location: {v.address[:100]}"
            await sync_vehicle(reg, "trakntell", status_text, notes, "Heavy Equipment", "Trak N Tell", "Truck")

    await db.commit()

    result = {"ok": True, "added": added, "updated": updated}
    if errors:
        result["errors"] = errors
    return result


@router.post("/blackbuck/sync-to-fleet")
async def sync_vehicles_to_fleet(
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Sync Blackbuck GPS vehicles to the fleet (cranes table).
    Performs an UPSERT: Adds new vehicles and updates existing ones with live GPS telemetry.
    Normalizes registration numbers by removing spaces and uppercasing.
    """
    data = await fetch_blackbuck_telemetry(user_id=user["user_id"])
    if data.error:
        raise HTTPException(status_code=400, detail=data.error)

    added = 0
    updated = 0

    for v in data.vehicles:
        # Normalize: "OD 02 AN 1234" -> "OD02AN1234"
        reg = v.registration_number.replace(" ", "").strip().upper()
        if not reg:
            continue

        # Check if already exists (fuzzy match against existing spaces, then normalize)
        cursor = await db.execute(
            "SELECT id, reg FROM cranes WHERE (reg = ? OR replace(reg, ' ', '') = ?) AND tenant_id = ?",
            (reg, reg, user["tenant_id"]),
        )
        existing = await cursor.fetchone()

        # Determine status text
        status_text = v.status.replace("_", " ").title()
        if v.engine_on:
            status_text = f"{status_text} (Engine ON)"

        # Build notes with GPS details
        notes = (
            f"Blackbuck GPS | Signal: {v.signal} | "
            f"Ignition: {v.ignition_status} | "
            f"Last updated: {v.last_updated}"
        )
        if v.address:
            notes += f" | Location: {v.address[:100]}"

        try:
            if existing:
                # UPDATE existing crane: Update status, notes, and normalize reg ID
                await db.execute(
                    "UPDATE cranes SET status = ?, notes = ?, reg = ? WHERE id = ?",
                    (status_text, notes, reg, existing[0]),
                )
                updated += 1
            else:
                # INSERT new crane
                await db.execute(
                    "INSERT INTO cranes (id, reg, type, make, model, capacity, year, rate, ot_rate, daily_limit, operator, site, status, notes, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (
                        str(uuid.uuid4()),
                        reg,
                        "Heavy Equipment",
                        "Blackbuck GPS",
                        "Truck",
                        "",
                        "",
                        0.0,
                        0.0,
                        8.0,
                        "",
                        "",
                        status_text,
                        notes,
                        user["tenant_id"],
                    ),
                )
                added += 1
        except Exception as e:
            # Skip this vehicle on single insertion error but continue loop
            print(f"Error syncing vehicle {reg}: {str(e)}")
            continue

    await db.commit()

    return {
        "ok": True,
        "added": added,
        "updated": updated,
        "total": len(data.vehicles),
    }
