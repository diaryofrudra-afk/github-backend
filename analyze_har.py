import json

har_file = "/Users/rudra/Desktop/wheelseye.com_Archive [26-06-16 20-13-35].har"

with open(har_file, 'r') as f:
    data = json.load(f)

entries = data['log']['entries']
api_calls = []

for entry in entries:
    request = entry['request']
    response = entry['response']
    url = request['url']
    method = request['method']
    status = response['status']
    
    # Filter for what looks like API calls (JSON responses or specific paths)
    is_api = False
    if 'application/json' in [h['value'] for h in response['headers'] if h['name'].lower() == 'content-type']:
        is_api = True
    elif any(path in url for path in ['/app/', '/argus/', '/api/']):
        is_api = True
        
    if is_api:
        api_calls.append({
            'method': method,
            'url': url,
            'status': status,
            'req_headers': {h['name'].lower(): h['value'] for h in request['headers']},
            'res_content_type': next((h['value'] for h in response['headers'] if h['name'].lower() == 'content-type'), None)
        })

# Show headers for Wheelseye calls
for entry in data['log']['entries']:
    url = entry['request']['url']
    if 'wheelseye.com' in url and entry['response']['status'] == 200:
        print(f"\n--- {url} ---")
        for h in entry['request']['headers']:
            if h['name'].lower() in ('source', 'x-app-version', 'x-version', 'app-version'):
                print(f"  {h['name']}: {h['value']}")
