// backend/routes/auditRoutes.js
const express = require('express');
const router = express.Router();
const { admin } = require('../middleware/roles');
const auditController = require('../controllers/auditController');

// Rota para obter os logs de auditoria
router.get('/', admin, auditController.getAuditLogs);

module.exports = router;
