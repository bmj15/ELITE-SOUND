// backend/controllers/cashbackController.js
const { Cashback, Order, CashbackTransaction } = require('../models');

exports.applyCashback = async (req, res) => {
  try {
    // Dados esperados: orderId, userId, amountToApply
    const { orderId, userId, amountToApply } = req.body;
    if (!orderId || !userId || !amountToApply) {
      return res.status(400).json({ error: 'Campos obrigatórios não informados.' });
    }

    // Buscar o pedido
    const order = await Order.findByPk(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Pedido não encontrado.' });
    }

    // Buscar o registro de cashback do usuário
    let cashback = await Cashback.findOne({ where: { user_id: userId } });
    if (!cashback) {
      return res.status(404).json({ error: 'Saldo de cashback não encontrado.' });
    }

    // Validar se o usuário possui saldo suficiente
    if (parseFloat(cashback.balance) < parseFloat(amountToApply)) {
      return res.status(400).json({ error: 'Saldo de cashback insuficiente.' });
    }

    // Atualizar o total do pedido subtraindo o valor de cashback
    order.total_value = parseFloat(order.total_value) - parseFloat(amountToApply);
    if (order.total_value < 0) order.total_value = 0;
    await order.save();

    // Registrar a transação de cashback (tipo 'redeem')
    const transaction = await CashbackTransaction.create({
      user_id: userId,
      transaction_type: 'redeem',
      amount: amountToApply,
      description: `Aplicação de cashback no pedido ${orderId}`
    });

    // Atualizar o saldo de cashback do usuário
    cashback.balance = parseFloat(cashback.balance) - parseFloat(amountToApply);
    await cashback.save();

    res.json({
      message: 'Cashback aplicado com sucesso!',
      newOrderTotal: order.total_value,
      newCashbackBalance: cashback.balance,
      transaction
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
