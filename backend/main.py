from __future__ import annotations
from contextlib import asynccontextmanager
import os
import re
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, Query, Request, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from jose import JWTError
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from backend.database import get_db, init_db
from backend import crud, schemas
from backend.models import User
from backend.auth import (
    hash_password, verify_password, create_access_token, decode_access_token,
    generate_code, code_expiry, send_verification_email, send_reset_email,
    send_weekly_summary_email,
)
import asyncio
from backend.agents.word_agent import enrich_word, AIServiceLimitedError
from backend.ai_alerts import send_ai_alert
from backend.telegram_i18n import t as tg_t
from backend.scheduler import setup_scheduler, scheduler
from backend import telegram_manager
from backend.lexify_bot import poll_loop as lexify_bot_poll
from backend.chat import chat_completion, sanitize_history, evaluate_sentence, generate_word_family, generate_examples


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    try:
        from backend.database import AsyncSessionLocal
        async with AsyncSessionLocal() as _db:
            await crud.seed_cefr_words(_db)
    except Exception:
        pass
    hour = int(os.getenv("REMINDER_HOUR", "9"))
    minute = int(os.getenv("REMINDER_MINUTE", "0"))
    setup_scheduler(hour=hour, minute=minute)
    scheduler.start()
    await telegram_manager.start_all_bots()
    asyncio.create_task(lexify_bot_poll())
    yield
    scheduler.shutdown(wait=False)


limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="Lexify", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173",
                   "http://localhost:5174", "http://127.0.0.1:5174",
                   "https://lexifyvocab.tech", "https://www.lexifyvocab.tech"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = decode_access_token(credentials.credentials)
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = await crud.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if not user.is_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Email not verified")
    return user


# ── Auth ──────────────────────────────────────────────────────

@app.post("/auth/register", status_code=201)
@limiter.limit("3/minute")
async def register(request: Request, body: schemas.UserCreate, db: AsyncSession = Depends(get_db)):
    # Only VERIFIED accounts reserve email/username — nothing is written to
    # `users` until the code is confirmed (pending registration).
    existing_email = await crud.get_user_by_email(db, body.email)
    if existing_email:
        raise HTTPException(status_code=409, detail="Email already registered")
    existing_username = await crud.get_user_by_username(db, body.username)
    if existing_username:
        raise HTTPException(status_code=409, detail="Username already taken")

    code = generate_code()
    await crud.upsert_pending_registration(
        db,
        email=body.email,
        password_hash=hash_password(body.password),
        first_name=body.first_name,
        last_name=body.last_name,
        username=body.username,
        age=body.age,
        code=code,
        expires_at=code_expiry(),
    )
    try:
        send_verification_email(body.email, code, first_name=body.first_name)
    except Exception as e:
        print(f"[email error] {e}")

    return {"message": "Verification code sent to your email"}


@app.post("/auth/verify", response_model=schemas.TokenResponse)
@limiter.limit("5/minute")
async def verify_email(request: Request, body: schemas.VerifyRequest, db: AsyncSession = Depends(get_db)):
    from datetime import datetime, timezone
    pending = await crud.get_pending_registration(db, body.email)
    if not pending:
        raise HTTPException(status_code=404, detail="No pending registration for this email")

    expires = pending.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if pending.code != body.code or expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Invalid or expired code")

    # Guard against a race: someone else verified the same email/username first
    if await crud.get_user_by_email(db, body.email):
        await crud.delete_pending_registration(db, body.email)
        raise HTTPException(status_code=409, detail="Email already registered")
    if await crud.get_user_by_username(db, pending.username):
        raise HTTPException(status_code=409, detail="Username already taken")

    user = await crud.create_verified_user(db, pending)
    await crud.delete_pending_registration(db, body.email)
    token = create_access_token(user.id, user.email, user.username)
    return {"access_token": token, "token_type": "bearer", "user": user}


