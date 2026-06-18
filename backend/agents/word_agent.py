"""
Example Search Agent
  1. BBC RSS (doğrudan erişilebilir makale URL'leri — birincil)
  2. Google News RSS (geniş arama, Google yönlendirme URL'i — ikincil)
  3. DuckDuckGo News (rate-limit'e tabi — üçüncül)
  4. DeepSeek (son çare — kendi ürettiği cümle)
"""
from __future__ import annotations


class AIServiceLimitedError(RuntimeError):
    """Raised when the DeepSeek API is unavailable for any reason."""
import asyncio
import json
import os
import re
import time
import xml.etree.ElementTree as ET
import html as html_mod
from typing import Optional, Tuple

import httpx
from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv()

_client: Optional[AsyncOpenAI] = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        api_key = os.getenv("DEEPSEEK_API_KEY", "")
        if not api_key:
            raise RuntimeError(
                "DEEPSEEK_API_KEY is not set. Add it to your .env file and restart the server."
            )
        _client = AsyncOpenAI(
            api_key=api_key,
            base_url="https://api.deepseek.com",
        )
    return _client


# ---------------------------------------------------------------------------
# Yardımcı: cümle çıkarma
# ---------------------------------------------------------------------------

def _clean(text: str) -> str:
    """HTML tag'lerini ve fazla boşlukları temizle."""
    return re.sub(r'\s+', ' ', html_mod.unescape(re.sub(r'<[^>]+>', ' ', text or ''))).strip()


def _extract_sentence(text: str, word: str) -> Optional[str]:
    """Metinden kelimeyi içeren 8–50 kelimelik bir cümle döndür."""
    for sent in re.split(r'(?<=[.!?])\s+', text):
        wc = len(sent.split())
        if word.lower() in sent.lower() and 8 <= wc <= 50:
            return sent.strip()
    return None


# ---------------------------------------------------------------------------
# 1) BBC RSS — doğrudan erişilebilir makale URL'leri
# ---------------------------------------------------------------------------

_BBC_FEEDS = [
    ("BBC Business", "https://feeds.bbci.co.uk/news/business/rss.xml"),
    ("BBC News",     "https://feeds.bbci.co.uk/news/rss.xml"),
    ("BBC World",    "https://feeds.bbci.co.uk/news/world/rss.xml"),
    ("BBC Politics", "https://feeds.bbci.co.uk/news/politics/rss.xml"),
    ("BBC Tech",     "https://feeds.bbci.co.uk/news/technology/rss.xml"),
]


async def _search_bbc(
    word: str,
) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """BBC RSS feed'lerinde kelimeyi içeren cümle + doğrudan makale URL'si ara."""
    try:
        async with httpx.AsyncClient(timeout=8, follow_redirects=True) as client:
            for src_name, feed_url in _BBC_FEEDS:
                try:
                    resp = await client.get(feed_url, headers={"User-Agent": "Mozilla/5.0"})
                    if resp.status_code != 200:
                        continue
                    root = ET.fromstring(resp.content)
                    for item in root.findall(".//item"):
                        link_el  = item.find("link")
                        art_url  = (link_el.text or "").strip() if link_el is not None else ""
                        # URL'deki tracking parametrelerini temizle
                        art_url  = art_url.split("?")[0] if art_url else ""
                        for tag in ("title", "description"):
                            el = item.find(tag)
                            if el is None or not el.text:
                                continue
                            sent = _extract_sentence(_clean(el.text), word)
                            if sent and art_url:
                                return sent, src_name, art_url
                except Exception:
                    continue
    except Exception:
        pass
    return None, None, None


# ---------------------------------------------------------------------------
# 2) Bing News RSS — redirect takip ederek doğrudan makale URL'si
# ---------------------------------------------------------------------------

_BING_RSS = "https://www.bing.com/news/search?q={q}&format=RSS"


