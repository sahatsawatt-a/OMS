import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { useEffect, useState } from 'react'
import { Icon } from '../../components/Icon'
import { Sheet } from '../../components/shared'
import { formatAUD } from '../../demo/money'
import {
  createIntent,
  fetchPaymentConfig,
  getStripe,
  stripeAppearance,
  verifyIntent,
  type CreatedIntent,
  type PaymentConfig,
} from './stripe'

type Props = {
  amount: number
  tableNumber: number
  sessionToken: string
  onClose: () => void
  onPaid: () => void
}

/** Real Stripe (sandbox) checkout when the backend has keys, otherwise a simulated one */
export default function PaySheet(props: Props) {
  const [config, setConfig] = useState<PaymentConfig | 'unavailable' | null>(null)

  useEffect(() => {
    fetchPaymentConfig()
      .then(setConfig)
      .catch(() => setConfig('unavailable'))
  }, [])

  if (config === null) {
    return (
      <Sheet title="Pay bill" onClose={props.onClose}>
        <p className="muted">Loading payment options…</p>
      </Sheet>
    )
  }
  if (config === 'unavailable' || !config.enabled) {
    return (
      <SimulatedPaySheet
        {...props}
        reason={config === 'unavailable' ? 'The payment server is not reachable.' : 'Stripe keys are not set on the server.'}
      />
    )
  }
  return <StripePaySheet {...props} publishableKey={config.publishable_key} />
}

function StripePaySheet({ publishableKey, ...props }: Props & { publishableKey: string }) {
  const { amount, tableNumber, sessionToken, onClose } = props
  const [intent, setIntent] = useState<CreatedIntent | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    createIntent(sessionToken, tableNumber, amount)
      .then((i) => active && setIntent(i))
      .catch((e: Error) => active && setError(e.message))
    return () => {
      active = false
    }
  }, [sessionToken, tableNumber, amount])

  if (error || !intent) {
    return (
      <Sheet title="Pay bill" onClose={onClose}>
        {error ? <p className="pay-error">Could not start the payment: {error}</p> : <p className="muted">Preparing secure payment…</p>}
      </Sheet>
    )
  }

  return (
    <Elements stripe={getStripe(publishableKey)} options={{ clientSecret: intent.client_secret, appearance: stripeAppearance }}>
      <StripeCheckout {...props} intentId={intent.id} />
    </Elements>
  )
}

function StripeCheckout({ amount, sessionToken, onClose, onPaid, intentId }: Props & { intentId: string }) {
  const stripe = useStripe()
  const elements = useElements()
  const [ready, setReady] = useState(false)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pay = async () => {
    if (!stripe || !elements) return
    setPaying(true)
    setError(null)
    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
      confirmParams: { return_url: window.location.href },
    })
    if (confirmError) {
      setError(confirmError.message ?? 'The payment did not go through.')
      setPaying(false)
      return
    }
    // Only trust the backend's view of the payment
    try {
      const verified = await verifyIntent(intentId, sessionToken)
      if (verified?.status === 'succeeded') {
        onPaid()
        return
      }
      setError(verified?.status === 'processing' ? 'Payment is processing. Please wait a moment.' : 'The payment was not completed.')
    } catch {
      setError('Could not confirm the payment with the server.')
    }
    setPaying(false)
  }

  return (
    <Sheet
      title="Pay bill"
      onClose={onClose}
      footer={
        <button className="btn btn-primary btn-block" disabled={!stripe || !ready || paying} onClick={pay}>
          {paying ? 'Processing…' : `Pay ${formatAUD(amount)}`}
        </button>
      }
    >
      <div className="pay-test-note">
        <strong>Stripe test mode.</strong> Use card <code>4242 4242 4242 4242</code>, any future expiry, any CVC.
      </div>
      <PaymentElement options={{ layout: 'tabs', paymentMethodOrder: ['card'] }} onReady={() => setReady(true)} />
      {error && <p className="pay-error">{error}</p>}
    </Sheet>
  )
}

function SimulatedPaySheet({ amount, onClose, onPaid, reason }: Props & { reason: string }) {
  const [paying, setPaying] = useState(false)

  const pay = () => {
    setPaying(true)
    setTimeout(onPaid, 1200)
  }

  return (
    <Sheet
      title="Pay bill"
      onClose={onClose}
      footer={
        <button className="btn btn-primary btn-block" disabled={paying} onClick={pay}>
          {paying ? 'Processing…' : `Pay ${formatAUD(amount)}`}
        </button>
      }
    >
      <p className="muted small">Simulated checkout: {reason} No card is charged.</p>
      <div className="pay-methods">
        <button className="active">
          <Icon name="card" /> Card
        </button>
      </div>
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
    </Sheet>
  )
}
