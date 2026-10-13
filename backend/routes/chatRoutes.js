// backend/routes/chatRoutes.js
const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { authenticated } = require('../middleware/roles');

router.get('/messages', authenticated, chatController.getMessages);
router.post('/messages', authenticated, chatController.sendMessage);

module.exports = router;
