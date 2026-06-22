"""
Extract Blackbuck authentication tokens from Chrome's cookie database.
Does NOT require relaunching Chrome or closing any tabs.
Reads directly from Chrome's SQLite cookie store on macOS.

Usage:
    python quick_extract.py
"""

import os
import sys
import json
import sqlite3
import subprocess
from pathlib import Path

# ──────────────────────────────────────────────
# Chrome cookie database location on macOS
# ──────────────────────────────────────────────
COOKIE_DB = os.path.expanduser(
    "~/Library/Application Support/Google/Chrome/Default/Cookies"
)
# Also check profile-specific paths
PROFILE_DIRS = [
    "Default",
    "Profile 1",
    "Profile 2",
]

def find_cookie_dbs():
    """Find all Chrome cookie databases."""
    chrome_base = Path.home() / "Library/Application Support/Google/Chrome"
    dbs = []
    for profile in PROFILE_DIRS:
        db_path = chrome_base / profile / "Cookies"
        if db_path.exists():
            dbs.append((profile, str(db_path)))
    # Also check the newer "Network" subdirectory (Chrome 80+)
    for profile in PROFILE_DIRS:
        db_path = chrome_base / profile / "Network" / "Cookies"
        if db_path.exists():
            dbs.append((f"{profile}/Network", str(db_path)))
    return dbs


def get_chrome_decryption_key():
    """
    On macOS, Chrome cookies are encrypted with AES-GCM using a key
    stored in the macOS Keychain under 'Chrome Safe Storage'.
    """
    try:
        result = subprocess.run(
            ["security", "find-generic-password", "-w",
             "-s", "Chrome Safe Storage",
             "-a", "Chrome"],
            capture_output=True, text=True
        )
        if result.returncode == 0:
            return result.stdout.strip().encode("utf-8")
    except Exception as e:
        print(f"[!] Keychain access failed: {e}")
    return None


def decrypt_cookie_mac(encrypted_value: bytes, key: bytes) -> str:
    """
    Decrypt a Chrome cookie value on macOS using AES-GCM.
    Chrome on macOS uses: v10 prefix + AES-GCM encrypted data
    """
    try:
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        # Chrome macOS format: b'v10' + nonce(12 bytes) + ciphertext + tag(16 bytes)
        if encrypted_value.startswith(b'v10'):
            nonce = encrypted_value[3:15]  # 12 bytes nonce
            ciphertext_and_tag = encrypted_value[15:]
            aesgcm = AESGCM(key)
            decrypted = aesgcm.decrypt(nonce, ciphertext_and_tag, None)
            return decrypted.decode('utf-8')
    except Exception as e:
        pass
    return ""


def extract_blackbuck_cookies():
    """Extract all cookies related to blackbuck.com."""
    dbs = find_cookie_dbs()
    
    if not dbs:
        print("[!] No Chrome cookie databases found.")
        sys.exit(1)
    
    print(f"[*] Found {len(dbs)} Chrome cookie database(s):")
    for name, path in dbs:
        print(f"    - {name}: {path}")
    
    blackbuck_cookies = []
    
    for profile_name, db_path in dbs:
        print(f"\n{'='*60}")
        print(f"  Scanning: {profile_name}")
        print(f"{'='*60}")
        
        try:
            # Chrome database is often locked; copy to temp location
            import tempfile
            import shutil
            
            tmp_db = tempfile.mktemp(suffix=".db")
            shutil.copy2(db_path, tmp_db)
            
            conn = sqlite3.connect(tmp_db)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # Query for blackbuck.com cookies
            cursor.execute("""
                SELECT host_key, name, value, encrypted_value, 
                       path, is_secure, is_httponly, expires_utc,
                       creation_utc, last_access_utc
                FROM cookies 
                WHERE host_key LIKE '%blackbuck%'
                ORDER BY host_key, name
            """)
            
            rows = cursor.fetchall()
            print(f"[*] Found {len(rows)} cookies for blackbuck.com")
            
            for row in rows:
                cookie = {
                    "host_key": row["host_key"],
                    "name": row["name"],
                    "path": row["path"],
                    "is_secure": bool(row["is_secure"]),
                    "is_httponly": bool(row["is_httponly"]),
                    "expires_utc": row["expires_utc"],
                    "creation_utc": row["creation_utc"],
                    "value": row["value"],
                    "encrypted_value_present": bool(row["encrypted_value"]),
                }
                
                # Try to decrypt encrypted_value
                if row["encrypted_value"] and not row["value"]:
                    cookie["decrypted_value"] = "(encrypted, needs key)"
                
                blackbuck_cookies.append(cookie)
                print(f"  {row['host_key']} | {row['name']} = {row['value'][:80] if row['value'] else '(encrypted)'}")
            
            conn.close()
            os.unlink(tmp_db)
            
        except sqlite3.OperationalError as e:
            print(f"[!] SQLite error for {db_path}: {e}")
            print("    The database may be locked. Try closing Chrome and retrying.")
        except Exception as e:
            print(f"[!] Error reading {db_path}: {e}")
            import traceback
            traceback.print_exc()
    
    return blackbuck_cookies


def save_results(cookies):
    """Save extracted cookies to JSON."""
    output = {
        "total_cookies": len(cookies),
        "cookies": cookies,
        "note": "Some cookies may be encrypted. Use decrypt_cookie_mac() with Chrome Safe Storage key to decrypt."
    }
    
    output_path = Path(__file__).parent / "blackbuck_cookies.json"
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)
    
    print(f"\n[+] Results saved to: {output_path}")


# ──────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────
if __name__ == "__main__":
    print("="*60)
    print("  Blackbuck Cookie Extractor (Read-Only)")
    print("="*60)
    print()
    print("This script reads Chrome's cookie database to extract")
    print("Blackbuck authentication cookies. It does NOT modify")
    print("or delete any data.")
    print()
    
    cookies = extract_blackbuck_cookies()
    
    if cookies:
        print(f"\n{'='*60}")
        print(f"  SUMMARY: Found {len(cookies)} blackbuck.com cookies")
        print(f"{'='*60}")
        save_results(cookies)
    else:
        print("\n[!] No blackbuck.com cookies found in Chrome.")
        print("    Make sure you're logged in at blackbuck.com/boss/gps")
        print("    and try again.")
