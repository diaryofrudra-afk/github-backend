from __future__ import annotations
import os
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
        ("users", "email", "TEXT NOT NULL DEFAULT ''"),
        ("users", "email_verified", "INTEGER NOT NULL DEFAULT 0"),
    ]
    for table, col, col_type in migrations:
        cursor = await _db.execute(f"PRAGMA table_info({table})")
        cols = [r[1] for r in await cursor.fetchall()]
        if col not in cols:
            await _db.execute(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}")

    # Add email index if it doesn't exist yet (must be after column migration)
    await _db.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)")

    # Ensure sms_otps table exists (SMS OTP via Fast2SMS)
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

    # Ensure trakntell_credentials table exists (Trak N Tell GPS iframe integration)
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

    # Migrations for trakntell_credentials: add missing columns safely
    cursor = await _db.execute("PRAGMA table_info(trakntell_credentials)")
    tnt_cols = [r[1] for r in await cursor.fetchall()]
    if "sessionid_encrypted" not in tnt_cols:
        await _db.execute("ALTER TABLE trakntell_credentials ADD COLUMN sessionid_encrypted TEXT")
    if "tnt_s_encrypted" not in tnt_cols:
        await _db.execute("ALTER TABLE trakntell_credentials ADD COLUMN tnt_s_encrypted TEXT")

    await _db.commit()


async def close_db() -> None:
    global _db
    if _db:
        await _db.close()
        _db = None
