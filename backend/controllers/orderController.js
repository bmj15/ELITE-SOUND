// backend/controllers/orderController.js
const { Op } = require('sequelize');
const { Order, Equipment, Configuration, User } = require('../models');
const commissionService = require('../services/commissionService');
const paymentService = require('../services/paymentService');
const { PricingError, calculateRentalPrice } = require('../services/pricingService');
const audit = require('../services/auditService');

const STAFF = ['admin', 'collaborator'];
const isStaff = (user) => STAFF.includes(user.role);
const canAccess = (user, order) => isStaff(user) || Number(order.client_id) === Number(user.id);

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function getPaymentPercentage() {
  const config = await Configuration.findOne({ where: { config_key: 'order_payment_percentage_required' } });
  const value = config ? parseFloat(config.config_value) : NaN;
  return Number.isFinite(value) ? value : 0;
}

// Cliente autenticado faz uma reserva; o total é calculado no servidor
exports.createOrder = async (req, res) => {
  try {
    const { equipment_id, pickup_date, return_date, notes, coupon_code } = req.body;
    if (!equipment_id || !pickup_date || !return_date) {
      return res.status(400).json({ error: 'Equipamento e datas são obrigatórios.' });
    }
    const equipment = await Equipment.findByPk(equipment_id);
    if (!equipment || !equipment.active) return res.status(404).json({ error: 'Equipamento não encontrado.' });

    const price = await calculateRentalPrice(equipment, pickup_date, return_date, coupon_code);
    const order = await Order.create({
      client_id: req.user.id,
      equipment_id: equipment.id,
      order_type: 'aluguer',
      status: 'SUBMETIDO',
      pickup_date,
      return_date,
      notes,
      total_value: price.finalPrice,
      discount_applied: price.discountValue,
      cost_total: price.cost,
      payment_percentage_required: await getPaymentPercentage()
    });
    res.status(201).json({ message: 'Reserva criada com sucesso.', order, price });
  } catch (error) {
    if (error instanceof PricingError) return res.status(400).json({ error: error.message });
    res.status(500).json({ error: error.message });
  }
};

exports.getMyOrders = async (req, res) => {
  try {
    const orders = await Order.findAll({
      where: { client_id: req.user.id },
      include: [{ model: Equipment, as: 'equipment', attributes: ['id', 'name'] }],
      order: [['created_at', 'DESC']]
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Equipa: pedidos com contrato assinado que ainda não estão totalmente pagos
exports.getPendingOrders = async (req, res) => {
  try {
    const orders = await Order.findAll({
      where: { status: { [Op.in]: ['PAGAMENTO_PENDENTE', 'CONFIRMADO'] }, contract_signed: true },
      include: [{ model: User, as: 'client', attributes: ['id', 'name', 'email'] }],
      order: [['created_at', 'ASC']]
    });
    res.json(orders
      .filter(o => parseFloat(o.amount_paid || 0) < parseFloat(o.total_value || 0))
      .map(o => ({ ...o.toJSON(), client_name: o.client ? o.client.name : null })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Equipa: regista um pagamento recebido (numerário, transferência, ...)
exports.confirmPayment = async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });
    if (order.status === 'CANCELADO') return res.status(400).json({ error: 'O pedido está cancelado.' });

    await paymentService.registerPayment(order, req.body.amount_paid);
    await audit.log(req, 'Pagamento registado', 'payment', { order_id: order.id, valor: req.body.amount_paid });
    res.json({ message: 'Pagamento registado com sucesso.', order });
  } catch (error) {
    const status = error instanceof commissionService.CommissionError ? 400 : 500;
    res.status(status).json({ error: error.message });
  }
};

exports.getContract = async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id, {
      include: [
        { model: User, as: 'client', attributes: ['id', 'name', 'email'] },
        { model: Equipment, as: 'equipment', attributes: ['id', 'name'] }
      ]
    });
    if (!order || !canAccess(req.user, order)) return res.status(404).json({ error: 'Pedido não encontrado' });

    const date = (d) => (d ? new Date(d).toLocaleString('pt-PT') : '—');
    const contractText = `
      <h3>Contrato de Aluguer n.º ${order.id}</h3>
      <p>Este contrato rege o aluguer de equipamentos entre a Elite Sound e o cliente abaixo identificado.</p>
      <p>Cliente: ${escapeHtml(order.client ? order.client.name : order.client_id)}</p>
      <p>Equipamento: ${escapeHtml(order.equipment ? order.equipment.name : '—')}</p>
      <p>Data de Levantamento: ${date(order.pickup_date)}</p>
      <p>Data de Devolução: ${date(order.return_date)}</p>
      <p>Valor Total: €${parseFloat(order.total_value || 0).toFixed(2)}
        (pagamento antecipado exigido: ${parseFloat(order.payment_percentage_required || 0)}%)</p>
      <p>O cliente compromete-se a devolver o equipamento nas mesmas condições em que o recebeu.</p>
    `;
    res.json({ contractText });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.signContract = async (req, res) => {
  try {
    const { signed } = req.body;
    const order = await Order.findByPk(req.params.id);
    if (!order || !canAccess(req.user, order)) return res.status(404).json({ error: 'Pedido não encontrado' });
    if (order.contract_signed) return res.status(400).json({ error: 'O contrato já foi assinado.' });
    if (order.status === 'CANCELADO') return res.status(400).json({ error: 'O pedido está cancelado.' });

    if (signed) {
      // Se a percentagem exigida for 0, o pedido passa a CONFIRMADO, senão para PAGAMENTO_PENDENTE.
      order.status = (parseFloat(order.payment_percentage_required || 0) === 0) ? 'CONFIRMADO' : 'PAGAMENTO_PENDENTE';
      order.contract_signed = true;
      await order.save();
    }

    // Pedido confirmado: gera as comissões (pendentes até o pedido estar pago).
    // Um erro nas comissões não impede a assinatura; é devolvido como aviso.
    let commissionWarning;
    if (signed) {
      try {
        await commissionService.generateForOrder(order.id);
      } catch (error) {
        commissionWarning = `Comissões não geradas: ${error.message}`;
      }
    }

    res.json({ message: 'Contrato assinado com sucesso', order, commissionWarning });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Cancela o pedido e anula as comissões ainda não pagas
exports.cancelOrder = async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });

    order.status = 'CANCELADO';
    await order.save();
    const cancelled = await commissionService.cancelForOrder(order.id);
    await audit.log(req, 'Pedido cancelado', 'update', { order_id: order.id });

    res.json({ message: 'Pedido cancelado com sucesso', order, cancelledCommissions: cancelled.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
