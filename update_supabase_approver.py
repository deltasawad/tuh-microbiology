import sys
sys.stdout.reconfigure(encoding='utf-8')

import urllib.request
import json

SUPABASE_URL = "https://tgctyouhzsyizlosrmqh.supabase.co"
ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnY3R5b3VoenN5aXpsb3NybXFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2NjYyNzAsImV4cCI6MjEwMjI0MjI3MH0.mlba06N1LhjT9vwNBhVrhMlxvjvO7QsRjArI6ue7Pv0"

# Sign in to get staff access token
auth_url = f"{SUPABASE_URL}/auth/v1/token?grant_type=password"
auth_req = urllib.request.Request(
    auth_url,
    data=json.dumps({"email": "admin@tuh.lab", "password": "password123"}).encode('utf-8'),
    headers={"apikey": ANON_KEY, "Content-Type": "application/json"},
    method='POST'
)

with urllib.request.urlopen(auth_req) as resp:
    auth_data = json.loads(resp.read().decode('utf-8'))
    access_token = auth_data["access_token"]
    print("✅ Authenticated as staff user")

headers = {
    "apikey": ANON_KEY,
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

# Update all reports to have approver_name = 'ทนพญ.นริศรา มังกรแก้ว'
patch_url = f"{SUPABASE_URL}/rest/v1/reports?id=neq.00000000-0000-0000-0000-000000000000"
patch_payload = {
    "approver_name": "ทนพญ.นริศรา มังกรแก้ว"
}

req = urllib.request.Request(
    patch_url,
    data=json.dumps(patch_payload).encode('utf-8'),
    headers=headers,
    method='PATCH'
)

try:
    with urllib.request.urlopen(req) as resp:
        updated_data = json.loads(resp.read().decode('utf-8'))
        print(f"✅ Successfully updated {len(updated_data)} reports in Supabase with Approver: 'ทนพญ.นริศรา มังกรแก้ว'")
except Exception as e:
    print(f"Error updating reports: {e}")
    if hasattr(e, 'read'):
        print(e.read().decode('utf-8'))
