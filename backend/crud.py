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

_SORT_ORDERS = {
    "newest": lambda: Word.created_at.desc(),
    "oldest": lambda: Word.created_at.asc(),
    "az": lambda: Word.word.asc(),
    "za": lambda: Word.word.desc(),
    "hardest": lambda: Word.difficulty_score.desc(),
    "reviewed": lambda: Word.review_count.desc(),
}


async def get_words(db: AsyncSession, q: Optional[str] = None,
                    user_id: Optional[int] = None,
                    status: Optional[str] = None,
                    search: Optional[str] = None,
                    sort: Optional[str] = None) -> list:
    order = _SORT_ORDERS.get(sort or "newest", _SORT_ORDERS["newest"])()
    stmt = select(Word).order_by(order)
    if user_id is not None:
        stmt = stmt.where(Word.user_id == user_id)
    term = q or search
    if term:
        stmt = stmt.where(Word.word.ilike(f"%{term}%"))
    if status and status in ("new", "learning", "mastered"):
        stmt = stmt.where(Word.mastery_status == status)
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


def _mastery_from_results(results: list[int]) -> str:
    """
    Classify mastery from the most-recent review results (1=known, 0=unknown),
    where `results` is ordered newest-first and contains up to the last 5.
      - 4+ known of last 5  -> 'mastered'
      - 2+ unknown of last 5 -> 'new'
      - otherwise            -> 'learning'
    A word with no reviews stays 'new'.
    """
    if not results:
        return "new"
    window = results[:5]
    known = sum(1 for r in window if r)
    unknown = len(window) - known
    if known >= 4:
        return "mastered"
    if unknown >= 2:
        return "new"
    return "learning"


async def _recompute_mastery(db: AsyncSession, word: Word) -> None:
    rows = await db.execute(
        select(ReviewLog.known)
        .where(ReviewLog.word_id == word.id)
        .order_by(ReviewLog.reviewed_at.desc())
        .limit(5)
    )
    new_status = _mastery_from_results([int(k) for k in rows.scalars().all()])
    # Stamp mastered_at while mastered (covers transition + backfill); clear on fall-back
    if new_status == "mastered":
        if word.mastered_at is None:
            word.mastered_at = word.last_reviewed or datetime.now(timezone.utc)
    else:
        word.mastered_at = None
    word.mastery_status = new_status
    # difficulty: more reviews per correct answer => harder
    word.difficulty_score = round(word.review_count / (word.known_count + 1), 3)


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
    # Flush so the new ReviewLog is included in the last-5 window
    await db.flush()
    await _recompute_mastery(db, word)

    await db.commit()
    await db.refresh(word)
    return word


async def recompute_all_mastery(db: AsyncSession) -> int:
    """Backfill mastery_status for every word from its review history. Returns count."""
    result = await db.execute(select(Word))
    words = list(result.scalars().all())
    for word in words:
        await _recompute_mastery(db, word)
    await db.commit()
    return len(words)


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


async def _review_streak(db: AsyncSession, user_id: int) -> int:
    """Consecutive days (ending today or yesterday) with at least one review."""
    rows = await db.execute(
        select(func.date(ReviewLog.reviewed_at)).where(ReviewLog.user_id == user_id)
    )
    days = {str(r[0]) for r in rows.all() if r[0]}
    if not days:
        return 0
    streak, check = 0, date.today()
    if check.isoformat() not in days:
        check = check - timedelta(days=1)  # allow streak ending yesterday
    while check.isoformat() in days:
        streak += 1
        check = check - timedelta(days=1)
    return streak


async def get_stats_overview(db: AsyncSession, user_id: int) -> dict:
    result = await db.execute(select(Word).where(Word.user_id == user_id))
    words = list(result.scalars().all())

    total = len(words)
    mastered = [w for w in words if w.mastery_status == "mastered"]
    learning = [w for w in words if w.mastery_status == "learning"]
    new = [w for w in words if w.mastery_status == "new"]

    total_reviews = sum(w.review_count for w in words)
    total_known = sum(w.known_count for w in words)
    total_unknown = sum(w.unknown_count for w in words)
    denom = total_known + total_unknown
    accuracy = round(total_known / denom, 3) if denom else 0.0

    days_to_master = [
        (w.mastered_at - w.created_at).days
        for w in mastered
        if w.mastered_at and w.created_at
    ]
    avg_days = round(sum(days_to_master) / len(days_to_master), 1) if days_to_master else 0.0

    weekly_added, weekly_mastered = [], []
    for i in range(6, -1, -1):
        d = date.today() - timedelta(days=i)
        weekly_added.append(sum(1 for w in words if w.created_at and w.created_at.date() == d))
        weekly_mastered.append(sum(1 for w in mastered if w.mastered_at and w.mastered_at.date() == d))

    hardest = sorted(
        [w for w in words if w.review_count > 0],
        key=lambda w: w.difficulty_score, reverse=True,
    )[:5]
    hardest_words = [
        {
            "id": w.id,
            "word": w.word,
            "reviews": w.review_count,
            "accuracy": round(w.known_count / w.review_count, 3) if w.review_count else 0.0,
            "difficulty_score": w.difficulty_score,
        }
        for w in hardest
    ]

    return {
        "total_words": total,
        "mastered_count": len(mastered),
        "learning_count": len(learning),
        "new_count": len(new),
        "avg_days_to_master": avg_days,
        "total_reviews": total_reviews,
        "accuracy_rate": accuracy,
        "current_streak": await _review_streak(db, user_id),
        "weekly_added": weekly_added,
        "weekly_mastered": weekly_mastered,
        "hardest_words": hardest_words,
    }