async def _resolve_bing_url(bing_link: str) -> Optional[str]:
    """Bing apiclick URL'ini takip et, gerçek ve erişilebilir makale URL'sini döndür.

    404 dönen (silinmiş/taşınmış) makaleleri atlar; diğer durum kodlarını
    (200, 403 paywall, vb.) geçerli kabul eder.
    """
    try:
        async with httpx.AsyncClient(timeout=5, follow_redirects=True) as c:
            r = await c.get(bing_link, headers={"User-Agent": "Mozilla/5.0"})
        final = str(r.url)
        if "bing.com" in final or r.status_code == 404:
            return None
        return final
    except Exception:
        return None


async def _search_bing(
    word: str,
) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """Bing News RSS'ten cümle + redirect takip ederek doğrudan makale URL'si çek."""
    url = _BING_RSS.format(q=word.replace(" ", "+"))
    try:
        async with httpx.AsyncClient(timeout=8, follow_redirects=True) as client:
            resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
        if resp.status_code != 200:
            return None, None, None

        root = ET.fromstring(resp.content)
        for item in root.findall(".//item"):
            link_el = item.find("link")
            if link_el is None or not link_el.text:
                continue

            # Bing namespace'li <Source> elementinden kaynak adı
            src_name = ""
            for child in item:
                lname = child.tag.split("}")[-1] if "}" in child.tag else child.tag
                if lname == "Source":
                    src_name = (child.text or "").strip()
                    break
            # "X on MSN" → "X" formatını temizle
            src_name = re.sub(r'\s+on\s+MSN$', '', src_name, flags=re.IGNORECASE).strip()

            sent = None
            for tag in ("title", "description"):
                el = item.find(tag)
                if el is not None and el.text:
                    s = _extract_sentence(_clean(el.text), word)
                    if s:
                        sent = s
                        break
            if not sent:
                continue

            art_url = await _resolve_bing_url(link_el.text.strip())
            if art_url:
                return sent, src_name, art_url

    except Exception:
        pass
    return None, None, None


# ---------------------------------------------------------------------------
# 3) Google News RSS — geniş arama, Google yönlendirme URL'i
# ---------------------------------------------------------------------------

_GNEWS_RSS = "https://news.google.com/rss/search?q={q}&hl=en-US&gl=US&ceid=US:en"

# Google News RSS'te tercih edilen kaynaklar (açık erişimli / güvenilir)
_PREFERRED_SOURCES = {
    "Reuters", "AP News", "BBC News", "The Guardian",
    "Bloomberg", "CNBC", "CNN", "Al Jazeera English",
}


async def _search_gnews(
    word: str,
) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """Google News RSS'ten kelimeyi içeren haber başlığı çek.

    source_url olarak Google'ın makale yönlendirme URL'ini döndürür
    (<link> elementi) — publisher anasayfası değil.
    Tarayıcıda tıklandığında ilgili makaleye yönlendirir.
    """
    url = _GNEWS_RSS.format(q=word.replace(" ", "+"))
    try:
        async with httpx.AsyncClient(timeout=8, follow_redirects=True) as client:
            resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
        if resp.status_code != 200:
            return None, None, None

        root = ET.fromstring(resp.content)
        items = root.findall(".//item")

        # Önce tercih edilen kaynakları dene
        def _priority(item):
            src_el = item.find("source")
            src = (src_el.text or "").strip() if src_el is not None else ""
            return 0 if src in _PREFERRED_SOURCES else 1

        for item in sorted(items, key=_priority):
            src_el   = item.find("source")
            title_el = item.find("title")
            link_el  = item.find("link")
            if title_el is None or not title_el.text:
                continue

            source_name = (src_el.text or "").strip() if src_el is not None else ""
            # <link> = Google'ın makale yönlendirme URL'i (publisher anasayfasından daha iyi)
            source_url  = (link_el.text or "").strip() if link_el is not None else ""

            title = title_el.text.strip()
            # "Başlık - Kaynak Adı" sonekini temizle
            if source_name and title.endswith(f" - {source_name}"):
                title = title[: -len(f" - {source_name}")].strip()
            else:
                title = re.sub(r'\s+-\s+[A-Z][A-Za-z ]+$', '', title).strip()

            sent = _extract_sentence(title, word)
            if not sent:
                wc = len(title.split())
                if word.lower() in title.lower() and 6 <= wc <= 50:
                    sent = title

            if sent:
                return sent, source_name, source_url

    except Exception:
        pass
    return None, None, None


