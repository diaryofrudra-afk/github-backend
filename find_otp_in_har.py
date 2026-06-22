import json

har_file = "/Users/rudra/Desktop/wheelseye.com_Archive [26-06-16 20-13-35].har"

with open(har_file, 'r') as f:
    data = json.load(f)

for entry in data['log']['entries']:
    url = entry['request']['url']
    if 'send-otp' in url or 'verifyOtp' in url:
        print(f"\n--- {entry['request']['method']} {url} ---")
        print(f"Status: {entry['response']['status']}")
        
        # Request Headers
        print("Request Headers:")
        for h in entry['request']['headers']:
            if h['name'].lower() in ('content-type', 'source', 'x-app-version', 'token'):
                print(f"  {h['name']}: {h['value']}")
        
        # Request Payload
        post_data = entry['request'].get('postData')
        if post_data and 'text' in post_data:
            print("Request Payload:")
            print(post_data['text'])
            
        # Response Body
        content = entry['response']['content']
        if 'text' in content:
            print("Response Body:")
            print(content['text'][:500])