async def get_word_stats(db: AsyncSession, user_id: int, word_id: int) -> Optional[dict]:
    word = await get_word(db, word_id, user_id=user_id)
    if not word:
        return None
    days_to_master = None
    if word.mastered_at and word.created_at:
        days_to_master = (word.mastered_at - word.created_at).days
    accuracy = round(word.known_count / word.review_count, 3) if word.review_count else 0.0
    return {
        "word": word.word,
        "days_to_master": days_to_master,
        "total_reviews": word.review_count,
        "accuracy": accuracy,
        "difficulty_score": word.difficulty_score,
        "added_at": word.created_at,
        "mastered_at": word.mastered_at,
    }


async def weekly_summary(db: AsyncSession, user_id: int) -> dict:
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    result = await db.execute(select(Word).where(Word.user_id == user_id))
    words = list(result.scalars().all())

    def _aware(dt):
        if dt and dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt

    added = sum(1 for w in words if _aware(w.created_at) and _aware(w.created_at) >= week_ago)
    mastered = sum(1 for w in words if _aware(w.mastered_at) and _aware(w.mastered_at) >= week_ago)
    reviewed = [w for w in words if w.review_count > 0]
    hardest = max(reviewed, key=lambda w: w.difficulty_score, default=None)
    return {
        "added": added,
        "mastered": mastered,
        "streak": await _review_streak(db, user_id),
        "total_words": len(words),
        "hardest_word": hardest.word if hardest else None,
    }


async def get_all_verified_users(db: AsyncSession) -> list[User]:
    result = await db.execute(select(User).where(User.is_verified == 1))
    return list(result.scalars().all())


async def set_weekly_email(db: AsyncSession, user: User, enabled: bool) -> User:
    user.weekly_email = 1 if enabled else 0
    await db.commit()
    await db.refresh(user)
    return user


# ── Achievements ──────────────────────────────────────────────

async def unlock_achievement(db: AsyncSession, user_id: int, achievement_id: str) -> bool:
    from backend.models import Achievement
    from backend.achievements import ACHIEVEMENT_IDS
    if achievement_id not in ACHIEVEMENT_IDS:
        return False
    existing = await db.execute(
        select(Achievement).where(
            Achievement.user_id == user_id,
            Achievement.achievement_id == achievement_id,
        )
    )
    if existing.scalar_one_or_none():
        return False
    db.add(Achievement(user_id=user_id, achievement_id=achievement_id))
    await db.commit()
    return True


async def evaluate_achievements(db: AsyncSession, user_id: int) -> list[str]:
    """Unlock any newly-earned state-based achievements. Returns newly unlocked ids."""
    result = await db.execute(select(Word).where(Word.user_id == user_id))
    words = list(result.scalars().all())
    total_words = len(words)
    mastered = sum(1 for w in words if w.mastery_status == "mastered")
    total_reviews = sum(w.review_count for w in words)
    pron_total = sum(w.pronunciation_score or 0 for w in words)
    streak = await _review_streak(db, user_id)

    earned = []
    if total_words >= 1: earned.append("first_word")
    if total_words >= 10: earned.append("ten_words")
    if total_words >= 50: earned.append("fifty_words")
    if mastered >= 1: earned.append("first_mastered")
    if streak >= 3: earned.append("streak_3")
    if streak >= 7: earned.append("streak_7")
    if streak >= 30: earned.append("streak_30")
    if total_reviews >= 100: earned.append("hundred_reviews")
    if pron_total >= 10: earned.append("pronunciation_master")

    newly = []
    for aid in earned:
        if await unlock_achievement(db, user_id, aid):
            newly.append(aid)
    return newly


async def get_achievements(db: AsyncSession, user_id: int) -> list[dict]:
    from backend.models import Achievement
    from backend.achievements import ACHIEVEMENTS
    rows = await db.execute(select(Achievement).where(Achievement.user_id == user_id))
    unlocked = {a.achievement_id: a.unlocked_at for a in rows.scalars().all()}
    return [
        {
            **a,
            "unlocked": a["id"] in unlocked,
            "unlocked_at": unlocked.get(a["id"]).isoformat() if unlocked.get(a["id"]) else None,
        }
        for a in ACHIEVEMENTS
    ]


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


async def get_daily_notification(db: AsyncSession, chat_id: str) -> bool:
    row = await db.get(TelegramLanguage, chat_id)
    return bool(row.daily_notification) if row else True


