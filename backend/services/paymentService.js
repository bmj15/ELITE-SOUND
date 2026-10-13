// backend/services/paymentService.js
const commissionService = require('./commissionService');

const num = (v) => parseFloat(v) || 0;
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// Regista um pagamento no pedido: confirma-o ao atingir a % exigida e,
// com o pedido 100% pago, as comissões passam a "a pagar".
async function registerPayment(order, amount) {
  const value = num(amount);
  if (value <= 0) throw new commissionService.CommissionError('O valor pago tem de ser positivo.');

  order.amount_paid = round2(num(order.amount_paid) + value);
  const required = num(order.total_value) * num(order.payment_percentage_required) / 100;
  if (order.status === 'PAGAMENTO_PENDENTE' && num(order.amount_paid) >= required) {
    order.status = 'CONFIRMADO';
  }
  await order.save();

  if (commissionService.isFullyPaid(order)) {
    await commissionService.markPayable(order.id);
  }
  return order;
}

module.exports = { registerPayment };
