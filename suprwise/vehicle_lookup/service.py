from __future__ import annotations

import hashlib
import json
import re
from typing import Any, Dict, Optional

import httpx
from bs4 import BeautifulSoup

from ..config import settings
from .models import VehicleRTOResponse

_REG_RE = re.compile(r"[^A-Z0-9]")


def normalize_indian_registration(reg: str) -> str:
    s = (reg or "").strip().upper()
    return _REG_RE.sub("", s)


def _parse_any_date(value: Any) -> Optional[str]:
    if value is None:
        return None
    s = str(value).strip()
    if not s or s.lower() in ("na", "n/a", "-", "null"):
        return None
    if re.match(r"^\d{4}-\d{2}-\d{2}$", s):
        return s
    m = re.match(r"^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$", s)
    if m:
        d, mo, y = int(m.group(1)), int(m.group(2)), m.group(3)
        return f"{y}-{mo:02d}-{d:02d}"
    m = re.match(r"^(\d{1,2})-([A-Za-z]{3})-(\d{4})$", s)
    if m:
        from datetime import datetime

        try:
            dt = datetime.strptime(s, "%d-%b-%Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass
    return None


def _flatten_dict(d: Dict[str, Any], prefix: str = "") -> Dict[str, str]:
    out: Dict[str, str] = {}
    for k, v in d.items():
        key = f"{prefix}.{k}" if prefix else str(k)
        if isinstance(v, dict):
            out.update(_flatten_dict(v, key))
        elif v is not None and not isinstance(v, (list, dict)):
            out[key.lower()] = str(v)
    return out


def _first_match(flat: Dict[str, str], *needles: str) -> str:
    for n in needles:
        n_l = n.lower()
        for fk, fv in flat.items():
            if n_l in fk.replace(".", "_"):
                if fv and fv.strip():
                    return fv.strip()
    return ""


def _first_date(flat: Dict[str, str], *needles: str) -> Optional[str]:
    raw = _first_match(flat, *needles)
    if not raw:
        return None
    parsed = _parse_any_date(raw)
    return parsed or None


def extract_vehicle_from_payload(payload: Any) -> VehicleRTOResponse:
    """Best-effort mapping from common Indian RC API JSON shapes and scraped tables."""
    if isinstance(payload, list) and payload:
        payload = payload[0]
    if not isinstance(payload, dict):
        return VehicleRTOResponse(reg="", raw={})

    # If payload is from our scraper, it's already a flat dict of label -> value
    data = payload.get("data") or payload.get("result") or payload.get("vehicle_detail") or payload
    if isinstance(data, list) and data:
        data = data[0]
    
    flat = _flatten_dict(data if isinstance(data, dict) else {})

    # Common RTO Labels from Parivahan/Commercial APIs
    reg = (
        _first_match(flat, "reg_no", "registration", "vehiclenumber", "vehicle_no", "rc_number")
        or str(payload.get("reg") or "")
    )
    make = _first_match(flat, "maker", "make", "manufacturer", "maker_name", "makername", "owner name") # Some APIs nest make in owner or vice versa
    model = _first_match(flat, "model", "model_name", "variant", "vehicle model")
    year = _first_match(
        flat,
        "manufacturing_year",
        "manufacturing year",
        "year",
        "reg_year",
        "registration_year",
        "regyear",
    )
    vclass = _first_match(
        flat,
        "vehicle_class",
        "vehicleclass",
        "class",
        "vehicle_category",
        "body_type",
        "category",
        "vehicle model", # Parivahan sometimes combines these
    )
    fuel = _first_match(flat, "fuel_type", "fuel", "fuel_norms")

    ins_date = _first_date(flat, "insurance", "insurance_upto", "insurance_validity", "policy_upto", "insurance valid upto")
    ins_co = _first_match(flat, "insurance_company", "insurer", "insurance_name")
    fit = _first_date(flat, "fitness", "fitness_upto", "fitness_validity", "fitness valid upto")
    tax = _first_date(flat, "tax", "tax_upto", "tax_validity", "permit", "m-v tax upto")
    pucc = _first_date(flat, "pucc", "puc", "pollution", "pollution_upto", "puc valid upto")

    owner = _first_match(flat, "owner", "owner_name", "owner name")
    chassis = _first_match(flat, "chassis", "chassis_no", "chassis number")

    return VehicleRTOResponse(
        reg=reg,
        make=make,
        model=model,
        year=year,
        vehicle_class=vclass,
        fuel_type=fuel,
        insurance_valid_upto=ins_date,
        insurance_company=ins_co,
        fitness_valid_upto=fit,
        tax_valid_upto=tax,
        pucc_valid_upto=pucc,
        owner_name=owner,
        chassis_masked=chassis,
        raw=data if isinstance(data, dict) else {},
    )


def _mock_response(normalized_reg: str) -> VehicleRTOResponse:
    if normalized_reg == "0D33AY8703":
        return VehicleRTOResponse(
            reg="0D33AY8703",
            make="Tata",
            model="ACE Gold",
            year="2023",
            vehicle_class="Goods Vehicle (Commercial)",
            fuel_type="Diesel",
            insurance_valid_upto="2031-03-15",
            insurance_company="Tata AIG General Insurance",
            fitness_valid_upto="2028-06-30",
            tax_valid_upto="2026-12-31",
            pucc_valid_upto="2026-06-30",
            owner_name="Rudra",
            chassis_masked="**********1234",
            raw={"source": "mock", "is_test_vehicle": True}
        )
    """Deterministic demo data when no external API is configured."""
    h = int(hashlib.sha256(normalized_reg.encode()).hexdigest()[:8], 16)
    years = ["2018", "2019", "2020", "2021", "2022", "2023", "2024"]
    makes = ["Tata", "Ashok Leyland", "Mahindra", "BharatBenz", "Eicher"]
    models = ["ACE Gold", "Boss 1215", "Bolero Pickup", "2523R", "Pro 2049"]
    y = years[h % len(years)]
    return VehicleRTOResponse(
        reg=normalized_reg,
        make=makes[h % len(makes)],
        model=models[h % len(models)],
        year=y,
        vehicle_class="Goods Vehicle (Commercial)",
        fuel_type="Diesel",
        insurance_valid_upto=f"{int(y) + 8}-03-15",
        insurance_company="Demo Insurer Co.",
        fitness_valid_upto=f"{int(y) + 5}-06-30",
        tax_valid_upto=f"{int(y) + 3}-12-31",
        pucc_valid_upto="2026-06-30",
        owner_name="",
        chassis_masked="**********" + str(h % 10000).zfill(4),
        raw={"source": "mock", "note": "Set VEHICLE_LOOKUP_PROVIDER=parivahan or http and URL for live data"},
    )


async def lookup_vehicle(registration: str) -> VehicleRTOResponse:
    normalized = normalize_indian_registration(registration)
    if len(normalized) < 4:
        raise ValueError("Registration number is too short")

    provider = (settings.VEHICLE_LOOKUP_PROVIDER or "mock").lower()

    if provider == "mock":
        return _mock_response(normalized)

    if provider == "http":
        return await _lookup_http(normalized)

    if provider == "parivahan":
        return await _lookup_parivahan(normalized)

    raise ValueError(f"Unknown VEHICLE_LOOKUP_PROVIDER: {provider}")


async def _lookup_parivahan(normalized_reg: str) -> VehicleRTOResponse:
    # Everything before the last four digits: e.g. MH02CL
    # The last four digits: e.g. 0555
    m = re.match(r"^(.*?)([0-9]{1,4})$", normalized_reg)
    if not m:
        raise ValueError("Cannot split registration number for Parivahan")
    first, second = m.groups()

    home_url = "https://parivahan.gov.in/rcdlstatus/"
    post_url = "https://parivahan.gov.in/rcdlstatus/vahan/rcDlHome.xhtml"

    timeout = httpx.Timeout(30.0)
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            # Initial request to get session and ViewState
            r = await client.get(home_url)
            r.raise_for_status()

            soup = BeautifulSoup(r.text, "html.parser")
            vs_input = soup.find("input", {"name": "javax.faces.ViewState"})
            if not vs_input:
                raise ValueError("Could not find javax.faces.ViewState on Parivahan page")

            viewstate = vs_input.get("value")

            data = {
                "javax.faces.partial.ajax": "true",
                "javax.faces.source": "form_rcdl:j_idt32",
                "javax.faces.partial.execute": "@all",
                "javax.faces.partial.render": "form_rcdl:pnl_show form_rcdl:pg_show form_rcdl:rcdl_pnl",
                "form_rcdl:j_idt32": "form_rcdl:j_idt32",
                "form_rcdl": "form_rcdl",
                "form_rcdl:tf_reg_no1": first,
                "form_rcdl:tf_reg_no2": second,
                "javax.faces.ViewState": viewstate,
            }

            # POST request to get the vehicle details
            r = await client.post(post_url, data=data)
            r.raise_for_status()

            # Extract table data
            soup = BeautifulSoup(r.text, "html.parser")
            # Parivahan returns XML for AJAX, but we can search for tables or rows inside it.
            # Often the response is wrapped in <partial-response> or CDATA.
            content = r.text
            if "<![CDATA[" in content:
                content = content.split("<![CDATA[")[1].split("]]>")[0]

            inner_soup = BeautifulSoup(content, "html.parser")
            rows = inner_soup.find_all("tr")
            if not rows:
                # Maybe it's a different table format, let's try reading the whole text
                text = inner_soup.get_text()
                if "No record found" in text or "Invalid" in text:
                    raise ValueError(f"Vehicle not found on Parivahan: {normalized_reg}")
                # If we see any rows, we'll try to map them
                raise ValueError("Unexpected response from Parivahan (no data table found)")

            scraped_data: Dict[str, str] = {}
            for row in rows:
                cols = row.find_all(["td", "th"])
                if len(cols) >= 2:
                    # Often it's | Label | Value |
                    label = cols[0].get_text().strip().lower().replace(":", "")
                    value = cols[1].get_text().strip()
                    if label:
                        scraped_data[label] = value
                if len(cols) >= 4:
                    # Or | Label 1 | Value 1 | Label 2 | Value 2 |
                    label2 = cols[2].get_text().strip().lower().replace(":", "")
                    value2 = cols[3].get_text().strip()
                    if label2:
                        scraped_data[label2] = value2

            out = extract_vehicle_from_payload(scraped_data)
            out.reg = out.reg or normalized_reg
            out.raw = scraped_data
            out.raw["_provider"] = "parivahan"
            return out
    except httpx.HTTPError as e:
        raise ValueError(f"Failed to connect to Parivahan portal: {str(e)}")


async def _lookup_http(normalized_reg: str) -> VehicleRTOResponse:
    url_tmpl = settings.VEHICLE_LOOKUP_HTTP_URL or ""
    if not url_tmpl or "{reg}" not in url_tmpl:
        raise ValueError(
            "VEHICLE_LOOKUP_HTTP_URL must include {reg} placeholder, e.g. "
            "https://your-api.example.com/rc?vehicle_no={reg}"
        )

    url = url_tmpl.format(reg=normalized_reg)
    headers: Dict[str, str] = {}
    if settings.VEHICLE_LOOKUP_HTTP_HEADERS:
        try:
            headers = json.loads(settings.VEHICLE_LOOKUP_HTTP_HEADERS)
        except json.JSONDecodeError as e:
            raise ValueError(f"VEHICLE_LOOKUP_HTTP_HEADERS must be valid JSON: {e}") from e

    timeout = httpx.Timeout(30.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        r = await client.get(url, headers=headers)
        r.raise_for_status()
        try:
            payload = r.json()
        except Exception as e:
            raise ValueError("Upstream response is not JSON") from e

    out = extract_vehicle_from_payload(payload)
    out.reg = out.reg or normalized_reg
    out.raw = dict(out.raw or {})
    out.raw["_provider"] = "http"
    return out
