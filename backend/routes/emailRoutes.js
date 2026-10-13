// backend/routes/emailRoutes.js
const express = require('express');
const router = express.Router();
const { admin } = require('../middleware/roles');
const emailController = require('../controllers/emailController');

router.post('/send', admin, emailController.sendEmailNotification);

module.exports = router;
