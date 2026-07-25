import hashlib
import hmac
import os
import resend
from config import get_settings


def _init():
    settings = get_settings()
    resend.api_key = settings.resend_api_key


def _unsubscribe_token(user_id: str, secret: str) -> str:
    return hmac.new(secret.encode(), f"unsub:{user_id}".encode(), hashlib.sha256).hexdigest()[:32]


def send_email(to: str, subject: str, html: str, reply_to: str | None = None):
    _init()
    params: dict = {
        "from": "Lock The Code <contact@lockthecode.net>",
        "to": [to],
        "subject": subject,
        "html": html,
    }
    if reply_to:
        params["reply_to"] = reply_to
    resend.Emails.send(params)


def send_welcome_email(email: str, first_name: str | None, user_id: str):
    settings = get_settings()
    name = first_name or "there"
    token = _unsubscribe_token(user_id, settings.notify_secret)
    unsub_url = f"{settings.frontend_url}/unsubscribe?uid={user_id}&t={token}"
    html_path = os.path.join(os.path.dirname(__file__), "emails", "welcome.html")
    with open(html_path) as f:
        html = (f.read()
                .replace("{first_name}", name)
                .replace("{unsub_url}", unsub_url))
    send_email(email, "Welcome to Lock The Code", html)
