import stripe
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
    cur.execute("SELECT stripe_customer_id FROM users WHERE id = %s", (user["id"],))
    row = cur.fetchone()
    customer_id = row["stripe_customer_id"] if row else None

    session_params: dict = {
        "line_items": [{"price": price_id, "quantity": 1}],
        "mode": "payment" if is_lifetime else "subscription",
        "success_url": f"{settings.frontend_url}/dashboard?upgrade=success",
        "cancel_url": f"{settings.frontend_url}/",
        "metadata": {"clerk_user_id": user["id"]},
    }

    if plan == "trial":
        session_params["subscription_data"] = {
            "trial_settings": {"end_behavior": {"missing_payment_method": "cancel"}},
            "metadata": {"clerk_user_id": user["id"]},
        }

    if customer_id:
        session_params["customer"] = customer_id
    elif is_lifetime:
        # customer_creation is only valid in payment mode
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
        clerk_user_id = getattr(session.metadata, "clerk_user_id", None)
        customer_id = session.customer
        if clerk_user_id:
            cur.execute(
                "UPDATE users SET is_pro = true, stripe_customer_id = %s, subscription_status = 'active' "
                "WHERE id = %s",
                (customer_id, clerk_user_id),
            )
            db.commit()

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
            "UPDATE users SET is_pro = false, subscription_status = 'canceled' "
            "WHERE stripe_customer_id = %s",
            (customer_id,),
        )
        db.commit()

    return {"received": True}
