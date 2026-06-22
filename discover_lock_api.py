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
    secret = "super-secret-key-for-local-dev-only-1234567890"
    
    conn = sqlite3.connect(db_path)
    creds_row = conn.execute("SELECT user_id_encrypted, user_id_encrypt_encrypted, orgid_encrypted, sessionid_encrypted, tnt_s_encrypted FROM trakntell_credentials LIMIT 1").fetchone()
    creds = {
        "u": decrypt_token(creds_row[0], secret),
        "userIdEncrypt": decrypt_token(creds_row[1], secret),
        "orgid": decrypt_token(creds_row[2], secret),
        "JSESSIONID": decrypt_token(creds_row[3], secret),
    }
    tnt_s = decrypt_token(creds_row[4], secret) if creds_row[4] else None

    # Get vehicle ID
    url_status = "https://mapsweb.trakmtell.com/tnt/servlet/tntServiceGetCurrentStatus"
    params_status = {"f": "l", "u": creds["u"], "userIdEncrypt": creds["userIdEncrypt"], "orgid": creds["orgid"]}
    cookies = {"JSESSIONID": creds["JSESSIONID"]}
    if tnt_s: cookies["tnt_s"] = tnt_s

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url_status, params=params_status, cookies=cookies)
        data = json.loads(resp.text[resp.text.find('{'):resp.text.rfind('}')+1])
        v_id = data.get("response", [{}])[0].get("vehicleid")
        
        ENDPOINTS = [
            "tntServiceControl",
            "tntServiceSetImmobilizer",
            "tntServiceSetCommand",
            "tntServiceCommand",
            "tntServiceSetLock",
            "tntServiceImmobilizer"
        ]
        
        for ep in ENDPOINTS:
            url = f"https://mapsweb.trakmtell.com/tnt/servlet/{ep}"
            print(f"Probing: {url}")
            try:
                # Try a safe 'unlock' or 'status' check
                r = await client.get(url, params={"f": "unlock", "u": creds["u"], "v": v_id, "orgid": creds["orgid"]}, cookies=cookies)
                print(f"  Result: {r.status_code}")
                if r.status_code == 200:
                    print(f"  FOUND POTENTIAL ENDPOINT: {ep}")
                    print(f"  Response: {r.text[:100]}")
            except Exception as e:
                print(f"  Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
