const mongoose = require('mongoose');
const ClientOnboarding = require('../../models/ClientOnboarding');
const Project = require('../../models/Project');
const TaxInvoice = require('../../models/TaxInvoice');
const ProformaInvoice = require('../../models/ProformaInvoice');
const Payment = require('../../models/Payment');
const Ticket = require('../../models/Ticket');
const Approval = require('../../models/Approval');
const User = require('../../models/User');
const Notification = require('../../models/Notification');
const { uploadToCloudinary } = require('../../utils/helpers');

// --- 1. Health Check ---
exports.getHealth = async (req, res) => {
  res.status(200).json({
    status: 'ok',
    gateway: 'Madhura Universal Two-Way API Gateway',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
};

// --- 2. Universal Bundle (Single API for All Client Details) ---
exports.getBundle = async (req, res, next) => {
  try {
    const { client_id } = req.query;
    if (!client_id || !mongoose.Types.ObjectId.isValid(client_id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'invalid_parameter', message: 'Valid client_id is required' }
      });
    }

    const [client, projects, taxInvoices, proformas, tickets, approvals] = await Promise.all([
      ClientOnboarding.findById(client_id).populate('executive', 'name email phone').lean(),
      Project.find({ client: client_id }).lean(),
      TaxInvoice.find({ client_id: client_id }).lean(),
      ProformaInvoice.find({ customer_id: client_id }).lean(),
      Ticket.find({ client_id: client_id }).sort({ updated_at: -1 }).lean(),
      Approval.find({ client_id: client_id }).sort({ createdAt: -1 }).lean()
    ]);

    if (!client) {
      return res.status(404).json({
        success: false,
        error: { code: 'not_found', message: 'Client not found' }
      });
    }

    // Format Client
    const formattedClient = {
      id: client._id,
      name: client.businessName,
      type: client.businessType,
      code: client.gstNumber ? client.gstNumber.slice(0, 5) : 'CLI',
      tier: 'ENTERPRISE',
      gstin: client.gstNumber || '',
      primary_contact: {
        name: client.ownerName,
        phone: client.phone,
        email: client.email || ''
      },
      address: client.location ? `${client.location.address}, ${client.location.city}, ${client.location.state} - ${client.location.pincode}` : '',
      account_manager: client.executive ? {
        id: client.executive._id,
        name: client.executive.name,
        email: client.executive.email,
        phone: client.executive.phone
      } : null,
      onboarding_date: client.onboardingDate
    };

    // Format Projects
    const formattedProjects = projects.map(p => ({
      id: p._id,
      name: p.name,
      code: p.projectCode || '',
      status: p.status || 'Active',
      progress: p.progress || 0,
      priority: p.priority || 'Medium',
      target_date: p.targetCompletionDate
    }));

    // Format Invoices
    const formattedInvoices = taxInvoices.map(inv => {
      const total = (inv.items || []).reduce((sum, item) => sum + (item.total_amount || 0), 0);
      const advance = inv.advance_amount || 0;
      return {
        id: inv._id,
        invoice_no: inv.invoice_no,
        bill_date: inv.bill_date,
        total_amount: total,
        advance_amount: advance,
        balance_due: Math.max(0, total - advance),
        status: advance >= total ? 'PAID' : advance > 0 ? 'PARTIALLY_PAID' : 'SENT',
        pdf_url: `https://crm.madhuratech.com/api/v1/invoices/${inv._id}/pdf`
      };
    });

    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        client: formattedClient,
        projects: formattedProjects,
        proforma_invoices: proformas,
        tax_invoices: formattedInvoices,
        questions_tickets: tickets,
        approvals
      }
    });
  } catch (error) {
    next(error);
  }
};

// --- 3. Clients Endpoints ---
exports.getClients = async (req, res, next) => {
  try {
    const clients = await ClientOnboarding.find()
      .populate('executive', 'name email phone')
      .sort({ createdAt: -1 })
      .lean();

    const data = clients.map(c => ({
      id: c._id,
      name: c.businessName,
      owner_name: c.ownerName,
      phone: c.phone,
      email: c.email,
      gstin: c.gstNumber,
      city: c.location?.city || '',
      state: c.location?.state || '',
      account_manager: c.executive?.name || ''
    }));

    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    next(error);
  }
};

exports.getClientById = async (req, res, next) => {
  try {
    const client = await ClientOnboarding.findById(req.params.id)
      .populate('executive', 'name email phone')
      .lean();

    if (!client) {
      return res.status(404).json({ success: false, error: { code: 'not_found', message: 'Client not found' } });
    }

    res.status(200).json({ success: true, data: client });
  } catch (error) {
    next(error);
  }
};

