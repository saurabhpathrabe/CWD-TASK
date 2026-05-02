import crypto from 'crypto';

const SECRET = process.env.STATE_SECRET || 'fallback-secret-change-me';

export function generateState() {
  const nonce = crypto.randomBytes(16).toString('hex');
  const sig = sign(nonce);
  // state = nonce.signature — both base64url encoded
  return `${nonce}.${sig}`;
}

export function validateState(state) {
  if (!state || typeof state !== 'string') return false;
  const dotIdx = state.lastIndexOf('.');
  if (dotIdx === -1) return false;

  const nonce = state.slice(0, dotIdx);
  const receivedSig = state.slice(dotIdx + 1);
  const expectedSig = sign(nonce);

  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(receivedSig),
      Buffer.from(expectedSig)
    );
  } catch {
    return false;
  }
}

function sign(nonce) {
  return crypto
    .createHmac('sha256', SECRET)
    .update(nonce)
    .digest('hex');
}
