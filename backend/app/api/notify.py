import os
import httpx
import re
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

router = APIRouter(prefix="/notify", tags=["Notifications"])

# ข้อมูลลับอ่านจาก Environment Variables เท่านั้น ไม่มีค่าสำรองในโค้ด
# repo นี้เป็นสาธารณะ การฝังค่าไว้เท่ากับเผยแพร่ และลบออกจากประวัติ git ภายหลังได้ยาก
DEFAULT_LINE_ACCESS_TOKEN = os.getenv('LINE_CHANNEL_ACCESS_TOKEN', '')
DEFAULT_LINE_GROUP_ID = os.getenv('LINE_GROUP_ID', '')
DEFAULT_TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', '')
DEFAULT_TELEGRAM_CHAT_ID = os.getenv('TELEGRAM_CHAT_ID', '')

class BroadcastRequest(BaseModel):
    text: str
    line_token: Optional[str] = None
    line_group_id: Optional[str] = None
    telegram_token: Optional[str] = None
    telegram_chat_id: Optional[str] = None

@router.post("/broadcast")
async def broadcast_notification(req: BroadcastRequest):
    results = []
    
    # 1. Telegram
    tg_token = req.telegram_token or DEFAULT_TELEGRAM_BOT_TOKEN
    tg_chat = req.telegram_chat_id or DEFAULT_TELEGRAM_CHAT_ID
    if tg_token and tg_chat:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(
                    f"https://api.telegram.org/bot{tg_token}/sendMessage",
                    json={
                        "chat_id": tg_chat,
                        "text": req.text,
                        "parse_mode": "HTML"
                    }
                )
                results.append({"channel": "Telegram", "ok": res.is_success, "status": res.status_code})
        except Exception as e:
            results.append({"channel": "Telegram", "ok": False, "error": str(e)})

    # 2. LINE Messaging API
    line_token = req.line_token or DEFAULT_LINE_ACCESS_TOKEN
    line_group = req.line_group_id or DEFAULT_LINE_GROUP_ID
    if line_token and line_group:
        try:
            clean_text = re.sub(r'<[^>]+>', '', req.text)
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(
                    "https://api.line.me/v2/bot/message/push",
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {line_token}"
                    },
                    json={
                        "to": line_group,
                        "messages": [{"type": "text", "text": clean_text}]
                    }
                )
                line_res_body = res.text
                print(f"LINE response status: {res.status_code}, body: {line_res_body}")
                results.append({"channel": "LINE", "ok": res.is_success, "status": res.status_code, "detail": line_res_body})
        except Exception as e:
            results.append({"channel": "LINE", "ok": False, "error": str(e)})

    return {"success": True, "results": results}
