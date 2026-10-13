// backend/routes/priceCalculationRoutes.js
const express = require('express');
const router = express.Router();
const priceCalculationController = require('../controllers/priceCalculationController');
const { staff } = require('../middleware/roles');

// Simulação de preço (pública)
router.post('/calculate-price', priceCalculationController.calculatePrice);

// Registo de cashback (equipa)
router.post('/cashback', staff, priceCalculationController.registerCashback);

module.exports = router;
