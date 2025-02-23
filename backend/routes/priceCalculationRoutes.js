// backend/routes/priceCalculationRoutes.js
const express = require('express');
const router = express.Router();
const priceCalculationController = require('../controllers/priceCalculationController');

// Endpoint para calcular o preço final do pedido com desconto e cashback
router.post('/calculate-price', priceCalculationController.calculatePrice);

// Endpoint para registrar uma transação de cashback
router.post('/cashback', priceCalculationController.registerCashback);

module.exports = router;
