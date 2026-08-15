import shutil
import os

source_logo = r"C:\Users\kanokwan\.gemini\antigravity\brain\d19d14a1-b199-4eca-bafc-563c2a4cc1ae\.user_uploaded\media_1786797700554.png"

os.makedirs(r"c:\Users\kanokwan\OneDrive\Desktop\web app\frontend\images", exist_ok=True)
os.makedirs(r"c:\Users\kanokwan\OneDrive\Desktop\web app\frontend\assets", exist_ok=True)

targets = [
    r"c:\Users\kanokwan\OneDrive\Desktop\web app\frontend\images\tuh-logo.png",
    r"c:\Users\kanokwan\OneDrive\Desktop\web app\frontend\images\logo.png",
    r"c:\Users\kanokwan\OneDrive\Desktop\web app\frontend\assets\logo.png",
    r"c:\Users\kanokwan\OneDrive\Desktop\web app\frontend\favicon.ico",
    r"c:\Users\kanokwan\OneDrive\Desktop\web app\frontend\favicon.png"
]

for t in targets:
    shutil.copyfile(source_logo, t)
    print(f"Copied to: {t}")
