import { useEffect, useState } from 'react'
import { api } from './lib/api'
import './App.css'

type Health = { status: string; database: string }

function App() {
  const [health, setHealth] = useState<Health | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api<Health>('/health')
      .then(setHealth)
      .catch((e: Error) => setError(e.message))
  }, [])

  return (
    <main>
      <h1>Ordering Management System</h1>
      <p>
        API status:{' '}
        {error ? `unreachable (${error})` : health ? `${health.status}, database ${health.database}` : 'checking…'}
      </p>
    </main>
  )
}

export default App
