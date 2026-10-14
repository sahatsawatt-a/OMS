import stripe
from fastapi import APIRouter, Header, HTTPException, Request

from app.core.config import get_settings

router = APIRouter(prefix="/payments", tags=["payments"])


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
