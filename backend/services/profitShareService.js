// backend/services/profitShareService.js
// Conversão de comissões em unidades de participação nos lucros e distribuição de dividendos.
const { Op } = require('sequelize');
const {
  sequelize, Commission, Configuration, ProfitShareConversion, ProfitDistribution, ProfitShareDividend
} = require('../models');
const { CommissionError, periodOf } = require('./commissionService');

const num = (v) => parseFloat(v) || 0;
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const round4 = (n) => Math.round((n + Number.EPSILON) * 10000) / 10000;

const CONFIG_KEYS = {
  unitPrice: 'profit_share_unit_price',
  maxPercent: 'profit_share_max_percent',
  maxMonthlyEur: 'profit_share_max_monthly_eur',
  poolPercent: 'profit_share_pool_percent'
};

// Lê os parâmetros da tabela configurations; um valor vazio significa "sem limite".
async function getSettings() {
  const rows = await Configuration.findAll({ where: { config_key: Object.values(CONFIG_KEYS) } });
  const value = (key) => {
    const row = rows.find(r => r.config_key === key);
    return row && row.config_value !== null && String(row.config_value).trim() !== '' ? num(row.config_value) : null;
  };
  return {
    unitPrice: value(CONFIG_KEYS.unitPrice),
    maxPercent: value(CONFIG_KEYS.maxPercent),
    maxMonthlyEur: value(CONFIG_KEYS.maxMonthlyEur),
    poolPercent: value(CONFIG_KEYS.poolPercent)
  };
}

async function convertedThisMonth(userId, period, transaction) {
  return num(await ProfitShareConversion.sum('amount_eur', { where: { user_id: userId, period }, transaction }));
}

// Valor máximo que ainda se pode converter desta comissão (aplica-se o limite mais restritivo).
async function getConversionLimit(commission, settings, { date = new Date(), transaction } = {}) {
  if (commission.status !== 'a_pagar') return 0;
  const amount = num(commission.amount);
  const converted = num(commission.converted_amount);
  const limits = [amount - converted];
  if (settings.maxPercent !== null) limits.push(amount * settings.maxPercent / 100 - converted);
  if (settings.maxMonthlyEur !== null) {
    limits.push(settings.maxMonthlyEur - await convertedThisMonth(commission.user_id, periodOf(date), transaction));
  }
  return Math.max(0, round2(Math.min(...limits)));
}

async function convert(userId, commissionId, amountEur, { date = new Date() } = {}) {
  const amount = round2(num(amountEur));
  if (amount <= 0) throw new CommissionError('Indique um valor positivo para converter.');

  const settings = await getSettings();
  if (!settings.unitPrice || settings.unitPrice <= 0) {
    throw new CommissionError('A conversão em participação não está configurada (preço da unidade).');
  }

  return sequelize.transaction(async (transaction) => {
    const commission = await Commission.findByPk(commissionId, { transaction });
    if (!commission || Number(commission.user_id) !== Number(userId)) throw new CommissionError('Comissão não encontrada.');
    if (commission.status !== 'a_pagar') {
      throw new CommissionError('Só é possível converter comissões já devidas (a pagar).');
    }

    const limit = await getConversionLimit(commission, settings, { date, transaction });
    if (amount > limit) throw new CommissionError(`O máximo que pode converter desta comissão é ${limit.toFixed(2)}€.`);

    const conversion = await ProfitShareConversion.create({
      user_id: userId,
      commission_id: commission.id,
      amount_eur: amount,
      unit_price: settings.unitPrice,
      units: round4(amount / settings.unitPrice),
      period: periodOf(date),
      converted_at: date
    }, { transaction });

    const converted = round2(num(commission.converted_amount) + amount);
    const fullyConverted = converted >= num(commission.amount);
    await commission.update({
      converted_amount: converted,
      ...(fullyConverted ? { status: 'paga', paid_at: date } : {})
    }, { transaction });

    return { conversion, commission };
  });
}

async function getHoldings(userId) {
  const conversions = await ProfitShareConversion.findAll({ where: { user_id: userId }, order: [['id', 'DESC']] });
  const dividends = await ProfitShareDividend.findAll({
    where: { user_id: userId },
    include: [{ model: ProfitDistribution, attributes: ['id', 'distribution_date', 'total_profit', 'pool_percent'] }],
    order: [['id', 'DESC']]
  });
  return {
    units: round4(conversions.reduce((sum, c) => sum + num(c.units), 0)),
    invested: round2(conversions.reduce((sum, c) => sum + num(c.amount_eur), 0)),
    dividends_total: round2(dividends.reduce((sum, d) => sum + num(d.amount), 0)),
    dividends_to_receive: round2(dividends.filter(d => d.status === 'a_pagar').reduce((sum, d) => sum + num(d.amount), 0)),
    conversions,
    dividends
  };
}

// Regista uma distribuição de lucro e reparte o pool pelos titulares, proporcional às unidades.
async function distribute({ distribution_date, total_profit, distributed_amount, distribution_details, pool_percent }) {
  const profit = num(total_profit);
  if (profit <= 0) throw new CommissionError('O lucro total tem de ser positivo.');
  const date = distribution_date ? new Date(distribution_date) : new Date();

  let percent = pool_percent;
  if (percent === undefined || percent === null || percent === '') percent = (await getSettings()).poolPercent;
  percent = num(percent);
  if (percent < 0 || percent > 100) throw new CommissionError('A % do pool tem de estar entre 0 e 100.');
  const pool = round2(profit * percent / 100);

  return sequelize.transaction(async (transaction) => {
    const conversions = await ProfitShareConversion.findAll({
      where: { converted_at: { [Op.lte]: date } },
      order: [['user_id', 'ASC']],
      transaction
    });
    const unitsByUser = new Map();
    conversions.forEach(c => unitsByUser.set(c.user_id, (unitsByUser.get(c.user_id) || 0) + num(c.units)));
    const totalUnits = [...unitsByUser.values()].reduce((sum, u) => sum + u, 0);

    const distribution = await ProfitDistribution.create({
      distribution_date: date,
      total_profit: profit,
      distributed_amount: distributed_amount === undefined || distributed_amount === '' ? null : num(distributed_amount),
      distribution_details,
      pool_percent: percent,
      pool_amount: pool,
      total_units: round4(totalUnits)
    }, { transaction });

    if (pool > 0 && totalUnits > 0) {
      const holders = [...unitsByUser];
      let allocated = 0;
      for (let i = 0; i < holders.length; i++) {
        const [userId, units] = holders[i];
        const amount = i === holders.length - 1 ? round2(pool - allocated) : round2(pool * units / totalUnits);
        allocated = round2(allocated + amount);
        await ProfitShareDividend.create({
          distribution_id: distribution.id,
          user_id: userId,
          units: round4(units),
          amount
        }, { transaction });
      }
    }

    return distribution;
  });
}

async function markDividendsPaid(ids) {
  const dividends = await ProfitShareDividend.findAll({ where: { id: { [Op.in]: ids }, status: 'a_pagar' } });
  const paidAt = new Date();
  for (const d of dividends) await d.update({ status: 'paga', paid_at: paidAt });
  return dividends;
}

module.exports = {
  CONFIG_KEYS,
  getSettings,
  getConversionLimit,
  convert,
  getHoldings,
  distribute,
  markDividendsPaid
};
