// Automated test script for real-time WebSocket chat application
const WebSocket = require('ws');
const http = require('http');

const PORT = 3001;
const BASE_URL = `http://localhost:${PORT}`;
const WS_URL = `ws://localhost:${PORT}`;

function makeHttpRequest(method, path, body = null, headers = {}) {
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
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function waitForWsMessage(ws, typeMatch) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timeout waiting for WS message of type "${typeMatch}"`));
    }, 5000);

    const onMessage = (data) => {
      try {
        const payload = JSON.parse(data.toString());
        if (payload.type === typeMatch) {
          clearTimeout(timeout);
          ws.removeListener('message', onMessage);
          resolve(payload);
        }
      } catch (e) {}
    };

    ws.on('message', onMessage);
  });
}

async function runTests() {
  console.log('--- Starting WebSocket Chat Automated Test Suite ---');
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

  let wsAlice = null;
  let wsBob = null;

  try {
    // 1. Health check
    const health = await makeHttpRequest('GET', '/api/health');
    assert(health.status === 200 && health.data.status === 'online', 'Health endpoint responds 200 OK');

    // 2. Register Alice
    const ts = Date.now();
    const aliceRes = await makeHttpRequest('POST', '/api/auth/register', {
      name: 'Alice Vance',
      username: `alice_${ts}`,
      email: `alice_${ts}@example.com`,
      password: 'AlicePassword#123'
    });
    assert(aliceRes.status === 201 && aliceRes.data.token, 'Alice registration succeeds with JWT token');
    const aliceToken = aliceRes.data.token;
    const aliceUser = aliceRes.data.user;

    // 3. Register Bob
    const bobRes = await makeHttpRequest('POST', '/api/auth/register', {
      name: 'Bob Miller',
      username: `bob_${ts}`,
      email: `bob_${ts}@example.com`,
      password: 'BobPassword#123'
    });
    assert(bobRes.status === 201 && bobRes.data.token, 'Bob registration succeeds with JWT token');
    const bobToken = bobRes.data.token;
    const bobUser = bobRes.data.user;

    // 4. Connect Alice via native WebSocket
    wsAlice = new WebSocket(WS_URL);
    await new Promise(r => wsAlice.on('open', r));
    assert(wsAlice.readyState === WebSocket.OPEN, 'Alice WebSocket connection established');

    // 5. Authenticate Alice socket
    wsAlice.send(JSON.stringify({ type: 'auth', token: aliceToken }));
    const aliceAuth = await waitForWsMessage(wsAlice, 'auth_success');
    assert(aliceAuth.user.id === aliceUser.id, 'Alice authenticated over WebSocket');

    // 6. Connect Bob via native WebSocket
    wsBob = new WebSocket(WS_URL);
    await new Promise(r => wsBob.on('open', r));
    assert(wsBob.readyState === WebSocket.OPEN, 'Bob WebSocket connection established');

    // Setup listener on Alice for Bob's online presence before Bob connects
    const alicePresencePromise = waitForWsMessage(wsAlice, 'presence');

    // 7. Authenticate Bob socket
    wsBob.send(JSON.stringify({ type: 'auth', token: bobToken }));
    const bobAuth = await waitForWsMessage(wsBob, 'auth_success');
    assert(bobAuth.user.id === bobUser.id, 'Bob authenticated over WebSocket');

    // 8. Verify Alice received Bob's 'online' presence broadcast
    const presenceMsg = await alicePresencePromise;
    assert(presenceMsg.userId === bobUser.id && presenceMsg.status === 'online', 'Alice received real-time presence broadcast (Bob is online)');

    // 9. Real-Time Room Message: Alice joins general and sends a message, Bob receives it
    wsAlice.send(JSON.stringify({ type: 'join_room', roomId: 'general' }));
    wsBob.send(JSON.stringify({ type: 'join_room', roomId: 'general' }));

    const bobRoomMsgPromise = waitForWsMessage(wsBob, 'room_message');
    const testRoomText = `Hello everyone in general! (${ts})`;
    wsAlice.send(JSON.stringify({
      type: 'room_message',
      roomId: 'general',
      text: testRoomText
    }));

    const receivedRoomMsg = await bobRoomMsgPromise;
    assert(
      receivedRoomMsg.roomId === 'general' &&
      receivedRoomMsg.message.text === testRoomText &&
      receivedRoomMsg.message.senderId === aliceUser.id,
      'Bob received Alice room message in real-time over WebSocket'
    );

    // 10. Real-Time Private 1-on-1 Direct Message: Alice sends DM to Bob
    const bobDmPromise = waitForWsMessage(wsBob, 'direct_message_received');
    const testDmText = `Hey Bob, this is a private direct message! (${ts})`;
    wsAlice.send(JSON.stringify({
      type: 'direct_message',
      recipientId: bobUser.id,
      text: testDmText
    }));

    const receivedDm = await bobDmPromise;
    assert(
      receivedDm.senderId === aliceUser.id &&
      receivedDm.message.text === testDmText &&
      receivedDm.message.targetId === bobUser.id,
      'Bob received Alice private direct message in real-time over WebSocket'
    );

    // 11. Real-Time Typing Indicator: Alice indicates typing to Bob
    const bobTypingPromise = waitForWsMessage(wsBob, 'user_typing');
    wsAlice.send(JSON.stringify({
      type: 'typing',
      targetType: 'direct',
      targetId: bobUser.id,
      isTyping: true
    }));

    const receivedTyping = await bobTypingPromise;
    assert(
      receivedTyping.targetType === 'direct' &&
      receivedTyping.user.id === aliceUser.id &&
      receivedTyping.isTyping === true,
      'Bob received Alice live typing indicator'
    );

    // 12. Create custom room via REST and verify WebSocket broadcast
    const bobRoomCreatedPromise = waitForWsMessage(wsBob, 'room_created');
    const customRoomRes = await makeHttpRequest('POST', '/api/chat/rooms', {
      name: `dev-ops-${ts}`,
      topic: 'Infrastructure & Kubernetes'
    }, {
      'Authorization': `Bearer ${aliceToken}`
    });
    assert(customRoomRes.status === 201 && customRoomRes.data.room.name === `dev-ops-${ts}`, 'Custom room created via API');

    const receivedRoomCreated = await bobRoomCreatedPromise;
    assert(receivedRoomCreated.room.id === `dev-ops-${ts}`, 'Bob received real-time room_created broadcast over WebSocket');

    console.log(`\n=============================================`);
    console.log(`Test Results: ${testsPassed}/${totalTests} Passed`);
    console.log(`=============================================`);

  } catch (err) {
    console.error('Test failed:', err);
  } finally {
    if (wsAlice) wsAlice.close();
    if (wsBob) wsBob.close();
  }
}

runTests();
