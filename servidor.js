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
// Consola de gestão antiga: http://127.0.0.1:8099, só neste computador (nunca na rede nem nos túneis). Vai ser retirada:
// o back-office (BXB Gestor .exe e painel de gestão) passa a ter servidor e base de dados próprios (pasta backoffice/, do Codex).
// API de consulta para o back-office: http://127.0.0.1:8097, só leitura (contrato em CONTRATO-CONSULTA.md).
'use strict';
const http = require('http');
const https = require('https');
const os = require('os');
const net = require('net');
const tls = require('tls');
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
const PORT_GESTAO = +process.env.PORT_GESTAO || 8099;
const FICH_SEGREDO = path.join(DADOS, 'segredo.chave'); // cifra as definições secretas (ex.: palavra-passe do email)
const FICH_GESTAO = path.join(DADOS, 'gestao.chave');   // o BXB Gestor usa-a para abrir a consola
const ARRANQUE = Date.now();
const portas = { site: 0, rede: 0, gestao: 0, consulta: 0 };

// últimas linhas escritas na consola (a consola de gestão mostra-as em Registos > Servidor)
const CONSOLA = [];
['log', 'warn', 'error'].forEach(n => { const orig = console[n].bind(console);
  console[n] = (...a) => { CONSOLA.push({ em: new Date().toISOString(), nivel: n === 'log' ? 'info' : n, t: a.map(x => typeof x === 'string' ? x : x instanceof Error ? x.message : JSON.stringify(x)).join(' ') });
    if (CONSOLA.length > 600) CONSOLA.splice(0, CONSOLA.length - 600); orig(...a); }; });

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.webp': 'image/webp', '.pdf': 'application/pdf', '.woff': 'font/woff', '.woff2': 'font/woff2',
};
// pastas que nunca são servidas no site (a consola de gestão só existe na porta deste computador)
const PRIVADO = /(^|[\\/])(\.git|\.claude|node_modules|backend|backoffice|DADOS-SERVIDOR|DADOS-BACKOFFICE|gestor|gestao)([\\/]|$)/i;

/* ================= Base de dados =================
   contas    — quem entra (email + palavra-passe)
   areas     — a área de cada cliente: plano pessoal (particular) ou empresa; "config" é a configuração do sistema
   membros   — que contas pertencem a cada área (dono ou colaborador): é ISTO que decide o acesso
   convites  — colaboradores convidados por email que ainda não têm conta
   dados     — os dados de cada área (e de cada partilha), por chave, com versão para controlo de concorrência
   partilhas — que áreas pertencem a cada partilha entre particulares
   contactos — pessoas (áreas de outros particulares) que um particular juntou pelo email, para lhes propor partilhas
   registo   — quem fez o quê e quando (sem conteúdos)
   sessoes   — sessões abertas (só o resumo SHA-256 do código do cookie), sobrevivem a reinícios do servidor
   config    — definições do sistema (as secretas vão cifradas com a chave de DADOS-SERVIDOR\segredo.chave)
   emails    — emails enviados pelo sistema (para quem, que modelo, se correu bem) */
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
CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);
CREATE INDEX IF NOT EXISTS registo_conta ON registo(conta, acao);
CREATE INDEX IF NOT EXISTS registo_em ON registo(em);
CREATE TABLE IF NOT EXISTS sessoes (hash TEXT PRIMARY KEY, conta TEXT NOT NULL, criada TEXT NOT NULL, expira INTEGER NOT NULL, visto TEXT, ip TEXT, agente TEXT);
CREATE INDEX IF NOT EXISTS sessoes_conta ON sessoes(conta);
CREATE TABLE IF NOT EXISTS config (k TEXT PRIMARY KEY, v TEXT NOT NULL, em TEXT NOT NULL, por TEXT);
CREATE TABLE IF NOT EXISTS emails (id INTEGER PRIMARY KEY AUTOINCREMENT, em TEXT NOT NULL, para TEXT NOT NULL, modelo TEXT, assunto TEXT, estado TEXT NOT NULL, erro TEXT);`);
const q = sql => bd.prepare(sql);
// perfil completo da conta (preenchido depois de criar a conta): JSON com os dados de contacto e da empresa
if (!q("SELECT 1 AS x FROM pragma_table_info('contas') WHERE name = 'perfil'").get()) bd.exec('ALTER TABLE contas ADD COLUMN perfil TEXT');
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
const perfilDe = c => { try { return JSON.parse(c.perfil || '{}') || {}; } catch (e) { return {}; } };
function publica(c) {
  const areas = areasDe(c.id).map(a => Object.assign(JSON.parse(a.config), { key: a.id, nome: a.nome, tipo: a.tipo, papel: a.papel, independente: true, ativa: true }));
  return { id: c.id, nome: c.nome, email: c.email || '', utilizador: c.utilizador || c.email || '', admin: !!c.admin, completar: perfilDe(c).pendente === true ? (perfilDe(c).tipo || 'particular') : false,
    tipo: areas.some(a => a.tipo === 'particular') ? 'particular' : areas.length ? 'empresa' : '',
    areas: areas.map(a => ({ key: a.key, nome: a.nome, tipo: a.tipo, papel: a.papel })), sistemas: areas.map(a => a.key), proprios: areas, pessoas: pessoasDe(c.id) };
}
const falhas = new Map();  // email -> { n, ate }
const registos = new Map(); // ip -> { n, desde }: limite de contas novas por hora
// criar conta em passos: 1) nome, email e palavra-passe; 2) código enviado por email (se a verificação estiver ligada); 3) perfil completo
const porVerificar = new Map(); // pedido -> { tipo, nome, email, hash, codigo (resumo), expira, tentativas, enviados, ultimo }
const novoCodigo = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');
const ipDe = req => String(req.headers['cf-connecting-ip'] || req.socket.remoteAddress || '');
// sessões na base de dados: o cookie leva um código aleatório; a base de dados guarda só o seu resumo SHA-256
const resumo = t => crypto.createHash('sha256').update(String(t)).digest('hex');
function sessaoDe(req) {
  const m = /(?:^|;\s*)bxb_sessao=([a-f0-9]{64})/.exec(req.headers.cookie || ''); if (!m) return null;
  const h = resumo(m[1]), s = q('SELECT conta, expira FROM sessoes WHERE hash = ?').get(h), agora = Date.now();
  if (!s || s.expira < agora) { if (s) q('DELETE FROM sessoes WHERE hash = ?').run(h); return null; }
  const c = conta(s.conta); if (!c || !c.ativo) return null;
  // prolonga a sessão enquanto é usada (no máximo uma escrita por minuto)
  if (s.expira - agora < DURACAO_SESSAO - 60000) q('UPDATE sessoes SET expira = ?, visto = ?, ip = ? WHERE hash = ?').run(agora + DURACAO_SESSAO, agoraISO(), ipDe(req), h);
  return { token: m[1], hash: h, conta: c };
}
function abrirSessao(req, res, c) { const t = crypto.randomBytes(32).toString('hex');
  q('INSERT INTO sessoes (hash, conta, criada, expira, visto, ip, agente) VALUES (?,?,?,?,?,?,?)').run(resumo(t), c.id, agoraISO(), Date.now() + DURACAO_SESSAO, agoraISO(), ipDe(req), String(req.headers['user-agent'] || '').slice(0, 200));
  const seguro = req.headers['x-forwarded-proto'] === 'https' || req.socket.encrypted ? '; Secure' : '';
  res.setHeader('Set-Cookie', `bxb_sessao=${t}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${DURACAO_SESSAO / 1000}${seguro}`); }
// termina as sessões de uma conta (menos a indicada: quem muda a própria palavra-passe continua dentro)
const terminarSessoes = (contaId, excetoHash) => q('DELETE FROM sessoes WHERE conta = ? AND hash <> ?').run(contaId, excetoHash || '').changes;
const limparSessoes = () => { try { q('DELETE FROM sessoes WHERE expira < ?').run(Date.now()); } catch (e) { } };

/* ================= Definições do sistema (tabela config) =================
   Os valores secretos vão cifrados (AES-256-GCM) com a chave de DADOS-SERVIDOR\segredo.chave, criada no primeiro arranque.
   A consola nunca devolve um segredo: diz só se está guardado. */
let SEGREDO = null;
function chaveSegredo() {
  if (SEGREDO) return SEGREDO;
  if (fs.existsSync(FICH_SEGREDO)) { SEGREDO = fs.readFileSync(FICH_SEGREDO); if (SEGREDO.length !== 32) throw new Error('A chave em ' + FICH_SEGREDO + ' está danificada'); return SEGREDO; }
  SEGREDO = crypto.randomBytes(32); fs.writeFileSync(FICH_SEGREDO, SEGREDO, { mode: 0o600 }); return SEGREDO;
}
function cifrar(texto) { const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', chaveSegredo(), iv);
  const d = Buffer.concat([c.update(String(texto), 'utf8'), c.final()]); return 'v1:' + Buffer.concat([iv, c.getAuthTag(), d]).toString('base64'); }
function decifrar(s) { try { const b = Buffer.from(String(s || '').slice(3), 'base64'), d = crypto.createDecipheriv('aes-256-gcm', chaveSegredo(), b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28)); return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8'); } catch (e) { return null; } }
function cfg(k, def) { const r = q('SELECT v FROM config WHERE k = ?').get(k); if (!r) return def; try { const v = JSON.parse(r.v); return def && typeof def === 'object' && !Array.isArray(def) ? Object.assign({}, def, v) : v; } catch (e) { return def; } }
const gravarCfg = (k, v, por) => q('INSERT INTO config (k, v, em, por) VALUES (?,?,?,?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, em = excluded.em, por = excluded.por').run(k, JSON.stringify(v), agoraISO(), por || null);
const GERAL_PADRAO = { marca: 'BXB', descricao: 'Planeamento financeiro e tesouraria', urlPublico: '', emailSuporte: '' };
const SMTP_PADRAO = { servidor: 'smtp.gmail.com', porta: 465, seguranca: 'ssl', utilizador: '', palavra: '', remetente: '', nomeRemetente: '' };
const geral = () => cfg('geral', GERAL_PADRAO);
const linkPublico = () => (geral().urlPublico || urlSite()).replace(/\/+$/, '') + '/';
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

/* ================= Email (SMTP) =================
   Cliente SMTP mínimo: SSL na porta 465 ou STARTTLS na 587, autenticação AUTH LOGIN.
   Com o Gmail: smtp.gmail.com, 465, o endereço Gmail e uma palavra-passe de aplicação (a da conta não funciona). */
const b64 = t => Buffer.from(String(t), 'utf8').toString('base64');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x]));
// cabeçalho com acentos: palavras codificadas (RFC 2047) de ~45 bytes, sem partir carateres
function cabecalho(t) {
  t = String(t || '').replace(/[\r\n]+/g, ' '); if (/^[\x20-\x7e]*$/.test(t)) return t;
  const partes = []; let atual = '';
  for (const ch of t) { if (Buffer.byteLength(atual + ch) > 45) { partes.push(atual); atual = ''; } atual += ch; }
  if (atual) partes.push(atual); return partes.map(p => '=?UTF-8?B?' + b64(p) + '?=').join('\r\n ');
}
function montarMensagem({ de, nomeDe, para, assunto, html, texto }) {
  const fronteira = 'bxb-' + crypto.randomBytes(12).toString('hex'), dominio = String(de).split('@')[1] || 'localhost';
  const linhas76 = s => b64(s).replace(/.{1,76}/g, '$&\r\n');
  const nome = !nomeDe ? '' : /^[\x20-\x7e]*$/.test(nomeDe) ? '"' + nomeDe.replace(/["\\\r\n]/g, '') + '" ' : cabecalho(nomeDe) + ' ';
  return [`From: ${nome}<${de}>`, `To: <${para}>`, `Subject: ${cabecalho(assunto)}`, `Date: ${new Date().toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: <${Date.now()}.${crypto.randomBytes(8).toString('hex')}@${dominio}>`, 'MIME-Version: 1.0', `Content-Type: multipart/alternative; boundary="${fronteira}"`, '',
    `--${fronteira}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', linhas76(texto),
    `--${fronteira}`, 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', linhas76(html),
    `--${fronteira}--`, ''].join('\r\n');
}
const smtpPronto = s => !!(s && s.servidor && s.porta && (s.remetente || s.utilizador));
function smtpEnviar(s, msg) {
  return new Promise((ok, falha) => {
    const host = String(s.servidor).trim(), porta = +s.porta || 465, de = s.remetente || s.utilizador;
    let sock = null, buf = '', linhas = [], fim = false; const fila = [], espera = [];
    const acabar = e => { if (fim) return; fim = true; clearTimeout(tempo); try { sock && sock.destroy(); } catch (x) { } e ? falha(e) : ok(); };
    const tempo = setTimeout(() => acabar(new Error('O servidor de email não respondeu a tempo')), 25000);
    // respostas completas: "250-..." continua, "250 ..." termina
    const aoDados = d => { buf += d.toString('utf8'); let i;
      while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i).replace(/\r$/, ''); buf = buf.slice(i + 1); linhas.push(l);
        if (!/^\d{3}-/.test(l)) { const r = { codigo: +l.slice(0, 3) || 0, texto: linhas.join(' ').replace(/\s+/g, ' ') }; linhas = []; espera.length ? espera.shift()(r) : fila.push(r); } } };
    const ler = () => new Promise(r => fila.length ? r(fila.shift()) : espera.push(r));
    const ligarEventos = x => { x.on('data', aoDados); x.on('error', e => acabar(new Error(e.code === 'ENOTFOUND' ? 'Servidor de email não encontrado: ' + host : e.code === 'ECONNREFUSED' ? 'O servidor de email recusou a ligação (porta ' + porta + ')' : e.message))); x.on('close', () => acabar(new Error('O servidor de email fechou a ligação'))); };
    const cmd = async (linha, aceites, mostrar) => { sock.write(linha + '\r\n'); const r = await ler();
      if (!aceites.includes(r.codigo)) { const e = new Error(r.codigo === 535 || r.codigo === 534 ? 'O servidor recusou o utilizador ou a palavra-passe' + (/gmail/i.test(host) ? ' (no Gmail use uma palavra-passe de aplicação)' : '') : `${mostrar || linha.split(' ')[0]}: ${r.texto}`); e.codigo = r.codigo; throw e; }
      return r; };
    (async () => {
      const sni = net.isIP(host) ? undefined : host;
      sock = s.seguranca === 'ssl' ? tls.connect({ host, port: porta, servername: sni }) : net.connect({ host, port: porta });
      ligarEventos(sock);
      let r = await ler(); if (r.codigo !== 220) throw new Error('Resposta inesperada do servidor: ' + r.texto);
      const ehlo = 'EHLO ' + (os.hostname().replace(/[^a-z0-9.-]/gi, '') || 'bxb');
      r = await cmd(ehlo, [250]);
      if (s.seguranca === 'starttls') {
        await cmd('STARTTLS', [220]); sock.removeAllListeners('data'); sock.removeAllListeners('close');
        sock = tls.connect({ socket: sock, servername: sni }); ligarEventos(sock);
        await new Promise(res => sock.once('secureConnect', res)); r = await cmd(ehlo, [250]);
      }
      if (s.utilizador) {
        const palavra = s.palavra ? decifrar(s.palavra) : ''; if (palavra === null) throw new Error('Não foi possível decifrar a palavra-passe guardada: volte a indicá-la');
        await cmd('AUTH LOGIN', [334]); await cmd(b64(s.utilizador), [334], 'Utilizador'); await cmd(b64(palavra), [235], 'Palavra-passe');
      }
      await cmd(`MAIL FROM:<${de}>`, [250]); await cmd(`RCPT TO:<${msg.para}>`, [250, 251], 'Destinatário');
      await cmd('DATA', [354]);
      await cmd(montarMensagem(Object.assign({ de, nomeDe: s.nomeRemetente || geral().marca }, msg)).replace(/^\./gm, '..') + '\r\n.', [250], 'Envio');
      try { sock.write('QUIT\r\n'); } catch (e) { }
      acabar();
    })().catch(acabar);
  });
}

