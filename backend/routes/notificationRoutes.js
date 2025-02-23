// backend/routes/notificationRoutes.js
const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');

// Endpoint para enviar uma notificação automática
router.post('/send', notificationController.sendAutomaticNotification);

module.exports = router;
