#!/usr/bin/env python3
"""Decrypt TrakNTell credentials and make raw API call to capture all response fields."""
import base64
import hashlib
import json
import sqlite3
import httpx
from cryptography.fernet import Fernet

JWT_SECRET = "dev-secret-key-change-in-production-to-a-60-char-random-string"

def get_key():
    digest = hashlib.sha256(JWT_SECRET.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)

def decrypt_token(ciphertext):
    f = Fernet(get_key())
    return f.decrypt(ciphertext.encode("utf-8")).decode("utf-8")

# Read DB
db = sqlite3.connect("/Users/rudra/Downloads/github-backend-main/data/suprwise.db")
cursor = db.execute("SELECT user_id_encrypted, user_id_encrypt_encrypted, orgid_encrypted, sessionid_encrypted, tnt_s_encrypted FROM trakntell_credentials LIMIT 1")
row = cursor.fetchone()
db.close()

if not row:
    print("No credentials found")
    exit(1)

user_id = decrypt_token(row[0])
user_id_encrypt = decrypt_token(row[1])
orgid = decrypt_token(row[2])
sessionid = decrypt_token(row[3]) if row[3] else None
tnt_s = decrypt_token(row[4]) if row[4] else None

print(f"Decrypted credentials:")
print(f"  user_id: {user_id}")
print(f"  user_id_encrypt: {user_id_encrypt}")
print(f"  orgid: {orgid}")
print(f"  sessionid: {sessionid[:30]}..." if sessionid else "  sessionid: None")
print(f"  tnt_s: {tnt_s[:30]}..." if tnt_s else "  tnt_s: None")
print()

# Make the API call
url = "https://mapsweb.trakmtell.com/tnt/servlet/tntServiceGetCurrentStatus"
params = {
    "f": "l",
    "u": user_id,
    "userIdEncrypt": user_id_encrypt,
    "orgid": orgid,
}

cookies = {}
if sessionid:
    cookies["JSESSIONID"] = sessionid
if tnt_s:
    cookies["tnt_s"] = tnt_s

headers = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "X-Requested-With": "XMLHttpRequest",
    "Referer": "https://mapsweb.trakmtell.com/tnt/servlet/tntWebCurrentStatus",
    "Origin": "https://mapsweb.trakmtell.com",
}

print(f"Making API call to: {url}")
print(f"Params: {params}")
print(f"Cookies: {list(cookies.keys())}")
print()

try:
    with httpx.Client(timeout=30, follow_redirects=True) as client:
        resp = client.get(url, params=params, cookies=cookies, headers=headers)
    
    print(f"Status: {resp.status_code}")
    print(f"Headers: {dict(resp.headers)}")
    print(f"URL: {resp.url}")
    print()
    
    # Save raw response
    raw_text = resp.text
    print(f"Raw response length: {len(raw_text)} characters")
    print()
    print("=" * 80)
    print("RAW RESPONSE (first 5000 chars):")
    print("=" * 80)
    print(raw_text[:5000])
    
    if len(raw_text) > 5000:
        print(f"\n... [truncated, total {len(raw_text)} chars] ...")
    
    # Try to parse as JSON
    print()
    print("=" * 80)
    print("PARSED JSON RESPONSE:")
    print("=" * 80)
    
    first_brace = raw_text.find('{')
    last_brace = raw_text.rfind('}')
    if first_brace >= 0 and last_brace > first_brace:
        json_str = raw_text[first_brace:last_brace+1]
        data = json.loads(json_str)
        
        # Pretty print with indent
        print(json.dumps(data, indent=2, ensure_ascii=False)[:10000])
        
        if len(json.dumps(data, indent=2)) > 10000:
            print(f"\n... [truncated] ...")
        
        # Extract ALL field names from all vehicle objects
        print()
        print("=" * 80)
        print("ALL UNIQUE FIELD NAMES FOUND IN RESPONSE:")
        print("=" * 80)
        
        all_fields = set()
        vehicles = data.get("response", [])
        if isinstance(vehicles, list):
            for v in vehicles:
                if isinstance(v, dict):
                    all_fields.update(v.keys())
        
        print(f"\nTotal unique fields: {len(all_fields)}")
        print("\nSorted field names:")
        for field in sorted(all_fields):
            # Show sample value from first vehicle
            sample = None
            for v in vehicles:
                if isinstance(v, dict) and field in v:
                    sample = v[field]
                    break
            sample_str = str(sample)[:100] if sample is not None else "N/A"
            print(f"  {field}: {sample_str}")
        
        # Save full response to file
        output_file = "/Users/rudra/Downloads/github-backend-main/trakntell_raw_response.json"
        with open(output_file, 'w') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"\nFull response saved to: {output_file}")
    else:
        print("Could not find JSON in response")
        
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
