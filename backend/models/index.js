// backend/models/index.js
// Carrega todos os modelos desta pasta e define as associações.
const fs = require('fs');
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');

const env = process.env.NODE_ENV || 'development';

const DEFINE = { underscored: true, createdAt: 'created_at', updatedAt: 'updated_at' };

// Por defeito usa SQLite num ficheiro (não é preciso instalar nada).
// Para MySQL: DB_DIALECT=mysql e DB_HOST/DB_NAME/DB_USER/DB_PASSWORD no .env.
function createSequelize() {
  if (env === 'test') {
    return new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false, define: DEFINE });
  }

  const candidates = ['config.json', 'config.json.txt'].map(f => path.join(__dirname, '..', 'config', f));
  const file = candidates.find(f => fs.existsSync(f));
  const fileConfig = file ? (JSON.parse(fs.readFileSync(file, 'utf8'))[env] || {}) : {};
  const dialect = process.env.DB_DIALECT || 'sqlite';

  if (dialect === 'sqlite') {
    const storage = process.env.DB_STORAGE || path.join(__dirname, '..', 'data', 'elitesound.sqlite');
    fs.mkdirSync(path.dirname(storage), { recursive: true });
    return new Sequelize({ dialect: 'sqlite', storage, logging: false, define: DEFINE });
  }

  return new Sequelize(
    process.env.DB_NAME || fileConfig.database,
    process.env.DB_USER || fileConfig.username,
    process.env.DB_PASSWORD || fileConfig.password,
    {
      host: process.env.DB_HOST || fileConfig.host,
      port: process.env.DB_PORT || fileConfig.port,
      dialect,
      logging: false,
      define: DEFINE
    }
  );
}

const sequelize = createSequelize();

// O SQLite não suporta UNSIGNED: usa INTEGER simples (evita avisos no arranque)
const types = sequelize.getDialect() === 'sqlite'
  ? Object.assign(Object.create(DataTypes), {
    INTEGER: new Proxy(DataTypes.INTEGER, { get: (target, prop) => (prop === 'UNSIGNED' ? target : target[prop]) })
  })
  : DataTypes;

const db = {};
fs.readdirSync(__dirname)
  .filter(file => file !== 'index.js' && file.endsWith('.js'))
  .forEach(file => {
    const model = require(path.join(__dirname, file))(sequelize, types);
    db[model.name] = model;
  });

Object.values(db).forEach(model => {
  if (typeof model.associate === 'function') model.associate(db);
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;
module.exports = db;
