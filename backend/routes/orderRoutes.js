// backend/routes/orderRoutes.js
const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authenticated, staff } = require('../middleware/roles');

// Cliente: fazer uma reserva e ver os seus pedidos
router.post('/', authenticated, orderController.createOrder);
router.get('/my-orders', authenticated, orderController.getMyOrders);

// Equipa: pagamentos pendentes
router.get('/pending', staff, orderController.getPendingOrders);
router.post('/:id/confirm-payment', staff, orderController.confirmPayment);

// Rota para obter os termos do contrato
router.get('/:id/contract', authenticated, orderController.getContract);

// Rota para assinar o contrato
router.post('/:id/sign', authenticated, orderController.signContract);

// Rota para cancelar o pedido (anula as comissões ainda não pagas)
router.post('/:id/cancel', staff, orderController.cancelOrder);

module.exports = router;
