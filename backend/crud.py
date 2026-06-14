from __future__ import annotations
import random
from datetime import datetime, timezone, timedelta, date
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_

from backend.models import User, VerificationCode, Word, DailyActivity, ReviewLog, TelegramChat, TelegramLinkCode, TelegramLanguage
from backend.schemas import WordUpdate


# ── User CRUD ─────────────────────────────────────────────────

async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
    result = await db.execute(select(User).where(User.email == email.lower()))
    return result.scalar_one_or_none()


async def get_user_by_username(db: AsyncSession, username: str) -> Optional[User]:
    result = await db.execute(select(User).where(User.username == username))
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: int) -> Optional[User]:
    return await db.get(User, user_id)


async def create_user(db: AsyncSession, email: str, password_hash: str,
                      first_name: str, last_name: str, username: str,
                      age: Optional[int] = None) -> User:
    user = User(
        email=email.lower(),
        password_hash=password_hash,
        first_name=first_name,
        last_name=last_name,
        username=username,
        age=age,
        is_verified=0,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def mark_user_verified(db: AsyncSession, user: User) -> User:
    user.is_verified = 1
    await db.commit()
    await db.refresh(user)
    return user


async def update_user_password(db: AsyncSession, user: User, new_hash: str) -> None:
    user.password_hash = new_hash
    await db.commit()


async def update_user_profile(
    db: AsyncSession,
    user: User,
    first_name: str,
    last_name: str,
    username: str,
) -> User:
    user.first_name = first_name.strip()
    user.last_name = last_name.strip()
    user.username = username.strip()
    await db.commit()
    await db.refresh(user)
    return user


async def delete_user_account(db: AsyncSession, user: User) -> None:
    from sqlalchemy import delete as sql_delete
    await db.execute(sql_delete(ReviewLog).where(ReviewLog.user_id == user.id))
    await db.execute(sql_delete(Word).where(Word.user_id == user.id))
    await db.execute(sql_delete(TelegramLinkCode).where(TelegramLinkCode.user_id == user.id))
    if user.telegram_chat_id:
        from backend.models import TelegramLanguage
        await db.execute(
            sql_delete(TelegramLanguage).where(TelegramLanguage.chat_id == user.telegram_chat_id)
        )
    await db.delete(user)
    await db.commit()


async def get_users_with_telegram_token(db: AsyncSession) -> list[User]:
    result = await db.execute(select(User).where(User.telegram_bot_token.isnot(None)))
    return list(result.scalars().all())


async def set_telegram_token(db: AsyncSession, user: User, token: str) -> User:
    user.telegram_bot_token = token
    await db.commit()
    await db.refresh(user)
    return user


async def clear_telegram_token(db: AsyncSession, user: User) -> User:
    user.telegram_bot_token = None
    user.telegram_chat_id = None
    await db.commit()
    await db.refresh(user)
    return user


async def set_telegram_chat_id(db: AsyncSession, user_id: int, chat_id: str) -> None:
    user = await db.get(User, user_id)
    if user:
        user.telegram_chat_id = chat_id
        await db.commit()


# ── Verification Codes ────────────────────────────────────────

async def check_and_update_code_cooldown(db: AsyncSession, user: User,
                                         cooldown_seconds: int = 30) -> int:
    """Returns seconds remaining in cooldown (0 = OK to proceed)."""
    now = datetime.now(timezone.utc)
    if user.last_code_sent_at:
        sent = user.last_code_sent_at
        if sent.tzinfo is None:
            sent = sent.replace(tzinfo=timezone.utc)
        elapsed = (now - sent).total_seconds()
        remaining = cooldown_seconds - elapsed
        if remaining > 0:
            return int(remaining) + 1
    user.last_code_sent_at = now
    await db.commit()
    return 0


async def create_verification_code(db: AsyncSession, email: str, code: str,
                                   purpose: str, expires_at: datetime) -> VerificationCode:
    # Invalidate any existing unused codes for this email+purpose
    existing = await db.execute(
        select(VerificationCode)
        .where(VerificationCode.email == email.lower())
        .where(VerificationCode.purpose == purpose)
        .where(VerificationCode.used == 0)
    )
    for old in existing.scalars().all():
        old.used = 1

    vc = VerificationCode(
        email=email.lower(),
        code=code,
        purpose=purpose,
        expires_at=expires_at,
        used=0,
    )
    db.add(vc)
    await db.commit()
    await db.refresh(vc)
    return vc


async def verify_code(db: AsyncSession, email: str, code: str, purpose: str) -> bool:
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(VerificationCode)
        .where(VerificationCode.email == email.lower())
        .where(VerificationCode.code == code)
        .where(VerificationCode.purpose == purpose)
        .where(VerificationCode.used == 0)
        .order_by(VerificationCode.id.desc())
        .limit(1)
    )
    vc = result.scalar_one_or_none()
    if not vc:
        return False
    # Compare with timezone-aware datetime
    expires = vc.expires_at
    if expires.tzinfo is None:
        from datetime import timezone as tz
        expires = expires.replace(tzinfo=tz.utc)
    if expires < now:
        return False
    vc.used = 1
    await db.commit()
    return True


