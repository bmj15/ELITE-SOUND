'use strict';

// Arranca exclusivamente instâncias fictícias nas portas reservadas ao Codex.
// As credenciais são aleatórias, só vivem na memória e nunca são escritas no Git.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const net = require('node:net');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');

const raiz = path.resolve(__dirname, '..', '..');
const baseTestes = path.resolve(raiz, '..', '..', 'TESTES-CODEX');
const execucao = new Date().toISOString().replace(/[^0-9]/g, '') + '-' + crypto.randomBytes(3).toString('hex');
const dadosSite = path.join(baseTestes, 'dados-site', execucao);
const dadosBackoffice = path.join(baseTestes, 'dados-backoffice', execucao);
const site = 'http://127.0.0.1:8891';
const consulta = 'http://127.0.0.1:8897';
const painel = 'http://127.0.0.1:8890';
const verificar = process.argv.includes('--verificar');
const manter = process.argv.includes('--manter');
const usarGestor = process.argv.includes('--gestor');
const processos = new Set();
const saidas = new Map();
let aFechar = false;
let verificacoes = 0;
let processoSite;
let processoBackoffice;
const ambiente = {
  ...process.env,
  BXB_DADOS: dadosSite,
  BXB_DADOS_BACKOFFICE: dadosBackoffice,
  PORT: '8891', PORT_REDE: '8892', PORT_GESTAO: '8898',
  PORT_CONSULTA: '8897', PORT_BACKOFFICE: '8890',
  BXB_GESTOR: '1', BXB_MODO_TESTE: '1', NO_BROWSER: '1',
};

function confirmarPasta(pasta) {
  const relativa = path.relative(baseTestes, path.resolve(pasta));
  assert(relativa && !relativa.startsWith('..') && !path.isAbsolute(relativa), 'Pasta fora de TESTES-CODEX.');
}

async function portaLivre(porta) {
  await new Promise((resolve, reject) => {
    const teste = net.createServer();
    teste.once('error', () => reject(new Error(`A porta de teste ${porta} já está ocupada; não será parado nenhum processo existente.`)));
    teste.listen(porta, '127.0.0.1', () => teste.close(resolve));
  });
}

function arrancar(ficheiro, nome) {
  const filho = spawn(process.execPath, [ficheiro], { cwd: raiz, env: ambiente, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  processos.add(filho);
  saidas.set(filho, '');
  for (const origem of [filho.stdout, filho.stderr]) {
    origem.on('data', b => saidas.set(filho, (saidas.get(filho) + b.toString()).slice(-24000)));
  }
  filho.once('exit', () => processos.delete(filho));
  filho.once('error', erro => console.error(`${nome}: ${erro.message}`));
  return filho;
}

async function esperar(url, filho) {
  const limite = Date.now() + 15000;
  while (Date.now() < limite) {
    if (filho.exitCode !== null) throw new Error(`O processo terminou antes de abrir a porta. ${saidas.get(filho) || ''}`);
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(700) });
      if (r.ok) return await r.json();
    } catch (_) { }
    await new Promise(resolve => setTimeout(resolve, 120));
  }
  throw new Error(`A instância de teste não ficou disponível: ${url}. ${saidas.get(filho) || ''}`);
}

async function parar(filho) {
  if (!filho || filho.exitCode !== null) return;
  await new Promise(resolve => {
    const fim = setTimeout(resolve, 4000);
    filho.once('exit', () => { clearTimeout(fim); resolve(); });
    filho.kill();
  });
}

async function fechar(codigo = 0) {
  if (aFechar) return;
  aFechar = true;
  for (const filho of [...processos].reverse()) await parar(filho);
  process.exitCode = codigo;
}

async function pedido(base, rota, opcoes = {}) {
  const headers = { ...(opcoes.headers || {}) };
  if (opcoes.metodo && opcoes.metodo !== 'GET') {
    headers['Content-Type'] = 'application/json';
    headers['X-BXB'] = '1';
    if (opcoes.origem !== false && !headers.Origin) headers.Origin = base;
  }
  if (opcoes.cookie) headers.Cookie = opcoes.cookie;
  if (opcoes.chave) headers.Authorization = 'Bearer ' + opcoes.chave;
  const resposta = await fetch(base + rota, {
    method: opcoes.metodo || 'GET', headers,
    body: opcoes.corpo ? JSON.stringify(opcoes.corpo) : undefined,
    signal: AbortSignal.timeout(12000),
  });
  const texto = await resposta.text();
  let json;
  try { json = JSON.parse(texto); } catch (_) { json = texto; }
  return { estado: resposta.status, json, cookie: resposta.headers.get('set-cookie')?.split(';')[0] };
}

