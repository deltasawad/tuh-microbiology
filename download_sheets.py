import sys
sys.stdout.reconfigure(encoding='utf-8')

import urllib.request
import re
import os
import json

subfolders = {
    "AIR_01": ("Air Sampling (สำหรับงานอาชีวอนามัย)", "1XcCWGpuNF70oloyekCa9QvQ9a-sfL3I9"),
    "STR_02": ("Sterility (สำหรับงานธนาคารเลือด)", "1OMNoJRfxd7lhAsN6yItqnOdatWX5Wu1h"),
    "WTS_03": ("Water or Surface (สำหรับงานควบคุมโรคติดเชื้อ)", "15yAhG0R0lrL1NXANWL1tWoT6TLFZHW3-"),
    "WTO_04": ("Water (สำหรับห้องผ่าตัด OR)", "1Q7TRMWPaQMJjXTuJKPfnxGSyfBqrQLHA"),
    "FOD_06": ("Food (สำหรับงานโภชนาการ)", "1wQm5CjALv36zVFNmSiv6c3BRJGtz57mg"),
    "DRG_07": ("Drug (สำหรับงานผลิตยา1) ปลอดเชื้อ", "14E3SFLA12wVtqKzukldJCwNoyLAqOpNz"),
    "DRG_08": ("Drug 2 ปนเปื้อนเชื้อจุลินทรีย์", "1Ak5LjI7SNbXfM3YbeEhSjraG5gti_BBq"),
    "BOOKING": ("ปฏิทินจองวันส่งตรวจ", "1XTJ8qbsfIv-4TO9lZOMrQ8MWhJltCKPu")
}

os.makedirs("downloaded_raw", exist_ok=True)

headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}

for code, (name, fid) in subfolders.items():
    print(f"\n--- Scanning {code}: {name} ({fid}) ---")
    url = f"https://drive.google.com/drive/folders/{fid}"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            html = resp.read().decode('utf-8')
            
        # Find Google Sheet / doc IDs inside this subfolder
        # Google Sheet export URL format: https://docs.google.com/spreadsheets/d/{ID}/export?format=xlsx or csv
        # IDs typically 33-44 chars
        ids = re.findall(r'[a-zA-Z0-9_-]{33,44}', html)
        unique_ids = list(set(ids))
        print(f"Found {len(unique_ids)} potential file IDs in {code}")
        
        # Test export each ID as xlsx or csv
        for file_id in unique_ids:
            if file_id == fid:
                continue
            
            # Try exporting as XLSX
            export_url = f"https://docs.google.com/spreadsheets/d/{file_id}/export?format=xlsx"
            export_req = urllib.request.Request(export_url, headers=headers)
            try:
                with urllib.request.urlopen(export_req) as exp_resp:
                    content_type = exp_resp.headers.get('Content-Type', '')
                    data = exp_resp.read()
                    if 'spreadsheetml' in content_type or len(data) > 2000 and data[:4] == b'PK\x03\x04':
                        out_path = f"downloaded_raw/{code}_{file_id}.xlsx"
                        with open(out_path, "wb") as f:
                            f.write(data)
                        print(f"  ✅ Exported Google Sheet: {out_path} ({len(data)} bytes)")
                        continue
            except Exception as e:
                pass
            
            # Try downloading direct Google Drive file
            direct_url = f"https://drive.google.com/uc?export=download&id={file_id}"
            direct_req = urllib.request.Request(direct_url, headers=headers)
            try:
                with urllib.request.urlopen(direct_req) as d_resp:
                    data = d_resp.read()
                    if len(data) > 1000 and (data[:4] == b'PK\x03\x04' or b',' in data[:100]):
                        ext = "xlsx" if data[:4] == b'PK\x03\x04' else "csv"
                        out_path = f"downloaded_raw/{code}_{file_id}.{ext}"
                        with open(out_path, "wb") as f:
                            f.write(data)
                        print(f"  ✅ Downloaded file: {out_path} ({len(data)} bytes)")
            except Exception as e:
                pass

    except Exception as e:
        print(f"Error reading subfolder {name}: {e}")
