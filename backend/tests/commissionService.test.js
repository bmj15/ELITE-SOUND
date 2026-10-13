const db = require('../models');
const service = require('../services/commissionService');

const { sequelize, User, Order, OrderParticipant, CommissionRule, Commission } = db;
const num = (v) => parseFloat(v);
const JAN = new Date('2026-01-15T10:00:00Z');

let ana, rui, eva;

beforeEach(async () => {
  await sequelize.sync({ force: true });
  [ana, rui, eva] = await Promise.all(['Ana', 'Rui', 'Eva'].map(name => User.create({ name, role: 'collaborator' })));
});

afterAll(() => sequelize.close());

async function team(order, members) {
  for (const [user, role, custom_percent] of members) {
    await OrderParticipant.create({ order_id: order.id, user_id: user.id, role, custom_percent });
  }
}

const sales = (orderId) => Commission.findAll({ where: { order_id: orderId, type: 'sale' }, order: [['id', 'ASC']] });

test('só vendedor: uma comissão sobre o total', async () => {
  await CommissionRule.create({ name: 'Base', recipient_mode: 'seller_only', base_type: 'order_total', value: 5 });
  const order = await Order.create({ seller_id: ana.id, total_value: 1230 });
  await team(order, [[rui, 'tecnico']]);

  const result = await service.generateForOrder(order.id, { date: JAN });
  expect(result).toHaveLength(1);
  expect(result[0].user_id).toBe(ana.id);
  expect(num(result[0].amount)).toBe(61.5);
  expect(result[0].status).toBe('pendente');
  expect(result[0].period).toBe('2026-01');
});

test('todos os participantes, divisão igual: as partes somam o total', async () => {
  await CommissionRule.create({ name: 'Equipa', recipient_mode: 'all_participants', split_mode: 'equal', value: 10 });
  const order = await Order.create({ seller_id: ana.id, total_value: 100 });
  await team(order, [[ana, 'vendedor'], [rui, 'tecnico'], [eva, 'montagem']]);

  const result = await service.generateForOrder(order.id, { date: JAN });
  expect(result).toHaveLength(3);
  const total = result.reduce((sum, c) => sum + num(c.amount), 0);
  expect(Math.round(total * 100) / 100).toBe(10);
  expect(result.map(c => num(c.amount))).toEqual([3.33, 3.33, 3.34]);
});

test('divisão por peso do papel e mesmo colaborador com dois papéis', async () => {
  await CommissionRule.create({
    name: 'Pesos', recipient_mode: 'all_participants', split_mode: 'by_role_weight',
    role_weights: { vendedor: 60, tecnico: 20, montagem: 20 }, value: 10
  });
  const order = await Order.create({ seller_id: ana.id, total_value: 1000 });
  await team(order, [[ana, 'vendedor'], [rui, 'tecnico'], [rui, 'montagem']]);

  const result = await service.generateForOrder(order.id, { date: JAN });
  expect(result.map(c => [c.user_id, num(c.amount)])).toEqual([[ana.id, 60], [rui.id, 40]]);
});

test('percentagens personalizadas têm de somar 100', async () => {
  await CommissionRule.create({ name: 'Custom', recipient_mode: 'all_participants', split_mode: 'custom_percent', value: 10 });
  const order = await Order.create({ seller_id: ana.id, total_value: 1000 });
  await team(order, [[ana, 'vendedor', 70], [rui, 'tecnico', 20]]);

  await expect(service.generateForOrder(order.id, { date: JAN })).rejects.toThrow(service.CommissionError);
});

test('base no lucro (sem IVA menos custo)', async () => {
  await CommissionRule.create({ name: 'Lucro', base_type: 'profit', value: 10 });
  const order = await Order.create({ seller_id: ana.id, total_value: 1230, vat_rate: 23, cost_total: 600 });

  const [commission] = await service.generateForOrder(order.id, { date: JAN });
  expect(num(commission.base_amount)).toBe(400);
  expect(num(commission.amount)).toBe(40);
});

test('valor fixo por venda', async () => {
  await CommissionRule.create({ name: 'Fixo', calc_type: 'fixed_per_sale', value: 25 });
  const order = await Order.create({ seller_id: ana.id, total_value: 5000 });

  const [commission] = await service.generateForOrder(order.id, { date: JAN });
  expect(num(commission.amount)).toBe(25);
});

