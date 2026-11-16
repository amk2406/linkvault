// Internal helpers — do not import from outside the identifiers/ folder.
const { randomBytes, randomUUID } = require('crypto');

// URL-safe random string of `bytes` random bytes (base64url, no padding)
function randomToken(bytes = 32) {
  return randomBytes(bytes).toString('base64url').slice(0, bytes);
}

function randomHex(bytes = 32) {
  return randomBytes(bytes).toString('hex').slice(0, 32);
}

// UUID v4
function uuid() {
  return randomUUID();
}

// Random alphanumeric string of given length (for human-facing codes)
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
function randomAlphanumeric(length = 16) {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

module.exports = { randomToken, uuid, randomAlphanumeric, randomHex };