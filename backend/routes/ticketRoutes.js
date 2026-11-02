const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getTickets,
  getTicketById,
  createTicket,
  addTicketMessage,
  updateTicketStatus
} = require('../controllers/v1/universalShareController');

router.use(protect);

router.route('/')
  .get(getTickets)
  .post(createTicket);

router.route('/:id')
  .get(getTicketById)
  .patch(updateTicketStatus);

router.post('/:id/messages', addTicketMessage);

module.exports = router;

