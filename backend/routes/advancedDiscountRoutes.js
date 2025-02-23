// backend/routes/advancedDiscountRoutes.js
const express = require('express');
const router = express.Router();
const advancedDiscountController = require('../controllers/advancedDiscountController');

// Endpoint para aplicar descontos avançados em um pedido
router.post('/apply-discount', advancedDiscountController.applyAdvancedDiscount);

module.exports = router;