# ---------------------------------------------------------------------------
# 3) DuckDuckGo News — rate-limit'e tabi
# ---------------------------------------------------------------------------

def _ddg_news_sync(query: str, timelimit: Optional[str], max_results: int) -> list:
    from duckduckgo_search import DDGS
    try:
        from duckduckgo_search.exceptions import RatelimitException
    except ImportError:
        RatelimitException = Exception  # type: ignore

    for attempt in range(2):
        try:
            with DDGS() as ddgs:
                return list(ddgs.news(
                    keywords=query,
                    region="en-us",
                    timelimit=timelimit,
                    max_results=max_results,
                ))
        except RatelimitException:
            if attempt == 0:
                time.sleep(3)
        except Exception:
            break
    return []


async def _search_ddg(
    word: str,
) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """DuckDuckGo News'ten doğrudan makale URL'si ile gerçek cümle ara."""
    plans = [
        (f'"{word}"', "m", 15),
        (f'"{word}"', "y", 20),
    ]
    try:
        for query, timelimit, max_results in plans:
            results = await asyncio.to_thread(_ddg_news_sync, query, timelimit, max_results)
            for r in results:
                body = r.get("body") or r.get("excerpt") or ""
                sent = _extract_sentence(body, word)
                if sent:
                    source = r.get("source") or r.get("publisher") or ""
                    url    = r.get("url")    or r.get("href")      or ""
                    return sent, source, url
    except Exception:
        pass
    return None, None, None


# ---------------------------------------------------------------------------
# Birleşik arama: BBC → Google News → DuckDuckGo → None
# ---------------------------------------------------------------------------

async def _search_example(
    word: str,
) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    # 1) BBC — doğrudan, doğrulanabilir makale URL'si
    sentence, source_name, source_url = await _search_bbc(word)
    if sentence:
        return sentence, source_name, source_url

    # 2) Bing — redirect takip → doğrudan makale URL'si
    sentence, source_name, source_url = await _search_bing(word)
    if sentence:
        return sentence, source_name, source_url

    # 3) Google News RSS — Google makale sayfası (tarayıcıda çalışır)
    sentence, source_name, source_url = await _search_gnews(word)
    if sentence:
        return sentence, source_name, source_url

    # 4) DuckDuckGo — doğrudan URL, rate-limit'e tabi
    sentence, source_name, source_url = await _search_ddg(word)
    return sentence, source_name, source_url


# ---------------------------------------------------------------------------
# DeepSeek prompt
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """\
You are a professional vocabulary assistant for language learners.
You return a JSON object with vocabulary information.
Always respond with valid JSON only — no markdown, no explanation."""

_LANG_NAMES = {
    "en": "English", "zh": "Chinese", "es": "Spanish", "hi": "Hindi", "ar": "Arabic",
    "fr": "French", "ru": "Russian", "pt": "Portuguese", "de": "German", "ja": "Japanese",
    "ko": "Korean", "tr": "Turkish", "it": "Italian", "nl": "Dutch", "pl": "Polish", "vi": "Vietnamese",
}

_JSON_SCHEMA = (
    "{\n"
    '  "word": "canonical form of the word",\n'
    '  "phonetic": "IPA transcription, e.g. /rɪˈzɪl.i.əns/",\n'
    '  "part_of_speech": "one of: noun, verb, adjective, adverb, '
    "preposition, conjunction, interjection\",\n"
    '  "chinese_meaning": "concise Chinese meaning, e.g. 韧性，恢复力",\n'
    '  "chinese_pinyin": "pinyin romanisation of the Chinese meaning, '
    "tone marks required, e.g. rènxìng，huīfùlì\",\n"
    '  "synonyms": "2–4 English synonyms, comma-separated, e.g. toughness, durability, flexibility",\n'
    '  "antonyms": "2–4 English antonyms, comma-separated, e.g. fragility, weakness, vulnerability",\n'
    '  "collocations": "3–5 common collocations, comma-separated, e.g. show resilience, remarkable resilience, resilience in adversity",\n'
    '  "tags": "1–2 topic tags, comma-separated, chosen from: business, finance, politics, science, technology, culture, psychology, environment, health, law, economics, society, education, sports, arts",\n'
    '  "etymology": "1–2 sentence etymology: origin language, root meaning, and when/how the word entered English",\n'
    '  "example_sentence": "EXAMPLE_SLOT",\n'
    '  "chinese_translation": "TRANSLATION_SLOT"\n'
    "}"
)


