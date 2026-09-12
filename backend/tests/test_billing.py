from types import SimpleNamespace

import stripe
import stripe_routes


def test_webhook_rejects_invalid_signature(client, monkeypatch):
    settings = SimpleNamespace(
        stripe_secret_key="sk_test_fake",
        stripe_webhook_secret="whsec_test_fake",
        resend_api_key=None,
    )

    monkeypatch.setattr(
        stripe_routes,
        "get_settings",
        lambda: settings,
    )

    monkeypatch.setattr(
        stripe_routes,
        "get_stripe",
        lambda: stripe_routes.stripe,
    )

    def reject_signature(*args, **kwargs):
        raise stripe.SignatureVerificationError(
            "Invalid signature",
            "bad_signature",
        )

    monkeypatch.setattr(
        stripe.Webhook,
        "construct_event",
        reject_signature,
    )

    response = client.post(
        "/webhook",
        content=b'{"type": "checkout.session.completed"}',
        headers={"stripe-signature": "bad_signature"},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid Stripe signature"

class FakeCheckoutSession:
    metadata = {
        "clerk_user_id": "test_user_123",
        "plan": "monthly",
    }
    customer = "cus_test_123"

    def get(self, key, default=None):
        values = {
            "customer_details": {
                "email": "billing@example.com",
            }
        }
        return values.get(key, default)


def test_checkout_completed_activates_pro(client, db, monkeypatch):
    settings = SimpleNamespace(
        stripe_secret_key="sk_test_fake",
        stripe_webhook_secret="whsec_test_fake",
        resend_api_key=None,
    )

    event = {
        "type": "checkout.session.completed",
        "data": {
            "object": FakeCheckoutSession(),
        },
    }

    monkeypatch.setattr(
        stripe_routes,
        "get_settings",
        lambda: settings,
    )

    monkeypatch.setattr(
        stripe_routes,
        "get_stripe",
        lambda: stripe_routes.stripe,
    )

    monkeypatch.setattr(
        stripe.Webhook,
        "construct_event",
        lambda *args, **kwargs: event,
    )

    response = client.post(
        "/webhook",
        content=b'{"type": "checkout.session.completed"}',
        headers={"stripe-signature": "valid_signature"},
    )

    assert response.status_code == 200
    assert response.json() == {"received": True}

    cursor = db.cursor()
    cursor.execute(
        """
        SELECT is_pro, stripe_customer_id, subscription_status
        FROM users
        WHERE id = %s
        """,
        ("test_user_123",),
    )
    user = cursor.fetchone()

    assert user == (True, "cus_test_123", "active")

# cancelling a subscription removes PRO access

class FakeSubscription:
    customer = "cus_test_123"


def test_subscription_deleted_removes_pro_access(client, db, monkeypatch):
    cursor = db.cursor()
    cursor.execute(
        """
        UPDATE users
        SET is_pro = true,
            stripe_customer_id = %s,
            subscription_status = 'active'
        WHERE id = %s
        """,
        ("cus_test_123", "test_user_123"),
    )
    db.commit()

    settings = SimpleNamespace(
        stripe_secret_key="sk_test_fake",
        stripe_webhook_secret="whsec_test_fake",
        resend_api_key=None,
    )

    event = {
        "type": "customer.subscription.deleted",
        "data": {
            "object": FakeSubscription(),
        },
    }

    monkeypatch.setattr(
        stripe_routes,
        "get_settings",
        lambda: settings,
    )

    monkeypatch.setattr(
        stripe_routes,
        "get_stripe",
        lambda: stripe_routes.stripe,
    )

    monkeypatch.setattr(
        stripe.Webhook,
        "construct_event",
        lambda *args, **kwargs: event,
    )

    response = client.post(
        "/webhook",
        content=b'{"type": "customer.subscription.deleted"}',
        headers={"stripe-signature": "valid_signature"},
    )

    assert response.status_code == 200
    assert response.json() == {"received": True}

    cursor.execute(
        """
        SELECT is_pro, subscription_status
        FROM users
        WHERE id = %s
        """,
        ("test_user_123",),
    )
    user = cursor.fetchone()

    assert user == (False, "canceled")

# Payment failure

def test_payment_failed_removes_pro_access(client, db, monkeypatch):
    cursor = db.cursor()
    cursor.execute(
        """
        UPDATE users
        SET is_pro = true,
            stripe_customer_id = %s,
            subscription_status = 'active'
        WHERE id = %s
        """,
        ("cus_test_123", "test_user_123"),
    )
    db.commit()

    settings = SimpleNamespace(
        stripe_secret_key="sk_test_fake",
        stripe_webhook_secret="whsec_test_fake",
        resend_api_key=None,
    )

    event = {
        "type": "invoice.payment_failed",
        "data": {
            "object": FakeSubscription(),
        },
    }

    monkeypatch.setattr(
        stripe_routes,
        "get_settings",
        lambda: settings,
    )

    monkeypatch.setattr(
        stripe_routes,
        "get_stripe",
        lambda: stripe_routes.stripe,
    )

    monkeypatch.setattr(
        stripe.Webhook,
        "construct_event",
        lambda *args, **kwargs: event,
    )

    response = client.post(
        "/webhook",
        content=b'{"type": "invoice.payment_failed"}',
        headers={"stripe-signature": "valid_signature"},
    )

    assert response.status_code == 200
    assert response.json() == {"received": True}

    cursor.execute(
        """
        SELECT is_pro, subscription_status
        FROM users
        WHERE id = %s
        """,
        ("test_user_123",),
    )
    user = cursor.fetchone()

    assert user == (False, "canceled")