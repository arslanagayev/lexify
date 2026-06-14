"""
Dynamic per-user Telegram bot manager.

Each user with a saved telegram_bot_token gets their own bot instance running
as an asyncio task. Bots are started at app startup and can be started/stopped
dynamically when users add or remove their tokens.

Commands:
  /start        — welcome + save chat_id for reminders
  add <word>    — enrich & save word, show full details
  query <word>  — look up existing word
  review        — list words due for review today
  quiz          — one quiz question
"""
from __future__ import annotations
import asyncio
import logging
from datetime import date

from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes

logger = logging.getLogger(__name__)

_tasks: dict[int, asyncio.Task] = {}


def _fmt_word(w) -> str:
    """Format a Word ORM object into a detailed Telegram HTML message."""
    lines = []

    header = f"✅ <b>{w.word}</b>"
    if w.phonetic:
        header += f"  <i>{w.phonetic}</i>"
    if w.part_of_speech:
        header += f"  <code>{w.part_of_speech}</code>"
    lines.append(header)
    lines.append("")

    if w.chinese_meaning:
        meaning = w.chinese_meaning
        if w.chinese_pinyin:
            meaning += f"  ({w.chinese_pinyin})"
        lines.append(f"<b>意思:</b> {meaning}")

    if w.example_sentence:
        lines.append(f"\n<b>例句:</b> {w.example_sentence}")
        if w.chinese_translation:
            lines.append(f"<i>{w.chinese_translation}</i>")

    if w.synonyms:
        lines.append(f"\n<b>Synonyms:</b> {w.synonyms}")
    if w.antonyms:
        lines.append(f"\n<b>Antonyms:</b> {w.antonyms}")
    if w.collocations:
        lines.append(f"\n<b>Collocations:</b> {w.collocations}")
    if w.etymology:
        lines.append(f"\n<b>Etymology:</b> {w.etymology}")

    if w.source_name or w.source_url:
        src = w.source_name or ""
        if w.source_url:
            src = f'<a href="{w.source_url}">{src or w.source_url}</a>'
        lines.append(f"\n<b>Source:</b> {src}")

    return "\n".join(lines)


