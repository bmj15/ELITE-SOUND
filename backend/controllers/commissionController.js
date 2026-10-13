// backend/controllers/commissionController.js
const ExcelJS = require('exceljs');
const { Op } = require('sequelize');
const { sequelize, Commission, CommissionRule, CommissionTier, Order, OrderParticipant, User } = require('../models');
const commissionService = require('../services/commissionService');
const profitShareService = require('../services/profitShareService');

const RULE_FIELDS = [
  'name', 'active', 'priority', 'valid_from', 'valid_to', 'recipient_mode', 'split_mode',
  'role_weights', 'base_type', 'calc_type', 'value', 'use_tiers', 'order_type', 'min_order_value'
];

const pick = (body, fields) => fields.reduce((acc, f) => (body[f] !== undefined ? { ...acc, [f]: body[f] } : acc), {});

const cashToPay = (c) => Math.round((parseFloat(c.amount) - parseFloat(c.converted_amount || 0)) * 100) / 100;

function handleError(res, error) {
  const status = error instanceof commissionService.CommissionError ? 400 : 500;
  res.status(status).json({ error: error.message });
}

function buildFilters(query) {
  const where = {};
  if (query.user_id) where.user_id = query.user_id;
  if (query.period) where.period = query.period;
  if (query.status) where.status = query.status;
  if (query.type) where.type = query.type;
  return where;
}

async function findCommissions(where) {
  return Commission.findAll({
    where,
    include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }],
    order: [['period', 'DESC'], ['id', 'DESC']]
  });
}

function totalsByUser(commissions) {
  const totals = {};
  commissions.forEach(c => {
    const key = c.user_id;
    totals[key] = totals[key] || { user_id: key, name: c.user ? c.user.name : null, pendente: 0, a_pagar: 0, paga: 0, anulada: 0 };
    totals[key][c.status] = Math.round((totals[key][c.status] + parseFloat(c.amount)) * 100) / 100;
  });
  return Object.values(totals);
}

// ---------- Regras ----------

exports.getRules = async (req, res) => {
  try {
    const rules = await CommissionRule.findAll({
      include: [{ model: CommissionTier, as: 'tiers' }],
      order: [['priority', 'DESC'], ['id', 'ASC']]
    });
    res.json(rules);
  } catch (error) {
    handleError(res, error);
  }
};

async function saveTiers(ruleId, tiers, transaction) {
  await CommissionTier.destroy({ where: { rule_id: ruleId }, transaction });
  for (const t of tiers) {
    await CommissionTier.create({
      rule_id: ruleId,
      min_monthly_volume: t.min_monthly_volume,
      percent: t.percent,
      bonus_amount: t.bonus_amount || 0
    }, { transaction });
  }
}

exports.createRule = async (req, res) => {
  try {
    if (!req.body.name) return res.status(400).json({ error: 'O nome da regra é obrigatório.' });
    const rule = await sequelize.transaction(async (transaction) => {
      const created = await CommissionRule.create(pick(req.body, RULE_FIELDS), { transaction });
      if (Array.isArray(req.body.tiers)) await saveTiers(created.id, req.body.tiers, transaction);
      return created;
    });
    res.status(201).json(await CommissionRule.findByPk(rule.id, { include: [{ model: CommissionTier, as: 'tiers' }] }));
  } catch (error) {
    handleError(res, error);
  }
};

exports.updateRule = async (req, res) => {
  try {
    const rule = await CommissionRule.findByPk(req.params.id);
    if (!rule) return res.status(404).json({ error: 'Regra não encontrada.' });
    await sequelize.transaction(async (transaction) => {
      await rule.update(pick(req.body, RULE_FIELDS), { transaction });
      if (Array.isArray(req.body.tiers)) await saveTiers(rule.id, req.body.tiers, transaction);
    });
    res.json(await CommissionRule.findByPk(rule.id, { include: [{ model: CommissionTier, as: 'tiers' }] }));
  } catch (error) {
    handleError(res, error);
  }
};

// As regras são desativadas (não apagadas) para manter o histórico das comissões
exports.deleteRule = async (req, res) => {
  try {
    const rule = await CommissionRule.findByPk(req.params.id);
    if (!rule) return res.status(404).json({ error: 'Regra não encontrada.' });
    await rule.update({ active: false });
    res.json({ message: 'Regra desativada com sucesso.' });
  } catch (error) {
    handleError(res, error);
  }
};

// ---------- Equipa do pedido ----------

exports.getParticipants = async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado.' });
    const participants = await OrderParticipant.findAll({
      where: { order_id: order.id },
      include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }]
    });
    res.json({ seller_id: order.seller_id, participants });
  } catch (error) {
    handleError(res, error);
  }
};

