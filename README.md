# Lexify — AI-Powered English Vocabulary Learning Platform

Lexify is a full-stack vocabulary learning application that uses AI to enrich words with real news examples, multi-language translations, phonetics, etymology, and spaced repetition — all accessible through a web UI and a Telegram bot powered by an intelligent AI assistant.

---

## Features

### Web Application
| Feature | Details |
|---------|---------|
| **Authentication** | Register with email verification (6-digit code) · Login · Forgot password · Resend code with 30s cooldown · JWT tokens (7-day) |
| **Word Cards** | Phonetic (IPA), Chinese meaning + pinyin, real news example sentence with source link, synonyms, antonyms, collocations, etymology, AI tags |
| **AI Enrichment** | DeepSeek searches real news (BBC → Bing → Google → DuckDuckGo) for example sentences; generates all word metadata automatically |
| **Spaced Repetition** | SM-2 algorithm — interval_days, ease_factor, next_review scheduling |
| **Review Mode** | Flip cards, Know / Don't Know buttons, keyboard shortcuts |
| **Auto-play Mode** | TTS: reads word (en-US) → waits → flips → reads Chinese (zh-CN) → advances |
| **Quiz Mode** | 10-question MCQ sessions, meaning and reverse question types, score tracking |
| **Daily Word** | Deterministic word-of-the-day based on date |
| **Tag Filtering** | AI-suggested topic tags, filter chips |
| **Export / Import** | Full JSON export/import with duplicate detection |
| **Streak Tracking** | Daily activity log, streak badge |
| **Stats Panel** | Review history, accuracy rate, 7-day activity chart |
| **4-Language UI** | English, Turkish, Chinese, Russian (toggle in header) |

### Telegram AI Assistant (via OpenClaw)
| Feature | Details |
|---------|---------|
| **Intelligent Bot** | Full conversational AI assistant (DeepSeek) for any English vocabulary question |
| **Account Linking** | `/link CODE` — link Telegram account to Lexify web account |
| **Add Words** | `add <word>` — AI-enriches and adds word to your personal list |
| **Query Words** | `query <word>` — look up a word in your list |
| **Review** | `review` — lists words due for spaced repetition |
| **Quiz** | `quiz` — interactive multiple-choice quiz from your list |
| **Language Preference** | `/language en|tr|ru|zh` — bot responds in your chosen language |
| **Open Access** | No pairing code required — any Telegram user can interact instantly |

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + Tailwind CSS (glassmorphism design) |
| Backend | FastAPI + async SQLAlchemy + aiosqlite (SQLite) |
| AI Model | DeepSeek API (`deepseek-chat`) |
| Auth | JWT (python-jose) + bcrypt password hashing |
| Email | Gmail SMTP — 6-digit verification & reset codes |
| News Search | BBC RSS → Bing News RSS → Google News RSS → DuckDuckGo |
| Scheduling | APScheduler 3.x — daily Telegram reminders |
| Telegram Bot | OpenClaw gateway (AI-native Telegram integration) |

---

## Project Structure

```
Final_AI/
├── backend/
│   ├── main.py              # FastAPI app, all endpoints
│   ├── models.py            # SQLAlchemy ORM models
│   ├── crud.py              # Database operations
│   ├── schemas.py           # Pydantic request/response schemas
│   ├── auth.py              # JWT, bcrypt, email sending
│   ├── database.py          # DB engine, session factory
│   ├── scheduler.py         # APScheduler daily reminder jobs
│   ├── telegram_bot.py      # Legacy polling bot (reminders)
│   ├── telegram_manager.py  # Multi-bot manager
│   └── agents/
│       └── word_agent.py    # DeepSeek AI word enrichment agent
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Root component + routing
│   │   ├── components/      # QuizMode, ReviewMode, WordCard, etc.
│   │   ├── pages/           # LoginPage, RegisterPage, SettingsPage, etc.
│   │   ├── context/         # AuthContext (JWT state)
│   │   └── i18n/            # LangContext + translations (en/tr/zh/ru)
│   ├── index.html
│   └── package.json
├── requirements.txt
├── .env.example
└── .gitignore
```

---

## Setup & Installation

### Requirements

