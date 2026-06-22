import base64
import os
import json
import logging
from datetime import datetime
from typing import Optional, Dict, Any, List
from playwright.async_api import async_playwright

logger = logging.getLogger(__name__)

# Fallback values to match target quotation formatting precisely
DEFAULT_BANK_DETAILS = {
    "account_name": "Rudra Crane Service",
    "account_no": "50200069994091",
    "ifsc": "HDFC0007510",
    "account_type": "Current",
    "bank_name": "HDFC BANK"
}

DEFAULT_TERMS = [
    "Operator will be provided by Rudra Crane Service, but any other labour requirement as per work requirement will not be responsible our responsibility.",
    "The crane will operate for 8 hours per day.",
    "Any additional working hours beyond 8 hours will be charged extra as per mutually agreed rates.",
    "Food for the operator will be arranged by the client.",
    "The client must ensure safe working conditions at the site."
]

def format_inr(number: float) -> str:
    """Format float into Indian Rupee formatting, e.g. 6180.0 -> 6,180.00"""
    try:
        val = float(number)
    except (ValueError, TypeError):
        return "₹0.00"
    
    s = f"{val:,.2f}"
    parts = s.split(".")
    integer_part = parts[0].replace(",", "")
    decimal_part = parts[1]
    
    if len(integer_part) <= 3:
        return f"₹{integer_part}.{decimal_part}"
        
    last_three = integer_part[-3:]
    remaining = integer_part[:-3]
    
    groups = []
    while len(remaining) > 0:
        groups.append(remaining[-2:])
        remaining = remaining[:-2]
        
    groups.reverse()
    groups.append(last_three)
    return f"₹{','.join(groups)}.{decimal_part}"

def extract_pan(gstin: str) -> str:
    """Derive PAN from a 15-digit GSTIN (characters at index 2 to 12)"""
    if gstin and isinstance(gstin, str) and len(gstin) >= 12:
        return gstin[2:12].upper()
    return ""

