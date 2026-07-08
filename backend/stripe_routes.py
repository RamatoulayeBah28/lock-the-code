import stripe
import requests
import resend
from fastapi import APIRouter, Depends, HTTPException, Request
from psycopg2.extras import RealDictCursor

from auth import get_current_user
from config import get_settings
from db import get_db

router = APIRouter()


def get_stripe():
    key = get_settings().stripe_secret_key
    if not key:
        raise HTTPException(status_code=503, detail="Stripe not configured in this environment")
    stripe.api_key = key
    return stripe


def _get_user_email(clerk_user_id: str, settings, cur=None) -> str | None:
    """Return the user's email. Checks DB first (clerk_email/stripe_email),
    falls back to Clerk API only when both columns are empty."""
    if cur is not None:
        try:
            cur.execute(
                "SELECT clerk_email, stripe_email FROM users WHERE id = %s",
                (clerk_user_id,),
            )
            row = cur.fetchone()
            if row:
                email = row.get("clerk_email") or row.get("stripe_email")
                if email:
                    return email
        except Exception:
            pass

    try:
        res = requests.get(
            f"https://api.clerk.com/v1/users/{clerk_user_id}",
            headers={"Authorization": f"Bearer {settings.clerk_secret_key}"},
            timeout=5,
        )
        if res.ok:
            addresses = res.json().get("email_addresses", [])
            if addresses:
                return addresses[0]["email_address"]
    except Exception:
        pass
    return None


def _send_welcome_email(email: str, settings):
    resend.api_key = settings.resend_api_key
    resend.Emails.send({
        "from": "Lock The Code <contact@lockthecode.net>",
        "to": [email],
        "subject": "Welcome to Lock The Code Pro!",
        "html": """
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#ffffff;">
  <img src="https://lockthecode.net/lock-the-code-fav.png" alt="Lock The Code" style="height:40px;width:auto;margin-bottom:24px;" />
  <h1 style="font-size:24px;font-weight:700;color:#313628;margin:0 0 8px;">Welcome to Lock The Code Pro!</h1>
  <p style="color:#6b7280;font-size:15px;margin:0 0 24px;">
    Thank you for subscribing. Here's what you just unlocked:
  </p>

  <div style="background:#fafafa;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin:0 0 24px;">
    <div style="margin-bottom:14px;">
      <p style="font-weight:600;color:#313628;margin:0 0 2px;font-size:15px;">AI Tutor</p>
      <p style="color:#6b7280;font-size:13px;margin:0;">Socratic hints that guide your thinking without spoiling the answer.</p>
    </div>
    <div style="margin-bottom:14px;">
      <p style="font-weight:600;color:#313628;margin:0 0 2px;font-size:15px;">Interview Simulator</p>
      <p style="color:#6b7280;font-size:13px;margin:0;">Realistic mock interviews with follow-ups and performance grading.</p>
    </div>
    <div>
      <p style="font-weight:600;color:#313628;margin:0 0 2px;font-size:15px;">Algorithm Flashcards</p>
      <p style="color:#6b7280;font-size:13px;margin:0;">Spaced repetition for sliding window, two pointers, DP, and more.</p>
    </div>
  </div>

  <a href="https://lockthecode.net"
     style="display:inline-block;background:#a20021;color:#ffffff;font-weight:600;font-size:15px;text-decoration:none;padding:12px 28px;border-radius:9999px;margin-bottom:24px;">
    Start Practicing &rarr;
  </a>

  <p style="color:#9ca3af;font-size:13px;margin:0;">
    You can cancel anytime from <strong>Billing</strong> in your account settings — no questions asked.
  </p>

  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 20px;" />
  <div style="text-align:center;">
    <img src="https://lockthecode.net/lock-the-code-logo.png" alt="Lock The Code" style="height:32px;width:auto;opacity:0.5;" />
    <p style="color:#d1d5db;font-size:11px;margin:6px 0 0;">Lock The Code &middot; lockthecode.net</p>
  </div>
</div>
""",
    })


def _send_cancellation_email(email: str, settings):
    resend.api_key = settings.resend_api_key
    resend.Emails.send({
        "from": "Lock The Code <contact@lockthecode.net>",
        "to": [email],
        "subject": "Your Lock The Code Pro subscription has been cancelled",
        "html": """
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#ffffff;">
  <img src="https://lockthecode.net/lock-the-code-fav.png" alt="Lock The Code" style="height:40px;width:auto;margin-bottom:24px;" />
  <h1 style="font-size:22px;font-weight:700;color:#313628;margin:0 0 8px;">Your Pro subscription has been cancelled</h1>
  <p style="color:#6b7280;font-size:15px;margin:0 0 20px;">
    Your Pro access continues until the end of your current billing period.
    After that you'll be on the free plan, and all your problem history and review data will still be there.
  </p>

  <p style="color:#313628;font-size:15px;font-weight:500;margin:0 0 12px;">We'd love to know what we could improve.</p>
  <a href="mailto:contact@lockthecode.net?subject=Cancellation%20Feedback"
     style="display:inline-block;background:#313628;color:#ffffff;font-weight:600;font-size:14px;text-decoration:none;padding:10px 24px;border-radius:9999px;margin-bottom:24px;">
    Share your feedback &rarr;
  </a>

  <p style="color:#9ca3af;font-size:13px;margin:0;">
    You can resubscribe anytime from <strong>Billing</strong> in your account settings.
  </p>

  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 20px;" />
  <div style="text-align:center;">
    <img src="https://lockthecode.net/lock-the-code-logo.png" alt="Lock The Code" style="height:32px;width:auto;opacity:0.5;" />
    <p style="color:#d1d5db;font-size:11px;margin:6px 0 0;">Lock The Code &middot; lockthecode.net</p>
  </div>
</div>
""",
    })


