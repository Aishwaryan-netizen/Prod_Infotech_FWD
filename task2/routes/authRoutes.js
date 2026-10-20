const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db');

const router = express.Router();

function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, email: user.email },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRES_IN }
  );
}

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, username, email, password } = req.body;

    if (!name || !username || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'All fields (name, username, email, password) are required.'
      });
    }

    if (username.length < 3 || !/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({
        success: false,
        error: 'Username must be at least 3 characters and contain only letters, numbers, and underscores.'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long.'
      });
    }

    // Check unique email
    if (db.findUserByEmail(email)) {
      return res.status(409).json({
        success: false,
        error: 'An account with this email address already exists.'
      });
    }

    // Check unique username
    if (db.findUserByUsername(username)) {
      return res.status(409).json({
        success: false,
        error: 'This username is already taken. Please choose another.'
      });
    }

    const passwordHash = await bcrypt.hash(password, config.SALT_ROUNDS);
    const newUser = db.createUser({ name, username, email, passwordHash });
    const token = generateToken(newUser);

    res.cookie(config.COOKIE_NAME, token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.status(201).json({
      success: true,
      message: 'Account registered successfully!',
      user: newUser,
      token
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({
      success: false,
      error: 'An unexpected error occurred during registration.'
    });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { loginId, password } = req.body; // loginId can be email or username

    if (!loginId || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please enter your username/email and password.'
      });
    }

    // Search by email or username
    let user = db.findUserByEmail(loginId);
    if (!user) {
      user = db.findUserByUsername(loginId);
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials. User not found.'
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials. Incorrect password.'
      });
    }

    db.updateUserLastSeen(user.id);
    const safeUser = db.sanitizeUser(user);
    const token = generateToken(safeUser);

    res.cookie(config.COOKIE_NAME, token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.json({
      success: true,
      message: 'Logged in successfully!',
      user: safeUser,
      token
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({
      success: false,
      error: 'An error occurred during login.'
    });
  }
});

// Validate session
router.get('/me', (req, res) => {
  let token = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies && req.cookies[config.COOKIE_NAME]) {
    token = req.cookies[config.COOKIE_NAME];
  }

  if (!token) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    const user = db.findUserById(decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, error: 'User no longer exists' });
    }
    return res.json({ success: true, user: db.sanitizeUser(user) });
  } catch (e) {
    return res.status(401).json({ success: false, error: 'Session expired or invalid' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  res.clearCookie(config.COOKIE_NAME);
  return res.json({ success: true, message: 'Logged out successfully.' });
});

module.exports = router;
