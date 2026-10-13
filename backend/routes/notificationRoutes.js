// backend/routes/notificationRoutes.js
const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticated, admin } = require('../middleware/roles');

router.get('/my-notifications', authenticated, notificationController.getMyNotifications);

// Envio de notificações por e-mail
router.post('/send', admin, notificationController.sendAutomaticNotification);

module.exports = router;