exports.createClient = async (req, res, next) => {
  try {
    const { businessName, businessType, ownerName, phone, email, address, city, state, pincode, gstin } = req.body;
    if (!businessName || !ownerName || !phone) {
      return res.status(400).json({ success: false, message: 'businessName, ownerName, and phone are required' });
    }

    const defaultExec = await User.findOne({ role: { $in: ['Super Admin', 'Admin', 'Managing Director MD'] } });

    const newClient = await ClientOnboarding.create({
      executive: defaultExec?._id || new mongoose.Types.ObjectId(),
      businessName,
      businessType: businessType || 'General Business',
      ownerName,
      phone,
      email: email || '',
      gstNumber: gstin || '',
      location: {
        address: address || '',
        city: city || '',
        state: state || '',
        pincode: pincode || ''
      }
    });

    res.status(201).json({ success: true, data: newClient });
  } catch (error) {
    next(error);
  }
};

exports.updateClient = async (req, res, next) => {
  try {
    const updated = await ClientOnboarding.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, error: { code: 'not_found', message: 'Client not found' } });
    }
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

exports.requestClientChange = async (req, res, next) => {
  try {
    const { client_id, changes, notes, requested_by } = req.body;
    const approval = await Approval.create({
      client_id: req.params.id || client_id,
      type: 'CHANGE_REQUEST',
      title: 'Client Profile Change Request',
      comments: notes || 'Client requested profile details update',
      decision_by: requested_by || 'Client Portal',
      status: 'PENDING'
    });

    res.status(202).json({
      success: true,
      request_id: approval._id,
      message: 'Change request submitted for staff verification'
    });
  } catch (error) {
    next(error);
  }
};

// --- 4. Projects Endpoints ---
exports.getProjects = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.client_id && mongoose.Types.ObjectId.isValid(req.query.client_id)) {
      filter.client = req.query.client_id;
    }

    const projects = await Project.find(filter)
      .populate('client', 'businessName ownerName phone')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({ success: true, count: projects.length, data: projects });
  } catch (error) {
    next(error);
  }
};

exports.getProjectById = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id).populate('client').lean();
    if (!project) {
      return res.status(404).json({ success: false, error: { code: 'not_found', message: 'Project not found' } });
    }
    res.status(200).json({ success: true, data: project });
  } catch (error) {
    next(error);
  }
};

exports.createProject = async (req, res, next) => {
  try {
    const project = await Project.create(req.body);
    res.status(201).json({ success: true, data: project });
  } catch (error) {
    next(error);
  }
};

// --- 5. Invoices & Billing Endpoints ---
exports.getInvoices = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.client_id && mongoose.Types.ObjectId.isValid(req.query.client_id)) {
      filter.client_id = req.query.client_id;
    }

    const invoices = await TaxInvoice.find(filter).sort({ createdAt: -1 }).lean();
    const formatted = invoices.map(inv => {
      const total = (inv.items || []).reduce((sum, item) => sum + (item.total_amount || 0), 0);
      const advance = inv.advance_amount || 0;
      return {
        id: inv._id,
        invoice_no: inv.invoice_no,
        client_company: inv.client_company,
        bill_date: inv.bill_date,
        items: inv.items,
        total_amount: total,
        advance_amount: advance,
        balance_due: Math.max(0, total - advance),
        status: advance >= total ? 'PAID' : advance > 0 ? 'PARTIALLY_PAID' : 'SENT',
        pdf_url: `https://crm.madhuratech.com/api/v1/invoices/${inv._id}/pdf`
      };
    });

    res.status(200).json({ success: true, count: formatted.length, data: formatted });
  } catch (error) {
    next(error);
  }
};

exports.getInvoiceById = async (req, res, next) => {
  try {
    const inv = await TaxInvoice.findById(req.params.id).lean();
    if (!inv) {
      return res.status(404).json({ success: false, error: { code: 'not_found', message: 'Invoice not found' } });
    }
    res.status(200).json({ success: true, data: inv });
  } catch (error) {
    next(error);
  }
};

exports.getInvoicePdf = async (req, res, next) => {
  try {
    const inv = await TaxInvoice.findById(req.params.id).lean();
    if (!inv) {
      return res.status(404).json({ success: false, error: { code: 'not_found', message: 'Invoice not found' } });
    }

    res.status(200).json({
      success: true,
      invoice_id: inv._id,
      invoice_no: inv.invoice_no,
      pdf_url: `https://res.cloudinary.com/madhura/image/upload/v1/invoices/${inv.invoice_no}.pdf`
    });
  } catch (error) {
    next(error);
  }
};

exports.getProformaInvoices = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.client_id && mongoose.Types.ObjectId.isValid(req.query.client_id)) {
      filter.customer_id = req.query.client_id;
    }
    const proformas = await ProformaInvoice.find(filter).sort({ createdAt: -1 }).lean();
    res.status(200).json({ success: true, count: proformas.length, data: proformas });
  } catch (error) {
    next(error);
  }
};

exports.createPaymentIntent = async (req, res, next) => {
  try {
    const { amount, currency } = req.body;
    res.status(200).json({
      success: true,
      order_id: `order_${Date.now()}`,
      amount_paisa: (amount || 1000) * 100,
      currency: currency || 'INR',
      gateway: 'RAZORPAY',
      key_id: 'rzp_live_sample_key_9981'
    });
  } catch (error) {
    next(error);
  }
};

