import stripe
from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel, Field

from app.core.config import get_settings

router = APIRouter(prefix="/payments", tags=["payments"])

# Stripe's minimum charge for AUD is $0.50; cap demo payments at $10,000
MIN_AMOUNT_CENTS = 50
MAX_AMOUNT_CENTS = 1_000_000


class PaymentConfig(BaseModel):
    enabled: bool
    publishable_key: str


class CreateIntentRequest(BaseModel):
    # Phase 1 demo: the bill total comes from the browser's mock data. Once orders live in
    # the database, the server must calculate the amount from the session instead.
    amount: int = Field(ge=MIN_AMOUNT_CENTS, le=MAX_AMOUNT_CENTS, description="Amount in cents")
    table_number: int = Field(ge=1)
    session_token: str = Field(min_length=8, max_length=64)


class IntentResponse(BaseModel):
    id: str
    client_secret: str


class IntentStatus(BaseModel):
    id: str
    status: str
    amount: int
    currency: str
    session_token: str | None


def _require_stripe() -> None:
    if not get_settings().stripe_secret_key:
        raise HTTPException(status_code=503, detail="Stripe is not configured")


@router.get("/config")
def payment_config() -> PaymentConfig:
    """Publishable key for Stripe.js; only enabled when both keys are set."""
    s = get_settings()
    enabled = bool(s.stripe_secret_key and s.stripe_publishable_key)
    publishable_key = s.stripe_publishable_key if enabled else ""
    return PaymentConfig(enabled=enabled, publishable_key=publishable_key)


@router.post("/intents")
def create_intent(body: CreateIntentRequest) -> IntentResponse:
    """Create a PaymentIntent for a table session's bill."""
    _require_stripe()
    try:
        intent = stripe.PaymentIntent.create(
            amount=body.amount,
            currency="aud",
            automatic_payment_methods={"enabled": True},
            description=f"Table {body.table_number} bill",
            metadata={"table_number": str(body.table_number), "session_token": body.session_token},
        )
    except stripe.StripeError as exc:
        raise HTTPException(status_code=502, detail=exc.user_message or "Stripe error") from exc
    return IntentResponse(id=intent.id, client_secret=intent.client_secret)


@router.get("/intents/{intent_id}")
def get_intent(intent_id: str) -> IntentStatus:
    """Server-side check of a payment's status, so the browser's word is not trusted."""
    _require_stripe()
    if not intent_id.startswith("pi_"):
        raise HTTPException(status_code=404, detail="Unknown payment")
    try:
        intent = stripe.PaymentIntent.retrieve(intent_id)
    except stripe.StripeError as exc:
        raise HTTPException(status_code=404, detail="Unknown payment") from exc
    return IntentStatus(
        id=intent.id,
        status=intent.status,
        amount=intent.amount,
        currency=intent.currency,
        session_token=(intent.metadata or {}).get("session_token"),
    )


@router.post("/webhook")
async def stripe_webhook(request: Request, stripe_signature: str = Header(...)) -> dict[str, bool]:
    """Receive Stripe events. Signature is verified before anything is trusted."""
    payload = await request.body()
    try:
        event = stripe.Webhook.construct_event(
            payload, stripe_signature, get_settings().stripe_webhook_secret
        )
    except (ValueError, stripe.SignatureVerificationError) as exc:
        raise HTTPException(status_code=400, detail="Invalid webhook") from exc

    # TODO: handle payment_intent.succeeded / payment_intent.payment_failed / charge.refunded
    _ = event["type"]
    return {"received": True}
