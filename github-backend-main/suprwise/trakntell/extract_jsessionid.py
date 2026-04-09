#!/usr/bin/env python3
"""
Extract JSESSIONID from Chrome for Trak N Tell.
Run this while logged into Trak N Tell in Chrome.
"""

import sqlite3
import os
import glob

def find_chrome_cookie_db():
    """Find Chrome's Cookies database."""
    paths = [
        os.path.expanduser("~/Library/Application Support/Google/Chrome/Default/Cookies"),
    ]
    
    for path in paths:
        if os.path.exists(path):
            return path
    
    # Try profile directories
    profile_paths = glob.glob(os.path.expanduser("~/Library/Application Support/Google/Chrome/Profile */Cookies"))
    if profile_paths:
        return profile_paths[0]
    
    return None

def extract_jsessionid():
    """Extract JSESSIONID from Chrome cookies."""
    cookie_db = find_chrome_cookie_db()
    
    if not cookie_db:
        print("❌ Chrome Cookies database not found.")
        print("Make sure Chrome is installed and closed.")
        return
    
    print(f"📂 Found Chrome Cookies: {cookie_db}")
    print()
    
    try:
        # Copy database to avoid locking issues
        import shutil
        temp_db = '/tmp/chrome_cookies.db'
        shutil.copy2(cookie_db, temp_db)
        
        conn = sqlite3.connect(temp_db)
        cursor = conn.cursor()
        
        # Query for Trak N Tell cookies
        query = """
            SELECT host_key, name, value, path
            FROM cookies
            WHERE (host_key LIKE '%trakmtell.com%' OR host_key LIKE '%trakmtell%')
              AND name = 'JSESSIONID'
        """
        
        cursor.execute(query)
        rows = cursor.fetchall()
        
        if rows:
            print("✅ JSESSIONID FOUND:")
            print("=" * 70)
            for row in rows:
                host_key, name, value, path = row
                print(f"Domain: {host_key}")
                print(f"Name: {name}")
                print(f"Value: {value}")
                print(f"Path: {path}")
                print()
                print("📋 Copy this value and paste it in Trak N Tell Settings:")
                print(f"   {value}")
                print("=" * 70)
        else:
            print("⚠️  JSESSIONID not found.")
            print()
            print("📝 To get JSESSIONID:")
            print("1. Open Chrome and go to Trak N Tell")
            print("2. Log in with your credentials")
            print("3. Open DevTools (F12) → Application tab")
            print("4. Go to Cookies → https://mapsweb.TrakMTell.com")
            print("5. Find JSESSIONID and copy the value")
            print("6. Paste it in Suprwise Trak N Tell Settings")
        
        conn.close()
        os.remove(temp_db)
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("=" * 70)
    print("  Trak N Tell JSESSIONID Extractor")
    print("=" * 70)
    print()
    print("⚠️  Make sure:")
    print("  1. You're logged into Trak N Tell in Chrome")
    print("  2. Chrome is CLOSED (Cmd+Q)")
    print()
    print("Starting extraction...")
    print()
    
    extract_jsessionid()
