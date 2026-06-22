import asyncio
import httpx
import json
import base64
import hashlib
from cryptography.fernet import Fernet
import sqlite3

def get_key(secret):
    digest = hashlib.sha256(secret.encode()).digest()
    return base64.urlsafe_b64encode(digest)

def decrypt_token(ciphertext, secret):
    f = Fernet(get_key(secret))
    return f.decrypt(ciphertext.encode()).decode()

async def main():
    db_path = "github-backend-main/data/suprwise.db"
    secret = "change-me"
    
    conn = sqlite3.connect(db_path)
    creds_row = conn.execute("SELECT user_id_encrypted, user_id_encrypt_encrypted, orgid_encrypted, sessionid_encrypted, tnt_s_encrypted FROM trakntell_credentials LIMIT 1").fetchone()
    if not creds_row:
        print("No TnT credentials found")
        return

    creds = {
        "u": decrypt_token(creds_row[0], secret),
        "userIdEncrypt": decrypt_token(creds_row[1], secret),
        "orgid": decrypt_token(creds_row[2], secret),
        "JSESSIONID": decrypt_token(creds_row[3], secret),
    }
    tnt_s = decrypt_token(creds_row[4], secret) if creds_row[4] else None

    url = "https://mapsweb.trakmtell.com/tnt/servlet/tntServiceGetCurrentStatus"
    params = {
        "f": "l",
        "u": creds["u"],
        "userIdEncrypt": creds["userIdEncrypt"],
        "orgid": creds["orgid"],
    }
    cookies = {"JSESSIONID": creds["JSESSIONID"]}
    if tnt_s: cookies["tnt_s"] = tnt_s

    headers = {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json",
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url, params=params, cookies=cookies, headers=headers)
        text = resp.text
        first = text.find('{')
        last = text.rfind('}')
        data = json.loads(text[first:last+1])
        
        for v in data.get("response", []):
            print(f"\n--- Vehicle: {v.get('vehicle_no')} ---")
            fuel_keys = [k for k in v.keys() if 'fuel' in k.lower() or 'fl' in k.lower() or 'ain' in k.lower()]
            for k in sorted(fuel_keys):
                print(f"{k}: {v[k]}")

if __name__ == "__main__":
    asyncio.run(main())
