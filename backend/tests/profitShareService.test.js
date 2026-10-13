const db = require('../models');
const commissionService = require('../services/commissionService');
const profitShare = require('../services/profitShareService');

const { sequelize, User, Order, CommissionRule, Commission, Configuration, ProfitShareDividend } = db;
const num = (v) => parseFloat(v);
const JAN = new Date('2026-01-15T10:00:00Z');

let ana, rui;

async function setConfig(values) {
  for (const [key, value] of Object.entries(values)) {
    await Configuration.create({ config_key: profitShare.CONFIG_KEYS[key], config_value: value });
  }
}

// Cria uma comissão já devida (a pagar) para o colaborador
async function payableCommission(user, total, percent = 10) {
  const order = await Order.create({ seller_id: user.id, total_value: total });
  await commissionService.generateForOrder(order.id, { date: JAN });
  await commissionService.markPayable(order.id);
  return Commission.findOne({ where: { order_id: order.id } });
}

beforeEach(async () => {
  await sequelize.sync({ force: true });
  [ana, rui] = await Promise.all(['Ana', 'Rui'].map(name => User.create({ name, role: 'collaborator' })));
  await CommissionRule.create({ name: 'Base', value: 10 });
});

afterAll(() => sequelize.close());

test('converte dentro do limite e calcula as unidades', async () => {
  await setConfig({ unitPrice: 10, maxPercent: 50 });
  const commission = await payableCommission(ana, 1000); // 100€ de comissão

  expect(await profitShare.getConversionLimit(commission, await profitShare.getSettings(), { date: JAN })).toBe(50);
  const { conversion } = await profitShare.convert(ana.id, commission.id, 30, { date: JAN });
  expect(num(conversion.units)).toBe(3);

  await commission.reload();
  expect(num(commission.converted_amount)).toBe(30);
  expect(commission.status).toBe('a_pagar');
  // O limite de 50% é acumulado na mesma comissão
  await expect(profitShare.convert(ana.id, commission.id, 25, { date: JAN })).rejects.toThrow('20.00€');
});

test('aplica o limite mais restritivo entre % e € por mês', async () => {
  await setConfig({ unitPrice: 10, maxPercent: 50, maxMonthlyEur: 60 });
  const c1 = await payableCommission(ana, 1000);
  const c2 = await payableCommission(ana, 1000);

  await profitShare.convert(ana.id, c1.id, 50, { date: JAN });
  const settings = await profitShare.getSettings();
  expect(await profitShare.getConversionLimit(c2, settings, { date: JAN })).toBe(10);
  await expect(profitShare.convert(ana.id, c2.id, 11, { date: JAN })).rejects.toThrow(commissionService.CommissionError);

  // No mês seguinte o limite em € renova
  const feb = new Date('2026-02-02T10:00:00Z');
  expect(await profitShare.getConversionLimit(c2, settings, { date: feb })).toBe(50);
});

test('sem limites, a conversão total marca a comissão como paga', async () => {
  await setConfig({ unitPrice: 25 });
  const commission = await payableCommission(ana, 1000);

  await profitShare.convert(ana.id, commission.id, 100, { date: JAN });
  await commission.reload();
  expect(commission.status).toBe('paga');
  expect(num(commission.converted_amount)).toBe(100);
});

test('não converte comissões pendentes, de outro colaborador ou sem configuração', async () => {
  const order = await Order.create({ seller_id: ana.id, total_value: 1000 });
  const [pending] = await commissionService.generateForOrder(order.id, { date: JAN });
  await expect(profitShare.convert(ana.id, pending.id, 10)).rejects.toThrow('preço da unidade');

  await setConfig({ unitPrice: 10 });
  await expect(profitShare.convert(ana.id, pending.id, 10)).rejects.toThrow('a pagar');
  const payable = await payableCommission(ana, 1000);
  await expect(profitShare.convert(rui.id, payable.id, 10)).rejects.toThrow('não encontrada');
});

test('comissão com parte convertida não é anulada pelo cancelamento', async () => {
  await setConfig({ unitPrice: 10 });
  const commission = await payableCommission(ana, 1000);
  await profitShare.convert(ana.id, commission.id, 40, { date: JAN });

  await commissionService.cancelForOrder(commission.order_id);
  await commission.reload();
  expect(commission.status).toBe('a_pagar');
});

test('distribuição reparte o pool proporcionalmente às unidades com soma exata', async () => {
  await setConfig({ unitPrice: 10, poolPercent: 20 });
  const ca = await payableCommission(ana, 1000);
  const cr = await payableCommission(rui, 1000);
  await profitShare.convert(ana.id, ca.id, 20, { date: JAN });  // 2 unidades
  await profitShare.convert(rui.id, cr.id, 10, { date: JAN });  // 1 unidade

  // Conversões feitas depois da data da distribuição não contam
  const late = await payableCommission(rui, 1000);
  await profitShare.convert(rui.id, late.id, 50, { date: new Date('2026-03-01T00:00:00Z') });

  const distribution = await profitShare.distribute({ distribution_date: '2026-02-01T00:00:00Z', total_profit: 1000 });
  expect(num(distribution.pool_amount)).toBe(200);
  expect(num(distribution.total_units)).toBe(3);

  const dividends = await ProfitShareDividend.findAll({ order: [['user_id', 'ASC']] });
  expect(dividends.map(d => [d.user_id, num(d.amount)])).toEqual([[ana.id, 133.33], [rui.id, 66.67]]);

  const holdings = await profitShare.getHoldings(ana.id);
  expect(holdings).toMatchObject({ units: 2, invested: 20, dividends_total: 133.33, dividends_to_receive: 133.33 });

  await profitShare.markDividendsPaid([dividends[0].id]);
  expect((await profitShare.getHoldings(ana.id)).dividends_to_receive).toBe(0);
});

test('pool_percent explícito tem prioridade sobre a configuração', async () => {
  await setConfig({ unitPrice: 10, poolPercent: 20 });
  const distribution = await profitShare.distribute({ total_profit: 500, pool_percent: 5 });
  expect(num(distribution.pool_amount)).toBe(25);
});
