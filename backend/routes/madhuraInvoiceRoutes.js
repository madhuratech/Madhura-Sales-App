const express = require('express');
const router = express.Router();
const { 
  getInvoices, 
  getNextDetails, 
  getInvoiceById, 
  createInvoice, 
  updateInvoice, 
  deleteInvoice,
  getInvoiceRevisions,
  getInvoiceRevisionById,
  deleteInvoiceRevision
} = require('../controllers/madhuraInvoiceController');
const { protect } = require('../middleware/authMiddleware');

router.route('/').get(protect, getInvoices);
router.route('/next-details').get(protect, getNextDetails);
router.route('/create').post(protect, createInvoice);
router.route('/:id').get(protect, getInvoiceById).put(protect, updateInvoice).delete(protect, deleteInvoice);

// Revision history endpoints
router.route('/:id/revisions').get(protect, getInvoiceRevisions);
router.route('/:id/revisions/:revisionId').get(protect, getInvoiceRevisionById).delete(protect, deleteInvoiceRevision);

module.exports = router;
