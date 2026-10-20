import logging

import stripe
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db
from app.models import Order
from app.services.orders import check_intent_matches, mark_paid

log = logging.getLogger(__name__)

router = APIRouter(prefix="/payments", tags=["payments"])


class PaymentConfig(BaseModel):
    enabled: bool
    publishable_key: str
    # Demo without Stripe keys: the checkout shows a simulated card form
    simulated: bool


@router.get("/config")
def payment_config() -> PaymentConfig:
    """Publishable key for Stripe.js; only enabled when both keys are set."""
    s = get_settings()
    return PaymentConfig(
        enabled=s.stripe_enabled,
        publishable_key=s.stripe_publishable_key if s.stripe_enabled else "",
        simulated=not s.stripe_enabled and s.demo_mode,
    )


@router.post("/webhook")
async def stripe_webhook(
    request: Request, stripe_signature: str = Header(...), db: Session = Depends(get_db)
) -> dict[str, bool]:
    """Receive Stripe events. Signature is verified before anything is trusted."""
    secret = get_settings().stripe_webhook_secret
    if not secret:
        raise HTTPException(status_code=503, detail="Webhook secret is not configured")
    payload = await request.body()
    try:
        event = stripe.Webhook.construct_event(payload, stripe_signature, secret)
    except (ValueError, stripe.SignatureVerificationError) as exc:
        raise HTTPException(status_code=400, detail="Invalid webhook") from exc

    if event["type"] == "payment_intent.succeeded":
        intent = event["data"]["object"]
        order = db.scalars(
            select(Order).where(Order.stripe_intent_id == intent["id"]).with_for_update()
        ).first()
        if order is None:
            # Not ours (e.g. another app on the same Stripe account)
            log.info("Webhook for unknown PaymentIntent %s", intent["id"])
        else:
            check_intent_matches(order, intent)
            mark_paid(db, order, "stripe")
            db.commit()
    # payment_failed needs nothing: the guest can retry with the same order, or abandon it
    return {"received": True}
