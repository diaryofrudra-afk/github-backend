#!/usr/bin/env python3
"""
Extract JSESSIONID cookie from Trak N Tell session.
Run this while logged into Trak N Tell in Chrome.

Usage:
  python3 extract_trakntell_sessionid.py
"""

import json
import sqlite3
import os
import glob
from pathlib import Path

def find_chrome_cookie_db():
    """Find Chrome's Cookies database on macOS."""
    paths = [
        os.path.expanduser("~/Library/Application Support/Google/Chrome/Default/Cookies"),
        os.path.expanduser("~/Library/Application Support/Google/Chrome/Profile */Cookies"),
    ]
    
    for pattern in paths:
        matches = glob.glob(pattern)
        if matches:
            return matches[0]
    return None

def extract_sessionid():
    """Extract JSESSIONID for Trak N Tell domains."""
    cookie_db = find_chrome_cookie_db()
    
    if not cookie_db:
        print("❌ Chrome Cookies database not found.")
        print("Make sure Chrome is closed and try again.")
        return
    
    print(f"📂 Found Chrome Cookies database: {cookie_db}")
    print()
    
    # Chrome cookies database is locked while Chrome is running
    # We'll try to query it anyway
    try:
        conn = sqlite3.connect(cookie_db)
        cursor = conn.cursor()
        
        # Query for Trak N Tell cookies
        query = """
            SELECT host_key, name, value, path, expires_utc, is_secure
            FROM cookies
            WHERE host_key LIKE '%trakmtell.com%' 
               OR host_key LIKE '%trakntell.com%'
               OR host_key LIKE '%trakmtell%'
            ORDER BY host_key, name
        """
        
        cursor.execute(query)
        rows = cursor.fetchall()
        
        if not rows:
            print("⚠️  No Trak N Tell cookies found.")
            print("Make sure you're logged into Trak N Tell in Chrome.")
            conn.close()
            return
        
        print(f"✅ Found {len(rows)} Trak N Tell cookies:")
        print()
        
        sessionid_found = False
        
        for row in rows:
            host_key, name, value, path, expires_utc, is_secure = row
            
            if name == "JSESSIONID":
                sessionid_found = True
                print("🔑 JSESSIONID FOUND:")
                print("-" * 80)
                print(f"Domain: {host_key}")
                print(f"Name: {name}")
                print(f"Value: {value}")
                print(f"Path: {path}")
                print(f"Secure: {'Yes' if is_secure else 'No'}")
                print("-" * 80)
                print()
                print("📋 Copy this value to the 'JSESSIONID' field in Trak N Tell Settings")
                print()
            else:
                print(f"  • {name} = {value[:20]}... (Domain: {host_key})")
        
        if not sessionid_found:
            print()
            print("⚠️  JSESSIONID not found in cookies.")
            print("Try refreshing the Trak N Tell page and run this script again.")
        
        conn.close()
        
    except sqlite3.Error as e:
        print(f"❌ Database error: {e}")
        print("Chrome might be running. Please close Chrome and try again.")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    print("╔══════════════════════════════════════════════════════════════╗")
    print("║     Trak N Tell JSESSIONID Extractor                        ║")
    print("╚══════════════════════════════════════════════════════════════╝")
    print()
    print("Instructions:")
    print("1. Make sure you're logged into Trak N Tell in Chrome")
    print("2. Close Chrome completely (Cmd+Q)")
    print("3. Run this script")
    print()
    print("Starting extraction...")
    print()
    
    extract_sessionid()
