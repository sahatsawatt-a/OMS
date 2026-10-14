// Stripe helpers for paying a table bill. The backend holds the secret key; the browser only
// gets the publishable key and a PaymentIntent client secret.
import { loadStripe, type Appearance, type Stripe } from '@stripe/stripe-js'
import { useEffect, useRef } from 'react'
import { api } from '../../lib/api'

export type PaymentConfig = { enabled: boolean; publishable_key: string }
export type CreatedIntent = { id: string; client_secret: string }
type IntentStatus = { id: string; status: string; amount: number; currency: string; session_token: string | null }

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

// Reuse the PaymentIntent for the same session and amount (reopening the sheet, StrictMode re-runs)
const intents = new Map<string, Promise<CreatedIntent>>()
export function createIntent(sessionToken: string, tableNumber: number, amount: number): Promise<CreatedIntent> {
  const key = `${sessionToken}:${amount}`
  let p = intents.get(key)
  if (!p) {
    p = api<CreatedIntent>('/payments/intents', {
      method: 'POST',
      body: JSON.stringify({ amount, table_number: tableNumber, session_token: sessionToken }),
    })
    p.catch(() => intents.delete(key))
    intents.set(key, p)
  }
  return p
}

/** Ask the backend (not the browser) whether a payment really succeeded for this session */
export async function verifyIntent(intentId: string, sessionToken: string): Promise<IntentStatus | null> {
  const intent = await api<IntentStatus>(`/payments/intents/${encodeURIComponent(intentId)}`)
  return intent.session_token === sessionToken ? intent : null
}

/**
 * Some payment methods redirect away and come back with ?payment_intent=…&redirect_status=…
 * Verify those on return, settle the bill if paid, and tidy the URL.
 */
export function useStripeRedirectReturn(sessionToken: string, onPaid: (amount: number) => void) {
  const handled = useRef(false)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const intentId = params.get('payment_intent')
    if (!intentId || handled.current) return
    handled.current = true
    verifyIntent(intentId, sessionToken)
      .then((intent) => {
        if (intent?.status === 'succeeded') onPaid(intent.amount)
      })
      .catch(() => undefined)
      .finally(() => {
        ;['payment_intent', 'payment_intent_client_secret', 'redirect_status'].forEach((k) => params.delete(k))
        window.history.replaceState(null, '', `${window.location.pathname}?${params}`)
      })
  }, [sessionToken, onPaid])
}
