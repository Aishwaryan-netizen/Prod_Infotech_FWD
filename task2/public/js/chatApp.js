/**
 * NexusChat Main Application Controller
 * Orchestrates views, state, messaging stream, real-time presence, and typing.
 */

const ChatApp = (() => {
  // Application State
  const state = {
    currentUser: null,
    activeChat: { type: 'room', id: 'general', name: 'General', topic: 'Company-wide discussion and general inquiries' },
    rooms: [],
    users: [],
    unreadDMs: new Map(), // userId -> count
    typingTimer: null,
    isTypingSent: false
  };

  // DOM Elements - Views
  const authView = document.getElementById('auth-view');
  const chatView = document.getElementById('chat-view');

  // DOM Elements - Auth
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const tabIndicator = document.getElementById('tab-indicator');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const loginIdInput = document.getElementById('login-id');
  const loginPwInput = document.getElementById('login-password');
  const regNameInput = document.getElementById('reg-name');
  const regUserInput = document.getElementById('reg-username');
  const regEmailInput = document.getElementById('reg-email');
  const regPwInput = document.getElementById('reg-password');
  const btnAutofillDemo = document.getElementById('btn-autofill-demo');
  const loginSpinner = document.getElementById('login-spinner');
  const regSpinner = document.getElementById('reg-spinner');

  // DOM Elements - Sidebar
  const myAvatar = document.getElementById('my-avatar');
  const myName = document.getElementById('my-name');
  const myHandle = document.getElementById('my-handle');
  const myStatusIndicator = document.getElementById('my-status-indicator');
  const btnSoundToggle = document.getElementById('btn-sound-toggle');
  const soundIcon = document.getElementById('sound-icon');
  const btnLogout = document.getElementById('btn-logout');
  const wsStatusRibbon = document.getElementById('ws-status-ribbon');
  const wsStatusText = document.getElementById('ws-status-text');
  const tabNavRooms = document.getElementById('tab-nav-rooms');
  const tabNavDMs = document.getElementById('tab-nav-dms');
  const badgeRoomsCount = document.getElementById('badge-rooms-count');
  const badgeDmsUnread = document.getElementById('badge-dms-unread');
  const sectionRooms = document.getElementById('section-rooms');
  const sectionDMs = document.getElementById('section-dms');
  const roomsList = document.getElementById('rooms-list');
  const usersList = document.getElementById('users-list');
  const onlineUsersCount = document.getElementById('online-users-count');
  const channelSearchInput = document.getElementById('channel-search-input');
  const btnOpenCreateRoom = document.getElementById('btn-open-create-room');

  // DOM Elements - Chat Area
  const chatSidebar = document.getElementById('chat-sidebar');
  const btnMobileSidebar = document.getElementById('btn-mobile-sidebar');
  const targetAvatar = document.getElementById('target-avatar');
  const targetStatusDot = document.getElementById('target-status-dot');
  const targetName = document.getElementById('target-name');
  const targetBadge = document.getElementById('target-badge');
  const targetTopic = document.getElementById('target-topic');
  const messagesContainer = document.getElementById('messages-container');
  const messagesFeed = document.getElementById('messages-feed');
  const messagesAnchor = document.getElementById('messages-anchor');
  const typingBanner = document.getElementById('typing-banner');
  const typingText = document.getElementById('typing-text');
  const messageForm = document.getElementById('message-form');
  const messageInput = document.getElementById('message-input');

  // DOM Elements - Modal
  const modalCreateRoom = document.getElementById('modal-create-room');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnCancelCreateRoom = document.getElementById('btn-cancel-create-room');
  const createRoomForm = document.getElementById('create-room-form');
  const newRoomName = document.getElementById('new-room-name');
  const newRoomTopic = document.getElementById('new-room-topic');

  /* ==================== VIEW SWITCHING ==================== */

  function showAuthView() {
    chatView?.classList.remove('active-view');
    authView?.classList.add('active-view');
    WS.disconnect();
  }

  function showChatView() {
    authView?.classList.remove('active-view');
    chatView?.classList.add('active-view');
    initChatWorkspace();
  }

  /* ==================== AUTHENTICATION ==================== */

  function setupAuthHandlers() {
    // Tab switching
    tabLogin?.addEventListener('click', () => {
      tabLogin.classList.add('active');
      tabRegister.classList.remove('active');
      tabIndicator.classList.remove('slide-right');
      loginForm.classList.add('active-form');
      registerForm.classList.remove('active-form');
    });

    tabRegister?.addEventListener('click', () => {
      tabRegister.classList.add('active');
      tabLogin.classList.remove('active');
      tabIndicator.classList.add('slide-right');
      registerForm.classList.add('active-form');
      loginForm.classList.remove('active-form');
    });

    // Password toggle
    document.querySelectorAll('.toggle-pw-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        const input = document.getElementById(targetId);
        if (input) {
          input.type = input.type === 'password' ? 'text' : 'password';
        }
      });
    });

    // Autofill demo user
    btnAutofillDemo?.addEventListener('click', () => {
      loginIdInput.value = 'alex_morgan';
      loginPwInput.value = 'CipherShield#2026';
      showToast('Demo User Filled', 'Click "Connect to Chat" to enter.', 'info');
    });

    // Login submit
    loginForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearInputErrors();

      const loginId = loginIdInput.value.trim();
      const password = loginPwInput.value;

      if (!loginId || !password) {
        if (!loginId) setInputError('login-id-error', 'Username or email required.');
        if (!password) setInputError('login-password-error', 'Password required.');
        return;
      }

      loginSpinner.classList.remove('hidden');

      try {
        const res = await API.login(loginId, password);
        API.setAuth(res.token, res.user);
        state.currentUser = res.user;
        showToast('Connected!', `Welcome back, ${res.user.name}!`, 'success');
        showChatView();
      } catch (err) {
        setInputError('login-password-error', err.data?.error || err.message);
        showToast('Login Failed', err.data?.error || err.message, 'error');
      } finally {
        loginSpinner.classList.add('hidden');
      }
    });

    // Register submit
    registerForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearInputErrors();

      const name = regNameInput.value.trim();
      const username = regUserInput.value.trim();
      const email = regEmailInput.value.trim();
      const password = regPwInput.value;

      let hasError = false;
      if (!name) { setInputError('reg-name-error', 'Full name required.'); hasError = true; }
      if (!username) { setInputError('reg-username-error', 'Username required.'); hasError = true; }
      if (!email) { setInputError('reg-email-error', 'Email required.'); hasError = true; }
      if (!password || password.length < 6) { setInputError('reg-password-error', 'Min 6 characters required.'); hasError = true; }

      if (hasError) return;

      regSpinner.classList.remove('hidden');

      try {
        const res = await API.register(name, username, email, password);
        API.setAuth(res.token, res.user);
        state.currentUser = res.user;
        showToast('Account Created!', `Welcome to NexusChat, ${res.user.name}!`, 'success');
        showChatView();
      } catch (err) {
        setInputError('reg-email-error', err.data?.error || err.message);
        showToast('Registration Error', err.data?.error || err.message, 'error');
      } finally {
        regSpinner.classList.add('hidden');
      }
    });
  }

  function setInputError(id, msg) {
    const el = document.getElementById(id);
    if (el) el.textContent = msg;
  }

  function clearInputErrors() {
    ['login-id-error', 'login-password-error', 'reg-name-error', 'reg-username-error', 'reg-email-error', 'reg-password-error'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '';
    });
  }

  /* ==================== WORKSPACE INITIALIZATION ==================== */

  async function initChatWorkspace() {
    const user = state.currentUser || API.getUser();
    if (!user) {
      showAuthView();
      return;
    }
    state.currentUser = user;

    // Render user profile
    if (myName) myName.textContent = user.name;
    if (myHandle) myHandle.textContent = `@${user.username}`;
    if (myAvatar) {
      myAvatar.textContent = (user.name || 'U').charAt(0).toUpperCase();
      myAvatar.style.background = user.avatarColor || 'var(--color-primary)';
    }

    // Connect WebSocket
    const token = API.getToken();
    WS.connect(token);

    // Fetch initial data
    await loadRooms();
    await loadUsers();

    // Default select #general room
    selectRoom('general');
  }

  /* ==================== WEBSOCKET EVENT LISTENERS ==================== */

  function setupWebSocketListeners() {
    WS.on('connected', () => {
      updateConnectionRibbon('connected', 'WebSocket: Connected Live');
    });

    WS.on('disconnected', () => {
      updateConnectionRibbon('reconnecting', 'WebSocket: Disconnected');
    });

    WS.on('reconnecting', ({ attempt }) => {
      updateConnectionRibbon('reconnecting', `WebSocket: Reconnecting (attempt ${attempt})...`);
    });

    WS.on('auth_success', ({ user, onlineUserIds }) => {
      updateConnectionRibbon('connected', 'WebSocket: Authenticated');
      // Mark online users
      const onlineSet = new Set(onlineUserIds);
      state.users.forEach(u => {
        u.isOnline = onlineSet.has(u.id);
      });
      renderUsersList();
      updateOnlineCounter();
    });

    WS.on('presence', ({ userId, status }) => {
      const user = state.users.find(u => u.id === userId);
      if (user) {
        user.isOnline = (status === 'online');
        renderUsersList();
        updateOnlineCounter();

        // Update active DM header if currently chatting with this user
        if (state.activeChat.type === 'direct' && state.activeChat.id === userId) {
          updateDirectHeaderStatus(user.isOnline);
        }
      }
    });

    WS.on('room_message', ({ roomId, message }) => {
      if (state.activeChat.type === 'room' && state.activeChat.id === roomId) {
        appendMessage(message);
        Sound.playMessageChime();
      } else {
        // Increment unread badge for room
        Sound.playMessageChime();
        showToast(`New message in #${roomId}`, `${message.senderName}: ${message.text.slice(0, 40)}`, 'info');
      }
    });

    WS.on('direct_message', ({ senderId, recipientId, message }) => {
      const otherUserId = (message.senderId === state.currentUser.id) ? message.targetId : message.senderId;

      if (state.activeChat.type === 'direct' && state.activeChat.id === otherUserId) {
        appendMessage(message);
        Sound.playMessageChime();
      } else {
        // Message from someone else while looking at another room/DM
        const currentUnread = state.unreadDMs.get(otherUserId) || 0;
        state.unreadDMs.set(otherUserId, currentUnread + 1);
        updateTotalUnreadDMs();
        renderUsersList();
        Sound.playMessageChime();

        showToast(`Private Message from ${message.senderName}`, message.text.slice(0, 45), 'info');
      }
    });

    WS.on('user_typing', ({ targetType, targetId, user, isTyping }) => {
      if (targetType === 'room' && state.activeChat.type === 'room' && state.activeChat.id === targetId) {
        toggleTypingBanner(user.name, isTyping);
      } else if (targetType === 'direct' && state.activeChat.type === 'direct' && state.activeChat.id === targetId) {
        toggleTypingBanner(user.name, isTyping);
      }
    });

    WS.on('room_created', ({ room }) => {
      state.rooms.push(room);
      renderRoomsList();
      showToast('New Channel Created', `#${room.id} is now available!`, 'info');
    });

    WS.on('error', (msg) => {
      showToast('WebSocket Notice', msg, 'error');
    });
  }

  function updateConnectionRibbon(statusClass, text) {
    if (!wsStatusRibbon) return;
    wsStatusRibbon.className = `connection-ribbon ${statusClass}`;
    if (wsStatusText) wsStatusText.textContent = text;
  }

  /* ==================== ROOMS MANAGEMENT ==================== */

  async function loadRooms() {
    try {
      const res = await API.getRooms();
      if (res.success && res.rooms) {
        state.rooms = res.rooms;
        renderRoomsList();
        if (badgeRoomsCount) badgeRoomsCount.textContent = state.rooms.length;
      }
    } catch (e) {
      console.error('Failed to load rooms:', e);
    }
  }

  function renderRoomsList(filter = '') {
    if (!roomsList) return;
    const filtered = state.rooms.filter(r => 
      r.name.toLowerCase().includes(filter.toLowerCase()) || 
      r.id.toLowerCase().includes(filter.toLowerCase())
    );

    if (filtered.length === 0) {
      roomsList.innerHTML = '<li class="empty-list-placeholder">No channels match filter.</li>';
      return;
    }

    roomsList.innerHTML = '';
    filtered.forEach(room => {
      const li = document.createElement('li');
      const isActive = state.activeChat.type === 'room' && state.activeChat.id === room.id;
      li.className = `channel-item ${isActive ? 'active' : ''}`;
      li.setAttribute('data-room-id', room.id);

      li.innerHTML = `
        <div class="item-left">
          <span class="channel-icon">${room.icon || '#'}</span>
          <span class="channel-name">${room.name}</span>
        </div>
      `;

      li.addEventListener('click', () => selectRoom(room.id));
      roomsList.appendChild(li);
    });
  }

  async function selectRoom(roomId) {
    const room = state.rooms.find(r => r.id === roomId);
    if (!room) return;

    state.activeChat = {
      type: 'room',
      id: room.id,
      name: `#${room.name}`,
      topic: room.topic || 'Company-wide discussion'
    };

    // Update UI Header
    if (targetAvatar) {
      targetAvatar.textContent = room.icon || '#';
      targetAvatar.style.background = 'rgba(44, 115, 210, 0.15)';
      targetAvatar.style.color = 'var(--color-primary)';
    }
    if (targetStatusDot) targetStatusDot.classList.add('hidden');
    if (targetName) targetName.textContent = `#${room.name}`;
    if (targetBadge) targetBadge.textContent = room.isDefault ? 'Public Channel' : 'Custom Room';
    if (targetTopic) targetTopic.textContent = room.topic;

    if (messageInput) messageInput.placeholder = `Message #${room.name}...`;

    // Highlight in list
    renderRoomsList();
    renderUsersList();

    // Close mobile drawer if open
    chatSidebar?.classList.remove('mobile-open');

    // Subscribe socket to room
    WS.joinRoom(room.id);

    // Load message history
    loadRoomMessages(room.id);
  }

  async function loadRoomMessages(roomId) {
    if (!messagesFeed) return;
    messagesFeed.innerHTML = '<div class="empty-chat-state"><div class="empty-icon">⏳</div><div class="empty-title">Loading message history...</div></div>';

    try {
      const res = await API.getRoomMessages(roomId);
      if (res.success) {
        renderMessageHistory(res.messages, 'room');
      }
    } catch (e) {
      messagesFeed.innerHTML = '<div class="empty-chat-state"><div class="empty-icon">⚠️</div><div class="empty-title">Failed to load messages</div></div>';
    }
  }

  /* ==================== USERS & DIRECT MESSAGING ==================== */

  async function loadUsers() {
    try {
      const res = await API.getUsers();
      if (res.success && res.users) {
        state.users = res.users;
        renderUsersList();
        updateOnlineCounter();
      }
    } catch (e) {
      console.error('Failed to load users:', e);
    }
  }

  function renderUsersList(filter = '') {
    if (!usersList) return;
    const filtered = state.users.filter(u => 
      u.name.toLowerCase().includes(filter.toLowerCase()) || 
      u.username.toLowerCase().includes(filter.toLowerCase())
    );

    if (filtered.length === 0) {
      usersList.innerHTML = '<li class="empty-list-placeholder">No users found.</li>';
      return;
    }

    usersList.innerHTML = '';
    filtered.forEach(user => {
      const li = document.createElement('li');
      const isActive = state.activeChat.type === 'direct' && state.activeChat.id === user.id;
      const unread = state.unreadDMs.get(user.id) || 0;

      li.className = `user-item ${isActive ? 'active' : ''}`;
      li.setAttribute('data-user-id', user.id);

      li.innerHTML = `
        <div class="item-left">
          <div class="user-item-avatar" style="background: ${user.avatarColor || 'var(--color-primary)'}">
            ${(user.name || 'U').charAt(0).toUpperCase()}
            <span class="status-indicator ${user.isOnline ? 'online' : ''}"></span>
          </div>
          <div class="user-item-details">
            <span class="user-item-name">${user.name}</span>
            <span class="user-item-status ${user.isOnline ? 'online' : ''}">
              ${user.isOnline ? 'Active Now' : 'Offline'}
            </span>
          </div>
        </div>
        ${unread > 0 ? `<span class="unread-badge">${unread}</span>` : ''}
      `;

      li.addEventListener('click', () => selectDirectUser(user.id));
      usersList.appendChild(li);
    });
  }

  async function selectDirectUser(userId) {
    const user = state.users.find(u => u.id === userId);
    if (!user) return;

    // Clear unread count for this user
    state.unreadDMs.delete(userId);
    updateTotalUnreadDMs();

    state.activeChat = {
      type: 'direct',
      id: user.id,
      name: user.name,
      handle: user.username,
      avatarColor: user.avatarColor,
      isOnline: user.isOnline
    };

    // Update UI Header
    if (targetAvatar) {
      targetAvatar.textContent = (user.name || 'U').charAt(0).toUpperCase();
      targetAvatar.style.background = user.avatarColor || 'var(--color-primary)';
      targetAvatar.style.color = 'white';
    }
    if (targetStatusDot) {
      targetStatusDot.classList.remove('hidden');
      targetStatusDot.className = `target-status-dot ${user.isOnline ? 'online' : ''}`;
    }
    if (targetName) targetName.textContent = user.name;
    if (targetBadge) targetBadge.textContent = 'Direct Message';
    if (targetTopic) targetTopic.textContent = user.isOnline ? '🟢 Currently Online' : '⚪ Offline / Last seen recently';

    if (messageInput) messageInput.placeholder = `Message ${user.name}...`;

    // Highlight in list
    renderUsersList();
    renderRoomsList();

    // Close mobile drawer
    chatSidebar?.classList.remove('mobile-open');

    // Load DM history
    loadDirectMessages(user.id);
  }

  function updateDirectHeaderStatus(isOnline) {
    if (targetStatusDot) {
      targetStatusDot.className = `target-status-dot ${isOnline ? 'online' : ''}`;
    }
    if (targetTopic) {
      targetTopic.textContent = isOnline ? '🟢 Currently Online' : '⚪ Offline / Last seen recently';
    }
  }

  async function loadDirectMessages(recipientId) {
    if (!messagesFeed) return;
    messagesFeed.innerHTML = '<div class="empty-chat-state"><div class="empty-icon">⏳</div><div class="empty-title">Loading direct messages...</div></div>';

    try {
      const res = await API.getDirectMessages(recipientId);
      if (res.success) {
        renderMessageHistory(res.messages, 'direct');
      }
    } catch (e) {
      messagesFeed.innerHTML = '<div class="empty-chat-state"><div class="empty-icon">⚠️</div><div class="empty-title">Failed to load conversation</div></div>';
    }
  }

  function updateOnlineCounter() {
    const count = state.users.filter(u => u.isOnline).length;
    if (onlineUsersCount) onlineUsersCount.textContent = `${count} online`;
  }

  function updateTotalUnreadDMs() {
    let total = 0;
    state.unreadDMs.forEach(val => total += val);

    if (badgeDmsUnread) {
      if (total > 0) {
        badgeDmsUnread.textContent = total;
        badgeDmsUnread.classList.remove('hidden');
      } else {
        badgeDmsUnread.classList.add('hidden');
      }
    }
  }

  /* ==================== MESSAGE STREAM RENDERING ==================== */

  function renderMessageHistory(messages, context) {
    if (!messagesFeed) return;
    messagesFeed.innerHTML = '';

    if (!messages || messages.length === 0) {
      const title = context === 'room' ? 'No messages in this channel yet' : 'Start your private conversation';
      const desc = context === 'room' ? 'Be the first to say hello and start the thread!' : 'Messages here are private between you and this user.';
      messagesFeed.innerHTML = `
        <div class="empty-chat-state">
          <div class="empty-icon">💬</div>
          <div class="empty-title">${title}</div>
          <div class="empty-desc">${desc}</div>
        </div>
      `;
      return;
    }

    messages.forEach(msg => {
      appendMessage(msg, false);
    });

    scrollToBottom();
  }

  function formatTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function appendMessage(message, shouldScroll = true) {
    if (!messagesFeed) return;

    // Remove empty state if present
    const emptyState = messagesFeed.querySelector('.empty-chat-state');
    if (emptyState) emptyState.remove();

    const isSelf = message.senderId === state.currentUser?.id;
    const group = document.createElement('div');
    group.className = `msg-group ${isSelf ? 'self' : ''}`;

    const authorInitials = (message.senderName || 'U').charAt(0).toUpperCase();
    const avatarColor = message.senderAvatarColor || 'var(--color-primary)';

    group.innerHTML = `
      <div class="msg-avatar" style="background: ${avatarColor}">
        ${authorInitials}
      </div>
      <div class="msg-body">
        <div class="msg-header">
          <span class="msg-author">${isSelf ? 'You' : message.senderName}</span>
          <span class="msg-time">${formatTime(message.timestamp)}</span>
        </div>
        <div class="msg-content">
          ${escapeHtml(message.text)}
          ${isSelf ? '<div class="msg-footer"><span class="delivery-check">✓✓</span></div>' : ''}
        </div>
      </div>
    `;

    messagesFeed.appendChild(group);

    if (shouldScroll) {
      scrollToBottom();
    }
  }

  function scrollToBottom() {
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /* ==================== TYPING INDICATOR ==================== */

  function toggleTypingBanner(userName, isTyping) {
    if (!typingBanner || !typingText) return;

    if (isTyping) {
      typingText.textContent = `${userName} is typing...`;
      typingBanner.classList.remove('hidden');
    } else {
      typingBanner.classList.add('hidden');
    }
  }

  /* ==================== COMPOSER & ACTIONS ==================== */

  function setupComposerHandlers() {
    // Send message submit
    messageForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      sendMessage();
    });

    // Enter to send, Shift+Enter for new line
    messageInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // Handle typing events
    messageInput?.addEventListener('input', () => {
      if (!state.isTypingSent) {
        state.isTypingSent = true;
        WS.sendTyping(state.activeChat.type, state.activeChat.id, true);
      }

      if (state.typingTimer) clearTimeout(state.typingTimer);
      state.typingTimer = setTimeout(() => {
        state.isTypingSent = false;
        WS.sendTyping(state.activeChat.type, state.activeChat.id, false);
      }, 1400);
    });

    // Emoji reaction chips
    document.querySelectorAll('.emoji-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const emoji = btn.getAttribute('data-emoji');
        if (messageInput) {
          messageInput.value += ` ${emoji} `;
          messageInput.focus();
        }
      });
    });
  }

  function sendMessage() {
    const text = messageInput.value.trim();
    if (!text) return;

    if (state.activeChat.type === 'room') {
      WS.sendRoomMessage(state.activeChat.id, text);
    } else if (state.activeChat.type === 'direct') {
      WS.sendDirectMessage(state.activeChat.id, text);
    }

    messageInput.value = '';
    messageInput.style.height = 'auto';

    // Clear typing timeout
    if (state.isTypingSent) {
      state.isTypingSent = false;
      WS.sendTyping(state.activeChat.type, state.activeChat.id, false);
    }
  }

  /* ==================== CREATE ROOM MODAL ==================== */

  function setupModalHandlers() {
    btnOpenCreateRoom?.addEventListener('click', () => {
      modalCreateRoom?.classList.remove('hidden');
      newRoomName?.focus();
    });

    btnCloseModal?.addEventListener('click', () => modalCreateRoom?.classList.add('hidden'));
    btnCancelCreateRoom?.addEventListener('click', () => modalCreateRoom?.classList.add('hidden'));

    createRoomForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = newRoomName.value.trim();
      const topic = newRoomTopic.value.trim();

      if (!name) return;

      try {
        const res = await API.createRoom(name, topic);
        modalCreateRoom?.classList.add('hidden');
        newRoomName.value = '';
        newRoomTopic.value = '';

        showToast('Room Created', `Joined #${res.room.id}`, 'success');
        selectRoom(res.room.id);
      } catch (err) {
        showToast('Failed to Create Room', err.data?.error || err.message, 'error');
      }
    });
  }

  /* ==================== GLOBAL CONTROLS ==================== */

  function setupGlobalControls() {
    // Sound toggle
    btnSoundToggle?.addEventListener('click', () => {
      const enabled = Sound.toggleSound();
      if (soundIcon) soundIcon.textContent = enabled ? '🔔' : '🔕';
      btnSoundToggle.classList.toggle('active', enabled);
      showToast('Sound Notifications', enabled ? 'Sound alert enabled.' : 'Muted notifications.', 'info');
    });

    // Logout
    btnLogout?.addEventListener('click', async () => {
      await API.logout();
      state.currentUser = null;
      showToast('Logged Out', 'Your chat session was terminated.', 'info');
      showAuthView();
    });

    // Sidebar navigation tabs
    tabNavRooms?.addEventListener('click', () => {
      tabNavRooms.classList.add('active');
      tabNavDMs.classList.remove('active');
      sectionRooms.classList.add('active-section');
      sectionDMs.classList.remove('active-section');
      channelSearchInput.placeholder = 'Filter channels...';
    });

    tabNavDMs?.addEventListener('click', () => {
      tabNavDMs.classList.add('active');
      tabNavRooms.classList.remove('active');
      sectionDMs.classList.add('active-section');
      sectionRooms.classList.remove('active-section');
      channelSearchInput.placeholder = 'Filter people...';
    });

    // Search filter
    channelSearchInput?.addEventListener('input', (e) => {
      const query = e.target.value;
      renderRoomsList(query);
      renderUsersList(query);
    });

    // Mobile sidebar drawer
    btnMobileSidebar?.addEventListener('click', () => {
      chatSidebar?.classList.toggle('mobile-open');
    });
  }

  /* ==================== INIT ==================== */

  async function init() {
    setupAuthHandlers();
    setupWebSocketListeners();
    setupComposerHandlers();
    setupModalHandlers();
    setupGlobalControls();

    // Check existing session
    const token = API.getToken();
    if (token) {
      try {
        const res = await API.getMe();
        if (res.success && res.user) {
          state.currentUser = res.user;
          showChatView();
          return;
        }
      } catch (e) {
        API.clearAuth();
      }
    }

    showAuthView();
  }

  return {
    init,
    state
  };
})();

// Bootstrap
document.addEventListener('DOMContentLoaded', () => {
  ChatApp.init();
});
