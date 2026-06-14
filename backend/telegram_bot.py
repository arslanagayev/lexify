"""
Telegram bot polling script.

Usage:
    python -m backend.telegram_bot

Commands:
    /start  — Bildirimlere abone ol (chat_id kaydedilir)
    /stop   — Aboneliği iptal et
    /status — Kaç kelime var ve bugün review yapıldı mı?

Run this script separately from the FastAPI server.
The chat_ids it saves are picked up by the APScheduler job inside the FastAPI process.
"""
from __future__ import annotations
import os
import sqlite3
import time
from datetime import date
from pathlib import Path

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
if not TOKEN:
    raise SystemExit("TELEGRAM_BOT_TOKEN not set in .env")

API = f"https://api.telegram.org/bot{TOKEN}"
DB_PATH = Path(__file__).parent.parent / "vocabulary.db"


# ── Helpers ───────────────────────────────────────────────────

def _get(endpoint: str, params: dict | None = None) -> dict:
    r = httpx.get(f"{API}/{endpoint}", params=params, timeout=35)
    return r.json()


def _send(chat_id: int | str, text: str, **kwargs) -> None:
    httpx.post(f"{API}/sendMessage", json={"chat_id": chat_id, "text": text, **kwargs}, timeout=10)


def _save_chat_id(chat_id: str) -> bool:
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute(
            "INSERT OR IGNORE INTO telegram_chats (chat_id) VALUES (?)", (chat_id,)
        )
        conn.commit()
        affected = conn.total_changes
    finally:
        conn.close()
    return affected > 0


def _remove_chat_id(chat_id: str) -> None:
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute("DELETE FROM telegram_chats WHERE chat_id=?", (chat_id,))
        conn.commit()
    finally:
        conn.close()


def _get_status() -> dict:
    conn = sqlite3.connect(DB_PATH)
    try:
        total = conn.execute("SELECT COUNT(*) FROM words").fetchone()[0]
        today = date.today().isoformat()
        reviewed_today = conn.execute(
            "SELECT COUNT(*) FROM review_log WHERE date(reviewed_at)=?", (today,)
        ).fetchone()[0]
        due = conn.execute(
            "SELECT COUNT(*) FROM words WHERE next_review IS NULL OR date(next_review) <= ?",
            (today,),
        ).fetchone()[0]
    finally:
        conn.close()
    return {"total": total, "reviewed_today": reviewed_today, "due": due}


# ── Command handlers ──────────────────────────────────────────

def handle_start(chat_id: str, username: str) -> None:
    is_new = _save_chat_id(chat_id)
    name = f"@{username}" if username else "Merhaba"
    if is_new:
        _send(
            chat_id,
            f"✅ {name}, bildirimler aktif edildi!\n\n"
            "Her gün belirlenen saatte (varsayılan 09:00 UTC) tekrar gerektiren "
            "kelimeler varsa hatırlatma alacaksın.\n\n"
            "/status — mevcut durumu gör\n"
            "/stop   — bildirimleri durdur",
        )
    else:
        _send(chat_id, "ℹ️ Zaten abonesin. /status ile durumu görebilirsin.")


def handle_stop(chat_id: str) -> None:
    _remove_chat_id(chat_id)
    _send(chat_id, "🔕 Bildirimler durduruldu. Tekrar başlamak için /start yaz.")


def handle_status(chat_id: str) -> None:
    s = _get_status()
    today_mark = "✅" if s["reviewed_today"] > 0 else "❌"
    _send(
        chat_id,
        f"📊 <b>Lexify Durum</b>\n\n"
        f"📚 Toplam kelime: <b>{s['total']}</b>\n"
        f"🕐 Tekrar bekleyen: <b>{s['due']}</b>\n"
        f"{today_mark} Bugün review: <b>{s['reviewed_today']}</b>",
        parse_mode="HTML",
    )


def handle_unknown(chat_id: str) -> None:
    _send(chat_id, "Bilinmeyen komut.\n/start — abone ol\n/stop — iptal\n/status — durum")


# ── Polling loop ──────────────────────────────────────────────

def run() -> None:
    print(f"[Telegram Bot] Polling started. Token: ...{TOKEN[-8:]}")
    print("  /start → chat_id kaydedilir ve bildirimler aktif olur")
    print("  Ctrl-C ile durdur\n")

    offset = 0
    while True:
        try:
            result = _get("getUpdates", {"timeout": 30, "offset": offset})
            updates = result.get("result", [])
        except Exception as e:
            print(f"[poll error] {e}")
            time.sleep(5)
            continue

        for update in updates:
            offset = update["update_id"] + 1
            msg = update.get("message") or update.get("edited_message", {})
            if not msg:
                continue
            text = (msg.get("text") or "").strip()
            chat_id = str(msg.get("chat", {}).get("id", ""))
            username = msg.get("from", {}).get("username", "")

            print(f"[msg] chat={chat_id} text={text!r}")

            if text.startswith("/start"):
                handle_start(chat_id, username)
            elif text.startswith("/stop"):
                handle_stop(chat_id)
            elif text.startswith("/status"):
                handle_status(chat_id)
            else:
                handle_unknown(chat_id)

        time.sleep(1)


if __name__ == "__main__":
    run()