# ── Words ─────────────────────────────────────────────────────

async def get_words(db: AsyncSession, q: Optional[str] = None,
                    user_id: Optional[int] = None) -> list:
    stmt = select(Word).order_by(Word.created_at.desc())
    if user_id is not None:
        stmt = stmt.where(Word.user_id == user_id)
    if q:
        stmt = stmt.where(Word.word.ilike(f"%{q}%"))
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_word_by_text(db: AsyncSession, word: str,
                           user_id: Optional[int] = None) -> Optional[Word]:
    stmt = select(Word).where(Word.word.ilike(word.lower().strip()))
    if user_id is not None:
        stmt = stmt.where(Word.user_id == user_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def get_word(db: AsyncSession, word_id: int,
                   user_id: Optional[int] = None) -> Optional[Word]:
    stmt = select(Word).where(Word.id == word_id)
    if user_id is not None:
        stmt = stmt.where(Word.user_id == user_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def create_word(db: AsyncSession, data: dict, user_id: Optional[int] = None) -> Word:
    allowed = {c.key for c in Word.__table__.columns}
    word = Word(**{k: v for k, v in data.items() if k in allowed})
    if user_id is not None:
        word.user_id = user_id
    db.add(word)
    await db.commit()
    await db.refresh(word)
    return word


async def update_word(db: AsyncSession, word: Word, updates: WordUpdate) -> Word:
    for field, value in updates.model_dump(exclude_unset=True).items():
        setattr(word, field, value)
    await db.commit()
    await db.refresh(word)
    return word


async def delete_word(db: AsyncSession, word: Word) -> None:
    await db.delete(word)
    await db.commit()


async def update_review(db: AsyncSession, word: Word, known: bool) -> Word:
    now = datetime.now(timezone.utc)
    word.review_count += 1
    word.last_reviewed = now

    if known:
        word.known_count += 1
        word.ease_factor = min(3.0, word.ease_factor + 0.1)
        word.interval_days = min(365, max(1, round(word.interval_days * word.ease_factor)))
    else:
        word.unknown_count += 1
        word.ease_factor = max(1.3, word.ease_factor - 0.2)
        word.interval_days = 1

    word.next_review = now + timedelta(days=word.interval_days)

    db.add(ReviewLog(
        user_id=word.user_id,
        word_id=word.id,
        word_text=word.word,
        known=int(known),
        reviewed_at=now,
    ))

    await db.commit()
    await db.refresh(word)
    return word


# ── Review Log ────────────────────────────────────────────────

async def get_review_log(db: AsyncSession, limit: int = 20,
                         user_id: Optional[int] = None) -> list:
    stmt = select(ReviewLog).order_by(ReviewLog.reviewed_at.desc()).limit(limit)
    if user_id is not None:
        stmt = stmt.where(ReviewLog.user_id == user_id)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_stats(db: AsyncSession, user_id: Optional[int] = None) -> dict:
    today_str = date.today().isoformat()

    def _where(stmt):
        if user_id is not None:
            return stmt.where(Word.user_id == user_id)
        return stmt

    total = (await db.execute(_where(select(func.count(Word.id))))).scalar() or 0
    total_reviews = (await db.execute(_where(select(func.sum(Word.review_count))))).scalar() or 0
    total_known = (await db.execute(_where(select(func.sum(Word.known_count))))).scalar() or 0
    total_unknown = (await db.execute(_where(select(func.sum(Word.unknown_count))))).scalar() or 0
    added_today = (
        await db.execute(
            _where(select(func.count(Word.id)).where(func.date(Word.created_at) == today_str))
        )
    ).scalar() or 0
    reviewed_today = (
        await db.execute(
            _where(select(func.count(Word.id)).where(func.date(Word.last_reviewed) == today_str))
        )
    ).scalar() or 0

    denom = (total_known or 0) + (total_unknown or 0)
    known_rate = round((total_known or 0) / denom, 3) if denom else 0.0

    history = []
    for i in range(6, -1, -1):
        d = (date.today() - timedelta(days=i)).isoformat()
        added = (
            await db.execute(
                _where(select(func.count(Word.id)).where(func.date(Word.created_at) == d))
            )
        ).scalar() or 0
        reviewed = (
            await db.execute(
                _where(select(func.count(Word.id)).where(func.date(Word.last_reviewed) == d))
            )
        ).scalar() or 0
        history.append({"date": d, "added": added, "reviewed": reviewed})

    return {
        "total_words": total,
        "added_today": added_today,
        "reviewed_today": reviewed_today,
        "total_reviews": int(total_reviews),
        "known_rate": known_rate,
        "daily_history": history,
    }


# ── Streak ────────────────────────────────────────────────────

async def log_activity(db: AsyncSession) -> None:
    today = date.today().isoformat()
    existing = await db.get(DailyActivity, today)
    if not existing:
        db.add(DailyActivity(date=today))
        await db.commit()


async def get_streak(db: AsyncSession) -> dict:
    result = await db.execute(select(DailyActivity.date).order_by(DailyActivity.date.desc()))
    dates = {row[0] for row in result.fetchall()}

    streak = 0
    last_active = None
    check = date.today()

    while check.isoformat() in dates:
        if streak == 0:
            last_active = check.isoformat()
        streak += 1
        check = check - timedelta(days=1)

    if streak == 0:
        check = date.today() - timedelta(days=1)
        while check.isoformat() in dates:
            if streak == 0:
                last_active = check.isoformat()
            streak += 1
            check = check - timedelta(days=1)

    return {"streak": streak, "last_active": last_active}


# ── Telegram Link Codes ───────────────────────────────────────

async def create_telegram_link_code(db: AsyncSession, user_id: int) -> str:
    import string
    existing = await db.execute(
        select(TelegramLinkCode)
        .where(TelegramLinkCode.user_id == user_id)
        .where(TelegramLinkCode.used == 0)
    )
    for old in existing.scalars().all():
        old.used = 1

    code = ''.join(random.choices(string.digits, k=6))
    db.add(TelegramLinkCode(
        user_id=user_id,
        code=code,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
        used=0,
    ))
    await db.commit()
    return code


async def consume_telegram_link_code(db: AsyncSession, code: str) -> Optional[int]:
    result = await db.execute(
        select(TelegramLinkCode)
        .where(TelegramLinkCode.code == code)
        .where(TelegramLinkCode.used == 0)
        .where(TelegramLinkCode.expires_at > datetime.now(timezone.utc))
    )
    link_code = result.scalar_one_or_none()
    if not link_code:
        return None
    link_code.used = 1
    await db.commit()
    return link_code.user_id


async def link_telegram_chat(db: AsyncSession, user_id: int, chat_id: str) -> None:
    user = await db.get(User, user_id)
    if user:
        user.telegram_chat_id = chat_id
        await db.commit()


async def unlink_telegram_chat(db: AsyncSession, user: User) -> User:
    user.telegram_chat_id = None
    await db.commit()
    await db.refresh(user)
    return user


async def get_telegram_language(db: AsyncSession, chat_id: str) -> str:
    row = await db.get(TelegramLanguage, chat_id)
    return row.language if row else "en"


async def set_telegram_language(db: AsyncSession, chat_id: str, language: str) -> None:
    row = await db.get(TelegramLanguage, chat_id)
    if row:
        row.language = language
    else:
        db.add(TelegramLanguage(chat_id=chat_id, language=language))
    await db.commit()


async def get_user_by_telegram_chat_id(db: AsyncSession, chat_id: str) -> Optional[User]:
    result = await db.execute(select(User).where(User.telegram_chat_id == chat_id))
    return result.scalar_one_or_none()


async def get_due_review_words(db: AsyncSession, user_id: int, limit: int = 10) -> list:
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Word)
        .where(Word.user_id == user_id)
        .where(or_(Word.next_review <= now, Word.next_review.is_(None)))
        .order_by(Word.next_review.asc().nullsfirst())
        .limit(limit)
    )
    return list(result.scalars().all())


