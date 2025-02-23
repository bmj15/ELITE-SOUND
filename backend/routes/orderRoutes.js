const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

// Rota para obter os termos do contrato
router.get('/:id/contract', orderController.getContract);

// Rota para assinar o contrato
router.post('/:id/sign', orderController.signContract);

// Outras rotas relacionadas a pedidos...
module.exports = router;
