from __future__ import annotations
from datetime import datetime
from typing import Optional
from sqlalchemy import Integer, String, Text, DateTime, Float, func, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from backend.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    age: Mapped[Optional[int]] = mapped_column(Integer)
    is_verified: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    telegram_bot_token: Mapped[Optional[str]] = mapped_column(Text)
    telegram_chat_id: Mapped[Optional[str]] = mapped_column(String(50))
    last_code_sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    @property
    def telegram_bot_connected(self) -> bool:
        return bool(self.telegram_bot_token)

    @property
    def telegram_linked(self) -> bool:
        return bool(self.telegram_chat_id)


class VerificationCode(Base):
    __tablename__ = "verification_codes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(6), nullable=False)
    purpose: Mapped[str] = mapped_column(String(20), nullable=False)  # "verify" | "reset"
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)


class Word(Base):
    __tablename__ = "words"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    word: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    phonetic: Mapped[Optional[str]] = mapped_column(String(100))
    part_of_speech: Mapped[Optional[str]] = mapped_column(String(50))
    chinese_meaning: Mapped[Optional[str]] = mapped_column(Text)
    chinese_pinyin: Mapped[Optional[str]] = mapped_column(String(300))
    example_sentence: Mapped[Optional[str]] = mapped_column(Text)
    chinese_translation: Mapped[Optional[str]] = mapped_column(Text)
    source_name: Mapped[Optional[str]] = mapped_column(String(200))
    source_url: Mapped[Optional[str]] = mapped_column(String(500))
    synonyms: Mapped[Optional[str]] = mapped_column(Text)
    antonyms: Mapped[Optional[str]] = mapped_column(Text)
    collocations: Mapped[Optional[str]] = mapped_column(Text)
    tags: Mapped[Optional[str]] = mapped_column(Text)
    etymology: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    review_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    known_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    unknown_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    mastery_status: Mapped[str] = mapped_column(
        String(10), default="new", server_default="new", nullable=False
    )  # 'new' | 'learning' | 'mastered'
    mastered_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    difficulty_score: Mapped[float] = mapped_column(
        Float, default=0.0, server_default="0.0", nullable=False
    )
    interval_days: Mapped[int] = mapped_column(Integer, default=1, server_default="1", nullable=False)
    ease_factor: Mapped[float] = mapped_column(Float, default=2.5, server_default="2.5", nullable=False)
    last_reviewed: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    next_review: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))


class DailyActivity(Base):
    __tablename__ = "daily_activity"

    date: Mapped[str] = mapped_column(String(10), primary_key=True)


class ReviewLog(Base):
    __tablename__ = "review_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    word_id: Mapped[int] = mapped_column(Integer, nullable=False)
    word_text: Mapped[str] = mapped_column(String(100), nullable=False)
    known: Mapped[int] = mapped_column(Integer, nullable=False)
    reviewed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class TelegramChat(Base):
    __tablename__ = "telegram_chats"

    chat_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    registered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class TelegramLinkCode(Base):
    __tablename__ = "telegram_link_codes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(6), nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)


class TelegramLanguage(Base):
    __tablename__ = "telegram_language"

    chat_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    language: Mapped[str] = mapped_column(String(5), nullable=False, server_default="en")
