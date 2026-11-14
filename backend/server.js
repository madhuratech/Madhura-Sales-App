const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const tenantPlugin = require('./models/tenantPlugin');

// Apply tenant plugin globally so all models automatically filter by companyId
mongoose.plugin(tenantPlugin);

const connectDB = require('./db');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const User = require('./models/User');

const app = express();
const server = http.createServer(app);
const io = socketio(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-internal-api-key', 'X-Requested-With', 'Accept', 'Origin', 'x-api-key', 'x-client-id', 'x-user-role', 'x-user-id', 'x-user-name', 'x-user-email'],
}));
app.options('*', cors());
app.use(express.json());

// Socket.io injection middleware (so controllers can access io)
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const taskRoutes = require('./routes/taskRoutes');
const meetingRoutes = require('./routes/meetingRoutes');
const workUpdateRoutes = require('./routes/workUpdateRoutes');
const locationRoutes = require('./routes/locationRoutes');
const followUpRoutes = require('./routes/followUpRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const messageRoutes = require('./routes/messageRoutes');
const reportRoutes = require('./routes/reportRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const taskReportRoutes = require('./routes/taskReportRoutes');
const onboardingRoutes = require('./routes/onboardingRoutes');
const projectRoutes = require('./routes/projectRoutes');
const quotationRoutes = require('./routes/quotationRoutes');
const leadRoutes = require('./routes/leadRoutes');
const crmClientRoutes = require('./routes/crmClientRoutes');
const crmQuotationRoutes = require('./routes/crmQuotationRoutes');
const performaInvoiceRoutes = require('./routes/performaInvoiceRoutes');
const madhuraInvoiceRoutes = require('./routes/madhuraInvoiceRoutes');
const paymentReceiptRoutes = require('./routes/paymentReceiptRoutes');
const productRoutes = require('./routes/productRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const universalShareRoutes = require('./routes/v1/universalShareRoutes');

const internalTenantRoutes = require('./routes/internalTenantRoutes');
const { tenantMiddleware } = require('./middleware/tenantMiddleware');

// Serve local uploaded files statically (fallback/direct uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Mount Universal Two-Way Microservices Gateway (accessible via both /v1 and /api/v1)
app.use('/v1', universalShareRoutes);
app.use('/api/v1', universalShareRoutes);

// Mount internal SaaS APIs
app.use('/api/internal/tenant', internalTenantRoutes);

// Apply tenant middleware for all regular API routes
app.use('/api', tenantMiddleware);

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/workupdates', workUpdateRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/followups', followUpRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/task-reports', taskReportRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/client', crmClientRoutes);
app.use('/api/crm-quotations', crmQuotationRoutes);
app.use('/api/performainvoice', performaInvoiceRoutes);
app.use('/api/madhura-invoice', madhuraInvoiceRoutes);
app.use('/api/payment-receipts', paymentReceiptRoutes);
app.use('/api/products', productRoutes);
app.use('/api/tickets', ticketRoutes);

app.get('/', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? '✅ Connected' : '❌ Disconnected';
  res.json({
    message: 'Welcome to Madhura CRM API',
    database: dbStatus,
    version: '1.0.0',
  });
});

// Health check route
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uptime: Math.floor(process.uptime()) + 's',
  });
});

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Socket.io Connection Logic with Strict Role & Client Isolation
const ADMIN_SOCKET_ROLES = [
  'Super Admin',
  'Admin',
  'Managing Director MD',
  'SUPER_ADMIN',
  'COMPANY_ADMIN',
];

const MANAGER_SOCKET_ROLES = [
  'Manager',
  'Project Manager',
  'Team Lead',
  'HR',
  'SUPPORT_MANAGER',
];

const STAFF_SOCKET_ROLES = [
  ...ADMIN_SOCKET_ROLES,
  ...MANAGER_SOCKET_ROLES,
  'Field Executive',
  'user',
  'SUPPORT_AGENT',
];