# ---------------------------------------------------------------------------
# POST /checkout  — create a Stripe Checkout session and return the URL
# ---------------------------------------------------------------------------

PRICE_MAP = {
    "trial":    lambda s: s.stripe_price_trial,
    "monthly":  lambda s: s.stripe_price_monthly,
    "annual":   lambda s: s.stripe_price_annual,
    "lifetime": lambda s: s.stripe_price_lifetime,
}

@router.post("/checkout")
def create_checkout_session(
    body: dict,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    settings = get_settings()
    get_stripe()

    plan = body.get("plan", "trial")
    if plan not in PRICE_MAP:
        raise HTTPException(status_code=400, detail=f"Unknown plan: {plan}")

    price_id = PRICE_MAP[plan](settings)
    is_lifetime = plan == "lifetime"

    cur = db.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT stripe_customer_id, trial_used FROM users WHERE id = %s", (user["id"],))
    row = cur.fetchone()
    customer_id = row["stripe_customer_id"] if row else None

    if plan == "trial" and row and row["trial_used"]:
        raise HTTPException(status_code=400, detail="Free trial already used. Choose a monthly, annual, or lifetime plan.")

    session_params: dict = {
        "line_items": [{"price": price_id, "quantity": 1}],
        "mode": "payment" if is_lifetime else "subscription",
        "success_url": f"{settings.frontend_url}/dashboard?upgrade=success",
        "cancel_url": f"{settings.frontend_url}/",
        "metadata": {"clerk_user_id": user["id"], "plan": plan},
    }

    if plan == "trial":
        session_params["subscription_data"] = {
            "trial_settings": {"end_behavior": {"missing_payment_method": "cancel"}},
            "metadata": {"clerk_user_id": user["id"], "plan": plan},
        }

    if customer_id:
        session_params["customer"] = customer_id
    elif is_lifetime:
        session_params["customer_creation"] = "always"

    session = stripe.checkout.Session.create(**session_params)
    return {"url": session.url}


# ---------------------------------------------------------------------------
# POST /billing/portal  — create a Stripe Customer Portal session
# ---------------------------------------------------------------------------

@router.post("/billing/portal")
def create_billing_portal(user=Depends(get_current_user), db=Depends(get_db)):
    settings = get_settings()
    get_stripe()

    cur = db.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT stripe_customer_id FROM users WHERE id = %s", (user["id"],))
    row = cur.fetchone()
    customer_id = row["stripe_customer_id"] if row else None

    if not customer_id:
        raise HTTPException(status_code=400, detail="No billing account found. Upgrade to Pro first.")

    try:
        portal = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=f"{settings.frontend_url}/dashboard",
        )
    except stripe.StripeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {"url": portal.url}


# ---------------------------------------------------------------------------
# POST /webhook  — handle Stripe events
# ---------------------------------------------------------------------------

@router.post("/webhook")
async def stripe_webhook(request: Request, db=Depends(get_db)):
    settings = get_settings()
    get_stripe()

    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig, settings.stripe_webhook_secret
        )
    except stripe.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid Stripe signature")

    cur = db.cursor(cursor_factory=RealDictCursor)

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        clerk_user_id = (session.metadata or {}).get("clerk_user_id")
        plan = (session.metadata or {}).get("plan", "")
        customer_id = session.customer
        db_status = "trialing" if plan == "trial" else "active"

        customer_details = session.get("customer_details") or {}
        stripe_email = customer_details.get("email")

        if clerk_user_id:
            if plan == "trial":
                cur.execute(
                    "UPDATE users SET is_pro = true, stripe_customer_id = %s, stripe_email = %s, "
                    "subscription_status = %s, trial_used = true WHERE id = %s",
                    (customer_id, stripe_email, db_status, clerk_user_id),
                )
            else:
                cur.execute(
                    "UPDATE users SET is_pro = true, stripe_customer_id = %s, stripe_email = %s, "
                    "subscription_status = %s WHERE id = %s",
                    (customer_id, stripe_email, db_status, clerk_user_id),
                )
            db.commit()

            # For the welcome email prefer stripe_email (the billing address the user just
            # entered) and fall back to clerk_email if stripe didn't capture one.
            if settings.resend_api_key:
                try:
                    welcome_email = _get_user_email(clerk_user_id, settings, cur=cur)
                    if welcome_email:
                        _send_welcome_email(welcome_email, settings)
                except Exception:
                    pass

    elif event["type"] in ("customer.subscription.updated",):
        sub = event["data"]["object"]
        customer_id = sub.customer
        status = sub.status
        is_pro = status in ("trialing", "active")
        cur.execute(
            "UPDATE users SET is_pro = %s, subscription_status = %s "
            "WHERE stripe_customer_id = %s",
            (is_pro, status, customer_id),
        )
        db.commit()

    elif event["type"] in ("customer.subscription.deleted", "invoice.payment_failed"):
        obj = event["data"]["object"]
        customer_id = obj.customer
        cur.execute(
            "SELECT id, clerk_email, stripe_email FROM users WHERE stripe_customer_id = %s",
            (customer_id,),
        )
        user_row = cur.fetchone()
        cur.execute(
            "UPDATE users SET is_pro = false, subscription_status = 'canceled' "
            "WHERE stripe_customer_id = %s",
            (customer_id,),
        )
        db.commit()

        if user_row and settings.resend_api_key and event["type"] == "customer.subscription.deleted":
            try:
                # Use clerk_email (login email) for account notifications — it may
                # differ from stripe_email (billing email) so we prefer the one the
                # user actually checks for their account.
                cancel_email = user_row.get("clerk_email") or user_row.get("stripe_email")
                if cancel_email:
                    _send_cancellation_email(cancel_email, settings)
            except Exception:
                pass

    return {"received": True}
