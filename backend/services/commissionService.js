// backend/services/commissionService.js
// Cálculo e ciclo de vida das comissões:
//   confirmação do pedido -> pendente -> (pedido 100% pago) a_pagar -> (admin paga) paga
//   cancelamento do pedido -> anulada (exceto as já pagas)
const { Op } = require('sequelize');
const { Commission, CommissionRule, CommissionTier, Order, OrderParticipant } = require('../models');

const num = (v) => parseFloat(v) || 0;
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const periodOf = (date) => date.toISOString().slice(0, 7);
const PAYABLE = ['a_pagar', 'paga'];

class CommissionError extends Error {}

function isFullyPaid(order) {
  return num(order.total_value) > 0 && num(order.amount_paid) >= num(order.total_value);
}

// Regra ativa e válida na data que se aplica ao pedido; ganha a de maior prioridade.
async function resolveRule(order, date = new Date()) {
  const day = date.toISOString().slice(0, 10);
  const rules = await CommissionRule.findAll({
    where: { active: true },
    include: [{ model: CommissionTier, as: 'tiers' }],
    order: [['priority', 'DESC'], ['id', 'ASC']]
  });
  return rules.find(r =>
    (!r.valid_from || r.valid_from <= day) &&
    (!r.valid_to || r.valid_to >= day) &&
    (!r.order_type || r.order_type === order.order_type) &&
    (r.min_order_value == null || num(order.total_value) >= num(r.min_order_value))
  ) || null;
}

function computeBase(order, rule) {
  const total = num(order.total_value);
  const vatRate = order.vat_rate == null ? 23 : num(order.vat_rate);
  const net = total / (1 + vatRate / 100);
  switch (rule.base_type) {
    case 'order_net': return round2(net);
    case 'profit': return round2(Math.max(0, net - num(order.cost_total)));
    default: return round2(total);
  }
}

// Devolve [{ user_id, share }] com share em % (soma 100).
function resolveRecipients(order, rule, participants = []) {
  const seller = () => {
    const userId = order.seller_id || (participants.find(p => p.role === 'vendedor') || {}).user_id;
    if (!userId) throw new CommissionError('O pedido não tem vendedor definido.');
    return [{ user_id: userId, share: 100 }];
  };

  if (rule.recipient_mode !== 'all_participants' || participants.length === 0) return seller();

  let entries;
  if (rule.split_mode === 'by_role_weight') {
    const weights = rule.role_weights || {};
    const total = participants.reduce((sum, p) => sum + num(weights[p.role]), 0);
    if (total <= 0) throw new CommissionError('Nenhum participante tem peso definido na regra.');
    entries = participants.map(p => ({ user_id: p.user_id, share: num(weights[p.role]) / total * 100 }));
  } else if (rule.split_mode === 'custom_percent') {
    const total = participants.reduce((sum, p) => sum + num(p.custom_percent), 0);
    if (Math.abs(total - 100) > 0.01) {
      throw new CommissionError(`As percentagens dos participantes somam ${round2(total)}% (devem somar 100%).`);
    }
    entries = participants.map(p => ({ user_id: p.user_id, share: num(p.custom_percent) }));
  } else {
    entries = participants.map(p => ({ user_id: p.user_id, share: 100 / participants.length }));
  }

  // O mesmo colaborador pode ter vários papéis no pedido
  const merged = new Map();
  entries.filter(e => e.share > 0).forEach(e => merged.set(e.user_id, (merged.get(e.user_id) || 0) + e.share));
  return [...merged].map(([user_id, share]) => ({ user_id, share }));
}

// Divide um valor pelas partes, arredondado ao cêntimo, com o resto na última parte.
function splitAmount(total, recipients) {
  let allocated = 0;
  return recipients.map((r, i) => {
    const value = i === recipients.length - 1 ? round2(total - allocated) : round2(total * r.share / 100);
    allocated += value;
    return value;
  });
}