/* Modelos de email: o texto de cada um edita-se na consola; {{variavel}} é substituída no envio */
const MODELOS = {
  'boas-vindas': { nome: 'Boas-vindas', quando: 'Quando alguém cria conta no site', vars: ['nome', 'email', 'link'],
    assunto: 'Boas-vindas à {{marca}}',
    html: '<p>Olá {{nome}},</p>\n<p>A sua conta na {{marca}} está criada. Para entrar, use o email <b>{{email}}</b> e a palavra-passe que escolheu.</p>\n<p><a class="botao" href="{{link}}">Entrar na {{marca}}</a></p>\n<p>Qualquer dúvida, responda a este email.</p>' },
  'convite': { nome: 'Convite de colaborador', quando: 'Quando o responsável de uma empresa junta alguém pelo email', vars: ['quem', 'empresa', 'email', 'link'],
    assunto: 'Convite para {{empresa}} na {{marca}}',
    html: '<p>Olá,</p>\n<p>{{quem}} juntou o email <b>{{email}}</b> à equipa de <b>{{empresa}}</b> na {{marca}}.</p>\n<p>Se já tem conta, entre com este email. Se ainda não tem, crie-a com este mesmo email e a empresa aparece logo.</p>\n<p><a class="botao" href="{{link}}">Abrir a {{marca}}</a></p>' },
  'palavra-reposta': { nome: 'Palavra-passe reposta', quando: 'Quando o administrador repõe a palavra-passe de uma conta', vars: ['nome', 'data', 'link'],
    assunto: 'A sua palavra-passe {{marca}} foi alterada',
    html: '<p>Olá {{nome}},</p>\n<p>A palavra-passe da sua conta foi reposta pelo apoio ao cliente em {{data}}. Já pode entrar com a nova palavra-passe que lhe foi indicada.</p>\n<p>Depois de entrar, mude-a em <b>A minha conta</b>.</p>\n<p><a class="botao" href="{{link}}">Entrar na {{marca}}</a></p>' },
  'verificar-email': { nome: 'Confirmação do email', quando: 'Ao criar conta, se a verificação do email estiver ligada', vars: ['nome', 'codigo'],
    assunto: '{{codigo}} é o seu código {{marca}}',
    html: '<p>Olá {{nome}},</p>\n<p>Para confirmar o seu email e terminar a criação da conta na {{marca}}, use este código:</p>\n<p class="codigo">{{codigo}}</p>\n<p>O código é válido durante 10 minutos. Se não foi você a criar a conta, ignore este email.</p>' },
  'codigo': { nome: 'Código de verificação', quando: 'Verificação em dois passos ao entrar', vars: ['nome', 'codigo'],
    assunto: '{{codigo}} é o seu código {{marca}}',
    html: '<p>Olá {{nome}},</p>\n<p>Use este código para entrar na {{marca}}:</p>\n<p class="codigo">{{codigo}}</p>\n<p>O código é válido durante 10 minutos. Se não foi você a tentar entrar, mude a palavra-passe.</p>' },
};
const EXEMPLO = { nome: 'Ana Martins', email: 'ana.martins@exemplo.pt', quem: 'Rui Costa', empresa: 'Costa & Filhos, Lda.', codigo: '483 920' };
function modelo(id) { const base = MODELOS[id]; if (!base) return null; const m = cfg('modelo:' + id, null) || {};
  return { id, nome: base.nome, quando: base.quando, vars: base.vars, assunto: m.assunto || base.assunto, html: m.html || base.html, ativo: m.ativo !== false, alterado: !!(m.assunto || m.html), em: m.em || null }; }
