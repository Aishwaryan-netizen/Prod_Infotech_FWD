const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Email validation helper
function isValidEmail(email) {
  const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return re.test(String(email).toLowerCase());
}

// Password strength validator
function checkPasswordStrength(password) {
  const issues = [];
  if (!password || password.length < 8) {
    issues.push('At least 8 characters long');
  }
  if (!/[a-z]/.test(password)) {
    issues.push('At least one lowercase letter');
  }
  if (!/[A-Z]/.test(password)) {
    issues.push('At least one uppercase letter');
  }
  if (!/[0-9]/.test(password)) {
    issues.push('At least one number');
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    issues.push('At least one special character (!@#$%^&* etc.)');
  }
  return {
    isValid: issues.length === 0,
    issues
  };
}

// Sign JWT token helper
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRES_IN }
  );
}

// Cookie setting helper
function setAuthCookie(res, token) {
  res.cookie(config.COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: config.COOKIE_MAX_AGE
  });
}

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public (Rate limited)
 */
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // 1. Basic presence check
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide all required fields: name, email, and password.'
      });
    }

    // 2. Validate email format
    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid email address.'
      });
    }

    // 3. Validate password strength
    const strength = checkPasswordStrength(password);
    if (!strength.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Password does not meet security requirements.',
        requirements: strength.issues
      });
    }

    // 4. Check if user already exists
    const existingUser = db.findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'An account with this email address already exists.'
      });
    }

    // 5. Hash password with bcrypt
    const passwordHash = await bcrypt.hash(password, config.SALT_ROUNDS);

    // 6. Save new user
    const newUser = db.createUser({
      name,
      email,
      passwordHash,
      role: 'Standard Member'
    });

    // 7. Issue JWT token & set cookie
    const token = generateToken(newUser);
    setAuthCookie(res, token);

    return res.status(201).json({
      success: true,
      message: 'Registration successful! Welcome aboard.',
      user: newUser,
      token
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({
      success: false,
      error: 'An unexpected server error occurred during registration.'
    });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user & issue token
 * @access  Public (Rate limited)
 */
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please enter both email and password.'
      });
    }

    // 1. Find user by email
    const user = db.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.'
      });
    }

    // 2. Compare password with bcrypt hash
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      db.logActivity(user.id, 'LOGIN_FAILED', 'Failed login attempt with incorrect password');
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.'
      });
    }

    // 3. Update last login timestamp
    const updatedUser = db.updateUser(user.id, {
      lastLogin: new Date().toISOString()
    });

    db.logActivity(user.id, 'LOGIN_SUCCESS', 'Successful authentication');

    // 4. Issue token & cookie
    const token = generateToken(updatedUser);
    setAuthCookie(res, token);

    return res.json({
      success: true,
      message: 'Login successful!',
      user: updatedUser,
      token
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({
      success: false,
      error: 'An unexpected server error occurred during login.'
    });
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Clear session cookie and logout
 * @access  Public / Authenticated
 */
router.post('/logout', (req, res) => {
  res.clearCookie(config.COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax'
  });

  return res.json({
    success: true,
    message: 'Logged out successfully.'
  });
});

/**
 * @route   GET /api/auth/me
 * @desc    Retrieve current authenticated user session
 * @access  Protected
 */
router.get('/me', authenticateToken, (req, res) => {
  return res.json({
    success: true,
    user: req.user
  });
});

module.exports = router;
