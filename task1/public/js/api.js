/**
 * API Service Module
 * Handles HTTP requests, JWT token management, and error handling.
 */

const API = (() => {
  const TOKEN_KEY = 'nexus_auth_token';
  const USER_KEY = 'nexus_auth_user';

  // Retrieve stored token
  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
  }

  // Store token
  function setToken(token, remember = false) {
    if (remember) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      sessionStorage.setItem(TOKEN_KEY, token);
    }
  }

  // Store user info cache
  function setUser(user, remember = false) {
    const data = JSON.stringify(user);
    if (remember) {
      localStorage.setItem(USER_KEY, data);
    } else {
      sessionStorage.setItem(USER_KEY, data);
    }
  }

  function getUser() {
    const raw = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
    try {
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  // Clear all auth storage
  function clearAuth() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  }

  // Core fetch wrapper
  async function request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(endpoint, {
        ...options,
        headers,
        credentials: 'include' // include cookies
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired or invalid
          window.dispatchEvent(new CustomEvent('auth:unauthorized', { detail: data }));
        }
        const error = new Error(data.error || `HTTP error ${response.status}`);
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (err) {
      throw err;
    }
  }

  // Auth endpoints
  async function register(name, email, password) {
    return request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    });
  }

  async function login(email, password) {
    return request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  }

  async function logout() {
    try {
      await request('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.warn('Logout request failed or server unreachable', e);
    } finally {
      clearAuth();
    }
  }

  async function getMe() {
    return request('/api/auth/me', { method: 'GET' });
  }

  // Protected endpoints
  async function getDashboard() {
    return request('/api/protected/dashboard', { method: 'GET' });
  }

  async function getVault() {
    return request('/api/protected/vault', { method: 'GET' });
  }

  async function updateProfile(name) {
    return request('/api/protected/profile', {
      method: 'PUT',
      body: JSON.stringify({ name })
    });
  }

  async function changePassword(currentPassword, newPassword) {
    return request('/api/protected/change-password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword })
    });
  }

  return {
    getToken,
    setToken,
    getUser,
    setUser,
    clearAuth,
    register,
    login,
    logout,
    getMe,
    getDashboard,
    getVault,
    updateProfile,
    changePassword
  };
})();

// Toast Notification Manager
function showToast(title, message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const iconMap = {
    success: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    error: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    info: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
  };

  toast.innerHTML = `
    ${iconMap[type] || iconMap.info}
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      <div class="toast-msg">${message}</div>
    </div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}
