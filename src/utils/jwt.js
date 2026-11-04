const crypto = require('crypto');

let jsonwebtoken;
try {
  jsonwebtoken = require('jsonwebtoken');
} catch {
  jsonwebtoken = null;
}

const DEFAULT_SECRET =
  process.env.JWT_SECRET || 'faa_organic_super_secure_jwt_secret_key_2026_change_in_production';
const DEFAULT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';

/**
 * Parse expiration string (e.g. '1d', '24h', '3600s', '1h') to seconds
 */
const parseExpiresInSeconds = (expiresIn) => {
  if (typeof expiresIn === 'number') return expiresIn;
  if (!expiresIn || typeof expiresIn !== 'string') return 86400; // default 1 day

  const match = expiresIn.match(/^(-?\d+)([smhd])$/);
  if (!match) return 86400;

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 3600;
    case 'd':
      return value * 86400;
    default:
      return 86400;
  }
};

/**
 * Base64URL encode/decode helpers for fallback JWT implementation
 */
const base64UrlEncode = (str) =>
  Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

const base64UrlDecode = (str) => {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
};

/**
 * Generate a signed JWT token
 * @param {Object} payload - { id, email, role }
 * @param {Object} [options] - Optional custom secret or expiresIn
 * @returns {string} Signed JWT token
 */
const generateToken = (payload, options = {}) => {
  const secret = options.secret || process.env.JWT_SECRET || DEFAULT_SECRET;
  const expiresIn = options.expiresIn || process.env.JWT_EXPIRES_IN || DEFAULT_EXPIRES_IN;

  if (jsonwebtoken) {
    return jsonwebtoken.sign(payload, secret, { expiresIn });
  }

  // Built-in standard HMAC-SHA256 JWT generator fallback
  const header = { alg: 'HS256', typ: 'JWT' };
  const expSeconds = parseExpiresInSeconds(expiresIn);
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expSeconds,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const data = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${data}.${signature}`;
};

/**
 * Verify and decode a JWT token
 * @param {string} token - Bearer JWT token string
 * @param {Object} [options] - Optional secret
 * @returns {Object} Decoded payload
 * @throws {Error} If token is invalid or expired
 */
const verifyToken = (token, options = {}) => {
  const secret = options.secret || process.env.JWT_SECRET || DEFAULT_SECRET;

  if (jsonwebtoken) {
    return jsonwebtoken.verify(token, secret);
  }

  // Built-in standard HMAC-SHA256 JWT verifier fallback
  if (!token || typeof token !== 'string') {
    const err = new Error('jwt must be provided');
    err.name = 'JsonWebTokenError';
    throw err;
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    const err = new Error('jwt malformed');
    err.name = 'JsonWebTokenError';
    throw err;
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const data = `${encodedHeader}.${encodedPayload}`;

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  if (signature !== expectedSignature) {
    const err = new Error('invalid signature');
    err.name = 'JsonWebTokenError';
    throw err;
  }

  let decodedPayload;
  try {
    decodedPayload = JSON.parse(base64UrlDecode(encodedPayload));
  } catch {
    const err = new Error('invalid token payload');
    err.name = 'JsonWebTokenError';
    throw err;
  }

  const now = Math.floor(Date.now() / 1000);
  if (decodedPayload.exp && decodedPayload.exp < now) {
    const err = new Error('jwt expired');
    err.name = 'TokenExpiredError';
    err.expiredAt = new Date(decodedPayload.exp * 1000);
    throw err;
  }

  return decodedPayload;
};

module.exports = {
  generateToken,
  verifyToken,
};
