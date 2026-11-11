// servidor.js — site BXB (sem dependências: só Node.js 22.5+, com a base de dados SQLite incorporada)
// Serve a pasta do repositório em http://localhost:8080 e guarda os dados numa base de dados deste computador
// (fora do repositório, que é público). Funciona como o site de um banco:
//   · cada pessoa entra com email e palavra-passe;
//   · cada cliente (particular ou empresa) tem a sua área e só recebe os dados dessa área;
//   · numa empresa, os colaboradores convidados pelo responsável entram com o seu email na mesma área;
//   · as partilhas entre particulares só existem por convite e só têm a folha comum;
//   · o administrador gere contas (ativar, desativar, repor palavra-passe) mas não tem acesso aos dados de ninguém;
//   · cada acesso fica no registo (quem, quando, o quê — nunca o conteúdo).
// Em http://localhost:8080 só aceita ligações deste computador (127.0.0.1); para a internet use um túnel HTTPS (ex.: Cloudflare).
// Rede de casa (opcional): com um certificado em DADOS-SERVIDOR\tls (cert.pem e key.pem) abre também https://<IP>:8443.
'use strict';
const http = require('http');
const https = require('https');
const os = require('os');
const net = require('net');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');
const { DatabaseSync } = require('node:sqlite');

// o site abre diretamente em http://localhost (porta 80); se a porta 80 estiver ocupada ou não for permitida, usa a 8080
let PORT = +process.env.PORT || 80;
const PORT_RESERVA = 8080;
const HOST = '127.0.0.1';
const RAIZ = __dirname;
const urlSite = () => `http://localhost${PORT === 80 ? '' : ':' + PORT}/`;
const ASSINATURA = 'grupo-bxb-servidor';
// dados: por omissão em "BXB INVESTIMENTOS\DADOS-SERVIDOR" (duas pastas acima do repositório)
const DADOS = path.resolve(process.env.BXB_DADOS || path.join(RAIZ, '..', '..', 'DADOS-SERVIDOR'));
const FICH_BD = path.join(DADOS, 'bxb.db');
const PASTA_COPIAS = path.join(DADOS, 'copias');
const LIMITE_CORPO = 25 * 1024 * 1024;
const DURACAO_SESSAO = 12 * 3600 * 1000;
const PASTA_TLS = path.join(DADOS, 'tls');
const PORT_REDE = +process.env.PORT_REDE || 8443;

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.webp': 'image/webp', '.pdf': 'application/pdf', '.woff': 'font/woff', '.woff2': 'font/woff2',
};
// pastas que nunca são servidas
const PRIVADO = /(^|[\\/])(\.git|\.claude|node_modules|backend|DADOS-SERVIDOR)([\\/]|$)/i;

/* ================= Base de dados =================
   contas    — quem entra (email + palavra-passe)
   areas     — a área de cada cliente: plano pessoal (particular) ou empresa; "config" é a configuração do sistema
   membros   — que contas pertencem a cada área (dono ou colaborador): é ISTO que decide o acesso
   convites  — colaboradores convidados por email que ainda não têm conta
   dados     — os dados de cada área (e de cada partilha), por chave, com versão para controlo de concorrência
   partilhas — que áreas pertencem a cada partilha entre particulares
   contactos — pessoas (áreas de outros particulares) que um particular juntou pelo email, para lhes propor partilhas
   registo   — quem fez o quê e quando (sem conteúdos) */
fs.mkdirSync(DADOS, { recursive: true }); fs.mkdirSync(PASTA_COPIAS, { recursive: true });
const bd = new DatabaseSync(FICH_BD);
bd.exec(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS contas (id TEXT PRIMARY KEY, nome TEXT NOT NULL, email TEXT UNIQUE, utilizador TEXT UNIQUE, hash TEXT NOT NULL,
  admin INTEGER NOT NULL DEFAULT 0, ativo INTEGER NOT NULL DEFAULT 1, criada_em TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS areas (id TEXT PRIMARY KEY, tipo TEXT NOT NULL CHECK (tipo IN ('particular','empresa','arquivo')), nome TEXT NOT NULL, config TEXT NOT NULL, criada_em TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS membros (area TEXT NOT NULL REFERENCES areas(id), conta TEXT NOT NULL REFERENCES contas(id), papel TEXT NOT NULL CHECK (papel IN ('dono','colaborador')),
  desde TEXT NOT NULL, PRIMARY KEY (area, conta));
CREATE TABLE IF NOT EXISTS convites (area TEXT NOT NULL REFERENCES areas(id), email TEXT NOT NULL, por TEXT NOT NULL, em TEXT NOT NULL, PRIMARY KEY (area, email));
CREATE TABLE IF NOT EXISTS dados (chave TEXT PRIMARY KEY, area TEXT NOT NULL, valor TEXT NOT NULL, versao INTEGER NOT NULL, por TEXT, em TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS dados_area ON dados(area);
CREATE TABLE IF NOT EXISTS partilhas (partilha TEXT NOT NULL, area TEXT NOT NULL, PRIMARY KEY (partilha, area));
CREATE TABLE IF NOT EXISTS contactos (area TEXT NOT NULL, outra TEXT NOT NULL, PRIMARY KEY (area, outra));
CREATE TABLE IF NOT EXISTS registo (em TEXT NOT NULL, conta TEXT, acao TEXT NOT NULL, alvo TEXT, ip TEXT);
CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);`);
const q = sql => bd.prepare(sql);
const agoraISO = () => new Date().toISOString();
function transacao(fn) { bd.exec('BEGIN IMMEDIATE'); try { const r = fn(); bd.exec('COMMIT'); return r; } catch (e) { bd.exec('ROLLBACK'); throw e; } }
const registar = (conta, acao, alvo, ip) => { try { q('INSERT INTO registo (em, conta, acao, alvo, ip) VALUES (?,?,?,?,?)').run(agoraISO(), conta || null, acao, alvo || null, ip || null); } catch (e) { } };

// cópia de segurança diária da base de dados (mantém 60 dias)
let ultimoDiaCopia = '';
function copiaDiaria() {
  const dia = new Date().toISOString().slice(0, 10); if (dia === ultimoDiaCopia) return; ultimoDiaCopia = dia;
  const destino = path.join(PASTA_COPIAS, dia); if (fs.existsSync(path.join(destino, 'bxb.db'))) return;
  try { fs.mkdirSync(destino, { recursive: true }); bd.exec(`VACUUM INTO '${path.join(destino, 'bxb.db').replace(/'/g, "''")}'`); } catch (e) { console.error('cópia diária:', e.message); }
  const dias = fs.readdirSync(PASTA_COPIAS).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  dias.slice(0, Math.max(0, dias.length - 60)).forEach(d => fs.rmSync(path.join(PASTA_COPIAS, d), { recursive: true, force: true }));
}

