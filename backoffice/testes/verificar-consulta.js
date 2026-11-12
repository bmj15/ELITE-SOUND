'use strict';

// Exercita a renovação da chave numa API fictícia. Não abre nem altera dados de clientes.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const net = require('node:net');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');

const raiz = path.resolve(__dirname, '..', '..');
const baseTestes = path.resolve(raiz, '..', '..', 'TESTES-CODEX');
const pasta = path.join(baseTestes, 'api-simulada', crypto.randomBytes(8).toString('hex'));
const pastaChave = path.join(pasta, 'chave-ficticia');
const dados = path.join(pasta, 'dados-backoffice');
const origem = 'http://127.0.0.1:8890';
let chaveConsulta = crypto.randomBytes(32).toString('hex');
let recusar = false;
let servidor;
let filho;
let log = '';
const chamadas = [];

async function livre(porta) {
  await new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', () => reject(new Error(`Porta de teste ${porta} ocupada.`)));
    s.listen(porta, '127.0.0.1', () => s.close(resolve));
  });
}

async function pedir(rota, { corpo, cookie, chave } = {}) {
  const headers = {};
  if (corpo) Object.assign(headers, { 'Content-Type': 'application/json', 'X-BXB': '1', Origin: origem });
  if (cookie) headers.Cookie = cookie;
  if (chave) headers.Authorization = 'Bearer ' + chave;
  const r = await fetch(origem + rota, { method: corpo ? 'POST' : 'GET', headers, body: corpo ? JSON.stringify(corpo) : undefined, signal: AbortSignal.timeout(10000) });
  return { estado: r.status, json: await r.json(), cookie: r.headers.get('set-cookie')?.split(';')[0] };
}

async function terminar() {
  if (filho && filho.exitCode === null) {
    await new Promise(resolve => { const timer = setTimeout(resolve, 4000); filho.once('exit', () => { clearTimeout(timer); resolve(); }); filho.kill(); });
  }
  if (servidor?.listening) await new Promise(resolve => servidor.close(resolve));
}

async function principal() {
  for (const porta of [8890, 8897]) await livre(porta);
  fs.mkdirSync(pastaChave, { recursive: true }); fs.mkdirSync(dados, { recursive: true });
  const ficheiro = path.join(pastaChave, 'consulta.chave');
  fs.writeFileSync(ficheiro, chaveConsulta, { mode: 0o600 });
  servidor = http.createServer((req, res) => {
    assert.equal(req.method, 'GET', 'A consulta nunca altera o cliente.');
    assert.equal(req.headers.origin, undefined, 'A chamada servidor-servidor não envia Origin.');
    assert(req.url.startsWith('/v1/'), 'Apenas o contrato v1 é utilizado.');
    const autenticado = !recusar && req.headers.authorization === 'Bearer ' + chaveConsulta;
    chamadas.push(autenticado ? 200 : 401);
    res.writeHead(autenticado ? 200 : 401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(autenticado ? {
      servidor: { pid: 1, arranque: Date.now(), versao: 'teste', versaoDisco: 'teste', portas: { site: 8891, consulta: 8897 }, enderecos: [], copias: 0, bd: 0 },
      contas: { total: 2, ativas: 2, admins: 1, novas30: 2, sessoes: 1, comSessao: 1 },
      areas: { particular: 1, empresa: 0 }, entradas: { d7: 1, falhadas7: 0, recusados7: 0 },
      email: { pronto: false, conta: '', enviados7: 0, falhados7: 0 }, geral: { marca: 'Site fictício' }, atividade: [],
    } : { erro: 'Chave de consulta inválida' }));
  });
  await new Promise(resolve => servidor.listen(8897, '127.0.0.1', resolve));
  filho = spawn(process.execPath, ['--experimental-sqlite', 'backoffice/servidor-backoffice.js'], {
    cwd: raiz, env: { ...process.env, BXB_DADOS: pastaChave, BXB_DADOS_BACKOFFICE: dados, PORT_BACKOFFICE: '8890', PORT_CONSULTA: '8897', BXB_MODO_TESTE: '1', NO_BROWSER: '1' },
    windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  for (const p of [filho.stdout, filho.stderr]) p.on('data', b => { log = (log + b.toString()).slice(-5000); });
  let pronto = false;
  for (let tentativa = 0; tentativa < 100; tentativa++) {
    if (filho.exitCode !== null) throw new Error('O servidor de teste terminou: ' + log);
    try { pronto = (await pedir('/api/saude')).estado === 200; } catch (_) { }
    if (pronto) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert(pronto, 'O servidor de teste ficou disponível.');
  const chave = fs.readFileSync(path.join(dados, 'backoffice.chave'), 'utf8').trim();
  const bilhete = await pedir('/api/bilhete', { chave, corpo: {} });
  assert.equal(bilhete.estado, 200);
  const entrada = await pedir('/api/entrar', { corpo: { bilhete: bilhete.json.bilhete } });
  const configurado = await pedir('/api/configurar', { cookie: entrada.cookie, corpo: { nome: 'Operador fictício', email: 'ficticio@example.test', palavra: crypto.randomBytes(18).toString('base64url') } });
  assert.equal(configurado.estado, 200);
  const cookie = configurado.cookie || entrada.cookie;
  assert.equal((await pedir('/api/painel', { cookie })).estado, 200);
  chamadas.length = 0;
  chaveConsulta = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(ficheiro, chaveConsulta, { mode: 0o600 });
  assert.equal((await pedir('/api/painel', { cookie })).estado, 200);
  assert(chamadas.includes(200), 'A consulta usa a chave renovada.');
  assert(chamadas.length <= 2, 'No máximo uma repetição por chave renovada.');
  // Uma implementação que releia sempre a chave também respeita o contrato.
  recusar = true;
  assert.equal((await pedir('/api/painel', { cookie })).estado, 502);
  assert.equal((await pedir('/api/quem', { cookie })).estado, 200, 'Uma falha da consulta não termina a sessão do back-office.');
  console.log('API simulada: renovação de chave, limitação de repetição, ausência de Origin e preservação da sessão aprovadas.');
}

principal().catch(erro => { console.error('Falha na API simulada: ' + erro.message); process.exitCode = 1; }).finally(terminar);
