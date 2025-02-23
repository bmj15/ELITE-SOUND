// backend/routes/documentProcessingRoutes.js
const express = require('express');
const router = express.Router();
const documentProcessingController = require('../controllers/documentProcessingController');

// Rota para upload e processamento do documento
router.post('/upload', documentProcessingController.uploadDocument, documentProcessingController.processDocument);

module.exports = router;
