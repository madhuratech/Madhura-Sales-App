const express = require('express');
const router = express.Router();
const { recordLocation, getLocationHistory, getLatestLocations } = require('../controllers/locationController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

router.post('/', recordLocation);
router.get('/latest', authorize('Admin', 'Manager'), getLatestLocations);
router.get('/history/:userId', authorize('Admin', 'Manager'), getLocationHistory);

module.exports = router;
