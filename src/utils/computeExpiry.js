export default function computeExpiry(tokens = {}) {
  const { expiry_date, expires_in } = tokens;

  // If Google provided an absolute epoch (in ms) use it directly
  if (expiry_date) {
    return new Date(expiry_date);
  }

  // Otherwise, fall back to expires_in (seconds from now)
  if (typeof expires_in === 'number') {
    return new Date(Date.now() + expires_in * 1000);
  }

  // As a last resort, assume 1-hour lifetime so we at least have a sane Date
  return new Date(Date.now() + 60 * 60 * 1000);
}
