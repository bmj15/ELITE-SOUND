// backend/models/index.js
// Carrega todos os modelos desta pasta e define as associações.
const fs = require('fs');
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');

const env = process.env.NODE_ENV || 'development';

function loadDbConfig() {
  if (env === 'test') {
    return { dialect: 'sqlite', storage: ':memory:', logging: false };
  }
  const candidates = ['config.json', 'config.json.txt'].map(f => path.join(__dirname, '..', 'config', f));
  const file = candidates.find(f => fs.existsSync(f));
  const fileConfig = file ? (JSON.parse(fs.readFileSync(file, 'utf8'))[env] || {}) : {};
  return {
    ...fileConfig,
    username: process.env.DB_USER || fileConfig.username,
    password: process.env.DB_PASSWORD || fileConfig.password,
    database: process.env.DB_NAME || fileConfig.database,
    host: process.env.DB_HOST || fileConfig.host,
    dialect: fileConfig.dialect || 'mysql',
    logging: false
  };
}

const config = loadDbConfig();
const sequelize = config.dialect === 'sqlite'
  ? new Sequelize({ dialect: 'sqlite', storage: config.storage, logging: false })
  : new Sequelize(config.database, config.username, config.password, config);

const db = {};
fs.readdirSync(__dirname)
  .filter(file => file !== 'index.js' && file.endsWith('.js'))
  .forEach(file => {
    const model = require(path.join(__dirname, file))(sequelize, DataTypes);
    db[model.name] = model;
  });

Object.values(db).forEach(model => {
  if (typeof model.associate === 'function') model.associate(db);
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;
module.exports = db;
