from __future__ import annotations
from contextlib import asynccontextmanager
import os
import re
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, Query, Request, status
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
)
from backend.agents.word_agent import enrich_word
from backend.scheduler import setup_scheduler, scheduler
from backend import telegram_manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    hour = int(os.getenv("REMINDER_HOUR", "9"))
    minute = int(os.getenv("REMINDER_MINUTE", "0"))
    setup_scheduler(hour=hour, minute=minute)
    scheduler.start()
    await telegram_manager.start_all_bots()
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
    existing = await crud.get_user_by_email(db, body.email)
    if existing:
        if existing.is_verified:
            raise HTTPException(status_code=409, detail="Email already registered")
        # Unverified — check cooldown, then update fields and resend fresh verify code
        wait = await crud.check_and_update_code_cooldown(db, existing)
        if wait > 0:
            raise HTTPException(status_code=429, detail=f"Lütfen {wait} saniye bekleyip tekrar deneyin")
        existing.password_hash = hash_password(body.password)
        existing.first_name = body.first_name
        existing.last_name = body.last_name
        existing.username = body.username
        existing.age = body.age
        await db.commit()
        code = generate_code()
        await crud.create_verification_code(db, body.email, code, "verify", code_expiry())
        try:
            send_verification_email(body.email, code, first_name=body.first_name)
        except Exception as e:
            print(f"[email error] {e}")
        return {"message": "Verification code sent to your email"}

    if await crud.get_user_by_username(db, body.username):
        raise HTTPException(status_code=409, detail="Username already taken")

    pw_hash = hash_password(body.password)
    new_user = await crud.create_user(
        db, email=body.email, password_hash=pw_hash,
        first_name=body.first_name, last_name=body.last_name,
        username=body.username, age=body.age,
    )

    await crud.check_and_update_code_cooldown(db, new_user)
    code = generate_code()
    await crud.create_verification_code(db, body.email, code, "verify", code_expiry())

    try:
        send_verification_email(body.email, code, first_name=body.first_name)
    except Exception as e:
        print(f"[email error] {e}")

    return {"message": "Verification code sent to your email"}


@app.post("/auth/verify", response_model=schemas.TokenResponse)
@limiter.limit("5/minute")
async def verify_email(request: Request, body: schemas.VerifyRequest, db: AsyncSession = Depends(get_db)):
    user = await crud.get_user_by_email(db, body.email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    ok = await crud.verify_code(db, body.email, body.code, "verify")
    if not ok:
        raise HTTPException(status_code=400, detail="Invalid or expired code")

    await crud.mark_user_verified(db, user)
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
    user = await crud.get_user_by_email(db, body.email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.is_verified:
        raise HTTPException(status_code=400, detail="Email already verified")

    wait = await crud.check_and_update_code_cooldown(db, user)
    if wait > 0:
        raise HTTPException(status_code=429, detail=f"Lütfen {wait} saniye bekleyip tekrar deneyin")

    code = generate_code()
    await crud.create_verification_code(db, body.email, code, "verify", code_expiry())
    try:
        send_verification_email(body.email, code, first_name=user.first_name)
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


# ── Words ─────────────────────────────────────────────────────

@app.get("/words", response_model=list[schemas.WordResponse])
async def list_words(
    q: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await crud.get_words(db, q=q, user_id=current_user.id)


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
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
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
    updated = await crud.update_review(db, word, body.known)
    await crud.log_activity(db)
    return updated


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
    return await crud.get_streak(db)


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
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    word = await crud.create_word(db, data, user_id=user.id)
    await crud.log_activity(db)
    return word


@app.get("/telegram/words", response_model=list[schemas.WordResponse])
async def telegram_words(chat_id: str = Query(...), db: AsyncSession = Depends(get_db)):
    user = await crud.get_user_by_telegram_chat_id(db, chat_id)
    if not user:
        raise HTTPException(status_code=404, detail="not_linked")
    return await crud.get_words(db, q=None, user_id=user.id)


@app.get("/telegram/review", response_model=list[schemas.WordResponse])
async def telegram_review(chat_id: str = Query(...), db: AsyncSession = Depends(get_db)):
    user = await crud.get_user_by_telegram_chat_id(db, chat_id)
    if not user:
        raise HTTPException(status_code=404, detail="not_linked")
    return await crud.get_due_review_words(db, user.id)


@app.get("/telegram/quiz", response_model=schemas.QuizQuestion)
async def telegram_quiz(chat_id: str = Query(...), db: AsyncSession = Depends(get_db)):
    user = await crud.get_user_by_telegram_chat_id(db, chat_id)
    if not user:
        raise HTTPException(status_code=404, detail="not_linked")
    q = await crud.get_quiz_question(db, user_id=user.id)
    if q is None:
        raise HTTPException(status_code=422, detail="Need at least 2 words for quiz")
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