io.use(async (socket, next) => {
  const token =
    socket.handshake.auth?.token ||
    socket.handshake.auth?.clientToken ||
    socket.handshake.query?.token;
  const apiKey =
    socket.handshake.auth?.apiKey ||
    socket.handshake.query?.apiKey ||
    socket.handshake.headers?.['x-api-key'];
  const clientIdHeader =
    socket.handshake.auth?.clientId ||
    socket.handshake.query?.clientId ||
    socket.handshake.headers?.['x-client-id'];

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_jwt_key_123');
      const isStaffRole =
        STAFF_SOCKET_ROLES.includes(decoded.role) && !decoded.isClient && !decoded.clientId;

      if (isStaffRole) {
        const role = decoded.role || 'Field Executive';
        const isAdmin = ADMIN_SOCKET_ROLES.includes(role);
        const isManager = MANAGER_SOCKET_ROLES.includes(role) || isAdmin;
        const isRegularUser = !isAdmin && !isManager;

        socket.userId = decoded.id || decoded._id;
        socket.role = role;
        socket.isAdmin = isAdmin;
        socket.isManager = isManager;
        socket.isRegularUser = isRegularUser;
        socket.isStaff = true;
        socket.isClient = false;
        socket.companyId = decoded.companyId || 'company_madhura';
      } else {
        const resolvedClientId = decoded.clientId || decoded.id;
        socket.userId = decoded.id || decoded._id;
        socket.clientId = resolvedClientId ? String(resolvedClientId) : null;
        socket.role = 'CLIENT';
        socket.isAdmin = false;
        socket.isManager = false;
        socket.isRegularUser = false;
        socket.isClient = true;
        socket.isStaff = false;
        socket.companyId = decoded.companyId || 'company_madhura';
      }
      return next();
    } catch (err) {
      if (!apiKey || (apiKey !== 'crm_live_9981abc123' && apiKey !== process.env.CRM_INTERNAL_API_KEY)) {
        return next(new Error('Authentication error - invalid token'));
      }
    }
  }

  // API Key Authentication (Client Portal or Microservice)
  if (apiKey && (apiKey === 'crm_live_9981abc123' || apiKey === process.env.CRM_INTERNAL_API_KEY)) {
    const isClientContext = !!clientIdHeader;
    if (isClientContext) {
      socket.userId = String(clientIdHeader);
      socket.clientId = String(clientIdHeader);
      socket.role = 'CLIENT';
      socket.isAdmin = false;
      socket.isManager = false;
      socket.isRegularUser = false;
      socket.isClient = true;
      socket.isStaff = false;
      socket.companyId = 'company_madhura';
    } else {
      socket.userId =
        socket.handshake.auth?.userId || socket.handshake.query?.userId || 'api_service_staff';
      socket.role = 'Admin';
      socket.isAdmin = true;
      socket.isManager = true;
      socket.isRegularUser = false;
      socket.isStaff = true;
      socket.isClient = false;
      socket.companyId = 'company_madhura';
    }
    return next();
  }

  return next(new Error('Authentication error - token or api key required'));
});

