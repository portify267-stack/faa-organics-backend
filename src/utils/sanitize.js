/**
 * Sanitization and regex escaping utilities for security hardening
 */

/**
 * Escapes special characters for safe regular expression querying in MongoDB.
 * Prevents ReDoS (Regular Expression Denial of Service) and query injection attacks.
 * @param {string} text
 * @returns {string} Sanitized string safe for new RegExp()
 */
const escapeRegex = (text) => {
  if (typeof text !== 'string') return '';
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Recursively strips object keys that start with '$' or contain '.' to prevent NoSQL query injection
 * @param {any} target
 * @returns {any} Sanitized target
 */
const sanitizeNoSql = (target) => {
  if (!target || typeof target !== 'object') {
    return target;
  }

  if (Array.isArray(target)) {
    return target.map(sanitizeNoSql);
  }

  const clean = {};
  for (const [key, value] of Object.entries(target)) {
    // Strip keys with MongoDB operators ($gt, $ne, $where, etc.) or dotted paths
    if (key.startsWith('$') || key.includes('.')) {
      continue;
    }
    clean[key] = sanitizeNoSql(value);
  }
  return clean;
};

module.exports = {
  escapeRegex,
  sanitizeNoSql,
};

