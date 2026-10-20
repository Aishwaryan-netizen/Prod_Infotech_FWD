const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');

const dataDir = path.dirname(config.DB_PATH);
const activityPath = path.join(dataDir, 'activity.json');

// Ensure directory and files exist
function init() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(config.DB_PATH)) {
    fs.writeFileSync(config.DB_PATH, JSON.stringify([], null, 2), 'utf-8');
  }
  if (!fs.existsSync(activityPath)) {
    fs.writeFileSync(activityPath, JSON.stringify([], null, 2), 'utf-8');
  }
}

// Atomic file write to avoid corruption
function writeJsonAtomic(filePath, data) {
  const tempPath = `${filePath}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tempPath, filePath);
}

function getAllUsers() {
  try {
    init();
    const data = fs.readFileSync(config.DB_PATH, 'utf-8');
    return JSON.parse(data || '[]');
  } catch (err) {
    console.error('Error reading users db:', err);
    return [];
  }
}

function findUserByEmail(email) {
  if (!email) return null;
  const users = getAllUsers();
  return users.find(u => u.email.toLowerCase() === email.toLowerCase().trim()) || null;
}

function findUserById(id) {
  if (!id) return null;
  const users = getAllUsers();
  return users.find(u => u.id === id) || null;
}

function createUser({ name, email, passwordHash, role = 'Member' }) {
  const users = getAllUsers();
  const newUser = {
    id: crypto.randomUUID(),
    name: name.trim(),
    email: email.toLowerCase().trim(),
    passwordHash,
    role,
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString()
  };
  users.push(newUser);
  writeJsonAtomic(config.DB_PATH, users);
  
  logActivity(newUser.id, 'ACCOUNT_CREATED', 'Account registered successfully');
  return sanitizeUser(newUser);
}

function updateUser(id, updates) {
  const users = getAllUsers();
  const index = users.findIndex(u => u.id === id);
  if (index === -1) return null;

  users[index] = {
    ...users[index],
    ...updates,
    updatedAt: new Date().toISOString()
  };

  writeJsonAtomic(config.DB_PATH, users);
  return sanitizeUser(users[index]);
}

function logActivity(userId, action, details) {
  try {
    init();
    const raw = fs.readFileSync(activityPath, 'utf-8');
    const logs = JSON.parse(raw || '[]');
    logs.unshift({
      id: crypto.randomUUID(),
      userId,
      action,
      details,
      timestamp: new Date().toISOString()
    });
    // Keep last 100 entries
    if (logs.length > 100) logs.length = 100;
    writeJsonAtomic(activityPath, logs);
  } catch (err) {
    console.error('Error logging activity:', err);
  }
}

function getUserActivities(userId, limit = 10) {
  try {
    init();
    const raw = fs.readFileSync(activityPath, 'utf-8');
    const logs = JSON.parse(raw || '[]');
    return logs.filter(l => l.userId === userId).slice(0, limit);
  } catch (err) {
    return [];
  }
}

function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

init();

module.exports = {
  findUserByEmail,
  findUserById,
  createUser,
  updateUser,
  sanitizeUser,
  logActivity,
  getUserActivities
};
