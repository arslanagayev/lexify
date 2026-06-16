from pydantic import BaseModel, EmailStr, field_validator
from datetime import datetime
from typing import Optional


# ── Auth schemas ──────────────────────────────────────────────

class UserCreate(BaseModel):
    email: str
    password: str
    first_name: str
    last_name: str
    username: str
    age: Optional[int] = None

    @field_validator("email")
    @classmethod
    def email_must_have_at(cls, v: str) -> str:
        if "@" not in v:
            raise ValueError("Invalid email address")
        return v.lower().strip()

    @field_validator("password")
    @classmethod
    def password_length(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v

    @field_validator("username")
    @classmethod
    def username_alphanum(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Username cannot be empty")
        return v


class VerifyRequest(BaseModel):
    email: str
    code: str


class LoginRequest(BaseModel):
    email: str
    password: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    email: str
    code: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_length(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


class UserResponse(BaseModel):
    id: int
    email: str
    first_name: str
    last_name: str
    username: str
    age: Optional[int] = None
    is_verified: bool
    created_at: datetime
    telegram_bot_connected: bool = False
    telegram_linked: bool = False

    model_config = {"from_attributes": True}

    @property
    def is_verified_bool(self) -> bool:
        return bool(self.is_verified)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ── Word schemas ───────────────────────────────────────────────

class WordCreate(BaseModel):
    word: str


class WordUpdate(BaseModel):
    word: Optional[str] = None
    phonetic: Optional[str] = None
    part_of_speech: Optional[str] = None
    chinese_meaning: Optional[str] = None
    chinese_pinyin: Optional[str] = None
    example_sentence: Optional[str] = None
    chinese_translation: Optional[str] = None
    source_name: Optional[str] = None
    source_url: Optional[str] = None
    synonyms: Optional[str] = None
    antonyms: Optional[str] = None
    collocations: Optional[str] = None
    tags: Optional[str] = None
    etymology: Optional[str] = None


class WordResponse(BaseModel):
    id: int
    word: str
    phonetic: Optional[str] = None
    part_of_speech: Optional[str] = None
    chinese_meaning: Optional[str] = None
    chinese_pinyin: Optional[str] = None
    example_sentence: Optional[str] = None
    chinese_translation: Optional[str] = None
    source_name: Optional[str] = None
    source_url: Optional[str] = None
    synonyms: Optional[str] = None
    antonyms: Optional[str] = None
    collocations: Optional[str] = None
    tags: Optional[str] = None
    etymology: Optional[str] = None
    created_at: datetime
    review_count: int = 0
    known_count: int = 0
    unknown_count: int = 0
    mastery_status: str = "new"
    mastered_at: Optional[datetime] = None
    difficulty_score: float = 0.0
    interval_days: int = 1
    last_reviewed: Optional[datetime] = None
    next_review: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ReviewRequest(BaseModel):
    known: bool


class DailyHistory(BaseModel):
    date: str
    added: int
    reviewed: int


class StatsResponse(BaseModel):
    total_words: int
    added_today: int
    reviewed_today: int
    total_reviews: int
    known_rate: float
    daily_history: list[DailyHistory]


class StreakResponse(BaseModel):
    streak: int
    last_active: Optional[str] = None


class QuizOption(BaseModel):
    text: str
    correct: bool


class QuizQuestion(BaseModel):
    word_id: int
    word: str
    question_type: str
    question: str
    options: list[QuizOption]


class ImportResponse(BaseModel):
    imported: int
    skipped: int


class ReviewLogEntry(BaseModel):
    id: int
    word_id: int
    word_text: str
    known: bool
    reviewed_at: datetime

    model_config = {"from_attributes": True}


class TelegramStartRequest(BaseModel):
    chat_id: str


class TelegramSetupRequest(BaseModel):
    token: str


class TelegramLinkRequest(BaseModel):
    code: str
    telegram_chat_id: str


class TelegramWordRequest(BaseModel):
    telegram_chat_id: str
    word: str


class TelegramLinkCodeResponse(BaseModel):
    code: str
    expires_in_seconds: int = 300


class ResendRequest(BaseModel):
    email: str


class TelegramLanguageRequest(BaseModel):
    chat_id: str
    language: str


class ProfileUpdateRequest(BaseModel):
    first_name: str
    last_name: str
    username: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class DeleteAccountRequest(BaseModel):
    password: str


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