# ── Telegram Chats ────────────────────────────────────────────

async def save_chat_id(db: AsyncSession, chat_id: str) -> None:
    existing = await db.get(TelegramChat, chat_id)
    if not existing:
        db.add(TelegramChat(chat_id=chat_id))
        await db.commit()


async def remove_chat_id(db: AsyncSession, chat_id: str) -> None:
    existing = await db.get(TelegramChat, chat_id)
    if existing:
        await db.delete(existing)
        await db.commit()


async def get_chat_ids(db: AsyncSession) -> list[str]:
    result = await db.execute(select(TelegramChat.chat_id))
    return [row[0] for row in result.fetchall()]


# ── Export / Import ───────────────────────────────────────────

async def export_words(db: AsyncSession, user_id: Optional[int] = None) -> list[dict]:
    words = await get_words(db, user_id=user_id)
    cols = [c.key for c in Word.__table__.columns if c.key not in ("id", "user_id")]
    return [
        {k: getattr(w, k).isoformat() if isinstance(getattr(w, k), datetime) else getattr(w, k)
         for k in cols}
        for w in words
    ]


async def import_words(db: AsyncSession, words_data: list[dict],
                       user_id: Optional[int] = None) -> dict:
    imported = 0
    skipped = 0
    for data in words_data:
        word_str = (data.get("word") or "").strip()
        if not word_str:
            skipped += 1
            continue
        stmt = select(Word).where(Word.word.ilike(word_str))
        if user_id is not None:
            stmt = stmt.where(Word.user_id == user_id)
        existing = await db.execute(stmt)
        if existing.scalar_one_or_none():
            skipped += 1
            continue
        allowed = {c.key for c in Word.__table__.columns
                   if c.key not in ("id", "created_at", "ease_factor", "user_id")}
        clean = {k: v for k, v in data.items() if k in allowed and v is not None}
        db.add(Word(**clean, user_id=user_id))
        imported += 1
    if imported:
        await db.commit()
    return {"imported": imported, "skipped": skipped}


