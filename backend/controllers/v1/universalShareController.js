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

// --- 6. Questions / Support Tickets Endpoints ---
exports.getTickets = async (req, res, next) => {
  try {
    const filter = {};
    const isClient = req.user?.isClient || req.user?.role === 'CLIENT';
    const isStaff = req.user?.isStaff;

    // 1. Strict Isolation: Clients can ONLY ever query their own client_id
    if (isClient) {
      if (!req.user.clientId || !mongoose.Types.ObjectId.isValid(req.user.clientId)) {
        return res.status(403).json({
          success: false,
          error: { code: 'forbidden', message: 'Unauthorized client context' }
        });
      }
      filter.client_id = req.user.clientId;
    } else if (isStaff) {
      // CRM Staff can optionally filter by client_id
      const queryClientId = req.query.client_id || req.query.clientId;
      if (queryClientId && mongoose.Types.ObjectId.isValid(queryClientId)) {
        filter.client_id = queryClientId;
      }
    } else {
      return res.status(401).json({
        success: false,
        error: { code: 'unauthorized', message: 'Authentication required' }
      });
    }

    // Status filter
    if (req.query.status && req.query.status !== 'ALL') {
      filter.status = req.query.status.toUpperCase();
    }

    // Priority filter
    if (req.query.priority && req.query.priority !== 'ALL') {
      filter.priority = req.query.priority.toUpperCase();
    }

    // Search query filter (search by code, title, client name, email)
    if (req.query.search && req.query.search.trim()) {
      const q = req.query.search.trim();
      const regex = new RegExp(q, 'i');
      filter.$or = [
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
        filter.source = 'CRM';
      } else if (src === 'PORTAL') {
        filter.source = { $ne: 'CRM' };
      }
    }

    const tickets = await Ticket.find(filter)
      .populate('client_id', 'businessName ownerName email phone name company_name')
      .populate('assignee_id', 'name email designation')
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
        messages: msgs,
        source: t.source || (t.creator?.email?.includes('madhuratech.com') || t.creator?.name === 'Administrator' ? 'CRM' : 'PORTAL'),
      };
    });

    res.status(200).json({ success: true, count: formattedTickets.length, data: formattedTickets });
  } catch (error) {
    next(error);
  }
};

exports.getTicketById = async (req, res, next) => {
  try {
    let ticket = null;
    const lookup = mongoose.Types.ObjectId.isValid(req.params.id)
      ? { _id: req.params.id }
      : { code: req.params.id };

    ticket = await Ticket.findOne(lookup)
      .populate('client_id', 'businessName ownerName email phone name company_name')
      .populate('assignee_id', 'name email designation')
      .lean();

    if (!ticket) {
      return res.status(404).json({ success: false, error: { code: 'not_found', message: 'Ticket not found' } });
    }

    const isClient = req.user?.isClient || req.user?.role === 'CLIENT';
    const isStaff = req.user?.isStaff;

    // Strict IDOR Prevention: If caller is a client, verify ownership
    if (isClient) {
      const ticketClientId = ticket.client_id?._id || ticket.client_id;
      if (!ticketClientId || String(ticketClientId) !== String(req.user.clientId)) {
        return res.status(403).json({
          success: false,
          error: { code: 'forbidden', message: 'Access denied: You do not have permission to view this ticket' }
        });
      }
      // Strip internal staff notes from client view
      ticket.messages = (ticket.messages || []).filter((m) => !m.internal);
    } else if (!isStaff) {
      return res.status(401).json({ success: false, error: { code: 'unauthorized', message: 'Authentication required' } });
    }

    ticket.id = ticket._id;
    ticket.clientId = ticket.client_id?._id || ticket.client_id;
    ticket.projectId = ticket.project_id;
    res.status(200).json({ success: true, data: ticket });
  } catch (error) {
    next(error);
  }
};

