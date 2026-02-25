import asyncio
import json
import sys
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def run(coro):
    return asyncio.run(coro)


def test_webhook_uses_raw_body_and_signature_contract() -> None:
    content = Path("app/api/routes.py").read_text(encoding="utf-8")
    assert "@router.post(\"/api/v1/billing/webhook\")" in content
    assert "payload = await request.body()" in content
    assert "request.headers.get(\"stripe-signature\"" in content
    assert "request.json()" not in content


def test_checkin_and_analytics_freemium_contracts() -> None:
    content = Path("app/api/routes.py").read_text(encoding="utf-8")
    assert "checkin_limit:" in content
    assert '"daily_limit_reached"' in content
    assert "/api/v1/analytics/summary" in content
    assert '"premium_required"' in content


def test_users_model_and_migration_include_stripe_customer_id() -> None:
    model_content = Path("app/db/models.py").read_text(encoding="utf-8")
    migration_content = Path("alembic/versions/20260224_03_add_user_stripe_customer_id.py").read_text(encoding="utf-8")
    assert "stripe_customer_id" in model_content
    assert "uq_users_stripe_customer_id" in migration_content


def test_stripe_service_checkout_and_portal_with_mocked_client() -> None:
    from app.services.stripe_service import StripeService

    class FakeCheckoutSession:
        @staticmethod
        def create(**kwargs):
            assert kwargs["metadata"]["user_id"] == "user-123"
            return SimpleNamespace(url="https://checkout.example/session")

    class FakePortalSession:
        @staticmethod
        def create(**kwargs):
            assert kwargs["customer"] == "cus_123"
            return SimpleNamespace(url="https://billing.example/portal")

    class FakeCustomer:
        @staticmethod
        def create(**kwargs):
            assert kwargs["email"] == "u@example.com"
            return SimpleNamespace(id="cus_123")

    fake_client = SimpleNamespace(
        checkout=SimpleNamespace(Session=FakeCheckoutSession),
        billing_portal=SimpleNamespace(Session=FakePortalSession),
        Customer=FakeCustomer,
        Webhook=SimpleNamespace(construct_event=lambda payload, signature, secret: json.loads(payload.decode("utf-8"))),
    )

    service = StripeService(client=fake_client)
    user = SimpleNamespace(id="db-user", email="u@example.com", display_name="User", stripe_customer_id=None)

    customer_id = run(service.get_or_create_customer(user))
    assert customer_id == "cus_123"

    checkout_url = run(service.create_checkout_session("user-123", "echo_premium_monthly", customer_id))
    assert checkout_url.startswith("https://checkout.example")

    portal_url = run(service.create_portal_session(customer_id))
    assert portal_url.startswith("https://billing.example")


def test_webhook_idempotency_and_event_handling_contract() -> None:
    content = Path("app/api/routes.py").read_text(encoding="utf-8")
    assert 'stripe_event:{event_id}' in content
    assert 'event_type in {"customer.subscription.created", "invoice.payment_succeeded"}' in content
    assert 'elif event_type == "customer.subscription.deleted"' in content


def test_environment_and_compose_include_redis_and_stripe() -> None:
    env_content = Path(".env.example").read_text(encoding="utf-8")
    compose_content = Path("docker-compose.yml").read_text(encoding="utf-8")
    pyproject_content = Path("pyproject.toml").read_text(encoding="utf-8")

    assert "STRIPE_SECRET_KEY=" in env_content
    assert "STRIPE_WEBHOOK_SECRET=" in env_content
    assert "REDIS_URL=redis://localhost:6379" in env_content
    assert "redis:7-alpine" in compose_content
    assert "slowapi" in pyproject_content
    assert "redis>=5.0.8" in pyproject_content
