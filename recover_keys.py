import base64
import hashlib
from cryptography.fernet import Fernet, InvalidToken
import sqlite3

def get_key(secret):
    digest = hashlib.sha256(secret.encode()).digest()
    return base64.urlsafe_b64encode(digest)

# Potential keys that might have been used before
POTENTIAL_SECRETS = [
    "super-secret-key-for-local-dev-only-1234567890",
    "dev-secret-key-change-in-production-to-a-60-char-random-string",
    "change-me",
    "change-me-to-a-64-char-random-string"
]

db_paths = ["data/suprwise.db", "github-backend-main/data/suprwise.db"]

for db_path in db_paths:
    print(f"\nChecking DB: {db_path}")
    try:
        conn = sqlite3.connect(db_path)
        # Try Trak N Tell
        row = conn.execute("SELECT user_id_encrypted FROM trakntell_credentials LIMIT 1").fetchone()
        if row:
            ciphertext = row[0]
            for secret in POTENTIAL_SECRETS:
                try:
                    f = Fernet(get_key(secret))
                    decrypted = f.decrypt(ciphertext.encode()).decode()
                    print(f"✅ FOUND MATCH! The correct JWT_SECRET is: {secret}")
                    exit(0)
                except InvalidToken:
                    continue
        conn.close()
    except Exception as e:
        print(f"Error reading {db_path}: {e}")

print("❌ No matching key found in common defaults.")
