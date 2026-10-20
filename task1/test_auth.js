// Automated API verification script for NexusAuth
const http = require('http');

const BASE_URL = 'http://localhost:3000';

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- Starting Authentication Verification Test Suite ---');
  let testsPassed = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      testsPassed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
    }
  }

  try {
    // Test 1: Health check
    const health = await makeRequest('GET', '/api/health');
    assert(health.status === 200 && health.data.status === 'online', 'Health endpoint responds 200 OK');

    // Test 2: Protected route without auth token fails with 401
    const unauthDash = await makeRequest('GET', '/api/protected/dashboard');
    assert(unauthDash.status === 401 && unauthDash.data.code === 'AUTH_TOKEN_MISSING', 'Unauthenticated request to protected route is denied with 401');

    // Test 3: Registration with weak password fails with 400
    const weakReg = await makeRequest('POST', '/api/auth/register', {
      name: 'Weak User',
      email: 'weak@example.com',
      password: '123'
    });
    assert(weakReg.status === 400, 'Weak password registration rejected with 400 Bad Request');

    // Test 4: Valid user registration
    const testEmail = `testuser_${Date.now()}@example.com`;
    const regRes = await makeRequest('POST', '/api/auth/register', {
      name: 'Alex Morgan',
      email: testEmail,
      password: 'StrongPassword#2026'
    });
    assert(regRes.status === 201 && regRes.data.token && regRes.data.user.email === testEmail, 'Valid user registration succeeds with 201 Created and JWT');
    const token = regRes.data.token;

    // Test 5: Duplicate registration fails with 409
    const dupRes = await makeRequest('POST', '/api/auth/register', {
      name: 'Duplicate Alex',
      email: testEmail,
      password: 'StrongPassword#2026'
    });
    assert(dupRes.status === 409, 'Duplicate user registration rejected with 409 Conflict');

    // Test 6: Login with invalid password fails with 401
    const badLogin = await makeRequest('POST', '/api/auth/login', {
      email: testEmail,
      password: 'WrongPassword#9999'
    });
    assert(badLogin.status === 401, 'Login with incorrect password rejected with 401 Unauthorized');

    // Test 7: Login with valid credentials succeeds with 200 + token
    const goodLogin = await makeRequest('POST', '/api/auth/login', {
      email: testEmail,
      password: 'StrongPassword#2026'
    });
    assert(goodLogin.status === 200 && goodLogin.data.token, 'Login with correct credentials succeeds with 200 OK and JWT');

    // Test 8: Access protected dashboard with valid token
    const authDash = await makeRequest('GET', '/api/protected/dashboard', null, {
      'Authorization': `Bearer ${token}`
    });
    assert(authDash.status === 200 && authDash.data.data.metrics.securityScore === '98%', 'Authenticated access to /api/protected/dashboard returns 200 and metrics');

    // Test 9: Access protected vault with valid token
    const authVault = await makeRequest('GET', '/api/protected/vault', null, {
      'Authorization': `Bearer ${token}`
    });
    assert(authVault.status === 200 && Array.isArray(authVault.data.vault.secrets), 'Authenticated access to /api/protected/vault returns 200 and secret entries');

    // Test 10: Update profile name via protected route
    const updateRes = await makeRequest('PUT', '/api/protected/profile', { name: 'Alex Morgan Senior' }, {
      'Authorization': `Bearer ${token}`
    });
    assert(updateRes.status === 200 && updateRes.data.user.name === 'Alex Morgan Senior', 'Profile display name successfully updated via protected endpoint');

    console.log(`\n=============================================`);
    console.log(`Test Results: ${testsPassed}/${totalTests} Passed`);
    console.log(`=============================================`);

  } catch (err) {
    console.error('Test execution failed:', err);
  }
}

runTests();