// moldura comum: cabeçalho com a marca, o texto do modelo e o rodapé
function moldura(corpo, g) {
  const cor = '#7c5cff', suporte = g.emailSuporte ? ` · <a href="mailto:${esc(g.emailSuporte)}" style="color:#6b7280">${esc(g.emailSuporte)}</a>` : '';
  corpo = corpo.replace(/<a class="botao"/g, `<a style="display:inline-block;background:${cor};color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px"`)
    .replace(/<p class="codigo">/g, '<p style="font-size:30px;font-weight:700;letter-spacing:6px;margin:18px 0;color:#111827">');
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f3f4f6"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2937;font-size:15px;line-height:1.6">
<tr><td style="background:linear-gradient(135deg,#7c5cff,#c056ff);background-color:${cor};padding:22px 28px;color:#ffffff;font-size:20px;font-weight:800;letter-spacing:-.3px">${esc(g.marca)}</td></tr>
<tr><td style="padding:26px 28px 8px">${corpo}</td></tr>
<tr><td style="padding:16px 28px 24px;color:#6b7280;font-size:12px;border-top:1px solid #e5e7eb">${esc(g.marca)} · ${esc(g.descricao)}${suporte}</td></tr>
</table></td></tr></table></body></html>`;
}
function preencher(m, vars) {
  const g = geral(), todas = Object.assign({ marca: g.marca, link: linkPublico(), data: new Date().toLocaleString('pt-PT', { dateStyle: 'long', timeStyle: 'short' }) }, vars);
  const sub = (t, html) => String(t).replace(/\{\{\s*([a-z]+)\s*\}\}/gi, (x, k) => todas[k] == null ? '' : html ? esc(todas[k]) : String(todas[k]));
  const corpo = sub(m.html, true), html = moldura(corpo, g);
  const texto = corpo.replace(/<a [^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '$2: $1').replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>\s*/gi, '\n\n').replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim() + `\n\n--\n${g.marca} · ${g.descricao}`;
  return { assunto: sub(m.assunto, false).replace(/[\r\n]+/g, ' '), html, texto };
}
async function enviarEmail(para, conteudo, modeloId) {
  const s = cfg('smtp', SMTP_PADRAO);
  if (!smtpPronto(s)) throw new Error('O email ainda não está configurado (consola de gestão > Email)');
  try { await smtpEnviar(s, Object.assign({ para }, conteudo)); q('INSERT INTO emails (em, para, modelo, assunto, estado) VALUES (?,?,?,?,?)').run(agoraISO(), para, modeloId || null, conteudo.assunto, 'enviado'); }
  catch (e) { q('INSERT INTO emails (em, para, modelo, assunto, estado, erro) VALUES (?,?,?,?,?,?)').run(agoraISO(), para, modeloId || null, conteudo.assunto, 'falhou', e.message); console.error(`  [email] ${modeloId || 'envio'} para ${para}: ${e.message}`); throw e; }
}
// avisos automáticos: só se o email estiver configurado e o modelo ativo; nunca atrasam nem impedem o pedido
function avisar(id, para, vars) {
  const m = modelo(id); if (!m || !m.ativo || !para || !smtpPronto(cfg('smtp', SMTP_PADRAO))) return;
  enviarEmail(para, preencher(m, vars), id).catch(() => { });
}

// criar conta (depois do passo 1, ou do passo 2 quando o email tem de ser confirmado): abre logo a sessão e pede o perfil completo
const REGISTO_PADRAO = { verificarEmail: false };
const verificarRegisto = () => !!cfg('registo', REGISTO_PADRAO).verificarEmail && smtpPronto(cfg('smtp', SMTP_PADRAO));
function enviarCodigo(d, codigo) { return enviarEmail(d.email, preencher(modelo('verificar-email'), { nome: d.nome.split(' ')[0], email: d.email, codigo: codigo.slice(0, 3) + ' ' + codigo.slice(3) }), 'verificar-email'); }
function criarConta(d, req, res, ip) {
  const nova = { id: novoId('c'), nome: d.nome, email: d.email };
  const area = transacao(() => {
    q('INSERT INTO contas (id, nome, email, utilizador, hash, admin, ativo, criada_em, perfil) VALUES (?,?,?,?,?,0,1,?,?)')
      .run(nova.id, d.nome, d.email, d.email, d.hash, agoraISO(), JSON.stringify({ pendente: true, tipo: d.tipo, verificado: !!d.verificado }));
    return d.tipo === 'particular' ? novaArea(nova, 'particular', d.nome) : null;
  });
  aceitarConvites(nova);
  registar(nova.id, d.verificado ? 'CONTA_CRIADA_VERIFICADA' : 'CONTA_CRIADA', area || 'empresa', ip); abrirSessao(req, res, nova); avisar('boas-vindas', d.email, { nome: d.nome, email: d.email });
  return { sessao: publica(conta(nova.id)), completar: true, destino: area ? destinoDe(area) : '/SISTEMAS/index.html' };
}

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

// alterações a uma conta feitas pela administração (acessos.html no site ou a consola de gestão).
// por = { id: conta de quem altera (null na consola aberta pelo Gestor), hash: sessão a manter }. Devolve o erro ou null.
function alterarConta(x, b, por) {
  const proprio = !!por.id && por.id === x.id;
  const email = b.email !== undefined ? String(b.email || '').trim().toLowerCase() : undefined;
  if (email !== undefined) { if (!EMAIL.test(email)) return 'Email inválido'; const outra = contaPorEmail(email); if (outra && outra.id !== x.id) return 'Esse email já está noutra conta'; }
  if (b.palavra && String(b.palavra).length < 8) return 'A palavra-passe tem de ter pelo menos 8 caracteres';
  const ultimoAdmin = !!x.admin && !!x.ativo && !q('SELECT 1 FROM contas WHERE admin = 1 AND ativo = 1 AND id <> ?').get(x.id);
  if (b.ativo !== undefined && !b.ativo) { if (proprio) return 'Não pode desativar a sua própria conta'; if (ultimoAdmin) return 'É a única conta de administrador ativa'; }
  if (b.admin !== undefined && !b.admin && ultimoAdmin) return 'É a única conta de administrador ativa';
  transacao(() => {
    if (email !== undefined) q('UPDATE contas SET email = ? WHERE id = ?').run(email, x.id);
    if (b.nome) q('UPDATE contas SET nome = ? WHERE id = ?').run(String(b.nome).trim().slice(0, 80), x.id);
    if (b.ativo !== undefined) { q('UPDATE contas SET ativo = ? WHERE id = ?').run(b.ativo ? 1 : 0, x.id); if (!b.ativo) terminarSessoes(x.id); }
    if (b.admin !== undefined && !proprio) q('UPDATE contas SET admin = ? WHERE id = ?').run(b.admin ? 1 : 0, x.id);
    if (b.palavra) { q('UPDATE contas SET hash = ? WHERE id = ?').run(hashPalavra(b.palavra), x.id); terminarSessoes(x.id, proprio ? por.hash : ''); }
  });
  if (b.palavra && !proprio && b.avisar !== false) avisar('palavra-reposta', email || x.email, { nome: b.nome || x.nome });
  return null;
}

async function api(req, res, caminho) {
  const json = (codigo, obj) => { res.writeHead(codigo, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Servidor': ASSINATURA }); res.end(JSON.stringify(obj)); };
  // proteção CSRF: pedidos que alteram dados têm de vir desta mesma origem
  if (req.method !== 'GET' && req.headers['x-bxb'] !== '1') return json(403, { erro: 'Pedido recusado' });
  const s = sessaoDe(req), c = s && s.conta, ip = ipDe(req);
  const configurado = !!q('SELECT 1 FROM contas LIMIT 1').get();

  if (caminho === '/api/estado' && req.method === 'GET') return json(200, { configurado, sessao: c ? publica(c) : null, verificarEmail: verificarRegisto() });

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
  // criar conta, passo 1: só o essencial. Se a verificação do email estiver ligada, envia um código e a conta só é criada depois de o confirmar.
  if (caminho === '/api/registar' && req.method === 'POST') {
    if (!configurado) return json(409, { erro: 'O servidor ainda não está configurado' });
    const r0 = registos.get(ip), agora = Date.now();
    if (r0 && agora - r0.desde < 3600000 && r0.n >= 5) return json(429, { erro: 'Demasiadas contas criadas a partir deste endereço. Tente mais tarde.' });
    const b = await lerCorpo(req), tipo = b.tipo === 'empresa' ? 'empresa' : 'particular';
    const nome = String(b.nome || '').trim().slice(0, 80), email = String(b.email || '').trim().toLowerCase();
    if (!nome) return json(400, { erro: 'Indique o seu nome' });
    if (!EMAIL.test(email) || email.length > 120) return json(400, { erro: 'Indique um email válido' });
    if (String(b.palavra || '').length < 8) return json(400, { erro: 'A palavra-passe tem de ter pelo menos 8 caracteres' });
    if (contaPorEmail(email)) return json(409, { erro: 'Já existe uma conta com esse email' });
    registos.set(ip, r0 && agora - r0.desde < 3600000 ? { n: r0.n + 1, desde: r0.desde } : { n: 1, desde: agora });
    const d = { tipo, nome, email, hash: hashPalavra(b.palavra) };
    if (!verificarRegisto()) return json(200, criarConta(d, req, res, ip));
    for (const [k, p] of porVerificar) if (p.email === email || p.expira < agora) porVerificar.delete(k);
    if (porVerificar.size > 500) return json(429, { erro: 'Muitos pedidos neste momento. Tente daqui a alguns minutos.' });
    const pedido = crypto.randomBytes(16).toString('hex'), codigo = novoCodigo();
    try { await enviarCodigo(d, codigo); } catch (e) { return json(502, { erro: 'Não foi possível enviar o código para esse email. Confirme o endereço e tente de novo.' }); }
    porVerificar.set(pedido, Object.assign(d, { codigo: resumo(codigo), expira: agora + 600000, tentativas: 0, enviados: 1, ultimo: agora }));
    return json(200, { verificar: true, pedido, email });
  }
  // passo 2: o código que chegou por email
  if (caminho === '/api/registar/codigo' && req.method === 'POST') {
    const b = await lerCorpo(req), k = String(b.pedido || ''), p = porVerificar.get(k);
    if (!p || p.expira < Date.now()) { porVerificar.delete(k); return json(410, { erro: 'O código expirou. Volte atrás e peça um novo.' }); }
    if (resumo(String(b.codigo || '').replace(/\D/g, '')) !== p.codigo) {
      if (++p.tentativas >= 5) { porVerificar.delete(k); return json(429, { erro: 'Demasiadas tentativas. Volte atrás e comece de novo.' }); }
      return json(400, { erro: 'Código incorreto. ' + (5 - p.tentativas === 1 ? 'Resta 1 tentativa.' : 'Restam ' + (5 - p.tentativas) + ' tentativas.') });
    }
    porVerificar.delete(k);
    if (contaPorEmail(p.email)) return json(409, { erro: 'Já existe uma conta com esse email' });
    p.verificado = true; return json(200, criarConta(p, req, res, ip));
  }
  if (caminho === '/api/registar/reenviar' && req.method === 'POST') {
    const b = await lerCorpo(req), p = porVerificar.get(String(b.pedido || '')), agora = Date.now();
    if (!p || p.expira < agora) return json(410, { erro: 'O pedido expirou. Volte atrás e comece de novo.' });
    if (agora - p.ultimo < 30000) return json(429, { erro: 'Aguarde uns segundos antes de pedir outro código.' });
    if (p.enviados >= 5) return json(429, { erro: 'Já enviámos vários códigos. Volte atrás e comece de novo.' });
    const codigo = novoCodigo();
    try { await enviarCodigo(p, codigo); } catch (e) { return json(502, { erro: 'Não foi possível enviar o código. Tente de novo.' }); }
    Object.assign(p, { codigo: resumo(codigo), expira: agora + 600000, tentativas: 0, enviados: p.enviados + 1, ultimo: agora });
    return json(200, { ok: true });
  }
  if (caminho === '/api/sair' && req.method === 'POST') { if (s) { q('DELETE FROM sessoes WHERE hash = ?').run(s.hash); registar(c.id, 'SAIDA', null, ip); } res.setHeader('Set-Cookie', 'bxb_sessao=; Path=/; Max-Age=0'); return json(200, { ok: true }); }

  if (!c) return json(401, { erro: 'Sessão expirada' });

  // criar conta, passo 3: o perfil completo. Um particular já tem a área pessoal; uma empresa recebe aqui a área da empresa.
  if (caminho === '/api/perfil' && req.method === 'POST') {
    const b = await lerCorpo(req), antes = perfilDe(c), tipo = b.tipo === 'empresa' ? 'empresa' : 'particular', pais = b.pais === 'br' ? 'br' : 'pt';
    const txt = (v, n) => String(v || '').trim().slice(0, n), doc = String(b.documento || '').replace(/\D/g, ''), telefone = txt(b.telefone, 30);
    if (telefone.replace(/\D/g, '').length < 8) return json(400, { erro: pais === 'br' ? 'Indique um celular válido' : 'Indique um número de telemóvel válido' });
    const p = { pendente: false, tipo, pais, telefone, documento: doc, verificado: !!antes.verificado, em: agoraISO() };
    let area;
    if (tipo === 'empresa') {
      const empresa = txt(b.empresa, 80); if (!empresa) return json(400, { erro: 'Indique o nome da empresa' });
      if (doc && doc.length !== (pais === 'br' ? 14 : 9)) return json(400, { erro: pais === 'br' ? 'O CNPJ tem 14 dígitos' : 'O NIF da empresa tem 9 dígitos' });
      Object.assign(p, { empresa, setor: txt(b.setor, 40), dimensao: txt(b.dimensao, 20), cargo: txt(b.cargo, 60) });
      const ja = areasDe(c.id).find(a => a.tipo === 'empresa' && a.papel === 'dono');
      area = ja ? ja.id : novaArea(c, 'empresa', empresa, { nif: doc, setor: p.setor });
    } else {
      if (doc && doc.length !== (pais === 'br' ? 11 : 9)) return json(400, { erro: pais === 'br' ? 'O CPF tem 11 dígitos' : 'O NIF tem 9 dígitos' });
      const nasc = txt(b.nascimento, 10); if (nasc && !/^\d{4}-\d{2}-\d{2}$/.test(nasc)) return json(400, { erro: 'Data de nascimento inválida' });
      Object.assign(p, { nascimento: nasc, situacao: txt(b.situacao, 40), objetivo: txt(b.objetivo, 40) });
      const ja = areasDe(c.id).find(a => a.tipo === 'particular' && a.papel === 'dono');
      area = ja ? ja.id : novaArea(c, 'particular', c.nome);
    }
    if (doc) { const a = q('SELECT config FROM areas WHERE id = ?').get(area); if (a) { const x = JSON.parse(a.config); if (!x.nif) { x.nif = doc; q('UPDATE areas SET config = ? WHERE id = ?').run(JSON.stringify(x), area); } } }
    q('UPDATE contas SET perfil = ? WHERE id = ?').run(JSON.stringify(p), c.id); registar(c.id, 'PERFIL_COMPLETO', tipo, ip);
    return json(200, { destino: destinoDe(area), sessao: publica(conta(c.id)) });
  }
  if (caminho === '/api/palavra' && req.method === 'POST') {
    const b = await lerCorpo(req); if (!confere(b.atual, c.hash)) return json(400, { erro: 'Palavra-passe atual incorreta' });
    if (String(b.nova || '').length < 8) return json(400, { erro: 'A nova palavra-passe tem de ter pelo menos 8 caracteres' });
    q('UPDATE contas SET hash = ? WHERE id = ?').run(hashPalavra(b.nova), c.id); terminarSessoes(c.id, s.hash); registar(c.id, 'PALAVRA_ALTERADA', null, ip); return json(200, { ok: true });
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
      const x = contaPorEmail(email), ja = x && papelEm(x.id, area);
      if (x) q("INSERT OR IGNORE INTO membros (area, conta, papel, desde) VALUES (?,?, 'colaborador', ?)").run(area, x.id, agoraISO());
      else q('INSERT OR REPLACE INTO convites (area, email, por, em) VALUES (?,?,?,?)').run(area, email, c.id, agoraISO());
      if (!ja) { const a = q('SELECT nome FROM areas WHERE id = ?').get(area); avisar('convite', email, { quem: c.nome, empresa: a ? a.nome : '', email }); }
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
      const erro = alterarConta(x, b, { id: c.id, hash: s.hash }); if (erro) return json(400, { erro });
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
  if (caminho === '/entrar') { res.writeHead(302, { Location: '/?acesso=entrar', 'X-Servidor': ASSINATURA }); return res.end(); }
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
const ipsLocais = () => Object.values(os.networkInterfaces()).flat().filter(x => x && x.family === 'IPv4' && !x.internal).map(x => x.address);
let servidorRede = null;
function abrirRede() {
  const cert = path.join(PASTA_TLS, 'cert.pem'), key = path.join(PASTA_TLS, 'key.pem');
  if (!fs.existsSync(cert) || !fs.existsSync(key)) return;
  const ips = ipsLocais();
  const LOG = path.join(DADOS, 'rede.log'), registo = t => { try { fs.appendFileSync(LOG, new Date().toISOString() + ' ' + t + '\n'); } catch (e) { } };
  const seguro = https.createServer({ cert: fs.readFileSync(cert), key: fs.readFileSync(key) }, (req, res) => { registo(`${req.socket.remoteAddress} ${req.method} ${req.url}`); atender(req, res); });
  seguro.on('tlsClientError', (e, sock) => registo(`${sock && sock.remoteAddress} erro TLS: ${e.code || e.message}`));
  const reencaminhar = http.createServer((req, res) => { registo(`${req.socket.remoteAddress} http -> https ${req.url}`); res.writeHead(301, { Location: `https://${req.headers.host || ips[0] + ':' + PORT_REDE}${req.url}` }); res.end(); });
  servidorRede = net.createServer(sock => {
    sock.on('error', () => {});
    sock.once('data', buf => { sock.pause(); sock.unshift(buf); (buf[0] === 22 ? seguro : reencaminhar).emit('connection', sock); process.nextTick(() => sock.resume()); });
  }).on('error', e => console.error(`  [rede] Nao foi possivel abrir a porta ${PORT_REDE}: ${e.message}`))
    .listen(PORT_REDE, '0.0.0.0', () => {
      portas.rede = PORT_REDE;
      registo(`servidor de rede aberto na porta ${PORT_REDE} (${ips.join(', ')})`);
      console.log('  Rede de casa (telemovel, outros computadores):');
      ips.forEach(ip => console.log(`    https://${ip}:${PORT_REDE}/SISTEMAS/index.html`));
      console.log('');
    });
}

