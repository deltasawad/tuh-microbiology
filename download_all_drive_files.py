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

all_files = []

for code, (folder_name, fid) in subfolders.items():
    print(f"\n=======================================================")
    print(f"📂 Scanning {code}: {folder_name} (ID: {fid})")
    print(f"=======================================================")
    
    url = f"https://drive.google.com/drive/folders/{fid}"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            html = resp.read().decode('utf-8')
            
        # Match _DRIVE_ivd
        match = re.search(r"window\['_DRIVE_ivd'\]\s*=\s*'([^']+)'", html)
        if not match:
            print("  ⚠️ No _DRIVE_ivd found")
            continue
            
        raw_ivd = match.group(1)
        # Decode \x hex escapes
        decoded_ivd = raw_ivd.encode('utf-8').decode('unicode_escape')
        
        # Parse as JSON
        data = json.loads(decoded_ivd)
        items = data[0] if isinstance(data, list) and len(data) > 0 else []
        
        print(f"  Found {len(items)} items in folder")
        
        for it in items:
            if not isinstance(it, list) or len(it) < 4:
                continue
            file_id = it[0]
            file_name = it[2]
            mime_type = it[3]
            file_size = it[13] if len(it) > 13 else 0
            
            print(f"  📄 File: {file_name} | MIME: {mime_type} | ID: {file_id} | Size: {file_size}")
            
            all_files.append({
                "service_code": code,
                "folder_name": folder_name,
                "file_id": file_id,
                "file_name": file_name,
                "mime_type": mime_type,
                "file_size": file_size
            })
            
            # Download file
            # If Google Sheet or Excel:
            safe_name = f"{code}_{re.sub(r'[^a-zA-Z0-9._-]', '_', file_name)}"
            if not safe_name.endswith('.xlsx') and not safe_name.endswith('.csv') and not safe_name.endswith('.txt'):
                safe_name += '.xlsx'
                
            out_path = os.path.join("downloaded_raw", safe_name)
            
            # Attempt 1: Direct download
            downloaded = False
            urls_to_try = [
                f"https://drive.google.com/uc?export=download&id={file_id}",
                f"https://docs.google.com/spreadsheets/d/{file_id}/export?format=xlsx",
                f"https://docs.google.com/spreadsheets/d/{file_id}/export?format=csv"
            ]
            
            for dl_url in urls_to_try:
                try:
                    d_req = urllib.request.Request(dl_url, headers=headers)
                    with urllib.request.urlopen(d_req) as d_resp:
                        content = d_resp.read()
                        if len(content) > 50:
                            with open(out_path, "wb") as f_out:
                                f_out.write(content)
                            print(f"    ✅ Downloaded successfully to {out_path} ({len(content)} bytes)")
                            downloaded = True
                            break
                except Exception as dl_err:
                    pass
            
            if not downloaded:
                print(f"    ❌ Could not download {file_name}")

    except Exception as e:
        print(f"Error scanning folder {folder_name}: {e}")

with open("downloaded_raw/files_metadata.json", "w", encoding="utf-8") as f:
    json.dump(all_files, f, ensure_ascii=False, indent=2)

print("\n🎉 Total files found and indexed:", len(all_files))
