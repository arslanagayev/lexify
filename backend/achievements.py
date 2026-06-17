"""
Achievement definitions and unlock evaluation.
State-based achievements are derived from DB counts; event-based ones
(perfect_quiz, polyglot) are unlocked explicitly via the API.
"""
from __future__ import annotations

ACHIEVEMENTS = [
    {"id": "first_word",          "icon": "🌱", "name": "First Word",          "description": "Add your first word"},
    {"id": "ten_words",           "icon": "📚", "name": "Bookworm",            "description": "Add 10 words"},
    {"id": "fifty_words",         "icon": "🗂️", "name": "Collector",           "description": "Add 50 words"},
    {"id": "first_mastered",      "icon": "✅", "name": "First Mastery",       "description": "Master your first word"},
    {"id": "streak_3",            "icon": "🔥", "name": "Getting Started",     "description": "3-day streak"},
    {"id": "streak_7",            "icon": "🔥", "name": "On Fire",             "description": "7-day streak"},
    {"id": "streak_30",           "icon": "🏆", "name": "Unstoppable",         "description": "30-day streak"},
    {"id": "hundred_reviews",     "icon": "💯", "name": "Centurion",           "description": "Complete 100 reviews"},
    {"id": "perfect_quiz",        "icon": "🎯", "name": "Perfect Score",       "description": "Get every quiz question right"},
    {"id": "pronunciation_master","icon": "🎤", "name": "Pronunciation Master","description": "10 correct pronunciations"},
    {"id": "polyglot",            "icon": "🌍", "name": "Polyglot",            "description": "Use all 4 interface languages"},
]

ACHIEVEMENT_IDS = {a["id"] for a in ACHIEVEMENTS}
# Achievements that cannot be derived from DB counts — unlocked via explicit API call
EVENT_ACHIEVEMENTS = {"perfect_quiz", "polyglot"}