// --- 5.1 Client Token Issuer ---
exports.issueClientToken = async (req, res, next) => {
  try {
    const { clientId, email, name } = req.body;
    let client = null;

    if (clientId && mongoose.Types.ObjectId.isValid(clientId)) {
      client = await ClientOnboarding.findById(clientId).lean();
      if (!client) {
        const Client = mongoose.model('Client');
        client = await Client.findById(clientId).lean();
      }
    }

    if (!client && email) {
      client = await ClientOnboarding.findOne({ email: email.toLowerCase().trim() }).lean();
      if (!client) {
        const Client = mongoose.model('Client');
        client = await Client.findOne({ email: email.toLowerCase().trim() }).lean();
      }
    }

    if (!client) {
      return res.status(404).json({
        success: false,
        error: { code: 'client_not_found', message: 'Client account not found' }
      });
    }

    const clientPayload = {
      id: client._id.toString(),
      clientId: client._id.toString(),
      role: 'CLIENT',
      isClient: true,
      name: name || client.ownerName || client.businessName || client.name || 'Client',
      email: email || client.email || '',
      companyId: client.companyId || 'company_madhura'
    };

    const jwt = require('jsonwebtoken');
    const token = jwt.sign(clientPayload, process.env.JWT_SECRET || 'super_secret_jwt_key_123', {
      expiresIn: '30d'
    });

    res.status(200).json({
      success: true,
      token,
      client: {
        id: client._id.toString(),
        name: clientPayload.name,
        email: clientPayload.email,
        businessName: client.businessName || client.name || clientPayload.name
      }
    });
  } catch (error) {
    next(error);
  }
};

// --- 6. Questions / Support Tickets Privacy & RBAC Helpers ---

// Helper: Get subordinate user IDs for a manager
async function getSubordinateUserIds(userId) {
  try {
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) return [];
    const directReports = await User.find({ manager: userId, isActive: true }).select('_id');
    return directReports.map(u => u._id);
  } catch (err) {
    console.error('Error fetching subordinates:', err.message);
    return [];
  }
}

// Helper: Build strict MongoDB filter based on user role and privacy scope
async function buildUserTicketFilter(user, baseFilter = {}) {
  const isClient = user?.isClient || user?.role === 'CLIENT';
  if (isClient) {
    if (!user?.clientId || !mongoose.Types.ObjectId.isValid(user.clientId)) {
      const err = new Error('Unauthorized client context');
      err.statusCode = 403;
      throw err;
    }
    return { ...baseFilter, client_id: new mongoose.Types.ObjectId(user.clientId) };
  }

  // 1. CRM Admin: Access to all tickets
  if (user?.isAdmin) {
    return { ...baseFilter };
  }

  // 2. Support Manager / Team Lead: Access to tickets created by or assigned to self or subordinates
  if (user?.isManager) {
    const subIds = await getSubordinateUserIds(user.id);
    const accessibleUserIds = [new mongoose.Types.ObjectId(user.id), ...subIds];
    const managerScope = {
      $or: [
        { created_by: { $in: accessibleUserIds } },
        { assignee_id: { $in: accessibleUserIds } },
      ],
    };
    if (Object.keys(baseFilter).length > 0) {
      return { $and: [baseFilter, managerScope] };
    }
    return managerScope;
  }

  // 3. Regular CRM Staff (Field Executive, user, etc.):
  // Can ONLY access tickets they created OR that are assigned directly to them!
  const userIdObj = mongoose.Types.ObjectId.isValid(user?.id)
    ? new mongoose.Types.ObjectId(user.id)
    : user?.id;

  const userScope = {
    $or: [
      { created_by: userIdObj },
      { assignee_id: userIdObj },
    ],
  };

  if (Object.keys(baseFilter).length > 0) {
    return { $and: [baseFilter, userScope] };
  }
  return userScope;
}

// Helper: Verify whether a user can access, message, update, or delete a ticket
async function canUserAccessTicket(user, ticket, action = 'read') {
  if (!user || !ticket) return false;

  // 1. Client user check
  const isClient = user.isClient || user.role === 'CLIENT';
  if (isClient) {
    const ticketClientId = ticket.client_id?._id || ticket.client_id;
    if (!ticketClientId || String(ticketClientId) !== String(user.clientId)) {
      return false;
    }
    // Clients cannot delete tickets
    if (action === 'delete') return false;
    return true;
  }

  // 2. Admin has full access to any ticket
  if (user.isAdmin) return true;

  const userIdStr = String(user.id || user._id);
  const createdByStr = ticket.created_by ? String(ticket.created_by._id || ticket.created_by) : null;
  const assigneeIdStr = ticket.assignee_id ? String(ticket.assignee_id._id || ticket.assignee_id) : null;

  // Creator or Assignee has access
  const isDirectOwner = (createdByStr === userIdStr || assigneeIdStr === userIdStr);
  if (isDirectOwner) {
    // Regular users can only delete if they created it AND status is still OPEN
    if (action === 'delete') {
      return createdByStr === userIdStr && ticket.status === 'OPEN';
    }
    return true;
  }

  // 3. Manager check (subordinates)
  if (user.isManager) {
    const subIds = await getSubordinateUserIds(user.id);
    const subIdStrs = subIds.map(id => String(id));
    const isSubordinateTicket = (
      (createdByStr && subIdStrs.includes(createdByStr)) ||
      (assigneeIdStr && subIdStrs.includes(assigneeIdStr))
    );
    if (isSubordinateTicket) {
      if (action === 'delete') return false; // Only Admin or original creator can delete
      return true;
    }
  }

  return false;
}

