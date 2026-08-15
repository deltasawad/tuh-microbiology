import sys
sys.stdout.reconfigure(encoding='utf-8')

import urllib.request
import json

SUPABASE_URL = "https://tgctyouhzsyizlosrmqh.supabase.co"
ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnY3R5b3VoenN5aXpsb3NybXFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2NjYyNzAsImV4cCI6MjEwMjI0MjI3MH0.mlba06N1LhjT9vwNBhVrhMlxvjvO7QsRjArI6ue7Pv0"

# Test signing in
auth_url = f"{SUPABASE_URL}/auth/v1/token?grant_type=password"
auth_payload = {
    "email": "admin@tuh.lab",
    "password": "password123"
}

headers = {
    "apikey": ANON_KEY,
    "Content-Type": "application/json"
}

req = urllib.request.Request(auth_url, data=json.dumps(auth_payload).encode('utf-8'), headers=headers, method='POST')
try:
    with urllib.request.urlopen(req) as resp:
        auth_data = json.loads(resp.read().decode('utf-8'))
        print("✅ Successfully logged in! Access token obtained.")
        access_token = auth_data["access_token"]
        print("Token prefix:", access_token[:30])
except Exception as e:
    print("Sign in test:", e)
    if hasattr(e, 'read'):
        print(e.read().decode('utf-8'))
