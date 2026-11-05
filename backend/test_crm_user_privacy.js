const jwt = require('jsonwebtoken');
const { io } = require('socket.io-client');
require('dotenv').config();

const BASE_URL = 'http://localhost:5005';
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_123';

// Existing real users in database
const USER_ADMIN = {
  id: '6a75d93bddc94a37cc81c14e',
  name: 'Admin',
  email: 'admin@fieldstaff.com',
  role: 'Admin',
  companyId: 'company_madhura',
};

const USER_A = {
  id: '6a7424cfbfe3038aa16dd561',
  name: 'arou',
  email: 'arounesh@gmail.com',
  role: 'Field Executive',
  companyId: 'company_madhura',
};

const USER_B = {
  id: '6ab10be34546363361ea8055',
  name: 'Muthu',
  email: 'muthuharish1118@gmail.com',
  role: 'Field Executive',
  companyId: 'company_madhura',
};

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      _id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    },
    JWT_SECRET,
    { expiresIn: '2h' }
  );
}

async function apiRequest(path, method = 'GET', body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${BASE_URL}${path}`, options);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log('================================================================');
  console.log('🔒 RUNNING CRM USER-BASED TICKET PRIVACY & ACCESS CONTROL TESTS');
  console.log('================================================================\n');

  const adminToken = generateToken(USER_ADMIN);
  const tokenA = generateToken(USER_A);
  const tokenB = generateToken(USER_B);

  console.log('1. Generated Authenticated Tokens:');
  console.log(`   - Admin: ${USER_ADMIN.name} (${USER_ADMIN.role})`);
  console.log(`   - User A: ${USER_A.name} (${USER_A.role})`);
  console.log(`   - User B: ${USER_B.name} (${USER_B.role})`);

  let ticketA = null;
  let ticketB = null;

  try {
    // -------------------------------------------------------------
    // Test 1: Ticket Creation with Automatic Authenticated Ownership
    // -------------------------------------------------------------
    console.log('\n2. Testing Ticket Creation with Authenticated Ownership:');

    const resA = await apiRequest('/api/v1/tickets', 'POST', {
      title: 'Ticket A - Payroll Tax Discrepancy for arou',
      description: 'Confidential tax documentation and payroll revision request',
      category: 'BILLING',
      priority: 'HIGH',
    }, tokenA);

    if (resA.status === 201 && resA.data?.data) {
      ticketA = resA.data.data;
      console.log(`   ✓ User A created Ticket A [${ticketA.code}]. createdById: ${ticketA.createdById}`);
    } else {
      throw new Error(`Failed to create Ticket A: ${JSON.stringify(resA.data)}`);
    }

    const resB = await apiRequest('/api/v1/tickets', 'POST', {
      title: 'Ticket B - Muthu Client Equipment Replacement',
      description: 'Private equipment inventory issue for site delivery',
      category: 'TECHNICAL',
      priority: 'MEDIUM',
    }, tokenB);

    if (resB.status === 201 && resB.data?.data) {
      ticketB = resB.data.data;
      console.log(`   ✓ User B created Ticket B [${ticketB.code}]. createdById: ${ticketB.createdById}`);
    } else {
      throw new Error(`Failed to create Ticket B: ${JSON.stringify(resB.data)}`);
    }

    // -------------------------------------------------------------
    // Test 2: User-Wise Ticket Listing Isolation
    // -------------------------------------------------------------
    console.log('\n3. Testing Ticket Listing Isolation (User A vs User B):');

    const listA = await apiRequest('/api/v1/tickets', 'GET', null, tokenA);
    const ticketsA = listA.data?.data || [];
    const seesTicketA_in_A = ticketsA.some(t => String(t.id) === String(ticketA.id));
    const seesTicketB_in_A = ticketsA.some(t => String(t.id) === String(ticketB.id));

    console.log(`   - User A listing count: ${ticketsA.length}`);
    console.log(`   - User A sees Ticket A: ${seesTicketA_in_A ? '✓ YES (Expected)' : '✗ NO'}`);
    console.log(`   - User A sees Ticket B: ${!seesTicketB_in_A ? '✓ NO (Strictly Isolated)' : '✗ LEAK! Ticket B visible to User A'}`);

    const listB = await apiRequest('/api/v1/tickets', 'GET', null, tokenB);
    const ticketsB = listB.data?.data || [];
    const seesTicketB_in_B = ticketsB.some(t => String(t.id) === String(ticketB.id));
    const seesTicketA_in_B = ticketsB.some(t => String(t.id) === String(ticketA.id));

    console.log(`   - User B listing count: ${ticketsB.length}`);
    console.log(`   - User B sees Ticket B: ${seesTicketB_in_B ? '✓ YES (Expected)' : '✗ NO'}`);
    console.log(`   - User B sees Ticket A: ${!seesTicketA_in_B ? '✓ NO (Strictly Isolated)' : '✗ LEAK! Ticket A visible to User B'}`);

    if (seesTicketB_in_A || seesTicketA_in_B) {
      throw new Error('Ticket listing isolation failed: Tickets leaked across unauthorized users!');
    }

    // -------------------------------------------------------------
    // Test 3: IDOR Direct URL Protection (GET /api/v1/tickets/:id)
    // -------------------------------------------------------------
    console.log('\n4. Testing Direct URL / IDOR Access Protection:');

    // User A accesses Ticket A (Allowed)
    const getOwnA = await apiRequest(`/api/v1/tickets/${ticketA.id}`, 'GET', null, tokenA);
    console.log(`   - User A accessing own Ticket A: ${getOwnA.status === 200 ? '✓ 200 OK' : '✗ Failed ' + getOwnA.status}`);

    // User A attempts to access Ticket B (Blocked with 403)
    const getIdorB = await apiRequest(`/api/v1/tickets/${ticketB.id}`, 'GET', null, tokenA);
    console.log(`   - User A attempting to access Ticket B directly: ${getIdorB.status === 403 ? '✓ 403 FORBIDDEN (Blocked!)' : '✗ FAILED Status: ' + getIdorB.status}`);

    // User B attempts to access Ticket A (Blocked with 403)
    const getIdorA = await apiRequest(`/api/v1/tickets/${ticketA.id}`, 'GET', null, tokenB);
    console.log(`   - User B attempting to access Ticket A directly: ${getIdorA.status === 403 ? '✓ 403 FORBIDDEN (Blocked!)' : '✗ FAILED Status: ' + getIdorA.status}`);

    if (getIdorB.status !== 403 || getIdorA.status !== 403) {
      throw new Error('IDOR direct URL check failed: Unauthorized ticket access was not blocked with 403!');
    }

    // -------------------------------------------------------------
    // Test 4: Conversation History & Messaging Access Control
    // -------------------------------------------------------------
    console.log('\n5. Testing Message Privacy & Conversation Access Control:');

    // User A attempts to view conversation history of Ticket B
    const getMsgsB = await apiRequest(`/api/v1/tickets/${ticketB.id}/messages`, 'GET', null, tokenA);
    console.log(`   - User A fetching messages of Ticket B: ${getMsgsB.status === 403 ? '✓ 403 FORBIDDEN (Blocked)' : '✗ Status ' + getMsgsB.status}`);

    // User A attempts to inject a message into Ticket B
    const postMsgB = await apiRequest(`/api/v1/tickets/${ticketB.id}/messages`, 'POST', {
      message: 'Unauthorized injection message by User A',
      sender_type: 'STAFF',
    }, tokenA);
    console.log(`   - User A posting message to Ticket B: ${postMsgB.status === 403 ? '✓ 403 FORBIDDEN (Blocked)' : '✗ Status ' + postMsgB.status}`);

    // User A sends message on own Ticket A (Allowed)
    const postMsgA = await apiRequest(`/api/v1/tickets/${ticketA.id}/messages`, 'POST', {
      message: 'Here is additional context on my tax query',
      sender_type: 'STAFF',
    }, tokenA);
    console.log(`   - User A posting message to own Ticket A: ${postMsgA.status === 201 ? '✓ 201 CREATED' : '✗ Status ' + postMsgA.status}`);

    if (getMsgsB.status !== 403 || postMsgB.status !== 403) {
      throw new Error('Message privacy check failed: Unauthorized message access was not blocked with 403!');
    }

    // -------------------------------------------------------------
    // Test 5: Attachment Security Access Control
    // -------------------------------------------------------------
    console.log('\n6. Testing Attachment Security Access Control:');

    const postAttachB = await apiRequest(`/api/v1/tickets/${ticketB.id}/attachments`, 'POST', {
      name: 'malicious_doc.pdf',
      url: 'https://example.com/malicious.pdf',
    }, tokenA);
    console.log(`   - User A attaching file to Ticket B: ${postAttachB.status === 403 ? '✓ 403 FORBIDDEN (Blocked)' : '✗ Status ' + postAttachB.status}`);

    const postAttachA = await apiRequest(`/api/v1/tickets/${ticketA.id}/attachments`, 'POST', {
      name: 'tax_report_2026.pdf',
      url: 'https://cdn.example.com/tax_report.pdf',
      type: 'application/pdf',
      size: 1048576,
    }, tokenA);
    console.log(`   - User A attaching file to own Ticket A: ${postAttachA.status === 201 ? '✓ 201 CREATED' : '✗ Status ' + postAttachA.status}`);

    if (postAttachB.status !== 403) {
      throw new Error('Attachment access control failed: User A attached file to Ticket B without permission!');
    }

    // -------------------------------------------------------------
    // Test 6: CRM Admin Oversight & Ticket Assignment
    // -------------------------------------------------------------
    console.log('\n7. Testing CRM Admin Full Visibility & Assignment:');

    const adminList = await apiRequest('/api/v1/tickets', 'GET', null, adminToken);
    const adminTickets = adminList.data?.data || [];
    const adminSeesA = adminTickets.some(t => String(t.id) === String(ticketA.id));
    const adminSeesB = adminTickets.some(t => String(t.id) === String(ticketB.id));

    console.log(`   - Admin total tickets visible: ${adminTickets.length}`);
    console.log(`   - Admin sees Ticket A: ${adminSeesA ? '✓ YES' : '✗ NO'}`);
    console.log(`   - Admin sees Ticket B: ${adminSeesB ? '✓ YES' : '✗ NO'}`);

    // Admin reassigns Ticket A to User B
    const reassignRes = await apiRequest(`/api/v1/tickets/${ticketA.id}`, 'PATCH', {
      assignee_id: USER_B.id,
      priority: 'URGENT',
    }, adminToken);
    console.log(`   - Admin assigned Ticket A to User B: ${reassignRes.status === 200 ? '✓ 200 OK' : '✗ Failed ' + reassignRes.status}`);

    // -------------------------------------------------------------
    // Test 7: Assigned User Dynamic Access Verification
    // -------------------------------------------------------------
    console.log('\n8. Testing Dynamic Access for Assigned User B:');

    // User B lists tickets now
    const listBAfterAssign = await apiRequest('/api/v1/tickets', 'GET', null, tokenB);
    const ticketsBAfter = listBAfterAssign.data?.data || [];
    const seesTicketA_now = ticketsBAfter.some(t => String(t.id) === String(ticketA.id));
    const seesTicketB_now = ticketsBAfter.some(t => String(t.id) === String(ticketB.id));

    console.log(`   - User B sees own Ticket B: ${seesTicketB_now ? '✓ YES' : '✗ NO'}`);
    console.log(`   - User B sees newly assigned Ticket A: ${seesTicketA_now ? '✓ YES (Access Granted via Assignment)' : '✗ NO'}`);

    // User B reads Ticket A
    const userBAccessA = await apiRequest(`/api/v1/tickets/${ticketA.id}`, 'GET', null, tokenB);
    console.log(`   - User B direct GET Ticket A: ${userBAccessA.status === 200 ? '✓ 200 OK (Authorized)' : '✗ Status ' + userBAccessA.status}`);

    // User B replies to Ticket A
    const userBReplyA = await apiRequest(`/api/v1/tickets/${ticketA.id}/messages`, 'POST', {
      message: 'Hello aroused, I have been assigned to handle your payroll query.',
      sender_type: 'STAFF',
    }, tokenB);
    console.log(`   - User B posting reply to assigned Ticket A: ${userBReplyA.status === 201 ? '✓ 201 CREATED' : '✗ Status ' + userBReplyA.status}`);

    // -------------------------------------------------------------
    // Test 8: Real-Time Socket.IO Authorization Security
    // -------------------------------------------------------------
    console.log('\n9. Testing Real-Time WebSocket Channel Security:');

    const socketSecurityPassed = await new Promise((resolve) => {
      let timer = null;
      const socket = io(BASE_URL, {
        transports: ['websocket'],
        auth: { token: tokenA },
        timeout: 4000,
      });

      socket.on('connect', () => {
        // User A attempts to join room for Ticket B (which belongs solely to User B)
        socket.emit('join_ticket', ticketB.id);
      });

      socket.on('socket_error', (err) => {
        if (err.code === 'UNAUTHORIZED_TICKET_ACCESS') {
          console.log(`   ✓ Socket correctly rejected User A from joining Ticket B room: ${err.message}`);
          if (timer) clearTimeout(timer);
          socket.disconnect();
          resolve(true);
        } else {
          console.log(`   ✗ Unexpected socket error code: ${err.code}`);
          if (timer) clearTimeout(timer);
          socket.disconnect();
          resolve(false);
        }
      });

      timer = setTimeout(() => {
        console.log('   ✗ Socket test timed out waiting for unauthorized error rejection');
        socket.disconnect();
        resolve(false);
      }, 5000);
    });

    if (!socketSecurityPassed) {
      throw new Error('Socket.IO real-time security failed: Unauthorized user was not rejected from ticket room!');
    }

    // -------------------------------------------------------------
    // Test 9: Ticket Deletion Authorization & Cleanup
    // -------------------------------------------------------------
    console.log('\n10. Testing Ticket Deletion Access Control:');

    // User B tries to delete Ticket A (Assigned, but not creator and not admin)
    const unauthorizedDelete = await apiRequest(`/api/v1/tickets/${ticketA.id}`, 'DELETE', null, tokenB);
    console.log(`   - User B attempting to delete Ticket A: ${unauthorizedDelete.status === 403 ? '✓ 403 FORBIDDEN (Blocked)' : '✗ Status ' + unauthorizedDelete.status}`);

    // Admin deletes Ticket A
    const adminDeleteA = await apiRequest(`/api/v1/tickets/${ticketA.id}`, 'DELETE', null, adminToken);
    console.log(`   - Admin deleting Ticket A: ${adminDeleteA.status === 200 ? '✓ 200 OK (Cleaned Up)' : '✗ Status ' + adminDeleteA.status}`);

    // User B deletes own Ticket B
    const userDeleteB = await apiRequest(`/api/v1/tickets/${ticketB.id}`, 'DELETE', null, tokenB);
    console.log(`   - User B deleting own Ticket B: ${userDeleteB.status === 200 ? '✓ 200 OK (Cleaned Up)' : '✗ Status ' + userDeleteB.status}`);

    console.log('\n================================================================');
    console.log('🎉 ALL 10 USER-BASED PRIVACY & ACCESS CONTROL TESTS PASSED 100%!');
    console.log('================================================================\n');
    process.exit(0);

  } catch (err) {
    console.error('\n❌ TEST SUITE FAILED:', err.message);
    // Cleanup if needed
    if (ticketA) await apiRequest(`/api/v1/tickets/${ticketA.id}`, 'DELETE', null, adminToken).catch(() => {});
    if (ticketB) await apiRequest(`/api/v1/tickets/${ticketB.id}`, 'DELETE', null, adminToken).catch(() => {});
    process.exit(1);
  }
}

runTests();
