import asyncio, httpx, json, base64, hashlib, sqlite3
from cryptography.fernet import Fernet

def get_key(s): return base64.urlsafe_b64encode(hashlib.sha256(s.encode()).digest())
def dec(c, s): return Fernet(get_key(s)).decrypt(c.encode()).decode()

async def main():
    s = "super-secret-key-for-local-dev-only-1234567890"
    conn = sqlite3.connect("github-backend-main/data/suprwise.db")
    row = conn.execute("SELECT user_id_encrypted, user_id_encrypt_encrypted, orgid_encrypted, sessionid_encrypted, tnt_s_encrypted FROM trakntell_credentials LIMIT 1").fetchone()
    if not row:
        print("Error: No Trak N Tell credentials found.")
        return
    u, ue, o, sid, ts = dec(row[0],s), dec(row[1],s), dec(row[2],s), dec(row[3],s), dec(row[4],s) if row[4] else None
    params = {"f":"l","u":u,"userIdEncrypt":ue,"orgid":o}
    cookies = {"JSESSIONID":sid}
    if ts: cookies["tnt_s"] = ts
    
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get("https://mapsweb.trakmtell.com/tnt/servlet/tntServiceGetCurrentStatus", params=params, cookies=cookies)
        data = json.loads(resp.text[resp.text.find('{'):resp.text.rfind('}')+1])
        vehicles = data.get("response", [])
        
        for v in vehicles:
            print(f"\nLIVE ENGINE/CAN DATA: {v.get('registration_no') or v.get('nick_name')}")
            print("-" * 40)
            
            # 1. Battery Potential
            raw_bat = v.get("j1939_sbp_value")
            bat_val = f"{float(raw_bat)/10:.1f}V" if raw_bat else "0.0V"
            print(f"Engine Battery Voltage (SBP): {bat_val}")
            
            # 2. Fuel Consumption
            raw_fc = v.get("j1939_rtfc_value")
            fc_val = f"{raw_fc} L/h" if raw_fc else "0 L/h"
            print(f"Real-time Fuel Consumption: {fc_val}")
            
            # 3. MIL (Check Engine)
            mil = v.get("j1939_mil_value")
            mil_status = "🔴 ON (FAULT DETECTED)" if str(mil) == "1" else "🟢 OFF (NORMAL)"
            print(f"Engine Check Light (MIL): {mil_status}")
            
            # 4. Stop Indicator
            stop_ind = v.get("j1939_si_value")
            stop_status = "🛑 ACTIVE (CRITICAL)" if str(stop_ind) == "1" else "🟢 CLEAR"
            print(f"Critical Stop Indicator: {stop_status}")
            
            # 5. Water in Fuel
            wif = v.get("j1939_wif_value")
            wif_status = "⚠️ DETECTED (DRAIN FILTER)" if str(wif) == "1" else "🟢 CLEAR"
            print(f"Water in Fuel Alert: {wif_status}")
            
            # 6. Odometer
            odom = v.get("odometer") or "0"
            print(f"Total Odometer: {odom} km")
            print("-" * 40)

if __name__ == "__main__": asyncio.run(main())