const usesTiers = (rule) => rule && rule.use_tiers && rule.calc_type === 'percent';

// Recalcula a % das comissões do mês consoante o escalão atingido e gere os bónus.
async function recalcTiersForPeriod(userId, period, ruleId) {
  const rule = await CommissionRule.findByPk(ruleId, { include: [{ model: CommissionTier, as: 'tiers' }] });
  if (!usesTiers(rule)) return;

  const tiers = [...rule.tiers].sort((a, b) => num(a.min_monthly_volume) - num(b.min_monthly_volume));
  const sales = await Commission.findAll({
    where: { user_id: userId, period, rule_id: ruleId, type: 'sale', status: { [Op.ne]: 'anulada' } }
  });
  const volume = sales.reduce((sum, c) => sum + num(c.base_amount), 0);
  const payableVolume = sales.filter(c => PAYABLE.includes(c.status)).reduce((sum, c) => sum + num(c.base_amount), 0);
  const reached = tiers.filter(t => num(t.min_monthly_volume) <= volume);
  const current = reached[reached.length - 1];
  const percent = current ? num(current.percent) : 0;

  // As comissões já pagas mantêm a percentagem com que foram pagas
  // A parte já convertida em participação não pode desaparecer
  for (const sale of sales.filter(c => c.status !== 'paga')) {
    const amount = Math.max(round2(num(sale.base_amount) * percent / 100), num(sale.converted_amount));
    await sale.update({ percent_applied: percent, amount });
  }

  const bonuses = await Commission.findAll({ where: { user_id: userId, period, rule_id: ruleId, type: 'tier_bonus' } });
  for (const tier of tiers.filter(t => num(t.bonus_amount) > 0)) {
    const bonus = bonuses.find(b => b.tier_id === tier.id);
    if (bonus && bonus.status === 'paga') continue;
    const isReached = num(tier.min_monthly_volume) <= volume;
    // O bónus só fica a pagar quando as vendas já pagas pelos clientes atingem a meta
    const status = !isReached ? 'anulada'
      : (num(tier.min_monthly_volume) <= payableVolume ? 'a_pagar' : 'pendente');
    if (bonus) {
      if (bonus.status !== status) await bonus.update({ status });
    } else if (isReached) {
      await Commission.create({
        user_id: userId,
        rule_id: ruleId,
        tier_id: tier.id,
        type: 'tier_bonus',
        amount: num(tier.bonus_amount),
        base_amount: round2(volume),
        status,
        period,
        notes: `Bónus por atingir ${num(tier.min_monthly_volume)}€ em ${period}`
      });
    }
  }
}

async function recalcAffected(commissions) {
  const keys = new Set(commissions.filter(c => c.rule_id).map(c => `${c.user_id}|${c.period}|${c.rule_id}`));
  for (const key of keys) {
    const [userId, period, ruleId] = key.split('|');
    await recalcTiersForPeriod(Number(userId), period, Number(ruleId));
  }
}

