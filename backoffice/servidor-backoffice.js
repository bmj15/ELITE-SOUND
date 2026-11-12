'use strict';

// Servidor independente: os dados do site passam exclusivamente pela API de consulta.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const { DatabaseSync } = require('node:sqlite');
const { criarCloudflare, ErroCloudflare } = require('./cloudflare');
const { criarConector } = require('./conector-cloudflare');
const { criarVerificadorAccess, ErroAccess } = require('./access-cloudflare');

const scrypt = promisify(crypto.scrypt);
const RAIZ = path.resolve(__dirname, '..');
const ARRANQUE = Date.now();
const ACESSOS = Object.freeze(['painel', 'utilizadores', 'email', 'registos', 'definicoes', 'operadores']);
const PERFIL_ADMINISTRADOR = 'administrador-sistema';
const NOME_ADMINISTRADOR = 'Administrador';
const COOKIE = 'bxb_backoffice';
const DURACAO_SESSAO = 8 * 60 * 60 * 1000;
const DURACAO_BILHETE = 60 * 1000;
const LIMITE_CORPO = 24 * 1024;
const LIMITE_RESPOSTA = 8 * 1024 * 1024;
const tiposEstaticos = Object.freeze({
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/painel.js': ['painel.js', 'text/javascript; charset=utf-8'],
  '/estilo.css': ['estilo.css', 'text/css; charset=utf-8'],
  '/dinmeta.svg': ['dinmeta.svg', 'image/svg+xml; charset=utf-8'],
});

function porta(valor, alternativa, nome) {
  const texto = valor === undefined || valor === '' ? String(alternativa) : valor;
  if (!/^\d{1,5}$/.test(texto) || Number(texto) < 1 || Number(texto) > 65535) {
    throw new Error(`${nome} tem de ser uma porta entre 1 e 65535.`);
  }
  return Number(texto);
}

const PORTA = porta(process.env.PORT_BACKOFFICE, 8100, 'PORT_BACKOFFICE');
const PORTA_CONSULTA = porta(process.env.PORT_CONSULTA, 8097, 'PORT_CONSULTA');
if (PORTA === 8099 || PORTA_CONSULTA === 8099 || PORTA === PORTA_CONSULTA) {
  throw new Error('As portas do back-office e da consulta têm de ser distintas e próprias.');
}
const DADOS = path.resolve(process.env.BXB_DADOS_BACKOFFICE || path.join(RAIZ, '..', '..', 'DADOS-BACKOFFICE'));
const DADOS_SITE = path.resolve(process.env.BXB_DADOS || path.join(RAIZ, '..', '..', 'DADOS-SERVIDOR'));
const CHAVE_CONSULTA = path.join(DADOS_SITE, 'consulta.chave');

// Impede que uma configuração errada coloque a nossa base na pasta do site.
function sobrepoe(a, b) {
  const relativo = path.relative(a, b);
  return relativo === '' || (!relativo.startsWith(`..${path.sep}`) && relativo !== '..' && !path.isAbsolute(relativo));
}
if (sobrepoe(DADOS_SITE, DADOS) || sobrepoe(DADOS, DADOS_SITE) || sobrepoe(RAIZ, DADOS)) {
  throw new Error('BXB_DADOS_BACKOFFICE tem de ficar fora do repositório e separado de BXB_DADOS.');
}
fs.mkdirSync(DADOS, { recursive: true, mode: 0o700 });

function lerChaveFicheiro(ficheiro) {
  const valor = fs.readFileSync(ficheiro, 'utf8').trim();
  if (!/^[a-f0-9]{64}$/i.test(valor)) throw new Error('O ficheiro de chave não é válido.');
  return valor;
}

const ficheiroChave = path.join(DADOS, 'backoffice.chave');
try {
  fs.writeFileSync(ficheiroChave, crypto.randomBytes(32).toString('hex'), { flag: 'wx', mode: 0o600 });
} catch (erro) {
  if (erro.code !== 'EEXIST') throw erro;
}
const chaveBackoffice = lerChaveFicheiro(ficheiroChave);
const chaveSessao = crypto.createHmac('sha256', chaveBackoffice).update('bxb-backoffice:sessoes:v1').digest();
let chaveConsulta = null;