/* ================= Migração (uma vez) dos ficheiros antigos para a base de dados =================
   Os ficheiros antigos (contas.json, dados\*.json) ficam onde estão, intactos. */
function migrarFicheiros() {
  if (q("SELECT v FROM meta WHERE k = 'migrado'").get()) return;
  const lerJSON = (f, def) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return def; } };
  const contasAnt = lerJSON(path.join(DADOS, 'contas.json'), []), donosAnt = lerJSON(path.join(DADOS, 'donos.json'), {});
  const pasta = path.join(DADOS, 'dados'), chaves = fs.existsSync(pasta) ? fs.readdirSync(pasta).filter(n => n.endsWith('.json')).map(n => decodeURIComponent(n.slice(0, -5))) : [];
  const ler = k => lerJSON(path.join(pasta, encodeURIComponent(k) + '.json'), null);
  if (!contasAnt.length && !chaves.length) { q("INSERT INTO meta (k, v) VALUES ('migrado', ?)").run(agoraISO()); return; }
  let grupo = []; try { grupo = JSON.parse((ler('spap:grupo') || {}).valor || '[]') || []; } catch (e) { }
  const configs = {}; grupo.forEach(s => { if (s && s.key) configs[s.key] = s; });
  contasAnt.forEach(c => (c.proprios || []).forEach(p => { if (p && p.key) configs[p.key] = p; }));
  const sis = k => { const m = /^spap:([^:]+)/.exec(k); return m ? m[1] : null; };
  const areasNec = new Set(chaves.map(sis).filter(s => s && s !== 'grupo' && s !== 'partilha'));
  grupo.forEach(s => { if (s && s.key && s.ativa !== false) areasNec.add(s.key); });
  transacao(() => {
    const em = agoraISO();
    contasAnt.forEach(c => {
      const email = c.email || (/@/.test(c.utilizador || '') ? c.utilizador : null);
      q('INSERT INTO contas (id, nome, email, utilizador, hash, admin, ativo, criada_em) VALUES (?,?,?,?,?,?,?,?)').run(c.id, c.nome, email ? email.toLowerCase() : null, (c.utilizador || '').toLowerCase() || null, c.hash, c.admin ? 1 : 0, c.ativo === false ? 0 : 1, c.criadaEm || em);
    });
    for (const k of areasNec) {
      const cfg = Object.assign({}, configs[k] || { key: k, nome: k, modelo: k === 'bxb' ? 'holding' : 'base' });
      const tipo = k === 'bxb' || cfg.modelo === 'casa' || !configs[k] ? 'arquivo' : cfg.modelo === 'planeamento' ? 'particular' : 'empresa';
      cfg.independente = true; cfg.tipo = tipo; delete cfg.utilizadores;
      q('INSERT INTO areas (id, tipo, nome, config, criada_em) VALUES (?,?,?,?,?)').run(k, tipo, cfg.nome || k, JSON.stringify(Object.assign(cfg, { utilizadores: (configs[k] || {}).utilizadores })), cfg.criadaEm || em);
      if (tipo === 'arquivo') continue;
      const explicitos = contasAnt.filter(c => (c.sistemas || []).includes(k) || (c.proprios || []).some(p => p.key === k));
      if (tipo === 'particular') {
        const dono = donosAnt[k] || (explicitos.length === 1 ? explicitos[0].id : null);
        if (dono && contasAnt.some(c => c.id === dono)) q('INSERT INTO membros (area, conta, papel, desde) VALUES (?,?,?,?)').run(k, dono, 'dono', em);
      } else {
        const admins = contasAnt.filter(c => c.admin), donos = explicitos.filter(c => (c.proprios || []).some(p => p.key === k));
        const lista = donos.length ? donos : admins.length ? admins : explicitos.slice(0, 1);
        lista.forEach(c => q('INSERT OR IGNORE INTO membros (area, conta, papel, desde) VALUES (?,?,?,?)').run(k, c.id, 'dono', em));
        explicitos.forEach(c => q('INSERT OR IGNORE INTO membros (area, conta, papel, desde) VALUES (?,?,?,?)').run(k, c.id, 'colaborador', em));
      }
    }
    for (const k of chaves) {
      if (k === 'spap:grupo') continue; const r = ler(k); if (!r || typeof r.valor !== 'string') continue;
      const s = sis(k), area = s === 'partilha' ? 'partilha:' + k.split(':')[2] : s;
      if (s !== 'partilha' && !areasNec.has(s)) continue;
      q('INSERT INTO dados (chave, area, valor, versao, por, em) VALUES (?,?,?,?,?,?)').run(k, area, r.valor, r.versao || 1, r.por || null, r.em || em);
      if (s === 'partilha') membrosDaPartilha(r.valor).forEach(a => q('INSERT OR IGNORE INTO partilhas (partilha, area) VALUES (?,?)').run(area, a));
    }
    q("INSERT INTO meta (k, v) VALUES ('migrado', ?)").run(em);
  });
  console.log(`  Dados antigos migrados para ${FICH_BD} (os ficheiros antigos ficam intactos).`);
}
function membrosDaPartilha(valor) { try { const v = typeof valor === 'string' ? JSON.parse(valor) : valor; return [...new Set(((v && v.membros) || []).map(m => m && m.sistema).filter(Boolean))]; } catch (e) { return []; } }