exports.buildUserTicketFilter = buildUserTicketFilter;
exports.canUserAccessTicket = canUserAccessTicket;

// --- 6. Questions / Support Tickets Endpoints ---
exports.getTickets = async (req, res, next) => {
  try {
    const isClient = req.user?.isClient || req.user?.role === 'CLIENT';
    const isStaff = req.user?.isStaff;

    if (!isClient && !isStaff) {
      return res.status(401).json({
        success: false,
        error: { code: 'unauthorized', message: 'Authentication required' }
      });
    }

    const baseFilter = {};

    // If Admin/Manager supplied a client_id query param:
    if (isStaff) {
      const queryClientId = req.query.client_id || req.query.clientId;
      if (queryClientId && mongoose.Types.ObjectId.isValid(queryClientId)) {
        baseFilter.client_id = new mongoose.Types.ObjectId(queryClientId);
      }
    }

    // Status filter
    if (req.query.status && req.query.status !== 'ALL') {
      baseFilter.status = req.query.status.toUpperCase();
    }

    // Priority filter
    if (req.query.priority && req.query.priority !== 'ALL') {
      baseFilter.priority = req.query.priority.toUpperCase();
    }

    // Search query filter (search by code, title, client name, email)
    if (req.query.search && req.query.search.trim()) {
      const q = req.query.search.trim();
      const regex = new RegExp(q, 'i');
      baseFilter.$or = [
        { code: regex },
        { title: regex },
        { 'creator.name': regex },
        { 'creator.email': regex }
      ];
    }

    // Source filter (CRM vs PORTAL)
    if (req.query.source && req.query.source !== 'ALL') {
      const src = req.query.source.toUpperCase();
      if (src === 'CRM') {
        baseFilter.source = 'CRM';
      } else if (src === 'PORTAL') {
        baseFilter.source = { $ne: 'CRM' };
      }
    }

    // Apply role-based privacy filter
    const filter = await buildUserTicketFilter(req.user, baseFilter);

    const tickets = await Ticket.find(filter)
      .populate('client_id', 'businessName ownerName email phone name company_name')
      .populate('assignee_id', 'name email designation role')
      .populate('created_by', 'name email designation role')
      .sort({ updatedAt: -1, updated_at: -1 })
      .lean();

    const formattedTickets = tickets.map((t) => {
      // Sanitize messages for client view: strip internal notes
      const msgs = isClient ? (t.messages || []).filter((m) => !m.internal) : (t.messages || []);
      return {
        ...t,
        id: t._id,
        clientId: t.client_id?._id || t.client_id,
        projectId: t.project_id,
        createdById: t.created_by?._id || t.created_by,
        assigneeId: t.assignee_id?._id || t.assignee_id,
        messages: msgs,
        source: t.source || (t.creator?.email?.includes('madhuratech.com') || t.creator?.name === 'Administrator' ? 'CRM' : 'PORTAL'),
      };
    });

    res.status(200).json({ success: true, count: formattedTickets.length, data: formattedTickets });
  } catch (error) {
    if (error.statusCode === 403) {
      return res.status(403).json({ success: false, error: { code: 'forbidden', message: error.message } });
    }
    next(error);
  }
};

exports.getTicketById = async (req, res, next) => {
  try {
    const lookup = mongoose.Types.ObjectId.isValid(req.params.id)
      ? { _id: req.params.id }
      : { code: req.params.id };

    const ticket = await Ticket.findOne(lookup)
      .populate('client_id', 'businessName ownerName email phone name company_name')
      .populate('assignee_id', 'name email designation role')
      .populate('created_by', 'name email designation role')
      .lean();

    if (!ticket) {
      return res.status(404).json({ success: false, error: { code: 'not_found', message: 'Ticket not found' } });
    }

    // Role-based privacy validation
    const hasAccess = await canUserAccessTicket(req.user, ticket, 'read');
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: { code: 'forbidden', message: 'Access denied: You do not have permission to view this ticket' }
      });
    }

    const isClient = req.user?.isClient || req.user?.role === 'CLIENT';
    if (isClient) {
      ticket.messages = (ticket.messages || []).filter((m) => !m.internal);
    }

    ticket.id = ticket._id;
    ticket.clientId = ticket.client_id?._id || ticket.client_id;
    ticket.projectId = ticket.project_id;
    ticket.createdById = ticket.created_by?._id || ticket.created_by;
    ticket.assigneeId = ticket.assignee_id?._id || ticket.assignee_id;

    res.status(200).json({ success: true, data: ticket });
  } catch (error) {
    next(error);
  }
};