/* ================= Consola de gestão (http://127.0.0.1:8099, só neste computador) =================
   Entra-se com um bilhete de uso único pedido pelo BXB Gestor (que lê DADOS-SERVIDOR\gestao.chave) ou com uma conta de administrador.
   Proteções: só aceita o nome 127.0.0.1/localhost (contra DNS rebinding), pedidos que alteram têm o cabeçalho X-BXB e a mesma origem. */
const GESTAO_DIR = path.join(RAIZ, 'SISTEMAS', 'gestao');
const DURACAO_GESTAO = 12 * 3600 * 1000;
const VERSAO = versaoCodigo();
let CHAVE_GESTAO = null;
function chaveGestao(nova) {
  if (!nova && CHAVE_GESTAO) return CHAVE_GESTAO;
  if (!nova) { try { const t = fs.readFileSync(FICH_GESTAO, 'utf8').trim(); if (/^[a-f0-9]{64}$/.test(t)) return (CHAVE_GESTAO = t); } catch (e) { } }
  CHAVE_GESTAO = crypto.randomBytes(32).toString('hex'); fs.writeFileSync(FICH_GESTAO, CHAVE_GESTAO, { mode: 0o600 }); return CHAVE_GESTAO;
}
function versaoCodigo() {
  try { const git = path.join(RAIZ, '.git'); let h = fs.readFileSync(path.join(git, 'HEAD'), 'utf8').trim();
    if (h.startsWith('ref: ')) { const ref = h.slice(5), f = path.join(git, ref);
      h = fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trim() : (fs.readFileSync(path.join(git, 'packed-refs'), 'utf8').split('\n').find(l => l.trim().endsWith(' ' + ref)) || '').split(' ')[0]; }
    return h.slice(0, 7) || null; } catch (e) { return null; }
}