/* ================= Contas, sessões e acessos ================= */
function hashPalavra(palavra, sal = crypto.randomBytes(16).toString('hex')) { return sal + ':' + crypto.scryptSync(String(palavra), sal, 64).toString('hex'); }
function confere(palavra, guardado) { const [sal, h] = String(guardado || '').split(':'); if (!sal || !h) return false;
  const a = Buffer.from(h, 'hex'), b = crypto.scryptSync(String(palavra), sal, 64); return a.length === b.length && crypto.timingSafeEqual(a, b); }
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const slug = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'conta';
const iniciais = t => String(t || '').trim().split(/\s+/).filter(Boolean).map(x => x[0]).join('').slice(0, 3).toUpperCase() || 'PF';
const novoId = p => p + crypto.randomBytes(6).toString('hex');
const conta = id => q('SELECT * FROM contas WHERE id = ?').get(id);
const contaPorEmail = e => q('SELECT * FROM contas WHERE email = ? OR utilizador = ?').get(e, e);
// áreas da conta (com o papel); só estas — e as partilhas onde uma delas é membro — são acessíveis
const areasDe = id => q("SELECT a.id, a.tipo, a.nome, a.config, m.papel FROM membros m JOIN areas a ON a.id = m.area WHERE m.conta = ? AND a.tipo <> 'arquivo' ORDER BY a.criada_em").all(id);
const papelEm = (contaId, area) => { const r = q('SELECT papel FROM membros WHERE conta = ? AND area = ?').get(contaId, area); return r ? r.papel : null; };
const temPartilha = (contaId, partilha) => !!q('SELECT 1 FROM partilhas p JOIN membros m ON m.area = p.area WHERE p.partilha = ? AND m.conta = ?').get(partilha, contaId);
function areaDaChave(k) { const m = /^spap:([^:]+)(?::([^:]+))?/.exec(k); if (!m) return null; return m[1] === 'partilha' ? (m[2] ? 'partilha:' + m[2] : null) : m[1]; }
const acede = (contaId, area) => !!area && (area.startsWith('partilha:') ? temPartilha(contaId, area) : !!papelEm(contaId, area));
// pessoas com quem este particular pode partilhar: as das partilhas em que já está e os contactos que juntou pelo email
function pessoasDe(contaId) {
  const minhas = areasDe(contaId).filter(a => a.tipo === 'particular').map(a => a.id); if (!minhas.length) return [];
  const ph = minhas.map(() => '?').join(',');
  const ids = new Set([...q(`SELECT DISTINCT p2.area AS a FROM partilhas p1 JOIN partilhas p2 ON p2.partilha = p1.partilha WHERE p1.area IN (${ph})`).all(...minhas).map(r => r.a),
    ...q(`SELECT outra AS a FROM contactos WHERE area IN (${ph})`).all(...minhas).map(r => r.a)].filter(a => !minhas.includes(a)));
  return [...ids].map(a => q("SELECT id, nome FROM areas WHERE id = ? AND tipo = 'particular'").get(a)).filter(Boolean).map(a => ({ key: a.id, nome: a.nome, modelo: 'planeamento', ativa: true, contacto: true }));
}
function publica(c) {
  const areas = areasDe(c.id).map(a => Object.assign(JSON.parse(a.config), { key: a.id, nome: a.nome, tipo: a.tipo, papel: a.papel, independente: true, ativa: true }));
  return { id: c.id, nome: c.nome, email: c.email || '', utilizador: c.utilizador || c.email || '', admin: !!c.admin,
    tipo: areas.some(a => a.tipo === 'particular') ? 'particular' : areas.length ? 'empresa' : '',
    areas: areas.map(a => ({ key: a.key, nome: a.nome, tipo: a.tipo, papel: a.papel })), sistemas: areas.map(a => a.key), proprios: areas, pessoas: pessoasDe(c.id) };
}
const sessoes = new Map(); // token -> { conta, expira }
const falhas = new Map();  // email -> { n, ate }
const registos = new Map(); // ip -> { n, desde }: limite de contas novas por hora
const ipDe = req => String(req.headers['cf-connecting-ip'] || req.socket.remoteAddress || '');
function sessaoDe(req) {
  const m = /(?:^|;\s*)bxb_sessao=([a-f0-9]{64})/.exec(req.headers.cookie || ''); if (!m) return null;
  const s = sessoes.get(m[1]); if (!s || s.expira < Date.now()) { sessoes.delete(m[1]); return null; }
  const c = conta(s.conta); if (!c || !c.ativo) return null;
  s.expira = Date.now() + DURACAO_SESSAO; return { token: m[1], conta: c };
}
function abrirSessao(req, res, c) { const t = crypto.randomBytes(32).toString('hex'); sessoes.set(t, { conta: c.id, expira: Date.now() + DURACAO_SESSAO });
  const seguro = req.headers['x-forwarded-proto'] === 'https' || req.socket.encrypted ? '; Secure' : '';
  res.setHeader('Set-Cookie', `bxb_sessao=${t}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${DURACAO_SESSAO / 1000}${seguro}`); }
