#!/usr/bin/env python3
"""Extract fresh JSESSIONID from Chrome while logged into Trak N Tell."""
import sqlite3
import os
import glob
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
import base64
import json

def get_chrome_key():
    """Get Chrome's encryption key from keychain (macOS)."""
    try:
        import subprocess
        result = subprocess.run(
            ['security', 'find-generic-password', '-w', '-s', 'Chrome', '-a', 'Safe Storage'],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0:
            return base64.b64decode(result.stdout.strip())
    except Exception as e:
        print(f"⚠️  Could not get Chrome key: {e}")
    return None

def decrypt_value(encrypted_value, key):
    """Decrypt Chrome cookie value."""
    if not encrypted_value:
        return None
    try:
        if isinstance(encrypted_value, str):
            encrypted_value = encrypted_value.encode('latin1')
        
        # Skip 'v10' or 'v11' prefix
        if encrypted_value[:3] in (b'v10', b'v11'):
            iv = encrypted_value[3:15]
            ciphertext = encrypted_value[15:-16]
            tag = encrypted_value[-16:]
            
            cipher = Cipher(algorithms.AES(key), modes.GCM(iv, tag), backend=default_backend())
            decryptor = cipher.decryptor()
            decrypted = decryptor.update(ciphertext) + decryptor.finalize()
            return decrypted.decode('utf-8')
    except Exception as e:
        pass
    return None

def extract_jsessionid():
    """Extract JSESSIONID from Chrome cookies."""
    # Find Chrome cookie file
    cookie_paths = [
        os.path.expanduser("~/Library/Application Support/Google/Chrome/Default/Cookies"),
        os.path.expanduser("~/Library/Application Support/Google/Chrome/Profile */Cookies"),
    ]
    
    cookie_file = None
    for pattern in cookie_paths:
        matches = glob.glob(pattern)
        if matches:
            cookie_file = matches[0]
            break
    
    if not cookie_file or not os.path.exists(cookie_file):
        print("❌ Chrome cookie file not found")
        print("Make sure Chrome is installed and you're logged into Trak N Tell")
        return
    
    print(f"📁 Cookie file: {cookie_file}")
    
    # Close Chrome to unlock the database
    os.system("pkill -f 'Google Chrome' 2>/dev/null || true")
    
    conn = sqlite3.connect(f"file:{cookie_file}?immutable=1", uri=True)
    cursor = conn.cursor()
    
    # Query for Trak N Tell cookies
    cursor.execute("""
        SELECT name, value, encrypted_value, host_key, path, expires_utc
        FROM cookies
        WHERE (host_key LIKE '%trakntell%' OR host_key LIKE '%trakmtell%')
        AND (name = 'JSESSIONID' OR name = 'tnt_s')
        ORDER BY host_key, name
    """)
    
    rows = cursor.fetchall()
    conn.close()
    
    if not rows:
        print("\n❌ No Trak N Tell cookies found")
        print("1. Open Chrome and go to https://web.trakntell.com")
        print("2. Log in to your account")
        print("3. Wait for the dashboard to load")
        print("4. Run this script again")
        return
    
    print(f"\n✅ Found {len(rows)} Trak N Tell cookies:\n")
    
    jsessionid = None
    tnt_s = None
    
    for row in rows:
        name, value, encrypted_value, host_key = row[0], row[1], row[2], row[3]
        
        # Try to get value from encrypted_value
        cookie_value = value
        if not cookie_value and encrypted_value:
            key = get_chrome_key()
            if key:
                cookie_value = decrypt_value(encrypted_value, key)
        
        print(f"  Domain: {host_key}")
        print(f"  Name:   {name}")
        print(f"  Value:  {str(cookie_value)[:50]}{'...' if cookie_value and len(str(cookie_value)) > 50 else ''}")
        print()
        
        if name == 'JSESSIONID':
            jsessionid = cookie_value
        elif name == 'tnt_s':
            tnt_s = cookie_value
    
    if jsessionid:
        print("=" * 60)
        print("📋 Copy these values to Trak N Tell Settings in Suprwise:")
        print(f"   JSESSIONID: {jsessionid}")
        if tnt_s:
            print(f"   tnt_s: {tnt_s}")
        print("=" * 60)
    else:
        print("⚠️  JSESSIONID not found. Make sure you're logged in.")

if __name__ == "__main__":
    print("  Trak N Tell JSESSIONID Extractor")
    print("=" * 60)
    extract_jsessionid()
