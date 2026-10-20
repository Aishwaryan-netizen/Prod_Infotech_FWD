/**
 * Auth Controller Module
 * Handles login & registration forms, client validation, live strength meter, and tab switching.
 */

const Auth = (() => {
  // DOM Elements
  const tabLoginBtn = document.getElementById('tab-login-btn');
  const tabRegBtn = document.getElementById('tab-register-btn');
  const tabSlider = document.getElementById('tab-slider');
  const loginContainer = document.getElementById('login-form-container');
  const registerContainer = document.getElementById('register-form-container');
  const authTitle = document.getElementById('auth-title');
  const authSubtitle = document.getElementById('auth-subtitle');

  const loginForm = document.getElementById('login-form');
  const loginEmail = document.getElementById('login-email');
  const loginPassword = document.getElementById('login-password');
  const rememberMe = document.getElementById('remember-me');
  const loginSubmitBtn = document.getElementById('login-submit-btn');
  const loginSpinner = document.getElementById('login-spinner');
  const loginEmailErr = document.getElementById('login-email-error');
  const loginPasswordErr = document.getElementById('login-password-error');
  const demoCredentialsBtn = document.getElementById('demo-credentials-btn');

  const registerForm = document.getElementById('register-form');
  const regName = document.getElementById('reg-name');
  const regEmail = document.getElementById('reg-email');
  const regPassword = document.getElementById('reg-password');
  const regConfirmPassword = document.getElementById('reg-confirm-password');
  const registerSubmitBtn = document.getElementById('register-submit-btn');
  const registerSpinner = document.getElementById('register-spinner');
  const regNameErr = document.getElementById('reg-name-error');
  const regEmailErr = document.getElementById('reg-email-error');
  const regPasswordErr = document.getElementById('reg-password-error');
  const regConfirmErr = document.getElementById('reg-confirm-error');

  const strengthBox = document.getElementById('strength-meter-box');
  const strengthText = document.getElementById('strength-text');
  const ruleLength = document.getElementById('rule-length');
  const ruleLower = document.getElementById('rule-lower');
  const ruleUpper = document.getElementById('rule-upper');
  const ruleNumber = document.getElementById('rule-number');
  const ruleSymbol = document.getElementById('rule-symbol');

  // Password visibility toggles
  function setupPasswordToggles() {
    setupToggle('toggle-login-password', 'login-password');
    setupToggle('toggle-reg-password', 'reg-password');
  }

  function setupToggle(btnId, inputId) {
    const btn = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    if (!btn || !input) return;

    btn.addEventListener('click', () => {
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';

      const eyeOpen = btn.querySelector('.eye-open');
      const eyeClosed = btn.querySelector('.eye-closed');

      if (eyeOpen && eyeClosed) {
        eyeOpen.classList.toggle('hidden', isPassword);
        eyeClosed.classList.toggle('hidden', !isPassword);
      }
    });
  }

  // Switch between tabs
  function switchTab(target) {
    if (target === 'login') {
      tabLoginBtn.classList.add('active');
      tabLoginBtn.setAttribute('aria-selected', 'true');
      tabRegBtn.classList.remove('active');
      tabRegBtn.setAttribute('aria-selected', 'false');
      tabSlider.classList.remove('slide-right');

      loginContainer.classList.add('active-form');
      registerContainer.classList.remove('active-form');

      authTitle.textContent = 'Welcome Back';
      authSubtitle.textContent = 'Sign in to access your protected workspace and secure credentials.';
    } else {
      tabRegBtn.classList.add('active');
      tabRegBtn.setAttribute('aria-selected', 'true');
      tabLoginBtn.classList.remove('active');
      tabLoginBtn.setAttribute('aria-selected', 'false');
      tabSlider.classList.add('slide-right');

      registerContainer.classList.add('active-form');
      loginContainer.classList.remove('active-form');

      authTitle.textContent = 'Create Master Account';
      authSubtitle.textContent = 'Join the secure perimeter. Passwords are protected with salted bcrypt.';
    }
  }

  // Real-time password evaluation
  function evaluatePassword(password) {
    const rules = {
      length: password.length >= 8,
      lower: /[a-z]/.test(password),
      upper: /[A-Z]/.test(password),
      number: /[0-9]/.test(password),
      symbol: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    };

    updateRuleItem(ruleLength, rules.length);
    updateRuleItem(ruleLower, rules.lower);
    updateRuleItem(ruleUpper, rules.upper);
    updateRuleItem(ruleNumber, rules.number);
    updateRuleItem(ruleSymbol, rules.symbol);

    const passedCount = Object.values(rules).filter(Boolean).length;

    strengthBox.className = 'strength-meter-container';

    if (password.length === 0) {
      strengthText.textContent = 'Too Short';
    } else if (passedCount <= 2) {
      strengthBox.classList.add('strength-weak');
      strengthText.textContent = 'Weak';
    } else if (passedCount === 3) {
      strengthBox.classList.add('strength-fair');
      strengthText.textContent = 'Fair';
    } else if (passedCount === 4) {
      strengthBox.classList.add('strength-good');
      strengthText.textContent = 'Good';
    } else {
      strengthBox.classList.add('strength-strong');
      strengthText.textContent = 'Strong';
    }

    return { isValid: passedCount === 5, passedCount };
  }

  function updateRuleItem(element, isValid) {
    if (!element) return;
    const icon = element.querySelector('.rule-icon');
    if (isValid) {
      element.classList.add('valid');
      if (icon) icon.textContent = '✓';
    } else {
      element.classList.remove('valid');
      if (icon) icon.textContent = '○';
    }
  }

  // Clear errors
  function clearErrors() {
    [loginEmailErr, loginPasswordErr, regNameErr, regEmailErr, regPasswordErr, regConfirmErr].forEach(el => {
      if (el) el.textContent = '';
    });
  }

  // Bind event listeners
  function init() {
    setupPasswordToggles();

    tabLoginBtn?.addEventListener('click', () => switchTab('login'));
    tabRegBtn?.addEventListener('click', () => switchTab('register'));

    // Real-time password strength listener
    regPassword?.addEventListener('input', (e) => {
      evaluatePassword(e.target.value);
    });

    // Demo credentials autofill button
    demoCredentialsBtn?.addEventListener('click', () => {
      loginEmail.value = 'alex.security@company.com';
      loginPassword.value = 'CipherShield#2026';
      showToast('Demo Credentials Filled', 'Click "Authenticate & Enter" to sign in with demo credentials.', 'info');
    });

    // Handle Login Form Submit
    loginForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors();

      const email = loginEmail.value.trim();
      const password = loginPassword.value;
      const remember = rememberMe?.checked || false;

      let hasError = false;
      if (!email) {
        loginEmailErr.textContent = 'Email address is required.';
        hasError = true;
      }
      if (!password) {
        loginPasswordErr.textContent = 'Password is required.';
        hasError = true;
      }

      if (hasError) return;

      // Disable button and show spinner
      loginSubmitBtn.disabled = true;
      loginSpinner.classList.remove('hidden');

      try {
        const res = await API.login(email, password);
        API.setToken(res.token, remember);
        API.setUser(res.user, remember);

        showToast('Authentication Successful', `Welcome back, ${res.user.name}!`, 'success');
        
        // Notify App to switch views
        window.dispatchEvent(new CustomEvent('auth:success', { detail: res.user }));
      } catch (err) {
        const errorMsg = err.data?.error || err.message || 'Invalid credentials.';
        loginPasswordErr.textContent = errorMsg;
        showToast('Authentication Failed', errorMsg, 'error');
      } finally {
        loginSubmitBtn.disabled = false;
        loginSpinner.classList.add('hidden');
      }
    });

    // Handle Registration Form Submit
    registerForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors();

      const name = regName.value.trim();
      const email = regEmail.value.trim();
      const password = regPassword.value;
      const confirmPassword = regConfirmPassword.value;

      let hasError = false;

      if (!name) {
        regNameErr.textContent = 'Full name is required.';
        hasError = true;
      }
      if (!email) {
        regEmailErr.textContent = 'Email is required.';
        hasError = true;
      }

      const strength = evaluatePassword(password);
      if (!strength.isValid) {
        regPasswordErr.textContent = 'Please meet all 5 security requirements above.';
        hasError = true;
      }

      if (password !== confirmPassword) {
        regConfirmErr.textContent = 'Passwords do not match.';
        hasError = true;
      }

      if (hasError) return;

      registerSubmitBtn.disabled = true;
      registerSpinner.classList.remove('hidden');

      try {
        const res = await API.register(name, email, password);
        API.setToken(res.token, false);
        API.setUser(res.user, false);

        showToast('Account Created!', `Welcome to NexusAuth, ${res.user.name}!`, 'success');

        window.dispatchEvent(new CustomEvent('auth:success', { detail: res.user }));
      } catch (err) {
        const errorMsg = err.data?.error || err.message || 'Registration failed.';
        regEmailErr.textContent = errorMsg;
        showToast('Registration Error', errorMsg, 'error');
      } finally {
        registerSubmitBtn.disabled = false;
        registerSpinner.classList.add('hidden');
      }
    });
  }

  return {
    init,
    switchTab
  };
})();
