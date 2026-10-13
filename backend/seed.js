// backend/seed.js
// Dados iniciais: admin, configurações e (na primeira vez) equipamentos de exemplo.
const bcrypt = require('bcryptjs');
const { User, Configuration, Equipment } = require('./models');

const DEFAULT_CONFIGURATIONS = {
  order_payment_percentage_required: '50',
  profit_share_unit_price: '10',
  profit_share_max_percent: '30',
  profit_share_max_monthly_eur: '500',
  profit_share_pool_percent: '10',
  EMAIL_USER: '',
  EMAIL_PASS: '',
  LOGICPOS_API_URL: '',
  LOGICPOS_API_TOKEN: ''
};

const DEMO_EQUIPMENTS = [
  { name: 'Coluna Ativa 1000W (exemplo)', description: 'Coluna amplificada para eventos até 150 pessoas.', price_hour: 8, price_day: 45, price_week: 220, cost_day: 10 },
  { name: 'Mesa de Mistura 12 canais (exemplo)', description: 'Mesa analógica com efeitos e USB.', price_hour: 5, price_day: 30, price_week: 150, cost_day: 6 },
  { name: 'Kit Microfones sem fios (exemplo)', description: 'Dois microfones de mão com recetor.', price_hour: 4, price_day: 25, price_week: 120, cost_day: 5 }
];

async function seed() {
  for (const [config_key, config_value] of Object.entries(DEFAULT_CONFIGURATIONS)) {
    await Configuration.findOrCreate({ where: { config_key }, defaults: { config_value } });
  }

  if (await User.count({ where: { role: 'admin' } }) === 0) {
    const email = (process.env.ADMIN_EMAIL || 'admin@elitesound.local').toLowerCase();
    const password = process.env.ADMIN_PASSWORD || 'admin123';
    await User.create({ name: 'Administrador', email, password: await bcrypt.hash(password, 10), role: 'admin' });
    console.log(`Admin criado: ${email} / ${password}  (mude a senha ou defina ADMIN_EMAIL/ADMIN_PASSWORD no .env)`);
  }

  if (await Equipment.count() === 0) {
    await Equipment.bulkCreate(DEMO_EQUIPMENTS);
    console.log('Equipamentos de exemplo criados (pode editá-los ou desativá-los).');
  }
}

module.exports = seed;
