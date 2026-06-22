import asyncio, httpx, json, base64, hashlib, sqlite3
from cryptography.fernet import Fernet
def get_key(s): return base64.urlsafe_b64encode(hashlib.sha256(s.encode()).digest())
def dec(c, s): return Fernet(get_key(s)).decrypt(c.encode()).decode()
async def main():
    s = "super-secret-key-for-local-dev-only-1234567890"
    conn = sqlite3.connect("github-backend-main/data/suprwise.db")
    row = conn.execute("SELECT user_id_encrypted, user_id_encrypt_encrypted, orgid_encrypted, sessionid_encrypted, tnt_s_encrypted FROM trakntell_credentials LIMIT 1").fetchone()
    if not row:
        print("Error: No Trak N Tell credentials found in database.")
        return
    u, ue, o, sid, ts = dec(row[0],s), dec(row[1],s), dec(row[2],s), dec(row[3],s), dec(row[4],s) if row[4] else None
    params = {"f":"l","u":u,"userIdEncrypt":ue,"orgid":o}
    cookies = {"JSESSIONID":sid}
    if ts: cookies["tnt_s"] = ts
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get("https://mapsweb.trakmtell.com/tnt/servlet/tntServiceGetCurrentStatus", params=params, cookies=cookies)
        data = json.loads(resp.text[resp.text.find('{'):resp.text.rfind('}')+1])
        vehicles = data.get("response", [])
        if not vehicles:
            print("No vehicles returned from API. Session might be expired.")
            return
        
        for v in vehicles:
            print(f"\n" + "="*60)
            print(f" LIVE DATA DUMP: {v.get('vehicle_no')} ({v.get('nick_name')})")
            print("="*60)
            
            groups = {
                "Engine & Fuel": ["j1939_fl_value", "j1939_ecp_value", "j1939_rpm_value", "j1939_rtfc_value", "fuel", "fuel_percentage", "engine_hour", "today_engine_hours"],
                "SLI Crane Sensors": ["ain8_label", "ain8_value", "ain9_label", "ain9_value", "ain10_label", "ain10_value", "ain11_label", "ain11_value", "ain12_label", "ain12_value", "ain13_label", "ain13_value", "ain14_label", "ain14_value"],
                "Device Health": ["main_voltage", "backup_voltage", "battery_charge_status", "isMainPowerLow", "gsm_signal", "network_status"],
                "GPS & Quality": ["currentLat", "currentLong", "speed", "no_of_satellites", "heading", "altitude", "hdop"],
                "Trip & Usage": ["odometer", "today_kms", "ignition_on_since", "ignition_off_since", "parked_since", "trip_distance"]
            }
            
            for group, keys in groups.items():
                print(f"\n[{group}]")
                for k in keys:
                    val = v.get(k)
                    if val is not None and val != "":
                        # Apply our corrections to the dump so user sees what Suprwise sees
                        if k == "j1939_fl_value":
                            print(f"  - Diesel (Corrected): {float(val)*0.5}% (Raw: {val})")
                        else:
                            print(f"  - {k}: {val}")
            
            # Print any other non-zero fields
            print("\n[Other Telemetry]")
            all_known = [k for gl in groups.values() for k in gl]
            for k in sorted(v.keys()):
                if k not in all_known and v[k] and v[k] != "0" and v[k] != 0:
                    print(f"  - {k}: {v[k]}")

if __name__ == "__main__": asyncio.run(main())
