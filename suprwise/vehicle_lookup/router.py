from fastapi import APIRouter, Depends, HTTPException, Query

from ..auth.dependencies import get_current_user
from .service import lookup_vehicle

router = APIRouter(prefix="/api/vehicle-lookup", tags=["vehicle-lookup"])


@router.get("")
async def vehicle_lookup(
    reg: str = Query(..., min_length=4, description="Indian vehicle registration number"),
    _user=Depends(get_current_user),
):
    """
    Fetch normalized RTO-style vehicle data (make, model, insurance / PUC / fitness dates).

    **Providers:** Set `VEHICLE_LOOKUP_PROVIDER` to `mock` (demo data), `http` (configured
    via URL template), or `parivahan` (direct scraping).
    """
    try:
        return await lookup_vehicle(reg)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
