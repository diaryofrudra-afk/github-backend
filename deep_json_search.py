import asyncio, httpx, json, base64, hashlib, sqlite3
from cryptography.fernet import Fernet

def get_key(s): return base64.urlsafe_b64encode(hashlib.sha256(s.encode()).digest())
def dec(c, s): return Fernet(get_key(s)).decrypt(c.encode()).decode()

async def main():
    s = "super-secret-key-for-local-dev-only-1234567890"
    conn = sqlite3.connect("github-backend-main/data/suprwise.db")
    row = conn.execute("SELECT user_id_encrypted, user_id_encrypt_encrypted, orgid_encrypted, sessionid_encrypted, tnt_s_encrypted FROM trakntell_credentials LIMIT 1").fetchone()
    u, ue, o, sid, ts = dec(row[0],s), dec(row[1],s), dec(row[2],s), dec(row[3],s), dec(row[4],s) if row[4] else None
    
    # We'll fetch multiple formats to see if 'Not configured' is a server-side flag we can bypass
    formats = ["l", "v", "i", "s"] 
    async with httpx.AsyncClient(timeout=30) as client:
        for fmt in formats:
            params = {"f": fmt, "u": u, "userIdEncrypt": ue, "orgid": o}
            cookies = {"JSESSIONID": sid}
            if ts: cookies["tnt_s"] = ts
            
            resp = await client.get("https://mapsweb.trakmtell.com/tnt/servlet/tntServiceGetCurrentStatus", params=params, cookies=cookies)
            try:
                data = json.loads(resp.text[resp.text.find('{'):resp.text.rfind('}')+1])
                for v in data.get("response", []):
                    print(f"\n--- FORMAT [{fmt}] | {v.get('registration_no')} ---")
                    # Search for any key related to immobilization, blocking, commands, or configuration flags
                    keywords = ['immob', 'lock', 'block', 'command', 'config', 'relay', 'enable', 'allow', 'billing', 'control']
                    for k in sorted(v.keys()):
                        if any(kw in k.lower() for kw in keywords):
                            print(f"{k}: {v[k]}")
            except:
                continue

if __name__ == "__main__": asyncio.run(main())
