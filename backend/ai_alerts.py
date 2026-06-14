from __future__ import annotations
import os
import smtplib
import time
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

_COOLDOWN_FILE = "/tmp/lexify_ai_alert_cooldown"
_COOLDOWN_SECONDS = 3600
_ALERT_TO = "arslanagayew39@gmail.com"


def _get_last_sent() -> float:
    try:
        with open(_COOLDOWN_FILE) as f:
            return float(f.read().strip())
    except Exception:
        return 0.0


def _set_last_sent(ts: float) -> None:
    try:
        with open(_COOLDOWN_FILE, "w") as f:
            f.write(str(ts))
    except Exception:
        pass


def send_ai_alert(error_detail: str) -> None:
    """Send email alert when AI service fails. Skips if sent within the last hour."""
    now = time.time()
    if now - _get_last_sent() < _COOLDOWN_SECONDS:
        return

    _set_last_sent(now)

    email_addr = os.getenv("EMAIL_ADDRESS", "")
    email_pass = os.getenv("EMAIL_APP_PASSWORD", "")
    if not email_addr or not email_pass:
        print(f"[AI ALERT] {error_detail[:200]}")
        return

    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    short_err = error_detail[:500]

    body = f"""<!DOCTYPE html>
<html><body style="font-family:sans-serif;padding:24px;background:#f9fafb;">
<div style="max-width:520px;margin:auto;background:#fff;border-radius:12px;
            padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <h2 style="color:#dc2626;margin-top:0;">🚨 Lexify — AI Servis Hatası</h2>
  <table style="width:100%;border-collapse:collapse;font-size:14px;">
    <tr><td style="padding:6px 0;color:#6b7280;width:80px;">Zaman</td>
        <td style="padding:6px 0;font-weight:600;">{ts}</td></tr>
    <tr><td style="padding:6px 0;color:#6b7280;">Hata</td>
        <td style="padding:6px 0;color:#dc2626;font-family:monospace;font-size:12px;">{short_err}</td></tr>
  </table>
  <div style="margin-top:24px;padding:16px;background:#fef2f2;border-radius:8px;
              border-left:4px solid #dc2626;">
    <p style="margin:0;font-size:14px;">
      DeepSeek bakiyesini kontrol et:<br>
      <a href="https://platform.deepseek.com" style="color:#7c3aed;">
        platform.deepseek.com
      </a>
    </p>
  </div>
  <p style="margin-top:20px;font-size:12px;color:#9ca3af;">
    Bu uyarı en fazla saatte bir gönderilir.
  </p>
</div>
</body></html>"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "🚨 Lexify - AI servis hatası"
    msg["From"] = f"Lexify <{email_addr}>"
    msg["To"] = _ALERT_TO
    msg.attach(MIMEText(body, "html"))

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(email_addr, email_pass)
            server.send_message(msg)
    except Exception:
        pass
