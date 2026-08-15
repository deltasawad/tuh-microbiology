import sys
sys.stdout.reconfigure(encoding='utf-8')

import urllib.request
import json

SUPABASE_URL = "https://tgctyouhzsyizlosrmqh.supabase.co"
ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnY3R5b3VoenN5aXpsb3NybXFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2NjYyNzAsImV4cCI6MjEwMjI0MjI3MH0.mlba06N1LhjT9vwNBhVrhMlxvjvO7QsRjArI6ue7Pv0"

ACCOUNTS = [
    {
        "username": "occ",
        "email": "occ@tuh.lab",
        "password": "password_occ_8416", # Supabase requires >= 6 chars for password
        "user_password_raw": "8416",
        "department": "งานอาชีวอนามัยและศูนย์บริการสุขภาพบุคลากร",
        "service_code": "AIR_01",
        "full_name": "งานอาชีวอนามัยและศูนย์บริการสุขภาพบุคลากร"
    },
    {
        "username": "icn",
        "email": "icn@tuh.lab",
        "password": "password_icn_9341",
        "user_password_raw": "9341",
        "department": "งานควบคุมโรคติดเชื้อ",
        "service_code": "WTS_03",
        "full_name": "งานควบคุมโรคติดเชื้อ (ICN)"
    },
    {
        "username": "bloodbank",
        "email": "bloodbank@tuh.lab",
        "password": "password_bloodbank_9863",
        "user_password_raw": "9863",
        "department": "งานธนาคารเลือด",
        "service_code": "STR_02",
        "full_name": "งานธนาคารเลือด (Blood Bank)"
    },
    {
        "username": "compounding",
        "email": "compounding@tuh.lab",
        "password": "password_compounding_9907",
        "user_password_raw": "9907",
        "department": "งานผลิตยา (หน่วยเตรียมยาปราศจากเชื้อ)",
        "service_code": "DRG_07",
        "full_name": "งานผลิตยา 1 (ยาปลอดเชื้อ)"
    },
    {
        "username": "nutrition",
        "email": "nutrition@tuh.lab",
        "password": "password_nutrition_8406",
        "user_password_raw": "8406",
        "department": "งานโภชนาการ",
        "service_code": "FOD_06",
        "full_name": "งานโภชนาการ"
    },
    {
        "username": "pharma",
        "email": "pharma@tuh.lab",
        "password": "password_pharma_8418",
        "user_password_raw": "8418",
        "department": "งานผลิตยา",
        "service_code": "DRG_08",
        "full_name": "งานผลิตยา 2 (การปนเปื้อนในยา)"
    },
    {
        "username": "THAMC",
        "email": "thamc@tuh.lab",
        "password": "password_thamc_020780086",
        "user_password_raw": "020780086",
        "department": "ศูนย์การแพทย์ธรรมศาสตร์ (THAMC)",
        "service_code": "WTM_05",
        "full_name": "ศูนย์การแพทย์ธรรมศาสตร์ (THAMC)"
    },
    {
        "username": "or",
        "email": "or@tuh.lab",
        "password": "password_or_9395",
        "user_password_raw": "9395",
        "department": "ห้องผ่าตัด (OR)",
        "service_code": "WTO_04",
        "full_name": "ห้องผ่าตัด (OR)"
    }
]

print("Creating/Verifying department accounts in Supabase Auth...")

for acc in ACCOUNTS:
    signup_url = f"{SUPABASE_URL}/auth/v1/signup"
    signup_data = {
        "email": acc["email"],
        "password": acc["password"],
        "data": {
            "username": acc["username"],
            "full_name": acc["full_name"],
            "department": acc["department"],
            "service_code": acc["service_code"],
            "role": "department_staff"
        }
    }
    
    req = urllib.request.Request(
        signup_url,
        data=json.dumps(signup_data).encode('utf-8'),
        headers={"apikey": ANON_KEY, "Content-Type": "application/json"},
        method='POST'
    )
    
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            print(f"✅ Created Supabase Auth user: {acc['username']} ({acc['email']})")
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode('utf-8')
        if "already registered" in err_msg or "User already exists" in err_msg:
            print(f"ℹ️ User already exists: {acc['username']} ({acc['email']})")
        else:
            print(f"⚠️ Error creating {acc['username']}: {err_msg}")
    except Exception as e:
        print(f"⚠️ Exception creating {acc['username']}: {e}")
