from __future__ import annotations
import os
import uuid
from datetime import datetime, timezone
from typing import Optional
import aiosqlite
from .config import settings

_db: Optional[aiosqlite.Connection] = None


async def get_db() -> aiosqlite.Connection:
    global _db
    if _db is None:
        raise RuntimeError("Database not initialized. Call init_db() first.")
    return _db


async def init_db() -> None:
    global _db
    os.makedirs(os.path.dirname(settings.DB_PATH) or ".", exist_ok=True)
    _db = await aiosqlite.connect(settings.DB_PATH)
    _db.row_factory = aiosqlite.Row
    await _db.execute("PRAGMA journal_mode=WAL")
    await _db.execute("PRAGMA foreign_keys=ON")

    schema_path = os.path.join(os.path.dirname(__file__), "schema.sql")
    with open(schema_path) as f:
        await _db.executescript(f.read())
    # Migrations: add columns that may be missing on older databases
    migrations = [
        ("owner_profiles", "photo", "TEXT NOT NULL DEFAULT ''"),
        ("owner_profiles", "address", "TEXT NOT NULL DEFAULT ''"),
        ("owner_profiles", "pincode", "TEXT NOT NULL DEFAULT ''"),
        ("owner_profiles", "pan", "TEXT NOT NULL DEFAULT ''"),
        ("cranes", "emi", "REAL NOT NULL DEFAULT 0.0"),
        ("cranes", "fixed_expenses", "REAL NOT NULL DEFAULT 0.0"),
        # Invoice extras — older DBs were created from the base invoices schema
        # and lack these columns the create/update routes write to.
        ("invoices", "terms", "TEXT NOT NULL DEFAULT '[]'"),
        ("invoices", "signature_url", "TEXT NOT NULL DEFAULT ''"),
        ("invoices", "discount", "REAL NOT NULL DEFAULT 0"),
        ("invoices", "additional_charges", "REAL NOT NULL DEFAULT 0"),
        ("invoices", "total_in_words", "TEXT NOT NULL DEFAULT ''"),
        ("invoices", "custom_fields", "TEXT NOT NULL DEFAULT '{}'"),
        ("invoices", "advanced_options", "TEXT NOT NULL DEFAULT '{}'"),
        ("invoices", "shipping", "TEXT NOT NULL DEFAULT '{}'"),
        ("invoices", "currency", "TEXT NOT NULL DEFAULT 'INR'"),
    ]
    for table, col, col_type in migrations:
        cursor = await _db.execute(f"PRAGMA table_info({table})")
        cols = [r[1] for r in await cursor.fetchall()]
        if col not in cols:
            await _db.execute(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}")

    # ── New tables for GPS credential management + SMS OTP ─────────────────────

    # Blackbuck per-user encrypted credentials
    await _db.executescript("""
        CREATE TABLE IF NOT EXISTS blackbuck_credentials (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
            tenant_id TEXT NOT NULL REFERENCES tenants(id),
            auth_token_encrypted TEXT NOT NULL,
            fleet_owner_id TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_bb_creds_user ON blackbuck_credentials(user_id);
        CREATE INDEX IF NOT EXISTS idx_bb_creds_tenant ON blackbuck_credentials(tenant_id);
    """)

    # SMS OTP table (used by sms_otp module and auth OTP login flow)
    await _db.executescript("""
        CREATE TABLE IF NOT EXISTS sms_otps (
            id TEXT PRIMARY KEY,
            phone TEXT NOT NULL,
            otp TEXT NOT NULL,
            purpose TEXT NOT NULL DEFAULT 'registration',
            attempts INTEGER NOT NULL DEFAULT 0,
            expires_at TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_sms_otps_phone ON sms_otps(phone);
    """)

    # Trak N Tell per-user encrypted credentials (sessionid + tnt_s for API calls)
    await _db.execute("""
        CREATE TABLE IF NOT EXISTS trakntell_credentials (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
            tenant_id TEXT NOT NULL REFERENCES tenants(id),
            user_id_encrypted TEXT NOT NULL,
            user_id_encrypt_encrypted TEXT NOT NULL,
            orgid_encrypted TEXT NOT NULL,
            sessionid_encrypted TEXT,
            tnt_s_encrypted TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)
    await _db.execute("CREATE INDEX IF NOT EXISTS idx_tnt_creds_user ON trakntell_credentials(user_id)")
    await _db.execute("CREATE INDEX IF NOT EXISTS idx_tnt_creds_tenant ON trakntell_credentials(tenant_id)")

    # Column-level migrations for trakntell_credentials (if table existed without these columns)
    cursor = await _db.execute("PRAGMA table_info(trakntell_credentials)")
    tnt_cols = [r[1] for r in await cursor.fetchall()]
    if "sessionid_encrypted" not in tnt_cols:
        await _db.execute("ALTER TABLE trakntell_credentials ADD COLUMN sessionid_encrypted TEXT")
    if "tnt_s_encrypted" not in tnt_cols:
        await _db.execute("ALTER TABLE trakntell_credentials ADD COLUMN tnt_s_encrypted TEXT")
    if "discovered_endpoints_json" not in tnt_cols:
        await _db.execute("ALTER TABLE trakntell_credentials ADD COLUMN discovered_endpoints_json TEXT")
    if "username_encrypted" not in tnt_cols:
        await _db.execute("ALTER TABLE trakntell_credentials ADD COLUMN username_encrypted TEXT")
    if "password_encrypted" not in tnt_cols:
        await _db.execute("ALTER TABLE trakntell_credentials ADD COLUMN password_encrypted TEXT")

    # Column-level migrations for blackbuck_credentials
    cursor = await _db.execute("PRAGMA table_info(blackbuck_credentials)")
    bb_cols = [r[1] for r in await cursor.fetchall()]
    if "portal_cookies_encrypted" not in bb_cols:
        await _db.execute(
            "ALTER TABLE blackbuck_credentials ADD COLUMN portal_cookies_encrypted TEXT"
        )

    # Column-level migrations for wheelseye_credentials (captured session cookies)
    cursor = await _db.execute("PRAGMA table_info(wheelseye_credentials)")
    we_cols = [r[1] for r in await cursor.fetchall()]
    if we_cols and "cookies_encrypted" not in we_cols:
        await _db.execute(
            "ALTER TABLE wheelseye_credentials ADD COLUMN cookies_encrypted TEXT NOT NULL DEFAULT ''"
        )

    # ── Vehicle document vault ─────────────────────────────────────────────────
    # The table itself is created by schema.sql (run every startup). Two follow-ups:
    #   1) drop the retired `diagnostics` table left over on older databases
    #   2) one-time backfill of legacy compliance insurance/fitness dates as documents
    await _db.execute("DROP TABLE IF EXISTS diagnostics")
    await _backfill_compliance_documents(_db)

    await _db.commit()


async def _backfill_compliance_documents(db: aiosqlite.Connection) -> None:
    """Seed vehicle_documents from legacy compliance rows (idempotent).

    For each compliance row, create an `insurance`/`fitness` document only if one
    doesn't already exist for that crane_reg + tenant, so re-running is harmless.
    """
    cursor = await db.execute("PRAGMA table_info(compliance)")
    if not await cursor.fetchall():
        return  # no legacy compliance table on this database
    cursor = await db.execute(
        "SELECT crane_reg, insurance_date, insurance_notes, fitness_date, fitness_notes, "
        "tenant_id FROM compliance"
    )
    rows = await cursor.fetchall()
    now = datetime.now(timezone.utc).isoformat()
    for row in rows:
        for doc_type, date_col, notes_col in (
            ("insurance", "insurance_date", "insurance_notes"),
            ("fitness", "fitness_date", "fitness_notes"),
        ):
            expiry = row[date_col]
            if not expiry:
                continue
            exists = await db.execute(
                "SELECT 1 FROM vehicle_documents "
                "WHERE tenant_id = ? AND crane_reg = ? AND doc_type = ? LIMIT 1",
                (row["tenant_id"], row["crane_reg"], doc_type),
            )
            if await exists.fetchone():
                continue
            await db.execute(
                """INSERT INTO vehicle_documents
                   (id, crane_reg, doc_type, title, doc_number, issue_date, expiry_date,
                    amount, file_id, notes, created_at, updated_at, tenant_id)
                   VALUES (?, ?, ?, ?, '', NULL, ?, NULL, NULL, ?, ?, ?, ?)""",
                (
                    str(uuid.uuid4()), row["crane_reg"], doc_type,
                    doc_type.capitalize(), expiry, row[notes_col] or "",
                    now, now, row["tenant_id"],
                ),
            )


async def close_db() -> None:
    global _db
    if _db:
        await _db.close()
        _db = None
