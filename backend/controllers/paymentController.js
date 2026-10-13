// backend/controllers/paymentController.js
const { Order } = require('../models');
const commissionService = require('../services/commissionService');

exports.processPayment = async (req, res) => {
  try {
    // Dados esperados: orderId, amount, cardNumber, expiryDate, cvv
    const { orderId, amount, cardNumber, expiryDate, cvv } = req.body;
    
    // Aqui, simule a verificação do cartão e processamento do pagamento.
    // Em um cenário real, você integraria com um gateway como Stripe, PayPal, etc.
    // Para exemplo, vamos supor que a transação seja sempre aprovada se o número do cartão tiver 16 dígitos.
    
    if (!cardNumber || cardNumber.replace(/\s/g, '').length !== 16) {
      return res.status(400).json({ error: 'Número do cartão inválido.' });
    }
    
    // Simulação de processamento: aguarde 1 segundo
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Regista o valor pago no pedido; quando fica pago a 100% as comissões passam a "a pagar"
    const order = await Order.findByPk(orderId);
    if (order) {
      order.amount_paid = parseFloat(order.amount_paid || 0) + parseFloat(amount || 0);
      await order.save();
      if (commissionService.isFullyPaid(order)) {
        await commissionService.markPayable(order.id);
      }
    }

    res.json({ message: 'Pagamento processado com sucesso para o pedido ' + orderId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
