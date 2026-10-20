const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');

const AVATAR_COLORS = [
  '#2c73d2', // Royal Blue
  '#00c9a7', // Mint Teal
  '#c34a36', // Terracotta Coral
  '#7c3aed', // Deep Violet
  '#ec4899', // Radiant Pink
  '#f59e0b', // Amber Glow
  '#06b6d4', // Cyan
  '#10b981'  // Emerald
];

function init() {
  if (!fs.existsSync(config.DATA_DIR)) {
    fs.mkdirSync(config.DATA_DIR, { recursive: true });
  }

  // Users file
  if (!fs.existsSync(config.USERS_FILE)) {
    fs.writeFileSync(config.USERS_FILE, JSON.stringify([], null, 2), 'utf-8');
  }

  // Default rooms file
  if (!fs.existsSync(config.ROOMS_FILE)) {
    const defaultRooms = [
      {
        id: 'general',
        name: 'General',
        topic: 'Company-wide discussion and general inquiries',
        icon: '💬',
        isDefault: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'tech-talk',
        name: 'Tech & Architecture',
        topic: 'Engineering discussions, code reviews, and tech stacks',
        icon: '⚡',
        isDefault: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'announcements',
        name: 'Announcements',
        topic: 'Official broadcasts, milestone releases, and news',
        icon: '📢',
        isDefault: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'random',
        name: 'Water Cooler',
        topic: 'Casual conversations, memes, and off-topic fun',
        icon: '☕',
        isDefault: true,
        createdAt: new Date().toISOString()
      }
    ];
    fs.writeFileSync(config.ROOMS_FILE, JSON.stringify(defaultRooms, null, 2), 'utf-8');
  }

  // Messages file
  if (!fs.existsSync(config.MESSAGES_FILE)) {
    fs.writeFileSync(config.MESSAGES_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}

// Atomic file write
function writeJsonAtomic(filePath, data) {
  const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tempPath, filePath);
}

function readJson(filePath, fallback = []) {
  try {
    init();
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content || '[]');
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return fallback;
  }
}

/* ==================== USERS ==================== */

function getAllUsers() {
  return readJson(config.USERS_FILE);
}

function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
}

function findUserById(id) {
  if (!id) return null;
  const users = getAllUsers();
  return users.find(u => u.id === id) || null;
}

function findUserByEmail(email) {
  if (!email) return null;
  const users = getAllUsers();
  return users.find(u => u.email.toLowerCase() === email.toLowerCase().trim()) || null;
}

function findUserByUsername(username) {
  if (!username) return null;
  const users = getAllUsers();
  return users.find(u => u.username.toLowerCase() === username.toLowerCase().trim()) || null;
}

function createUser({ name, username, email, passwordHash }) {
  const users = getAllUsers();
  
  // Pick deterministic avatar color based on username
  const colorIndex = Math.abs(username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % AVATAR_COLORS.length;
  
  const newUser = {
    id: crypto.randomUUID(),
    name: name.trim(),
    username: username.toLowerCase().trim(),
    email: email.toLowerCase().trim(),
    passwordHash,
    avatarColor: AVATAR_COLORS[colorIndex],
    createdAt: new Date().toISOString(),
    lastSeen: new Date().toISOString()
  };

  users.push(newUser);
  writeJsonAtomic(config.USERS_FILE, users);
  return sanitizeUser(newUser);
}

function updateUserLastSeen(userId) {
  const users = getAllUsers();
  const user = users.find(u => u.id === userId);
  if (user) {
    user.lastSeen = new Date().toISOString();
    writeJsonAtomic(config.USERS_FILE, users);
  }
}

/* ==================== ROOMS ==================== */

function getAllRooms() {
  return readJson(config.ROOMS_FILE);
}

function findRoomById(roomId) {
  if (!roomId) return null;
  const rooms = getAllRooms();
  return rooms.find(r => r.id === roomId.toLowerCase()) || null;
}

function createRoom({ name, topic, createdBy }) {
  const rooms = getAllRooms();
  const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  
  // Check if room slug exists
  if (rooms.some(r => r.id === slug)) {
    throw new Error('A chat room with this name already exists.');
  }

  const newRoom = {
    id: slug,
    name: name.trim(),
    topic: (topic || 'Community discussions').trim(),
    icon: '#',
    createdBy,
    isDefault: false,
    createdAt: new Date().toISOString()
  };

  rooms.push(newRoom);
  writeJsonAtomic(config.ROOMS_FILE, rooms);
  return newRoom;
}

/* ==================== MESSAGES ==================== */

function getAllMessages() {
  return readJson(config.MESSAGES_FILE);
}

function saveMessage({ type, targetId, senderId, senderName, senderUsername, senderAvatarColor, text }) {
  const messages = getAllMessages();
  const newMsg = {
    id: crypto.randomUUID(),
    type, // 'room' or 'direct'
    targetId, // roomId or recipientId
    senderId,
    senderName,
    senderUsername,
    senderAvatarColor,
    text: text.trim(),
    timestamp: new Date().toISOString()
  };

  messages.push(newMsg);
  // Keep last 2000 messages to prevent unbounded growth
  if (messages.length > 2000) {
    messages.splice(0, messages.length - 2000);
  }

  writeJsonAtomic(config.MESSAGES_FILE, messages);
  return newMsg;
}

function getRoomMessages(roomId, limit = 50) {
  const messages = getAllMessages();
  return messages
    .filter(m => m.type === 'room' && m.targetId === roomId)
    .slice(-limit);
}

function getDirectMessages(userAId, userBId, limit = 50) {
  const messages = getAllMessages();
  return messages
    .filter(m => m.type === 'direct' && (
      (m.senderId === userAId && m.targetId === userBId) ||
      (m.senderId === userBId && m.targetId === userAId)
    ))
    .slice(-limit);
}

init();

module.exports = {
  // Users
  getAllUsers,
  sanitizeUser,
  findUserById,
  findUserByEmail,
  findUserByUsername,
  createUser,
  updateUserLastSeen,
  // Rooms
  getAllRooms,
  findRoomById,
  createRoom,
  // Messages
  saveMessage,
  getRoomMessages,
  getDirectMessages
};
