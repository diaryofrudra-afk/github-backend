"""
Background GPS poller.

None of the three GPS providers (Blackbuck, Trak N Tell, WheelsEye) push engine
ON/OFF events to us — each API only returns a *current snapshot* of ignition state.
This task replicates the providers' own "engine on/off" notifications by polling all
providers for every user on an interval and running edge detection: whenever a
vehicle's ignition flips ON<->OFF, an engine-status change is logged and an in-app
notification is created.

Runs entirely server-side, so it works even when no browser is open.
"""
import asyncio
import logging
from typing import Optional

from .config import settings
from .database import get_db
from .engine_status.service import process_vehicle_engine_status

logger = logging.getLogger("suprwise.gps_poller")

_task: Optional[asyncio.Task] = None


async def _users_with_gps_creds(db) -> list[tuple[str, str]]:
    """Return [(user_id, tenant_id), ...] for every user that has GPS creds in any provider."""
    cursor = await db.execute(
        """
        SELECT user_id, tenant_id FROM blackbuck_credentials
        UNION
        SELECT user_id, tenant_id FROM trakntell_credentials
        UNION
        SELECT user_id, tenant_id FROM wheelseye_credentials
        """
    )
    rows = await cursor.fetchall()
    return [(row[0], row[1]) for row in rows]


async def _poll_user(db, user_id: str, tenant_id: str) -> None:
    """Fetch all three providers for one user and run engine ON/OFF edge detection."""
    from .gps.service import fetch_blackbuck_telemetry
    from .trakntell.service import fetch_trakntell_vehicle_data
    from .wheelseye.service import fetch_wheelseye_telemetry

    # ── Blackbuck ──
    try:
        bb = await fetch_blackbuck_telemetry(user_id=user_id, bypass_cache=True)
        if not bb.error:
            for v in bb.vehicles:
                await process_vehicle_engine_status(
                    db, tenant_id, v.registration_number, v.engine_on,
                    user_key=user_id, create_notification=True,
                    location_lat=v.latitude, location_lng=v.longitude,
                    speed=v.speed, address=v.address,
                )
    except Exception as e:
        logger.warning("Blackbuck poll failed for user %s: %s", user_id, e)

    # ── Trak N Tell ──
    try:
        tnt = await fetch_trakntell_vehicle_data(user_id=user_id, bypass_cache=True)
        if not tnt.error:
            for v in tnt.vehicles:
                engine_on = True if v.ignition == "on" else (False if v.ignition == "off" else None)
                await process_vehicle_engine_status(
                    db, tenant_id, v.registration_number, engine_on,
                    user_key=user_id, create_notification=True,
                    location_lat=v.latitude, location_lng=v.longitude,
                    speed=v.speed, address=v.address,
                )
    except Exception as e:
        logger.warning("Trak N Tell poll failed for user %s: %s", user_id, e)

    # ── WheelsEye ──
    try:
        we = await fetch_wheelseye_telemetry(user_id=user_id, bypass_cache=True)
        if not we.error:
            for v in we.vehicles:
                await process_vehicle_engine_status(
                    db, tenant_id, v.registration_number, v.engine_on,
                    user_key=user_id, create_notification=True,
                    location_lat=v.latitude, location_lng=v.longitude,
                    speed=v.speed, address=v.address,
                )
    except Exception as e:
        logger.warning("WheelsEye poll failed for user %s: %s", user_id, e)


async def poll_once() -> None:
    db = await get_db()
    users = await _users_with_gps_creds(db)
    if not users:
        logger.debug("GPS poller: no users with GPS credentials")
        return
    logger.info("GPS poller: checking engine status for %d user(s)", len(users))
    for user_id, tenant_id in users:
        try:
            await _poll_user(db, user_id, tenant_id)
        except Exception as e:
            logger.warning("GPS poll failed for user %s: %s", user_id, e)


async def _loop() -> None:
    interval = settings.GPS_POLL_INTERVAL_SECONDS
    logger.info("GPS poller started (interval=%ss)", interval)
    while True:
        try:
            await poll_once()
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.warning("GPS poller iteration failed: %s", e)
        await asyncio.sleep(interval)


async def start_gps_poller() -> None:
    global _task
    if settings.GPS_POLL_INTERVAL_SECONDS <= 0:
        logger.info("GPS poller disabled (GPS_POLL_INTERVAL_SECONDS<=0)")
        return
    if _task is None or _task.done():
        _task = asyncio.create_task(_loop())


async def stop_gps_poller() -> None:
    global _task
    if _task is not None:
        _task.cancel()
        try:
            await _task
        except asyncio.CancelledError:
            pass
        _task = None
