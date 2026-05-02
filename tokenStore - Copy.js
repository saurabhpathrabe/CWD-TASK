// In-memory token store with single-flight refresh per connection
const tokenStore = new Map();

// Single-flight refresh: stores an in-progress refresh Promise per connectionId
// so that if 10 concurrent /contacts calls hit an expired token,
// only one refresh actually runs — the rest await the same Promise.
const refreshInFlight = new Map();

export function saveTokens(connectionId, tokens) {
  tokenStore.set(connectionId, {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  });
}

export function getTokens(connectionId) {
  return tokenStore.get(connectionId) || null;
}

export function isExpired(connectionId) {
  const t = tokenStore.get(connectionId);
  if (!t) return true;
  return Date.now() >= t.expiresAt;
}

// Expose the raw store for the Loom demo (mutate expiresAt)
export { tokenStore };

export async function refreshTokens(connectionId, refreshFn) {
  // If a refresh is already in flight for this connection, wait for it
  if (refreshInFlight.has(connectionId)) {
    return refreshInFlight.get(connectionId);
  }

  const tokens = tokenStore.get(connectionId);
  if (!tokens) throw new Error('No tokens found for connection');

  // Create the refresh promise and store it BEFORE awaiting
  const refreshPromise = (async () => {
    try {
      const newTokens = await refreshFn(tokens.refreshToken);
      saveTokens(connectionId, newTokens);
      return newTokens;
    } finally {
      refreshInFlight.delete(connectionId);
    }
  })();

  refreshInFlight.set(connectionId, refreshPromise);
  return refreshPromise;
}
