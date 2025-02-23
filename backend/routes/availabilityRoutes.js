// backend/routes/availabilityRoutes.js
const express = require('express');
const router = express.Router();
const availabilityController = require('../controllers/availabilityController');

router.post('/notify', availabilityController.createNotificationRequest);

module.exports = router;
