import stripe as stripe_lib
from fastapi import APIRouter, Depends, HTTPException, Request
from psycopg2.extras import RealDictCursor
from svix.webhooks import Webhook, WebhookVerificationError

from config import get_settings
from db import get_db

router = APIRouter()


@router.post("/clerk/webhook")
async def clerk_webhook(request: Request, db=Depends(get_db)):
    settings = get_settings()

    if not settings.clerk_webhook_signing_secret:
        raise HTTPException(status_code=503, detail="Clerk webhook not configured")

    payload = await request.body()
    headers = dict(request.headers)

    try:
        wh = Webhook(settings.clerk_webhook_signing_secret)
        event = wh.verify(payload, headers)
    except WebhookVerificationError:
        raise HTTPException(status_code=400, detail="Invalid Clerk webhook signature")

    if event.get("type") != "user.deleted":
        return {"received": True}

    clerk_user_id = event["data"].get("id")
    if not clerk_user_id:
        return {"received": True}

    cur = db.cursor(cursor_factory=RealDictCursor)
    cur.execute(
        "SELECT stripe_customer_id, subscription_status FROM users WHERE id = %s",
        (clerk_user_id,),
    )
    user_row = cur.fetchone()

    if user_row and user_row.get("stripe_customer_id"):
        stripe_key = settings.stripe_secret_key
        if stripe_key:
            stripe_lib.api_key = stripe_key
            customer_id = user_row["stripe_customer_id"]
            status = user_row.get("subscription_status", "")
            # Only cancel active/trialing subscriptions — lifetime is a one-time payment, nothing to cancel
            if status in ("active", "trialing", "past_due"):
                try:
                    subs = stripe_lib.Subscription.list(customer=customer_id, status="active", limit=10)
                    for sub in subs.auto_paging_iter():
                        stripe_lib.Subscription.cancel(sub.id)
                except Exception:
                    pass

    # Cascade deletes problems, decks, flashcards, reviews etc. via FK ON DELETE CASCADE
    cur.execute("DELETE FROM users WHERE id = %s", (clerk_user_id,))
    db.commit()

    return {"received": True}