exports.createTicket = async (req, res, next) => {
  try {
    const { title, description, category, priority, author_name, author_email, project_id, projectId, assignee_id } = req.body;
    if (!title || !description) {
      return res.status(400).json({ success: false, message: 'Title and description are required' });
    }

    const isClient = req.user?.isClient || req.user?.role === 'CLIENT';
    const isStaff = req.user?.isStaff;

    let clientId = null;
    let source = 'PORTAL';
    let creator = {};
    let createdBy = null;
    let initialAssignee = null;

    if (isClient) {
      if (!req.user.clientId || !mongoose.Types.ObjectId.isValid(req.user.clientId)) {
        return res.status(403).json({
          success: false,
          error: { code: 'forbidden', message: 'Valid client context required to create a ticket' }
        });
      }
      clientId = req.user.clientId;
      source = 'PORTAL';
      creator = {
        name: req.user.name || author_name || 'Client',
        email: req.user.email || author_email || '',
      };
      createdBy = null;
    } else if (isStaff) {
      const rawClientId = req.body.client_id || req.body.clientId;
      clientId = (rawClientId && mongoose.Types.ObjectId.isValid(rawClientId)) ? rawClientId : null;
      source = req.body.source || 'CRM';
      creator = {
        contact_id: req.user.id,
        name: req.user.name || author_name || 'Support Staff',
        email: req.user.email || author_email || '',
      };
      createdBy = req.user.id;
      if (assignee_id && mongoose.Types.ObjectId.isValid(assignee_id)) {
        initialAssignee = assignee_id;
      }
    } else {
      return res.status(401).json({ success: false, error: { code: 'unauthorized', message: 'Authentication required' } });
    }

    const rawProjectId = project_id || projectId;
    const resolvedProjectId = (rawProjectId && mongoose.Types.ObjectId.isValid(rawProjectId)) ? rawProjectId : null;

    const count = await Ticket.countDocuments();
    const code = `TCK-${1000 + count + 1}`;

    const newTicket = await Ticket.create({
      code,
      created_by: createdBy,
      client_id: clientId,
      project_id: resolvedProjectId,
      assignee_id: initialAssignee,
      title,
      description,
      category: category || 'GENERAL',
      priority: priority ? priority.toUpperCase() : 'MEDIUM',
      status: 'OPEN',
      source,
      creator,
      messages: [{
        sender: isStaff ? 'STAFF' : 'CLIENT',
        sender_id: req.user?.id && mongoose.Types.ObjectId.isValid(req.user.id) ? req.user.id : undefined,
        author_name: creator.name,
        author_email: creator.email,
        internal: false,
        message: description
      }]
    });

    const populated = await Ticket.findById(newTicket._id)
      .populate('client_id', 'businessName ownerName email phone name company_name')
      .populate('assignee_id', 'name email designation role')
      .populate('created_by', 'name email designation role')
      .lean();

    const ticketObj = {
      ...populated,
      id: populated._id,
      clientId: populated.client_id?._id || populated.client_id,
      projectId: populated.project_id,
      createdById: populated.created_by?._id || populated.created_by,
      assigneeId: populated.assignee_id?._id || populated.assignee_id,
    };

    // Emit event ONLY to authorized rooms!
    if (req.io) {
      try {
        req.io.to('crm_admin_room').emit('ticket_created', ticketObj);
        req.io.to('company_madhura_tickets').emit('ticket_created', ticketObj);

        if (createdBy) {
          req.io.to(`user_${createdBy}`).emit('ticket_created', ticketObj);
        }
        if (initialAssignee) {
          req.io.to(`user_${initialAssignee}`).emit('ticket_created', ticketObj);
        }
        if (clientId) {
          req.io.to(`client_${clientId}`).emit('ticket_created', ticketObj);
        }

        // Send notifications to CRM admins
        const admins = await User.find({ role: { $in: ['Admin', 'Managing Director MD', 'Project Manager', 'Team Lead'] }, isActive: true }).select('_id');
        await Promise.all(
          admins.map(async (admin) => {
            const notif = await Notification.create({
              recipient: admin._id,
              sender: isStaff && req.user?.id && mongoose.Types.ObjectId.isValid(req.user.id) ? req.user.id : admin._id,
              title: `New Support Ticket: ${code}`,
              message: `${creator.name} raised ticket: "${title}"`,
              type: 'Info',
            });
            req.io.to(admin._id.toString()).emit('notification', notif);
          })
        );
      } catch (notifErr) {
        console.warn('Socket dispatch warning:', notifErr.message);
      }
    }

    res.status(201).json({ success: true, data: ticketObj });
  } catch (error) {
    next(error);
  }
};

