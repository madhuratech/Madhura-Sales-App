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
app.use(cors());
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
const universalShareRoutes = require('./routes/v1/universalShareRoutes');

const internalTenantRoutes = require('./routes/internalTenantRoutes');
const { tenantMiddleware } = require('./middleware/tenantMiddleware');

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

// Socket.io Connection Logic
io.use((socket, next) => {
  const token = socket.handshake.auth.token || socket.handshake.query.token;
  if (token) {
    jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key_here', (err, decoded) => {
      if (err) return next(new Error('Authentication error'));
      socket.userId = decoded.id;
      socket.companyId = decoded.companyId || 'company_madhura';
      next();
    });
  } else {
    next(new Error('Authentication error - token not provided'));
  }
});

io.on('connection', (socket) => {
  console.log(`User connected to socket: ${socket.userId} (Company: ${socket.companyId})`);
  // Scope user room to companyId
  socket.join(`${socket.companyId}_${socket.userId}`);

  socket.on('join_chat', (roomId) => {
    // Scope chat room to companyId
    socket.join(`${socket.companyId}_${roomId}`);
    console.log(`User joined room: ${socket.companyId}_${roomId}`);
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