def _dynamic_schema(base_name: str, target_name: str, example_desc: str, translation_desc: str) -> str:
    return (
        "{\n"
        f'  "word": "canonical form of the {target_name} word",\n'
        f'  "phonetic": "IPA/pronunciation of the {target_name} word",\n'
        '  "part_of_speech": "one of: noun, verb, adjective, adverb, preposition, conjunction, interjection",\n'
        f'  "chinese_meaning": "concise meaning of the word written in {base_name}",\n'
        f'  "chinese_pinyin": "Latin-letter romanization of the {target_name} word (e.g. pinyin if Chinese, romaji if Japanese); empty string if not applicable",\n'
        f'  "synonyms": "2-4 {target_name} synonyms, comma-separated",\n'
        f'  "antonyms": "2-4 {target_name} antonyms, comma-separated",\n'
        f'  "collocations": "3-5 common {target_name} collocations, comma-separated",\n'
        '  "tags": "1-2 topic tags, comma-separated, from: business, finance, politics, science, technology, culture, psychology, environment, health, law, economics, society, education, sports, arts",\n'
        f'  "etymology": "1-2 sentence etymology of the {target_name} word, written in {base_name}",\n'
        f'  "example_sentence": "{example_desc}",\n'
        f'  "chinese_translation": "{translation_desc}"\n'
        "}"
    )


def _build_prompt(word: str, sentence: Optional[str], base_lang: str = "zh", target_lang: str = "en") -> str:
    base_name = _LANG_NAMES.get(base_lang, "English")
    target_name = _LANG_NAMES.get(target_lang, "English")
    if sentence:
        schema = _dynamic_schema(
            base_name, target_name,
            "<copy the news sentence provided above verbatim>",
            f"translation of example_sentence into {base_name}",
        )
        return (
            f'The learner speaks {base_name} and is learning {target_name}.\n'
            f'Provide vocabulary information for the {target_name} word: "{word}"\n\n'
            "The following sentence is taken from a real news article.\n"
            "Copy it verbatim into example_sentence — do NOT rephrase:\n"
            f"  {sentence}\n\n"
            f"Return a JSON object with exactly these fields:\n{schema}"
        )
    else:
        schema = _dynamic_schema(
            base_name, target_name,
            f"a natural {target_name} example sentence using this word",
            f"translation of the example sentence into {base_name}",
        )
        return (
            f'The learner speaks {base_name} and is learning {target_name}.\n'
            f'Provide vocabulary information for the {target_name} word: "{word}"\n\n'
            f"Return a JSON object with exactly these fields:\n{schema}"
        )


# ---------------------------------------------------------------------------
# Ana fonksiyon
# ---------------------------------------------------------------------------

async def enrich_word(word: str, base_lang: str = "zh", target_lang: str = "en") -> dict:
    """Enrich a word for a (base→target) course. News example search only runs
    for English targets; other targets get an AI-generated example sentence."""
    client = _get_client()

    sentence = source_name = source_url = None
    if target_lang == "en":
        sentence, source_name, source_url = await _search_example(word)
    prompt = _build_prompt(word, sentence, base_lang, target_lang)

    try:
        response = await client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user",   "content": prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.3,
            max_tokens=900,
        )
        text = response.choices[0].message.content or "{}"
        data = json.loads(text)
        data.setdefault("word", word)

        # Gerçek cümle bulunduysa Python tarafında garantile
        if sentence:
            data["example_sentence"] = sentence
        if source_name:
            data["source_name"] = source_name
        if source_url:
            data["source_url"] = source_url

        return data

    except json.JSONDecodeError as e:
        raise AIServiceLimitedError(f"DeepSeek returned invalid JSON: {e}") from e
    except Exception as e:
        raise AIServiceLimitedError(f"DeepSeek API error: {e}") from e
