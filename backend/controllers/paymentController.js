// backend/controllers/paymentController.js
const { Order } = require('../models');
const paymentService = require('../services/paymentService');

const STAFF = ['admin', 'collaborator'];

exports.processPayment = async (req, res) => {
  try {
    // Dados esperados: orderId, amount, cardNumber, expiryDate, cvv
    const { orderId, amount, cardNumber } = req.body;

    // Simulação: em produção, integrar com um gateway (Stripe, SIBS/MB Way, ...).
    // A transação é aprovada se o número do cartão tiver 16 dígitos.
    if (!cardNumber || cardNumber.replace(/\s/g, '').length !== 16) {
      return res.status(400).json({ error: 'Número do cartão inválido.' });
    }

    const order = await Order.findByPk(orderId);
    if (!order || (!STAFF.includes(req.user.role) && Number(order.client_id) !== Number(req.user.id))) {
      return res.status(404).json({ error: 'Pedido não encontrado.' });
    }
    if (order.status === 'CANCELADO') return res.status(400).json({ error: 'O pedido está cancelado.' });

    await paymentService.registerPayment(order, amount);
    res.json({ message: 'Pagamento processado com sucesso para o pedido ' + orderId, order });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
