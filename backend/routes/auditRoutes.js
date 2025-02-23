// backend/routes/auditRoutes.js
const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');

// Rota para obter os logs de auditoria
router.get('/', auditController.getAuditLogs);

module.exports = router;
