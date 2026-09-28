const express = require('express');
const router = express.Router();
const v1AuthMiddleware = require('../../middleware/v1AuthMiddleware');
const {
  getHealth,
  getBundle,
  getClients,
  getClientById,
  createClient,
  updateClient,
  requestClientChange,
  getProjects,
  getProjectById,
  createProject,
  getInvoices,
  getInvoiceById,
  getInvoicePdf,
  getProformaInvoices,
  createPaymentIntent,
  getTickets,
  getTicketById,
  createTicket,
  addTicketMessage,
  updateTicketStatus,
  getApprovals,
  createApproval,
  decideApproval,
  handlePortalWebhook
} = require('../../controllers/v1/universalShareController');

// 1. Health Check (Public)
router.get('/health', getHealth);

// 2. Webhook Receiver (Signed payload)
router.post('/webhooks/portal', handlePortalWebhook);

// Protect all subsequent endpoints with API Key / JWT
router.use(v1AuthMiddleware);

// 3. Universal All-In-One Bundle
router.get('/share/bundle', getBundle);

// 4. Clients Two-Way Endpoints
router.route('/clients')
  .get(getClients)
  .post(createClient);

router.route('/clients/:id')
  .get(getClientById)
  .put(updateClient);

router.post('/clients/:id/change-requests', requestClientChange);

// 5. Projects Endpoints
router.route('/projects')
  .get(getProjects)
  .post(createProject);

router.get('/projects/:id', getProjectById);

// 6. Invoices & Billing Endpoints
router.get('/invoices', getInvoices);
router.get('/invoices/:id', getInvoiceById);
router.get('/invoices/:id/pdf', getInvoicePdf);
router.post('/invoices/:id/payment-intent', createPaymentIntent);
router.get('/proforma-invoices', getProformaInvoices);

// 7. Questions / Support Tickets Endpoints
router.route('/tickets')
  .get(getTickets)
  .post(createTicket);

router.route('/tickets/:id')
  .get(getTicketById)
  .patch(updateTicketStatus);

router.post('/tickets/:id/messages', addTicketMessage);

// 8. Approvals Endpoints
router.route('/approvals')
  .get(getApprovals)
  .post(createApproval);

router.post('/approvals/:id/decide', decideApproval);

module.exports = router;
