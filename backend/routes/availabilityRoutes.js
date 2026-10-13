// backend/routes/availabilityRoutes.js
const express = require('express');
const router = express.Router();
const { authenticated } = require('../middleware/roles');
const availabilityController = require('../controllers/availabilityController');

router.post('/notify', authenticated, availabilityController.createNotificationRequest);

module.exports = router;
