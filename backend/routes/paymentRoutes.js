// backend/routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticated } = require('../middleware/roles');

router.post('/process', authenticated, paymentController.processPayment);

module.exports = router;
