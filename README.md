# Lexify — AI-Powered Vocabulary Assistant

A full-stack vocabulary learning app with spaced repetition, AI enrichment, quiz mode, auto-play, user authentication, and daily reminders.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + Vite + Tailwind CSS (glassmorphism) |
| Backend | FastAPI + async SQLAlchemy + aiosqlite (SQLite) |
| AI | DeepSeek API (phonetics, meanings, synonyms, etymology, tags) |
| Auth | JWT (python-jose) + bcrypt password hashing |
| Email | Gmail SMTP for 6-digit verification/reset codes |
| News search | BBC RSS → Bing News RSS → Google News RSS → DuckDuckGo |
| Scheduling | APScheduler 3.x (daily Telegram reminders) |
| Notifications | Telegram Bot API |

---

## Quick Start

### 1. Install dependencies

```bash
pip3 install -r requirements.txt
cd frontend && npm install
```

### 2. Configure `.env`

```env
DEEPSEEK_API_KEY=sk-...
TELEGRAM_BOT_TOKEN=...        # optional — for daily reminders
REMINDER_HOUR=9               # UTC hour for daily reminder (default: 9)
REMINDER_MINUTE=0
DATABASE_URL=sqlite+aiosqlite:///./vocabulary.db

# Auth — generate with: python3 -c "import secrets; print(secrets.token_hex(32))"
JWT_SECRET=your-long-random-secret-here

# Gmail — use an App Password (Google Account → Security → 2-Step → App passwords)
EMAIL_ADDRESS=yourname@gmail.com
EMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
```

**Dev mode:** If `EMAIL_ADDRESS`/`EMAIL_APP_PASSWORD` are not set, verification codes are printed to the server console instead of sent by email.

### 3. Run

```bash
# Terminal 1 — Backend (auto-reload)
python3 -m uvicorn backend.main:app --reload

# Terminal 2 — Frontend dev server
cd frontend && npm run dev

# Terminal 3 — Telegram bot polling (optional)
python3 -m backend.telegram_bot
```

Frontend: http://localhost:5173  
API docs: http://localhost:8000/docs

---

## Features

| Feature | Details |
|---------|---------|
| **Auth** | Register (email code verify) · Login · Forgot password · JWT tokens (7-day) |
| **Word cards** | Phonetic, Chinese meaning + pinyin, example sentence, synonyms, antonyms, collocations, etymology, tags, source link |
| **Spaced Repetition** | SM-2 algorithm — interval_days, ease_factor, next_review |
| **Review Mode** | Flip cards, Know/Don't Know buttons, keyboard shortcuts |
| **Auto-play Mode** | Reads word (en-US) → waits 2 s → flips → reads Chinese (zh-CN) → waits 3 s → advances |
| **Quiz Mode** | 10-question MCQ sessions, meaning/reverse question types, score tracking |
| **Daily Word** | Deterministic word-of-the-day based on date |
| **Tag filtering** | AI-suggested topic tags, filter chips above grid |
| **Etymology** | AI-generated word origin shown on card |
| **Export / Import** | Full JSON export/import with duplicate detection |
| **Streak tracking** | Daily activity log, 🔥 streak badge in header |
| **Review History** | Last 20 reviews (word + result + timestamp) in Stats panel |
| **Telegram reminders** | Daily bot message when no review has been done yet |
| **4-language UI** | English, Turkish, Chinese, Russian |

---

## Auth Flow

1. **Register** — fill form → receive 6-digit code by email → verify → auto logged in
2. **Login** — email + password → JWT token stored in localStorage
3. **Forgot password** — email → 6-digit reset code → new password
4. Words are **scoped to each user** — users only see their own vocabulary

---

## Keyboard Shortcuts (Review Mode)

| Key | Action |
|-----|--------|
| `Space` / `Enter` | Flip card |
| `← →` or `h l` | Previous / Next |
| `1` | I know it |
| `2` | Don't know |
| `A` | Toggle Auto-play |

---

## Multi-Device Sync

The system uses a single SQLite database served by one FastAPI backend.

**When deployed to a VPS**, all devices (phone, laptop, tablet) connect to the same backend URL — there is no additional sync logic needed. Data is always consistent because there is only one source of truth.

---

## Telegram Bot Setup

1. Message [@BotFather](https://t.me/botfather) → `/newbot` → copy the token → add to `.env` as `TELEGRAM_BOT_TOKEN`
2. Run `python3 -m backend.telegram_bot` in a terminal (keeps running in the background)
3. Open your bot in Telegram and send `/start` — your chat ID is saved to the database
4. The FastAPI backend's APScheduler sends a reminder at `REMINDER_HOUR:REMINDER_MINUTE` UTC if you haven't reviewed that day

**Bot commands:**
- `/start` — subscribe to daily reminders
- `/stop` — unsubscribe
- `/status` — word count and today's review status

---

## Deployment (VPS)

```bash
# Build frontend
cd frontend && npm run build && cd ..

# Run backend (use gunicorn or systemd in production)
python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 8000

# Serve frontend/dist/ via nginx reverse proxy
# Point all devices to https://yourdomain.com
```

Once deployed, every device that opens `https://yourdomain.com` reads and writes to the same database — automatic multi-device sync.
