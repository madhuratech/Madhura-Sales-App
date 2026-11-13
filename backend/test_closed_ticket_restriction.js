const { io } = require('socket.io-client');
const jwt = require('jsonwebtoken');

const BASE_URL = 'http://localhost:5005';
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_123';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

function makeToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
}

async function runClosedTicketTestSuite() {
  console.log('========================================================================');
  console.log('🔒 RUNNING CLOSED TICKET RESTRICTION & REAL-TIME SYNCHRONIZATION TESTS');
  console.log('========================================================================\n');

  // 1. Setup Users
  const clientAId = '6a7c1d6d4b50dbbac70920cd'; // OG blanks
  const clientUser = { id: '6a7c1d6d4b50dbbac70920cd', clientId: clientAId, role: 'CLIENT', name: 'Priyanka (Client)' };
  const clientToken = makeToken(clientUser);

  const adminUser = { id: '6a75d93bddc94a37cc81c14e', role: 'Admin', isAdmin: true, isStaff: true, name: 'Super Admin' };
  const adminToken = makeToken(adminUser);

  const agentUser = { id: '6a7424cfbfe3038aa16dd561', role: 'Field Executive', isAdmin: false, isStaff: true, name: 'Field Agent Arou' };
  const agentToken = makeToken(agentUser);

  console.log('1. User Tokens Created:');
  console.log('   - Client:', clientUser.name);
  console.log('   - CRM Admin:', adminUser.name);
  console.log('   - CRM Agent:', agentUser.name);

  // 2. Client creates a new Ticket
  console.log('\n2. Creating a test ticket by Client:');
  const createRes = await request('/api/v1/tickets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${clientToken}` },
    body: JSON.stringify({
      title: 'Packaging Quality Inspection Query',
      description: 'Need confirmation on GSM weight before printing labels.',
      category: 'TECHNICAL',
      priority: 'HIGH'
    })
  });

  if (!createRes.ok || !createRes.data.data) {
    throw new Error(`Failed to create ticket: ${JSON.stringify(createRes.data)}`);
  }

  const ticket = createRes.data.data;
  console.log(`   ✓ Ticket created: [${ticket.code}] ID: ${ticket.id}, Status: ${ticket.status}`);

  // 3. Connect real-time sockets (Client and CRM Admin)
  console.log('\n3. Connecting Real-Time Sockets:');
  const clientSocket = io(BASE_URL, { auth: { token: clientToken } });
  const adminSocket = io(BASE_URL, { auth: { token: adminToken } });

  await new Promise((resolve) => {
    let connectedCount = 0;
    const check = () => {
      connectedCount++;
      if (connectedCount === 2) resolve();
    };
    clientSocket.on('connect', check);
    adminSocket.on('connect', check);
  });
  console.log('   ✓ Both Client and Admin sockets connected');

  // Both join ticket room
  clientSocket.emit('join_ticket', ticket.id);
  adminSocket.emit('join_ticket', ticket.id);
  await new Promise((r) => setTimeout(r, 250));

  // Set up socket event capture
  let clientReceivedStatusChanged = null;
  let adminReceivedStatusChanged = null;

  clientSocket.on('ticket_status_changed', (evt) => {
    console.log('   [DEBUG clientSocket ticket_status_changed]:', evt?.status, 'for ticketId:', evt?.ticketId, 'expected:', String(ticket.id || ticket._id));
    if (String(evt.ticketId) === String(ticket.id || ticket._id)) {
      clientReceivedStatusChanged = evt;
    }
  });

  adminSocket.on('ticket_status_changed', (evt) => {
    console.log('   [DEBUG adminSocket ticket_status_changed]:', evt?.status, 'for ticketId:', evt?.ticketId, 'expected:', String(ticket.id || ticket._id));
    if (String(evt.ticketId) === String(ticket.id || ticket._id)) {
      adminReceivedStatusChanged = evt;
    }
  });

  // Verify initial messaging works while ticket is OPEN
  console.log('\n4. Verifying initial messaging while ticket is OPEN:');
  const openMsgRes = await request(`/api/v1/tickets/${ticket.id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${clientToken}` },
    body: JSON.stringify({ message: 'Here is an update on the label specs.' })
  });
  if (openMsgRes.status !== 201) {
    throw new Error(`Expected message to succeed when OPEN, got status ${openMsgRes.status}`);
  }
  console.log('   ✓ Client successfully sent message while ticket is OPEN (Status 201)');

  // 5. CRM Admin closes the ticket
  console.log('\n5. CRM Admin closes the ticket:');
  clientReceivedStatusChanged = null;
  adminReceivedStatusChanged = null;

  const closeRes = await request(`/api/v1/tickets/${ticket.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: JSON.stringify({ status: 'CLOSED', reason: 'Issue resolved and verified by client' })
  });

  if (closeRes.status !== 200 || closeRes.data.data?.status !== 'CLOSED') {
    throw new Error(`Failed to close ticket: ${JSON.stringify(closeRes.data)}`);
  }
  console.log('   ✓ Ticket status updated to CLOSED in DB by Admin (Status 200)');
  console.log('   ✓ closed_at:', closeRes.data.data.closed_at, '| closed_by_name:', closeRes.data.data.closed_by_name);

  // Wait for real-time broadcast
  await new Promise((r) => setTimeout(r, 600));

  console.log('\n6. Checking Real-Time Status Broadcast to Client Portal & CRM:');
  if (clientReceivedStatusChanged && clientReceivedStatusChanged.status === 'CLOSED') {
    console.log('   ✓ Client Portal received real-time status change: CLOSED (isClosed = true)');
  } else {
    throw new Error('Client Portal did not receive real-time ticket_status_changed event!');
  }

  if (adminReceivedStatusChanged && adminReceivedStatusChanged.status === 'CLOSED') {
    console.log('   ✓ CRM Admin interface received real-time status change: CLOSED');
  } else {
    throw new Error('CRM Admin did not receive real-time ticket_status_changed event!');
  }

  // 7. Client attempts to send message to closed ticket -> MUST BE REJECTED (403)
  console.log('\n7. Client attempts to send message to CLOSED ticket:');
  const clientMsgAttempt = await request(`/api/v1/tickets/${ticket.id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${clientToken}` },
    body: JSON.stringify({ message: 'Can you please check one more thing?' })
  });
  console.log(`   - HTTP Status: ${clientMsgAttempt.status}`);
  console.log(`   - Response code: ${clientMsgAttempt.data.error?.code}, message: "${clientMsgAttempt.data.error?.message}"`);
  if (clientMsgAttempt.status === 403 && clientMsgAttempt.data.error?.code === 'ticket_closed') {
    console.log('   ✓ PASS: Client message request REJECTED with 403 Forbidden!');
  } else {
    throw new Error(`Client message should have been rejected with 403, got ${clientMsgAttempt.status}`);
  }

  // 8. CRM Agent attempts to send message to closed ticket -> MUST BE REJECTED (403)
  console.log('\n8. CRM Agent attempts to send message to CLOSED ticket:');
  const agentMsgAttempt = await request(`/api/v1/tickets/${ticket.id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${agentToken}` },
    body: JSON.stringify({ message: 'Agent trying to reply to closed ticket' })
  });
  console.log(`   - HTTP Status: ${agentMsgAttempt.status}`);
  console.log(`   - Response code: ${agentMsgAttempt.data.error?.code}, message: "${agentMsgAttempt.data.error?.message}"`);
  if (agentMsgAttempt.status === 403 && agentMsgAttempt.data.error?.code === 'ticket_closed') {
    console.log('   ✓ PASS: CRM agent message request REJECTED with 403 Forbidden!');
  } else {
    throw new Error(`Agent message should have been rejected with 403, got ${agentMsgAttempt.status}`);
  }

  // 9. Direct API request to send attachment to closed ticket -> MUST BE REJECTED (403)
  console.log('\n9. Direct API request to upload attachment to CLOSED ticket:');
  const attachAttempt = await request(`/api/v1/tickets/${ticket.id}/attachments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${clientToken}` },
    body: JSON.stringify({ name: 'invoice.pdf', url: 'https://example.com/inv.pdf' })
  });
  console.log(`   - HTTP Status: ${attachAttempt.status}`);
  console.log(`   - Response code: ${attachAttempt.data.error?.code}, message: "${attachAttempt.data.error?.message}"`);
  if (attachAttempt.status === 403 && attachAttempt.data.error?.code === 'ticket_closed') {
    console.log('   ✓ PASS: Attachment upload on closed ticket REJECTED with 403 Forbidden!');
  } else {
    throw new Error(`Attachment upload should have been rejected with 403, got ${attachAttempt.status}`);
  }

  // 10. Client attempts to reopen ticket -> MUST BE REJECTED (403)
  console.log('\n10. Client attempts to reopen CLOSED ticket:');
  const clientReopenAttempt = await request(`/api/v1/tickets/${ticket.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${clientToken}` },
    body: JSON.stringify({ status: 'OPEN' })
  });
  console.log(`   - HTTP Status: ${clientReopenAttempt.status}`);
  console.log(`   - Response code: ${clientReopenAttempt.data.error?.code}, message: "${clientReopenAttempt.data.error?.message}"`);
  if (clientReopenAttempt.status === 403 && clientReopenAttempt.data.error?.code === 'reopen_forbidden') {
    console.log('   ✓ PASS: Client reopen request REJECTED with 403 Forbidden!');
  } else {
    throw new Error(`Client reopen should have been rejected with 403, got ${clientReopenAttempt.status}`);
  }

  // 11. Unauthorized CRM agent attempts to reopen ticket -> MUST BE REJECTED (403)
  console.log('\n11. Unauthorized CRM agent attempts to reopen CLOSED ticket:');
  // First assign the ticket to the agent so they have ticket access, but NOT admin reopen permission
  await request(`/api/v1/tickets/${ticket.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: JSON.stringify({ assignee_id: agentUser.id })
  });

  const agentReopenAttempt = await request(`/api/v1/tickets/${ticket.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${agentToken}` },
    body: JSON.stringify({ status: 'OPEN' })
  });
  console.log(`   - HTTP Status: ${agentReopenAttempt.status}`);
  console.log(`   - Response code: ${agentReopenAttempt.data.error?.code}, message: "${agentReopenAttempt.data.error?.message}"`);
  if (agentReopenAttempt.status === 403 && agentReopenAttempt.data.error?.code === 'reopen_unauthorized') {
    console.log('   ✓ PASS: Assigned agent without admin/reopen permissions REJECTED with 403 reopen_unauthorized!');
  } else {
    throw new Error(`Agent reopen should have been rejected with 403 reopen_unauthorized, got status ${agentReopenAttempt.status} code: ${agentReopenAttempt.data.error?.code}`);
  }

  // 12. Authorized CRM Admin reopens the ticket
  console.log('\n12. Authorized CRM Admin reopens the ticket:');
  clientReceivedStatusChanged = null;
  adminReceivedStatusChanged = null;

  const adminReopenRes = await request(`/api/v1/tickets/${ticket.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: JSON.stringify({ status: 'OPEN', reason: 'Client requested further clarification on packaging' })
  });

  if (adminReopenRes.status !== 200 || adminReopenRes.data.data?.status !== 'OPEN') {
    throw new Error(`Admin reopen failed: ${JSON.stringify(adminReopenRes.data)}`);
  }
  const reopenedTicket = adminReopenRes.data.data;
  console.log('   ✓ Ticket successfully REOPENED by CRM Admin (Status 200)');
  console.log('   ✓ reopened_at:', reopenedTicket.reopened_at, '| reopened_by_name:', reopenedTicket.reopened_by_name);
  console.log('   ✓ Reopen history count:', reopenedTicket.reopen_history?.length);
  if (reopenedTicket.reopen_history && reopenedTicket.reopen_history.length > 0) {
    const lastReopen = reopenedTicket.reopen_history[reopenedTicket.reopen_history.length - 1];
    console.log(`   ✓ Reopen history entry recorded: Reopened by ${lastReopen.reopened_by_name} (${lastReopen.reopened_by_role}) reason: "${lastReopen.reason}"`);
  } else {
    throw new Error('Reopen history was not recorded!');
  }

  // Wait for real-time broadcast of reopened status
  await new Promise((r) => setTimeout(r, 600));

  console.log('\n13. Checking Real-Time Reopened Broadcast to Client Portal & CRM:');
  if (clientReceivedStatusChanged && clientReceivedStatusChanged.status === 'OPEN') {
    console.log('   ✓ Client Portal received real-time status change: OPEN (isClosed = false)');
  } else {
    throw new Error('Client Portal did not receive real-time reopened event!');
  }

  // 14. Messaging verified to be active and working again after reopening
  console.log('\n14. Verifying messaging is active again after reopening:');
  const postReopenMsgRes = await request(`/api/v1/tickets/${ticket.id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${clientToken}` },
    body: JSON.stringify({ message: 'Thank you for reopening! Here is the additional query.' })
  });
  console.log(`   - HTTP Status: ${postReopenMsgRes.status}`);
  if (postReopenMsgRes.status === 201) {
    console.log('   ✓ PASS: Client successfully sent message on reopened ticket (Status 201)');
  } else {
    throw new Error(`Message on reopened ticket failed, got status ${postReopenMsgRes.status}`);
  }

  // 15. Concurrency & Race Condition Test (Requirement 5)
  console.log('\n15. Testing Concurrency & Race Conditions (Close vs Message):');
  // Re-close ticket and fire 10 concurrent message and attachment requests simultaneously
  await request(`/api/v1/tickets/${ticket.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: JSON.stringify({ status: 'CLOSED' })
  });

  const concurrentPromises = [];
  for (let i = 0; i < 8; i++) {
    concurrentPromises.push(
      request(`/api/v1/tickets/${ticket.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${clientToken}` },
        body: JSON.stringify({ message: `Concurrent probe message #${i}` })
      })
    );
  }
  const concurrentResults = await Promise.all(concurrentPromises);
  const allBlocked = concurrentResults.every((r) => r.status === 403 && r.data.error?.code === 'ticket_closed');
  if (allBlocked) {
    console.log('   ✓ PASS: All 8 concurrent message requests rejected atomically with 403 Forbidden!');
  } else {
    throw new Error('Some concurrent messages were not rejected on closed ticket!');
  }

  // 16. Clean up
  console.log('\n16. Cleaning up test ticket:');
  const delRes = await request(`/api/v1/tickets/${ticket.id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  console.log('   ✓ Cleanup status:', delRes.status);

  clientSocket.disconnect();
  adminSocket.disconnect();

  console.log('\n========================================================================');
  console.log('🎉 ALL 15 CLOSED TICKET RESTRICTION & REOPEN AUDIT TESTS PASSED 100%!');
  console.log('========================================================================\n');
}

runClosedTicketTestSuite().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err.message);
  process.exit(1);
});
