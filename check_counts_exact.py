import sys
sys.stdout.reconfigure(encoding='utf-8')

import urllib.request
import json

SUPABASE_URL = "https://tgctyouhzsyizlosrmqh.supabase.co"
ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnY3R5b3VoenN5aXpsb3NybXFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2NjYyNzAsImV4cCI6MjEwMjI0MjI3MH0.mlba06N1LhjT9vwNBhVrhMlxvjvO7QsRjArI6ue7Pv0"

headers = {
    "apikey": ANON_KEY,
    "Authorization": f"Bearer {ANON_KEY}",
    "Prefer": "count=exact"
}

for table in ["bookings", "reports", "report_items"]:
    req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/{table}?select=id", headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            content_range = resp.headers.get("Content-Range", "")
            data = json.loads(resp.read().decode('utf-8'))
            print(f"📊 Table '{table}': Content-Range = {content_range}, Fetched = {len(data)}")
    except Exception as e:
        print(f"Error checking {table}: {e}")
