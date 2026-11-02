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

// --- 6. Questions / Support Tickets Endpoints ---
exports.getTickets = async (req, res, next) => {
  try {
    const filter = {};
    const clientId = req.query.client_id || req.query.clientId;
    if (clientId && mongoose.Types.ObjectId.isValid(clientId)) {
      filter.client_id = clientId;
    }
    if (req.query.status && req.query.status !== 'ALL') {
      filter.status = req.query.status.toUpperCase();
    }
    if (req.query.source && req.query.source !== 'ALL') {
      const src = req.query.source.toUpperCase();
      if (src === 'CRM') {
        filter.$or = [
          { source: 'CRM' },
          { 'creator.email': { $regex: /madhuratech\.com/i } },
          { 'creator.name': 'Administrator' },
        ];
      } else if (src === 'PORTAL') {
        filter.$and = [
          { source: { $ne: 'CRM' } },
          { 'creator.email': { $not: { $regex: /madhuratech\.com/i } } },
          { 'creator.name': { $ne: 'Administrator' } },
        ];
      } else {
        filter.source = src;
      }
    }

    const tickets = await Ticket.find(filter).sort({ updatedAt: -1 }).lean();
    const formattedTickets = tickets.map((t) => ({
      ...t,
      id: t._id,
      clientId: t.client_id,
      projectId: t.project_id,
      source: t.source || (t.creator?.email?.includes('madhuratech.com') || t.creator?.name === 'Administrator' ? 'CRM' : 'PORTAL'),
    }));
    res.status(200).json({ success: true, count: formattedTickets.length, data: formattedTickets });
  } catch (error) {
    next(error);
  }
};

exports.getTicketById = async (req, res, next) => {
  try {
    let ticket = null;
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      ticket = await Ticket.findById(req.params.id).lean();
    }
    if (!ticket) {
      ticket = await Ticket.findOne({ code: req.params.id }).lean();
    }
    if (!ticket) {
      return res.status(404).json({ success: false, error: { code: 'not_found', message: 'Ticket not found' } });
    }
    ticket.id = ticket._id;
    ticket.clientId = ticket.client_id;
    ticket.projectId = ticket.project_id;
    res.status(200).json({ success: true, data: ticket });
  } catch (error) {
    next(error);
  }
};

exports.createTicket = async (req, res, next) => {
  try {
    const rawClientId = req.body.client_id || req.body.clientId;
    const rawProjectId = req.body.project_id || req.body.projectId;
    const { title, description, category, priority, author_name, author_email } = req.body;
    if (!title || !description) {
      return res.status(400).json({ success: false, message: 'Title and description are required' });
    }

    const clientId = (rawClientId && mongoose.Types.ObjectId.isValid(rawClientId)) ? rawClientId : null;
    const projectId = (rawProjectId && mongoose.Types.ObjectId.isValid(rawProjectId)) ? rawProjectId : null;

    const count = await Ticket.countDocuments();
    const code = `TCK-${1000 + count + 1}`;
    const source = req.body.source || (req.user && ['Admin', 'Managing Director MD', 'Project Manager', 'Team Lead', 'Field Executive', 'HR'].includes(req.user.role) ? 'CRM' : 'PORTAL');

    const newTicket = await Ticket.create({
      code,
      client_id: clientId,
      project_id: projectId,
      title,
      description,
      category: category || 'GENERAL',
      priority: priority || 'MEDIUM',
      status: 'OPEN',
      source,
      creator: {
        name: author_name || (req.user ? req.user.name : 'Client'),
        email: author_email || (req.user ? req.user.email : '')
      },
      messages: [{
        sender: (req.user && ['Admin', 'Managing Director MD', 'Project Manager', 'Team Lead', 'Field Executive', 'HR'].includes(req.user.role)) ? 'STAFF' : 'CLIENT',
        author_name: author_name || (req.user ? req.user.name : 'Client'),
        author_email: author_email || (req.user ? req.user.email : ''),
        message: description
      }]
    });

    const ticketObj = newTicket.toObject ? newTicket.toObject() : newTicket;
    ticketObj.id = ticketObj._id;
    ticketObj.clientId = ticketObj.client_id;
    ticketObj.projectId = ticketObj.project_id;

    // Real-time broadcast and notify admins if available
    try {
      if (req.io) {
        req.io.emit('ticket_created', ticketObj);
      }
      const admins = await User.find({ role: { $in: ['Admin', 'Managing Director MD'] }, isActive: true }).select('_id');
      await Promise.all(
        admins.map(async (admin) => {
          const notif = await Notification.create({
            recipient: admin._id,
            sender: req.user ? req.user.id : admin._id,
            title: `New Support Ticket: ${code}`,
            message: `${author_name || 'Client'} raised a ticket: "${title}"`,
            type: 'Info',
          });
          if (req.io) req.io.to(admin._id.toString()).emit('notification', notif);
        })
      );
    } catch (notifErr) {
      console.warn('Notification/Socket dispatch warning on createTicket:', notifErr.message);
    }

    res.status(201).json({ success: true, data: ticketObj });
  } catch (error) {
    next(error);
  }
};

