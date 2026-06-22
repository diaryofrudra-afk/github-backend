import json

har_file = "/Users/rudra/Desktop/wheelseye.com_Archive [26-06-16 20-13-35].har"

with open(har_file, 'r') as f:
    data = json.load(f)

for entry in data['log']['entries']:
    url = entry['request']['url']
    if 'shield/admin/authenticate' in url:
        print(f"\n--- {url} ---")
        print(f"Status: {entry['response']['status']}")
        res_text = entry['response']['content'].get('text', '')
        print(f"Response: {res_text}")
