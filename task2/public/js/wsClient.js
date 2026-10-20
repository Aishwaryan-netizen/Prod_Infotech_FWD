/**
 * WebSocket Client Module
 * Manages native WebSocket connection, auto-reconnect, and bidirectional events.
 */

class WebSocketClient {
  constructor() {
    this.ws = null;
    this.token = null;
    this.listeners = new Map();
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.isConnected = false;
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  emit(event, data) {
    const handlers = this.listeners.get(event) || [];
    handlers.forEach(fn => {
      try {
        fn(data);
      } catch (err) {
        console.error(`Error in WS event listener for ${event}:`, err);
      }
    });
  }

  connect(token) {
    this.token = token || this.token;
    if (!this.token) return;

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit('connected');

        // Authenticate the socket connection
        this.send({
          type: 'auth',
          token: this.token
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          this.handleIncoming(payload);
        } catch (e) {
          console.warn('Failed to parse incoming WS message:', event.data);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.emit('disconnected');
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.error('WebSocket encountered an error:', err);
      };
    } catch (e) {
      console.error('WebSocket connection setup failed:', e);
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit('reconnect_failed');
      return;
    }

    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 10000);
    this.reconnectAttempts++;
    this.emit('reconnecting', { attempt: this.reconnectAttempts, delay });

    this.reconnectTimer = setTimeout(() => {
      if (this.token) {
        this.connect(this.token);
      }
    }, delay);
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.token = null;
    this.isConnected = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  handleIncoming(payload) {
    const { type } = payload;

    switch (type) {
      case 'auth_success':
        this.emit('auth_success', payload);
        break;

      case 'presence':
        this.emit('presence', payload);
        break;

      case 'room_message':
        this.emit('room_message', payload);
        break;

      case 'direct_message_received':
      case 'direct_message_sent':
        this.emit('direct_message', payload);
        break;

      case 'user_typing':
        this.emit('user_typing', payload);
        break;

      case 'room_created':
        this.emit('room_created', payload);
        break;

      case 'error':
        this.emit('error', payload.message);
        break;

      default:
        this.emit(type, payload);
    }
  }

  joinRoom(roomId) {
    this.send({
      type: 'join_room',
      roomId
    });
  }

  sendRoomMessage(roomId, text) {
    this.send({
      type: 'room_message',
      roomId,
      text
    });
  }

  sendDirectMessage(recipientId, text) {
    this.send({
      type: 'direct_message',
      recipientId,
      text
    });
  }

  sendTyping(targetType, targetId, isTyping) {
    this.send({
      type: 'typing',
      targetType,
      targetId,
      isTyping
    });
  }
}

// Global singleton instance
const WS = new WebSocketClient();
