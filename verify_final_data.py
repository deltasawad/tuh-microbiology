import sys
sys.stdout.reconfigure(encoding='utf-8')

import urllib.request
import json

SUPABASE_URL = "https://tgctyouhzsyizlosrmqh.supabase.co"
ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnY3R5b3VoenN5aXpsb3NybXFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2NjYyNzAsImV4cCI6MjEwMjI0MjI3MH0.mlba06N1LhjT9vwNBhVrhMlxvjvO7QsRjArI6ue7Pv0"

headers = {
    "apikey": ANON_KEY,
    "Authorization": f"Bearer {ANON_KEY}"
}

# 1. Search public reports (e.g. ICU, AIR, etc.)
req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/reports?select=submission_no,service_name,department,sampling_date,reported_date&limit=5", headers=headers)
with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read().decode('utf-8'))
    print("📋 Sample Public Reports from Supabase:")
    for d in data:
        print(f"  - {d['submission_no']} | {d['service_name']} | {d['department']} | {d['reported_date']}")

# 2. Check bookings
req2 = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/bookings?select=booking_date,department,service_name,sample_count&limit=5", headers=headers)
with urllib.request.urlopen(req2) as resp:
    data2 = json.loads(resp.read().decode('utf-8'))
    print("\n📅 Sample Bookings from Supabase:")
    for b in data2:
        print(f"  - {b['booking_date']} | {b['department']} | {b['service_name']} ({b['sample_count']} ชิ้น)")