def _make_handlers(user_id: int) -> list:
    """Build handlers bound to this user_id via closure."""

    async def cmd_start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
        chat_id = str(update.effective_chat.id)
        from backend.database import AsyncSessionLocal
        from backend import crud
        async with AsyncSessionLocal() as db:
            await crud.set_telegram_chat_id(db, user_id, chat_id)
        name = update.effective_user.first_name or "there"
        await update.message.reply_text(
            f"👋 Merhaba <b>{name}</b>! Kişisel <b>Lexify</b> botun hazır.\n\n"
            "<b>Komutlar:</b>\n"
            "<code>add &lt;kelime&gt;</code>  — kelime ekle\n"
            "<code>query &lt;kelime&gt;</code>  — kelimeyi ara\n"
            "<code>review</code>  — tekrar bekleyenler\n"
            "<code>quiz</code>  — hızlı quiz",
            parse_mode="HTML",
        )

    async def _do_add(update: Update, word: str):
        if not word:
            await update.message.reply_text(
                "Kullanım: <code>add &lt;kelime&gt;</code>", parse_mode="HTML"
            )
            return
        try:
            from backend.agents.word_agent import enrich_word
            from backend.database import AsyncSessionLocal
            from backend import crud
            data = await enrich_word(word)
            async with AsyncSessionLocal() as db:
                w = await crud.create_word(db, data, user_id=user_id)
                await crud.log_activity(db)
            await update.message.reply_text(
                _fmt_word(w),
                parse_mode="HTML",
                disable_web_page_preview=True,
            )
        except Exception as e:
            logger.error("add error user=%d word=%s: %s", user_id, word, e)
            await update.message.reply_text(f"Hata: {e}")

    async def cmd_add(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
        word = " ".join(ctx.args).strip() if ctx.args else ""
        await _do_add(update, word)

    async def _do_query(update: Update, word: str):
        if not word:
            await update.message.reply_text(
                "Kullanım: <code>query &lt;kelime&gt;</code>", parse_mode="HTML"
            )
            return
        from backend.database import AsyncSessionLocal
        from backend.models import Word
        from sqlalchemy import select
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Word)
                .where(Word.user_id == user_id)
                .where(Word.word.ilike(word))
                .limit(1)
            )
            w = result.scalar_one_or_none()
        if not w:
            await update.message.reply_text(
                f'"{word}" bulunamadı. Eklemek için:\n<code>add {word}</code>',
                parse_mode="HTML",
            )
            return
        denom = w.review_count or 1
        text = _fmt_word(w)
        text += f"\n\n📊 Tekrar: {w.review_count} | Doğru: {w.known_count}/{denom}"
        await update.message.reply_text(text, parse_mode="HTML", disable_web_page_preview=True)

    async def cmd_query(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
        word = " ".join(ctx.args).strip() if ctx.args else ""
        await _do_query(update, word)

    async def cmd_review(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
        from backend.database import AsyncSessionLocal
        from backend import crud
        async with AsyncSessionLocal() as db:
            words = await crud.get_words(db, user_id=user_id)
        today = date.today()
        due = [w for w in words if not w.next_review or w.next_review.date() <= today]
        if not due:
            await update.message.reply_text("Bugün tekrar bekleyen kelime yok! 🎉")
            return
        lines = [f"📚 <b>{len(due)} kelime tekrar bekliyor:</b>\n"]
        for w in due[:15]:
            meaning = f" — {w.chinese_meaning}" if w.chinese_meaning else ""
            lines.append(f"• <b>{w.word}</b>{meaning}")
        if len(due) > 15:
            lines.append(f"…ve {len(due) - 15} tane daha")
        lines.append("\nLexify'ı açarak tekrar et! 🚀")
        await update.message.reply_text("\n".join(lines), parse_mode="HTML")

    async def cmd_quiz(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
        from backend.database import AsyncSessionLocal
        from backend import crud
        async with AsyncSessionLocal() as db:
            q = await crud.get_quiz_question(db, user_id=user_id)
        if not q:
            await update.message.reply_text(
                "Quiz için en az 2 kelime gerekli!\n<code>add &lt;kelime&gt;</code>",
                parse_mode="HTML",
            )
            return
        letters = ["A", "B", "C", "D"]
        lines = [f"🎯 <b>{q['question']}</b>\n"]
        for letter, opt in zip(letters, q["options"]):
            lines.append(f"{letter}) {opt['text']}")
        lines.append("\n<i>Cevaplamak için Lexify'ı aç!</i>")
        await update.message.reply_text("\n".join(lines), parse_mode="HTML")

    async def handle_text(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
        text = (update.message.text or "").strip()
        lower = text.lower()
        if lower.startswith("add "):
            await _do_add(update, text[4:].strip())
        elif lower.startswith("query "):
            await _do_query(update, text[6:].strip())
        elif lower == "review":
            await cmd_review(update, ctx)
        elif lower == "quiz":
            await cmd_quiz(update, ctx)
        else:
            await update.message.reply_text(
                "Komutlar:\n"
                "<code>add &lt;kelime&gt;</code>\n"
                "<code>query &lt;kelime&gt;</code>\n"
                "<code>review</code>\n"
                "<code>quiz</code>",
                parse_mode="HTML",
            )

    return [
        CommandHandler("start", cmd_start),
        CommandHandler("add", cmd_add),
        CommandHandler("query", cmd_query),
        CommandHandler("review", cmd_review),
        CommandHandler("quiz", cmd_quiz),
        MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text),
    ]


async def _run_bot(user_id: int, token: str) -> None:
    app = Application.builder().token(token).build()
    for handler in _make_handlers(user_id):
        app.add_handler(handler)
    try:
        await app.initialize()
        await app.start()
        await app.updater.start_polling(drop_pending_updates=True)
        logger.info("[telegram_manager] bot started for user_id=%d", user_id)
        while True:
            await asyncio.sleep(3600)
    except asyncio.CancelledError:
        pass
    except Exception as e:
        logger.error("[telegram_manager] bot error user_id=%d: %s", user_id, e)
    finally:
        try:
            await app.updater.stop()
            await app.stop()
            await app.shutdown()
        except Exception:
            pass
        logger.info("[telegram_manager] bot stopped for user_id=%d", user_id)


def start_bot(user_id: int, token: str) -> None:
    stop_bot(user_id)
    task = asyncio.create_task(_run_bot(user_id, token))
    _tasks[user_id] = task


def stop_bot(user_id: int) -> None:
    task = _tasks.pop(user_id, None)
    if task and not task.done():
        task.cancel()


async def start_all_bots() -> None:
    from backend.database import AsyncSessionLocal
    from backend import crud
    async with AsyncSessionLocal() as db:
        users = await crud.get_users_with_telegram_token(db)
    for user in users:
        if user.telegram_bot_token:
            start_bot(user.id, user.telegram_bot_token)
    logger.info("[telegram_manager] started %d bot(s) at startup", len(users))
