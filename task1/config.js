const path = require('path');
require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3000,
  JWT_SECRET: process.env.JWT_SECRET || 'prodigy-infotech-super-secure-jwt-key-2025-token',
  JWT_EXPIRES_IN: '24h',
  SALT_ROUNDS: 10,
  COOKIE_NAME: 'prodigy_auth_token',
  COOKIE_MAX_AGE: 24 * 60 * 60 * 1000, // 24 hours
  DB_PATH: path.join(__dirname, 'data', 'users.json')
};
