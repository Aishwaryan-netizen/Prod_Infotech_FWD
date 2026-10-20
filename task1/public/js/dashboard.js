/**
 * Dashboard Controller Module
 * Handles protected route interactions, vault secrets, profile updates, and logout.
 */

const Dashboard = (() => {
  // DOM Elements
  const navUserName = document.getElementById('nav-user-name');
  const navUserRole = document.getElementById('nav-user-role');
  const navUserAvatar = document.getElementById('nav-user-avatar');
  const heroUserName = document.getElementById('hero-user-name');
  const heroUserEmail = document.getElementById('hero-user-email');
  const metricScore = document.getElementById('metric-score');
  const metricAuth = document.getElementById('metric-auth');
  const metricRole = document.getElementById('metric-role');
  const metricLastLogin = document.getElementById('metric-last-login');

  const logoutBtn = document.getElementById('logout-btn');
  const refreshVaultBtn = document.getElementById('refresh-vault-btn');
  const vaultTbody = document.getElementById('vault-items-tbody');

  // Sub-tabs
  const btnTabVault = document.getElementById('btn-tab-vault');
  const btnTabProfile = document.getElementById('btn-tab-profile');
  const btnTabAudit = document.getElementById('btn-tab-audit');
  const panelVault = document.getElementById('panel-vault');
  const panelProfile = document.getElementById('panel-profile');
  const panelAudit = document.getElementById('panel-audit');

  // Forms
  const updateProfileForm = document.getElementById('update-profile-form');
  const editName = document.getElementById('edit-name');
  const changePasswordForm = document.getElementById('change-password-form');
  const currentPassword = document.getElementById('current-password');
  const newPassword = document.getElementById('new-password');
  const activityTimeline = document.getElementById('activity-timeline-container');

  // Format dates cleanly
  function formatDate(isoString) {
    if (!isoString) return 'Just now';
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Load and render user dashboard state
  async function loadDashboardData() {
    try {
      const res = await API.getDashboard();
      if (!res.success) return;

      const { user, metrics, activityLogs } = res.data;

      // Update navbar
      if (navUserName) navUserName.textContent = user.name;
      if (navUserRole) navUserRole.textContent = user.role || 'Member';
      if (navUserAvatar) navUserAvatar.textContent = (user.name || 'U').charAt(0).toUpperCase();

      // Update hero
      if (heroUserName) heroUserName.textContent = user.name;
      if (heroUserEmail) heroUserEmail.textContent = user.email;

      // Update metrics
      if (metricScore) metricScore.textContent = metrics.securityScore || '98%';
      if (metricAuth) metricAuth.textContent = 'JWT Verified';
      if (metricRole) metricRole.textContent = user.role || 'Standard Member';
      if (metricLastLogin) metricLastLogin.textContent = `Last active: ${formatDate(user.lastLogin)}`;

      if (editName) editName.value = user.name;

      // Render audit logs
      renderActivityLogs(activityLogs);

      // Fetch vault
      loadVaultData();
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      showToast('Protected Access Denied', 'Unable to fetch protected data. Your session may have expired.', 'error');
    }
  }

  // Load Vault Data from Protected API
  async function loadVaultData() {
    if (!vaultTbody) return;
    vaultTbody.innerHTML = '<tr><td colspan="5" class="loading-cell">Contacting protected security vault...</td></tr>';

    try {
      const res = await API.getVault();
      if (!res.success || !res.vault?.secrets) {
        vaultTbody.innerHTML = '<tr><td colspan="5">No protected secrets available.</td></tr>';
        return;
      }

      vaultTbody.innerHTML = '';
      res.vault.secrets.forEach(secret => {
        const tr = document.createElement('tr');
        
        let envClass = 'env-production';
        if (secret.environment === 'Staging') envClass = 'env-staging';
        if (secret.environment === 'Global Webhook') envClass = 'env-webhook';

        tr.innerHTML = `
          <td><strong>${secret.name}</strong></td>
          <td><span class="env-tag ${envClass}">${secret.environment}</span></td>
          <td><code class="secret-key-cell">${secret.key}</code></td>
          <td>${secret.lastRotated}</td>
          <td>
            <button class="copy-btn" data-key="${secret.key}">
              Copy Secret
            </button>
          </td>
        `;

        const copyBtn = tr.querySelector('.copy-btn');
        copyBtn.addEventListener('click', () => {
          navigator.clipboard.writeText(secret.key).then(() => {
            copyBtn.textContent = 'Copied!';
            showToast('Secret Copied', `Copied token for ${secret.name}`, 'info');
            setTimeout(() => { copyBtn.textContent = 'Copy Secret'; }, 2000);
          });
        });

        vaultTbody.appendChild(tr);
      });
    } catch (err) {
      vaultTbody.innerHTML = '<tr><td colspan="5" style="color: var(--color-terracotta);">Failed to load protected vault secrets (Unauthorized).</td></tr>';
    }
  }

  // Render Activity Log entries
  function renderActivityLogs(logs) {
    if (!activityTimeline) return;
    if (!logs || logs.length === 0) {
      activityTimeline.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem;">No security events logged yet.</p>';
      return;
    }

    activityTimeline.innerHTML = '';
    logs.forEach(log => {
      const item = document.createElement('div');
      item.className = 'timeline-item';

      const isAlert = log.action.includes('FAILED');
      const dotClass = isAlert ? 'timeline-dot alert' : 'timeline-dot';

      item.innerHTML = `
        <div class="${dotClass}"></div>
        <div class="timeline-content">
          <div class="timeline-action">${formatActionTitle(log.action)}</div>
          <div class="timeline-details">${log.details}</div>
          <div class="timeline-time">${formatDate(log.timestamp)}</div>
        </div>
      `;
      activityTimeline.appendChild(item);
    });
  }

  function formatActionTitle(action) {
    const map = {
      'ACCOUNT_CREATED': '🎉 Account Successfully Created',
      'LOGIN_SUCCESS': '🔐 Successful Authentication via JWT',
      'LOGIN_FAILED': '⚠️ Failed Authentication Attempt',
      'PROFILE_UPDATED': '👤 Account Profile Name Updated',
      'PASSWORD_CHANGED': '🛡️ Master Password Re-encrypted'
    };
    return map[action] || action;
  }

  // Switch tabs inside dashboard
  function switchDashboardTab(tabName) {
    [btnTabVault, btnTabProfile, btnTabAudit].forEach(btn => btn?.classList.remove('active'));
    [panelVault, panelProfile, panelAudit].forEach(panel => panel?.classList.remove('active'));

    if (tabName === 'vault') {
      btnTabVault?.classList.add('active');
      panelVault?.classList.add('active');
    } else if (tabName === 'profile') {
      btnTabProfile?.classList.add('active');
      panelProfile?.classList.add('active');
    } else if (tabName === 'audit') {
      btnTabAudit?.classList.add('active');
      panelAudit?.classList.add('active');
    }
  }

  function init() {
    // Tab switching
    btnTabVault?.addEventListener('click', () => switchDashboardTab('vault'));
    btnTabProfile?.addEventListener('click', () => switchDashboardTab('profile'));
    btnTabAudit?.addEventListener('click', () => switchDashboardTab('audit'));

    refreshVaultBtn?.addEventListener('click', () => {
      showToast('Vault Refresh', 'Re-evaluating cryptographic clearance...', 'info');
      loadVaultData();
    });

    // Profile update form
    updateProfileForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = editName.value.trim();
      if (!name) return;

      try {
        const res = await API.updateProfile(name);
        API.setUser(res.user);
        if (navUserName) navUserName.textContent = res.user.name;
        if (heroUserName) heroUserName.textContent = res.user.name;
        showToast('Profile Updated', 'Display name updated successfully!', 'success');
        loadDashboardData();
      } catch (err) {
        showToast('Update Failed', err.data?.error || err.message, 'error');
      }
    });

    // Change password form
    changePasswordForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const curr = currentPassword.value;
      const next = newPassword.value;

      if (!curr || !next) {
        showToast('Validation Error', 'Please fill in both password fields.', 'error');
        return;
      }

      try {
        await API.changePassword(curr, next);
        currentPassword.value = '';
        newPassword.value = '';
        showToast('Password Updated', 'Your master password was changed successfully!', 'success');
        loadDashboardData();
      } catch (err) {
        showToast('Password Change Failed', err.data?.error || err.message, 'error');
      }
    });

    // Sign out button
    logoutBtn?.addEventListener('click', async () => {
      await API.logout();
      showToast('Signed Out', 'Your session has been securely terminated.', 'info');
      window.dispatchEvent(new CustomEvent('auth:logout'));
    });
  }

  return {
    init,
    loadDashboardData
  };
})();
