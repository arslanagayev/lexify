"""Supported languages for the course system (code → English name + native name)."""

from typing import Optional

LANGUAGES = {
    "en": {"name": "English",    "native": "English"},
    "zh": {"name": "Chinese",    "native": "中文"},
    "es": {"name": "Spanish",    "native": "Español"},
    "hi": {"name": "Hindi",      "native": "हिन्दी"},
    "ar": {"name": "Arabic",     "native": "العربية"},
    "fr": {"name": "French",     "native": "Français"},
    "ru": {"name": "Russian",    "native": "Русский"},
    "pt": {"name": "Portuguese", "native": "Português"},
    "de": {"name": "German",     "native": "Deutsch"},
    "ja": {"name": "Japanese",   "native": "日本語"},
    "ko": {"name": "Korean",     "native": "한국어"},
    "tr": {"name": "Turkish",    "native": "Türkçe"},
    "it": {"name": "Italian",    "native": "Italiano"},
    "nl": {"name": "Dutch",      "native": "Nederlands"},
    "pl": {"name": "Polish",     "native": "Polski"},
    "vi": {"name": "Vietnamese", "native": "Tiếng Việt"},
}

VALID_LANGS = set(LANGUAGES.keys())


def lang_name(code: str) -> str:
    return LANGUAGES.get(code, {}).get("name", code)


# ── CEFR level (course "degree") system ───────────────────────────────────────
# Stored on each course as a simple bucket; mapped to CEFR + a prompt descriptor
# so every AI feature can adapt difficulty to the learner.

LEVELS = ("beginner", "intermediate", "advanced")
DEFAULT_LEVEL = "beginner"

# bucket → (CEFR range label, prose used inside AI system prompts)
LEVEL_INFO = {
    "beginner": {
        "cefr": "A1-A2",
        "desc": "a beginner (CEFR A1-A2): use only the most common, everyday "
                "vocabulary and short, simple sentence structures",
    },
    "intermediate": {
        "cefr": "B1-B2",
        "desc": "an intermediate learner (CEFR B1-B2): use moderately common "
                "vocabulary and natural, somewhat varied sentence structures",
    },
    "advanced": {
        "cefr": "C1-C2",
        "desc": "an advanced learner (CEFR C1-C2): you may use rarer, more "
                "nuanced vocabulary and complex sentence structures",
    },
}

# CEFR sub-levels each bucket should draw word suggestions from
LEVEL_CEFR_BANDS = {
    "beginner": ["A1", "A2"],
    "intermediate": ["B1", "B2"],
    "advanced": ["C1", "C2"],
}


def normalize_level(level: Optional[str]) -> str:
    """Coerce any stored/incoming level value to a valid bucket."""
    l = (level or "").strip().lower()
    if l in LEVELS:
        return l
    # tolerate raw CEFR codes
    cefr_map = {"a1": "beginner", "a2": "beginner",
                "b1": "intermediate", "b2": "intermediate",
                "c1": "advanced", "c2": "advanced"}
    return cefr_map.get(l, DEFAULT_LEVEL)


def level_descriptor(level: Optional[str], target_name: str) -> str:
    """Sentence injected into AI system prompts to adapt difficulty."""
    info = LEVEL_INFO[normalize_level(level)]
    return (f"The learner's level in {target_name} is {info['cefr']}. "
            f"Treat them as {info['desc']}. Adjust difficulty accordingly.")