exports.setParticipants = async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado.' });
    const { seller_id, participants = [] } = req.body;
    if (participants.some(p => !p.user_id || !p.role)) {
      return res.status(400).json({ error: 'Cada participante precisa de user_id e role.' });
    }

    await sequelize.transaction(async (transaction) => {
      if (seller_id !== undefined) await order.update({ seller_id }, { transaction });
      await OrderParticipant.destroy({ where: { order_id: order.id }, transaction });
      for (const p of participants) {
        await OrderParticipant.create({
          order_id: order.id,
          user_id: p.user_id,
          role: p.role,
          custom_percent: p.custom_percent
        }, { transaction });
      }
    });

    // Se o pedido já tem comissões por pagar, recalcula-as com a nova equipa
    let commissions;
    const existing = await Commission.count({ where: { order_id: order.id, type: 'sale' } });
    if (existing > 0) commissions = await commissionService.generateForOrder(order.id);
    res.json({ message: 'Equipa do pedido atualizada.', commissions });
  } catch (error) {
    handleError(res, error);
  }
};

exports.recalculateOrder = async (req, res) => {
  try {
    const commissions = await commissionService.generateForOrder(req.params.id);
    res.json({ message: 'Comissões recalculadas.', commissions });
  } catch (error) {
    handleError(res, error);
  }
};

// ---------- Comissões ----------

exports.getCommissions = async (req, res) => {
  try {
    const commissions = await findCommissions(buildFilters(req.query));
    res.json({ commissions, totals: totalsByUser(commissions) });
  } catch (error) {
    handleError(res, error);
  }
};

exports.payCommissions = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Indique as comissões a marcar como pagas.' });
    }
    const paid = await commissionService.markPaid(ids);
    res.json({ message: `${paid.length} comissão(ões) marcada(s) como paga(s).`, paid: paid.map(c => c.id) });
  } catch (error) {
    handleError(res, error);
  }
};

exports.exportCommissions = async (req, res) => {
  try {
    const commissions = await findCommissions(buildFilters(req.query));
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Comissões');
    worksheet.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Período', key: 'period', width: 10 },
      { header: 'Colaborador', key: 'user', width: 25 },
      { header: 'Pedido', key: 'order_id', width: 10 },
      { header: 'Tipo', key: 'type', width: 12 },
      { header: 'Base (€)', key: 'base_amount', width: 12 },
      { header: 'Parte (%)', key: 'share_percent', width: 10 },
      { header: 'Comissão (%)', key: 'percent_applied', width: 12 },
      { header: 'Valor (€)', key: 'amount', width: 12 },
      { header: 'Convertido em participação (€)', key: 'converted_amount', width: 16 },
      { header: 'A pagar em dinheiro (€)', key: 'cash', width: 14 },
      { header: 'Estado', key: 'status', width: 10 },
      { header: 'Pago em', key: 'paid_at', width: 20 }
    ];
    commissions.forEach(c => {
      worksheet.addRow({
        id: c.id,
        period: c.period,
        user: c.user ? c.user.name : c.user_id,
        order_id: c.order_id,
        type: c.type === 'tier_bonus' ? 'Bónus meta' : 'Venda',
        base_amount: parseFloat(c.base_amount),
        share_percent: parseFloat(c.share_percent),
        percent_applied: c.percent_applied == null ? '' : parseFloat(c.percent_applied),
        amount: parseFloat(c.amount),
        converted_amount: parseFloat(c.converted_amount || 0),
        cash: cashToPay(c),
        status: c.status,
        paid_at: c.paid_at ? new Date(c.paid_at).toLocaleString() : ''
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=comissoes.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    handleError(res, error);
  }
};

// Comissões do colaborador autenticado e progresso nas metas
exports.getMyCommissions = async (req, res) => {
  try {
    const period = req.query.period || commissionService.periodOf(new Date());
    const commissions = await Commission.findAll({
      where: { user_id: req.user.id, period, status: { [Op.ne]: 'anulada' } },
      order: [['id', 'DESC']]
    });
    const progress = await commissionService.getTierProgress(req.user.id, period);
    res.json({ period, commissions, totals: totalsByUser(commissions)[0] || null, progress });
  } catch (error) {
    handleError(res, error);
  }
};

// ---------- Participação nos lucros ----------

// Unidades, dividendos e quanto pode converter de cada comissão a pagar
exports.getMyParticipation = async (req, res) => {
  try {
    const settings = await profitShareService.getSettings();
    const holdings = await profitShareService.getHoldings(req.user.id);
    const payable = await Commission.findAll({ where: { user_id: req.user.id, status: 'a_pagar' }, order: [['id', 'DESC']] });
    const convertible = [];
    for (const c of payable) {
      convertible.push({
        commission_id: c.id,
        period: c.period,
        order_id: c.order_id,
        amount: parseFloat(c.amount),
        converted_amount: parseFloat(c.converted_amount || 0),
        max_convertible: settings.unitPrice ? await profitShareService.getConversionLimit(c, settings) : 0
      });
    }
    res.json({ settings, holdings, convertible });
  } catch (error) {
    handleError(res, error);
  }
};

exports.convertCommission = async (req, res) => {
  try {
    const result = await profitShareService.convert(req.user.id, Number(req.params.id), req.body.amount);
    res.json({ message: `Convertido em ${result.conversion.units} unidade(s) de participação.`, ...result });
  } catch (error) {
    handleError(res, error);
  }
};
