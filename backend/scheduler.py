"""
Daily reminder scheduler — runs inside the FastAPI process via APScheduler.
Sends each user a Telegram reminder via their own bot when they haven't reviewed today.
"""
from __future__ import annotations
import os
from datetime import date

import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

scheduler = AsyncIOScheduler(timezone="UTC")


async def _send_telegram(chat_id: str, text: str, token: str | None = None) -> None:
    tok = token or os.getenv("TELEGRAM_BOT_TOKEN", "")
    if not tok:
        return
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                f"https://api.telegram.org/bot{tok}/sendMessage",
                json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"},
            )
    except Exception:
        pass


async def send_daily_reminder() -> None:
    """Send a daily reminder to every user who has a bot configured and words due."""
    from backend.database import AsyncSessionLocal
    from backend import crud

    async with AsyncSessionLocal() as db:
        users = await crud.get_users_with_telegram_token(db)

    today = date.today()

    for user in users:
        if not user.telegram_bot_token or not user.telegram_chat_id:
            continue

        async with AsyncSessionLocal() as db:
            words = await crud.get_words(db, user_id=user.id)

        due = sum(
            1 for w in words
            if not w.next_review or w.next_review.date() <= today
        )
        if due == 0:
            continue

        # Check if already reviewed today
        reviewed_today = sum(
            1 for w in words
            if w.last_reviewed and w.last_reviewed.date() == today
        )
        if reviewed_today > 0:
            continue

        msg = (
            f"📚 <b>Lexify Hatırlatıcı</b>\n\n"
            f"Bugün henüz çalışmadın! "
            f"<b>{due}</b> kelime tekrar bekliyor.\n\n"
            f"Hadi Lexify'ı açalım! 🚀"
        )
        await _send_telegram(user.telegram_chat_id, msg, token=user.telegram_bot_token)


def setup_scheduler(hour: int = 9, minute: int = 0) -> AsyncIOScheduler:
    scheduler.add_job(
        send_daily_reminder,
        CronTrigger(hour=hour, minute=minute, timezone="UTC"),
        id="daily_reminder",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    return scheduler