// Perfis da consola: separados das áreas e dos dados dos clientes.
const ACESSOS_GESTAO = ['painel','utilizadores','email','registos','definicoes','operadores'];
function perfisGestao() { return cfg('gestao:perfis', { perfis: [], operadores: {} }); }
function acessosGestao(c) {
  if (c && c.admin) return ACESSOS_GESTAO.slice();
  const p = perfisGestao(), id = c && p.operadores[c.id], perfil = p.perfis.find(x => x.id === id);
  return perfil ? perfil.acessos.filter(x => ACESSOS_GESTAO.includes(x)) : [];
}

const bilhetes = new Map(); // bilhete de uso único (60 s) com que o Gestor abre a consola no browser
const igual = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const assinar = t => crypto.createHmac('sha256', chaveGestao()).update(t).digest('hex');
// cookie da consola "expira.quem.assinatura": sobrevive a reinícios; uma chave nova fecha todas as sessões da consola
function quemGestao(req) {
  const auth = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization || '');
  if (auth) return igual(auth[1], chaveGestao()) ? { quem: 'gestor', nome: 'BXB Gestor', chave: true } : null;
  const m = /(?:^|;\s*)bxb_gestao=(\d+)\.([A-Za-z0-9_-]+)\.([a-f0-9]{64})/.exec(req.headers.cookie || ''); if (!m) return null;
  if (+m[1] < Date.now() || !igual(m[3], assinar(m[1] + '.' + m[2]))) return null;
  if (m[2] === 'gestor') return { quem: 'gestor', nome: 'BXB Gestor' };
  const c = conta(m[2]); return c && c.ativo && acessosGestao(c).length ? { quem: c.id, nome: c.nome, conta: c } : null;
}
function cookieGestao(res, quem) { const v = (Date.now() + DURACAO_GESTAO) + '.' + quem;
  res.setHeader('Set-Cookie', `bxb_gestao=${v}.${assinar(v)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${DURACAO_GESTAO / 1000}`); }
function enderecos() {
  const l = [{ nome: 'Site neste computador', url: urlSite() }];
  if (portas.rede) ipsLocais().forEach(ip => l.push({ nome: 'Rede de casa (' + ip + ')', url: `https://${ip}:${portas.rede}/` }));
  const pub = geral().urlPublico; if (pub) l.push({ nome: 'Endereço público', url: pub });
  if (portas.gestao) l.push({ nome: 'Consola de gestão', url: `http://127.0.0.1:${portas.gestao}/` });
  return l;
}
function registoLista(f) {
  const onde = [], a = [];
  if (!f.leituras) onde.push("r.acao <> 'LEITURA'");
  if (f.acao) { onde.push('r.acao LIKE ?'); a.push(String(f.acao).toUpperCase() + '%'); }
  if (f.conta) { onde.push('r.conta = ?'); a.push(String(f.conta)); }
  if (f.texto) { onde.push('(c.nome LIKE ? OR c.email LIKE ? OR r.alvo LIKE ? OR r.ip LIKE ?)'); const t = '%' + String(f.texto).slice(0, 80) + '%'; a.push(t, t, t, t); }
  if (f.antes) { onde.push('r.em < ?'); a.push(String(f.antes)); }
  return q(`SELECT r.em, r.acao, r.alvo, r.ip, r.conta, c.nome, c.email FROM registo r LEFT JOIN contas c ON c.id = r.conta ${onde.length ? 'WHERE ' + onde.join(' AND ') : ''} ORDER BY r.em DESC LIMIT ?`)
    .all(...a, Math.min(500, Math.max(1, +f.limite || 200)));
}
function painel() {
  const agora = Date.now(), desde = d => new Date(agora - d * 864e5).toISOString(), n = (sql, ...a) => q(sql).get(...a).n;
  let tamBD = 0; try { tamBD = fs.statSync(FICH_BD).size + (fs.existsSync(FICH_BD + '-wal') ? fs.statSync(FICH_BD + '-wal').size : 0); } catch (e) { }
  const copias = fs.existsSync(PASTA_COPIAS) ? fs.readdirSync(PASTA_COPIAS).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort() : [], s = cfg('smtp', SMTP_PADRAO);
  return {
    servidor: { pid: process.pid, arranque: ARRANQUE, node: process.version, memoria: process.memoryUsage().rss, versao: VERSAO, versaoDisco: versaoCodigo(), portas, enderecos: enderecos(),
      dados: DADOS, bd: tamBD, copias: copias.length, ultimaCopia: copias[copias.length - 1] || null },
    contas: { total: n('SELECT COUNT(*) n FROM contas'), ativas: n('SELECT COUNT(*) n FROM contas WHERE ativo = 1'), admins: n('SELECT COUNT(*) n FROM contas WHERE admin = 1 AND ativo = 1'),
      novas30: n('SELECT COUNT(*) n FROM contas WHERE criada_em >= ?', desde(30)), sessoes: n('SELECT COUNT(*) n FROM sessoes WHERE expira > ?', agora),
      comSessao: n('SELECT COUNT(DISTINCT conta) n FROM sessoes WHERE expira > ?', agora) },
    areas: { particular: n("SELECT COUNT(*) n FROM areas WHERE tipo = 'particular'"), empresa: n("SELECT COUNT(*) n FROM areas WHERE tipo = 'empresa'") },
    entradas: { d7: n("SELECT COUNT(*) n FROM registo WHERE acao = 'ENTRADA' AND em >= ?", desde(7)), falhadas7: n("SELECT COUNT(*) n FROM registo WHERE acao = 'ENTRADA_FALHADA' AND em >= ?", desde(7)),
      recusados7: n("SELECT COUNT(*) n FROM registo WHERE acao = 'ACESSO_RECUSADO' AND em >= ?", desde(7)) },
    email: { pronto: smtpPronto(s), conta: s.utilizador || s.remetente || '', enviados7: n("SELECT COUNT(*) n FROM emails WHERE estado = 'enviado' AND em >= ?", desde(7)),
      falhados7: n("SELECT COUNT(*) n FROM emails WHERE estado = 'falhou' AND em >= ?", desde(7)) },
    geral: geral(), atividade: registoLista({ limite: 8 }),
  };
}
const contasLista = () => q(`SELECT c.id, c.nome, c.email, c.admin, c.ativo, c.criada_em,
    (SELECT MAX(em) FROM registo r WHERE r.conta = c.id AND r.acao = 'ENTRADA') AS ultima,
    (SELECT COUNT(*) FROM sessoes s WHERE s.conta = c.id AND s.expira > ?) AS sessoes
  FROM contas c ORDER BY c.criada_em DESC`).all(Date.now()).map(x => Object.assign(x, { admin: !!x.admin, ativo: !!x.ativo,
    areas: q("SELECT a.id, a.tipo, a.nome, m.papel FROM membros m JOIN areas a ON a.id = m.area WHERE m.conta = ? AND a.tipo <> 'arquivo' ORDER BY a.criada_em").all(x.id) }));