exports.addTicketMessage = async (req, res, next) => {
  try {
    const { message, author_name, author_email, sender_type, internal, clientMessageId } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message content is required' });
    }

    const lookup = mongoose.Types.ObjectId.isValid(req.params.id)
      ? { _id: req.params.id }
      : { code: req.params.id };

    const ticket = await Ticket.findOne(lookup);
    if (!ticket) {
      return res.status(404).json({ success: false, error: { code: 'not_found', message: 'Ticket not found' } });
    }

    // Role-based privacy validation
    const hasAccess = await canUserAccessTicket(req.user, ticket, 'message');
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: { code: 'forbidden', message: 'Access denied: You do not have permission to send messages on this ticket' }
      });
    }

    const isClient = req.user?.isClient || req.user?.role === 'CLIENT';
    const isStaff = req.user?.isStaff;

    const sender = isStaff ? (sender_type === 'CLIENT' ? 'CLIENT' : 'STAFF') : 'CLIENT';
    const isInternalNote = isStaff && !!internal; // Clients can NEVER send internal notes
    const author = isClient
      ? (req.user.name || author_name || 'Client')
      : (req.user.name || author_name || 'Support Staff');
    const email = isClient
      ? (req.user.email || author_email || '')
      : (req.user.email || author_email || '');

    const newMsgDoc = {
      sender,
      sender_id: req.user?.id && mongoose.Types.ObjectId.isValid(req.user.id) ? req.user.id : undefined,
      author_name: author,
      author_email: email,
      message: message.trim(),
      internal: isInternalNote,
      created_at: new Date()
    };

    ticket.messages.push(newMsgDoc);
    ticket.updated_at = new Date();

    // Auto-update status
    if (sender === 'CLIENT') {
      if (['RESOLVED', 'CLOSED'].includes(ticket.status)) {
        ticket.status = 'OPEN';
      }
    } else if (sender === 'STAFF' && !isInternalNote) {
      if (ticket.status === 'OPEN') {
        ticket.status = 'IN_PROGRESS';
      }
    }

    await ticket.save();

    const populated = await Ticket.findById(ticket._id)
      .populate('client_id', 'businessName ownerName email phone name company_name')
      .populate('assignee_id', 'name email designation role')
      .populate('created_by', 'name email designation role')
      .lean();

    const ticketObj = {
      ...populated,
      id: populated._id,
      clientId: populated.client_id?._id || populated.client_id,
      projectId: populated.project_id,
      createdById: populated.created_by?._id || populated.created_by,
      assigneeId: populated.assignee_id?._id || populated.assignee_id,
      source: populated.source || 'CRM'
    };

    const createdMsg = ticketObj.messages[ticketObj.messages.length - 1];

    if (req.io) {
      const messagePayload = {
        ticketId: ticketObj.id.toString(),
        ticketCode: ticketObj.code,
        clientMessageId: clientMessageId || null,
        message: createdMsg,
        ticket: ticketObj,
      };

      // 1. Emit to ticket-specific rooms (by ID and code)
      req.io.to(`ticket_${ticketObj.id}`).emit('new_ticket_message', messagePayload);
      if (ticketObj.code) {
        req.io.to(`ticket_${ticketObj.code}`).emit('new_ticket_message', messagePayload);
      }

      // 2. Emit to Admin room
      req.io.to('crm_admin_room').emit('new_ticket_message', messagePayload);

      // 3. Emit to creator and assignee private rooms
      if (ticketObj.createdById) {
        req.io.to(`user_${ticketObj.createdById}`).emit('new_ticket_message', messagePayload);
      }
      if (ticketObj.assigneeId) {
        req.io.to(`user_${ticketObj.assigneeId}`).emit('new_ticket_message', messagePayload);
      }

      // 4. Emit to the specific client's room ONLY if not an internal note!
      if (ticketObj.clientId && !isInternalNote) {
        const clientRoom = `client_${ticketObj.clientId}`;
        req.io.to(clientRoom).emit('new_ticket_message', messagePayload);
        req.io.to(clientRoom).emit('ticket_updated', ticketObj);
      }

      // 5. Notifications for staff if client replies
      if (sender === 'CLIENT') {
        try {
          const admins = await User.find({ role: { $in: ['Admin', 'Managing Director MD', 'Project Manager', 'Team Lead'] }, isActive: true }).select('_id');
          await Promise.all(
            admins.map(async (admin) => {
              const notif = await Notification.create({
                recipient: admin._id,
                sender: admin._id,
                title: `New Reply on ${ticket.code}`,
                message: `${author}: "${message.substring(0, 80)}"`,
                type: 'Info',
              });
              req.io.to(admin._id.toString()).emit('notification', notif);
            })
          );
        } catch (notifErr) {
          console.warn('Notification error on client message:', notifErr.message);
        }
      }
    }

    res.status(201).json({ success: true, message: 'Reply posted', data: ticketObj, messageData: createdMsg });
  } catch (error) {
    next(error);
  }
};