exports.createTicket = async (req, res, next) => {
  try {
    const { title, description, category, priority, author_name, author_email, project_id, projectId } = req.body;
    if (!title || !description) {
      return res.status(400).json({ success: false, message: 'Title and description are required' });
    }

    const isClient = req.user?.isClient || req.user?.role === 'CLIENT';
    const isStaff = req.user?.isStaff;

    let clientId = null;
    let source = 'PORTAL';
    let creator = {};

    if (isClient) {
      // Automatic client assignment from cryptographically verified identity
      // Never allow clients to override or supply another client's id
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
    } else if (isStaff) {
      const rawClientId = req.body.client_id || req.body.clientId;
      clientId = (rawClientId && mongoose.Types.ObjectId.isValid(rawClientId)) ? rawClientId : null;
      source = req.body.source || 'CRM';
      creator = {
        name: req.user.name || author_name || 'Support Staff',
        email: req.user.email || author_email || '',
      };
    } else {
      return res.status(401).json({ success: false, error: { code: 'unauthorized', message: 'Authentication required' } });
    }

    const rawProjectId = project_id || projectId;
    const resolvedProjectId = (rawProjectId && mongoose.Types.ObjectId.isValid(rawProjectId)) ? rawProjectId : null;

    const count = await Ticket.countDocuments();
    const code = `TCK-${1000 + count + 1}`;

    const newTicket = await Ticket.create({
      code,
      client_id: clientId,
      project_id: resolvedProjectId,
      title,
      description,
      category: category || 'GENERAL',
      priority: priority ? priority.toUpperCase() : 'MEDIUM',
      status: 'OPEN',
      source,
      creator,
      messages: [{
        sender: isStaff ? 'STAFF' : 'CLIENT',
        author_name: creator.name,
        author_email: creator.email,
        internal: false,
        message: description
      }]
    });

    const populated = await Ticket.findById(newTicket._id)
      .populate('client_id', 'businessName ownerName email phone name company_name')
      .populate('assignee_id', 'name email designation')
      .lean();

    const ticketObj = {
      ...populated,
      id: populated._id,
      clientId: populated.client_id?._id || populated.client_id,
      projectId: populated.project_id,
    };

    // Emit event ONLY to staff room and this specific client room!
    if (req.io) {
      try {
        req.io.to('crm_staff_room').emit('ticket_created', ticketObj);
        req.io.to('company_madhura_tickets').emit('ticket_created', ticketObj);
        if (clientId) {
          req.io.to(`client_${clientId}`).emit('ticket_created', ticketObj);
        }

        // Send notifications to CRM admins
        const admins = await User.find({ role: { $in: ['Admin', 'Managing Director MD', 'Project Manager', 'Team Lead'] }, isActive: true }).select('_id');
        await Promise.all(
          admins.map(async (admin) => {
            const notif = await Notification.create({
              recipient: admin._id,
              sender: isStaff ? req.user.id : admin._id,
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

    let ticket = null;
    const lookup = mongoose.Types.ObjectId.isValid(req.params.id)
      ? { _id: req.params.id }
      : { code: req.params.id };

    ticket = await Ticket.findOne(lookup);
    if (!ticket) {
      return res.status(404).json({ success: false, error: { code: 'not_found', message: 'Ticket not found' } });
    }

    const isClient = req.user?.isClient || req.user?.role === 'CLIENT';
    const isStaff = req.user?.isStaff;

    // Strict IDOR Check for messaging
    if (isClient) {
      if (!ticket.client_id || String(ticket.client_id) !== String(req.user.clientId)) {
        return res.status(403).json({
          success: false,
          error: { code: 'forbidden', message: 'Access denied: You do not have permission to send messages on this ticket' }
        });
      }
    } else if (!isStaff) {
      return res.status(401).json({ success: false, error: { code: 'unauthorized', message: 'Authentication required' } });
    }

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
      .populate('assignee_id', 'name email designation')
      .lean();

    const ticketObj = {
      ...populated,
      id: populated._id,
      clientId: populated.client_id?._id || populated.client_id,
      projectId: populated.project_id,
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

      // 2. Emit to authorized CRM Staff room
      req.io.to('crm_staff_room').emit('new_ticket_message', messagePayload);
      req.io.to('company_madhura_tickets').emit('ticket_updated', ticketObj);

      // 3. Emit to the specific client's room ONLY if not an internal note!
      if (ticketObj.clientId && !isInternalNote) {
        const clientRoom = `client_${ticketObj.clientId}`;
        req.io.to(clientRoom).emit('new_ticket_message', messagePayload);
        req.io.to(clientRoom).emit('ticket_updated', ticketObj);
      }

      // 4. Notifications for staff if client replies
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

exports.updateTicketStatus = async (req, res, next) => {
  try {
    const { status, priority, assignee_id } = req.body;
    let ticket = null;
    const lookup = mongoose.Types.ObjectId.isValid(req.params.id)
      ? { _id: req.params.id }
      : { code: req.params.id };

    ticket = await Ticket.findOne(lookup);
    if (!ticket) {
      return res.status(404).json({ success: false, error: { code: 'not_found', message: 'Ticket not found' } });
    }

    const isClient = req.user?.isClient || req.user?.role === 'CLIENT';
    const isStaff = req.user?.isStaff;

    if (isClient) {
      // IDOR check: Verify client owns ticket
      if (!ticket.client_id || String(ticket.client_id) !== String(req.user.clientId)) {
        return res.status(403).json({
          success: false,
          error: { code: 'forbidden', message: 'Access denied: You do not own this ticket' }
        });
      }
      // Clients can only mark as CLOSED or re-open as OPEN
      if (status && ['CLOSED', 'OPEN'].includes(status.toUpperCase())) {
        ticket.status = status.toUpperCase();
      }
      // Cannot change priority or assignee
    } else if (isStaff) {
      if (status) ticket.status = status.toUpperCase();
      if (priority) ticket.priority = priority.toUpperCase();
      if (assignee_id !== undefined) {
        ticket.assignee_id = (assignee_id && mongoose.Types.ObjectId.isValid(assignee_id)) ? assignee_id : null;
      }
    } else {
      return res.status(401).json({ success: false, error: { code: 'unauthorized', message: 'Authentication required' } });
    }

    ticket.updated_at = new Date();
    await ticket.save();

    const populated = await Ticket.findById(ticket._id)
      .populate('client_id', 'businessName ownerName email phone name company_name')
      .populate('assignee_id', 'name email designation')
      .lean();

    const ticketObj = {
      ...populated,
      id: populated._id,
      clientId: populated.client_id?._id || populated.client_id,
      projectId: populated.project_id,
    };

    if (req.io) {
      req.io.to(`ticket_${ticketObj.id}`).emit('ticket_updated', ticketObj);
      if (ticketObj.code) req.io.to(`ticket_${ticketObj.code}`).emit('ticket_updated', ticketObj);
      req.io.to('crm_staff_room').emit('ticket_updated', ticketObj);
      req.io.to('company_madhura_tickets').emit('ticket_updated', ticketObj);
      if (ticketObj.clientId) {
        req.io.to(`client_${ticketObj.clientId}`).emit('ticket_updated', ticketObj);
      }
    }

    res.status(200).json({ success: true, data: ticketObj });
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
