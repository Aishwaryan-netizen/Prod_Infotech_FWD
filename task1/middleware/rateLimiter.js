const rateLimit = require('express-rate-limit');

// Rate limiter for authentication endpoints: max 30 requests per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many authentication attempts from this IP. Please try again after 15 minutes.',
    code: 'RATE_LIMIT_EXCEEDED'
  }
});

module.exports = {
  authLimiter
};