@app.post("/auth/login", response_model=schemas.TokenResponse)
@limiter.limit("5/minute")
async def login(request: Request, body: schemas.LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await crud.get_user_by_email(db, body.email)
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_verified:
        raise HTTPException(status_code=403, detail="Please verify your email first")

    token = create_access_token(user.id, user.email, user.username)
    return {"access_token": token, "token_type": "bearer", "user": user}


@app.post("/auth/resend")
async def resend_verification(body: schemas.ResendRequest, db: AsyncSession = Depends(get_db)):
    from datetime import datetime, timezone
    pending = await crud.get_pending_registration(db, body.email)
    if not pending:
        raise HTTPException(status_code=404, detail="No pending registration for this email")

    last = pending.last_sent_at
    if last and last.tzinfo is None:
        last = last.replace(tzinfo=timezone.utc)
    if last and (datetime.now(timezone.utc) - last).total_seconds() < 30:
        wait = 30 - int((datetime.now(timezone.utc) - last).total_seconds())
        raise HTTPException(status_code=429, detail=f"Please wait {wait} seconds and try again")

    code = generate_code()
    await crud.upsert_pending_registration(
        db, email=pending.email, password_hash=pending.password_hash,
        first_name=pending.first_name, last_name=pending.last_name,
        username=pending.username, age=pending.age,
        code=code, expires_at=code_expiry(),
    )
    try:
        send_verification_email(body.email, code, first_name=pending.first_name)
    except Exception as e:
        print(f"[email error] {e}")
    return {"message": "Verification code resent"}


@app.post("/auth/forgot-password")
async def forgot_password(body: schemas.ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    user = await crud.get_user_by_email(db, body.email)
    # Always return success to prevent user enumeration
    if user:
        code = generate_code()
        await crud.create_verification_code(db, body.email, code, "reset", code_expiry())
        try:
            send_reset_email(body.email, code, first_name=user.first_name)
        except Exception as e:
            print(f"[email error] {e}")
    return {"message": "If that email is registered, a reset code has been sent"}


@app.post("/auth/reset-password")
async def reset_password(body: schemas.ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    user = await crud.get_user_by_email(db, body.email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    ok = await crud.verify_code(db, body.email, body.code, "reset")
    if not ok:
        raise HTTPException(status_code=400, detail="Invalid or expired code")

    await crud.update_user_password(db, user, hash_password(body.new_password))
    if not user.is_verified:
        await crud.mark_user_verified(db, user)
    return {"message": "Password updated successfully"}


@app.get("/auth/me", response_model=schemas.UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    return current_user


@app.put("/auth/profile", response_model=schemas.UserResponse)
async def update_profile(
    body: schemas.ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    first_name = body.first_name.strip()
    last_name  = body.last_name.strip()
    username   = body.username.strip()
    if not first_name or not last_name or not username:
        raise HTTPException(status_code=422, detail="Fields cannot be empty")
    if username != current_user.username:
        existing = await crud.get_user_by_username(db, username)
        if existing and existing.id != current_user.id:
            raise HTTPException(status_code=409, detail="Username already taken")
    return await crud.update_user_profile(db, current_user, first_name, last_name, username)


@app.put("/auth/change-password", status_code=204)
async def change_password(
    body: schemas.ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(body.current_password, current_user.password_hash):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    if len(body.new_password) < 6:
        raise HTTPException(status_code=422, detail="New password must be at least 6 characters")
    await crud.update_user_password(db, current_user, hash_password(body.new_password))


@app.put("/auth/weekly-email")
async def set_weekly_email(
    body: schemas.WeeklyEmailRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await crud.set_weekly_email(db, current_user, body.enabled)
    return {"weekly_email": body.enabled}


@app.delete("/auth/account", status_code=204)
async def delete_account(
    body: schemas.DeleteAccountRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(body.password, current_user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect password")
    await crud.delete_user_account(db, current_user)


# ── AI Chat ───────────────────────────────────────────────────

@app.post("/api/chat")
@limiter.limit("20/minute")
async def chat(
    request: Request,
    body: schemas.ChatRequest,
    current_user: User = Depends(get_current_user),
):
    history = sanitize_history(body.messages)
    if not history or history[-1]["role"] != "user":
        raise HTTPException(status_code=422, detail="Last message must be from the user")
    try:
        reply = await chat_completion(history, lang=body.lang)
    except Exception as e:
        asyncio.create_task(asyncio.to_thread(send_ai_alert, str(e)))
        raise HTTPException(
            status_code=503,
            detail={"error_code": "ai_service_limited", "message": str(e)},
        )
    return {"reply": reply}


# ── Achievements ──────────────────────────────────────────────

@app.get("/achievements")
async def list_achievements(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    newly = await crud.evaluate_achievements(db, current_user.id)
    achievements = await crud.get_achievements(db, current_user.id)
    return {"achievements": achievements, "newly_unlocked": newly}


@app.post("/achievements/unlock")
async def unlock_achievement_endpoint(
    body: schemas.AchievementUnlock,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from backend.achievements import EVENT_ACHIEVEMENTS
    if body.achievement_id not in EVENT_ACHIEVEMENTS:
        raise HTTPException(status_code=400, detail="Not an unlockable event achievement")
    newly = await crud.unlock_achievement(db, current_user.id, body.achievement_id)
    return {"unlocked": newly}


# ── Shareable progress card ───────────────────────────────────

def _build_progress_svg(name: str, added: int, mastered: int, streak: int, total: int) -> str:
    import html as _html
    safe = _html.escape((name or "Learner").strip()[:20])
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="600" height="315" viewBox="0 0 600 315">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0d0d18"/>
      <stop offset="100%" stop-color="#1e1b4b"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#a78bfa"/>
      <stop offset="100%" stop-color="#38bdf8"/>
    </linearGradient>
  </defs>
  <rect width="600" height="315" rx="20" fill="url(#bg)"/>
  <circle cx="540" cy="40" r="120" fill="#6d28d9" opacity="0.12"/>
  <text x="40" y="62" font-family="Arial, sans-serif" font-size="26" font-weight="800" fill="url(#accent)">Lexify</text>
  <text x="40" y="86" font-family="Arial, sans-serif" font-size="13" fill="#94a3b8">AI Vocabulary Learning</text>
  <text x="40" y="150" font-family="Arial, sans-serif" font-size="40" font-weight="800" fill="#ffffff">{added} words</text>
  <text x="40" y="180" font-family="Arial, sans-serif" font-size="18" fill="#cbd5e1">learned this week, {safe}! 🔥</text>
  <g font-family="Arial, sans-serif">
    <text x="40"  y="250" font-size="30" font-weight="700" fill="#34d399">{mastered}</text>
    <text x="40"  y="272" font-size="12" fill="#94a3b8">Mastered</text>
    <text x="200" y="250" font-size="30" font-weight="700" fill="#fbbf24">{streak}🔥</text>
    <text x="200" y="272" font-size="12" fill="#94a3b8">Day streak</text>
    <text x="380" y="250" font-size="30" font-weight="700" fill="#38bdf8">{total}</text>
    <text x="380" y="272" font-size="12" fill="#94a3b8">Total words</text>
  </g>
  <text x="560" y="295" text-anchor="end" font-family="Arial, sans-serif" font-size="12" fill="#64748b">lexifyvocab.tech</text>
</svg>"""


@app.get("/share/progress-card")
async def share_progress_card(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ov = await crud.get_stats_overview(db, current_user.id)
    added_week = sum(ov.get("weekly_added", []))
    svg = _build_progress_svg(
        name=current_user.first_name,
        added=added_week,
        mastered=ov.get("mastered_count", 0),
        streak=ov.get("current_streak", 0),
        total=ov.get("total_words", 0),
    )
    return {"svg": svg}


# ── Review calendar ───────────────────────────────────────────

@app.get("/review/calendar")
async def review_calendar(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await crud.review_calendar(db, current_user.id)


# ── Stats ─────────────────────────────────────────────────────

@app.get("/stats/overview")
async def stats_overview(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await crud.get_stats_overview(db, current_user.id)


@app.get("/stats/insights")
async def stats_insights(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await crud.learning_insights(db, current_user.id)


@app.get("/stats/word/{word_id}")
async def stats_word(
    word_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    data = await crud.get_word_stats(db, current_user.id, word_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Word not found")
    return data


# ── Words ─────────────────────────────────────────────────────

@app.get("/words", response_model=list[schemas.WordResponse])
async def list_words(
    q: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await crud.get_words(db, q=q, user_id=current_user.id, status=status, search=search, sort=sort)


_WORD_RE = re.compile(r"^[\w\s\-''À-ÿ]+$", re.UNICODE)

@app.post("/words", response_model=schemas.WordResponse, status_code=201)
async def add_word(
    body: schemas.WordCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    word_str = body.word.strip()
    if not word_str:
        raise HTTPException(status_code=422, detail="Kelime boş olamaz")
    if len(word_str) > 50:
        raise HTTPException(status_code=422, detail="Kelime çok uzun (max 50 karakter)")
    if not _WORD_RE.match(word_str):
        raise HTTPException(status_code=422, detail="Kelime geçersiz karakter içeriyor")

    duplicate = await crud.get_word_by_text(db, word_str, user_id=current_user.id)
    if duplicate:
        raise HTTPException(status_code=409, detail={"message": "Bu kelime zaten listenizde", "id": duplicate.id})

    try:
        data = await enrich_word(word_str)
    except AIServiceLimitedError as e:
        asyncio.create_task(asyncio.to_thread(send_ai_alert, str(e)))
        raise HTTPException(
            status_code=503,
            detail={"error_code": "ai_service_limited", "message": str(e)},
        )
    word = await crud.create_word(db, data, user_id=current_user.id)
    await crud.log_activity(db)
    return word


@app.put("/words/{word_id}", response_model=schemas.WordResponse)
async def edit_word(
    word_id: int,
    body: schemas.WordUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    word = await crud.get_word(db, word_id, user_id=current_user.id)
    if not word:
        raise HTTPException(status_code=404, detail="Word not found")
    return await crud.update_word(db, word, body)


@app.delete("/words/{word_id}", status_code=204)
async def remove_word(
    word_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    word = await crud.get_word(db, word_id, user_id=current_user.id)
    if not word:
        raise HTTPException(status_code=404, detail="Word not found")
    await crud.delete_word(db, word)


@app.post("/words/{word_id}/review", response_model=schemas.WordResponse)
async def review_word(
    word_id: int,
    body: schemas.ReviewRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    word = await crud.get_word(db, word_id, user_id=current_user.id)
    if not word:
        raise HTTPException(status_code=404, detail="Word not found")
    updated = await crud.update_review(db, word, body.known, quality=body.quality)
    await crud.log_activity(db)
    return updated


@app.get("/words/{word_id}/examples")
async def word_examples(
    word_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    import json as _json
    word = await crud.get_word(db, word_id, user_id=current_user.id)
    if not word:
        raise HTTPException(status_code=404, detail="Word not found")
    examples = []
    if word.example_sentence:
        examples.append(word.example_sentence)
    if word.extra_examples:
        try:
            examples.extend(_json.loads(word.extra_examples))
        except Exception:
            pass
    else:
        try:
            extra = await generate_examples(word.word)
        except Exception as e:
            asyncio.create_task(asyncio.to_thread(send_ai_alert, str(e)))
            extra = []
        if extra:
            word.extra_examples = _json.dumps(extra)
            await db.commit()
            examples.extend(extra)
    # De-dup preserving order
    seen, out = set(), []
    for s in examples:
        if s and s not in seen:
            seen.add(s); out.append(s)
    return {"examples": out}


@app.get("/words/{word_id}/family")
async def word_family(
    word_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    import json as _json
    word = await crud.get_word(db, word_id, user_id=current_user.id)
    if not word:
        raise HTTPException(status_code=404, detail="Word not found")
    if word.word_family:
        try:
            return _json.loads(word.word_family)
        except Exception:
            pass
    try:
        data = await generate_word_family(word.word)
    except Exception as e:
        asyncio.create_task(asyncio.to_thread(send_ai_alert, str(e)))
        raise HTTPException(
            status_code=503,
            detail={"error_code": "ai_service_limited", "message": str(e)},
        )
    word.word_family = _json.dumps(data)
    await db.commit()
    return data


@app.post("/words/{word_id}/pronunciation-attempt")
async def pronunciation_attempt(
    word_id: int,
    body: schemas.PronunciationAttempt,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    word = await crud.get_word(db, word_id, user_id=current_user.id)
    if not word:
        raise HTTPException(status_code=404, detail="Word not found")
    if body.success:
        word.pronunciation_score = (word.pronunciation_score or 0) + 1
        await db.commit()
        await db.refresh(word)
    return {"pronunciation_score": word.pronunciation_score}


@app.post("/words/{word_id}/practice")
@limiter.limit("15/minute")
async def practice_word(
    request: Request,
    word_id: int,
    body: schemas.PracticeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    word = await crud.get_word(db, word_id, user_id=current_user.id)
    if not word:
        raise HTTPException(status_code=404, detail="Word not found")
    sentence = body.sentence.strip()
    if not sentence:
        raise HTTPException(status_code=422, detail="Sentence cannot be empty")
    if len(sentence) > 500:
        raise HTTPException(status_code=422, detail="Sentence too long")
    try:
        result = await evaluate_sentence(word.word, sentence)
    except Exception as e:
        asyncio.create_task(asyncio.to_thread(send_ai_alert, str(e)))
        raise HTTPException(
            status_code=503,
            detail={"error_code": "ai_service_limited", "message": str(e)},
        )
    return result


# ── Stats ─────────────────────────────────────────────────────

@app.get("/stats", response_model=schemas.StatsResponse)
async def get_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await crud.get_stats(db, user_id=current_user.id)


# ── Streak ────────────────────────────────────────────────────

@app.get("/streak", response_model=schemas.StreakResponse)
async def get_streak(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await crud.get_streak(db, current_user.id)


# ── Review Log ────────────────────────────────────────────────

@app.get("/review-log", response_model=list[schemas.ReviewLogEntry])
async def get_review_log(
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await crud.get_review_log(db, limit=limit, user_id=current_user.id)


# ── Export / Import ───────────────────────────────────────────

@app.get("/words/export")
async def export_words(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    data = await crud.export_words(db, user_id=current_user.id)
    return JSONResponse(content=data)


@app.post("/words/import", response_model=schemas.ImportResponse)
async def import_words(
    body: list[dict],
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await crud.import_words(db, body, user_id=current_user.id)


@app.get("/words/suggest")
async def suggest_words(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await crud.suggest_cefr_words(db, current_user.id)


@app.post("/words/import-file", response_model=schemas.FileImportResponse)
@limiter.limit("3/minute")
async def import_words_file(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from backend.word_import import parse_import_file
    content = await file.read()
    if len(content) > 1_000_000:
        raise HTTPException(status_code=413, detail="File too large (max 1 MB)")
    try:
        rows = parse_import_file(file.filename or "", content)
    except Exception:
        raise HTTPException(status_code=422, detail="Could not read file. Use CSV or Excel (.xlsx).")
    if not rows:
        raise HTTPException(status_code=422, detail="No words found. Expected a 'word' column.")

    imported, skipped, errors = 0, 0, []

    async def _one(row: dict):
        nonlocal imported, skipped
        word_str = row["word"].strip()
        if not word_str or len(word_str) > 50 or not _WORD_RE.match(word_str):
            errors.append(f"{word_str[:30]}: invalid")
            return
        existing = await crud.get_word_by_text(db, word_str, user_id=current_user.id)
        if existing:
            skipped += 1
            return
        try:
            data = await enrich_word(word_str)
        except Exception:
            errors.append(f"{word_str}: enrichment failed")
            return
        if row.get("notes"):
            data["tags"] = ((data.get("tags") or "") + "," + row["notes"]).strip(",")
        await crud.create_word(db, data, user_id=current_user.id)
        imported += 1

    # Enrich a few at a time to bound wall-clock without hammering the AI API
    sem = asyncio.Semaphore(3)
    async def _guarded(row):
        async with sem:
            await _one(row)
    await asyncio.gather(*[_guarded(r) for r in rows])

    if imported:
        await crud.log_activity(db)
    return {"imported": imported, "skipped": skipped, "errors": errors}


# ── Quiz ──────────────────────────────────────────────────────

@app.get("/quiz/question", response_model=schemas.QuizQuestion)
async def quiz_question(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = await crud.get_quiz_question(db, user_id=current_user.id)
    if q is None:
        raise HTTPException(status_code=422, detail="Need at least 2 words with meanings for quiz")
    return q


@app.get("/quiz/fill-blank")
async def quiz_fill_blank(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = await crud.get_fill_blank(db, user_id=current_user.id)
    if q is None:
        raise HTTPException(status_code=422, detail="Need words with example sentences for this quiz")
    return q


@app.post("/quiz/fill-blank/{word_id}/answer")
async def quiz_fill_blank_answer(
    word_id: int,
    body: schemas.FillBlankAnswer,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    word = await crud.get_word(db, word_id, user_id=current_user.id)
    if not word:
        raise HTTPException(status_code=404, detail="Word not found")
    is_correct = body.selected_word.strip().lower() == word.word.lower()
    await crud.update_review(db, word, is_correct)
    await crud.log_activity(db)
    return {"correct": is_correct, "correct_word": word.word}


# ── Telegram bot setup ────────────────────────────────────────

@app.post("/telegram/setup", response_model=schemas.UserResponse)
async def telegram_setup(
    body: schemas.TelegramSetupRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    token = body.token.strip()
    if not token:
        raise HTTPException(status_code=400, detail="Token cannot be empty")
    user = await crud.set_telegram_token(db, current_user, token)
    telegram_manager.start_bot(user.id, token)
    return user


@app.delete("/telegram/setup", response_model=schemas.UserResponse)
async def telegram_setup_delete(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    telegram_manager.stop_bot(current_user.id)
    user = await crud.clear_telegram_token(db, current_user)
    return user


# ── Telegram link-code flow ───────────────────────────────────

@app.post("/telegram/generate-link-code", response_model=schemas.TelegramLinkCodeResponse)
async def generate_telegram_link_code(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    code = await crud.create_telegram_link_code(db, current_user.id)
    return {"code": code, "expires_in_seconds": 300}


@app.post("/telegram/link")
async def link_telegram(body: schemas.TelegramLinkRequest, db: AsyncSession = Depends(get_db)):
    user_id = await crud.consume_telegram_link_code(db, body.code)
    if user_id is None:
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    await crud.link_telegram_chat(db, user_id, body.telegram_chat_id)
    return {"success": True, "message": "Account linked successfully"}


@app.delete("/telegram/link", response_model=schemas.UserResponse)
async def unlink_telegram(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await crud.unlink_telegram_chat(db, current_user)


@app.post("/telegram/add-word", response_model=schemas.WordResponse)
async def telegram_add_word(body: schemas.TelegramWordRequest, db: AsyncSession = Depends(get_db)):
    user = await crud.get_user_by_telegram_chat_id(db, body.telegram_chat_id)
    if not user:
        raise HTTPException(status_code=404, detail="not_linked")
    try:
        data = await enrich_word(body.word.strip())
    except AIServiceLimitedError as e:
        asyncio.create_task(asyncio.to_thread(send_ai_alert, str(e)))
        raise HTTPException(
            status_code=503,
            detail={"error_code": "ai_service_limited", "message": str(e)},
        )
    word = await crud.create_word(db, data, user_id=user.id)
    await crud.log_activity(db)
    return word


@app.get("/telegram/words", response_model=list[schemas.WordResponse])
async def telegram_words(chat_id: str = Query(...), db: AsyncSession = Depends(get_db)):
    user = await crud.get_user_by_telegram_chat_id(db, chat_id)
    if not user:
        raise HTTPException(status_code=404, detail="not_linked")
    return await crud.get_words(db, q=None, user_id=user.id)


@app.get("/telegram/review")
async def telegram_review(
    chat_id: str = Query(...),
    lang: str = Query("en"),
    include_mastered: bool = Query(False),
    db: AsyncSession = Depends(get_db),
):
    user = await crud.get_user_by_telegram_chat_id(db, chat_id)
    if not user:
        raise HTTPException(status_code=404, detail=tg_t("not_linked", lang))
    words = await crud.get_due_review_words(db, user.id, include_mastered=include_mastered)
    if not words:
        return {"empty": True, "message": tg_t("review_empty", lang), "words": []}
    return {
        "empty": False,
        "message": tg_t("review_header", lang, n=len(words)),
        "footer": tg_t("review_link", lang),
        "words": [
            {"word": w.word, "chinese_meaning": w.chinese_meaning or "—"}
            for w in words
        ],
    }


@app.get("/telegram/quiz", response_model=schemas.QuizQuestion)
async def telegram_quiz(
    chat_id: str = Query(...),
    lang: str = Query("en"),
    db: AsyncSession = Depends(get_db),
):
    user = await crud.get_user_by_telegram_chat_id(db, chat_id)
    if not user:
        raise HTTPException(status_code=404, detail=tg_t("not_linked", lang))
    q = await crud.get_quiz_question(db, user_id=user.id, lang=lang)
    if q is None:
        raise HTTPException(status_code=422, detail=tg_t("quiz_not_enough", lang))
    return q


@app.get("/telegram/language")
async def get_telegram_language(chat_id: str = Query(...), db: AsyncSession = Depends(get_db)):
    lang = await crud.get_telegram_language(db, chat_id)
    return {"chat_id": chat_id, "language": lang}


@app.post("/telegram/language")
async def set_telegram_language(body: schemas.TelegramLanguageRequest, db: AsyncSession = Depends(get_db)):
    valid = {"en", "tr", "ru", "zh"}
    if body.language not in valid:
        raise HTTPException(status_code=400, detail=f"Invalid language. Choose: en, tr, ru, zh")
    await crud.set_telegram_language(db, body.chat_id, body.language)
    return {"chat_id": body.chat_id, "language": body.language}


@app.post("/telegram/daily")
async def telegram_set_daily(
    body: schemas.TelegramDailyRequest,
    db: AsyncSession = Depends(get_db),
):
    await crud.set_daily_notification(db, body.chat_id, body.enabled)
    return {"chat_id": body.chat_id, "enabled": body.enabled}


@app.post("/email/weekly-summary")
async def email_weekly_summary(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    internal = os.getenv("INTERNAL_TOKEN", "")
    auth = request.headers.get("authorization", "")
    if not internal or auth != f"Bearer {internal}":
        raise HTTPException(status_code=401, detail="Unauthorized")

    users = await crud.get_all_verified_users(db)
    sent = 0
    for user in users:
        if not user.weekly_email:
            continue
        stats = await crud.weekly_summary(db, user.id)
        if stats["total_words"] == 0:
            continue
        try:
            await asyncio.to_thread(
                send_weekly_summary_email, user.email, user.first_name or "", stats
            )
            sent += 1
        except Exception:
            pass
    return {"sent": sent}


@app.post("/telegram/send-daily")
async def telegram_send_daily(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    # Internal-only: protected by a bearer token from the environment
    internal = os.getenv("INTERNAL_TOKEN", "")
    auth = request.headers.get("authorization", "")
    if not internal or auth != f"Bearer {internal}":
        raise HTTPException(status_code=401, detail="Unauthorized")

    import httpx
    bot_token = os.getenv("LEXIFY_ASSISTANT_BOT_TOKEN", "")
    if not bot_token:
        raise HTTPException(status_code=500, detail="Bot not configured")

    users = await crud.get_linked_users(db)
    sent = 0
    async with httpx.AsyncClient(timeout=15) as client:
        for user in users:
            chat_id = user.telegram_chat_id
            if not chat_id or not await crud.get_daily_notification(db, chat_id):
                continue
            word = await crud.get_random_unmastered_word(db, user.id)
            if not word:
                continue
            lang = await crud.get_telegram_language(db, chat_id)
            prompt = {
                "en": "Type 'review' to practice this word! 💪",
                "tr": "Bu kelimeyi çalışmak için 'review' yaz! 💪",
                "ru": "Напишите 'review', чтобы повторить это слово! 💪",
                "zh": "输入 'review' 来练习这个单词！💪",
            }.get(lang, "Type 'review' to practice this word! 💪")
            msg = (
                f"📖 <b>{word.word}</b> {word.phonetic or ''}\n\n"
                f"{word.chinese_meaning or ''}\n"
                f"<i>{word.example_sentence or ''}</i>\n\n"
                f"{prompt}"
            )
            try:
                await client.post(
                    f"https://api.telegram.org/bot{bot_token}/sendMessage",
                    json={"chat_id": chat_id, "text": msg, "parse_mode": "HTML"},
                )
                sent += 1
            except Exception:
                pass
    return {"sent": sent}
