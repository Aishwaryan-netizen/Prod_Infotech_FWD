const express = require('express');
const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db');

const router = express.Router();

// Auth middleware for chat routes
function requireAuth(req, res, next) {
  let token = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies && req.cookies[config.COOKIE_NAME]) {
    token = req.cookies[config.COOKIE_NAME];
  }

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    const user = db.findUserById(decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }
    req.user = db.sanitizeUser(user);
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

router.use(requireAuth);

// Get all chat rooms
router.get('/rooms', (req, res) => {
  const rooms = db.getAllRooms();
  return res.json({ success: true, rooms });
});

// Create a new room
router.post('/rooms', (req, res) => {
  try {
    const { name, topic } = req.body;
    if (!name || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Room name must be at least 2 characters long.'
      });
    }

    const newRoom = db.createRoom({
      name,
      topic,
      createdBy: req.user.username
    });

    // Notify connected WebSocket clients about new room
    if (req.wsManager) {
      req.wsManager.broadcast({
        type: 'room_created',
        room: newRoom
      });
    }

    return res.status(201).json({
      success: true,
      message: `Room #${newRoom.id} created successfully!`,
      room: newRoom
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: err.message || 'Failed to create room.'
    });
  }
});

// Get room message history
router.get('/rooms/:roomId/messages', (req, res) => {
  const { roomId } = req.params;
  const room = db.findRoomById(roomId);
  if (!room) {
    return res.status(404).json({ success: false, error: 'Room not found' });
  }

  const messages = db.getRoomMessages(roomId, 60);
  return res.json({ success: true, room, messages });
});

// Get users list with live online status
router.get('/users', (req, res) => {
  const allUsers = db.getAllUsers();
  const usersWithStatus = allUsers
    .filter(u => u.id !== req.user.id) // exclude current user
    .map(u => {
      const sanitized = db.sanitizeUser(u);
      return {
        ...sanitized,
        isOnline: req.wsManager ? req.wsManager.isUserOnline(u.id) : false
      };
    });

  return res.json({ success: true, users: usersWithStatus });
});

// Get direct messages history
router.get('/direct/:recipientId/messages', (req, res) => {
  const { recipientId } = req.params;
  const recipient = db.findUserById(recipientId);
  if (!recipient) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }

  const messages = db.getDirectMessages(req.user.id, recipientId, 60);
  return res.json({
    success: true,
    recipient: db.sanitizeUser(recipient),
    isOnline: req.wsManager ? req.wsManager.isUserOnline(recipientId) : false,
    messages
  });
});

module.exports = router;
