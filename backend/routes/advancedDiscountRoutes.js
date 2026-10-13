// backend/routes/advancedDiscountRoutes.js
const express = require('express');
const router = express.Router();
const { authenticated } = require('../middleware/roles');
const advancedDiscountController = require('../controllers/advancedDiscountController');

// Endpoint para aplicar descontos avançados em um pedido
router.post('/apply-discount', authenticated, advancedDiscountController.applyAdvancedDiscount);

module.exports = router;