function ok(condicao, texto) {
  assert(condicao, texto);
  verificacoes++;
}

async function exigir(resposta, estado, texto) {
  ok(resposta.estado === estado, `${texto}: HTTP ${resposta.estado} (${typeof resposta.json === 'object' ? resposta.json.erro || '' : ''})`);
  return resposta;
}

async function pedidoHost(host) {
  return await new Promise((resolve, reject) => {
    const req = http.get(painel + '/api/saude', { headers: { Host: host } }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
    req.on('error', reject);
  });
}

async function verificarIntegracao() {
  const palavra = () => crypto.randomBytes(18).toString('base64url');
  const chave = fs.readFileSync(path.join(dadosBackoffice, 'backoffice.chave'), 'utf8').trim();
  const emailAdmin = 'operador.inicial@example.test';
  const palavraAdmin = palavra();
  const clienteSentinela = 'cliente-sentinela-' + crypto.randomBytes(8).toString('hex');
  const emailCliente = clienteSentinela + '@example.test';

  await exigir(await pedido(painel, '/api/quem'), 401, 'Bloqueio sem sessão');
  ok(await pedidoHost('host-nao-autorizado.example') === 403, 'Recusa de Host externo');
  const bootstrapLivre = await pedido(painel, '/api/configurar', { metodo: 'POST', corpo: { nome: 'Intruso', email: 'intruso@example.test', palavra: palavra() } });
  ok([401, 403].includes(bootstrapLivre.estado), 'O primeiro administrador exige bilhete do Gestor');

  const bilhete = await exigir(await pedido(painel, '/api/bilhete', { metodo: 'POST', origem: false, chave, corpo: {} }), 200, 'Bilhete do Gestor');
  const abrir = await exigir(await pedido(painel, '/api/entrar', { metodo: 'POST', corpo: { bilhete: bilhete.json.bilhete } }), 200, 'Abertura do bilhete');
  ok(!!abrir.cookie, 'Sessão de inicialização');
  const repetir = await pedido(painel, '/api/entrar', { metodo: 'POST', corpo: { bilhete: bilhete.json.bilhete } });
  ok([401, 403].includes(repetir.estado), 'O bilhete só pode ser usado uma vez');
  await exigir(await pedido(painel, '/api/configurar', { metodo: 'POST', cookie: abrir.cookie, corpo: { nome: 'Operador de teste', email: emailAdmin, palavra: palavraAdmin } }), 200, 'Criação do primeiro Administrador');
  const login = await exigir(await pedido(painel, '/api/entrar', { metodo: 'POST', corpo: { email: emailAdmin, palavra: palavraAdmin } }), 200, 'Login próprio do back-office');
  const cookie = login.cookie;
  const quem = await exigir(await pedido(painel, '/api/quem', { cookie }), 200, 'Identificação do operador');
  ok(quem.json.administrador === true && quem.json.acessos.length === 6, 'Perfil Administrador completo');
  const lista = await exigir(await pedido(painel, '/api/operadores', { cookie }), 200, 'Lista de operadores e perfis');
  const administrador = lista.json.perfis.find(p => p.sistema && p.nome === 'Administrador');
  ok(!!administrador && lista.json.utilizadores[0].perfilId === administrador.id, 'Administrador atribuído por perfil');
  const idAdmin = lista.json.utilizadores[0].id;

  for (const corpo of [{ id: administrador.id, nome: 'Outro nome', acessos: administrador.acessos }, { id: administrador.id, nome: administrador.nome, acessos: ['painel'] }]) {
    const mudar = await pedido(painel, '/api/perfis', { metodo: 'POST', cookie, corpo });
    ok([400, 403, 409].includes(mudar.estado), 'O perfil do sistema não pode ser alterado');
  }
  const apagarPerfil = await pedido(painel, '/api/perfis/' + encodeURIComponent(administrador.id), { metodo: 'DELETE', cookie });
  ok([400, 403, 409].includes(apagarPerfil.estado), 'O perfil do sistema não pode ser apagado');
  const desativar = await pedido(painel, '/api/operadores', { metodo: 'POST', cookie, corpo: { id: idAdmin, nome: 'Operador de teste', email: emailAdmin, perfilId: administrador.id, ativo: false } });
  ok([400, 403, 409].includes(desativar.estado), 'Proteção do último Administrador ativo');
  const apagarAdmin = await pedido(painel, '/api/operadores/' + encodeURIComponent(idAdmin), { metodo: 'DELETE', cookie });
  ok([400, 403, 409].includes(apagarAdmin.estado), 'O último Administrador não pode ser apagado');

  const novoPerfil = await exigir(await pedido(painel, '/api/perfis', { metodo: 'POST', cookie, corpo: { nome: 'Consulta de teste', acessos: ['painel', 'operadores'] } }), 200, 'Criação de perfil');
  const perfisDepois = (await pedido(painel, '/api/operadores', { cookie })).json.perfis;
  const perfilConsulta = perfisDepois.find(p => p.nome === 'Consulta de teste');
  ok(!!perfilConsulta, 'Perfil criado disponível');
  const palavraConsulta = palavra();
  await exigir(await pedido(painel, '/api/operadores', { metodo: 'POST', cookie, corpo: { nome: 'Operador de consulta', email: 'consulta@example.test', palavra: palavraConsulta, perfilId: perfilConsulta.id, ativo: true } }), 200, 'Utilizador com perfil escolhido');
  const consultaLogin = await exigir(await pedido(painel, '/api/entrar', { metodo: 'POST', corpo: { email: 'consulta@example.test', palavra: palavraConsulta } }), 200, 'Entrada com perfil limitado');
  const cookieConsulta = consultaLogin.cookie;
  await exigir(await pedido(painel, '/api/email', { cookie: cookieConsulta }), 403, 'Permissões verificadas no servidor');
  await exigir(await pedido(painel, '/api/perfis', { metodo: 'POST', cookie: cookieConsulta, corpo: { nome: 'Escalada', acessos: ['painel'] } }), 403, 'Só o Administrador gere perfis');
  await exigir(await pedido(painel, '/api/operadores', { metodo: 'POST', cookie: cookieConsulta, corpo: { nome: 'Escalada', email: 'escalada@example.test', palavra: palavra(), perfilId: administrador.id } }), 403, 'Só o Administrador gere operadores');
  await exigir(await pedido(painel, '/api/definicoes', { metodo: 'POST', cookie, headers: { Origin: 'https://origem-externa.example' }, corpo: { nome: 'Inválido' } }), 403, 'Proteção contra origem externa');

  // O site de teste é configurado pela sua API pública; os restantes clientes
  // são criados em /api/registar, da mesma forma que um visitante.
  await exigir(await pedido(site, '/api/configurar', { metodo: 'POST', corpo: { nome: 'Responsável do site de teste', email: 'responsavel.site@example.test', palavra: palavra() } }), 200, 'Inicialização pública do site fictício');
  const registar = await exigir(await pedido(site, '/api/registar', { metodo: 'POST', corpo: { nome: clienteSentinela, email: emailCliente, palavra: palavra(), tipo: 'particular' } }), 200, 'Cliente fictício criado por /api/registar');
  const contas = await exigir(await pedido(painel, '/api/utilizadores', { cookie }), 200, 'Consulta de clientes pela API');
  const cliente = contas.json.contas.find(c => c.email === emailCliente);
  ok(!!cliente, 'Cliente fictício aparece apenas na resposta de consulta');
  await exigir(await pedido(painel, '/api/utilizadores/' + encodeURIComponent(cliente.id), { cookie }), 200, 'Detalhe do cliente em leitura');
  for (const rota of ['/api/utilizadores/' + cliente.id, '/api/email']) {
    const alterar = await pedido(painel, rota, { metodo: 'POST', cookie, corpo: { ativo: false, palavra: palavra() } });
    ok([404, 405].includes(alterar.estado), 'Sem operações de alteração do sistema do cliente');
  }
  for (const rota of ['/api/painel', '/api/email', '/api/emails', '/api/registos?limite=2', '/api/consola', '/api/rede', '/api/definicoes', '/api/auditoria', '/api/estatisticas']) {
    await exigir(await pedido(painel, rota, { cookie }), 200, 'Consulta ' + rota.split('?')[0]);
  }
  await exigir(await pedido(painel, '/api/definicoes', { metodo: 'POST', cookie, corpo: { nome: 'dinmeta Back-office' } }), 200, 'Preferências próprias do back-office');

  // A base de dados própria pode ser inspeccionada; a base do cliente nunca é aberta.
  const bd = new DatabaseSync(path.join(dadosBackoffice, 'backoffice.db'), { readOnly: true });
  try {
    const tabelas = bd.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
    for (const { name } of tabelas) {
      const conteudo = JSON.stringify(bd.prepare('SELECT * FROM "' + name.replace(/"/g, '""') + '"').all());
      ok(!conteudo.includes(clienteSentinela) && !conteudo.includes(emailCliente) && !conteudo.includes(cliente.id), 'Nenhum dado pessoal de clientes persistido em ' + name);
    }
  } finally { bd.close(); }

  // A sessão e a configuração mantêm-se após reiniciar só o back-office.
  await parar(processoBackoffice);
  processoBackoffice = arrancar('backoffice/servidor-backoffice.js', 'Back-office');
  await esperar(painel + '/api/saude', processoBackoffice);
  await exigir(await pedido(painel, '/api/quem', { cookie }), 200, 'Sessão persistente após reinício');
  const bilhete2 = (await pedido(painel, '/api/bilhete', { metodo: 'POST', origem: false, chave, corpo: {} })).json.bilhete;
  const acessoGestor = await exigir(await pedido(painel, '/api/entrar', { metodo: 'POST', corpo: { bilhete: bilhete2 } }), 200, 'Acesso automático pelo Gestor após configuração');
  const identidadeGestor = await pedido(painel, '/api/quem', { cookie: acessoGestor.cookie });
  ok(identidadeGestor.json.administrador && identidadeGestor.json.viaGestor, 'Origem do acesso local do Gestor identificada');

  await parar(processoSite);
  const desligado = await pedido(painel, '/api/painel', { cookie });
  ok(desligado.estado === 503 && /servidor do site desligado/i.test(desligado.json.erro), 'Site desligado apresentado sem confusão com o login');
  await exigir(await pedido(painel, '/api/operadores', { cookie }), 200, 'Operadores continuam disponíveis com o site desligado');
  processoSite = arrancar('servidor.js', 'Site');
  await esperar(consulta + '/v1/saude', processoSite);
  await exigir(await pedido(painel, '/api/painel', { cookie }), 200, 'Consulta recupera quando o site volta');
  console.log(`Integração concluída: ${verificacoes} verificações aprovadas.`);
}

async function principal() {
  confirmarPasta(dadosSite); confirmarPasta(dadosBackoffice);
  for (const porta of [8890, 8891, 8892, 8897, 8898]) await portaLivre(porta);
  fs.mkdirSync(dadosSite, { recursive: true });
  fs.mkdirSync(dadosBackoffice, { recursive: true });
  processoSite = arrancar('servidor.js', 'Site');
  processoBackoffice = arrancar('backoffice/servidor-backoffice.js', 'Back-office');
  await esperar(consulta + '/v1/saude', processoSite);
  await esperar(painel + '/api/saude', processoBackoffice);
  console.log('Instâncias de teste isoladas disponíveis.');
  console.log(`Site: ${site}/`);
  console.log(`API de consulta: ${consulta}/v1/saude`);
  console.log(`Back-office: ${painel}/`);
  console.log(`BXB_DADOS=${dadosSite}`);
  console.log(`BXB_DADOS_BACKOFFICE=${dadosBackoffice}`);
  if (verificar) await verificarIntegracao();
  if (usarGestor) {
    const executavel = path.join(raiz, 'gestor', 'BXB Gestor.exe');
    if (process.platform !== 'win32' || !fs.existsSync(executavel)) throw new Error('Compile primeiro gestor/compilar.bat --teste no Windows.');
    const gestor = spawn(executavel, ['--bandeja'], { cwd: raiz, env: ambiente, windowsHide: true, stdio: 'ignore' });
    processos.add(gestor); gestor.once('exit', () => processos.delete(gestor));
    await new Promise((resolve, reject) => { gestor.once('spawn', resolve); gestor.once('error', reject); });
    console.log('Gestor de TESTE aberto na bandeja, sem alterar o arranque com o Windows.');
  }
  if (verificar && !manter) return await fechar();
  console.log('As credenciais de teste não são publicadas. Abra o Gestor com estas variáveis para usar um bilhete. Ctrl+C termina só estes processos.');
}

process.once('SIGINT', () => fechar());
process.once('SIGTERM', () => fechar());
principal().catch(async erro => { console.error('Falha nos testes: ' + erro.message); await fechar(1); });