# ── Quiz ──────────────────────────────────────────────────────

async def get_quiz_question(db: AsyncSession, user_id: Optional[int] = None,
                            lang: str = "en") -> Optional[dict]:
    words = await get_words(db, user_id=user_id)
    words_with_meaning = [w for w in words if w.chinese_meaning]
    if len(words_with_meaning) < 2:
        return None

    correct = random.choice(words_with_meaning)
    distractors = [w for w in words_with_meaning if w.id != correct.id]

    if len(distractors) >= 3:
        question_type = random.choice(["meaning", "reverse"])
    else:
        question_type = "meaning"

    sample_size = min(3, len(distractors))
    picks = random.sample(distractors, sample_size)

    from backend.telegram_i18n import t as tr
    if question_type == "meaning":
        correct_opt = correct.chinese_meaning
        distractor_opts = [w.chinese_meaning for w in picks if w.chinese_meaning]
        while len(distractor_opts) < 3 and len(distractor_opts) < sample_size:
            distractor_opts.append("—")
        options_raw = [{"text": correct_opt, "correct": True}] + \
                      [{"text": t, "correct": False} for t in distractor_opts[:3]]
        question = tr("quiz_q_meaning", lang, word=correct.word)
    else:
        correct_opt = correct.word
        distractor_opts = [w.word for w in picks]
        options_raw = [{"text": correct_opt, "correct": True}] + \
                      [{"text": t, "correct": False} for t in distractor_opts[:3]]
        question = tr("quiz_q_reverse", lang, meaning=correct.chinese_meaning)

    random.shuffle(options_raw)

    return {
        "word_id": correct.id,
        "word": correct.word,
        "question_type": question_type,
        "question": question,
        "options": options_raw,
    }
