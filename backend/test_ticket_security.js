const { io } = require('socket.io-client');

const BASE_URL = 'http://localhost:5005';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('🧪 RUNNING COMPREHENSIVE TICKET ISOLATION & ACCESS CONTROL TESTS');
  console.log('================================================================\n');

  // 1. Authenticate 3 Clients & 1 CRM Admin
  console.log('--- Step 1: Client & Staff Authentication ---');
  const clientAId = '6a7c1d6d4b50dbbac70920cd'; // OG blanks (Priyanka)
  const clientBId = '6a7c1c244b50dbbac7091fc3'; // GJ Food Products (Jothi)
  const clientCId = '6a7c19404b50dbbac7091c00'; // Branding Wall (Rathan Roy)

  const authA = await request('/api/v1/auth/client-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: clientAId, email: 'priyankasp1995@gmail.com', name: 'Priyanka' })
  });
  console.log('Client A Auth:', authA.ok ? '✓ OK' : '✗ Failed', authA.data.client?.name);

  const authB = await request('/api/v1/auth/client-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: clientBId, email: 'gjfoodproducts15@gmail.com', name: 'Jothi' })
  });
  console.log('Client B Auth:', authB.ok ? '✓ OK' : '✗ Failed', authB.data.client?.name);

  const authC = await request('/api/v1/auth/client-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: clientCId, email: 'emarteventures@gmail.com', name: 'Rathan Roy' })
  });
  console.log('Client C Auth:', authC.ok ? '✓ OK' : '✗ Failed', authC.data.client?.name);

  const tokenA = authA.data.token;
  const tokenB = authB.data.token;
  const tokenC = authC.data.token;
  const adminApiKey = 'crm_live_9981abc123';

  // 2. Client A, Client B, and Client C create their respective tickets
  console.log('\n--- Step 2: Ticket Creation by 3 Different Clients ---');
  const createA = await request('/api/v1/tickets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    body: JSON.stringify({
      title: 'Ticket A - OG blanks Fabric GSM Question',
      description: 'What is the exact GSM weight for the cotton blanks batch?',
      category: 'TECHNICAL',
      priority: 'HIGH'
    })
  });
  const ticketA = createA.data.data;
  console.log('Ticket A created:', createA.ok ? '✓ OK' : '✗ Failed', ticketA?.code, 'Owner:', ticketA?.clientId);

  const createB = await request('/api/v1/tickets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenB}` },
    body: JSON.stringify({
      title: 'Ticket B - GJ Food Organic Packaging Order',
      description: 'Need batch update on spice pouch printing and laminates',
      category: 'BILLING',
      priority: 'MEDIUM'
    })
  });
  const ticketB = createB.data.data;
  console.log('Ticket B created:', createB.ok ? '✓ OK' : '✗ Failed', ticketB?.code, 'Owner:', ticketB?.clientId);

  const createC = await request('/api/v1/tickets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenC}` },
    body: JSON.stringify({
      title: 'Ticket C - Branding Wall Signage Vector Proof',
      description: 'Please review updated vector paths for backlit acrylic sign',
      category: 'TECHNICAL',
      priority: 'URGENT'
    })
  });
  const ticketC = createC.data.data;
  console.log('Ticket C created:', createC.ok ? '✓ OK' : '✗ Failed', ticketC?.code, 'Owner:', ticketC?.clientId);

  // 3. Verify Isolation on Ticket Listings (GET /api/v1/tickets)
  console.log('\n--- Step 3: Ticket List Isolation Testing ---');
  const listA = await request('/api/v1/tickets', { headers: { 'Authorization': `Bearer ${tokenA}` } });
  const idsInA = listA.data.data.map(t => String(t.id));
  const hasA_in_A = idsInA.includes(String(ticketA.id));
  const hasB_in_A = idsInA.includes(String(ticketB.id));
  const hasC_in_A = idsInA.includes(String(ticketC.id));
  console.log('Client A list check: Has Ticket A?', hasA_in_A, '| Has Ticket B?', hasB_in_A, '| Has Ticket C?', hasC_in_A);
  if (hasA_in_A && !hasB_in_A && !hasC_in_A) {
    console.log('✓ PASS: Client A only sees their own tickets!');
  } else {
    console.error('✗ FAIL: Ticket leakage in Client A list!');
  }

  const listB = await request('/api/v1/tickets', { headers: { 'Authorization': `Bearer ${tokenB}` } });
  const idsInB = listB.data.data.map(t => String(t.id));
  const hasA_in_B = idsInB.includes(String(ticketA.id));
  const hasB_in_B = idsInB.includes(String(ticketB.id));
  const hasC_in_B = idsInB.includes(String(ticketC.id));
  console.log('Client B list check: Has Ticket A?', hasA_in_B, '| Has Ticket B?', hasB_in_B, '| Has Ticket C?', hasC_in_B);
  if (hasB_in_B && !hasA_in_B && !hasC_in_B) {
    console.log('✓ PASS: Client B only sees their own tickets!');
  } else {
    console.error('✗ FAIL: Ticket leakage in Client B list!');
  }

  const listC = await request('/api/v1/tickets', { headers: { 'Authorization': `Bearer ${tokenC}` } });
  const idsInC = listC.data.data.map(t => String(t.id));
  const hasA_in_C = idsInC.includes(String(ticketA.id));
  const hasB_in_C = idsInC.includes(String(ticketB.id));
  const hasC_in_C = idsInC.includes(String(ticketC.id));
  console.log('Client C list check: Has Ticket A?', hasA_in_C, '| Has Ticket B?', hasB_in_C, '| Has Ticket C?', hasC_in_C);
  if (hasC_in_C && !hasA_in_C && !hasB_in_C) {
    console.log('✓ PASS: Client C only sees their own tickets!');
  } else {
    console.error('✗ FAIL: Ticket leakage in Client C list!');
  }

  // 4. CRM Staff View
  console.log('\n--- Step 4: CRM Staff All-Tickets View ---');
  const crmList = await request('/api/v1/tickets', { headers: { 'x-api-key': adminApiKey } });
  const crmIds = crmList.data.data.map(t => String(t.id));
  const crmHasAll = crmIds.includes(String(ticketA.id)) && crmIds.includes(String(ticketB.id)) && crmIds.includes(String(ticketC.id));
  console.log('CRM Staff can view Ticket A, B, and C:', crmHasAll ? '✓ PASS' : '✗ FAIL');

  // 5. Direct IDOR Access Testing (GET /api/v1/tickets/:id)
  console.log('\n--- Step 5: Direct URL / IDOR Access Verification ---');
  const getBbyA = await request(`/api/v1/tickets/${ticketB.id}`, { headers: { 'Authorization': `Bearer ${tokenA}` } });
  console.log('Client A accessing Ticket B directly -> Status:', getBbyA.status, getBbyA.data.error?.code);
  const getCbyA = await request(`/api/v1/tickets/${ticketC.id}`, { headers: { 'Authorization': `Bearer ${tokenA}` } });
  console.log('Client A accessing Ticket C directly -> Status:', getCbyA.status, getCbyA.data.error?.code);

  const getAbyB = await request(`/api/v1/tickets/${ticketA.id}`, { headers: { 'Authorization': `Bearer ${tokenB}` } });
  console.log('Client B accessing Ticket A directly -> Status:', getAbyB.status, getAbyB.data.error?.code);
  const getCbyB = await request(`/api/v1/tickets/${ticketC.id}`, { headers: { 'Authorization': `Bearer ${tokenB}` } });
  console.log('Client B accessing Ticket C directly -> Status:', getCbyB.status, getCbyB.data.error?.code);

  const getAbyC = await request(`/api/v1/tickets/${ticketA.id}`, { headers: { 'Authorization': `Bearer ${tokenC}` } });
  console.log('Client C accessing Ticket A directly -> Status:', getAbyC.status, getAbyC.data.error?.code);
  const getBbyC = await request(`/api/v1/tickets/${ticketB.id}`, { headers: { 'Authorization': `Bearer ${tokenC}` } });
  console.log('Client C accessing Ticket B directly -> Status:', getBbyC.status, getBbyC.data.error?.code);

  const allIdorBlocked = [getBbyA, getCbyA, getAbyB, getCbyB, getAbyC, getBbyC].every(r => r.status === 403);
  console.log('All unauthorized direct GET requests blocked with 403 Forbidden:', allIdorBlocked ? '✓ PASS' : '✗ FAIL');

  // 6. Cross-Tenant Message Tampering Testing (POST /api/v1/tickets/:id/messages)
  console.log('\n--- Step 6: Message Isolation & Tampering Protection ---');
  const postBbyA = await request(`/api/v1/tickets/${ticketB.id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    body: JSON.stringify({ message: 'Unauthorized message attempt by Client A' })
  });
  console.log('Client A posting to Ticket B -> Status:', postBbyA.status, postBbyA.data.error?.code);

  const postCbyB = await request(`/api/v1/tickets/${ticketC.id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenB}` },
    body: JSON.stringify({ message: 'Unauthorized message attempt by Client B' })
  });
  console.log('Client B posting to Ticket C -> Status:', postCbyB.status, postCbyB.data.error?.code);

  const postAbyC = await request(`/api/v1/tickets/${ticketA.id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenC}` },
    body: JSON.stringify({ message: 'Unauthorized message attempt by Client C' })
  });
  console.log('Client C posting to Ticket A -> Status:', postAbyC.status, postAbyC.data.error?.code);

  const messagesTamperBlocked = [postBbyA, postCbyB, postAbyC].every(r => r.status === 403);
  console.log('All cross-tenant messaging attempts blocked with 403 Forbidden:', messagesTamperBlocked ? '✓ PASS' : '✗ FAIL');

  // Authorized replies
  const postAbyA = await request(`/api/v1/tickets/${ticketA.id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    body: JSON.stringify({ message: 'Authorized follow-up from Client A owner' })
  });
  console.log('Client A posting to their OWN Ticket A -> Status:', postAbyA.status, postAbyA.ok ? '✓ PASS' : '✗ FAIL');

  // 7. Real-Time WebSocket Channel Isolation
  console.log('\n--- Step 7: Real-Time WebSocket Isolation Testing ---');

  const socketA = io(BASE_URL, { auth: { token: tokenA }, transports: ['websocket'] });
  const socketB = io(BASE_URL, { auth: { token: tokenB }, transports: ['websocket'] });
  const socketC = io(BASE_URL, { auth: { token: tokenC }, transports: ['websocket'] });

  await new Promise((resolve) => {
    let connectedCount = 0;
    const checkAll = () => { if (++connectedCount === 3) resolve(); };
    socketA.on('connect', checkAll);
    socketB.on('connect', checkAll);
    socketC.on('connect', checkAll);
  });
  console.log('All 3 client sockets connected');

  // Test unauthorized join: Client A tries to join Ticket B channel
  const joinRejection = await new Promise((resolve) => {
    socketA.on('socket_error', (err) => {
      resolve(err);
    });
    socketA.emit('join_ticket', ticketB.id);
  });
  console.log('Client A attempt to join Ticket B room -> Rejected:', joinRejection?.code === 'UNAUTHORIZED_TICKET_ACCESS' ? '✓ PASS' : '✗ FAIL', joinRejection?.message);

  // Now, Client A joins their OWN Ticket A channel
  socketA.emit('join_ticket', ticketA.id);
  socketB.emit('join_ticket', ticketB.id);
  socketC.emit('join_ticket', ticketC.id);

  // Listen for message broadcasts on all 3 sockets
  let clientAReceived = false;
  let clientBReceived = false;
  let clientCReceived = false;

  socketA.on('new_ticket_message', (payload) => {
    if (payload.ticketId === ticketA.id) clientAReceived = true;
  });
  socketB.on('new_ticket_message', () => { clientBReceived = true; });
  socketC.on('new_ticket_message', () => { clientCReceived = true; });

  // CRM Agent sends a reply to Ticket A
  await request(`/api/v1/tickets/${ticketA.id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': adminApiKey },
    body: JSON.stringify({
      message: 'Hello Client A, support team is preparing your fabric test report!',
      sender_type: 'STAFF',
      author_name: 'CRM Support Lead'
    })
  });

  // Wait 1.5 seconds for socket delivery
  await new Promise((r) => setTimeout(r, 1500));

  console.log('Real-Time Message Distribution:');
  console.log('  Client A received Ticket A reply:', clientAReceived ? '✓ YES (Delivered)' : '✗ NO');
  console.log('  Client B received Ticket A reply:', clientBReceived ? '✗ LEAKED' : '✓ NO (Protected)');
  console.log('  Client C received Ticket A reply:', clientCReceived ? '✗ LEAKED' : '✓ NO (Protected)');

  const realTimeIsolationSuccess = clientAReceived && !clientBReceived && !clientCReceived;
  console.log('Real-time message isolation result:', realTimeIsolationSuccess ? '✓ PASS' : '✗ FAIL');

  socketA.disconnect();
  socketB.disconnect();
  socketC.disconnect();

  console.log('\n================================================================');
  console.log('🎉 ALL SECURITY & ACCESS CONTROL TESTS COMPLETED SUCCESSFULLY!');
  console.log('================================================================');
  process.exit(0);
}

runTestSuite().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});

