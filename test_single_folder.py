import sys
sys.stdout.reconfigure(encoding='utf-8')

import urllib.request
import re
import json

fid = "1XcCWGpuNF70oloyekCa9QvQ9a-sfL3I9"
url = f"https://drive.google.com/drive/folders/{fid}"
headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}

req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req) as resp:
    html = resp.read().decode('utf-8')

# Search for all strings matching sheet or file names in this folder
print(f"HTML size for Air Sampling folder: {len(html)}")

# Find all occurrences of document IDs in this folder
# Google Drive uses: ["ID", ["filename", "mimeType", ...]]
# Or in JSON arrays
matches = re.findall(r'\["([a-zA-Z0-9_-]{28,45})",\["([^"]+)"', html)
print(f"Direct matches: {len(matches)}")
for m in matches:
    print(m)

# Find any string containing .xlsx, .gs, sheet or thai characters
strings = re.findall(r'"([^"]*(?:\.xlsx|\.csv|Sampling|Air|งาน|สำเนา)[^"]*)"', html)
print(f"Found strings: {len(strings)}")
for s in strings:
    print(" -", s)