const smtpPublico = s => Object.assign({}, s, { palavra: undefined, temPalavra: !!s.palavra });
function cauda(f, linhas) { try { const st = fs.statSync(f), n = Math.min(st.size, 256 * 1024), b = Buffer.alloc(n), fd = fs.openSync(f, 'r');
  fs.readSync(fd, b, 0, n, st.size - n); fs.closeSync(fd); return b.toString('utf8').split(/\r?\n/).filter(Boolean).slice(-linhas); } catch (e) { return []; } }

async function apiGestao(req, res, caminho) {
  const json = (codigo, obj) => { res.writeHead(codigo, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };
  const qs = Object.fromEntries(new URL(req.url, 'http://x').searchParams);
  // estado para o Gestor (sem sessão): está ligado? com que processo e portas?
  if (caminho === '/api/gestao/saude') return json(200, { ok: true, servidor: ASSINATURA, pid: process.pid, arranque: ARRANQUE, versao: VERSAO, portas, enderecos: enderecos() });
  if (req.method !== 'GET' && req.headers['x-bxb'] !== '1') return json(403, { erro: 'Pedido recusado' });
  if (caminho === '/api/gestao/entrar' && req.method === 'POST') {
    const b = await lerCorpo(req);
    if (b.bilhete) { const k = String(b.bilhete), t = bilhetes.get(k); bilhetes.delete(k);
      if (!t || t < Date.now()) return json(401, { erro: 'Este acesso já expirou. Abra a consola de novo pelo BXB Gestor.' });
      cookieGestao(res, 'gestor'); registar(null, 'GESTAO_ENTRADA', 'BXB Gestor', 'local'); return json(200, { ok: true }); }
    const u = String(b.email || '').trim().toLowerCase(), chaveF = 'gestao:' + u, f = falhas.get(chaveF);
    if (f && f.ate > Date.now()) return json(429, { erro: 'Demasiadas tentativas. Tente de novo dentro de alguns minutos.' });
    const x = u && contaPorEmail(u);
    if (!x || !x.ativo || !acessosGestao(x).length || !confere(b.palavra, x.hash)) { const n = (f && f.ate && f.ate <= Date.now() ? 0 : (f ? f.n : 0)) + 1;
      falhas.set(chaveF, { n, ate: n >= 5 ? Date.now() + 5 * 60000 : 0 }); registar(x && x.id, 'GESTAO_ENTRADA_FALHADA', u, 'local');
      return json(401, { erro: 'Email ou palavra-passe incorretos, ou a conta não tem acesso à consola' }); }
    falhas.delete(chaveF); cookieGestao(res, x.id); registar(x.id, 'GESTAO_ENTRADA', null, 'local'); return json(200, { ok: true });
  }
  if (caminho === '/api/gestao/sair' && req.method === 'POST') { res.setHeader('Set-Cookie', 'bxb_gestao=; Path=/; Max-Age=0'); return json(200, { ok: true }); }

  const g = quemGestao(req); if (!g) return json(401, { erro: 'Sem sessão na consola' });
  const acessos = g.conta ? acessosGestao(g.conta) : ACESSOS_GESTAO.slice();
  const superAdmin = !g.conta || !!g.conta.admin;
  const recurso = caminho.slice('/api/gestao/'.length).split('/')[0];
  const permissao = ({painel:'painel',contas:'utilizadores',conta:'utilizadores',email:'email',registo:'registos',consola:'registos',rede:'registos',definicoes:'definicoes','chave-nova':'definicoes',desligar:'definicoes',perfis:'operadores',operadores:'operadores'})[recurso];
  if (permissao && !acessos.includes(permissao)) return json(403, {erro:'O seu perfil não permite esta operação'});
  // Só os administradores podem mudar a segurança da consola e as credenciais dos administradores.
  if (!superAdmin && ((['perfis','operadores'].includes(recurso) && req.method !== 'GET') || recurso === 'chave-nova')) return json(403,{erro:'Esta operação requer um administrador'});
  const por = g.conta ? g.conta.id : null, reg = (acao, alvo) => registar(por, acao, alvo, 'consola');
  const corpo = () => req.method === 'GET' ? Promise.resolve(qs) : lerCorpo(req);

  if (caminho === '/api/gestao/bilhete' && req.method === 'POST') {
    if (!g.chave) return json(403, { erro: 'Só o BXB Gestor' });
    const t = crypto.randomBytes(24).toString('hex'), agora = Date.now(); for (const [k, v] of bilhetes) if (v < agora) bilhetes.delete(k);
    bilhetes.set(t, agora + 60000); return json(200, { bilhete: t });
  }
  if (caminho === '/api/gestao/desligar' && req.method === 'POST') { json(200, { ok: true }); setTimeout(() => desligar(g.nome), 150); return; }
  if (caminho === '/api/gestao/dashboard' && req.method === 'GET') {
    const resumo = {};
    if(acessos.includes('painel')) resumo.painel = { rotulo:'Servidor', valor:'Ligado', detalhe:'Em funcionamento desde ' + new Date(ARRANQUE).toLocaleString('pt-PT') };
    if(acessos.includes('utilizadores')) resumo.utilizadores = { rotulo:'Contas ativas', valor:q('SELECT COUNT(*) n FROM contas WHERE ativo=1').get().n };
    if(acessos.includes('email')) resumo.email = { rotulo:'Email', valor:smtpPronto(cfg('smtp',SMTP_PADRAO))?'Configurado':'Por configurar' };
    if(acessos.includes('registos')) resumo.registos = { rotulo:'Atividade hoje', valor:q('SELECT COUNT(*) n FROM registo WHERE em >= ?').get(new Date().toISOString().slice(0,10)).n };
    if(acessos.includes('definicoes')) resumo.definicoes = { rotulo:'Projeto', valor:geral().marca };
    if(acessos.includes('operadores')) resumo.operadores = { rotulo:'Perfis disponíveis', valor:perfisGestao().perfis.length };
    return json(200,{resumo});
  }
  if (caminho === '/api/gestao/quem') return json(200, { quem: g.quem, nome: g.nome, marca: geral().marca, acessos, administrador: superAdmin });
  if (caminho === '/api/gestao/painel') return json(200, painel());

  if (caminho === '/api/gestao/perfis') {
    const p=perfisGestao();
    if(req.method==='GET') return json(200,{perfis:p.perfis,acessos:ACESSOS_GESTAO});
    if(req.method!=='POST') return json(405,{erro:'Método não permitido'});
    const b=await corpo(), nome=String(b.nome||'').trim().slice(0,80);
    if(!nome || !Array.isArray(b.acessos) || b.acessos.some(x=>!ACESSOS_GESTAO.includes(x))) return json(400,{erro:'Indique o nome e acessos válidos'});
    const id=b.id ? String(b.id) : novoId('perfil'), antigo=p.perfis.find(x=>x.id===id);
    if(b.id && !antigo) return json(404,{erro:'Perfil não encontrado'});
    if(p.perfis.some(x=>x.id!==id && x.nome.toLowerCase()===nome.toLowerCase())) return json(409,{erro:'Já existe um perfil com esse nome'});
    const novo={id,nome,acessos:[...new Set(b.acessos)]};
    if(antigo) p.perfis[p.perfis.indexOf(antigo)]=novo; else p.perfis.push(novo);
    gravarCfg('gestao:perfis',p,por);reg('GESTAO_PERFIL_GUARDADO',id);return json(200,novo);
  }
  if(caminho === '/api/gestao/operadores') {
    const p=perfisGestao();
    if(req.method==='GET') return json(200,{perfis:p.perfis,operadores:contasLista().map(c=>({id:c.id,nome:c.nome,email:c.email,admin:c.admin,ativo:c.ativo,perfil:p.operadores[c.id]||''}))});
    if(req.method!=='POST') return json(405,{erro:'Método não permitido'});
    const b=await corpo(), perfil=String(b.perfil||'');
    if(perfil && !p.perfis.some(x=>x.id===perfil)) return json(400,{erro:'Perfil não encontrado'});
    let id=b.id && String(b.id);
    if(!id) {
      const nome=String(b.nome||'').trim().slice(0,80), email=String(b.email||'').trim().toLowerCase();
      if(!nome || !EMAIL.test(email) || String(b.palavra||'').length<8 || !perfil) return json(400,{erro:'Indique nome, email, perfil e palavra-passe com pelo menos 8 caracteres'});
      if(contaPorEmail(email)) return json(409,{erro:'Esse email já tem conta. Atribua-lhe um perfil na lista.'});
      id=novoId('c');q('INSERT INTO contas (id,nome,email,utilizador,hash,admin,ativo,criada_em) VALUES (?,?,?,?,?,0,1,?)').run(id,nome,email,email,hashPalavra(b.palavra),agoraISO());
    }
    const x=conta(id);if(!x) return json(404,{erro:'Conta não encontrada'});
    if(x.admin) return json(400,{erro:'Os administradores mantêm acesso completo'});
    if(perfil) p.operadores[id]=perfil; else delete p.operadores[id];
    gravarCfg('gestao:perfis',p,por);reg('GESTAO_OPERADOR_ALTERADO',id);return json(200,{ok:true,id});
  }
  // utilizadores
  if (caminho === '/api/gestao/contas') return json(200, contasLista());
  if (caminho === '/api/gestao/conta') {
    const b = await corpo(), x = b.id && conta(String(b.id)); if (!x) return json(404, { erro: 'Conta não encontrada' });
    if (req.method === 'POST') { if (!superAdmin && (x.admin || acessosGestao(x).length || b.admin !== undefined)) return json(403,{erro:'Só um administrador pode alterar contas com acesso à consola'}); const erro = alterarConta(x, b, { id: por, hash: null }); if (erro) return json(400, { erro });
      reg('ADMIN_CONTA_ALTERADA', x.id + (b.palavra ? ' palavra-passe' : '') + (b.ativo !== undefined ? (b.ativo ? ' ativada' : ' desativada') : '')); }
    const y = contasLista().find(r => r.id === x.id);
    return json(200, { conta: y, sessoes: q('SELECT rowid AS id, criada, visto, ip, agente, expira FROM sessoes WHERE conta = ? AND expira > ? ORDER BY visto DESC').all(x.id, Date.now()),
      registo: registoLista({ conta: x.id, limite: 40 }) });
  }
  if (caminho === '/api/gestao/conta/sessoes' && req.method === 'POST') {
    if (!superAdmin) return json(403,{erro:'Esta operação requer um administrador'});
    const b = await lerCorpo(req), x = b.id && conta(String(b.id)); if (!x) return json(404, { erro: 'Conta não encontrada' });
    const n = b.sessao ? q('DELETE FROM sessoes WHERE rowid = ? AND conta = ?').run(+b.sessao, x.id).changes : terminarSessoes(x.id);
    reg('ADMIN_SESSOES_TERMINADAS', x.id + ' (' + n + ')'); return json(200, { terminadas: n });
  }

  // email: servidor SMTP, modelos e envios
  if (caminho === '/api/gestao/email' && req.method === 'GET')
    return json(200, { smtp: smtpPublico(cfg('smtp', SMTP_PADRAO)), registo: cfg('registo', REGISTO_PADRAO), modelos: Object.keys(MODELOS).map(modelo), exemplo: EXEMPLO, geral: geral(),
      enviados: q('SELECT id, em, para, modelo, assunto, estado, erro FROM emails ORDER BY id DESC LIMIT 150').all() });
  if (caminho === '/api/gestao/email/smtp' && req.method === 'POST') {
    const b = await lerCorpo(req), atual = cfg('smtp', SMTP_PADRAO), servidorSmtp = String(b.servidor || '').trim().toLowerCase(), porta = +b.porta;
    if (!/^[a-z0-9.-]+$/.test(servidorSmtp)) return json(400, { erro: 'Indique o servidor (ex.: smtp.gmail.com)' });
    if (!(porta > 0 && porta < 65536)) return json(400, { erro: 'Porta inválida' });
    const utilizador = String(b.utilizador || '').trim(), remetente = String(b.remetente || '').trim().toLowerCase();
    if (remetente && !EMAIL.test(remetente)) return json(400, { erro: 'O email do remetente não é válido' });
    if (!remetente && !EMAIL.test(utilizador)) return json(400, { erro: 'Indique o email que envia' });
    let palavra = atual.palavra;
    if (b.apagarPalavra) palavra = '';
    else if (b.palavra) palavra = cifrar(/gmail\.com$/.test(servidorSmtp) ? String(b.palavra).replace(/\s+/g, '') : String(b.palavra));
    gravarCfg('smtp', { servidor: servidorSmtp, porta, seguranca: b.seguranca === 'starttls' ? 'starttls' : 'ssl', utilizador, palavra, remetente, nomeRemetente: String(b.nomeRemetente || '').trim().slice(0, 60) }, por || 'gestor');
    reg('GESTAO_EMAIL_CONFIGURADO', servidorSmtp); return json(200, { smtp: smtpPublico(cfg('smtp', SMTP_PADRAO)) });
  }
  if (caminho === '/api/gestao/email/registo' && req.method === 'POST') {
    const b = await lerCorpo(req), verificarEmail = !!b.verificarEmail;
    gravarCfg('registo', { verificarEmail }, por || 'gestor'); reg(verificarEmail ? 'GESTAO_VERIFICACAO_LIGADA' : 'GESTAO_VERIFICACAO_DESLIGADA', null);
    return json(200, { registo: cfg('registo', REGISTO_PADRAO), ativa: verificarRegisto() });
  }
  if (caminho === '/api/gestao/email/pre-visualizar' && req.method === 'POST') {
    const b = await lerCorpo(req), m = modelo(String(b.id)); if (!m) return json(404, { erro: 'Modelo não encontrado' });
    return json(200, preencher({ assunto: b.assunto != null ? String(b.assunto) : m.assunto, html: b.html != null ? String(b.html) : m.html }, EXEMPLO));
  }
  if (caminho === '/api/gestao/email/modelo' && req.method === 'POST') {
    const b = await lerCorpo(req), id = String(b.id); if (!MODELOS[id]) return json(404, { erro: 'Modelo não encontrado' });
    if (b.repor) { q('DELETE FROM config WHERE k = ?').run('modelo:' + id); reg('GESTAO_MODELO_REPOSTO', id); return json(200, { modelo: modelo(id) }); }
    const assunto = String(b.assunto || '').trim().slice(0, 200), html = String(b.html || '').slice(0, 50000);
    if (!assunto || !html.trim()) return json(400, { erro: 'O assunto e o texto não podem ficar vazios' });
    gravarCfg('modelo:' + id, { assunto: assunto === MODELOS[id].assunto ? '' : assunto, html: html === MODELOS[id].html ? '' : html, ativo: b.ativo !== false, em: agoraISO() }, por || 'gestor');
    reg('GESTAO_MODELO_ALTERADO', id); return json(200, { modelo: modelo(id) });
  }
  if (caminho === '/api/gestao/email/teste' && req.method === 'POST') {
    const b = await lerCorpo(req), para = String(b.para || '').trim().toLowerCase(); if (!EMAIL.test(para)) return json(400, { erro: 'Indique um email válido' });
    const m = b.id && modelo(String(b.id));
    const c = m ? preencher({ assunto: '[Teste] ' + (b.assunto != null ? String(b.assunto) : m.assunto), html: b.html != null ? String(b.html) : m.html }, EXEMPLO)
      : preencher({ assunto: 'Teste de envio · {{marca}}', html: '<p>Este é um email de teste enviado pela consola de gestão da {{marca}} em {{data}}.</p>\n<p>Se o recebeu, o envio de emails está a funcionar.</p>' }, {});
    try { await enviarEmail(para, c, m ? m.id : 'teste'); } catch (e) { return json(400, { erro: e.message }); }
    reg('GESTAO_EMAIL_TESTE', para); return json(200, { ok: true });
  }

  // registos
  if (caminho === '/api/gestao/registo') return json(200, registoLista({ acao: qs.acao, conta: qs.conta, texto: qs.texto, leituras: qs.leituras === '1', antes: qs.antes, limite: qs.limite }));
  if (caminho === '/api/gestao/consola') return json(200, CONSOLA);
  if (caminho === '/api/gestao/rede') return json(200, { ficheiro: path.join(DADOS, 'rede.log'), linhas: cauda(path.join(DADOS, 'rede.log'), Math.min(1000, +qs.linhas || 300)) });

  // definições
  if (caminho === '/api/gestao/definicoes' && req.method === 'GET') return json(200, { geral: geral(), dados: DADOS, chave: FICH_GESTAO, portas, versao: VERSAO });
  if (caminho === '/api/gestao/definicoes' && req.method === 'POST') {
    const b = await lerCorpo(req), marca = String(b.marca || '').trim().slice(0, 40), urlPublico = String(b.urlPublico || '').trim().replace(/\/+$/, ''), suporte = String(b.emailSuporte || '').trim().toLowerCase();
    if (!marca) return json(400, { erro: 'Indique o nome do projeto' });
    if (urlPublico && !/^https?:\/\/[^\s/]+(\/[^\s]*)?$/i.test(urlPublico)) return json(400, { erro: 'O endereço público tem de começar por https://' });
    if (suporte && !EMAIL.test(suporte)) return json(400, { erro: 'O email de apoio não é válido' });
    gravarCfg('geral', { marca, descricao: String(b.descricao || '').trim().slice(0, 120), urlPublico, emailSuporte: suporte }, por || 'gestor');
    reg('GESTAO_DEFINICOES', null); return json(200, { geral: geral() });
  }
  if (caminho === '/api/gestao/chave-nova' && req.method === 'POST') { chaveGestao(true); reg('GESTAO_CHAVE_NOVA', null); res.setHeader('Set-Cookie', 'bxb_gestao=; Path=/; Max-Age=0'); return json(200, { ok: true }); }
  return json(404, { erro: 'Não encontrado' });
}
function atenderGestao(req, res) {
  const recusar = (c, t) => { res.writeHead(c, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end(t); };
  if (!/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i.test(String(req.headers.host || ''))) return recusar(403, 'Recusado');
  const origem = req.headers.origin; if (origem && !/^http:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i.test(origem)) return recusar(403, 'Recusado');
  let caminho; try { caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { return recusar(400, 'Pedido inválido'); }
  if (caminho.startsWith('/api/gestao/')) return apiGestao(req, res, caminho).catch(e => { try { res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify({ erro: e.message })); } catch (x) { } });
  if (req.method !== 'GET' && req.method !== 'HEAD') return recusar(405, 'Método não permitido');
  let f = null;
  if (caminho === '/' || caminho === '/index.html') f = path.join(GESTAO_DIR, 'index.html');
  else if (/^\/gestao\/[a-z0-9._-]+$/i.test(caminho)) f = path.join(GESTAO_DIR, caminho.slice(8));
  else if (caminho === '/shared/spap.css') f = path.join(RAIZ, 'SISTEMAS', 'shared', 'spap.css');
  else if (/^\/icones\/[a-z0-9._-]+$/i.test(caminho)) f = path.join(RAIZ, 'SISTEMAS', 'icones', caminho.slice(8));
  if (!f) return recusar(404, 'Não encontrado');
  fs.readFile(f, (e, d) => {
    if (e) return recusar(404, 'Não encontrado');
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'" });
    res.end(req.method === 'HEAD' ? undefined : d);
  });
}
const servidorGestao = http.createServer(atenderGestao);
function abrirGestao() {
  chaveGestao();
  servidorGestao.on('error', e => console.error(`  [gestao] Nao foi possivel abrir a porta ${PORT_GESTAO}: ${e.message}`));
  servidorGestao.listen(PORT_GESTAO, '127.0.0.1', () => { portas.gestao = PORT_GESTAO; console.log(`  Consola de gestao: http://127.0.0.1:${PORT_GESTAO}/ (so neste computador)`); console.log(''); });
}
/* ================= API de consulta para o back-office (http://127.0.0.1:8097, só neste computador) =================
   O back-office (BXB Gestor .exe e painel de gestão, com servidor e base de dados próprios, na pasta backoffice/) só CONSULTA
   o sistema do cliente por aqui. Tudo é GET e nada altera dados. A única exceção é POST /v1/desligar: o Gestor desliga o
   processo do site com ordem (não mexe em dados).
   Entra-se com a chave em DADOS-SERVIDOR\consulta.chave (cabeçalho Authorization: Bearer <chave>), só pedidos de servidor
   para servidor (um browser é recusado). Nunca devolve palavras-passe, sessões, segredos nem os dados financeiros dos clientes.
   Contrato com o back-office: CONTRATO-CONSULTA.md na raiz do repositório (mudar aqui = atualizar o contrato). */
const PORT_CONSULTA = +process.env.PORT_CONSULTA || 8097;
const FICH_CONSULTA = path.join(DADOS, 'consulta.chave');
const CONTRATO_CONSULTA = 1;
let CHAVE_CONSULTA = null;
function chaveConsulta() {
  if (CHAVE_CONSULTA) return CHAVE_CONSULTA;
  try { const t = fs.readFileSync(FICH_CONSULTA, 'utf8').trim(); if (/^[a-f0-9]{64}$/.test(t)) return (CHAVE_CONSULTA = t); } catch (e) { }
  CHAVE_CONSULTA = crypto.randomBytes(32).toString('hex'); fs.writeFileSync(FICH_CONSULTA, CHAVE_CONSULTA, { mode: 0o600 }); return CHAVE_CONSULTA;
}
const limiteDe = (v, def, max) => Math.min(max, Math.max(1, Math.floor(+v) || def));
function atenderConsulta(req, res) {
  const json = (codigo, obj) => { res.writeHead(codigo, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(obj)); };
  if (!/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i.test(String(req.headers.host || ''))) return json(403, { erro: 'Recusado' });
  if (req.headers.origin) return json(403, { erro: 'Só pedidos do servidor do back-office' });
  let u; try { u = new URL(req.url, 'http://x'); } catch (e) { return json(400, { erro: 'Pedido inválido' }); }
  const caminho = u.pathname.replace(/\/+$/, '') || '/', qs = Object.fromEntries(u.searchParams);
  if (caminho === '/v1/saude' && req.method === 'GET')
    return json(200, { ok: true, servidor: ASSINATURA, contrato: CONTRATO_CONSULTA, pid: process.pid, arranque: ARRANQUE, versao: VERSAO, portas, enderecos: enderecos() });
  const auth = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization || '');
  if (!auth || !igual(auth[1], chaveConsulta())) return json(401, { erro: 'Chave de consulta em falta ou errada' });
  if (caminho === '/v1/desligar') {
    if (req.method !== 'POST') return json(405, { erro: 'Use POST' });
    json(200, { ok: true }); setTimeout(() => desligar('BXB Gestor'), 150); return;
  }
  if (req.method !== 'GET') return json(405, { erro: 'A API de consulta só aceita GET' });

  if (caminho === '/v1/painel') return json(200, painel());
  if (caminho === '/v1/contas') return json(200, { contas: contasLista() });
  let m = /^\/v1\/contas\/([A-Za-z0-9_-]{1,80})$/.exec(caminho);
  if (m) {
    const x = conta(m[1]); if (!x) return json(404, { erro: 'Conta não encontrada' });
    return json(200, { conta: contasLista().find(r => r.id === x.id), perfil: perfilDe(x),
      sessoes: q('SELECT criada, visto, ip, agente, expira FROM sessoes WHERE conta = ? AND expira > ? ORDER BY visto DESC').all(x.id, Date.now()),
      registo: registoLista({ conta: x.id, limite: limiteDe(qs.limite, 40, 500) }) });
  }
  if (caminho === '/v1/areas') return json(200, { areas: q(`SELECT a.id, a.tipo, a.nome, a.criada_em,
      (SELECT COUNT(*) FROM membros m WHERE m.area = a.id) AS membros,
      (SELECT m.conta FROM membros m WHERE m.area = a.id AND m.papel = 'dono' LIMIT 1) AS dono
    FROM areas a ORDER BY a.criada_em DESC`).all() });
  if (caminho === '/v1/registo') return json(200, { registo: registoLista({ acao: qs.acao, conta: qs.conta, texto: qs.texto, leituras: qs.leituras === '1', antes: qs.antes, limite: qs.limite }) });
  if (caminho === '/v1/emails') return json(200, { emails: q('SELECT id, em, para, modelo, assunto, estado, erro FROM emails ORDER BY id DESC LIMIT ?').all(limiteDe(qs.limite, 150, 1000)) });
  if (caminho === '/v1/email') { const sm = cfg('smtp', SMTP_PADRAO);
    return json(200, { smtp: smtpPublico(sm), pronto: smtpPronto(sm), registo: cfg('registo', REGISTO_PADRAO), verificacaoAtiva: verificarRegisto(), modelos: Object.keys(MODELOS).map(modelo) }); }
  if (caminho === '/v1/definicoes') return json(200, { geral: geral(), versao: VERSAO, versaoDisco: versaoCodigo(), portas });
  if (caminho === '/v1/consola') return json(200, { linhas: qs.desde ? CONSOLA.filter(l => l.em > String(qs.desde)) : CONSOLA });
  if (caminho === '/v1/rede') return json(200, { linhas: cauda(path.join(DADOS, 'rede.log'), limiteDe(qs.linhas, 300, 1000)) });
  return json(404, { erro: 'Não encontrado' });
}
const servidorConsulta = http.createServer((req, res) => {
  try { atenderConsulta(req, res); } catch (e) { try { res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify({ erro: e.message })); } catch (x) { } }
});
function abrirConsulta() {
  chaveConsulta();
  servidorConsulta.on('error', e => console.error(`  [consulta] Nao foi possivel abrir a porta ${PORT_CONSULTA}: ${e.message}`));
  servidorConsulta.listen(PORT_CONSULTA, '127.0.0.1', () => { portas.consulta = PORT_CONSULTA; });
}

