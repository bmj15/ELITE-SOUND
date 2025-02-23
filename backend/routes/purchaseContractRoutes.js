// backend/routes/purchaseContractRoutes.js
const express = require('express');
const router = express.Router();
const purchaseContractController = require('../controllers/purchaseContractController');
const authMiddleware = require('../middleware/auth'); // Middleware de autenticação
const authorize = require('../middleware/authorize'); // Middleware de autorização

// Rota para gerar contrato para um pedido de compra (apenas para colaboradores)
router.post('/generate', authMiddleware, authorize('collaborator'), purchaseContractController.generateContractForPurchase);

module.exports = router;
