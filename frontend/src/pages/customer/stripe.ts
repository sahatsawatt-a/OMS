// Stripe helpers for paying an order. The backend holds the secret key and prices the order;
// the browser only gets the publishable key and a PaymentIntent client secret.
// The "pure" entry only fetches Stripe.js when loadStripe() is first called (at checkout);
// the default entry injects it on every page and slows the first load by seconds
import { loadStripe } from '@stripe/stripe-js/pure'
import type { Appearance, Stripe } from '@stripe/stripe-js'
import { useEffect, useRef } from 'react'
import { api } from '../../lib/api'
import { guestActions } from '../../demo/store'
import type { Order } from '../../demo/types'

/** enabled: real Stripe (sandbox). simulated: demo without Stripe keys, no card is charged. */
export type PaymentConfig = { enabled: boolean; publishable_key: string; simulated: boolean }

export const stripeAppearance: Appearance = {
  theme: 'stripe',
  variables: {
    colorPrimary: '#1c1b19',
    colorText: '#1c1b19',
    colorDanger: '#9c2f2f',
    fontFamily: 'Inter, system-ui, sans-serif',
    borderRadius: '7px',
  },
}

let stripePromise: Promise<Stripe | null> | null = null
export function getStripe(publishableKey: string) {
  stripePromise ??= loadStripe(publishableKey)
  return stripePromise
}

export const fetchPaymentConfig = () => api<PaymentConfig>('/payments/config')

/**
 * Some payment methods redirect away and come back with ?payment_intent=…&redirect_status=…
 * Ask the server to confirm those on return, then tidy the URL.
 */
export function useStripeRedirectReturn(sessionToken: string, onPaid: (order: Order) => void) {
  const handled = useRef(false)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const intentId = params.get('payment_intent')
    if (!intentId || handled.current) return
    handled.current = true
    guestActions
      .confirmIntent(sessionToken, intentId)
      .then((res) => {
        if (res.status === 'succeeded') onPaid(res.order)
      })
      .catch(() => undefined)
      .finally(() => {
        ;['payment_intent', 'payment_intent_client_secret', 'redirect_status'].forEach((k) => params.delete(k))
        window.history.replaceState(null, '', `${window.location.pathname}?${params}`)
      })
  }, [sessionToken, onPaid])
}
