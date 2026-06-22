import json

har_file = "/Users/rudra/Desktop/wheelseye.com_Archive [26-06-16 20-13-35].har"

with open(har_file, 'r') as f:
    data = json.load(f)

for entry in data['log']['entries']:
    request = entry['request']
    url = request['url']
    method = request['method']
    
    if method == "POST" and "wheelseye.com" in url:
        post_data = request.get('postData', {})
        text = post_data.get('text', '')
        
        print(f"\n--- {method} {url} ---")
        print(f"Headers: { {h['name']: h['value'] for h in request['headers'] if h['name'].lower() in ('content-type', 'source', 'x-app-version')} }")
        print(f"Payload: {text}")
        print(f"Response Status: {entry['response']['status']}")
        res_text = entry['response']['content'].get('text', '')
        print(f"Response Body (sample): {res_text[:200]}")
