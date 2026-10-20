const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const config = require('./config');
const db = require('./db');

class WebSocketManager {
  constructor(server) {
    this.wss = new WebSocket.Server({ server });
    // Map: userId -> Set<WebSocket>
    this.userSockets = new Map();
    // Map: ws -> { user, activeRoom, isAlive }
    this.socketInfo = new Map();

    this.init();
  }

  init() {
    this.wss.on('connection', (ws) => {
      this.socketInfo.set(ws, {
        user: null,
        activeRoom: 'general',
        isAlive: true
      });

      ws.on('pong', () => {
        const info = this.socketInfo.get(ws);
        if (info) info.isAlive = true;
      });

      ws.on('message', (data) => {
        this.handleMessage(ws, data);
      });

      ws.on('close', () => {
        this.handleDisconnect(ws);
      });

      ws.on('error', (err) => {
        console.error('WebSocket connection error:', err);
        this.handleDisconnect(ws);
      });
    });

    // Heartbeat to detect dead connections every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        const info = this.socketInfo.get(ws);
        if (!info) return;

        if (info.isAlive === false) {
          ws.terminate();
          return;
        }

        info.isAlive = false;
        ws.ping();
      });
    }, 30000);
  }

  handleMessage(ws, rawData) {
    let payload;
    try {
      payload = JSON.parse(rawData.toString());
    } catch (e) {
      console.warn('Invalid JSON received over WebSocket:', rawData.toString());
      return;
    }

    const { type } = payload;
    const info = this.socketInfo.get(ws);

    switch (type) {
      case 'auth':
        this.handleAuth(ws, payload.token);
        break;

      case 'join_room':
        if (!info || !info.user) return this.sendError(ws, 'Unauthorized. Please authenticate first.');
        this.handleJoinRoom(ws, payload.roomId);
        break;

      case 'room_message':
        if (!info || !info.user) return this.sendError(ws, 'Unauthorized. Please authenticate first.');
        this.handleRoomMessage(ws, payload);
        break;

      case 'direct_message':
        if (!info || !info.user) return this.sendError(ws, 'Unauthorized. Please authenticate first.');
        this.handleDirectMessage(ws, payload);
        break;

      case 'typing':
        if (!info || !info.user) return;
        this.handleTyping(ws, payload);
        break;

      default:
        console.warn('Unknown WebSocket message type:', type);
    }
  }

  handleAuth(ws, token) {
    if (!token) {
      return this.sendError(ws, 'No authentication token provided.');
    }

    try {
      const decoded = jwt.verify(token, config.JWT_SECRET);
      const user = db.findUserById(decoded.id);

      if (!user) {
        return this.sendError(ws, 'User not found or account removed.');
      }

      const safeUser = db.sanitizeUser(user);
      const info = this.socketInfo.get(ws) || {};
      info.user = safeUser;
      this.socketInfo.set(ws, info);

      // Register in userSockets Map
      if (!this.userSockets.has(safeUser.id)) {
        this.userSockets.set(safeUser.id, new Set());
      }
      this.userSockets.get(safeUser.id).add(ws);

      // Update user last seen
      db.updateUserLastSeen(safeUser.id);

      // Confirm auth to client with list of currently online user IDs
      const onlineUserIds = Array.from(this.userSockets.keys());
      this.send(ws, {
        type: 'auth_success',
        user: safeUser,
        onlineUserIds
      });

      // Broadcast presence 'online' to all other users
      this.broadcast({
        type: 'presence',
        userId: safeUser.id,
        status: 'online'
      }, ws);

    } catch (err) {
      this.sendError(ws, 'Invalid authentication token.');
    }
  }

  handleJoinRoom(ws, roomId) {
    const info = this.socketInfo.get(ws);
    if (!info) return;

    info.activeRoom = roomId || 'general';
    this.send(ws, {
      type: 'room_joined',
      roomId: info.activeRoom
    });
  }

  handleRoomMessage(ws, { roomId, text }) {
    const info = this.socketInfo.get(ws);
    if (!info || !info.user) return;

    if (!roomId || !text || text.trim().length === 0) {
      return this.sendError(ws, 'Message content cannot be empty.');
    }

    const room = db.findRoomById(roomId);
    if (!room) {
      return this.sendError(ws, `Room #${roomId} does not exist.`);
    }

    // Persist message
    const savedMsg = db.saveMessage({
      type: 'room',
      targetId: roomId,
      senderId: info.user.id,
      senderName: info.user.name,
      senderUsername: info.user.username,
      senderAvatarColor: info.user.avatarColor,
      text: text.trim()
    });

    // Broadcast message to all connected clients
    this.broadcast({
      type: 'room_message',
      roomId,
      message: savedMsg
    });
  }

  handleDirectMessage(ws, { recipientId, text }) {
    const info = this.socketInfo.get(ws);
    if (!info || !info.user) return;

    if (!recipientId || !text || text.trim().length === 0) {
      return this.sendError(ws, 'Recipient and message text are required.');
    }

    if (recipientId === info.user.id) {
      return this.sendError(ws, 'Cannot send private direct message to yourself.');
    }

    const recipient = db.findUserById(recipientId);
    if (!recipient) {
      return this.sendError(ws, 'Recipient user not found.');
    }

    // Persist private message
    const savedMsg = db.saveMessage({
      type: 'direct',
      targetId: recipientId,
      senderId: info.user.id,
      senderName: info.user.name,
      senderUsername: info.user.username,
      senderAvatarColor: info.user.avatarColor,
      text: text.trim()
    });

    // 1. Deliver to sender sockets
    const senderSockets = this.userSockets.get(info.user.id);
    if (senderSockets) {
      senderSockets.forEach((s) => {
        this.send(s, {
          type: 'direct_message_sent',
          recipientId,
          message: savedMsg
        });
      });
    }

    // 2. Deliver to recipient sockets (if online)
    const recipientSockets = this.userSockets.get(recipientId);
    if (recipientSockets && recipientSockets.size > 0) {
      recipientSockets.forEach((s) => {
        this.send(s, {
          type: 'direct_message_received',
          senderId: info.user.id,
          message: savedMsg
        });
      });
    }
  }

  handleTyping(ws, { targetType, targetId, isTyping }) {
    const info = this.socketInfo.get(ws);
    if (!info || !info.user) return;

    if (targetType === 'room') {
      // Broadcast to users in the same room (excluding sender)
      this.broadcastToRoom(targetId, {
        type: 'user_typing',
        targetType: 'room',
        targetId,
        user: {
          id: info.user.id,
          name: info.user.name,
          username: info.user.username
        },
        isTyping: !!isTyping
      }, ws);
    } else if (targetType === 'direct') {
      // Send directly to the recipient sockets
      const recipientSockets = this.userSockets.get(targetId);
      if (recipientSockets) {
        recipientSockets.forEach((s) => {
          this.send(s, {
            type: 'user_typing',
            targetType: 'direct',
            targetId: info.user.id,
            user: {
              id: info.user.id,
              name: info.user.name,
              username: info.user.username
            },
            isTyping: !!isTyping
          });
        });
      }
    }
  }

  handleDisconnect(ws) {
    const info = this.socketInfo.get(ws);
    if (info && info.user) {
      const userId = info.user.id;
      const userSet = this.userSockets.get(userId);

      if (userSet) {
        userSet.delete(ws);
        if (userSet.size === 0) {
          this.userSockets.delete(userId);
          db.updateUserLastSeen(userId);

          // Broadcast offline presence
          this.broadcast({
            type: 'presence',
            userId,
            status: 'offline'
          });
        }
      }
    }

    this.socketInfo.delete(ws);
  }

  send(ws, data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  sendError(ws, message) {
    this.send(ws, {
      type: 'error',
      message
    });
  }

  broadcast(data, excludeWs = null) {
    const serialized = JSON.stringify(data);
    this.wss.clients.forEach((client) => {
      if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
        client.send(serialized);
      }
    });
  }

  broadcastToRoom(roomId, data, excludeWs = null) {
    const serialized = JSON.stringify(data);
    this.wss.clients.forEach((client) => {
      const info = this.socketInfo.get(client);
      if (client !== excludeWs && client.readyState === WebSocket.OPEN && info && info.activeRoom === roomId) {
        client.send(serialized);
      }
    });
  }

  isUserOnline(userId) {
    return this.userSockets.has(userId) && this.userSockets.get(userId).size > 0;
  }

  getOnlineUserIds() {
    return Array.from(this.userSockets.keys());
  }
}

module.exports = WebSocketManager;