async def set_daily_notification(db: AsyncSession, chat_id: str, enabled: bool) -> None:
    row = await db.get(TelegramLanguage, chat_id)
    if row:
        row.daily_notification = 1 if enabled else 0
    else:
        db.add(TelegramLanguage(chat_id=chat_id, language="en", daily_notification=1 if enabled else 0))
    await db.commit()


async def get_linked_users(db: AsyncSession) -> list[User]:
    result = await db.execute(select(User).where(User.telegram_chat_id.isnot(None)))
    return list(result.scalars().all())


async def get_random_unmastered_word(db: AsyncSession, user_id: int) -> Optional[Word]:
    result = await db.execute(
        select(Word).where(Word.user_id == user_id).where(Word.mastery_status != "mastered")
    )
    words = list(result.scalars().all())
    if not words:
        result = await db.execute(select(Word).where(Word.user_id == user_id))
        words = list(result.scalars().all())
    return random.choice(words) if words else None


_CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"]
_CEFR_NUM = {lvl: i + 1 for i, lvl in enumerate(_CEFR_ORDER)}


async def seed_cefr_words(db: AsyncSession) -> int:
    from backend.models import CefrWord
    existing = (await db.execute(select(func.count(CefrWord.id)))).scalar() or 0
    if existing:
        return 0
    from backend.cefr_seed import CEFR_WORDS
    for word, level, meaning in CEFR_WORDS:
        db.add(CefrWord(word=word.lower().strip(), level=level, meaning=meaning))
    await db.commit()
    return len(CEFR_WORDS)


async def estimate_user_cefr_level(db: AsyncSession, user_id: int) -> str:
    from backend.models import CefrWord
    words = await get_words(db, user_id=user_id)
    if not words:
        return "A2"
    user_set = {w.word.lower().strip() for w in words}
    rows = await db.execute(select(CefrWord.word, CefrWord.level))
    level_by_word = {w.lower(): lvl for w, lvl in rows.all()}
    matched = [_CEFR_NUM[level_by_word[w]] for w in user_set if w in level_by_word]
    if not matched:
        return "B1"
    avg = sum(matched) / len(matched)
    idx = min(len(_CEFR_ORDER) - 1, max(0, round(avg) - 1))
    return _CEFR_ORDER[idx]


async def suggest_cefr_words(db: AsyncSession, user_id: int, limit: int = 10) -> dict:
    from backend.models import CefrWord
    level = await estimate_user_cefr_level(db, user_id)
    target_num = _CEFR_NUM[level]
    target_levels = {lvl for lvl, n in _CEFR_NUM.items() if abs(n - target_num) <= 1}

    words = await get_words(db, user_id=user_id)
    user_set = {w.word.lower().strip() for w in words}

    rows = await db.execute(select(CefrWord))
    candidates = [
        c for c in rows.scalars().all()
        if c.level in target_levels and c.word.lower() not in user_set
    ]
    # Prefer the user's exact level, then neighbours
    candidates.sort(key=lambda c: abs(_CEFR_NUM[c.level] - target_num))
    top = candidates[:limit * 3]
    random.shuffle(top)
    chosen = top[:limit]
    return {
        "level": level,
        "suggestions": [
            {"word": c.word, "level": c.level, "brief_meaning": c.meaning}
            for c in chosen
        ],
    }


async def get_due_review_words(
    db: AsyncSession, user_id: int, limit: int = 10, include_mastered: bool = False
) -> list:
    now = datetime.now(timezone.utc)
    stmt = (
        select(Word)
        .where(Word.user_id == user_id)
        .where(or_(Word.next_review <= now, Word.next_review.is_(None)))
    )
    if not include_mastered:
        stmt = stmt.where(Word.mastery_status != "mastered")
    stmt = stmt.order_by(Word.next_review.asc().nullsfirst()).limit(limit)
    result = await db.execute(stmt)
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


async def get_fill_blank(db: AsyncSession, user_id: int) -> Optional[dict]:
    """Pick a non-mastered word whose example sentence contains it; blank it out."""
    words = await get_words(db, user_id=user_id)
    import re as _re

    def _blank(w):
        sent = w.example_sentence or ""
        if not sent:
            return None
        pattern = _re.compile(re_escape(w.word), _re.IGNORECASE)
        if not pattern.search(sent):
            return None
        return pattern.sub("_____", sent, count=1)

    candidates = [
        (w, _blank(w)) for w in words
        if w.mastery_status != "mastered"
    ]
    candidates = [(w, b) for w, b in candidates if b]
    if not candidates:
        # fall back to any word with a usable example sentence
        candidates = [(w, _blank(w)) for w in words]
        candidates = [(w, b) for w, b in candidates if b]
    if not candidates:
        return None

    correct, blanked = random.choice(candidates)
    others = [w for w in words if w.id != correct.id]
    distractors = random.sample(others, min(3, len(others)))
    options = [correct.word] + [w.word for w in distractors]
    random.shuffle(options)
    correct_index = options.index(correct.word)

    return {
        "word_id": correct.id,
        "sentence_with_blank": blanked,
        "options": options,
        "correct_index": correct_index,
    }


def re_escape(s: str) -> str:
    import re as _re
    return _re.escape(s)