def number_to_indian_words(number: float) -> str:
    """Convert number to Indian Rupee word representation (in uppercase)"""
    try:
        val = round(float(number))
    except (ValueError, TypeError):
        return "ZERO RUPEES ONLY"
        
    if val == 0:
        return "ZERO RUPEES ONLY"
        
    ones = ["", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN", 
            "ELEVEN", "TWELVE", "THIRTEEN", "FOURTEEN", "FIFTEEN", "SIXTEEN", "SEVENTEEN", "EIGHTEEN", "NINETEEN"]
    tens = ["", "", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY", "SEVENTY", "EIGHTY", "NINETY"]
    
    def convert_below_thousand(num):
        if num < 20:
            return ones[num]
        elif num < 100:
            tens_str = tens[num // 10]
            ones_str = ones[num % 10]
            return f"{tens_str} {ones_str}".strip()
        else:
            hundreds_str = ones[num // 100]
            rest_str = convert_below_thousand(num % 100)
            if rest_str:
                return f"{hundreds_str} HUNDRED {rest_str}"
            return f"{hundreds_str} HUNDRED"
            
    crores = val // 10000000
    val %= 10000000
    lakhs = val // 100000
    val %= 100000
    thousands = val // 1000
    val %= 1000
    
    parts = []
    if crores > 0:
        parts.append(f"{convert_below_thousand(crores)} CRORE")
    if lakhs > 0:
        parts.append(f"{convert_below_thousand(lakhs)} LAKH")
    if thousands > 0:
        parts.append(f"{convert_below_thousand(thousands)} THOUSAND")
    rest = convert_below_thousand(val)
    if rest:
        parts.append(rest)
        
    return " ".join(parts) + " RUPEES ONLY"

def get_logo_base64() -> str:
    """Look up the crane-logo.png in the project structure and return as base64 string"""
    possible_paths = [
        "/Users/rudra/Desktop/github-backend-main-2/reactcodewebapp-main/public/crane-logo.png",
        "../reactcodewebapp-main/public/crane-logo.png",
        "reactcodewebapp-main/public/crane-logo.png",
        "./public/crane-logo.png",
        "suprwise/static/crane-logo.png"
    ]
    for path in possible_paths:
        if os.path.exists(path):
            try:
                with open(path, "rb") as f:
                    return base64.b64encode(f.read()).decode("utf-8")
            except Exception as e:
                logger.error(f"Error reading logo at {path}: {e}")
    return ""

def format_date_str(date_val: Optional[str]) -> str:
    """Format string date to 'MMM DD, YYYY' format for the header"""
    if not date_val:
        return ""
    # Standard formats YYYY-MM-DD
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            dt = datetime.strptime(date_val.split("T")[0], fmt)
            return dt.strftime("%b %d, %Y")
        except ValueError:
            continue
    return date_val

async def generate_billing_pdf(
    doc_type: str, # "Quotation" or "Invoice"
    doc: Dict[str, Any],
    client: Optional[Dict[str, Any]],
    owner: Optional[Dict[str, Any]]
) -> bytes:
    """Renders the HTML template using Playwright print-to-pdf to match the requested layout."""
    
    # 1. Company Profile (From)
    owner_company = (owner or {}).get("company") or "Rudra Crane Service"
    owner_address = (owner or {}).get("address") or "Plot No 2311/6832 Niladri Nagar Lane No 7, Bhubaneswar"
    owner_city = (owner or {}).get("city") or "Bhubaneswar"
    owner_state = (owner or {}).get("state") or "Odisha"
    owner_pincode = (owner or {}).get("pincode") or "751006"
    owner_gstin = (owner or {}).get("gst") or "21ABEFR8041B1ZQ"
    owner_pan = extract_pan(owner_gstin) or "ABEFR8041B"
    owner_email = (owner or {}).get("email") or "rudra7791@gmail.com"
    owner_phone = (owner or {}).get("phone") or "+91 99379 92410"
    
    # 2. Client Profile (For)
    client_name = (client or {}).get("name") or "SMS INDIA PRIVATE LTD."
    client_address = (client or {}).get("address") or "Plot No- A/26 Khurda Industrial Estate, Mouza- Mukunda Prasad"
    client_city = (client or {}).get("city") or ""
    client_state = (client or {}).get("state") or "Odisha"
    client_pincode = (client or {}).get("pincode") or ""
    client_gstin = (client or {}).get("gstin") or ""
    client_pan = extract_pan(client_gstin)
    
    # Build complete addresses
    full_owner_address = f"{owner_address}, {owner_city}, {owner_state} - {owner_pincode}"
    full_client_address = client_address
    if client_city:
        full_client_address += f", {client_city}"
    if client_state:
        full_client_address += f", {client_state}"
    if client_pincode:
        full_client_address += f" - {client_pincode}"
        
    # 3. Document Details
    doc_number = doc.get("number") or "A000197"
    doc_date = format_date_str(doc.get("date"))
    
    # 4. Items Table
    raw_items = doc.get("items") or "[]"
    if isinstance(raw_items, str):
        try:
            items = json.loads(raw_items)
        except Exception:
            items = []
    else:
        items = raw_items
        
    formatted_items = []
    subtotal = 0
    cgst_total = 0
    sgst_total = 0
    total_qty = 0
    
    for idx, it in enumerate(items, 1):
        desc_raw = it.get("description") or ""
        parts = desc_raw.split("\n")
        title = parts[0]
        details = parts[1:] if len(parts) > 1 else []
        
        qty = float(it.get("qty") or 1)
        rate = float(it.get("rate") or 0)
        discount = float(it.get("discount") or 0)
        
        # Calculate amount after discount
        base_amt = qty * rate
        disc_factor = 1.0 - (discount / 100.0)
        amount = round(base_amt * disc_factor, 2)
        
        gst_rate = float(it.get("gstRate") or it.get("gst_rate") or 18)
        
        cgst = round(amount * (gst_rate / 200.0), 2)
        sgst = round(amount * (gst_rate / 200.0), 2)
        total = amount + cgst + sgst
        
        subtotal += amount
        cgst_total += cgst
        sgst_total += sgst
        total_qty += qty
        
        gst_rate_display = f"{int(gst_rate)}%" if gst_rate.is_integer() else f"{gst_rate}%"
        
        formatted_items.append({
            "index": idx,
            "title": title,
            "details": details,
            "gst_rate": gst_rate_display,
            "qty": int(qty) if qty.is_integer() else qty,
            "rate": format_inr(rate),
            "amount": format_inr(amount),
            "cgst": format_inr(cgst),
            "sgst": format_inr(sgst),
            "total": format_inr(total)
        })
        
    grand_total = subtotal + cgst_total + sgst_total
    
    # 5. Terms & Conditions
    terms_raw = doc.get("terms") or "[]"
    if isinstance(terms_raw, str):
        try:
            terms = json.loads(terms_raw)
        except Exception:
            terms = DEFAULT_TERMS
    else:
        terms = terms_raw
    if not terms or len(terms) == 0:
        terms = DEFAULT_TERMS
        
    # Words conversion
    words_total = number_to_indian_words(grand_total)
    
    # Logo HTML
    logo_b64 = get_logo_base64()
    logo_html = f'<img src="data:image/png;base64,{logo_b64}" alt="Logo" class="logo" />' if logo_b64 else '<div class="logo-placeholder"></div>'

    # Build dynamically constructed HTML chunks outside f-string to avoid brace errors
    owner_extra_html = ""
    if owner_email:
        owner_extra_html += f'<div><span class="label">Email:</span><span class="value">{owner_email}</span></div>'
    if owner_phone:
        owner_extra_html += f'<div><span class="label">Phone:</span><span class="value">{owner_phone}</span></div>'

    client_extra_html = ""
    if client_gstin:
        client_extra_html += f'<div><span class="label">GSTIN:</span><span class="value">{client_gstin}</span></div>'
        client_extra_html += f'<div><span class="label">PAN:</span><span class="value">{client_pan}</span></div>'

    items_rows_html_list = []
    for it in formatted_items:
        details_html = "".join([f'<div class="item-desc-details">{d}</div>' for d in it["details"]])
        row = f"""
        <tr>
            <td class="center">{it["index"]}</td>
            <td>
                <div class="item-desc-title">{it["title"]}</div>
                {details_html}
            </td>
            <td class="center">{it["gst_rate"]}</td>
            <td class="center">{it["qty"]}</td>
            <td class="right">{it["rate"]}</td>
            <td class="right">{it["amount"]}</td>
            <td class="right">{it["cgst"]}</td>
            <td class="right">{it["sgst"]}</td>
            <td class="right">{it["total"]}</td>
        </tr>
        """
        items_rows_html_list.append(row)
    items_rows_html_str = "".join(items_rows_html_list)

    terms_lis_html = "".join([f"<li>{t}</li>" for t in terms])
    total_qty_display = int(total_qty) if total_qty.is_integer() else total_qty

    # Build the HTML template
    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>{doc_type} - {doc_number}</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            
            body {{
                font-family: 'Inter', sans-serif;
                color: #1f2937;
                background-color: #ffffff;
                margin: 0;
                padding: 0;
                font-size: 11px;
                line-height: 1.4;
            }}
            
            /* Container styling */
            .invoice-container {{
                padding: 10px;
                max-width: 800px;
                margin: 0 auto;
                background: #ffffff;
            }}
            
            /* Header Row */
            .header-row {{
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 25px;
            }}
            
            .title-section h1 {{
                font-size: 28px;
                color: #5C2D91;
                margin: 0 0 8px 0;
                font-weight: 700;
                letter-spacing: -0.02em;
            }}
            
            .meta-item {{
                font-size: 11.5px;
                margin-bottom: 4px;
                color: #4b5563;
            }}
            
            .meta-item strong {{
                color: #1f2937;
                font-weight: 600;
            }}
            
            .logo-section .logo {{
                max-height: 55px;
                width: auto;
                object-fit: contain;
            }}
            
            /* Addresses side-by-side block */
            .addresses-grid {{
                display: flex;
                gap: 20px;
                margin-bottom: 25px;
            }}
            
            .address-card {{
                flex: 1;
                background: #fcfbfe;
                border: 1px solid #f0eaf8;
                border-radius: 10px;
                padding: 14px 16px;
            }}
            
            .address-card h3 {{
                font-size: 13px;
                color: #5C2D91;
                margin: 0 0 10px 0;
                font-weight: 600;
                border-bottom: 1.5px solid #f0eaf8;
                padding-bottom: 6px;
            }}
            
            .address-card .org-name {{
                font-size: 12px;
                font-weight: 700;
                margin-bottom: 8px;
                color: #111827;
            }}
            
            .address-card .address-text {{
                color: #4b5563;
                margin-bottom: 10px;
                line-height: 1.4;
                font-size: 10.5px;
            }}
            
            .details-list {{
                display: flex;
                flex-direction: column;
                gap: 3px;
                font-size: 10.5px;
            }}
            
            .details-list div {{
                display: flex;
            }}
            
            .details-list span.label {{
                width: 55px;
                color: #6b7280;
                font-weight: 500;
            }}
            
            .details-list span.value {{
                color: #1f2937;
                font-weight: 500;
            }}
            
            /* Items Table */
            .items-table {{
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 20px;
                border-radius: 8px;
                overflow: hidden;
            }}
            
            .items-table th {{
                background-color: #5C2D91;
                color: #ffffff;
                font-weight: 600;
                font-size: 10.5px;
                text-align: left;
                padding: 8px 10px;
                text-transform: uppercase;
                letter-spacing: 0.03em;
            }}
            
            .items-table td {{
                padding: 10px 10px;
                border-bottom: 1px solid #f3e8ff;
                font-size: 10.5px;
                vertical-align: top;
            }}
            
            .items-table tr:nth-child(even) td {{
                background-color: #faf8ff;
            }}
            
            .items-table td.center {{
                text-align: center;
            }}
            
            .items-table td.right {{
                text-align: right;
            }}
            
            .item-desc-title {{
                font-weight: 600;
                color: #111827;
                margin-bottom: 3px;
            }}
            
            .item-desc-details {{
                color: #6b7280;
                font-size: 9.5px;
                white-space: pre-line;
            }}
            
            .items-table .total-row td {{
                font-weight: 700;
                background-color: #f3effa !important;
                border-top: 1.5px solid #5C2D91;
                color: #111827;
            }}
            
            /* Total in words */
            .words-row {{
                font-size: 11px;
                margin-bottom: 25px;
                color: #374151;
            }}
            
            .words-row strong {{
                color: #111827;
                font-weight: 700;
            }}
            
            /* Bottom Blocks: Bank details and totals grid */
            .bottom-summary-section {{
                display: flex;
                gap: 20px;
                margin-bottom: 25px;
                align-items: flex-start;
            }}
            
            .bank-details-card {{
                flex: 1.2;
                background: #fcfbfe;
                border: 1px solid #f0eaf8;
                border-radius: 10px;
                padding: 14px 16px;
            }}
            
            .bank-details-card h3 {{
                font-size: 12.5px;
                color: #5C2D91;
                margin: 0 0 10px 0;
                font-weight: 600;
                border-bottom: 1.5px solid #f0eaf8;
                padding-bottom: 6px;
            }}
            
            .bank-grid {{
                display: grid;
                grid-template-columns: 95px 1fr;
                gap: 6px 10px;
                font-size: 10.5px;
            }}
            
            .bank-grid div.lbl {{
                color: #6b7280;
                font-weight: 500;
            }}
            
            .bank-grid div.val {{
                color: #1f2937;
                font-weight: 600;
            }}
            
            .totals-column {{
                flex: 0.8;
                display: flex;
                flex-direction: column;
                align-items: flex-end;
            }}
            
            .totals-box {{
                width: 100%;
                border-collapse: collapse;
                font-size: 11px;
            }}
            
            .totals-box td {{
                padding: 6px 8px;
                color: #4b5563;
            }}
            
            .totals-box td.val {{
                text-align: right;
                font-weight: 600;
                color: #1f2937;
            }}
            
            .totals-box tr.grand-total td {{
                font-size: 14px;
                font-weight: 700;
                color: #5C2D91;
                border-top: 1.5px solid #5C2D91;
                border-bottom: 1.5px solid #5C2D91;
                background-color: #fcfbfe;
                padding: 8px 8px;
            }}
            
            .totals-box tr.grand-total td.val {{
                color: #5C2D91;
            }}
            
            /* Signatory block */
            .signatory-row {{
                display: flex;
                justify-content: flex-end;
                margin-top: 5px;
                margin-bottom: 30px;
            }}
            
            .signatory-container {{
                text-align: center;
                width: 160px;
                display: flex;
                flex-direction: column;
                align-items: center;
            }}
            
            .stamp-placeholder {{
                height: 120px;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-bottom: 5px;
            }}
            
            .signatory-title {{
                font-size: 11px;
                font-weight: 600;
                color: #374151;
                border-top: 1px dashed #9ca3af;
                padding-top: 6px;
                width: 100%;
            }}
            
            /* Terms Section */
            .terms-section {{
                border-top: 1.5px solid #f0eaf8;
                padding-top: 15px;
            }}
            
            .terms-section h3 {{
                font-size: 12px;
                color: #5C2D91;
                margin: 0 0 10px 0;
                font-weight: 600;
            }}
            
            .terms-list {{
                margin: 0;
                padding-left: 15px;
                color: #4b5563;
                font-size: 10px;
                line-height: 1.5;
            }}
            
            .terms-list li {{
                margin-bottom: 4px;
            }}
            
            /* Page Break utilities */
            .page-break {{
                page-break-before: always;
            }}
            
            .no-break {{
                page-break-inside: avoid;
            }}
        </style>
    </head>
    <body>
        <div class="invoice-container">
            <!-- HEADER -->
            <div class="header-row">
                <div class="title-section">
                    <h1>{doc_type}</h1>
                    <div class="meta-item"><strong>{doc_type} No #</strong> {doc_number}</div>
                    <div class="meta-item"><strong>{doc_type} Date:</strong> {doc_date}</div>
                </div>
                <div class="logo-section">
                    {logo_html}
                </div>
            </div>
            
            <!-- ADDRESSES -->
            <div class="addresses-grid">
                <div class="address-card">
                    <h3>{doc_type} From</h3>
                    <div class="org-name">{owner_company}</div>
                    <div class="address-text">{full_owner_address}</div>
                    <div class="details-list">
                        <div><span class="label">GSTIN:</span><span class="value">{owner_gstin}</span></div>
                        <div><span class="label">PAN:</span><span class="value">{owner_pan}</span></div>
                        {owner_extra_html}
                    </div>
                </div>
                <div class="address-card">
                    <h3>{doc_type} For</h3>
                    <div class="org-name">{client_name}</div>
                    <div class="address-text">{full_client_address}</div>
                    <div class="details-list">
                        {client_extra_html}
                    </div>
                </div>
            </div>
            
            <!-- ITEMS TABLE -->
            <table class="items-table">
                <thead>
                    <tr>
                        <th style="width: 4%; text-align: center;">#</th>
                        <th style="width: 32%;">Item</th>
                        <th style="width: 8%; text-align: center;">GST</th>
                        <th style="width: 10%; text-align: center;">Qty</th>
                        <th style="width: 11%; text-align: right;">Rate</th>
                        <th style="width: 11%; text-align: right;">Amount</th>
                        <th style="width: 10%; text-align: right;">CGST</th>
                        <th style="width: 10%; text-align: right;">SGST</th>
                        <th style="width: 12%; text-align: right;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    {items_rows_html_str}
                    <tr class="total-row">
                        <td colspan="3">Total</td>
                        <td class="center">{total_qty_display}</td>
                        <td class="right"></td>
                        <td class="right">{format_inr(subtotal)}</td>
                        <td class="right">{format_inr(cgst_total)}</td>
                        <td class="right">{format_inr(sgst_total)}</td>
                        <td class="right">{format_inr(grand_total)}</td>
                    </tr>
                </tbody>
            </table>
            
            <!-- WORDS ROW -->
            <div class="words-row">
                Total (in words) : <strong>{words_total}</strong>
            </div>
            
            <!-- BOTTOM BLOCK: BANK DETAILS + TOTALS -->
            <div class="bottom-summary-section no-break">
                <div class="bank-details-card">
                    <h3>Bank Details</h3>
                    <div class="bank-grid">
                        <div class="lbl">Account Name</div><div class="val">{DEFAULT_BANK_DETAILS['account_name']}</div>
                        <div class="lbl">Account Number</div><div class="val">{DEFAULT_BANK_DETAILS['account_no']}</div>
                        <div class="lbl">IFSC</div><div class="val">{DEFAULT_BANK_DETAILS['ifsc']}</div>
                        <div class="lbl">Account Type</div><div class="val">{DEFAULT_BANK_DETAILS['account_type']}</div>
                        <div class="lbl">Bank</div><div class="val">{DEFAULT_BANK_DETAILS['bank_name']}</div>
                    </div>
                </div>
                
                <div class="totals-column">
                    <table class="totals-box">
                        <tr>
                            <td>Amount</td>
                            <td class="val">{format_inr(subtotal)}</td>
                        </tr>
                        <tr>
                            <td>CGST</td>
                            <td class="val">{format_inr(cgst_total)}</td>
                        </tr>
                        <tr>
                            <td>SGST</td>
                            <td class="val">{format_inr(sgst_total)}</td>
                        </tr>
                        <tr class="grand-total">
                            <td>Total (INR)</td>
                            <td class="val">{format_inr(grand_total)}</td>
                        </tr>
                    </table>
                </div>
            </div>
            
            <!-- SIGNATURE -->
            <div class="signatory-row no-break">
                <div class="signatory-container">
                    <div class="stamp-placeholder">
                        <!-- Vector Graphic Seal of Rudra Crane Service -->
                        <svg width="110" height="110" viewBox="0 0 150 150" style="color: rgba(30, 58, 138, 0.85); font-family: sans-serif;">
                            <circle cx="75" cy="75" r="70" fill="none" stroke="currentColor" stroke-dasharray="3,3" stroke-width="1.5" />
                            <circle cx="75" cy="75" r="66" fill="none" stroke="currentColor" stroke-width="2.5" />
                            <circle cx="75" cy="75" r="44" fill="none" stroke="currentColor" stroke-width="1.5" />
                            
                            <path id="curve-top" fill="none" d="M 18,75 A 57,57 0 0,1 132,75" />
                            <path id="curve-bottom" fill="none" d="M 132,75 A 57,57 0 0,1 18,75" />
                            
                            <text font-size="10.5" font-weight="bold" fill="currentColor">
                                <textPath href="#curve-top" startOffset="50%" text-anchor="middle">RUDRA CRANE SERVICE</textPath>
                            </text>
                            <text font-size="10.5" font-weight="bold" fill="currentColor">
                                <textPath href="#curve-bottom" startOffset="50%" text-anchor="middle">★ BBSR ★</textPath>
                            </text>
                            
                            <text x="75" y="70" font-size="12" font-weight="bold" fill="currentColor" text-anchor="middle">BBSR</text>
                            <text x="75" y="84" font-size="9" font-weight="bold" fill="currentColor" text-anchor="middle">Jaspal Pandey</text>
                            <line x1="42" y1="92" x2="108" y2="92" stroke="currentColor" stroke-width="1" />
                        </svg>
                    </div>
                    <div class="signatory-title">Authorised Signatory</div>
                </div>
            </div>
            
            <!-- TERMS & CONDITIONS -->
            <div class="terms-section no-break">
                <h3>Terms and Conditions</h3>
                <ol class="terms-list">
                    {terms_lis_html}
                </ol>
            </div>
        </div>
    </body>
    </html>
    """

    # 6. Playwright PDF Footer Template (replicates bottom line and formatting of page number)
    client_name_preview = client_name[:32] + "..." if len(client_name) > 35 else client_name
    footer_html = f"""
    <div style="font-size: 8px; font-family: 'Inter', sans-serif; color: #6b7280; width: 100%; display: flex; justify-content: space-between; padding: 0 45px; border-top: 1px dashed #e5e7eb; padding-top: 8px; margin-bottom: 2px;">
      <div>{doc_type} No: {doc_number} &nbsp;|&nbsp; Date: {doc_date} &nbsp;|&nbsp; For: {client_name_preview}</div>
      <div>Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>
    </div>
    """

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        
        # Open in print media mode to trigger CSS print selectors
        await page.emulate_media(media="print")
        
        # Set HTML content
        await page.set_content(html_content)
        
        # Print to PDF using A4, matching the exact spacing
        pdf_bytes = await page.pdf(
            format="A4",
            print_background=True,
            display_header_footer=True,
            header_template="<div style='font-size: 1px;'></div>",
            footer_template=footer_html,
            margin={
                "top": "15mm",
                "bottom": "22mm",
                "left": "15mm",
                "right": "15mm"
            }
        )
        
        await browser.close()
        
    return pdf_bytes
