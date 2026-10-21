// servidor.js — servidor local do Grupo BXB (sem dependências: só Node.js)
// Serve a pasta do repositório em http://localhost:8080 e abre o portal.
// Só aceita ligações deste computador (127.0.0.1).
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = +process.env.PORT || 8080;
const HOST = '127.0.0.1';
const RAIZ = __dirname;
const URL_PORTAL = `http://localhost:${PORT}/SISTEMAS/index.html`;
const ASSINATURA = 'grupo-bxb-servidor';

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.webp': 'image/webp', '.pdf': 'application/pdf', '.woff': 'font/woff', '.woff2': 'font/woff2',
};
// pastas que nunca são servidas
const PRIVADO = /(^|[\\/])(\.git|\.claude|node_modules|backend)([\\/]|$)/i;

function abrirBrowser(url) {
  if (process.env.NO_BROWSER) return;
  const browser = process.env.BROWSER;
  const cmd = process.platform === 'win32'
    ? (browser ? `start "" "${browser}" "${url}"` : `start "" "${url}"`)
    : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

const servidor = http.createServer((req, res) => {
  const enviar = (codigo, corpo, tipo = 'text/plain; charset=utf-8') => {
    res.writeHead(codigo, { 'Content-Type': tipo, 'Cache-Control': 'no-cache', 'X-Servidor': ASSINATURA });
    res.end(corpo);
  };
  if (req.method !== 'GET' && req.method !== 'HEAD') return enviar(405, 'Método não permitido');

  let caminho;
  try { caminho = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch (e) { return enviar(400, 'Pedido inválido'); }
  if (caminho === '/') { res.writeHead(302, { Location: '/SISTEMAS/index.html', 'X-Servidor': ASSINATURA }); return res.end(); }

  const ficheiro = path.normalize(path.join(RAIZ, caminho));
  // impede sair da pasta do repositório (../) e servir pastas privadas
  if (!ficheiro.startsWith(RAIZ + path.sep) || PRIVADO.test(path.relative(RAIZ, ficheiro))) return enviar(404, 'Não encontrado');

  fs.stat(ficheiro, (erro, info) => {
    const alvo = !erro && info.isDirectory() ? path.join(ficheiro, 'index.html') : ficheiro;
    fs.readFile(alvo, (erro2, dados) => {
      if (erro2) return enviar(404, 'Não encontrado');
      res.writeHead(200, {
        'Content-Type': TIPOS[path.extname(alvo).toLowerCase()] || 'application/octet-stream',
        // sem cache: depois de atualizar o código, a página nova aparece logo
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
        'X-Servidor': ASSINATURA,
      });
      res.end(req.method === 'HEAD' ? undefined : dados);
    });
  });
});

servidor.on('error', erro => {
  if (erro.code !== 'EADDRINUSE') {
    console.error('Erro ao arrancar o servidor:', erro.message);
    process.exit(1);
  }
  // a porta está ocupada: se for este servidor (já aberto noutra janela), basta abrir o browser
  http.get(`http://${HOST}:${PORT}/`, r => {
    if (r.headers['x-servidor'] === ASSINATURA) {
      console.log(`O servidor já está a correr noutra janela. A abrir ${URL_PORTAL}`);
      abrirBrowser(URL_PORTAL);
      setTimeout(() => process.exit(0), 500);
    } else {
      console.error(`A porta ${PORT} está ocupada por outro programa. Feche-o ou defina outra porta (set PORT=8081).`);
      process.exit(1);
    }
  }).on('error', () => {
    console.error(`A porta ${PORT} está ocupada por outro programa. Feche-o ou defina outra porta (set PORT=8081).`);
    process.exit(1);
  });
});

servidor.listen(PORT, HOST, () => {
  console.log('');
  console.log('  Grupo BXB - servidor local a correr');
  console.log(`  Abra: ${URL_PORTAL}`);
  console.log('');
  console.log('  Nao feche esta janela enquanto usa o sistema.');
  abrirBrowser(URL_PORTAL);
});
