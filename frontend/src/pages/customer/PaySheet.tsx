import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { Sheet } from '../../components/shared'
import { formatAUD, gstIncluded } from '../../demo/money'
import { guestActions, type StripeCheckout } from '../../demo/store'
import type { CartLine, Order } from '../../demo/types'
import { fetchPaymentConfig, getStripe, stripeAppearance, type PaymentConfig } from './stripe'

type Props = {
  lines: CartLine[]
  sessionToken: string
  onClose: () => void
  /** The order went through: paid on the phone, or waiting for payment at the counter */
  onPlaced: (order: Order) => void
}

type Checkout = { order: Order; payment: StripeCheckout }

/**
 * Pay first: guests pay for each order before it goes through.
 * On the phone with Stripe (or a simulated card when the server has no Stripe keys), or at the counter.
 * The server prices the order; the total shown here is the cart's, which matches unless the menu changed.
 */
export default function PaySheet({ lines, sessionToken, onClose, onPlaced }: Props) {
  const amount = lines.reduce((n, l) => n + l.unitPrice * l.quantity, 0)
  const [method, setMethod] = useState<'phone' | 'counter'>('phone')
  const [config, setConfig] = useState<PaymentConfig | 'unavailable' | null>(null)
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The order created for a phone payment, kept so a declined card can be retried on the same order
  const checkout = useRef<Checkout | null>(null)

  useEffect(() => {
    fetchPaymentConfig()
      .then(setConfig)
      .catch(() => setConfig('unavailable'))
  }, [])

  /** Create the order (once) for paying on the phone */
  const startCheckout = async (): Promise<Checkout> => {
    if (!checkout.current) {
      const res = await guestActions.placeOrder(sessionToken, lines, 'stripe')
      checkout.current = { order: res.order, payment: res.payment! }
    }
    return checkout.current
  }

  /** After the card went through: the server checks with Stripe before the order is placed */
  const confirm = async (orderId: string) => {
    const res = await guestActions.confirmPayment(sessionToken, orderId)
    if (res.status === 'succeeded') {
      checkout.current = null
      onPlaced(res.order)
      return null
    }
    return res.status === 'processing' ? 'Payment is processing. Please wait a moment.' : 'The payment was not completed.'
  }

  const close = () => {
    // Left without paying: drop the unpaid order
    if (checkout.current) void guestActions.abandon(sessionToken, checkout.current.order.id)
    onClose()
  }

  const payAtCounter = async () => {
    setPlacing(true)
    setError(null)
    try {
      const res = await guestActions.placeOrder(sessionToken, lines, 'counter')
      onPlaced(res.order)
    } catch (e) {
      setError((e as Error).message)
      setPlacing(false)
    }
  }

  const phoneUnavailable =
    config === 'unavailable' || (config !== null && !config.enabled && !config.simulated)
  const stripeKey = config && config !== 'unavailable' && config.enabled ? config.publishable_key : null

  return (
    <Sheet
      title="Checkout"
      onClose={close}
      footer={
        method === 'counter' ? (
          <button className="btn btn-primary btn-block" disabled={placing} onClick={payAtCounter}>
            {placing ? 'Placing order…' : `Place order · pay ${formatAUD(amount)} at counter`}
          </button>
        ) : undefined
      }
    >
      <ul className="line-list checkout-lines">
        {lines.map((l) => (
          <li key={l.id} className="line">
            <div className="grow">
              <div className="line-name">
                {l.quantity} × {l.name}
              </div>
              {l.options.length > 0 && <div className="muted small">{l.options.map((o) => o.choiceName).join(', ')}</div>}
            </div>
            <span className="small">{formatAUD(l.unitPrice * l.quantity)}</span>
          </li>
        ))}
      </ul>
      <div className="row between total checkout-total">
        <span>Total</span>
        <span>{formatAUD(amount)}</span>
      </div>
      <div className="muted small">Includes GST {formatAUD(gstIncluded(amount))}</div>

      <div className="pay-methods" role="radiogroup" aria-label="How would you like to pay?">
        <button role="radio" aria-checked={method === 'phone'} className={method === 'phone' ? 'active' : ''} onClick={() => setMethod('phone')}>
          <Icon name="phone" /> Pay on phone
        </button>
        <button role="radio" aria-checked={method === 'counter'} className={method === 'counter' ? 'active' : ''} onClick={() => setMethod('counter')}>
          <Icon name="cash" /> Pay at counter
        </button>
      </div>

      {error && <p className="pay-error">{error}</p>}

      {method === 'counter' ? (
        <p className="muted small pay-counter-note">
          Your order goes to the kitchen once you have paid at the counter by card or cash. You&apos;ll get an order number to
          show our staff.
        </p>
      ) : config === null ? (
        <p className="muted">Loading payment options…</p>
      ) : phoneUnavailable ? (
        <p className="muted small pay-counter-note">Paying on the phone isn&apos;t available right now. Please choose Pay at counter.</p>
      ) : stripeKey ? (
        <Elements
          stripe={getStripe(stripeKey)}
          options={{ mode: 'payment', amount, currency: 'aud', appearance: stripeAppearance }}
        >
          <StripeForm amount={amount} startCheckout={startCheckout} confirm={confirm} />
        </Elements>
      ) : (
        <SimulatedPayment amount={amount} startCheckout={startCheckout} confirm={confirm} />
      )}
    </Sheet>
  )
}

