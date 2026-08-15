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

req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/reports?select=id,submission_no,service_code,service_name,department,ward_room,sampling_date,reported_date,overall_result,status,report_items(id,item_no,location_name,sample_description,item_result,bacteria_count,fungus_count)&limit=1000", headers=headers)
with urllib.request.urlopen(req) as resp:
    reports = json.loads(resp.read().decode('utf-8'))

def clean_department(dept):
    dept = (dept or 'ไม่ระบุหน่วยงาน').strip()
    if 'อาชีวอนามัย' in dept:
        return 'งานอาชีวอนามัยและศูนย์บริการสุขภาพบุคลากร'
    elif 'ผลิตยา' in dept or 'เตรียมยา' in dept:
        return 'งานผลิตยา (หน่วยเตรียมยาปราศจากเชื้อ)'
    elif 'ควบคุมโรค' in dept or 'IC' in dept:
        return 'งานควบคุมโรคติดเชื้อ (IC)'
    elif 'ธนาคารเลือด' in dept or 'Blood' in dept:
        return 'งานธนาคารเลือด'
    elif 'โภชนาการ' in dept or 'อาหาร' in dept:
        return 'งานโภชนาการ'
    elif 'ผ่าตัด' in dept or 'OR' in dept:
        return 'ห้องผ่าตัด (OR)'
    elif 'เจริญพันธ์' in dept or 'ผู้มีบุตรยาก' in dept or 'IUI' in dept:
        return 'หน่วยเวชศาสตร์การเจริญพันธุ์ (ผู้มีบุตรยาก)'
    return dept

def clean_specimen_type(srv_code, desc):
    desc = (desc or '').strip()
    if srv_code == 'AIR_01' or 'อากาศ' in desc or 'Air' in desc:
        return 'อากาศ (Air Sampling)'
    elif srv_code in ['DRG_07', 'DRG_08'] or 'ยา' in desc or 'Drug' in desc:
        return 'ยาและผลิตภัณฑ์ยา (Pharmaceuticals)'
    elif srv_code in ['WTO_04', 'WTM_05'] or 'น้ำ' in desc:
        return 'น้ำเพื่อการแพทย์และห้องผ่าตัด (Medical Water)'
    elif srv_code == 'STR_02' or 'เลือด' in desc or 'PRC' in desc:
        return 'ผลิตภัณฑ์เลือดและตัวบ่งชี้ชีวภาพ (Sterility/Blood)'
    elif srv_code == 'FOD_06' or 'อาหาร' in desc:
        return 'อาหารและสุขาภิบาล (Food & Nutrition)'
    elif srv_code == 'WTS_03' or 'พื้นผิว' in desc or 'Swab' in desc:
        return 'พื้นผิวสิ่งแวดล้อมและ Swab (Surfaces)'
    return 'สิ่งส่งตรวจสิ่งแวดล้อมทั่วไป'

dept_counter = Counter()
type_counter = Counter()
monthly_counter = Counter()
pass_fail_counter = Counter()
total_specimens = 0

for r in reports:
    srv = r.get('service_code')
    dept = clean_department(r.get('department'))
    items = r.get('report_items') or []
    count = len(items) if len(items) > 0 else 1
    total_specimens += count
    dept_counter[dept] += count
    
    # Month
    sdate = r.get('sampling_date') or r.get('reported_date') or ''
    if len(sdate) >= 7:
        y, m = int(sdate[:4]), int(sdate[5:7])
        thai_m = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'][m]
        thai_y = (y + 543) % 100
        monthly_counter[(f"{y}-{m:02d}", f"{thai_m} {thai_y}")] += count
        
    for it in items:
        stype = clean_specimen_type(srv, it.get('sample_description'))
        type_counter[stype] += 1
        
    overall = (r.get('overall_result') or 'pass').lower()
    pass_fail_counter[overall] += count

print("=== CLEANED STATS ===")
print(f"Total Reports: {len(reports)}, Total Specimens: {total_specimens}")
print("\nDepartments:")
for d, c in dept_counter.most_common():
    print(f"  {d}: {c} ({c*100/total_specimens:.1f}%)")

print("\nSpecimen Types:")
for t, c in type_counter.most_common():
    print(f"  {t}: {c} ({c*100/total_specimens:.1f}%)")

print("\nMonthly Trends:")
for (k, label), c in sorted(monthly_counter.items()):
    print(f"  {label}: {c} ตัวอย่าง")
