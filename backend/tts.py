"""
Text-to-speech for the Lexify Telegram bot.

Uses edge-tts (Microsoft neural voices) to synthesize MP3, then converts to
OGG/OPUS via ffmpeg so Telegram renders it as a proper voice message.
All temp files are deleted immediately after the bytes are read.
"""
from __future__ import annotations

import asyncio
import logging
import os
import tempfile
from typing import Optional

import edge_tts

logger = logging.getLogger(__name__)

EN_VOICE = "en-US-AriaNeural"
ZH_VOICE = "zh-CN-XiaoxiaoNeural"


async def synthesize_ogg(text: str, voice: str) -> Optional[bytes]:
    """
    Synthesize `text` with `voice` and return OGG/OPUS bytes.
    Returns None on any failure. Temp files are always cleaned up.
    """
    if not text.strip():
        return None

    mp3_path: Optional[str] = None
    ogg_path: Optional[str] = None
    try:
        fd, mp3_path = tempfile.mkstemp(suffix=".mp3", prefix="lexify_tts_")
        os.close(fd)

        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(mp3_path)

        if not os.path.exists(mp3_path) or os.path.getsize(mp3_path) == 0:
            return None

        ogg_path = mp3_path[:-4] + ".ogg"
        proc = await asyncio.create_subprocess_exec(
            "ffmpeg", "-y", "-i", mp3_path,
            "-c:a", "libopus", "-b:a", "32k",
            ogg_path,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
        )
        await proc.wait()

        if proc.returncode != 0 or not os.path.exists(ogg_path):
            return None

        with open(ogg_path, "rb") as f:
            return f.read()

    except Exception as e:
        logger.warning("TTS synthesis failed (voice=%s): %s", voice, e)
        return None

    finally:
        for path in (mp3_path, ogg_path):
            if path and os.path.exists(path):
                try:
                    os.remove(path)
                except OSError:
                    pass
