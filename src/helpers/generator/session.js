const { uuid , randomToken } = require('./random');

// Prefixed session ID: sess_<uuid>
module.exports.sessionId = function sessionId() {
  return `sess_${uuid()}`;
};

// Opaque, URL-safe session token (default 32 bytes → ~43 chars base64url)
module.exports.sessionToken = function sessionToken(bytes = 32) {
  return randomToken(bytes);
};