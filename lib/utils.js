/**
 * Trim whitespace and title-case an address string.
 * @param {string} address - Raw address string from the database.
 * @returns {string} Title-cased address, e.g. "123 MAIN ST APT 4B" → "123 Main St Apt 4b"
 */
export function normalizeAddress(address) {
  if (!address || typeof address !== 'string') return address || ''
  return address
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}
