from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse
from datetime import datetime
from typing import Optional, List
import aiosqlite

from ..auth.dependencies import get_current_user, require_owner
from ..database import get_db
from .models import EngineStatusRecord, EngineStatusLogRequest, EngineStatusChangeEvent
from .service import (
    get_engine_status_history,
    log_engine_status_change,
    export_engine_status_csv,
    get_engine_on_durations
)

router = APIRouter(prefix="/api/engine-status", tags=["engine-status"])


@router.get("/history", response_model=List[EngineStatusRecord])
async def get_history(
    crane_reg: Optional[str] = Query(None, description="Filter by crane registration number"),
    start_date: Optional[datetime] = Query(None, description="Start date (ISO format)"),
    end_date: Optional[datetime] = Query(None, description="End date (ISO format)"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: aiosqlite.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get engine status change history"""
    return await get_engine_status_history(
        db, current_user["tenant_id"], crane_reg, start_date, end_date, limit, offset
    )


@router.post("/log", response_model=Optional[EngineStatusChangeEvent])
async def log_status(
    request: EngineStatusLogRequest,
    db: aiosqlite.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Manually log engine status change"""
    return await log_engine_status_change(db, request, current_user["tenant_id"])


@router.get("/export", response_class=PlainTextResponse)
async def export_history(
    crane_reg: Optional[str] = Query(None, description="Filter by crane registration number"),
    start_date: Optional[datetime] = Query(None, description="Start date (ISO format)"),
    end_date: Optional[datetime] = Query(None, description="End date (ISO format)"),
    db: aiosqlite.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Export engine status history as CSV"""
    csv_content = await export_engine_status_csv(
        db, current_user["tenant_id"], crane_reg, start_date, end_date
    )

    filename = f"engine-status-history-{datetime.now().strftime('%Y%m%d-%H%M%S')}.csv"
    return PlainTextResponse(
        content=csv_content,
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Content-Type": "text/csv"
        }
    )


@router.get("/durations/{crane_reg}", response_model=List[dict])
async def get_durations(
    crane_reg: str,
    start_date: datetime,
    end_date: datetime,
    db: aiosqlite.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get engine on/off durations for a crane in date range"""
    return await get_engine_on_durations(db, current_user["tenant_id"], crane_reg, start_date, end_date)