const bd = new DatabaseSync(path.join(DADOS, 'backoffice.db'));
bd.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 5000;
  CREATE TABLE IF NOT EXISTS perfis (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL COLLATE NOCASE UNIQUE,
    acessos TEXT NOT NULL,
    sistema INTEGER NOT NULL DEFAULT 0 CHECK (sistema IN (0, 1)),
    criado_em TEXT NOT NULL,
    alterado_em TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS utilizadores (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    palavra_hash TEXT NOT NULL,
    palavra_sal TEXT NOT NULL,
    perfil_id TEXT NOT NULL REFERENCES perfis(id) ON DELETE RESTRICT,
    ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
    criado_em TEXT NOT NULL,
    alterado_em TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessoes (
    id_hash TEXT PRIMARY KEY,
    utilizador_id TEXT REFERENCES utilizadores(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN ('inicializacao', 'entrada', 'utilizador')),
    via_gestor INTEGER NOT NULL DEFAULT 0 CHECK (via_gestor IN (0, 1)),
    criada_em INTEGER NOT NULL,
    visto_em INTEGER NOT NULL,
    expira INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sessoes_expira ON sessoes(expira);
  CREATE TABLE IF NOT EXISTS bilhetes (id_hash TEXT PRIMARY KEY, expira INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS auditoria (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    em TEXT NOT NULL,
    utilizador_id TEXT,
    nome TEXT,
    acao TEXT NOT NULL,
    alvo TEXT,
    resultado TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS auditoria_em ON auditoria(em);
  CREATE TABLE IF NOT EXISTS definicoes (chave TEXT PRIMARY KEY, valor TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS estatisticas_diarias (dia TEXT PRIMARY KEY, numeros TEXT NOT NULL);
`);
if (!bd.prepare('PRAGMA table_info(sessoes)').all().some((coluna) => coluna.name === 'via_gestor')) {
  bd.exec('ALTER TABLE sessoes ADD COLUMN via_gestor INTEGER NOT NULL DEFAULT 0');
}
const agoraIso = () => new Date().toISOString();
bd.prepare('INSERT OR IGNORE INTO perfis (id,nome,acessos,sistema,criado_em,alterado_em) VALUES (?,?,?,?,?,?)')
  .run(PERFIL_ADMINISTRADOR, NOME_ADMINISTRADOR, JSON.stringify(ACESSOS), 1, agoraIso(), agoraIso());
// O perfil de sistema tem sempre os acessos definidos no código, mesmo após uma atualização.
bd.prepare('UPDATE perfis SET nome=?,acessos=?,sistema=1 WHERE id=?')
  .run(NOME_ADMINISTRADOR, JSON.stringify(ACESSOS), PERFIL_ADMINISTRADOR);
bd.prepare('INSERT OR IGNORE INTO definicoes (chave,valor) VALUES (?,?)').run('nome', 'dinmeta Back-office');
const verificadorAccess = criarVerificadorAccess();
const cloudflare = criarCloudflare({
  pastaDados: DADOS, chaveBackoffice, conector: criarConector({ pastaDados: DADOS }),
  portaBackoffice: PORTA, portasProtegidas: [PORTA, PORTA_CONSULTA],
  resolverOrigem: () => pedirConsulta('/v1/saude'),
  validarProtecaoAccess: acesso => Boolean(acesso?.hostname && acesso?.issuer && acesso?.aud && acesso?.emails?.length && typeof verificadorAccess.verificar === 'function'),
});

class ErroPedido extends Error {
  constructor(estado, mensagem) {
    super(mensagem);
    this.estado = estado;
  }
}
const falha = (estado, mensagem) => { throw new ErroPedido(estado, mensagem); };
const hash = (valor) => crypto.createHash('sha256').update(valor).digest('hex');
const contarUtilizadores = () => Number(bd.prepare('SELECT count(*) AS total FROM utilizadores').get().total);
const configurado = () => contarUtilizadores() > 0;
const nomeBackoffice = () => bd.prepare("SELECT valor FROM definicoes WHERE chave='nome'").get().valor;

function constanteIgual(a, b) {
  const primeiro = Buffer.from(String(a || ''), 'utf8');
  const segundo = Buffer.from(String(b || ''), 'utf8');
  return primeiro.length === segundo.length && crypto.timingSafeEqual(primeiro, segundo);
}

function registar(ator, acao, alvo = null, resultado = 'ok') {
  // Apenas ações e identidades do back-office: nunca dados de contas do site.
  bd.prepare('INSERT INTO auditoria (em,utilizador_id,nome,acao,alvo,resultado) VALUES (?,?,?,?,?,?)')
    .run(agoraIso(), ator?.id || null, ator?.nome || null, acao, alvo, resultado);
}

function transacao(funcao) {
  bd.exec('BEGIN IMMEDIATE');
  try {
    const resultado = funcao();
    bd.exec('COMMIT');
    return resultado;
  } catch (erro) {
    bd.exec('ROLLBACK');
    throw erro;
  }
}

function cabecalhos(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; object-src 'none'");
  res.setHeader('Cache-Control', 'no-store');
}

function responder(res, estado, dados) {
  if (res.writableEnded || res.destroyed) return;
  const corpo = JSON.stringify(dados);
  res.writeHead(estado, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(corpo) });
  res.end(corpo);
}

async function validarHost(req) {
  const host = req.headers.host;
  if (typeof host !== 'string' || !host || /[\s\\/@#?]/.test(host)) falha(403, 'Host não permitido.');
  let endereco;
  try { endereco = new URL(`http://${host}`); } catch { falha(403, 'Host não permitido.'); }
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(endereco.hostname.toLowerCase());
  const proxy = ['cf-access-jwt-assertion', 'cf-connecting-ip', 'x-forwarded-host', 'x-forwarded-proto', 'forwarded'].some(h => req.headers[h] !== undefined);
  req.bxbRemoto = !local || proxy;
  if (local && !proxy) {
    if (Number(endereco.port || 80) !== PORTA || endereco.pathname !== '/') falha(403, 'Host não permitido.');
    return endereco.origin;
  }
  const acesso = cloudflare.configAccess();
  if (!acesso || endereco.hostname.toLowerCase() !== acesso.hostname || (endereco.port && endereco.port !== '443') || endereco.pathname !== '/') falha(403, 'Este endereço de gestão não está autorizado.');
  // Cabeçalhos de proxy nunca são prova de identidade. A assinatura JWT é obrigatória.
  await verificadorAccess.verificar(req.headers['cf-access-jwt-assertion'], acesso);
  return 'https://' + acesso.hostname;
}

function validarOrigin(req, origemEsperada, permitirAusente = false) {
  const origem = req.headers.origin;
  if (origem === undefined && permitirAusente) return;
  if (typeof origem !== 'string' || origem !== origemEsperada) falha(403, 'Origem não permitida.');
  const destino = req.headers['sec-fetch-site'];
  if (destino && destino !== 'same-origin' && destino !== 'none') falha(403, 'Origem não permitida.');
}

function validarMutacao(req, origem, maquina = false) {
  validarOrigin(req, origem, maquina);
  if (req.headers['x-bxb'] !== '1') falha(403, 'Pedido sem proteção CSRF.');
}

function autenticarMaquina(req) {
  const autorizacao = req.headers.authorization;
  if (typeof autorizacao !== 'string' || !autorizacao.startsWith('Bearer ') ||
      !constanteIgual(autorizacao.slice(7), chaveBackoffice)) falha(401, 'Chave do back-office inválida.');
}

async function lerCorpo(req) {
  const tipo = String(req.headers['content-type'] || '').split(';', 1)[0].trim().toLowerCase();
  if (tipo !== 'application/json') falha(415, 'O pedido tem de usar JSON.');
  if (req.headers['content-encoding'] && req.headers['content-encoding'] !== 'identity') falha(415, 'Compressão de pedidos não permitida.');
  const comprimento = req.headers['content-length'];
  if (comprimento && (!/^\d+$/.test(comprimento) || Number(comprimento) > LIMITE_CORPO)) falha(413, 'Pedido demasiado grande.');
  let tamanho = 0;
  const partes = [];
  for await (const parte of req) {
    tamanho += parte.length;
    if (tamanho > LIMITE_CORPO) falha(413, 'Pedido demasiado grande.');
    partes.push(parte);
  }
  let corpo;
  try { corpo = JSON.parse(Buffer.concat(partes).toString('utf8')); } catch { falha(400, 'JSON inválido.'); }
  if (!corpo || Array.isArray(corpo) || typeof corpo !== 'object') falha(400, 'O pedido tem de ser um objeto JSON.');
  return corpo;
}

function campos(corpo, permitidos) {
  if (Object.keys(corpo).some((chave) => !permitidos.includes(chave))) falha(400, 'O pedido contém campos não permitidos.');
}

function texto(valor, nome, minimo = 1, maximo = 120) {
  if (typeof valor !== 'string') falha(400, `${nome} inválido.`);
  const limpo = valor.trim();
  if (limpo.length < minimo || limpo.length > maximo || /[\u0000-\u001f\u007f]/.test(limpo)) falha(400, `${nome} inválido.`);
  return limpo;
}

function emailValido(valor) {
  const email = texto(valor, 'Email', 3, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) falha(400, 'Email inválido.');
  return email;
}

function palavraValida(valor) {
  if (typeof valor !== 'string' || valor.length < 12 || valor.length > 128 || Buffer.byteLength(valor) > 512 || /[\u0000\r\n]/.test(valor)) {
    falha(400, 'A palavra-passe tem de ter entre 12 e 128 caracteres.');
  }
  return valor;
}

let operacoesScrypt = 0;
async function derivarPalavra(palavra, sal) {
  if (operacoesScrypt >= 8) falha(429, 'Demasiadas tentativas. Aguarde um momento.');
  operacoesScrypt += 1;
  try {
    return (await scrypt(palavra, Buffer.from(sal, 'hex'), 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 })).toString('hex');
  } finally { operacoesScrypt -= 1; }
}

async function prepararPalavra(palavra) {
  palavraValida(palavra);
  const sal = crypto.randomBytes(32).toString('hex');
  return { sal, hash: await derivarPalavra(palavra, sal) };
}

const tentativas = new Map();
function limitar(chave, maximo = 8, intervalo = 15 * 60 * 1000) {
  const agora = Date.now();
  let entrada = tentativas.get(chave);
  if (!entrada || entrada.fim <= agora) {
    entrada = { vezes: 0, fim: agora + intervalo };
    if (tentativas.size >= 2000) {
      for (const [id, item] of tentativas) if (item.fim <= agora) tentativas.delete(id);
      if (tentativas.size >= 2000) tentativas.delete(tentativas.keys().next().value);
    }
    tentativas.set(chave, entrada);
  }
  if (entrada.vezes >= maximo) falha(429, 'Demasiadas tentativas. Aguarde antes de voltar a tentar.');
  entrada.vezes += 1;
}

function assinarSessao(id) {
  return crypto.createHmac('sha256', chaveSessao).update(id).digest('base64url');
}

function obterCookie(req) {
  const valor = req.headers.cookie;
  if (!valor || valor.length > 8192) return null;
  const encontrados = valor.split(';').map((item) => item.trim()).filter((item) => item.startsWith(`${COOKIE}=`));
  if (encontrados.length !== 1) return null;
  const token = encontrados[0].slice(COOKIE.length + 1);
  const partes = token.split('.');
  if (partes.length !== 2 || !/^[a-f0-9]{64}$/.test(partes[0]) || !/^[a-zA-Z0-9_-]{43}$/.test(partes[1])) return null;
  return constanteIgual(assinarSessao(partes[0]), partes[1]) ? partes[0] : null;
}

function sessaoAtual(req) {
  const token = obterCookie(req);
  if (!token) return null;
  const idHash = hash(token);
  const sessao = bd.prepare('SELECT * FROM sessoes WHERE id_hash=?').get(idHash);
  if (!sessao) return null;
  if (sessao.expira <= Date.now() || (sessao.tipo === 'inicializacao' && configurado())) {
    bd.prepare('DELETE FROM sessoes WHERE id_hash=?').run(idHash);
    return null;
  }
  if (sessao.tipo !== 'utilizador') return { sessao, inicializar: sessao.tipo === 'inicializacao', viaGestor: Boolean(sessao.via_gestor) };
  const utilizador = bd.prepare(`SELECT u.id,u.nome,u.email,u.ativo,u.perfil_id,p.nome AS perfil_nome,p.acessos,p.sistema
    FROM utilizadores u JOIN perfis p ON p.id=u.perfil_id WHERE u.id=?`).get(sessao.utilizador_id);
  if (!utilizador || !utilizador.ativo) {
    bd.prepare('DELETE FROM sessoes WHERE id_hash=?').run(idHash);
    return null;
  }
  const administrador = utilizador.perfil_id === PERFIL_ADMINISTRADOR;
  if (Date.now() - sessao.visto_em > 60000) bd.prepare('UPDATE sessoes SET visto_em=? WHERE id_hash=?').run(Date.now(), idHash);
  return {
    sessao, id: utilizador.id, nome: utilizador.nome, email: utilizador.email,
    perfil: { id: utilizador.perfil_id, nome: utilizador.perfil_nome, sistema: Boolean(utilizador.sistema) },
    acessos: administrador ? [...ACESSOS] : JSON.parse(utilizador.acessos), administrador, viaGestor: Boolean(sessao.via_gestor),
  };
}

function encerrarSessao(req, res) {
  const token = obterCookie(req);
  if (token) bd.prepare('DELETE FROM sessoes WHERE id_hash=?').run(hash(token));
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${req.bxbRemoto ? '; Secure' : ''}`);
}

function criarSessao(req, res, utilizadorId = null, tipo = 'utilizador', viaGestor = false) {
  const anterior = obterCookie(req);
  if (anterior) bd.prepare('DELETE FROM sessoes WHERE id_hash=?').run(hash(anterior));
  const token = crypto.randomBytes(32).toString('hex');
  const agora = Date.now();
  const duracao = tipo === 'utilizador' ? DURACAO_SESSAO : 10 * 60 * 1000;
  bd.prepare('INSERT INTO sessoes (id_hash,utilizador_id,tipo,via_gestor,criada_em,visto_em,expira) VALUES (?,?,?,?,?,?,?)')
    .run(hash(token), utilizadorId, tipo, viaGestor ? 1 : 0, agora, agora, agora + duracao);
  res.setHeader('Set-Cookie', `${COOKIE}=${token}.${assinarSessao(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(duracao / 1000)}${req.bxbRemoto ? '; Secure' : ''}`);
}

function exigirSessao(req, acesso = null, apenasAdministrador = false) {
  const ator = sessaoAtual(req);
  if (!ator?.id) falha(401, 'É necessário entrar no back-office.');
  if (apenasAdministrador && !ator.administrador) falha(403, 'Apenas o Administrador do sistema pode gerir utilizadores e perfis.');
  if (acesso && !ator.acessos.includes(acesso)) falha(403, 'O seu perfil não tem acesso a esta página.');
  return ator;
}

function quem(ator) {
  if (!ator?.id) return {
    id: null, nome: '', email: '', perfil: null, acessos: [], administrador: false,
    configurado: configurado(), inicializar: Boolean(ator?.inicializar), viaGestor: Boolean(ator?.viaGestor),
  };
  return {
    id: ator.id, nome: ator.nome, email: ator.email, perfil: ator.perfil, perfilId: ator.perfil.id,
    acessos: ator.acessos, administrador: ator.administrador, configurado: true, viaGestor: Boolean(ator.viaGestor),
  };
}

function perfilPublico(perfil) {
  return { id: perfil.id, nome: perfil.nome, acessos: perfil.id === PERFIL_ADMINISTRADOR ? [...ACESSOS] : JSON.parse(perfil.acessos), sistema: Boolean(perfil.sistema) };
}

function listaPerfis() {
  return bd.prepare('SELECT * FROM perfis ORDER BY sistema DESC,nome COLLATE NOCASE').all().map(perfilPublico);
}

function listaOperadores() {
  const perfis = listaPerfis();
  const porId = new Map(perfis.map((perfil) => [perfil.id, perfil]));
  return {
    utilizadores: bd.prepare('SELECT id,nome,email,ativo,perfil_id,criado_em,alterado_em FROM utilizadores ORDER BY nome COLLATE NOCASE').all().map((item) => ({
      id: item.id, nome: item.nome, email: item.email, ativo: Boolean(item.ativo), perfilId: item.perfil_id,
      perfil: porId.get(item.perfil_id), criada_em: item.criado_em, alterada_em: item.alterado_em,
    })),
    perfis, acessos: [...ACESSOS],
  };
}

function protegerUltimoAdministrador(id, perfilId, ativo) {
  const anterior = bd.prepare('SELECT perfil_id,ativo FROM utilizadores WHERE id=?').get(id);
  if (anterior?.perfil_id === PERFIL_ADMINISTRADOR && anterior.ativo && (perfilId !== PERFIL_ADMINISTRADOR || !ativo)) {
    const total = Number(bd.prepare('SELECT count(*) AS total FROM utilizadores WHERE perfil_id=? AND ativo=1').get(PERFIL_ADMINISTRADOR).total);
    if (total <= 1) falha(409, 'Não é possível retirar o último Administrador do sistema ativo.');
  }
}

function idValido(valor) {
  if (typeof valor !== 'string' || !/^[A-Za-z0-9_-]{1,160}$/.test(valor)) falha(400, 'Identificador inválido.');
  return valor;
}

function inteiro(valor, nome, minimo, maximo) {
  if (!/^\d+$/.test(valor) || Number(valor) < minimo || Number(valor) > maximo) falha(400, `${nome} inválido.`);
  return String(Number(valor));
}

function dataIso(valor, nome) {
  if (valor.length > 40 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(valor) || !Number.isFinite(Date.parse(valor))) falha(400, `${nome} inválido.`);
  return new Date(valor).toISOString();
}

function queryValidada(url, regras) {
  const resultado = new URLSearchParams();
  for (const [nome, valor] of url.searchParams) {
    if (!Object.hasOwn(regras, nome) || resultado.has(nome)) falha(400, 'Parâmetros de consulta inválidos.');
    resultado.set(nome, regras[nome](valor));
  }
  return resultado.toString();
}

const limite500 = (v) => inteiro(v, 'Limite', 1, 500);
const regrasRegisto = {
  acao: (v) => v === '' ? '' : texto(v, 'Ação', 1, 100),
  conta: (v) => v === '' ? '' : idValido(v),
  texto: (v) => v === '' ? '' : texto(v, 'Texto', 1, 200),
  leituras: (v) => inteiro(v, 'Leituras', 0, 1),
  antes: (v) => dataIso(v, 'Data'), limite: limite500,
};

function carregarChaveConsulta() {
  try { chaveConsulta = lerChaveFicheiro(CHAVE_CONSULTA); }
  catch { falha(503, 'servidor do site desligado'); }
  return chaveConsulta;
}

async function pedirConsulta(caminho, repetir = true) {
  const chave = chaveConsulta || carregarChaveConsulta();
  let resposta;
  try {
    // Não se propagam cookies, Origin, cabeçalhos nem credenciais do browser.
    resposta = await fetch(`http://127.0.0.1:${PORTA_CONSULTA}${caminho}`, {
      method: 'GET', headers: { Authorization: `Bearer ${chave}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(6000), redirect: 'error',
    });
  } catch { falha(503, 'servidor do site desligado'); }
  if (resposta.status === 401) {
    await resposta.body?.cancel();
    if (repetir) {
      carregarChaveConsulta();
      return pedirConsulta(caminho, false);
    }
    falha(502, 'A API de consulta recusou a chave. Verifique a ligação ao servidor do site.');
  }
  const comprimento = Number(resposta.headers.get('content-length') || 0);
  if (comprimento > LIMITE_RESPOSTA) {
    await resposta.body?.cancel();
    falha(502, 'A resposta do servidor do site é demasiado grande.');
  }
  let tamanho = 0;
  const partes = [];
  try {
    for await (const parte of resposta.body) {
      tamanho += parte.length;
      if (tamanho > LIMITE_RESPOSTA) {
        falha(502, 'A resposta do servidor do site é demasiado grande.');
      }
      partes.push(Buffer.from(parte));
    }
  } catch (erro) {
    if (erro instanceof ErroPedido) throw erro;
    falha(503, 'servidor do site desligado');
  }
  let dados;
  try { dados = JSON.parse(Buffer.concat(partes).toString('utf8')); }
  catch { falha(502, 'O servidor do site devolveu uma resposta inválida.'); }
  if (!dados || typeof dados !== 'object' || Array.isArray(dados)) falha(502, 'O servidor do site devolveu uma resposta inválida.');
  if (!resposta.ok) {
    const estado = [400, 403, 404, 405, 429, 503].includes(resposta.status) ? resposta.status : 502;
    falha(estado, typeof dados.erro === 'string' ? dados.erro.slice(0, 500) : 'Não foi possível consultar o servidor do site.');
  }
  return dados;
}

function numero(valor) {
  return typeof valor === 'number' && Number.isFinite(valor) && valor >= 0 ? Math.min(valor, Number.MAX_SAFE_INTEGER) : 0;
}

function guardarEstatisticas(painel) {
  const numeros = {
    contasTotal: numero(painel.contas?.total), contasAtivas: numero(painel.contas?.ativas),
    contasNovas30: numero(painel.contas?.novas30), sessoes: numero(painel.contas?.sessoes),
    areasParticular: numero(painel.areas?.particular), areasEmpresa: numero(painel.areas?.empresa),
    entradas7: numero(painel.entradas?.d7), falhadas7: numero(painel.entradas?.falhadas7),
    recusados7: numero(painel.entradas?.recusados7), emailsEnviados7: numero(painel.email?.enviados7),
    emailsFalhados7: numero(painel.email?.falhados7), memoria: numero(painel.servidor?.memoria), baseDados: numero(painel.servidor?.bd),
  };
  bd.prepare('INSERT INTO estatisticas_diarias (dia,numeros) VALUES (?,?) ON CONFLICT(dia) DO UPDATE SET numeros=excluded.numeros')
    .run(agoraIso().slice(0, 10), JSON.stringify(numeros));
}

function historico(dias = 30) {
  const inicio = new Date(Date.now() - (dias - 1) * 86400000).toISOString().slice(0, 10);
  return bd.prepare('SELECT dia,numeros FROM estatisticas_diarias WHERE dia>=? ORDER BY dia').all(inicio)
    .map((linha) => ({ dia: linha.dia, ...JSON.parse(linha.numeros) }));
}

function resumoBackoffice() {
  return {
    nome: nomeBackoffice(), utilizadores: contarUtilizadores(),
    perfis: Number(bd.prepare('SELECT count(*) AS total FROM perfis').get().total),
    sessoes: Number(bd.prepare("SELECT count(*) AS total FROM sessoes WHERE tipo='utilizador' AND expira>?").get(Date.now()).total),
  };
}

async function entrar(req, res, corpo) {
  campos(corpo, ['bilhete', 'email', 'palavra']);
  limitar(`entrar:${req.socket.remoteAddress}`, 40);
  if (Object.hasOwn(corpo, 'bilhete')) {
    if (req.bxbRemoto) falha(403, 'Os bilhetes do Gestor só podem ser usados neste computador.');
    if (Object.hasOwn(corpo, 'email') || Object.hasOwn(corpo, 'palavra')) falha(400, 'Escolha uma forma de entrada.');
    const bilhete = corpo.bilhete;
    if (typeof bilhete !== 'string' || !/^[a-f0-9]{64}$/.test(bilhete)) falha(401, 'Bilhete inválido ou expirado.');
    const encontrado = bd.prepare('DELETE FROM bilhetes WHERE id_hash=? RETURNING expira').get(hash(bilhete));
    if (!encontrado || encontrado.expira <= Date.now()) falha(401, 'Bilhete inválido ou expirado.');
    const inicializar = !configurado();
    if (inicializar) {
      criarSessao(req, res, null, 'inicializacao', true);
      registar(null, 'INICIALIZACAO_ABERTA', 'dinmeta Gestor / bilhete local');
      return responder(res, 200, quem({ inicializar: true, viaGestor: true }));
    }
    const administrador = bd.prepare(`SELECT u.id,u.nome,u.email,p.id AS perfil_id,p.nome AS perfil_nome,p.sistema
      FROM utilizadores u JOIN perfis p ON p.id=u.perfil_id
      WHERE u.ativo=1 AND p.id=? ORDER BY u.criado_em,u.id LIMIT 1`).get(PERFIL_ADMINISTRADOR);
    if (!administrador) falha(403, 'Não existe um Administrador do sistema ativo.');
    criarSessao(req, res, administrador.id, 'utilizador', true);
    registar(administrador, 'ENTRADA_GESTOR', 'dinmeta Gestor / bilhete local');
    return responder(res, 200, quem({
      ...administrador, perfil: { id: administrador.perfil_id, nome: administrador.perfil_nome, sistema: true },
      acessos: [...ACESSOS], administrador: true, viaGestor: true,
    }));
  }
  if (!configurado()) falha(403, 'Abra o back-office pelo dinmeta Gestor para criar o primeiro administrador.');
  const email = emailValido(corpo.email);
  if (typeof corpo.palavra !== 'string' || corpo.palavra.length > 128 || Buffer.byteLength(corpo.palavra) > 512) falha(401, 'Email ou palavra-passe incorretos.');
  limitar(`email:${hash(email)}`, 8);
  const utilizador = bd.prepare('SELECT * FROM utilizadores WHERE email=?').get(email);
  // O mesmo custo de derivação evita revelar se o endereço existe.
  const calculado = await derivarPalavra(corpo.palavra, utilizador?.palavra_sal || '00'.repeat(32));
  if (!utilizador || !utilizador.ativo || !constanteIgual(calculado, utilizador.palavra_hash)) {
    registar(null, 'ENTRADA_FALHADA', null, 'recusado');
    falha(401, 'Email ou palavra-passe incorretos.');
  }
  // Volta a consultar após a operação assíncrona: outro administrador pode ter alterado a conta.
  const atual = bd.prepare('SELECT * FROM utilizadores WHERE id=?').get(utilizador.id);
  if (!atual?.ativo || !constanteIgual(atual.palavra_hash, utilizador.palavra_hash)) falha(401, 'Email ou palavra-passe incorretos.');
  criarSessao(req, res, utilizador.id);
  tentativas.delete(`email:${hash(email)}`);
  registar(atual, 'ENTRADA');
  const perfil = bd.prepare('SELECT * FROM perfis WHERE id=?').get(atual.perfil_id);
  const publico = perfilPublico(perfil);
  responder(res, 200, quem({ ...atual, perfil: publico, acessos: publico.acessos, administrador: perfil.id === PERFIL_ADMINISTRADOR }));
}

async function configurar(req, res, corpo) {
  campos(corpo, ['nome', 'email', 'palavra']);
  const sessao = sessaoAtual(req);
  if (!sessao?.inicializar || configurado()) falha(403, 'A inicialização exige um bilhete válido do dinmeta Gestor.');
  limitar('configurar', 10);
  const nome = texto(corpo.nome, 'Nome', 2, 120);
  const email = emailValido(corpo.email);
  const credenciais = await prepararPalavra(corpo.palavra);
  const utilizador = { id: crypto.randomUUID(), nome, email };
  transacao(() => {
    const aindaValida = bd.prepare('SELECT expira,tipo FROM sessoes WHERE id_hash=?').get(sessao.sessao.id_hash);
    if (configurado() || !aindaValida || aindaValida.tipo !== 'inicializacao' || aindaValida.expira <= Date.now()) falha(409, 'O back-office já foi configurado ou o bilhete expirou.');
    bd.prepare('INSERT INTO utilizadores (id,nome,email,palavra_hash,palavra_sal,perfil_id,ativo,criado_em,alterado_em) VALUES (?,?,?,?,?,?,1,?,?)')
      .run(utilizador.id, nome, email, credenciais.hash, credenciais.sal, PERFIL_ADMINISTRADOR, agoraIso(), agoraIso());
    bd.prepare("DELETE FROM sessoes WHERE tipo IN ('inicializacao','entrada')").run();
    bd.prepare('DELETE FROM bilhetes').run();
    registar(utilizador, 'CONFIGURACAO_INICIAL');
  });
  criarSessao(req, res, utilizador.id, 'utilizador', true);
  responder(res, 200, quem({ ...utilizador, perfil: { id: PERFIL_ADMINISTRADOR, nome: NOME_ADMINISTRADOR, sistema: true }, acessos: [...ACESSOS], administrador: true, viaGestor: true }));
}

async function guardarOperador(req, res, corpo, ator) {
  campos(corpo, ['id', 'nome', 'email', 'palavra', 'perfilId', 'ativo']);
  const id = corpo.id === undefined ? crypto.randomUUID() : idValido(corpo.id);
  const novo = corpo.id === undefined;
  const nome = texto(corpo.nome, 'Nome', 2, 120);
  const email = emailValido(corpo.email);
  const perfilId = idValido(corpo.perfilId);
  if (typeof corpo.ativo !== 'boolean') falha(400, 'Indique se o utilizador está ativo.');
  const ativo = corpo.ativo ? 1 : 0;
  let credenciais = null;
  if (novo || (corpo.palavra !== undefined && corpo.palavra !== '')) credenciais = await prepararPalavra(corpo.palavra);
  transacao(() => {
    // Revalida a autorização depois de calcular a palavra-passe.
    exigirSessao(req, 'operadores', true);
    if (!bd.prepare('SELECT id FROM perfis WHERE id=?').get(perfilId)) falha(400, 'O perfil escolhido não existe.');
    const anterior = bd.prepare('SELECT * FROM utilizadores WHERE id=?').get(id);
    if (!novo && !anterior) falha(404, 'Utilizador do back-office não encontrado.');
    if (bd.prepare('SELECT id FROM utilizadores WHERE email=? AND id<>?').get(email, id)) falha(409, 'Já existe um utilizador com este email.');
    protegerUltimoAdministrador(id, perfilId, ativo);
    if (novo) {
      bd.prepare('INSERT INTO utilizadores (id,nome,email,palavra_hash,palavra_sal,perfil_id,ativo,criado_em,alterado_em) VALUES (?,?,?,?,?,?,?,?,?)')
        .run(id, nome, email, credenciais.hash, credenciais.sal, perfilId, ativo, agoraIso(), agoraIso());
    } else {
      bd.prepare('UPDATE utilizadores SET nome=?,email=?,perfil_id=?,ativo=?,palavra_hash=?,palavra_sal=?,alterado_em=? WHERE id=?')
        .run(nome, email, perfilId, ativo, credenciais?.hash || anterior.palavra_hash, credenciais?.sal || anterior.palavra_sal, agoraIso(), id);
      if (credenciais || !ativo || anterior.perfil_id !== perfilId) bd.prepare('DELETE FROM sessoes WHERE utilizador_id=?').run(id);
    }
    registar(ator, novo ? 'UTILIZADOR_CRIADO' : 'UTILIZADOR_ALTERADO', id);
  });
  responder(res, 200, { ok: true, id });
}

function guardarPerfil(res, corpo, ator) {
  campos(corpo, ['id', 'nome', 'acessos']);
  const novo = corpo.id === undefined;
  const id = novo ? crypto.randomUUID() : idValido(corpo.id);
  const nome = texto(corpo.nome, 'Nome do perfil', 2, 80);
  if (id === PERFIL_ADMINISTRADOR) falha(403, 'O perfil Administrador do sistema é imutável.');
  if (nome.toLocaleLowerCase('pt-PT') === NOME_ADMINISTRADOR.toLocaleLowerCase('pt-PT')) falha(409, 'Este nome está reservado ao perfil de sistema.');
  if (!Array.isArray(corpo.acessos) || corpo.acessos.length > ACESSOS.length || corpo.acessos.some((a) => typeof a !== 'string' || !ACESSOS.includes(a))) falha(400, 'Acessos do perfil inválidos.');
  if (new Set(corpo.acessos).size !== corpo.acessos.length) falha(400, 'Os acessos do perfil não podem repetir-se.');
  const acessos = ACESSOS.filter((a) => corpo.acessos.includes(a));
  transacao(() => {
    const anterior = bd.prepare('SELECT sistema FROM perfis WHERE id=?').get(id);
    if (!novo && !anterior) falha(404, 'Perfil não encontrado.');
    if (anterior?.sistema) falha(403, 'O perfil de sistema é imutável.');
    if (bd.prepare('SELECT id FROM perfis WHERE nome=? COLLATE NOCASE AND id<>?').get(nome, id)) falha(409, 'Já existe um perfil com este nome.');
    if (novo) bd.prepare('INSERT INTO perfis (id,nome,acessos,sistema,criado_em,alterado_em) VALUES (?,?,?,0,?,?)').run(id, nome, JSON.stringify(acessos), agoraIso(), agoraIso());
    else bd.prepare('UPDATE perfis SET nome=?,acessos=?,alterado_em=? WHERE id=?').run(nome, JSON.stringify(acessos), agoraIso(), id);
    registar(ator, novo ? 'PERFIL_CRIADO' : 'PERFIL_ALTERADO', id);
  });
  responder(res, 200, { ok: true, id });
}

let aDesligar = false;
let limpeza;
let recolha;
let aRecolher = false;

async function encaminhar(req, res) {
  cabecalhos(res);
  const origem = await validarHost(req);
  if (req.headers.origin !== undefined) validarOrigin(req, origem);
  if (!req.url || !req.url.startsWith('/') || req.url.startsWith('//') || req.url.length > 4096 || /[\u0000-\u0020\u007f]/.test(req.url)) falha(400, 'Endereço inválido.');
  const url = new URL(req.url, origem);
  const rota = url.pathname;
  const metodo = req.method;
  if (req.bxbRemoto && ['/api/bilhete', '/api/configurar', '/api/desligar'].includes(rota)) falha(403, 'Esta operação só é permitida localmente pelo Gestor.');
  if (metodo === 'GET' && rota === '/api/saude') {
    queryValidada(url, {});
    return responder(res, 200, { ok: true, servidor: 'bxb-backoffice', pid: process.pid, arranque: ARRANQUE, configurado: configurado(), portas: { backoffice: PORTA, consulta: PORTA_CONSULTA } });
  }
  if (metodo === 'POST' && ['/api/bilhete', '/api/desligar'].includes(rota)) {
    queryValidada(url, {});
    validarMutacao(req, origem, true);
    autenticarMaquina(req);
    if (rota === '/api/bilhete') {
      limitar('bilhetes', 60, 60000);
      const bilhete = crypto.randomBytes(32).toString('hex');
      bd.prepare('INSERT INTO bilhetes (id_hash,expira) VALUES (?,?)').run(hash(bilhete), Date.now() + DURACAO_BILHETE);
      return responder(res, 200, { bilhete });
    }
    responder(res, 200, { ok: true });
    return setImmediate(desligar);
  }
  if (metodo === 'POST' && rota === '/api/entrar') {
    queryValidada(url, {});
    validarMutacao(req, origem);
    return entrar(req, res, await lerCorpo(req));
  }
  if (metodo === 'GET' && rota === '/api/quem') {
    queryValidada(url, {});
    const ator = sessaoAtual(req);
    if (!ator) falha(401, 'É necessário entrar no back-office.');
    return responder(res, 200, quem(ator));
  }
  if (metodo === 'POST' && rota === '/api/configurar') {
    queryValidada(url, {});
    validarMutacao(req, origem);
    return configurar(req, res, await lerCorpo(req));
  }
  if (metodo === 'POST' && rota === '/api/sair') {
    queryValidada(url, {});
    validarMutacao(req, origem);
    const ator = sessaoAtual(req);
    encerrarSessao(req, res);
    if (ator?.id) registar(ator, 'SAIDA');
    return responder(res, 200, { ok: true });
  }
  if (metodo === 'GET' && Object.hasOwn(tiposEstaticos, rota)) {
    queryValidada(url, {});
    const [ficheiro, tipo] = tiposEstaticos[rota];
    let conteudo;
    try { conteudo = fs.readFileSync(path.join(__dirname, 'public', ficheiro)); }
    catch (erro) {
      if (erro.code === 'ENOENT') falha(404, 'O painel do back-office ainda não está instalado.');
      throw erro;
    }
    res.writeHead(200, { 'Content-Type': tipo, 'Content-Length': conteudo.length });
    return res.end(conteudo);
  }
  if (!rota.startsWith('/api/')) falha(404, 'Página não encontrada.');

  if (rota.startsWith('/api/cloudflare/')) {
    const ator = exigirSessao(req, 'definicoes', true);
    queryValidada(url, {});
    const contexto = { atorId: ator.id, autorizar: () => exigirSessao(req, 'definicoes', true) };
    if (metodo === 'GET' && rota === '/api/cloudflare/estado') return responder(res, 200, cloudflare.estado());
    if (metodo === 'GET' && rota === '/api/cloudflare/zonas') {
      const resultado = await cloudflare.zonas(); contexto.autorizar();
      return responder(res, 200, resultado);
    }
    const operacoes = {
      '/api/cloudflare/ligacao': [['token'], b => cloudflare.ligarAPI(b, contexto)],
      '/api/cloudflare/preparar': [['zonaId', 'hostname', 'hostnameGestao', 'emailsPermitidos'], b => cloudflare.preparar(b, contexto)],
      '/api/cloudflare/aplicar': [['planoId', 'confirmarZona'], b => cloudflare.aplicar(b, contexto)],
      '/api/cloudflare/conector/instalar': [[], () => cloudflare.instalar(contexto)],
      '/api/cloudflare/conector/ligar': [[], () => cloudflare.ligar(contexto)],
      '/api/cloudflare/conector/desligar': [[], () => cloudflare.desligar(contexto)],
    };
    if (metodo !== 'POST' || !Object.hasOwn(operacoes, rota)) falha(405, 'Operação Cloudflare não permitida.');
    validarMutacao(req, origem);
    limitar('cloudflare:' + ator.id, 120, 60000);
    const corpo = await lerCorpo(req), [permitidos, executar] = operacoes[rota];
    campos(corpo, permitidos); contexto.autorizar();
    const resultado = await executar(corpo); contexto.autorizar();
    registar(ator, 'CLOUDFLARE_' + rota.slice('/api/cloudflare/'.length).replaceAll('/', '_').toUpperCase(), 'Cloudflare');
    return responder(res, 200, resultado);
  }

  const mapa = {
    '/api/painel': ['painel', '/v1/painel', {}],
    '/api/utilizadores': ['utilizadores', '/v1/contas', {}],
    '/api/email': ['email', '/v1/email', {}],
    '/api/emails': ['email', '/v1/emails', { limite: (v) => inteiro(v, 'Limite', 1, 1000) }],
    '/api/registos': ['registos', '/v1/registo', regrasRegisto],
    '/api/consola': ['registos', '/v1/consola', { desde: (v) => dataIso(v, 'Data') }],
    '/api/rede': ['registos', '/v1/rede', { linhas: (v) => inteiro(v, 'Linhas', 1, 1000) }],
  };
  if (metodo === 'GET' && (Object.hasOwn(mapa, rota) || /^\/api\/utilizadores\/[^/]+$/.test(rota))) {
    const detalhe = !Object.hasOwn(mapa, rota);
    let destino;
    let acesso;
    let regras;
    if (detalhe) {
      let id;
      try { id = decodeURIComponent(rota.slice('/api/utilizadores/'.length)); } catch { falha(400, 'Identificador inválido.'); }
      idValido(id);
      destino = `/v1/contas/${encodeURIComponent(id)}`;
      acesso = 'utilizadores'; regras = { limite: limite500 };
    } else [acesso, destino, regras] = mapa[rota];
    const ator = exigirSessao(req, acesso);
    const consulta = queryValidada(url, regras);
    const dados = await pedirConsulta(destino + (consulta ? `?${consulta}` : ''));
    // A sessão ou o perfil podem ter mudado enquanto aguardávamos pelo site.
    exigirSessao(req, acesso);
    if (rota === '/api/painel') {
      guardarEstatisticas(dados);
      dados.backoffice = resumoBackoffice();
      dados.historico = historico();
    }
    registar(ator, 'CONSULTA', detalhe ? '/api/utilizadores/:id' : rota);
    return responder(res, 200, dados);
  }
  if (rota === '/api/definicoes') {
    const ator = exigirSessao(req, 'definicoes');
    queryValidada(url, {});
    if (metodo === 'GET') {
      try {
        const sistema = await pedirConsulta('/v1/definicoes');
        exigirSessao(req, 'definicoes');
        registar(ator, 'CONSULTA', rota);
        return responder(res, 200, { sistema, backoffice: { nome: nomeBackoffice() } });
      } catch (erro) {
        if (erro instanceof ErroPedido) return responder(res, erro.estado, { erro: erro.message, sistema: null, backoffice: { nome: nomeBackoffice() } });
        throw erro;
      }
    }
    if (metodo === 'POST') {
      validarMutacao(req, origem);
      const corpo = await lerCorpo(req);
      campos(corpo, ['nome']);
      const nome = texto(corpo.nome, 'Nome do back-office', 2, 120);
      exigirSessao(req, 'definicoes');
      transacao(() => {
        bd.prepare("UPDATE definicoes SET valor=? WHERE chave='nome'").run(nome);
        registar(ator, 'DEFINICOES_ALTERADAS', 'backoffice');
      });
      return responder(res, 200, { ok: true, backoffice: { nome } });
    }
  }
  if (rota === '/api/operadores' && ['GET', 'POST'].includes(metodo)) {
    const ator = exigirSessao(req, 'operadores', true);
    queryValidada(url, {});
    if (metodo === 'GET') return responder(res, 200, listaOperadores());
    validarMutacao(req, origem);
    return guardarOperador(req, res, await lerCorpo(req), ator);
  }
  if (/^\/api\/operadores\/[^/]+$/.test(rota) && metodo === 'DELETE') {
    const ator = exigirSessao(req, 'operadores', true);
    queryValidada(url, {});
    validarMutacao(req, origem);
    const id = idValido(rota.slice('/api/operadores/'.length));
    transacao(() => {
      if (!bd.prepare('SELECT id FROM utilizadores WHERE id=?').get(id)) falha(404, 'Utilizador do back-office não encontrado.');
      protegerUltimoAdministrador(id, null, 0);
      bd.prepare('DELETE FROM utilizadores WHERE id=?').run(id);
      registar(ator, 'UTILIZADOR_APAGADO', id);
    });
    return responder(res, 200, { ok: true });
  }
  if (rota === '/api/perfis' && metodo === 'POST') {
    const ator = exigirSessao(req, 'operadores', true);
    queryValidada(url, {});
    validarMutacao(req, origem);
    const corpo = await lerCorpo(req);
    exigirSessao(req, 'operadores', true);
    return guardarPerfil(res, corpo, ator);
  }
  if (/^\/api\/perfis\/[^/]+$/.test(rota) && metodo === 'DELETE') {
    const ator = exigirSessao(req, 'operadores', true);
    queryValidada(url, {});
    validarMutacao(req, origem);
    const id = idValido(rota.slice('/api/perfis/'.length));
    transacao(() => {
      const perfil = bd.prepare('SELECT sistema FROM perfis WHERE id=?').get(id);
      if (!perfil) falha(404, 'Perfil não encontrado.');
      if (perfil.sistema || id === PERFIL_ADMINISTRADOR) falha(403, 'O perfil Administrador do sistema é imutável.');
      if (bd.prepare('SELECT id FROM utilizadores WHERE perfil_id=? LIMIT 1').get(id)) falha(409, 'O perfil está atribuído a utilizadores. Altere-os antes de apagar o perfil.');
      bd.prepare('DELETE FROM perfis WHERE id=?').run(id);
      registar(ator, 'PERFIL_APAGADO', id);
    });
    return responder(res, 200, { ok: true });
  }
  if (rota === '/api/auditoria' && metodo === 'GET') {
    exigirSessao(req, 'registos');
    queryValidada(url, { antes: (v) => /^\d+$/.test(v) ? inteiro(v, 'Identificador', 1, Number.MAX_SAFE_INTEGER) : dataIso(v, 'Data'), limite: limite500 });
    const limite = Number(url.searchParams.get('limite') || 200);
    const antes = url.searchParams.get('antes');
    let linhas;
    if (antes && /^\d+$/.test(antes)) linhas = bd.prepare('SELECT * FROM auditoria WHERE id<? ORDER BY id DESC LIMIT ?').all(Number(antes), limite);
    else if (antes) linhas = bd.prepare('SELECT * FROM auditoria WHERE em<? ORDER BY id DESC LIMIT ?').all(new Date(antes).toISOString(), limite);
    else linhas = bd.prepare('SELECT * FROM auditoria ORDER BY id DESC LIMIT ?').all(limite);
    return responder(res, 200, { registo: linhas.map((linha) => ({ id: linha.id, em: linha.em, utilizadorId: linha.utilizador_id, nome: linha.nome, acao: linha.acao, alvo: linha.alvo, resultado: linha.resultado })) });
  }
  if (rota === '/api/estatisticas' && metodo === 'GET') {
    exigirSessao(req, 'painel');
    queryValidada(url, { dias: (v) => inteiro(v, 'Dias', 1, 730) });
    const dias = Number(url.searchParams.get('dias') || 30);
    return responder(res, 200, { dias, historico: historico(dias) });
  }
  exigirSessao(req);
  falha(['GET', 'POST', 'DELETE'].includes(metodo) ? 404 : 405, 'Operação não permitida ou rota inexistente.');
}

const servidor = http.createServer({ maxHeaderSize: 16 * 1024, requestTimeout: 15000, headersTimeout: 10000, keepAliveTimeout: 5000 }, (req, res) => {
  encaminhar(req, res).catch((erro) => {
    if (erro instanceof ErroCloudflare) {
      responder(res, erro.estado, { erro: erro.message, provedor: 'cloudflare' });
    } else if (erro instanceof ErroAccess) {
      responder(res, erro.estado, { erro: erro.message, codigo: erro.codigo });
    } else if (erro instanceof ErroPedido) {
      if (erro.estado === 429) res.setHeader('Retry-After', '60');
      responder(res, erro.estado, { erro: erro.message });
    } else {
      console.error('[Back-office] Falha interna:', erro.code || erro.name || 'erro');
      responder(res, 500, { erro: 'Ocorreu um erro interno no back-office.' });
    }
  });
});
servidor.maxConnections = 100;
servidor.on('clientError', (_erro, socket) => {
  if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
});

function desligar() {
  if (aDesligar) return;
  aDesligar = true;
  clearInterval(limpeza);
  clearInterval(recolha);
  const pararConector = cloudflare.encerrar();
  servidor.close(async () => {
    await pararConector;
    bd.close();
    process.exit(0);
  });
  servidor.closeIdleConnections();
  setTimeout(() => {
    servidor.closeAllConnections();
    try { bd.close(); } catch { /* A ligação pode já ter sido fechada. */ }
    process.exit(0);
  }, 8000).unref();
}

async function recolherEstatisticas() {
  if (aDesligar || aRecolher || !configurado()) return;
  aRecolher = true;
  try {
    const painel = await pedirConsulta('/v1/painel');
    if (!aDesligar) guardarEstatisticas(painel);
  } catch { /* A indisponibilidade do site não impede as operações locais. */ }
  finally { aRecolher = false; }
}

servidor.on('error', (erro) => {
  console.error(erro.code === 'EADDRINUSE' ? `[Back-office] A porta ${PORTA} já está ocupada.` : '[Back-office] Não foi possível abrir o servidor.');
  try { bd.close(); } catch { /* Sem dados do site. */ }
  process.exitCode = 1;
});
servidor.listen(PORTA, '127.0.0.1', () => {
  console.log(`[Back-office] http://127.0.0.1:${PORTA}/ | consulta: 127.0.0.1:${PORTA_CONSULTA}`);
  limpeza = setInterval(() => {
    const agora = Date.now();
    bd.prepare('DELETE FROM sessoes WHERE expira<=?').run(agora);
    bd.prepare('DELETE FROM bilhetes WHERE expira<=?').run(agora);
    for (const [id, item] of tentativas) if (item.fim <= agora) tentativas.delete(id);
    void cloudflare.retomar();
  }, 60000).unref();
  recolha = setInterval(recolherEstatisticas, 15 * 60000).unref();
  void recolherEstatisticas();
  void cloudflare.retomar();
});
process.on('SIGINT', desligar);
process.on('SIGTERM', desligar);
