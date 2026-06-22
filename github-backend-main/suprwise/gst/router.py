from fastapi import APIRouter, Depends, HTTPException
import httpx
from ..config import settings
from ..auth.dependencies import get_current_user
from pydantic import BaseModel

router = APIRouter(prefix="/api/gst", tags=["gst"])

class GSTVerifyRequest(BaseModel):
    gstin: str


def _map_gstincheck_response(gstin: str, data: dict) -> dict:
    addr = data.get("pradr", {}).get("addr", {})
    parts = [
        addr.get("bno", ""),
        addr.get("bnm", ""),
        addr.get("st", ""),
        addr.get("loc", ""),
        addr.get("dst", ""),
    ]
    address_str = ", ".join(p for p in parts if p)
    pincode = addr.get("pncd", "")

    city = addr.get("loc", "") or addr.get("dst", "")
    stj = data.get("stj", "")
    state = stj.split(" - ")[-1].strip() if " - " in stj else stj

    sts = data.get("sts", "")
    gstin_status = "Active" if sts.upper() in ("ACT", "ACTIVE") else sts

    nba = data.get("nba", [])
    if isinstance(nba, str):
        nba = [nba]

    return {
        "gstin": gstin,
        "legal_name": data.get("lgnm", ""),
        "trade_name": data.get("tradeNam", ""),
        "registration_date": data.get("rgdt", ""),
        "constitution_of_business": data.get("ctb", ""),
        "taxpayer_type": data.get("dty", ""),
        "gstin_status": gstin_status,
        "last_update_date": data.get("lstupdt", ""),
        "center_jurisdiction": data.get("ctj", ""),
        "state_jurisdiction": stj,
        "principal_place_of_business": {
            "address": address_str,
            "city": city,
            "state": state,
            "pincode": pincode,
        },
        "nature_of_business_activities": nba,
        "filing_status": [],
    }


@router.post("/verify")
async def verify_gst(req: GSTVerifyRequest, user=Depends(get_current_user)):
    gstin = req.gstin.strip().upper()

    if len(gstin) != 15:
        return {"success": False, "error": "Invalid GSTIN format", "status_code": 400}

    api_key = settings.GST_VERIFICATION_API_KEY
    if not api_key:
        return {"success": False, "error": "GST verification not configured"}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"http://sheet.gstincheck.co.in/check/{api_key}/{gstin}"
            )
        result = resp.json()
    except Exception as e:
        return {"success": False, "error": f"GST API unreachable: {str(e)}"}

    if not result.get("flag"):
        return {
            "success": False,
            "error": result.get("message", "GSTIN not found or invalid"),
        }

    return {
        "success": True,
        "message": "GSTIN verified successfully",
        "data": _map_gstincheck_response(gstin, result.get("data", {})),
    }


@router.post("/filing-status")
async def get_filing_status(req: GSTVerifyRequest, financial_year: str = None, user=Depends(get_current_user)):
    gstin = req.gstin.strip().upper()

    if len(gstin) != 15:
        return {"success": False, "error": "Invalid GSTIN format"}

    return {
        "success": True,
        "message": "Filing status retrieved successfully",
        "data": {
            "gstin": gstin,
            "filing_status": [],
        },
    }
