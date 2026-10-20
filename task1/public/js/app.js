/**
 * App Main Controller & Session Router
 * Coordinates view transitions, session lifecycle, and protected routing.
 */

const App = (() => {
  const authView = document.getElementById('auth-view');
  const dashboardView = document.getElementById('dashboard-view');

  function showAuthView() {
    dashboardView?.classList.remove('active-view');
    authView?.classList.add('active-view');
  }

  function showDashboardView() {
    authView?.classList.remove('active-view');
    dashboardView?.classList.add('active-view');
    Dashboard.loadDashboardData();
  }

  // Verify active session with backend
  async function checkSession() {
    const token = API.getToken();
    if (!token) {
      showAuthView();
      return;
    }

    try {
      const res = await API.getMe();
      if (res.success && res.user) {
        API.setUser(res.user);
        showDashboardView();
      } else {
        API.clearAuth();
        showAuthView();
      }
    } catch (err) {
      console.warn('Session verification failed:', err);
      API.clearAuth();
      showAuthView();
    }
  }

  function setupEventHandlers() {
    // Fired when user logs in or registers
    window.addEventListener('auth:success', (e) => {
      showDashboardView();
    });

    // Fired when user clicks logout
    window.addEventListener('auth:logout', () => {
      showAuthView();
    });

    // Fired when API responds with 401 Unauthorized
    window.addEventListener('auth:unauthorized', (e) => {
      API.clearAuth();
      showAuthView();
      showToast('Session Expired', 'Please sign in again to access protected resources.', 'error');
    });
  }

  function init() {
    Auth.init();
    Dashboard.init();
    setupEventHandlers();
    checkSession();
  }

  return {
    init,
    showAuthView,
    showDashboardView
  };
})();

// Bootstrap application on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
