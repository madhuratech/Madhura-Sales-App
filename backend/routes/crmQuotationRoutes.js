const express = require('express');
const router = express.Router();
const { 
  getQuotations, 
  getQuotationById, 
  createQuotation, 
  updateQuotation, 
  deleteQuotation, 
  sendEmail,
  getQuotationRevisions,
  getQuotationRevisionById,
  deleteQuotationRevision
} = require('../controllers/crmQuotationController');
const { 
  getFromAddresses, 
  createFromAddress, 
  deleteFromAddress 
} = require('../controllers/fromAddressController');
const { protect } = require('../middleware/authMiddleware');

// From Address endpoints nested under crm-quotations (as expected by shared frontend components)
router.route('/from-addresses').get(protect, getFromAddresses).post(protect, createFromAddress);
router.route('/from-addresses/:id').delete(protect, deleteFromAddress);

// Quotation endpoints
router.route('/').get(protect, getQuotations);
router.route('/create').post(protect, createQuotation);
router.route('/:id').get(protect, getQuotationById).put(protect, updateQuotation).delete(protect, deleteQuotation);
router.route('/send-email/:id').post(protect, sendEmail);

// Revision history endpoints
router.route('/:id/revisions').get(protect, getQuotationRevisions);
router.route('/:id/revisions/:revisionId').get(protect, getQuotationRevisionById).delete(protect, deleteQuotationRevision);

module.exports = router;
