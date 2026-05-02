import axios from 'axios';

const HS_BASE = 'https://api.hubapi.com';
const HS_AUTH = 'https://app.hubspot.com/oauth/authorize';
const TOKEN_URL = 'https://api.hubapi.com/oauth/v1/token';

export function buildAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.HUBSPOT_CLIENT_ID,
    redirect_uri: process.env.HUBSPOT_REDIRECT_URI,
    scope: 'crm.objects.contacts.read oauth',
    state,
  });
  return `${HS_AUTH}?${params.toString()}`;
}

export async function exchangeCode(code) {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: process.env.HUBSPOT_CLIENT_ID,
    client_secret: process.env.HUBSPOT_CLIENT_SECRET,
    redirect_uri: process.env.HUBSPOT_REDIRECT_URI,
    code,
  });

  const res = await axios.post(TOKEN_URL, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return res.data;
}

export async function doRefreshToken(refreshToken) {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: process.env.HUBSPOT_CLIENT_ID,
    client_secret: process.env.HUBSPOT_CLIENT_SECRET,
    refresh_token: refreshToken,
  });

  const res = await axios.post(TOKEN_URL, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return res.data;
}

export async function fetchContacts(accessToken, after = null) {
  const params = { limit: 25, properties: 'firstname,lastname,email' };
  if (after) params.after = after;

  const res = await axios.get(`${HS_BASE}/crm/v3/objects/contacts`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    params,
  });
  return res.data;
}