// convites pendentes para este email (colaboradores de empresas): passam a membro quando a conta existe
function aceitarConvites(c) { if (!c.email) return; q('SELECT area FROM convites WHERE email = ?').all(c.email).forEach(r => {
  q("INSERT OR IGNORE INTO membros (area, conta, papel, desde) VALUES (?,?, 'colaborador', ?)").run(r.area, c.id, agoraISO()); q('DELETE FROM convites WHERE area = ? AND email = ?').run(r.area, c.email); registar(c.id, 'CONVITE_ACEITE', r.area); }); }
function novaArea(c, tipo, nome, extra = {}) {
  const id = (tipo === 'empresa' ? 'e-' : 'p-') + slug(nome) + '-' + crypto.randomBytes(3).toString('hex');
  const cfg = Object.assign({ key: id, nome: tipo === 'empresa' ? nome : nome + ' (pessoal)', sigla: iniciais(nome), nif: '', setor: '', modelo: tipo === 'empresa' ? 'servicos' : 'planeamento',
    cor1: tipo === 'empresa' ? '#0ea5e9' : '#8b5cf6', cor2: tipo === 'empresa' ? '#22d3ee' : '#ec4899', participacao: 0, ativa: true, criadaEm: agoraISO().slice(0, 10),
    contaCaixa: 'CAIXA', contaOperacional: 'OPERACIONAL', contaHolding: 'HOLDING', independente: true, tipo,
    utilizadores: [{ id: 'u_' + crypto.randomBytes(4).toString('hex'), nome: c.nome, username: String(c.email || 'eu').split('@')[0].slice(0, 30), email: c.email, contaId: c.id, role: 'ADMIN', limite: 0 }] }, extra);
  q('INSERT INTO areas (id, tipo, nome, config, criada_em) VALUES (?,?,?,?,?)').run(id, tipo, cfg.nome, JSON.stringify(cfg), agoraISO());
  q("INSERT INTO membros (area, conta, papel, desde) VALUES (?,?, 'dono', ?)").run(id, c.id, agoraISO());
  return id;
}
const destinoDe = area => '/SISTEMAS/subsidiaria/index.html?s=' + encodeURIComponent(area);

/* ---------------- Servidor ---------------- */
function abrirBrowser(url) {
  if (process.env.NO_BROWSER) return;
  const browser = process.env.BROWSER;
  const cmd = process.platform === 'win32'
    ? (browser ? `start "" "${browser}" "${url}"` : `start "" "${url}"`)
    : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd, () => {});
}
function lerCorpo(req) {
  return new Promise((ok, falha) => { let n = 0; const partes = [];
    req.on('data', d => { n += d.length; if (n > LIMITE_CORPO) { falha(new Error('Pedido demasiado grande')); req.destroy(); } else partes.push(d); });
    req.on('end', () => { try { ok(partes.length ? JSON.parse(Buffer.concat(partes).toString('utf8')) : {}); } catch (e) { falha(new Error('JSON inválido')); } });
    req.on('error', falha); });
}

