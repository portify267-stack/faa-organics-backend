/**
 * In-memory sliding window rate limiter
 * Protects against brute-force attacks, credential stuffing, and DoS without external dependencies
 */

const createRateLimiter = (options = {}) => {
  const windowMs = options.windowMs || 15 * 60 * 1000; // default: 15 minutes
  const maxAttempts = options.maxAttempts || 100;
  const message =
    options.message ||
    `Too many requests from this IP. Please try again after ${Math.ceil(
      windowMs / 60000
    )} minutes.`;

  const requestMap = new Map();

  // Periodic garbage collection every 10 minutes to prevent memory leak
  setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of requestMap.entries()) {
      if (now - record.firstAttemptTime > windowMs) {
        requestMap.delete(ip);
      }
    }
  }, 10 * 60 * 1000).unref();

  return (req, res, next) => {
    const ip =
      req.headers['x-forwarded-for']?.split(',')[0].trim() ||
      req.socket.remoteAddress ||
      'unknown-ip';

    const now = Date.now();
    let record = requestMap.get(ip);

    // Clean up expired window
    if (!record || now - record.firstAttemptTime > windowMs) {
      record = {
        attempts: 1,
        firstAttemptTime: now,
      };
      requestMap.set(ip, record);
    } else {
      record.attempts += 1;
    }

    const remaining = Math.max(0, maxAttempts - record.attempts);
    res.setHeader('X-RateLimit-Limit', maxAttempts);
    res.setHeader('X-RateLimit-Remaining', remaining);

    if (record.attempts > maxAttempts) {
      const retryAfterSeconds = Math.ceil(
        (record.firstAttemptTime + windowMs - now) / 1000
      );
      res.setHeader('Retry-After', retryAfterSeconds);

      return res.status(429).json({
        success: false,
        statusCode: 429,
        message,
        retryAfterSeconds,
      });
    }

    // Attach reset helper so successful auth can clear attempt count
    req.resetLoginRateLimit = () => {
      requestMap.delete(ip);
    };

    next();
  };
};

// 1. Admin login rate limiter: 5 attempts per 15 minutes
const loginRateLimiter = createRateLimiter({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES || '15', 10) * 60 * 1000,
  maxAttempts: parseInt(process.env.RATE_LIMIT_MAX_ATTEMPTS || '5', 10),
  message: 'Too many login attempts. For security, please try again in 15 minutes.',
});

// 2. Checkout / Order placement rate limiter: 15 order submissions per 15 minutes
const checkoutRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxAttempts: 15,
  message: 'Too many order requests submitted. Please wait a few moments before placing another order.',
});

// 3. General API rate limiter: 300 requests per 15 minutes per IP
const apiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxAttempts: 300,
  message: 'High traffic detected from your network. Please slow down your requests.',
});

module.exports = {
  createRateLimiter,
  loginRateLimiter,
  checkoutRateLimiter,
  apiRateLimiter,
};