// Gera (ou regenera) as comissões de venda de um pedido. Idempotente.
async function generateForOrder(orderId, { date = new Date() } = {}) {
  const order = await Order.findByPk(orderId);
  if (!order) throw new CommissionError('Pedido não encontrado.');

  const existing = await Commission.findAll({ where: { order_id: orderId, type: 'sale' } });
  if (existing.some(c => PAYABLE.includes(c.status))) {
    throw new CommissionError('O pedido já tem comissões a pagar ou pagas; não é possível recalcular.');
  }
  const period = existing.length ? existing[0].period : periodOf(date);
  await Commission.destroy({ where: { order_id: orderId, type: 'sale' } });

  const rule = await resolveRule(order, date);
  if (!rule) {
    await recalcAffected(existing);
    return [];
  }

  const participants = await OrderParticipant.findAll({ where: { order_id: orderId }, order: [['id', 'ASC']] });
  const recipients = resolveRecipients(order, rule, participants);
  const base = computeBase(order, rule);
  const baseParts = splitAmount(base, recipients);
  const tiered = usesTiers(rule);
  const totalAmount = rule.calc_type === 'fixed_per_sale' ? num(rule.value) : base * num(rule.value) / 100;
  const amounts = tiered ? recipients.map(() => 0) : splitAmount(totalAmount, recipients);
  const status = isFullyPaid(order) ? 'a_pagar' : 'pendente';

  const created = [];
  for (let i = 0; i < recipients.length; i++) {
    created.push(await Commission.create({
      order_id: orderId,
      user_id: recipients[i].user_id,
      rule_id: rule.id,
      type: 'sale',
      base_amount: baseParts[i],
      share_percent: round2(recipients[i].share),
      percent_applied: rule.calc_type === 'percent' && !tiered ? num(rule.value) : null,
      amount: amounts[i],
      status,
      period
    }));
  }

  await recalcAffected([...existing, ...created]);
  return Commission.findAll({ where: { order_id: orderId, type: 'sale' }, order: [['id', 'ASC']] });
}

// Pedido totalmente pago pelo cliente: as comissões passam a ser devidas.
async function markPayable(orderId) {
  const commissions = await Commission.findAll({ where: { order_id: orderId, type: 'sale', status: 'pendente' } });
  for (const c of commissions) await c.update({ status: 'a_pagar' });
  await recalcAffected(commissions);
  return commissions;
}

// Pedido cancelado: anula as comissões que ainda não foram pagas nem convertidas em participação.
async function cancelForOrder(orderId) {
  const commissions = (await Commission.findAll({
    where: { order_id: orderId, type: 'sale', status: { [Op.in]: ['pendente', 'a_pagar'] } }
  })).filter(c => num(c.converted_amount) === 0);
  for (const c of commissions) await c.update({ status: 'anulada' });
  await recalcAffected(commissions);
  return commissions;
}

// O admin marca comissões como pagas ao colaborador.
async function markPaid(ids) {
  const commissions = await Commission.findAll({ where: { id: { [Op.in]: ids }, status: 'a_pagar' } });
  const paidAt = new Date();
  for (const c of commissions) await c.update({ status: 'paga', paid_at: paidAt });
  return commissions;
}

// Progresso do colaborador nos escalões das regras com metas, no período indicado.
async function getTierProgress(userId, period) {
  const sales = await Commission.findAll({
    where: { user_id: userId, period, type: 'sale', status: { [Op.ne]: 'anulada' } }
  });
  const ruleIds = [...new Set(sales.map(c => c.rule_id).filter(Boolean))];
  const progress = [];
  for (const ruleId of ruleIds) {
    const rule = await CommissionRule.findByPk(ruleId, { include: [{ model: CommissionTier, as: 'tiers' }] });
    if (!usesTiers(rule)) continue;
    const tiers = [...rule.tiers].sort((a, b) => num(a.min_monthly_volume) - num(b.min_monthly_volume));
    const volume = round2(sales.filter(c => c.rule_id === ruleId).reduce((sum, c) => sum + num(c.base_amount), 0));
    const current = tiers.filter(t => num(t.min_monthly_volume) <= volume).pop() || null;
    const next = tiers.find(t => num(t.min_monthly_volume) > volume) || null;
    progress.push({
      rule_id: ruleId,
      rule_name: rule.name,
      volume,
      current_percent: current ? num(current.percent) : 0,
      next_tier: next && {
        min_monthly_volume: num(next.min_monthly_volume),
        percent: num(next.percent),
        bonus_amount: num(next.bonus_amount),
        missing: round2(num(next.min_monthly_volume) - volume)
      }
    });
  }
  return progress;
}

module.exports = {
  CommissionError,
  isFullyPaid,
  resolveRule,
  computeBase,
  resolveRecipients,
  generateForOrder,
  markPayable,
  cancelForOrder,
  markPaid,
  recalcTiersForPeriod,
  getTierProgress,
  periodOf
};
