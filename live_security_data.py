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
            print(f"\nLIVE SECURITY/ENV DATA: {v.get('registration_no') or v.get('nick_name')}")
            print("-" * 40)
            
            # Door Status
            door = v.get("door_status") or v.get("doorStatus") or v.get("door")
            if door is None: door_val = "⚪ NOT INSTALLED / NO SENSOR"
            else: door_val = f"🚪 {str(door).upper()}"
            print(f"Cabin Door Status: {door_val}")
            
            # AC Status
            ac = v.get("ac_status") or v.get("acStatus") or v.get("air_conditioner")
            if ac is None: ac_val = "⚪ NOT INSTALLED / NO SENSOR"
            else: ac_val = f"❄️ {str(ac).upper()}"
            print(f"Air Conditioner Status: {ac_val}")
            
            # Temperature
            temp1 = v.get("temperature") or v.get("temp1")
            temp2 = v.get("temperature2") or v.get("temp2")
            print(f"Internal Temperature 1: {temp1 if temp1 else '--'}°C")
            print(f"Internal Temperature 2: {temp2 if temp2 else '--'}°C")
            
            # Immobilizer
            immob = v.get("immobilizer_status") or v.get("immobilizer_value")
            immob_val = f"🔒 {str(immob).upper()}" if immob else "🟢 DISARMED / UNLOCKED"
            print(f"Remote Engine Lock (Immobilizer): {immob_val}")
            print("-" * 40)

if __name__ == "__main__": asyncio.run(main())
