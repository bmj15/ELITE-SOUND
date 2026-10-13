// backend/routes/documentProcessingRoutes.js
const express = require('express');
const router = express.Router();
const documentProcessingController = require('../controllers/documentProcessingController');
const { authenticated, staff } = require('../middleware/roles');

// Equipa: carregar documentos (faturas, recibos, ...)
router.post('/upload', staff, documentProcessingController.uploadDocument, documentProcessingController.processDocument);

// Cliente: os seus documentos; equipa: todos
router.get('/my-documents', authenticated, documentProcessingController.getMyDocuments);
router.get('/:id/file', authenticated, documentProcessingController.downloadDocument);

module.exports = router;
