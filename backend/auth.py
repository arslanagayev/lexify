from __future__ import annotations
import os
import smtplib
import secrets
from datetime import datetime, timezone, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

import bcrypt as _bcrypt
from jose import jwt

SECRET_KEY = os.getenv("JWT_SECRET", "lexify-dev-secret-change-in-production-32chars")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7
CODE_EXPIRE_MINUTES = 5          # 15 → 5


def hash_password(password: str) -> str:
    return _bcrypt.hashpw(password.encode(), _bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False


def create_access_token(user_id: int, email: str, username: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    payload = {"sub": str(user_id), "email": email, "username": username, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])


def generate_code() -> str:
    return str(secrets.randbelow(900000) + 100000)


def code_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(minutes=CODE_EXPIRE_MINUTES)


# ── Email sending ─────────────────────────────────────────────

def _send_mail(to_email: str, subject: str, html_body: str) -> None:
    email_addr = os.getenv("EMAIL_ADDRESS", "")
    email_pass = os.getenv("EMAIL_APP_PASSWORD", "")

    if not email_addr or not email_pass:
        import re
        code_match = re.search(r"\b(\d{6})\b", html_body)
        print(f"\n{'='*52}")
        print("LEXIFY EMAIL  (dev mode — SMTP not configured)")
        print(f"To:      {to_email}")
        print(f"Subject: {subject}")
        if code_match:
            print(f"Code:    {code_match.group(1)}")
        print(f"{'='*52}\n")
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = f"Lexify <{email_addr}>"
    msg["To"]      = to_email
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(email_addr, email_pass)
        server.send_message(msg)


# ── Shared template pieces ────────────────────────────────────

def _base_template(header_title: str, body_html: str) -> str:
    """
    Professional email shell — max 600px, inline CSS, table-based.
    Compatible with Gmail, Outlook, Apple Mail, mobile clients.
    """
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>{header_title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       style="background-color:#f4f4f7;padding:40px 20px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             style="max-width:600px;width:100%;">

        <!-- ── HEADER ── -->
        <tr>
          <td style="background:linear-gradient(135deg,#7c3aed 0%,#0891b2 100%);
                     border-radius:12px 12px 0 0;padding:36px 40px;text-align:center;">
            <span style="font-size:30px;font-weight:800;color:#ffffff;
                         letter-spacing:-0.5px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
              Lexify
            </span>
            <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.72);
                      letter-spacing:0.4px;">AI-Powered Vocabulary Learning</p>
          </td>
        </tr>

        <!-- ── BODY ── -->
        <tr>
          <td style="background:#ffffff;padding:48px 40px 40px;border-radius:0 0 12px 12px;
                     box-shadow:0 2px 8px rgba(0,0,0,0.06);">
            {body_html}
          </td>
        </tr>

        <!-- ── FOOTER ── -->
        <tr>
          <td style="padding:28px 40px 8px;text-align:center;">
            <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;">
              &copy; 2026 Lexify &middot; AI-Powered Vocabulary Learning
            </p>
            <p style="margin:0;font-size:12px;color:#c4c9d4;">
              lexifyvocab@gmail.com
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>"""


def _code_block(code: str) -> str:
    return f"""
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       style="margin:0 0 32px;">
  <tr>
    <td style="background:linear-gradient(135deg,#f5f3ff,#ecfeff);
               border:1px solid #ddd6fe;border-radius:12px;
               padding:32px 24px;text-align:center;">
      <p style="margin:0 0 14px;font-size:12px;font-weight:600;color:#7c3aed;
                text-transform:uppercase;letter-spacing:1.2px;">Your Code</p>
      <div style="font-size:42px;font-weight:800;letter-spacing:14px;
                  color:#1f2937;font-family:'Courier New',Courier,monospace;
                  padding-left:14px;">{code}</div>
    </td>
  </tr>
</table>"""


# ── Public API ────────────────────────────────────────────────

def send_verification_email(to_email: str, code: str, first_name: str = "") -> None:
    hi = f"Hi {first_name}," if first_name else "Hi,"

    body = f"""
<h1 style="margin:0 0 16px;font-size:26px;font-weight:700;color:#111827;letter-spacing:-0.3px;">
  Verify your email address
</h1>
<p style="margin:0 0 32px;font-size:16px;color:#6b7280;line-height:1.65;">
  {hi} thanks for signing up for Lexify! Use the code below to verify your email address.
</p>

{_code_block(code)}

<p style="margin:0 0 32px;font-size:14px;color:#9ca3af;text-align:center;">
  &#9203;&nbsp; This code will expire in <strong style="color:#6b7280;">5 minutes</strong>.
</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       style="margin:0 0 0;">
  <tr><td style="border-top:1px solid #f3f4f6;padding-top:24px;">
    <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
      If you didn't create a Lexify account, you can safely ignore this email.
    </p>
  </td></tr>
</table>"""

    html = _base_template("Verify your Lexify email", body)
    _send_mail(to_email, f"Verify your Lexify account — {code}", html)


def send_reset_email(to_email: str, code: str, first_name: str = "") -> None:
    hi = f"Hi {first_name}," if first_name else "Hi,"

    body = f"""
<h1 style="margin:0 0 16px;font-size:26px;font-weight:700;color:#111827;letter-spacing:-0.3px;">
  Reset your password
</h1>
<p style="margin:0 0 32px;font-size:16px;color:#6b7280;line-height:1.65;">
  {hi} we received a request to reset your Lexify password.
  Use the code below to set a new password.
</p>

{_code_block(code)}

<p style="margin:0 0 32px;font-size:14px;color:#9ca3af;text-align:center;">
  &#9203;&nbsp; This code will expire in <strong style="color:#6b7280;">5 minutes</strong>.
</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td style="border-top:1px solid #f3f4f6;padding-top:24px;">
    <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
      If you didn't request a password reset, you can safely ignore this email.
      Your password will not be changed.
    </p>
  </td></tr>
</table>"""

    html = _base_template("Reset your Lexify password", body)
    _send_mail(to_email, f"Reset your Lexify password — {code}", html)