io.on('connection', (socket) => {
  console.log(
    `Socket connected: ${socket.id} (Role: ${socket.role}, isStaff: ${socket.isStaff}, isClient: ${socket.isClient}, ClientId: ${socket.clientId || 'N/A'})`
  );

  // Scoped user room
  socket.join(`user_${socket.userId}`);
  socket.join(`${socket.companyId}_${socket.userId}`);

  if (socket.isAdmin) {
    // Only Admin joins global staff rooms for system alerts & global ticket notifications
    socket.join('crm_admin_room');
    socket.join('crm_staff_room');
    socket.join(`${socket.companyId}_tickets`);
  } else if (socket.isManager) {
    socket.join('crm_manager_room');
  } else if (socket.isClient && socket.clientId) {
    // Clients ONLY join their isolated client room
    socket.join(`client_${socket.clientId}`);
  }

  socket.on('join_chat', (roomId) => {
    socket.join(`${socket.companyId}_${roomId}`);
  });

  // Ticket conversation room subscription with strict authorization validation
  socket.on('join_ticket', async (ticketId) => {
    if (!ticketId) return;
    console.log('[Socket join_ticket called]', { socketId: socket.id, userId: socket.userId, role: socket.role, isAdmin: socket.isAdmin, ticketId });
    try {
      const Ticket = mongoose.model('Ticket');
      const lookup = mongoose.Types.ObjectId.isValid(ticketId)
        ? { _id: ticketId }
        : { code: ticketId };

      const ticket = await Ticket.findOne(lookup).select('client_id assignee_id created_by code status');
      if (!ticket) {
        console.log('[Socket join_ticket] Ticket not found for lookup:', lookup);
        socket.emit('socket_error', { code: 'NOT_FOUND', message: 'Ticket not found' });
        return;
      }
      console.log('[Socket join_ticket found ticket]', {
        code: ticket.code,
        id: ticket._id.toString(),
        client_id: ticket.client_id?.toString(),
        created_by: ticket.created_by?.toString(),
        assignee_id: ticket.assignee_id?.toString()
      });

      // 1. Client Check: Verify client owns the ticket
      if (socket.isClient) {
        const ticketClientId = ticket.client_id ? String(ticket.client_id) : null;
        if (!ticketClientId || ticketClientId !== String(socket.clientId)) {
          console.warn(
            `[Socket Security ALERT] Client ${socket.clientId} blocked from unauthorized ticket ${ticketId} (owned by ${ticketClientId})`
          );
          socket.emit('socket_error', {
            code: 'UNAUTHORIZED_TICKET_ACCESS',
            message: 'Access denied: You do not have permission to subscribe to this ticket',
          });
          return;
        }

        socket.join(`ticket_${ticket._id}`);
        if (ticket.code) socket.join(`ticket_${ticket.code}`);
        console.log('[Socket join_ticket] Client joined rooms:', `ticket_${ticket._id}`, `ticket_${ticket.code}`);
        return;
      }

      // 2. CRM Admin Check: Full access
      if (socket.isAdmin) {
        console.log('[Socket join_ticket] Admin joined rooms:', `ticket_${ticket._id}`, `ticket_${ticket.code}`);
        socket.join(`ticket_${ticket._id}`);
        if (ticket.code) socket.join(`ticket_${ticket.code}`);
        return;
      }

      // 3. Authenticated CRM Staff: Only if Manager, Creator, or Assignee
      const userIdStr = String(socket.userId);
      const createdByStr = ticket.created_by ? String(ticket.created_by) : null;
      const assigneeIdStr = ticket.assignee_id ? String(ticket.assignee_id) : null;
      const isOwnerOrAssignee = (createdByStr === userIdStr || assigneeIdStr === userIdStr);

      if (socket.isManager || isOwnerOrAssignee) {
        console.log('[Socket join_ticket] Authorized staff joined rooms:', `ticket_${ticket._id}`, `ticket_${ticket.code}`);
        socket.join(`ticket_${ticket._id}`);
        if (ticket.code) socket.join(`ticket_${ticket.code}`);
        return;
      }

      // Unauthorized regular CRM user blocked
      console.warn(
        `[Socket Security ALERT] Staff ${socket.userId} (${socket.role}) blocked from unauthorized ticket ${ticketId}`
      );
      socket.emit('socket_error', {
        code: 'UNAUTHORIZED_TICKET_ACCESS',
        message: 'Access denied: You do not have permission to subscribe to this ticket',
      });
    } catch (joinErr) {
      console.error('[Socket join_ticket error]:', joinErr.message);
    }
  });

  socket.on('leave_ticket', (ticketId) => {
    if (!ticketId) return;
    socket.leave(`ticket_${ticketId}`);
  });

  socket.on('ticket_typing', ({ ticketId, userName, isTyping }) => {
    if (!ticketId) return;
    const roomName = `ticket_${ticketId}`;
    if (socket.rooms && socket.rooms.has(roomName)) {
      socket.to(roomName).emit('ticket_typing', {
        ticketId,
        userId: socket.userId,
        userName: userName || (socket.isClient ? 'Client' : 'Agent'),
        isTyping: !!isTyping,
      });
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected from socket: ${socket.userId}`);
  });
});

// ─── Start Server First, Then Connect DB & Seed ──────────────────────────────
const PORT = process.env.PORT || 5005;
server.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Server running on port ${PORT} (0.0.0.0)`);

  // Connect to DB (with retry) — only seed after successful connection
  await connectDB();

  if (mongoose.connection.readyState === 1) {
    // Optionally delete the default seeded admin if requested via env
    if (process.env.DELETE_DEFAULT_ADMIN === 'true') {
      try {
        const deleted = await User.findOneAndDelete({ email: 'admin@fieldstaff.com' });
        if (deleted) console.log('🗑️  Default Admin deleted:', deleted.email);
        else console.log('ℹ️  No default Admin found to delete.');
      } catch (delErr) {
        console.error('❌ Failed to delete default Admin:', delErr.message);
      }
    }

    await seedAdminUser();

    // Start overdue task, attendance checking, and meeting/followup reminders interval (runs every 15 seconds)
    const { checkOverdueTasks } = require('./utils/taskChecker');
    const { checkPendingAttendances } = require('./utils/attendanceChecker');
    const { checkReminders } = require('./utils/reminderChecker');
    setInterval(() => {
      checkOverdueTasks(io);
      checkPendingAttendances(io);
      checkReminders(io);
    }, 15000);

    // Weekly Friday reminder at 9:00 AM
    try {
      const cron = require('node-cron');
      const { sendWeeklyFridayReminder } = require('./controllers/reportController');
      cron.schedule('0 9 * * 5', () => {
        console.log('📅 Running Friday weekly report reminder...');
        sendWeeklyFridayReminder();
      }, { timezone: 'Asia/Kolkata' });
      console.log('✅ Friday weekly reminder cron scheduled (every Friday 9:00 AM IST)');
    } catch (cronErr) {
      console.warn('⚠️ Could not schedule cron:', cronErr.message);
    }
  } else {
    console.log('⚠️  Server is running but DB is not connected. Seeding skipped.');
    console.log('   👉 Please whitelist your IP at: https://cloud.mongodb.com → Security → Network Access');
  }
});

// ─── Seed default Admin ───────────────────────────────────────────────────────
async function seedAdminUser() {
  try {
    const adminCount = await User.countDocuments({ role: 'Admin' });
    if (adminCount === 0) {
      await User.create({
        name: 'Admin',
        email: 'admin@fieldstaff.com',
        password: 'adminpassword123',
        role: 'Admin',
        phone: '1234567890',
        isActive: true,
      });
      console.log('✅ Default Admin seeded: admin@fieldstaff.com / adminpassword123');
    } else {
      console.log(`✅ Admin user already exists (${adminCount} admin found). Skipping seed.`);
    }
  } catch (error) {
    console.error(`❌ Admin user seeding failed: ${error.message}`);
  }
}
