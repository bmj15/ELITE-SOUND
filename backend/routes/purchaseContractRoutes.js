// backend/routes/purchaseContractRoutes.js
const express = require('express');
const router = express.Router();
const purchaseContractController = require('../controllers/purchaseContractController');
const { staff } = require('../middleware/roles');

// Rota para gerar contrato para um pedido de compra (apenas para colaboradores)
router.post('/generate', staff, purchaseContractController.generateContractForPurchase);

module.exports = router;