exports.getTicketMessages = async (req, res, next) => {
  try {
    const lookup = mongoose.Types.ObjectId.isValid(req.params.id)
      ? { _id: req.params.id }
      : { code: req.params.id };

    const ticket = await Ticket.findOne(lookup).select('messages client_id created_by assignee_id code status').lean();
    if (!ticket) {
      return res.status(404).json({ success: false, error: { code: 'not_found', message: 'Ticket not found' } });
    }

    const hasAccess = await canUserAccessTicket(req.user, ticket, 'read');
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: { code: 'forbidden', message: 'Access denied: You do not have permission to view conversation history for this ticket' }
      });
    }

    const isClient = req.user?.isClient || req.user?.role === 'CLIENT';
    const messages = isClient
      ? (ticket.messages || []).filter(m => !m.internal)
      : (ticket.messages || []);

    res.status(200).json({ success: true, count: messages.length, data: messages });
  } catch (error) {
    next(error);
  }
};

exports.updateTicketStatus = async (req, res, next) => {
  try {
    const { status, priority, assignee_id } = req.body;
    const lookup = mongoose.Types.ObjectId.isValid(req.params.id)
      ? { _id: req.params.id }
      : { code: req.params.id };

    const ticket = await Ticket.findOne(lookup);
    if (!ticket) {
      return res.status(404).json({ success: false, error: { code: 'not_found', message: 'Ticket not found' } });
    }

    const hasAccess = await canUserAccessTicket(req.user, ticket, 'update');
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: { code: 'forbidden', message: 'Access denied: You do not have permission to update this ticket' }
      });
    }

    const isClient = req.user?.isClient || req.user?.role === 'CLIENT';
    const isStaff = req.user?.isStaff;

    if (isClient) {
      // Clients can only mark as CLOSED or re-open as OPEN
      if (status && ['CLOSED', 'OPEN'].includes(status.toUpperCase())) {
        ticket.status = status.toUpperCase();
      }
    } else if (isStaff) {
      if (status) ticket.status = status.toUpperCase();
      // Only Admin or Manager can alter priority or reassign tickets
      if (req.user.isAdmin || req.user.isManager) {
        if (priority) ticket.priority = priority.toUpperCase();
        if (assignee_id !== undefined) {
          ticket.assignee_id = (assignee_id && mongoose.Types.ObjectId.isValid(assignee_id)) ? assignee_id : null;
        }
      } else {
        // Regular user can only update status
        if (status) ticket.status = status.toUpperCase();
        if (assignee_id !== undefined && String(assignee_id) !== String(ticket.assignee_id)) {
          return res.status(403).json({
            success: false,
            error: { code: 'forbidden', message: 'Only managers and admins can reassign tickets' }
          });
        }
      }
    }

    ticket.updated_at = new Date();
    await ticket.save();

    const populated = await Ticket.findById(ticket._id)
      .populate('client_id', 'businessName ownerName email phone name company_name')
      .populate('assignee_id', 'name email designation role')
      .populate('created_by', 'name email designation role')
      .lean();

    const ticketObj = {
      ...populated,
      id: populated._id,
      clientId: populated.client_id?._id || populated.client_id,
      projectId: populated.project_id,
      createdById: populated.created_by?._id || populated.created_by,
      assigneeId: populated.assignee_id?._id || populated.assignee_id,
    };

    if (req.io) {
      req.io.to(`ticket_${ticketObj.id}`).emit('ticket_updated', ticketObj);
      if (ticketObj.code) req.io.to(`ticket_${ticketObj.code}`).emit('ticket_updated', ticketObj);
      req.io.to('crm_admin_room').emit('ticket_updated', ticketObj);
      if (ticketObj.createdById) {
        req.io.to(`user_${ticketObj.createdById}`).emit('ticket_updated', ticketObj);
      }
      if (ticketObj.assigneeId) {
        req.io.to(`user_${ticketObj.assigneeId}`).emit('ticket_updated', ticketObj);
      }
      if (ticketObj.clientId) {
        req.io.to(`client_${ticketObj.clientId}`).emit('ticket_updated', ticketObj);
      }
    }

    res.status(200).json({ success: true, data: ticketObj });
  } catch (error) {
    next(error);
  }
};