exports.addTicketMessage = async (req, res, next) => {
  try {
    const { message, author_name, author_email, sender_type, internal, clientMessageId } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, message: 'Message content is required' });
    }

    let ticket = null;
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      ticket = await Ticket.findById(req.params.id);
    }
    if (!ticket) {
      ticket = await Ticket.findOne({ code: req.params.id });
    }
    if (!ticket) {
      return res.status(404).json({ success: false, error: { code: 'not_found', message: 'Ticket not found' } });
    }

    const sender = sender_type === 'STAFF' ? 'STAFF' : 'CLIENT';
    const author = author_name || (sender === 'STAFF' ? (req.user?.name || 'Support Staff') : 'Client');
    const email = author_email || (req.user?.email || '');

    const newMsgDoc = {
      sender,
      author_name: author,
      author_email: email,
      message,
      internal: !!internal,
      created_at: new Date()
    };

    ticket.messages.push(newMsgDoc);
    ticket.updated_at = new Date();

    // Auto-update ticket status when client replies
    if (sender === 'CLIENT') {
      if (['RESOLVED', 'CLOSED'].includes(ticket.status)) {
        ticket.status = 'OPEN';
      }
    } else if (sender === 'STAFF' && !internal) {
      if (ticket.status === 'OPEN') {
        ticket.status = 'IN_PROGRESS';
      }
    }
    await ticket.save();

    const ticketObj = ticket.toObject ? ticket.toObject() : ticket;
    ticketObj.id = ticketObj._id;
    ticketObj.clientId = ticketObj.client_id;
    ticketObj.projectId = ticketObj.project_id;
    ticketObj.source = ticketObj.source || (ticketObj.creator?.email?.includes('madhuratech.com') || ticketObj.creator?.name === 'Administrator' ? 'CRM' : 'PORTAL');

    const createdMsg = ticketObj.messages[ticketObj.messages.length - 1];

    if (req.io) {
      const messagePayload = {
        ticketId: ticketObj.id.toString(),
        ticketCode: ticketObj.code,
        clientMessageId: clientMessageId || null,
        message: createdMsg,
        ticket: ticketObj,
      };

      // 1. Emit to ticket-specific rooms (by ID and by code)
      req.io.to(`ticket_${ticketObj.id}`).emit('new_ticket_message', messagePayload);
      if (ticketObj.code) {
        req.io.to(`ticket_${ticketObj.code}`).emit('new_ticket_message', messagePayload);
      }

      // 2. Broadcast to company ticket room and global
      req.io.to('company_madhura_tickets').emit('new_ticket_message', messagePayload);
      req.io.emit('new_ticket_message', messagePayload);
      req.io.emit('ticket_updated', ticketObj);

      // 3. If reply is from CLIENT, dispatch notification to CRM admins
      if (sender === 'CLIENT') {
        try {
          const User = mongoose.model('User');
          const Notification = mongoose.model('Notification');
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
          console.warn('Notification error on client ticket message:', notifErr.message);
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
    const updateData = {};
    if (status) updateData.status = status.toUpperCase();
    if (priority) updateData.priority = priority.toUpperCase();
    if (assignee_id) updateData.assignee_id = assignee_id;
    updateData.updated_at = new Date();

    let ticket = null;
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      ticket = await Ticket.findByIdAndUpdate(req.params.id, updateData, { new: true });
    }
    if (!ticket) {
      ticket = await Ticket.findOneAndUpdate({ code: req.params.id }, updateData, { new: true });
    }
    if (!ticket) {
      return res.status(404).json({ success: false, error: { code: 'not_found', message: 'Ticket not found' } });
    }

    const ticketObj = ticket.toObject ? ticket.toObject() : ticket;
    ticketObj.id = ticketObj._id;
    ticketObj.clientId = ticketObj.client_id;
    ticketObj.projectId = ticketObj.project_id;
    ticketObj.source = ticketObj.source || (ticketObj.creator?.email?.includes('madhuratech.com') || ticketObj.creator?.name === 'Administrator' ? 'CRM' : 'PORTAL');

    if (req.io) {
      req.io.to(`ticket_${ticketObj.id}`).emit('ticket_updated', ticketObj);
      if (ticketObj.code) {
        req.io.to(`ticket_${ticketObj.code}`).emit('ticket_updated', ticketObj);
      }
      req.io.to('company_madhura_tickets').emit('ticket_updated', ticketObj);
      req.io.emit('ticket_updated', ticketObj);
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
