import sys
sys.stdout.reconfigure(encoding='utf-8')

import urllib.request
import re
import json

folder_id = "15NVClUU7OVvIf1TsyrAHvjdTeDTQ8Jms"
url = f"https://drive.google.com/drive/folders/{folder_id}"

req = urllib.request.Request(
    url,
    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
)

with urllib.request.urlopen(req) as resp:
    html = resp.read().decode('utf-8')

# Search for patterns where folder names are near IDs
# e.g., data-id="...", href="folders/...", or in JS arrays
subfolder_names = [
    "Air Sampling (สำหรับงานอาชีวอนามัย)",
    "Sterility (สำหรับงานธนาคารเลือด)",
    "Water or Surface (สำหรับงานควบคุมโรคติดเชื้อ)",
    "Water (สำหรับห้องผ่าตัด OR)",
    "Food (สำหรับงานโภชนาการ)",
    "Drug (สำหรับงานผลิตยา1) ปลอดเชื้อ",
    "Drug(สำหรับงานผลิตยา2) แบบรายงานผลการวิเคราะห์การปนเปื้อนเชื้อจุลินทรีย์",
    "ปฏิทินจองวันส่งตรวจ"
]

print("=== Searching for subfolder IDs ===")
for name in subfolder_names:
    # Find positions of name
    pos = 0
    found_ids = []
    while True:
        pos = html.find(name, pos)
        if pos == -1:
            break
        # Look around this position (+- 300 chars)
        window = html[max(0, pos - 300):min(len(html), pos + 300)]
        ids = re.findall(r'[a-zA-Z0-9_-]{28,35}', window)
        for i in ids:
            if i != folder_id and i not in found_ids:
                found_ids.append(i)
        pos += len(name)
    print(f"Subfolder: '{name}' -> IDs: {found_ids}")
