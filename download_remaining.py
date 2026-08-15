import sys
sys.stdout.reconfigure(encoding='utf-8')

import urllib.request
import re
import os
import json

targets = {
    "DRG_07": ("Drug (สำหรับงานผลิตยา1) ปลอดเชื้อ", "14E3SFLA12wVtqKzukldJCwNoyLAqOpNz"),
    "BOOKING": ("ปฏิทินจองวันส่งตรวจ", "1XTJ8qbsfIv-4TO9lZOMrQ8MWhJltCKPu"),
    "WTM_05": ("Water (ศูนย์การแพทย์ธรรมศาสตร์ THAMC)", "15NVClUU7OVvIf1TsyrAHvjdTeDTQ8Jms") # Root folder scan for any other sheets
}

headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}

for code, (name, fid) in targets.items():
    print(f"\nScanning {code}: {name} ({fid})")
    url = f"https://drive.google.com/drive/folders/{fid}"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode('utf-8')
            
        match = re.search(r"window\['_DRIVE_ivd'\]\s*=\s*'([^']+)'", html)
        if match:
            raw_ivd = match.group(1).replace(r'\/', '/')
            decoded_ivd = raw_ivd.encode('utf-8').decode('unicode_escape')
            data = json.loads(decoded_ivd)
            items = data[0] if isinstance(data, list) and len(data) > 0 else []
            for it in items:
                if not isinstance(it, list) or len(it) < 4:
                    continue
                file_id = it[0]
                file_name = it[2]
                mime_type = it[3]
                print(f"  📄 File: {file_name} | ID: {file_id} | MIME: {mime_type}")
                
                safe_name = f"{code}_{re.sub(r'[^a-zA-Z0-9._-]', '_', file_name)}"
                if not safe_name.endswith('.xlsx') and not safe_name.endswith('.csv') and not safe_name.endswith('.txt'):
                    safe_name += '.xlsx'
                    
                out_path = os.path.join("downloaded_raw", safe_name)
                for dl_url in [
                    f"https://docs.google.com/spreadsheets/d/{file_id}/export?format=xlsx",
                    f"https://drive.google.com/uc?export=download&id={file_id}",
                    f"https://docs.google.com/spreadsheets/d/{file_id}/export?format=csv"
                ]:
                    try:
                        d_req = urllib.request.Request(dl_url, headers=headers)
                        with urllib.request.urlopen(d_req, timeout=10) as d_resp:
                            content = d_resp.read()
                            if len(content) > 50:
                                with open(out_path, "wb") as f_out:
                                    f_out.write(content)
                                print(f"    ✅ Downloaded: {out_path} ({len(content)} bytes)")
                                break
                    except Exception as e:
                        pass
    except Exception as e:
        print(f"  Error: {e}")
