// backend/routes/reportRoutes.js
const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');

// Rota para exportar o relatório mensal
router.get('/monthly', reportController.exportMonthlyReport);

module.exports = router;