type PayProps = {
  amount: number
  startCheckout: () => Promise<Checkout>
  confirm: (orderId: string) => Promise<string | null>
}

function StripeForm({ amount, startCheckout, confirm }: PayProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [ready, setReady] = useState(false)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pay = async () => {
    if (!stripe || !elements) return
    setPaying(true)
    setError(null)
    try {
      // Check the card details first, then create the order and its payment on the server
      const { error: formError } = await elements.submit()
      if (formError) throw new Error(formError.message ?? 'Please check your card details.')
      const { order, payment } = await startCheckout()
      const { error: confirmError } = await stripe.confirmPayment({
        elements,
        clientSecret: payment.clientSecret!,
        redirect: 'if_required',
        confirmParams: { return_url: window.location.href },
      })
      if (confirmError) throw new Error(confirmError.message ?? 'The payment did not go through.')
      // Only trust the server's view of the payment
      const problem = await confirm(order.id)
      if (problem) throw new Error(problem)
    } catch (e) {
      setError((e as Error).message)
      setPaying(false)
    }
  }

  return (
    // The id gives automated checks a stable way to reach Stripe's card form
    <div className="pay-phone" id="stripe-payment">
      <div className="pay-test-note">
        <strong>Stripe test mode.</strong> Use card <code>4242 4242 4242 4242</code>, any future expiry, any CVC.
      </div>
      <PaymentElement options={{ layout: 'tabs' }} onReady={() => setReady(true)} />
      {error && <p className="pay-error">{error}</p>}
      <button className="btn btn-primary btn-block pay-submit" disabled={!stripe || !ready || paying} onClick={pay}>
        {paying ? 'Processing…' : `Pay ${formatAUD(amount)} and send order`}
      </button>
    </div>
  )
}

function SimulatedPayment({ amount, startCheckout, confirm }: PayProps) {
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pay = async () => {
    setPaying(true)
    setError(null)
    try {
      const { order } = await startCheckout()
      const problem = await confirm(order.id)
      if (problem) throw new Error(problem)
    } catch (e) {
      setError((e as Error).message)
      setPaying(false)
    }
  }

  return (
    <div className="pay-phone">
      <p className="muted small">Simulated checkout: Stripe keys are not set on the server. No card is charged.</p>
      <div className="fake-card">
        <label className="field">
          <span>Card number</span>
          <input defaultValue="4242 4242 4242 4242" inputMode="numeric" />
        </label>
        <div className="row gap">
          <label className="field grow">
            <span>Expiry</span>
            <input defaultValue="12 / 30" />
          </label>
          <label className="field grow">
            <span>CVC</span>
            <input defaultValue="123" inputMode="numeric" />
          </label>
        </div>
      </div>
      {error && <p className="pay-error">{error}</p>}
      <button className="btn btn-primary btn-block pay-submit" disabled={paying} onClick={pay}>
        {paying ? 'Processing…' : `Pay ${formatAUD(amount)} and send order`}
      </button>
    </div>
  )
}
