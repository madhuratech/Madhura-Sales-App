const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const {
  getTickets,
  getTicketById,
  createTicket,
  addTicketMessage,
  getTicketMessages,
  updateTicketStatus,
  deleteTicket,
  addTicketAttachment
} = require('../controllers/v1/universalShareController');

router.use(protect);

router.route('/')
  .get(getTickets)
  .post(createTicket);

router.route('/:id')
  .get(getTicketById)
  .patch(updateTicketStatus)
  .delete(deleteTicket);

router.route('/:id/messages')
  .get(getTicketMessages)
  .post(addTicketMessage);

router.post('/:id/attachments', upload.single('file'), addTicketAttachment);

module.exports = router;

