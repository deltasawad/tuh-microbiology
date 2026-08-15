import sys
sys.stdout.reconfigure(encoding='utf-8')

import urllib.request
import json
from collections import Counter, defaultdict

SUPABASE_URL = "https://tgctyouhzsyizlosrmqh.supabase.co"
ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnY3R5b3VoenN5aXpsb3NybXFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2NjYyNzAsImV4cCI6MjEwMjI0MjI3MH0.mlba06N1LhjT9vwNBhVrhMlxvjvO7QsRjArI6ue7Pv0"

headers = {
    "apikey": ANON_KEY,
    "Authorization": f"Bearer {ANON_KEY}"
}

# Fetch all reports and items
req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/reports?select=id,submission_no,service_code,service_name,department,sampling_date,reported_date,report_items(id,sample_description,location_name)&limit=1000", headers=headers)
with urllib.request.urlopen(req) as resp:
    reports = json.loads(resp.read().decode('utf-8'))

print(f"Total reports fetched: {len(reports)}")

total_items = 0
dept_counts = Counter()
type_counts = Counter()
monthly_counts = Counter()

thai_months_short = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]

for r in reports:
    items = r.get("report_items") or []
    count = len(items)
    if count == 0: count = 1 # at least 1
    total_items += count
    
    dept = (r.get("department") or "ไม่ระบุหน่วยงาน").strip()
    dept_counts[dept] += count
    
    # Month
    sdate = r.get("sampling_date") or r.get("reported_date") or ""
    if len(sdate) >= 7:
        y, m = int(sdate[:4]), int(sdate[5:7])
        thai_y = (y + 543) % 100
        month_label = f"{thai_months_short[m]} {thai_y}"
        month_key = f"{y}-{m:02d}"
        monthly_counts[(month_key, month_label)] += count
        
    for it in items:
        stype = (it.get("sample_description") or r.get("service_name") or "สิ่งส่งตรวจ").strip()
        # simplify type
        if "อากาศ" in stype or "Air" in stype: stype = "อากาศ"
        elif "ยา" in stype or "Drug" in stype or "Volume" in stype or "USP" in stype: stype = "ยา"
        elif "เลือด" in stype or "PRC" in stype or "FFP" in stype or "Platelet" in stype: stype = "เลือด"
        elif "อาหาร" in stype or "Food" in stype: stype = "อาหาร"
        elif "น้ำ" in stype or "Water" in stype: stype = "น้ำ"
        elif "พื้นผิว" in stype or "Surface" in stype: stype = "พื้นผิว"
        type_counts[stype] += 1

print(f"Total specimens: {total_items}")
print("\nTop 5 Departments:")
for dept, c in dept_counts.most_common(7):
    print(f"  - {dept}: {c} ตัวอย่าง")

print("\nTop Specimen Types:")
for stype, c in type_counts.most_common(7):
    print(f"  - {stype}: {c} ตัวอย่าง")

print("\nMonthly Trends:")
for (mkey, mlabel), c in sorted(monthly_counts.items()):
    print(f"  - {mlabel} ({mkey}): {c} ตัวอย่าง")
