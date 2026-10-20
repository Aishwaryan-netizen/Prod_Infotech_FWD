const path = require('path');
require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3001,
  JWT_SECRET: process.env.JWT_SECRET || 'nexus-chat-realtime-jwt-secret-key-2026',
  JWT_EXPIRES_IN: '7d',
  SALT_ROUNDS: 10,
  COOKIE_NAME: 'nexus_chat_token',
  DATA_DIR: path.join(__dirname, 'data'),
  USERS_FILE: path.join(__dirname, 'data', 'users.json'),
  ROOMS_FILE: path.join(__dirname, 'data', 'rooms.json'),
  MESSAGES_FILE: path.join(__dirname, 'data', 'messages.json')
};
