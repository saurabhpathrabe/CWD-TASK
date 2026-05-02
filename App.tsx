import { useEffect, useState } from 'react'
import { getConnectUrl, getContacts, Contact } from './api'

type Status = 'unknown' | 'connected' | 'error'

interface AppError {
  code: string
  message: string
}

export default function App() {
  const [status, setStatus] = useState<Status>('unknown')
  const [contacts, setContacts] = useState<Contact[] | null>(null)
  const [paging, setPaging] = useState<{ next?: { after: string } } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<AppError | null>(null)

  // Check URL params on load (after OAuth callback redirect)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('connected') === 'true') {
      setStatus('connected')
      window.history.replaceState({}, '', '/')
    } else if (params.get('error')) {
      setStatus('error')
      setError({ code: params.get('error')!, message: getErrorMessage(params.get('error')!) })
      window.history.replaceState({}, '', '/')
    }
  }, [])

  async function handleConnect() {
    setLoading(true)
    setError(null)
    try {
      const url = await getConnectUrl()
      window.location.href = url
    } catch {
      setError({ code: 'connect_failed', message: 'Could not start OAuth flow. Is the backend running?' })
      setLoading(false)
    }
  }

  async function handleGetContacts(after?: string) {
    setLoading(true)
    setError(null)
    try {
      const data = await getContacts(after)
      setContacts(data.results)
      setPaging(data.paging)
      setStatus('connected')
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string; status?: number }
      setError({
        code: e.code || 'fetch_failed',
        message: e.message || 'Failed to fetch contacts',
      })
      if (e.code === 'not_connected') setStatus('unknown')
    } finally {
      setLoading(false)
    }
  }

  function getErrorMessage(code: string): string {
    const map: Record<string, string> = {
      access_denied: 'You denied access to HubSpot.',
      token_exchange_failed: 'Token exchange failed. Try connecting again.',
      not_connected: 'Not connected to HubSpot. Click "Connect HubSpot" first.',
      refresh_failed: 'Token refresh failed. Please reconnect.',
      auth_failed: 'Authentication failed after refresh. Please reconnect.',
      rate_limited: 'Rate limited by HubSpot. Try again in a moment.',
    }
    return map[code] || 'An unexpected error occurred.'
  }

  return (
    <div style={{ fontFamily: 'monospace', maxWidth: 900, margin: '40px auto', padding: '0 20px' }}>
      <h1>CWA HubSpot Connector</h1>

      <div style={{ marginBottom: 16 }}>
        <strong>Status:</strong>{' '}
        <span style={{ color: status === 'connected' ? 'green' : status === 'error' ? 'red' : 'gray' }}>
          {status}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <button onClick={handleConnect} disabled={loading}>
          {loading && status === 'unknown' ? 'Redirecting...' : 'Connect HubSpot'}
        </button>

        <button onClick={() => handleGetContacts()} disabled={loading}>
          {loading ? 'Loading...' : 'Get Contacts'}
        </button>
      </div>

      {error && (
        <div style={{ background: '#fee', border: '1px solid #f88', padding: 12, marginBottom: 16 }}>
          <strong>Error [{error.code}]:</strong> {error.message}
        </div>
      )}

      {contacts && (
        <div>
          <h3>Contacts ({contacts.length})</h3>
          <pre style={{
            background: '#f4f4f4',
            padding: 16,
            overflow: 'auto',
            maxHeight: 500,
            fontSize: 13,
          }}>
            {JSON.stringify(contacts, null, 2)}
          </pre>

          {paging?.next?.after && (
            <button onClick={() => handleGetContacts(paging?.next?.after)} disabled={loading}>
              Load Next Page
            </button>
          )}
        </div>
      )}
    </div>
  )
}
