import sys
sys.stdout.reconfigure(encoding='utf-8')
import urllib.request

file_id = "136ndJSE3DDeJsvfKKUNRSwDTXA1ig_lV"
url = f"https://drive.google.com/uc?export=download&id={file_id}"
headers = {'User-Agent': 'Mozilla/5.0'}

req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req, timeout=10) as resp:
    data = resp.read()
    with open("downloaded_raw/DRG_07_drug1.csv", "wb") as f:
        f.write(data)
    print(f"Downloaded Drug 1 CSV: {len(data)} bytes")
