"""Supported languages for the course system (code → English name + native name)."""

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
