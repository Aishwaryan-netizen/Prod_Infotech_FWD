const http = require('http');
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const WebSocketManager = require('./websocketManager');
const authRoutes = require('./routes/authRoutes');
const chatRoutes = require('./routes/chatRoutes');

const app = express();
const server = http.createServer(app);

// Initialize WebSocket Manager on same HTTP server
const wsManager = new WebSocketManager(server);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({
  origin: true,
  credentials: true
}));

// Attach wsManager to requests for API triggers
app.use((req, res, next) => {
  req.wsManager = wsManager;
  next();
});

// Serve frontend static assets
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'NexusChat Real-Time WebSocket Server',
    port: config.PORT,
    onlineUsersCount: wsManager.getOnlineUserIds().length,
    timestamp: new Date().toISOString()
  });
});

// Fallback to index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal chat server error occurred.'
  });
});

const PORT = config.PORT;
server.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`💬  NexusChat WebSocket Server running on port ${PORT}`);
  console.log(`🔗  HTTP: http://localhost:${PORT}`);
  console.log(`⚡  WS:   ws://localhost:${PORT}`);
  console.log(`=================================================`);
});