async function api(req, res, caminho) {
  const json = (codigo, obj) => { res.writeHead(codigo, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Servidor': ASSINATURA }); res.end(JSON.stringify(obj)); };
  // proteção CSRF: pedidos que alteram dados têm de vir desta mesma origem
  if (req.method !== 'GET' && req.headers['x-bxb'] !== '1') return json(403, { erro: 'Pedido recusado' });
  const s = sessaoDe(req), c = s && s.conta, ip = ipDe(req);
  const configurado = !!q('SELECT 1 FROM contas LIMIT 1').get();

  if (caminho === '/api/estado' && req.method === 'GET') return json(200, { configurado, sessao: c ? publica(c) : null });

  // primeira utilização: cria a conta de administrador (gere contas; os dados de cada um continuam só de cada um)
  if (caminho === '/api/configurar' && req.method === 'POST') {
    if (configurado) return json(409, { erro: 'O servidor já está configurado' });
    const b = await lerCorpo(req), email = String(b.email || b.utilizador || '').trim().toLowerCase();
    if (!b.nome || !EMAIL.test(email) || String(b.palavra || '').length < 8) return json(400, { erro: 'Indique o nome, um email válido e uma palavra-passe com pelo menos 8 caracteres' });
    const nova = { id: novoId('c'), nome: String(b.nome).trim(), email };
    q('INSERT INTO contas (id, nome, email, utilizador, hash, admin, ativo, criada_em) VALUES (?,?,?,?,?,1,1,?)').run(nova.id, nova.nome, email, email, hashPalavra(b.palavra), agoraISO());
    registar(nova.id, 'CONFIGURADO', null, ip); abrirSessao(req, res, nova); return json(200, { sessao: publica(conta(nova.id)) });
  }
  if (caminho === '/api/entrar' && req.method === 'POST') {
    const b = await lerCorpo(req), u = String(b.email || b.utilizador || '').trim().toLowerCase(), f = falhas.get(u);
    if (f && f.ate > Date.now()) return json(429, { erro: 'Demasiadas tentativas. Tente de novo dentro de alguns minutos.' });
    const x = u && contaPorEmail(u);
    if (!x || !x.ativo || !confere(b.palavra, x.hash)) { const n = (f && f.ate && f.ate <= Date.now() ? 0 : (f ? f.n : 0)) + 1; falhas.set(u, { n, ate: n >= 5 ? Date.now() + 5 * 60000 : 0 }); registar(x && x.id, 'ENTRADA_FALHADA', u, ip); return json(401, { erro: 'Email ou palavra-passe incorretos' }); }
    falhas.delete(u); aceitarConvites(x); registar(x.id, 'ENTRADA', b.tipo || null, ip); abrirSessao(req, res, x); return json(200, { sessao: publica(x) });
  }
  // criar conta: um particular recebe a sua área pessoal; uma empresa recebe a área da empresa (e fica responsável por ela)
  if (caminho === '/api/registar' && req.method === 'POST') {
    if (!configurado) return json(409, { erro: 'O servidor ainda não está configurado' });
    const r0 = registos.get(ip), agora = Date.now();
    if (r0 && agora - r0.desde < 3600000 && r0.n >= 5) return json(429, { erro: 'Demasiadas contas criadas a partir deste endereço. Tente mais tarde.' });
    const b = await lerCorpo(req), tipo = b.tipo === 'empresa' ? 'empresa' : 'particular';
    const nome = String(b.nome || '').trim().slice(0, 80), email = String(b.email || '').trim().toLowerCase(), empresa = String(b.empresa || '').trim().slice(0, 80), nif = String(b.nif || '').replace(/\s+/g, '').slice(0, 12);
    if (!nome) return json(400, { erro: 'Indique o seu nome' });
    if (!EMAIL.test(email) || email.length > 120) return json(400, { erro: 'Indique um email válido' });
    if (String(b.palavra || '').length < 8) return json(400, { erro: 'A palavra-passe tem de ter pelo menos 8 caracteres' });
    if (tipo === 'empresa' && !empresa) return json(400, { erro: 'Indique o nome da empresa' });
    if (nif && !/^\d{9}$/.test(nif)) return json(400, { erro: 'O NIF tem 9 dígitos' });
    if (contaPorEmail(email)) return json(409, { erro: 'Já existe uma conta com esse email' });
    const nova = { id: novoId('c'), nome, email };
    const area = transacao(() => {
      q('INSERT INTO contas (id, nome, email, utilizador, hash, admin, ativo, criada_em) VALUES (?,?,?,?,?,0,1,?)').run(nova.id, nome, email, email, hashPalavra(b.palavra), agoraISO());
      return novaArea(nova, tipo, tipo === 'empresa' ? empresa : nome, tipo === 'empresa' ? { nif } : {});
    });
    aceitarConvites(nova);
    registos.set(ip, r0 && agora - r0.desde < 3600000 ? { n: r0.n + 1, desde: r0.desde } : { n: 1, desde: agora });
    registar(nova.id, 'CONTA_CRIADA', area, ip); abrirSessao(req, res, nova); return json(200, { sessao: publica(conta(nova.id)), destino: destinoDe(area) });
  }
  if (caminho === '/api/sair' && req.method === 'POST') { if (s) { sessoes.delete(s.token); registar(c.id, 'SAIDA', null, ip); } res.setHeader('Set-Cookie', 'bxb_sessao=; Path=/; Max-Age=0'); return json(200, { ok: true }); }

  if (!c) return json(401, { erro: 'Sessão expirada' });

  if (caminho === '/api/palavra' && req.method === 'POST') {
    const b = await lerCorpo(req); if (!confere(b.atual, c.hash)) return json(400, { erro: 'Palavra-passe atual incorreta' });
    if (String(b.nova || '').length < 8) return json(400, { erro: 'A nova palavra-passe tem de ter pelo menos 8 caracteres' });
    q('UPDATE contas SET hash = ? WHERE id = ?').run(hashPalavra(b.nova), c.id); registar(c.id, 'PALAVRA_ALTERADA', null, ip); return json(200, { ok: true });
  }
  // criar a área que falta (ex.: quem tem só a área pessoal e abre a empresa, ou o contrário). Um particular tem uma só área pessoal.
  if (caminho === '/api/criar-area' && req.method === 'POST') {
    const b = await lerCorpo(req), tipo = b.tipo === 'empresa' ? 'empresa' : 'particular';
    if (tipo === 'particular') { const ja = areasDe(c.id).find(a => a.tipo === 'particular' && a.papel === 'dono'); if (ja) return json(200, { destino: destinoDe(ja.id) }); }
    const nome = tipo === 'empresa' ? String(b.empresa || '').trim().slice(0, 80) : c.nome, nif = String(b.nif || '').replace(/\s+/g, '').slice(0, 12);
    if (!nome) return json(400, { erro: 'Indique o nome da empresa' });
    if (nif && !/^\d{9}$/.test(nif)) return json(400, { erro: 'O NIF tem 9 dígitos' });
    const area = novaArea(c, tipo, nome, tipo === 'empresa' ? { nif } : {}); registar(c.id, 'AREA_CRIADA', area, ip);
    return json(200, { sessao: publica(c), destino: destinoDe(area) });
  }
  // dados: só os das áreas da conta e das partilhas em que essas áreas estão
  if (caminho === '/api/dados' && req.method === 'GET') {
    const out = {}; for (const r of q('SELECT chave, area, valor, versao FROM dados').iterate()) if (acede(c.id, r.area)) out[r.chave] = { valor: r.valor, versao: r.versao };
    registar(c.id, 'LEITURA', Object.keys(out).length + ' chaves', ip); return json(200, out);
  }
  if (caminho === '/api/versoes' && req.method === 'GET') {
    const out = {}; for (const r of q('SELECT chave, area, versao FROM dados').iterate()) if (acede(c.id, r.area)) out[r.chave] = r.versao;
    return json(200, out);
  }
  if (caminho.startsWith('/api/dados/')) {
    const k = decodeURIComponent(caminho.slice('/api/dados/'.length)), area = areaDaChave(k);
    if (!/^spap:/.test(k) || k.length > 300 || !area) return json(400, { erro: 'Chave inválida' });
    const b = await lerCorpo(req), atual = q('SELECT versao, valor FROM dados WHERE chave = ?').get(k), vAtual = atual ? atual.versao : 0;
    // partilha nova: quem a cria tem de ser membro; existente: só os membros. Área: só quem lhe pertence.
    let pode;
    if (area.startsWith('partilha:')) pode = atual ? temPartilha(c.id, area) : membrosDaPartilha(b.valor).some(a => !!papelEm(c.id, a));
    else pode = !!papelEm(c.id, area);
    if (!pode) { registar(c.id, 'ACESSO_RECUSADO', k, ip); return json(403, { erro: 'Sem acesso a estes dados' }); }
    if ((+b.versao || 0) !== vAtual) return json(409, { erro: 'Alterado por outro utilizador', versao: vAtual, valor: atual ? atual.valor : null });
    copiaDiaria();
    if (req.method === 'PUT') {
      if (typeof b.valor !== 'string') return json(400, { erro: 'Valor inválido' });
      transacao(() => {
        q('INSERT INTO dados (chave, area, valor, versao, por, em) VALUES (?,?,?,?,?,?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor, versao = excluded.versao, por = excluded.por, em = excluded.em')
          .run(k, area, b.valor, vAtual + 1, c.id, agoraISO());
        if (area.startsWith('partilha:')) { // os membros da partilha são as áreas pessoais indicadas no registo comum (convite → membro)
          const ms = membrosDaPartilha(b.valor).filter(a => q("SELECT 1 FROM areas WHERE id = ? AND tipo = 'particular'").get(a));
          q('DELETE FROM partilhas WHERE partilha = ?').run(area); ms.forEach(a => q('INSERT INTO partilhas (partilha, area) VALUES (?,?)').run(area, a));
        }
      });
      registar(c.id, 'GRAVACAO', k, ip); return json(200, { versao: vAtual + 1 });
    }
    if (req.method === 'DELETE') { q('DELETE FROM dados WHERE chave = ?').run(k); registar(c.id, 'APAGADO', k, ip); return json(200, { versao: 0 }); }
    return json(405, { erro: 'Método não permitido' });
  }
  // juntar uma pessoa (particular) pelo email, para lhe poder propor partilhas — como adicionar um contacto no MB WAY
  if (caminho === '/api/pessoas' && req.method === 'POST') {
    const b = await lerCorpo(req), email = String(b.email || '').trim().toLowerCase();
    const minha = areasDe(c.id).find(a => a.tipo === 'particular' && a.papel === 'dono'); if (!minha) return json(400, { erro: 'Só uma área pessoal pode partilhar' });
    const outra = EMAIL.test(email) && contaPorEmail(email), area = outra && areasDe(outra.id).find(a => a.tipo === 'particular' && a.papel === 'dono');
    if (!area || outra.id === c.id) return json(404, { erro: 'Não há nenhum particular com esse email' });
    q('INSERT OR IGNORE INTO contactos (area, outra) VALUES (?,?)').run(minha.id, area.id); registar(c.id, 'CONTACTO_ADICIONADO', area.id, ip);
    return json(200, { pessoa: { key: area.id, nome: area.nome, modelo: 'planeamento', ativa: true, contacto: true } });
  }
  // colaboradores de uma empresa (só o responsável): convidar por email, ver, retirar
  if (caminho === '/api/colaboradores') {
    const b = req.method === 'GET' ? Object.fromEntries(new URL(req.url, 'http://x').searchParams) : await lerCorpo(req), area = String(b.area || '');
    if (papelEm(c.id, area) !== 'dono' || !q("SELECT 1 FROM areas WHERE id = ? AND tipo = 'empresa'").get(area)) return json(403, { erro: 'Só o responsável da empresa' });
    const lista = () => ({ membros: q('SELECT c.id, c.nome, c.email, m.papel, m.desde FROM membros m JOIN contas c ON c.id = m.conta WHERE m.area = ? ORDER BY m.papel DESC, c.nome').all(area),
      convites: q('SELECT email, em FROM convites WHERE area = ?').all(area) });
    if (req.method === 'GET') return json(200, lista());
    if (req.method === 'POST') {
      const email = String(b.email || '').trim().toLowerCase(); if (!EMAIL.test(email)) return json(400, { erro: 'Indique um email válido' });
      const x = contaPorEmail(email);
      if (x) q("INSERT OR IGNORE INTO membros (area, conta, papel, desde) VALUES (?,?, 'colaborador', ?)").run(area, x.id, agoraISO());
      else q('INSERT OR REPLACE INTO convites (area, email, por, em) VALUES (?,?,?,?)').run(area, email, c.id, agoraISO());
      registar(c.id, 'COLABORADOR_CONVIDADO', area + ' ' + email, ip); return json(200, lista());
    }
    if (req.method === 'DELETE') {
      if (b.conta) { if (b.conta === c.id) return json(400, { erro: 'Não se pode retirar a si próprio' }); q("DELETE FROM membros WHERE area = ? AND conta = ? AND papel = 'colaborador'").run(area, String(b.conta)); }
      if (b.email) q('DELETE FROM convites WHERE area = ? AND email = ?').run(area, String(b.email).toLowerCase());
      registar(c.id, 'COLABORADOR_RETIRADO', area, ip); return json(200, lista());
    }
    return json(405, { erro: 'Método não permitido' });
  }
  // administração: só contas (nunca dados). Ativar/desativar, email, repor palavra-passe.
  if (caminho === '/api/contas') {
    if (!c.admin) return json(403, { erro: 'Só administradores' });
    if (req.method === 'GET') return json(200, q('SELECT id, nome, email, utilizador, admin, ativo, criada_em FROM contas ORDER BY criada_em').all().map(x => Object.assign(x, {
      admin: !!x.admin, ativo: !!x.ativo, areas: q("SELECT a.tipo, m.papel FROM membros m JOIN areas a ON a.id = m.area WHERE m.conta = ? AND a.tipo <> 'arquivo'").all(x.id) })));
    if (req.method === 'POST') {
      const b = await lerCorpo(req), x = b.id && conta(String(b.id)); if (!x) return json(404, { erro: 'Conta não encontrada' });
      if (b.email !== undefined) { const em = String(b.email || '').trim().toLowerCase(); if (!EMAIL.test(em)) return json(400, { erro: 'Email inválido' });
        const outra = contaPorEmail(em); if (outra && outra.id !== x.id) return json(409, { erro: 'Esse email já está noutra conta' }); q('UPDATE contas SET email = ? WHERE id = ?').run(em, x.id); }
      if (b.nome) q('UPDATE contas SET nome = ? WHERE id = ?').run(String(b.nome).trim().slice(0, 80), x.id);
      if (b.ativo !== undefined) { if (x.id === c.id && !b.ativo) return json(400, { erro: 'Não pode desativar a sua própria conta' }); q('UPDATE contas SET ativo = ? WHERE id = ?').run(b.ativo ? 1 : 0, x.id);
        if (!b.ativo) for (const [t, ss] of sessoes) if (ss.conta === x.id) sessoes.delete(t); }
      if (b.admin !== undefined && x.id !== c.id) q('UPDATE contas SET admin = ? WHERE id = ?').run(b.admin ? 1 : 0, x.id);
      if (b.palavra) { if (String(b.palavra).length < 8) return json(400, { erro: 'A palavra-passe tem de ter pelo menos 8 caracteres' }); q('UPDATE contas SET hash = ? WHERE id = ?').run(hashPalavra(b.palavra), x.id);
        for (const [t, ss] of sessoes) if (ss.conta === x.id && x.id !== c.id) sessoes.delete(t); }
      registar(c.id, 'ADMIN_CONTA_ALTERADA', x.id, ip); return json(200, { ok: true });
    }
    return json(405, { erro: 'Método não permitido' });
  }
  return json(404, { erro: 'Não encontrado' });
}

function atender(req, res) {
  const enviar = (codigo, corpo, tipo = 'text/plain; charset=utf-8') => {
    res.writeHead(codigo, { 'Content-Type': tipo, 'Cache-Control': 'no-cache', 'X-Servidor': ASSINATURA });
    res.end(corpo);
  };
  let caminho;
  try { caminho = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch (e) { return enviar(400, 'Pedido inválido'); }
  if (caminho.startsWith('/api/')) return api(req, res, caminho).catch(e => { try { enviar(400, JSON.stringify({ erro: e.message }), 'application/json; charset=utf-8'); } catch (e2) { } });
  if (req.method !== 'GET' && req.method !== 'HEAD') return enviar(405, 'Método não permitido');
  if (caminho === '/entrar') { res.writeHead(302, { Location: '/SISTEMAS/entrar.html', 'X-Servidor': ASSINATURA }); return res.end(); }
  // páginas públicas do site com endereços simples; o país vem à frente: /pt-br/... ou /pt-pt/... (lido no navegador por pais.js)
  const comPais = caminho.match(/^\/pt-(br|pt)(?=\/|$)/);
  if (comPais) caminho = caminho.slice(comPais[0].length) || '/';
  if (caminho === '/'|| caminho === '/index.html') caminho = '/SISTEMAS/inicio.html';
  else if (caminho === '/artigos' || caminho === '/artigos/') caminho = '/SISTEMAS/site/artigos.html';
  else if (/^\/artigos\/[a-z0-9-]+\/?$/.test(caminho)) caminho = '/SISTEMAS/site/artigo.html';
  else if (caminho === '/empresas' || caminho === '/empresas/' || caminho === '/particulares') caminho = '/SISTEMAS/inicio.html';
  else if (caminho === '/ajuda' || caminho === '/ajuda/') caminho = '/SISTEMAS/site/ajuda.html';
  else if (caminho === '/simuladores' || caminho === '/simuladores/') caminho = '/SISTEMAS/site/simuladores.html';
  else if (caminho === '/conta') { res.writeHead(302, { Location: '/SISTEMAS/conta.html' }); return res.end(); }

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
}
const servidor = http.createServer(atender);

// acesso na rede de casa: HTTPS com o certificado de DADOS-SERVIDOR\tls (se existir).
// Na mesma porta, quem escrever http:// é reencaminhado para https://. As ligações ficam em DADOS-SERVIDOR\rede.log.
function abrirRede() {
  const cert = path.join(PASTA_TLS, 'cert.pem'), key = path.join(PASTA_TLS, 'key.pem');
  if (!fs.existsSync(cert) || !fs.existsSync(key)) return;
  const ips = Object.values(os.networkInterfaces()).flat().filter(x => x && x.family === 'IPv4' && !x.internal).map(x => x.address);
  const LOG = path.join(DADOS, 'rede.log'), registo = t => { try { fs.appendFileSync(LOG, new Date().toISOString() + ' ' + t + '\n'); } catch (e) { } };
  const seguro = https.createServer({ cert: fs.readFileSync(cert), key: fs.readFileSync(key) }, (req, res) => { registo(`${req.socket.remoteAddress} ${req.method} ${req.url}`); atender(req, res); });
  seguro.on('tlsClientError', (e, sock) => registo(`${sock && sock.remoteAddress} erro TLS: ${e.code || e.message}`));
  const reencaminhar = http.createServer((req, res) => { registo(`${req.socket.remoteAddress} http -> https ${req.url}`); res.writeHead(301, { Location: `https://${req.headers.host || ips[0] + ':' + PORT_REDE}${req.url}` }); res.end(); });
  net.createServer(sock => {
    sock.on('error', () => {});
    sock.once('data', buf => { sock.pause(); sock.unshift(buf); (buf[0] === 22 ? seguro : reencaminhar).emit('connection', sock); process.nextTick(() => sock.resume()); });
  }).on('error', e => console.error(`  [rede] Nao foi possivel abrir a porta ${PORT_REDE}: ${e.message}`))
    .listen(PORT_REDE, '0.0.0.0', () => {
      registo(`servidor de rede aberto na porta ${PORT_REDE} (${ips.join(', ')})`);
      console.log('  Rede de casa (telemovel, outros computadores):');
      ips.forEach(ip => console.log(`    https://${ip}:${PORT_REDE}/SISTEMAS/index.html`));
      console.log('');
    });
}

function arrancar() { servidor.listen(PORT, HOST, () => {
  console.log('');
  console.log('  BXB - site a correr');
  console.log(`  Abra: ${urlSite()}`);
  console.log(`  Dados guardados em: ${DADOS}`);
  console.log('');
  abrirRede();
  console.log('  Nao feche esta janela enquanto usa o sistema.');
  abrirBrowser(urlSite());
}); }
servidor.on('error', erro => {
  const ocupada = erro.code === 'EADDRINUSE';
  if (!ocupada && erro.code !== 'EACCES') { console.error('Erro ao arrancar o servidor:', erro.message); process.exit(1); }
  const reserva = () => { if (!process.env.PORT && PORT !== PORT_RESERVA) { console.log(`  A porta ${PORT} nao esta disponivel: a usar a ${PORT_RESERVA}.`); PORT = PORT_RESERVA; arrancar(); return true; } return false; };
  if (!ocupada) { if (!reserva()) { console.error(`Sem permissao para usar a porta ${PORT}.`); process.exit(1); } return; }
  // a porta está ocupada: se for este servidor (já aberto noutra janela), basta abrir o browser; se for outro programa, tenta a reserva
  http.get(`http://${HOST}:${PORT}/`, r => {
    if (r.headers['x-servidor'] === ASSINATURA) {
      console.log(`O servidor já está a correr noutra janela. A abrir ${urlSite()}`);
      abrirBrowser(urlSite());
      setTimeout(() => process.exit(0), 500);
    } else if (!reserva()) {
      console.error(`A porta ${PORT} está ocupada por outro programa. Feche-o ou defina outra porta (set PORT=8081).`);
      process.exit(1);
    }
  }).on('error', () => { if (!reserva()) { console.error(`A porta ${PORT} está ocupada por outro programa. Feche-o ou defina outra porta (set PORT=8081).`); process.exit(1); } });
});

migrarFicheiros();
arrancar();
