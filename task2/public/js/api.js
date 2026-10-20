/**
 * REST API Client & Session Service
 */

const API = (() => {
  const TOKEN_KEY = 'nexus_chat_token';
  const USER_KEY = 'nexus_chat_user';

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
  }

  function setAuth(token, user, remember = true) {
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem(TOKEN_KEY, token);
    storage.setItem(USER_KEY, JSON.stringify(user));
  }

  function getUser() {
    const raw = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
    try {
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function clearAuth() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  }

  async function request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(endpoint, {
      ...options,
      headers,
      credentials: 'include'
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const err = new Error(data.error || `HTTP Error ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;
  }

  // Auth endpoints
  function register(name, username, email, password) {
    return request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, username, email, password })
    });
  }

  function login(loginId, password) {
    return request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ loginId, password })
    });
  }

  function getMe() {
    return request('/api/auth/me', { method: 'GET' });
  }

  function logout() {
    return request('/api/auth/logout', { method: 'POST' }).finally(() => clearAuth());
  }

  // Chat endpoints
  function getRooms() {
    return request('/api/chat/rooms');
  }

  function createRoom(name, topic) {
    return request('/api/chat/rooms', {
      method: 'POST',
      body: JSON.stringify({ name, topic })
    });
  }

  function getRoomMessages(roomId) {
    return request(`/api/chat/rooms/${encodeURIComponent(roomId)}/messages`);
  }

  function getUsers() {
    return request('/api/chat/users');
  }

  function getDirectMessages(recipientId) {
    return request(`/api/chat/direct/${encodeURIComponent(recipientId)}/messages`);
  }

  return {
    getToken,
    setAuth,
    getUser,
    clearAuth,
    register,
    login,
    getMe,
    logout,
    getRooms,
    createRoom,
    getRoomMessages,
    getUsers,
    getDirectMessages
  };
})();

// Toast Notification Utility
function showToast(title, desc = '', type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      ${desc ? `<div class="toast-desc">${desc}</div>` : ''}
    </div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 250);
  }, 4000);
}