exports.deleteTicket = async (req, res, next) => {
  try {
    const lookup = mongoose.Types.ObjectId.isValid(req.params.id)
      ? { _id: req.params.id }
      : { code: req.params.id };

    const ticket = await Ticket.findOne(lookup);
    if (!ticket) {
      return res.status(404).json({ success: false, error: { code: 'not_found', message: 'Ticket not found' } });
    }

    const canDelete = await canUserAccessTicket(req.user, ticket, 'delete');
    if (!canDelete) {
      return res.status(403).json({
        success: false,
        error: { code: 'forbidden', message: 'Access denied: You are not authorized to delete this ticket' }
      });
    }

    const ticketId = ticket._id.toString();
    const ticketCode = ticket.code;
    const clientId = ticket.client_id?.toString();
    const createdById = ticket.created_by?.toString();
    const assigneeId = ticket.assignee_id?.toString();

    await Ticket.deleteOne({ _id: ticket._id });

    if (req.io) {
      const payload = { ticketId, ticketCode };
      req.io.to(`ticket_${ticketId}`).emit('ticket_deleted', payload);
      req.io.to('crm_admin_room').emit('ticket_deleted', payload);
      if (createdById) req.io.to(`user_${createdById}`).emit('ticket_deleted', payload);
      if (assigneeId) req.io.to(`user_${assigneeId}`).emit('ticket_deleted', payload);
      if (clientId) req.io.to(`client_${clientId}`).emit('ticket_deleted', payload);
    }

    res.status(200).json({ success: true, message: 'Ticket deleted successfully' });
  } catch (error) {
    next(error);
  }
};

exports.addTicketAttachment = async (req, res, next) => {
  try {
    const lookup = mongoose.Types.ObjectId.isValid(req.params.id)
      ? { _id: req.params.id }
      : { code: req.params.id };

    const ticket = await Ticket.findOne(lookup);
    if (!ticket) {
      return res.status(404).json({ success: false, error: { code: 'not_found', message: 'Ticket not found' } });
    }

    const hasAccess = await canUserAccessTicket(req.user, ticket, 'message');
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: { code: 'forbidden', message: 'Access denied: You do not have permission to attach files to this ticket' }
      });
    }

    let attachmentObj = null;

    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file.buffer, 'ticket_attachments');
      attachmentObj = {
        name: req.file.originalname,
        url: uploadResult.secure_url || uploadResult.url,
        type: req.file.mimetype,
        size: req.file.size,
        uploaded_at: new Date()
      };
    } else if (req.body.url && req.body.name) {
      attachmentObj = {
        name: req.body.name,
        url: req.body.url,
        type: req.body.type || 'application/octet-stream',
        size: Number(req.body.size || 0),
        uploaded_at: new Date()
      };
    } else {
      return res.status(400).json({ success: false, message: 'File or attachment url is required' });
    }

    ticket.attachments = ticket.attachments || [];
    ticket.attachments.push(attachmentObj);
    ticket.updated_at = new Date();
    await ticket.save();

    if (req.io) {
      const payload = {
        ticketId: ticket._id.toString(),
        attachment: attachmentObj,
      };
      req.io.to(`ticket_${ticket._id}`).emit('ticket_attachment_added', payload);
      req.io.to('crm_admin_room').emit('ticket_attachment_added', payload);
      if (ticket.created_by) req.io.to(`user_${ticket.created_by}`).emit('ticket_attachment_added', payload);
      if (ticket.assignee_id) req.io.to(`user_${ticket.assignee_id}`).emit('ticket_attachment_added', payload);
      if (ticket.client_id) req.io.to(`client_${ticket.client_id}`).emit('ticket_attachment_added', payload);
    }

    res.status(201).json({ success: true, data: attachmentObj });
  } catch (error) {
    next(error);
  }
};

// --- 7. Approvals Endpoints ---
exports.getApprovals = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.client_id) filter.client_id = req.query.client_id;
    const approvals = await Approval.find(filter).sort({ createdAt: -1 }).lean();
    res.status(200).json({ success: true, count: approvals.length, data: approvals });
  } catch (error) {
    next(error);
  }
};

exports.createApproval = async (req, res, next) => {
  try {
    const approval = await Approval.create(req.body);
    res.status(201).json({ success: true, data: approval });
  } catch (error) {
    next(error);
  }
};

exports.decideApproval = async (req, res, next) => {
  try {
    const { decision, approved_by, comments, signature_token } = req.body;
    const approval = await Approval.findById(req.params.id);
    if (!approval) {
      return res.status(404).json({ success: false, error: { code: 'not_found', message: 'Approval not found' } });
    }

    approval.status = decision === 'APPROVED' ? 'APPROVED' : 'REJECTED';
    approval.decision_by = approved_by || 'Client';
    approval.comments = comments || '';
    approval.signature_token = signature_token || '';
    approval.decided_at = new Date();
    await approval.save();

    res.status(200).json({ success: true, message: `Approval marked as ${approval.status}`, data: approval });
  } catch (error) {
    next(error);
  }
};

// --- 8. Webhook Receiver ---
exports.handlePortalWebhook = async (req, res) => {
  const { id, type, data } = req.body;
  console.log(`[Webhook Received] Type: ${type}, ID: ${id}`);
  res.status(200).json({
    success: true,
    received: true,
    event_id: id || `evt_${Date.now()}`
  });
};
