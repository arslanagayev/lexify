from __future__ import annotations
import asyncio
import json
import os
from functools import partial

from google import genai
from dotenv import load_dotenv

load_dotenv()

_api_key = os.getenv("GEMINI_API_KEY", "")
_client = genai.Client(api_key=_api_key) if _api_key else None

PROMPT = """\
You are a professional English vocabulary assistant.
Given the English word or phrase "{word}", return a JSON object with these exact fields:

{{
  "word": "canonical form of the word",
  "phonetic": "IPA transcription, e.g. /wɜːrd/",
  "part_of_speech": "one of: noun, verb, adjective, adverb, preposition, conjunction, interjection",
  "chinese_meaning": "concise Chinese meaning, e.g. 单词，词语",
  "example_sentence": "a natural English example sentence using this word",
  "chinese_translation": "Chinese translation of the example sentence"
}}

Return ONLY the raw JSON object — no markdown fences, no explanation."""


async def enrich_word(word: str) -> dict:
    if not _client:
        raise RuntimeError(
            "GEMINI_API_KEY is not set. Add it to your .env file and restart the server."
        )

    loop = asyncio.get_event_loop()
    try:
        response = await loop.run_in_executor(
            None,
            partial(
                _client.models.generate_content,
                model="gemini-2.0-flash",
                contents=PROMPT.format(word=word),
            ),
        )
        text = response.text.strip()
        # Strip accidental markdown fences
        if text.startswith("```"):
            lines = text.splitlines()
            text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

        data = json.loads(text)
        data.setdefault("word", word)
        return data
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Gemini returned invalid JSON: {e}") from e
    except Exception as e:
        raise RuntimeError(f"Gemini API error: {e}") from e
