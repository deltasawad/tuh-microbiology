import sys
sys.stdout.reconfigure(encoding='utf-8')

import urllib.request
import re
import os
import json

fid = "14E3SFLA12wVtqKzukldJCwNoyLAqOpNz"
url = f"https://drive.google.com/drive/folders/{fid}"
headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}

req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req, timeout=10) as resp:
    html = resp.read().decode('utf-8')

match = re.search(r"window\['_DRIVE_ivd'\]\s*=\s*'([^']+)'", html)
if match:
    raw_ivd = match.group(1).replace(r'\/', '/')
    decoded_ivd = raw_ivd.encode('utf-8').decode('unicode_escape')
    data = json.loads(decoded_ivd)
    items = data[0] if isinstance(data, list) and len(data) > 0 else []
    print(f"Items in Drug 1 folder: {len(items)}")
    for it in items:
        if isinstance(it, list) and len(it) > 3:
            file_id = it[0]
            file_name = it[2]
            mime_type = it[3]
            print(f"  📄 File: {file_name} | ID: {file_id} | MIME: {mime_type}")
            
            # Download
            out_path = f"downloaded_raw/DRG_07_{re.sub(r'[^a-zA-Z0-9._-]', '_', file_name)}"
            if not out_path.endswith('.xlsx') and not out_path.endswith('.csv'):
                out_path += '.xlsx'
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
                    print(f"    DL Error: {e}")
