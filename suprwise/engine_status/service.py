import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict
import aiosqlite
from .models import EngineStatusRecord, EngineStatusLogRequest, EngineStatusChangeEvent


async def get_last_status(db: aiosqlite.Connection, crane_reg: str, tenant_id: str) -> Optional[EngineStatusRecord]:
    """Get the most recent engine status record for a crane"""
    cursor = await db.execute("""
        SELECT id, crane_reg, engine_on, previous_status, changed_at, source,
               location_lat, location_lng, speed, address, tenant_id
        FROM engine_status_history
        WHERE crane_reg = ? AND tenant_id = ?
        ORDER BY changed_at DESC
        LIMIT 1
    """, (crane_reg, tenant_id))

    row = await cursor.fetchone()
    if not row:
        return None

    return EngineStatusRecord(
        id=row[0],
        crane_reg=row[1],
        engine_on=bool(row[2]),
        previous_status=bool(row[3]) if row[3] is not None else None,
        changed_at=datetime.fromisoformat(row[4]),
        source=row[5],
        location_lat=row[6],
        location_lng=row[7],
        speed=row[8],
        address=row[9],
        tenant_id=row[10]
    )


async def log_engine_status_change(
    db: aiosqlite.Connection,
    request: EngineStatusLogRequest,
    tenant_id: str
) -> Optional[EngineStatusChangeEvent]:
    """
    Log engine status change only if status has changed from last recorded value.
    Returns change event if status changed, None otherwise.
    """
    last_record = await get_last_status(db, request.crane_reg, tenant_id)

    # Skip if status hasn't changed
    if last_record and last_record.engine_on == request.engine_on:
        return None

    record_id = str(uuid.uuid4())
    changed_at = datetime.now(timezone.utc).isoformat()

    await db.execute("""
        INSERT INTO engine_status_history (
            id, crane_reg, engine_on, previous_status, changed_at,
            source, location_lat, location_lng, speed, address, tenant_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        record_id,
        request.crane_reg,
        request.engine_on,
        last_record.engine_on if last_record else None,
        changed_at,
        request.source,
        request.location_lat,
        request.location_lng,
        request.speed,
        request.address,
        tenant_id
    ))
    await db.commit()

    # Calculate duration if we have previous record
    duration_seconds = None
    if last_record:
        duration = datetime.fromisoformat(changed_at) - last_record.changed_at
        duration_seconds = int(duration.total_seconds())

    return EngineStatusChangeEvent(
        crane_reg=request.crane_reg,
        previous_status=last_record.engine_on if last_record else None,
        new_status=request.engine_on,
        changed_at=datetime.fromisoformat(changed_at),
        duration_seconds=duration_seconds
    )


async def get_engine_status_history(
    db: aiosqlite.Connection,
    tenant_id: str,
    crane_reg: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = 100,
    offset: int = 0
) -> List[EngineStatusRecord]:
    """Get engine status history with optional filters"""
    query = """
        SELECT id, crane_reg, engine_on, previous_status, changed_at, source,
               location_lat, location_lng, speed, address, tenant_id
        FROM engine_status_history
        WHERE tenant_id = ?
    """
    params = [tenant_id]

    if crane_reg:
        query += " AND crane_reg = ?"
        params.append(crane_reg)

    if start_date:
        query += " AND changed_at >= ?"
        params.append(start_date.isoformat())

    if end_date:
        query += " AND changed_at <= ?"
        params.append(end_date.isoformat())

    query += f" ORDER BY changed_at DESC LIMIT {limit} OFFSET {offset}"

    cursor = await db.execute(query, params)
    rows = await cursor.fetchall()

    return [
        EngineStatusRecord(
            id=row[0],
            crane_reg=row[1],
            engine_on=bool(row[2]),
            previous_status=bool(row[3]) if row[3] is not None else None,
            changed_at=datetime.fromisoformat(row[4]),
            source=row[5],
            location_lat=row[6],
            location_lng=row[7],
            speed=row[8],
            address=row[9],
            tenant_id=row[10]
        )
        for row in rows
    ]


async def get_engine_on_durations(
    db: aiosqlite.Connection,
    tenant_id: str,
    crane_reg: str,
    start_date: datetime,
    end_date: datetime
) -> List[Dict]:
    """Calculate engine on/off durations for a crane in date range"""
    records = await get_engine_status_history(
        db, tenant_id, crane_reg, start_date, end_date, limit=1000
    )

    durations = []
    records.reverse()  # Oldest first

    for i in range(len(records)):
        current = records[i]
        next_record = records[i + 1] if i + 1 < len(records) else None

        end_time = next_record.changed_at if next_record else datetime.now(timezone.utc)
        duration = end_time - current.changed_at

        durations.append({
            "status": "ON" if current.engine_on else "OFF",
            "start_time": current.changed_at,
            "end_time": end_time,
            "duration_seconds": int(duration.total_seconds())
        })

    return durations


async def export_engine_status_csv(
    db: aiosqlite.Connection,
    tenant_id: str,
    crane_reg: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
) -> str:
    """Export engine status history as CSV"""
    records = await get_engine_status_history(
        db, tenant_id, crane_reg, start_date, end_date, limit=10000
    )

    csv_lines = [
        "Registration Number,Engine Status,Previous Status,Time,Source,Latitude,Longitude,Speed,Address"
    ]

    for record in records:
        status = "ON" if record.engine_on else "OFF"
        prev_status = "ON" if record.previous_status else "OFF" if record.previous_status is not None else ""
        csv_lines.append(
            f"{record.crane_reg},{status},{prev_status},{record.changed_at.isoformat()},{record.source},"
            f"{record.location_lat or ''},{record.location_lng or ''},{record.speed or ''},{(record.address or '').replace(',', ' ')}"
        )

    return "\n".join(csv_lines)
