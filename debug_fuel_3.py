import asyncio, httpx, json, base64, hashlib, sqlite3
from cryptography.fernet import Fernet
def get_key(s): return base64.urlsafe_b64encode(hashlib.sha256(s.encode()).digest())
def dec(c, s): return Fernet(get_key(s)).decrypt(c.encode()).decode()
async def main():
    s = "super-secret-key-for-local-dev-only-1234567890"
    conn = sqlite3.connect("github-backend-main/data/suprwise.db")
    row = conn.execute("SELECT user_id_encrypted, user_id_encrypt_encrypted, orgid_encrypted, sessionid_encrypted, tnt_s_encrypted FROM trakntell_credentials LIMIT 1").fetchone()
    u, ue, o, sid, ts = dec(row[0],s), dec(row[1],s), dec(row[2],s), dec(row[3],s), dec(row[4],s) if row[4] else None
    params = {"f":"l","u":u,"userIdEncrypt":ue,"orgid":o}
    cookies = {"JSESSIONID":sid}
    if ts: cookies["tnt_s"] = ts
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get("https://mapsweb.trakmtell.com/tnt/servlet/tntServiceGetCurrentStatus", params=params, cookies=cookies)
        data = json.loads(resp.text[resp.text.find('{'):resp.text.rfind('}')+1])
        for v in data.get("response", []):
            print(f"Vehicle: {v.get('registration_no')}")
            print(f"  fuelPercentage: {v.get('fuelPercentage')}")
            print(f"  fuel_level: {v.get('fuel_level')}")
            print(f"  j1939_fl_value: {v.get('j1939_fl_value')}")
            print(f"  fuel: {v.get('fuel')}")
if __name__ == "__main__": asyncio.run(main())
