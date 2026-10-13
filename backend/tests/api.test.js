const request = require('supertest');
const app = require('../app');
const db = require('../models');
const seed = require('../seed');

const { sequelize, User, CommissionRule, Commission } = db;

async function login(email, password) {
  const res = await request(app).post('/api/users/login').send({ email, password });
  expect(res.status).toBe(200);
  return `Bearer ${res.body.token}`;
}

let adminToken, clientToken, sellerToken, seller;

beforeAll(async () => {
  await sequelize.sync({ force: true });
  await seed();
  adminToken = await login('admin@elitesound.local', 'admin123');

  expect((await request(app).post('/api/users/register').send({ name: 'Cliente', email: 'Cliente@Teste.pt', password: 'segredo1' })).status).toBe(201);
  expect((await request(app).post('/api/users/register').send({ name: 'Vendedor', email: 'vendedor@teste.pt', password: 'segredo2' })).status).toBe(201);
  clientToken = await login('cliente@teste.pt', 'segredo1');

  seller = await User.findOne({ where: { email: 'vendedor@teste.pt' } });
  const promote = await request(app).put(`/api/users/${seller.id}/role`).set('Authorization', adminToken).send({ role: 'collaborator' });
  expect(promote.status).toBe(200);
  sellerToken = await login('vendedor@teste.pt', 'segredo2');
});

afterAll(() => sequelize.close());

test('registo duplicado e login errado são recusados; a password nunca é devolvida', async () => {
  const dup = await request(app).post('/api/users/register').send({ name: 'X', email: 'cliente@teste.pt', password: 'segredo1' });
  expect(dup.status).toBe(400);
  expect((await request(app).post('/api/users/login').send({ email: 'cliente@teste.pt', password: 'errada' })).status).toBe(401);

  const me = await request(app).get('/api/users/me').set('Authorization', clientToken);
  expect(me.body.user).toMatchObject({ email: 'cliente@teste.pt', role: 'client' });
  expect(me.body.user.password).toBeUndefined();
});

test('controlo de acessos por papel', async () => {
  expect((await request(app).get('/api/configurations')).status).toBe(401);
  expect((await request(app).get('/api/configurations').set('Authorization', clientToken)).status).toBe(403);
  expect((await request(app).get('/api/configurations').set('Authorization', sellerToken)).status).toBe(403);
  expect((await request(app).get('/api/configurations').set('Authorization', adminToken)).status).toBe(200);
  expect((await request(app).get('/api/tasks').set('Authorization', clientToken)).status).toBe(403);
  expect((await request(app).get('/api/tasks').set('Authorization', sellerToken)).status).toBe(200);
  expect((await request(app).get('/api/equipments')).status).toBe(200);
  expect((await request(app).get('/api/nao-existe')).status).toBe(404);
});

test('fluxo completo: reserva → contrato → pagamento → comissão a pagar', async () => {
  await CommissionRule.create({ name: 'Base', value: 10 });
  const [equipment] = (await request(app).get('/api/equipments')).body;

  const created = await request(app).post('/api/orders').set('Authorization', clientToken).send({
    equipment_id: equipment.id, pickup_date: '2026-11-01T10:00', return_date: '2026-11-03T10:00'
  });
  expect(created.status).toBe(201);
  const order = created.body.order;
  expect(parseFloat(order.total_value)).toBe(parseFloat(equipment.price_day) * 2);
  expect(parseFloat(order.payment_percentage_required)).toBe(50);

  // A equipa define o vendedor
  const team = await request(app).put(`/api/commissions/orders/${order.id}/participants`)
    .set('Authorization', adminToken).send({ seller_id: seller.id, participants: [] });
  expect(team.status).toBe(200);

  // Outro cliente não vê nem assina este pedido
  expect((await request(app).get(`/api/orders/${order.id}/contract`).set('Authorization', sellerToken)).status).toBe(200);
  const contract = await request(app).get(`/api/orders/${order.id}/contract`).set('Authorization', clientToken);
  expect(contract.body.contractText).toContain('Cliente');

  const signed = await request(app).post(`/api/orders/${order.id}/sign`).set('Authorization', clientToken).send({ signed: true });
  expect(signed.body.order.status).toBe('PAGAMENTO_PENDENTE');
  expect(signed.body.commissionWarning).toBeUndefined();

  const pending = await request(app).get('/api/orders/pending').set('Authorization', sellerToken);
  expect(pending.body.map(o => o.id)).toContain(order.id);

  const half = order.total_value / 2;
  const paid1 = await request(app).post(`/api/orders/${order.id}/confirm-payment`).set('Authorization', sellerToken).send({ amount_paid: half });
  expect(paid1.body.order.status).toBe('CONFIRMADO');
  expect((await Commission.findOne({ where: { order_id: order.id } })).status).toBe('pendente');

  const paid2 = await request(app).post('/api/payments/process').set('Authorization', clientToken)
    .send({ orderId: order.id, amount: half, cardNumber: '4111 1111 1111 1111' });
  expect(paid2.status).toBe(200);
  const commission = await Commission.findOne({ where: { order_id: order.id } });
  expect(commission.status).toBe('a_pagar');
  expect(commission.user_id).toBe(seller.id);

  const mine = await request(app).get('/api/orders/my-orders').set('Authorization', clientToken);
  expect(mine.body).toHaveLength(1);

  const logs = await request(app).get('/api/audit').set('Authorization', adminToken);
  expect(logs.body.map(l => l.action)).toContain('Pagamento registado');
});

test('chat entre cliente e equipa', async () => {
  const client = await User.findOne({ where: { email: 'cliente@teste.pt' } });
  expect((await request(app).post('/api/chat/messages').set('Authorization', clientToken).send({ message: 'Olá' })).status).toBe(201);
  expect((await request(app).post('/api/chat/messages').set('Authorization', sellerToken).send({ user_id: client.id, message: 'Bom dia!' })).status).toBe(201);
  const messages = await request(app).get('/api/chat/messages').set('Authorization', clientToken);
  expect(messages.body.map(m => [m.sender, m.message])).toEqual([['user', 'Olá'], ['staff', 'Bom dia!']]);
});

test('documentos: só o dono e a equipa os descarregam', async () => {
  const client = await User.findOne({ where: { email: 'cliente@teste.pt' } });
  const upload = await request(app).post('/api/documents/upload').set('Authorization', sellerToken)
    .field('user_id', client.id).field('type', 'Fatura').field('number', 'FT 1/2026')
    .attach('file', Buffer.from('%PDF-1.4 teste'), 'fatura.pdf');
  expect(upload.status).toBe(200);
  const doc = upload.body.document;

  const list = await request(app).get('/api/documents/my-documents').set('Authorization', clientToken);
  expect(list.body.map(d => d.id)).toContain(doc.id);
  const token = clientToken.split(' ')[1];
  expect((await request(app).get(`${doc.file_path}?token=${token}`)).status).toBe(200);

  await request(app).post('/api/users/register').send({ name: 'Outro', email: 'outro@teste.pt', password: 'segredo3' });
  const otherToken = await login('outro@teste.pt', 'segredo3');
  expect((await request(app).get(doc.file_path).set('Authorization', otherToken)).status).toBe(404);
});