// desligar com ordem: fecha as portas, a base de dados e sai (pedido pelo Gestor, Ctrl+C ou pelo sistema)
let aDesligar = false;
function desligar(motivo) {
  if (aDesligar) return; aDesligar = true; console.log(`  O servidor vai desligar (${motivo}).`);
  registar(null, 'SERVIDOR_DESLIGADO', motivo, 'local');
  [servidor, servidorGestao, servidorConsulta, servidorRede].forEach(x => { try { x && x.close(); } catch (e) { } });
  setTimeout(() => { try { bd.close(); } catch (e) { } process.exit(0); }, 400);
}
process.on('SIGINT', () => desligar('Ctrl+C'));
process.on('SIGTERM', () => desligar('pedido do sistema'));

function arrancar() { servidor.listen(PORT, HOST, () => {
  portas.site = PORT;
  console.log('');
  console.log('  BXB - site a correr');
  console.log(`  Abra: ${urlSite()}`);
  console.log(`  Dados guardados em: ${DADOS}`);
  console.log('');
  abrirRede();
  abrirGestao();
  abrirConsulta();
  limparSessoes(); setInterval(limparSessoes, 3600000).unref();
  registar(null, 'SERVIDOR_LIGADO', (VERSAO || '') + ' porta ' + PORT, 'local');
  if (!process.env.BXB_GESTOR) console.log('  Nao feche esta janela enquanto usa o sistema.');
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
