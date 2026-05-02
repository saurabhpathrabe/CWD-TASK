import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { generateState, validateState } from './state.js';
import { saveTokens, getTokens, isExpired, refreshTokens } from './tokenStore.js';
import { buildAuthUrl, exchangeCode, doRefreshToken, fetchContacts } from './hubspot.js';
import { requestLogger, log } from './logger.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Use a fixed connectionId for this single-user demo.
// In production this would be per-user session.
const CONNECTION_ID = 'default';

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());
app.use(requestLogger);

// GET /connect
// Returns the HubSpot OAuth authorize URL with HMAC-signed state
app.get('/connect', (req, res) => {
  const state = generateState();
  const authorizeUrl = buildAuthUrl(state);
  log('info', '/connect', { message: 'OAuth flow initiated' });
  res.json({ authorizeUrl });
});

// GET /callback
// Validates state, exchanges code for tokens, redirects to frontend
app.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    log('warn', '/callback', { message: 'OAuth denied by user', error });
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?error=access_denied`);
  }

  if (!validateState(state)) {
    log('warn', '/callback', { message: 'Invalid or tampered state parameter' });
    return res.status(400).json({ error: 'Invalid state' });
  }

  try {
    const tokens = await exchangeCode(code);
    saveTokens(CONNECTION_ID, tokens);
    log('info', '/callback', { message: 'Tokens exchanged and stored successfully' });
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?connected=true`);
  } catch (err) {
    log('error', '/callback', { message: 'Token exchange failed', status: err.response?.status });
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?error=token_exchange_failed`);
  }
});

// GET /contacts
// Returns first 25 HubSpot contacts. On 401: refresh once, retry. On second 401: clean error.
app.get('/contacts', async (req, res) => {
  const tokens = getTokens(CONNECTION_ID);

  if (!tokens) {
    log('warn', '/contacts', { message: 'No connection found' });
    return res.status(401).json({ error: 'not_connected', message: 'Connect HubSpot first.' });
  }

  // If token is expired, refresh before even trying
  if (isExpired(CONNECTION_ID)) {
    log('info', '/contacts', { message: 'Token expired before request, refreshing' });
    try {
      await refreshTokens(CONNECTION_ID, doRefreshToken);
    } catch (err) {
      log('error', '/contacts', { message: 'Proactive refresh failed' });
      return res.status(401).json({ error: 'refresh_failed', message: 'Token refresh failed. Please reconnect.' });
    }
  }

  // Attempt to fetch contacts
  const attempt = async (isRetry = false) => {
    const current = getTokens(CONNECTION_ID);
    try {
      const after = req.query.after || null;
      const data = await fetchContacts(current.accessToken, after);
      log('info', '/contacts', { message: 'Contacts fetched', count: data.results?.length, retry: isRetry });
      return res.json({
        results: data.results,
        paging: data.paging || null,
      });
    } catch (err) {
      const status = err.response?.status;

      if (status === 401 && !isRetry) {
        // Single-flight refresh
        log('info', '/contacts', { message: '401 received, attempting single-flight refresh' });
        try {
          await refreshTokens(CONNECTION_ID, doRefreshToken);
          return attempt(true); // retry once
        } catch (refreshErr) {
          log('error', '/contacts', { message: 'Refresh after 401 failed' });
          return res.status(401).json({ error: 'refresh_failed', message: 'Token refresh failed. Please reconnect.' });
        }
      }

      if (status === 401 && isRetry) {
        log('error', '/contacts', { message: 'Second 401 after refresh, giving up' });
        return res.status(401).json({ error: 'auth_failed', message: 'Authentication failed after refresh. Please reconnect.' });
      }

      if (status === 429) {
        log('warn', '/contacts', { message: 'Rate limited by HubSpot', partner_status: 429 });
        return res.status(429).json({ error: 'rate_limited', message: 'Rate limited. Try again shortly.' });
      }

      log('error', '/contacts', { message: 'Unexpected error fetching contacts', partner_status: status });
      return res.status(500).json({ error: 'fetch_failed', message: 'Failed to fetch contacts.' });
    }
  };

  return attempt();
});

// Health check
app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  log('info', 'server', { message: `Backend running on port ${PORT}` });
});
// DEBUG: expire token for Loom demo — remove before production
app.get('/debug/expire', (req, res) => {
  const tokens = getTokens(CONNECTION_ID);
  if (!tokens) return res.status(404).json({ error: 'No tokens found' });
  tokens.expiresAt = Date.now() - 1000;
  res.json({ message: 'Token expired', expiresAt: tokens.expiresAt });
});