// backend/routes/reportRoutes.js
const express = require('express');
const router = express.Router();
const { admin } = require('../middleware/roles');
const reportController = require('../controllers/reportController');

// Rota para exportar o relatório mensal
router.get('/monthly', admin, reportController.exportMonthlyReport);

module.exports = router;
