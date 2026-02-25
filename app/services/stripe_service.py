from __future__ import annotations

from typing import Any, Literal

try:
    from decouple import config
except ModuleNotFoundError:
    def config(key: str, default: str = "") -> str:
        import os

        return os.getenv(key, default)

Plan = Literal["echo_premium_monthly", "echo_premium_annual"]


class StripeService:
    def __init__(self, client: Any | None = None) -> None:
        if client is not None:
            self.client = client
        else:
            import stripe

            stripe.api_key = config("STRIPE_SECRET_KEY", default="")
            self.client = stripe

    async def create_checkout_session(self, user_id: str, plan: Plan, customer_id: str) -> str:
        session = self.client.checkout.Session.create(
            mode="subscription",
            customer=customer_id,
            line_items=[{"price_data": self._price_data(plan), "quantity": 1}],
            success_url=config("STRIPE_SUCCESS_URL", default="http://localhost:3000/success"),
            cancel_url=config("STRIPE_CANCEL_URL", default="http://localhost:3000/cancel"),
            metadata={"user_id": user_id},
        )
        return session.url

    async def create_portal_session(self, stripe_customer_id: str) -> str:
        session = self.client.billing_portal.Session.create(
            customer=stripe_customer_id,
            return_url=config("STRIPE_SUCCESS_URL", default="http://localhost:3000/settings"),
        )
        return session.url

    async def get_or_create_customer(self, user: Any) -> str:
        if getattr(user, "stripe_customer_id", None):
            return user.stripe_customer_id
        customer = self.client.Customer.create(
            email=user.email,
            name=getattr(user, "display_name", None),
            metadata={"user_id": str(user.id)},
        )
        return customer.id

    def construct_event(self, payload: bytes, signature: str, webhook_secret: str) -> dict[str, Any]:
        return self.client.Webhook.construct_event(payload, signature, webhook_secret)

    def _price_data(self, plan: Plan) -> dict[str, Any]:
        if plan == "echo_premium_annual":
            amount = 7999
            interval = "year"
        else:
            amount = 999
            interval = "month"
        return {
            "currency": "usd",
            "unit_amount": amount,
            "recurring": {"interval": interval},
            "product_data": {"name": plan},
        }