- Python 3.11+
- Node.js 18+ and npm (or pnpm)
- A [DeepSeek API key](https://platform.deepseek.com) (for AI enrichment)
- A Gmail account with App Password enabled (for email verification)
- *(Optional)* A Telegram bot token from [@BotFather](https://t.me/botfather)
- *(Optional)* [OpenClaw](https://openclaw.ai) for the intelligent Telegram AI assistant

---

### 1. Clone the repository

```bash
git clone https://github.com/your-username/lexify.git
cd lexify
```

### 2. Backend setup

```bash
# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate        # macOS/Linux
# .venv\Scripts\activate         # Windows

# Install dependencies
pip install -r requirements.txt
```

### 3. Frontend setup

```bash
cd frontend
npm install
cd ..
```

### 4. Configure environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

Open `.env` and set:

```env
# DeepSeek AI — get key at https://platform.deepseek.com
DEEPSEEK_API_KEY=sk-...

# Database (default: SQLite in project root)
DATABASE_URL=sqlite+aiosqlite:///./vocabulary.db

# JWT secret — generate with:
#   python3 -c "import secrets; print(secrets.token_hex(32))"
JWT_SECRET=your-long-random-secret-here

# Gmail SMTP — use an App Password, NOT your account password
# Steps: Google Account → Security → 2-Step Verification → App passwords → Create
EMAIL_ADDRESS=yourname@gmail.com
EMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx

# Telegram bot (optional — for daily reminders only)
# 1. Message @BotFather on Telegram
# 2. Send /newbot and follow prompts
# 3. Copy the token here
TELEGRAM_BOT_TOKEN=1234567890:AAF...

# Daily reminder time (UTC)
REMINDER_HOUR=9
REMINDER_MINUTE=0
```

> **Dev mode tip:** If `EMAIL_ADDRESS` / `EMAIL_APP_PASSWORD` are not set, verification codes are printed to the server console instead of being emailed — useful for local development.

### 5. Run the backend

```bash
# From project root (with venv activated)
python3 -m uvicorn backend.main:app --reload
```

API available at: http://localhost:8000  
Interactive docs: http://localhost:8000/docs

### 6. Run the frontend

```bash
cd frontend
npm run dev
```

App available at: http://localhost:5173

---

## Telegram AI Assistant Setup (Optional — OpenClaw)

OpenClaw turns your Telegram bot into a full conversational AI assistant. Without it, the bot only sends daily reminders.

### Install OpenClaw

```bash
# Requires Node.js 18+
npm install -g @openclaw/openclaw
openclaw onboard
```

Follow the setup wizard to connect your DeepSeek API key and Telegram bot token.

### Configure open access

By default, OpenClaw requires a pairing code from new users. To allow anyone to message the bot instantly, add these to your OpenClaw config (`~/.openclaw/openclaw.json`):

```json
{
  "channels": {
    "telegram": {
      "dmPolicy": "open",
      "allowFrom": ["*"]
    }
  }
}
```

Then restart the gateway: `openclaw gateway restart`

### Add the Lexify skill

Copy the skill file to OpenClaw's workspace:

```bash
cp -r openclaw-skills/lexify ~/.openclaw/workspace/skills/
```

*(The skill file tells the AI how to call the Lexify backend API for `add`, `query`, `review`, `quiz`, and `/language` commands.)*

### Link a Telegram account to Lexify

1. Log into the Lexify web app
2. Go to **Settings** → **Telegram** → **Generate Link Code**
3. In Telegram, message your bot: `/link 123456`
4. Your account is linked — you can now use `add <word>`, `review`, `quiz`, etc.

---

## Keyboard Shortcuts (Review Mode)

| Key | Action |
|-----|--------|
| `Space` / `Enter` | Flip card |
| `← →` or `h l` | Previous / Next card |
| `1` | Mark as "I know it" |
| `2` | Mark as "Don't know" |
| `A` | Toggle Auto-play |

---

## API Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Create account, send verification email |
| POST | `/auth/verify` | Verify email with 6-digit code |
| POST | `/auth/resend` | Resend verification code (invalidates old one) |
| POST | `/auth/login` | Login, returns JWT |
| POST | `/auth/forgot-password` | Send password reset code |
| POST | `/auth/reset-password` | Reset password with code |
| GET | `/words` | List user's words |
| POST | `/words` | Add and AI-enrich a word |
| DELETE | `/words/{id}` | Delete a word |
| POST | `/words/{id}/review` | Submit a review result |
| GET | `/stats` | User statistics |
| POST | `/telegram/link` | Link Telegram chat to account |
| POST | `/telegram/add-word` | Add word via Telegram |
| GET | `/telegram/words` | Get words via Telegram |
| GET | `/telegram/review` | Get due words via Telegram |
| GET | `/telegram/quiz` | Get quiz question via Telegram |
| GET/POST | `/telegram/language` | Get/set bot response language |

---

## Updating

```bash
git pull

# Reinstall backend dependencies if requirements.txt changed
pip install -r requirements.txt

# Reinstall frontend dependencies if package.json changed
cd frontend && npm install

# IMPORTANT: rebuild the frontend so UI changes ship.
# dist/ is gitignored, so `git pull` never updates the served bundle —
# without this step the site keeps serving the OLD build.
npm run build && cd ..

# Restart both servers
```

Database migrations are handled automatically on startup: SQLAlchemy's
`create_all` creates any new tables, and a lightweight `ALTER TABLE` pass adds
any new columns (e.g. `courses.level`) to existing tables. Existing data is
always preserved.

---

## Notes & Costs

- **DeepSeek API** is billed per token. Adding a word costs roughly $0.001–0.003 depending on response length.
- **Gmail App Password** is required for email features — never use your main Google account password.
- **OpenClaw** is a separate tool with its own pricing model for AI inference.
- This project is intended for personal or educational use. All API costs are the responsibility of the deploying user.

---

## License

MIT
