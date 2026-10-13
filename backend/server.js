// backend/server.js
require('dotenv').config();
const app = require('./app');
const { sequelize } = require('./models');
const seed = require('./seed');
const { exec } = require('child_process');

// Abre o site no browser (usado pelo INICIAR.bat no Windows)
function openBrowser(url) {
  const command = process.platform === 'win32' ? `start "" "${url}"`
    : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(command, () => {});
}

const PORT = process.env.PORT || 5000;

(async () => {
  try {
    // Cria as tabelas que ainda não existem
    await sequelize.sync();
    await seed();
    app.listen(PORT, () => {
      console.log(`Servidor rodando na porta ${PORT}`);
      console.log(`Abra http://localhost:${PORT} no browser`);
      if (process.env.OPEN_BROWSER) openBrowser(`http://localhost:${PORT}`);
    }).on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`A porta ${PORT} já está ocupada: o Elite Sound já está aberto noutra janela?`);
        console.error(`Feche a outra janela ou abra http://localhost:${PORT} no browser.`);
      } else {
        console.error('Erro ao arrancar o servidor:', error);
      }
      process.exit(1);
    });
  } catch (error) {
    console.error('Erro ao arrancar o servidor:', error);
    process.exit(1);
  }
})();