test('a regra de maior prioridade que bate os filtros ganha', async () => {
  await CommissionRule.create({ name: 'Geral', value: 5, priority: 0 });
  await CommissionRule.create({ name: 'Aluguer', value: 8, priority: 10, order_type: 'aluguer' });
  const venda = await Order.create({ seller_id: ana.id, total_value: 100, order_type: 'venda' });
  const aluguer = await Order.create({ seller_id: ana.id, total_value: 100, order_type: 'aluguer' });

  expect(num((await service.generateForOrder(venda.id, { date: JAN }))[0].amount)).toBe(5);
  expect(num((await service.generateForOrder(aluguer.id, { date: JAN }))[0].amount)).toBe(8);
});

test('escalões: subir de escalão reajusta o mês e cria o bónus uma só vez', async () => {
  const rule = await CommissionRule.create({ name: 'Metas', value: 0, use_tiers: true });
  await rule.createTier({ min_monthly_volume: 0, percent: 3 });
  await rule.createTier({ min_monthly_volume: 10000, percent: 5, bonus_amount: 200 });

  const first = await Order.create({ seller_id: ana.id, total_value: 6000 });
  await service.generateForOrder(first.id, { date: JAN });
  expect(num((await sales(first.id))[0].amount)).toBe(180);

  const second = await Order.create({ seller_id: ana.id, total_value: 5000 });
  await service.generateForOrder(second.id, { date: JAN });
  expect(num((await sales(first.id))[0].amount)).toBe(300);
  expect(num((await sales(second.id))[0].amount)).toBe(250);

  // Regenerar não duplica o bónus
  await service.generateForOrder(second.id, { date: JAN });
  const bonuses = await Commission.findAll({ where: { user_id: ana.id, type: 'tier_bonus' } });
  expect(bonuses).toHaveLength(1);
  expect(num(bonuses[0].amount)).toBe(200);
  expect(bonuses[0].status).toBe('pendente');

  // O bónus fica a pagar quando as vendas pagas atingem a meta
  await service.markPayable(first.id);
  await bonuses[0].reload();
  expect(bonuses[0].status).toBe('pendente');
  await service.markPayable(second.id);
  await bonuses[0].reload();
  expect(bonuses[0].status).toBe('a_pagar');

  const progress = await service.getTierProgress(ana.id, '2026-01');
  expect(progress[0]).toMatchObject({ volume: 11000, current_percent: 5, next_tier: null });
});

test('cancelamento anula comissões e o bónus que deixa de ser atingido', async () => {
  const rule = await CommissionRule.create({ name: 'Metas', value: 0, use_tiers: true });
  await rule.createTier({ min_monthly_volume: 0, percent: 3 });
  await rule.createTier({ min_monthly_volume: 10000, percent: 5, bonus_amount: 200 });
  const first = await Order.create({ seller_id: ana.id, total_value: 6000 });
  const second = await Order.create({ seller_id: ana.id, total_value: 5000 });
  await service.generateForOrder(first.id, { date: JAN });
  await service.generateForOrder(second.id, { date: JAN });

  await service.cancelForOrder(second.id);
  expect((await sales(second.id))[0].status).toBe('anulada');
  expect(num((await sales(first.id))[0].amount)).toBe(180);
  const bonus = await Commission.findOne({ where: { type: 'tier_bonus' } });
  expect(bonus.status).toBe('anulada');
});

test('pagamento total do pedido passa a a_pagar; já pagas não são recalculadas', async () => {
  await CommissionRule.create({ name: 'Base', value: 5 });
  const order = await Order.create({ seller_id: ana.id, total_value: 100 });
  await service.generateForOrder(order.id, { date: JAN });

  await service.markPayable(order.id);
  const [commission] = await sales(order.id);
  expect(commission.status).toBe('a_pagar');

  await service.markPaid([commission.id]);
  await commission.reload();
  expect(commission.status).toBe('paga');
  expect(commission.paid_at).not.toBeNull();
  await expect(service.generateForOrder(order.id)).rejects.toThrow(service.CommissionError);
});

test('sem vendedor e sem participantes dá erro claro', async () => {
  await CommissionRule.create({ name: 'Base', value: 5 });
  const order = await Order.create({ total_value: 100 });
  await expect(service.generateForOrder(order.id, { date: JAN })).rejects.toThrow('vendedor');
});
