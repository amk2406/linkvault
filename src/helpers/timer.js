function getRetrySeconds(value, fallback = 300) {
  if (!value) return fallback;

  // Retry-After can be a number of seconds.
  const seconds = Number(value);

  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.ceil(seconds);
  }

  // Or it can be an HTTP date.
  const date = Date.parse(value);

  if (!Number.isNaN(date)) {
    return Math.max(1, Math.ceil((date - Date.now()) / 1000));
  }

  return fallback;
}


module.exports = {
    getRetrySeconds
}