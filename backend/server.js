// backend/server.js
require('dotenv').config();
const app = require('./app');
const { sequelize } = require('./models');
const seed = require('./seed');

const PORT = process.env.PORT || 5000;

(async () => {
  try {
    // Cria as tabelas que ainda não existem
    await sequelize.sync();
    await seed();
    app.listen(PORT, () => {
      console.log(`Servidor rodando na porta ${PORT}`);
      console.log(`Abra http://localhost:${PORT} no browser`);
    });
  } catch (error) {
    console.error('Erro ao arrancar o servidor:', error);
    process.exit(1);
  }
})();
