const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db');

function authenticateToken(req, res, next) {
  let token = null;

  // 1. Check Authorization header: Bearer <token>
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  // 2. Fallback to HttpOnly cookie
  if (!token && req.cookies && req.cookies[config.COOKIE_NAME]) {
    token = req.cookies[config.COOKIE_NAME];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access denied. No authentication token provided.',
      code: 'AUTH_TOKEN_MISSING'
    });
  }

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    const user = db.findUserById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User associated with this token no longer exists.',
        code: 'USER_NOT_FOUND'
      });
    }

    req.user = db.sanitizeUser(user);
    req.token = token;
    next();
  } catch (err) {
    return res.status(403).json({
      success: false,
      error: 'Invalid or expired authentication token. Please log in again.',
      code: 'AUTH_TOKEN_INVALID'
    });
  }
}

module.exports = authenticateToken;
