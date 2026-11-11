// servidor.js — servidor local do Grupo BXB (sem dependências: só Node.js)
// Serve a pasta do repositório em http://localhost:8080 e guarda os dados dos sistemas
// numa pasta deste computador (fora do repositório, que é público), com contas de acesso.
// Em http://localhost:8080 só aceita ligações deste computador (127.0.0.1).
// Rede de casa (opcional): se existir um certificado em DADOS-SERVIDOR\tls (cert.pem e key.pem),
// abre também https://<IP deste computador>:8443 para o telemóvel e outros aparelhos.
// Tem de ser HTTPS: fora do localhost o browser só permite as assinaturas eletrónicas em ligações seguras.
'use strict';
const http = require('http');
const https = require('https');
const os = require('os');
const net = require('net');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');

const PORT = +process.env.PORT || 8080;
const HOST = '127.0.0.1';
const RAIZ = __dirname;
const URL_PORTAL = `http://localhost:${PORT}/SISTEMAS/index.html`;
const ASSINATURA = 'grupo-bxb-servidor';
// dados: por omissão em "BXB INVESTIMENTOS\DADOS-SERVIDOR" (duas pastas acima do repositório)
const DADOS = path.resolve(process.env.BXB_DADOS || path.join(RAIZ, '..', '..', 'DADOS-SERVIDOR'));
const PASTA_CHAVES = path.join(DADOS, 'dados');
const PASTA_COPIAS = path.join(DADOS, 'copias');
const FICH_CONTAS = path.join(DADOS, 'contas.json');
const FICH_DONOS = path.join(DADOS, 'donos.json'); // plano pessoal -> id da conta dona (RGPD: só o dono o vê)
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

/* ---------------- Armazenamento ---------------- */
for (const p of [DADOS, PASTA_CHAVES, PASTA_COPIAS]) fs.mkdirSync(p, { recursive: true });
const ficheiroChave = k => path.join(PASTA_CHAVES, encodeURIComponent(k) + '.json');
const lerJSON = (f, def) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return def; } };
// escrita atómica: grava num temporário e troca, para nunca deixar um ficheiro a meio
let geracao = 0; // muda a cada escrita (invalida caches)
function gravarJSON(f, obj) { geracao++; const tmp = f + '.' + process.pid + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(obj)); fs.renameSync(tmp, f); }
const todasChaves = () => fs.readdirSync(PASTA_CHAVES).filter(n => n.endsWith('.json')).map(n => decodeURIComponent(n.slice(0, -5)));
// cópia de segurança diária: na primeira escrita de cada dia copia a pasta dos dados (mantém 60 dias)
let ultimoDiaCopia = '';
function copiaDiaria() {
  const dia = new Date().toISOString().slice(0, 10); if (dia === ultimoDiaCopia) return; ultimoDiaCopia = dia;
  const destino = path.join(PASTA_COPIAS, dia); if (fs.existsSync(destino)) return;
  fs.mkdirSync(destino, { recursive: true });
  for (const n of fs.readdirSync(PASTA_CHAVES)) if (n.endsWith('.json')) fs.copyFileSync(path.join(PASTA_CHAVES, n), path.join(destino, n));
  if (fs.existsSync(FICH_CONTAS)) fs.copyFileSync(FICH_CONTAS, path.join(destino, '_contas.json'));
  const dias = fs.readdirSync(PASTA_COPIAS).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  dias.slice(0, Math.max(0, dias.length - 60)).forEach(d => fs.rmSync(path.join(PASTA_COPIAS, d), { recursive: true, force: true }));
}

/* ---------------- Contas e sessões ---------------- */
const contas = () => lerJSON(FICH_CONTAS, []);
const gravarContas = l => gravarJSON(FICH_CONTAS, l);
function hashPalavra(palavra, sal = crypto.randomBytes(16).toString('hex')) { return sal + ':' + crypto.scryptSync(String(palavra), sal, 64).toString('hex'); }
function confere(palavra, guardado) { const [sal, h] = String(guardado || '').split(':'); if (!sal || !h) return false;
  const a = Buffer.from(h, 'hex'), b = crypto.scryptSync(String(palavra), sal, 64); return a.length === b.length && crypto.timingSafeEqual(a, b); }
const publica = c => ({ id: c.id, nome: c.nome, utilizador: c.utilizador, email: c.email || '', tipo: c.tipo || '', admin: !!c.admin, sistemas: c.sistemas || [], proprios: c.proprios || [],
  privados: (() => { const d = donos(); return [...pessoais()].filter(s => d[s] !== c.id); })() }); // planos pessoais de outras pessoas: escondidos
// clientes do site (particulares e empresas que criaram conta): só veem os seus sistemas, não o registo do grupo
const cliente = c => !!c && !c.admin && (c.tipo === 'particular' || c.tipo === 'empresa');
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const slug = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'conta';
const iniciais = t => String(t || '').trim().split(/\s+/).filter(Boolean).map(x => x[0]).join('').slice(0, 3).toUpperCase() || 'PF';
const registos = new Map(); // ip -> { n, desde }: limite de contas novas por hora
const ipDe = req => String(req.headers['cf-connecting-ip'] || req.socket.remoteAddress || '');
const sessoes = new Map(); // token -> { conta, expira }
const falhas = new Map();  // utilizador -> { n, ate }
function sessaoDe(req) {
  const m = /(?:^|;\s*)bxb_sessao=([a-f0-9]{64})/.exec(req.headers.cookie || ''); if (!m) return null;
  const s = sessoes.get(m[1]); if (!s || s.expira < Date.now()) { sessoes.delete(m[1]); return null; }
  const c = contas().find(x => x.id === s.conta); if (!c || c.ativo === false) return null;
  s.expira = Date.now() + DURACAO_SESSAO; return { token: m[1], conta: c };
}
function abrirSessao(res, c) { const t = crypto.randomBytes(32).toString('hex'); sessoes.set(t, { conta: c.id, expira: Date.now() + DURACAO_SESSAO });
  res.setHeader('Set-Cookie', `bxb_sessao=${t}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${DURACAO_SESSAO / 1000}`); }
// que chaves cada conta pode ler e gravar: "spap:<sistema>" e "spap:<sistema>:..." dos sistemas da conta; o registo do grupo é de leitura para todos
const sistemaDaChave = k => { const m = /^spap:([^:]+)/.exec(k); return m ? m[1] : null; };
// partilhas entre planos pessoais ("spap:partilha:<id>:conta"): acessíveis a quem tem acesso a um dos planos que são membros
const membroDaPartilha = (c, valor) => { try { const v = typeof valor === 'string' ? JSON.parse(valor) : valor; return ((v && v.membros) || []).some(m => m && m.sistema && temSistema(c, m.sistema)); } catch (e) { return false; } };
const partilhaGuardada = k => { const r = lerJSON(ficheiroChave(k), null); return r ? r.valor : null; };
/* RGPD: um plano pessoal (modelo "planeamento") pertence a UMA conta e só essa conta o recebe — nem o administrador.
   O dono fica fixo: atribui-se uma vez (registo no site, Acessos ou a conta que já o tinha assinalado) e não muda pela API. */
const donos = () => lerJSON(FICH_DONOS, {});
let cachePessoais = { g: -1, s: null };
function pessoais() {
  if (cachePessoais.s && cachePessoais.g === geracao) return cachePessoais.s;
  const s = new Set(Object.keys(donos()));
  try { (JSON.parse(partilhaGuardada('spap:grupo') || '[]') || []).forEach(x => { if (x && x.modelo === 'planeamento') s.add(x.key); }); } catch (e) { }
  contas().forEach(c => (c.proprios || []).forEach(p => { if (p && p.modelo === 'planeamento') s.add(p.key); }));
  cachePessoais = { g: geracao, s }; return s;
}
const ePessoal = sis => !!sis && pessoais().has(sis);
const dono = (c, sis) => !!c && donos()[sis] === c.id;
// acesso a um sistema de um membro de partilha: plano pessoal só pelo dono; outro sistema pelas regras normais
const temSistema = (c, sis) => ePessoal(sis) ? dono(c, sis) : (c.admin || (c.sistemas || []).includes('*') || (c.sistemas || []).includes(sis));
function atribuirDonos() { // contas que já tinham o plano assinalado explicitamente (sem contar o "*" do administrador)
  const d = donos(), l = contas(); let mudou = false;
  for (const sis of pessoais()) { if (d[sis]) continue; const q = l.filter(c => (c.sistemas || []).includes(sis)); if (q.length === 1) { d[sis] = q[0].id; mudou = true; } }
  // planos sem dono: se o nome da conta é o de um utilizador do plano, e a correspondência é única nos dois sentidos
  // (essa conta só aparece nesse plano e esse plano só tem essa conta), o plano passa a ser dessa conta
  const norm = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const livres = [...pessoais()].filter(s => !d[s]), nomes = {};
  livres.forEach(s => { try { const v = JSON.parse((lerJSON(ficheiroChave('spap:' + s), null) || {}).valor || 'null'); nomes[s] = new Set(((v && v.users) || []).map(u => norm(u.nome)).filter(Boolean)); } catch (e) { nomes[s] = new Set(); } });
  const semPlano = l.filter(c => !Object.values(d).includes(c.id) && norm(c.nome));
  livres.forEach(s => { const q = semPlano.filter(c => nomes[s].has(norm(c.nome)));
    if (q.length === 1 && livres.filter(o => nomes[o].has(norm(q[0].nome))).length === 1 && !Object.values(d).includes(q[0].id)) { d[s] = q[0].id; mudou = true; } });
  if (mudou) { gravarJSON(FICH_DONOS, d); }
}
const ve0 = (c, k) => !!c && (c.admin || (c.sistemas || []).includes('*') || (k === 'spap:grupo' && !cliente(c)) || (c.sistemas || []).includes(sistemaDaChave(k)) || (sistemaDaChave(k) === 'partilha' && membroDaPartilha(c, partilhaGuardada(k))));
// numa partilha nova, quem a cria tem de ser membro; numa existente, tem de já ser membro (não se entra numa partilha alheia)
const grava0 = (c, k, novo) => !!c && (c.admin || (c.sistemas || []).includes('*') || (k !== 'spap:grupo' && (c.sistemas || []).includes(sistemaDaChave(k))) || (k === 'spap:grupo' && (c.sistemas || []).includes('bxb'))
  || (sistemaDaChave(k) === 'partilha' && (() => { const g = partilhaGuardada(k); return g != null ? membroDaPartilha(c, g) : membroDaPartilha(c, novo); })()));
// planos pessoais e partilhas entre eles: só o dono / os membros, sem exceção para administradores
const ve = (c, k) => { const s = sistemaDaChave(k); if (!c) return false; if (s === 'partilha') return membroDaPartilha(c, partilhaGuardada(k)); if (ePessoal(s)) return dono(c, s); return ve0(c, k); };
const grava = (c, k, novo) => { const s = sistemaDaChave(k); if (!c) return false;
  if (s === 'partilha') { const g = partilhaGuardada(k); return g != null ? membroDaPartilha(c, g) : membroDaPartilha(c, novo); }
  if (ePessoal(s)) return dono(c, s);
  // (um plano com dono continua pessoal mesmo que alguém mude o modelo no registo do grupo: os donos contam sempre como pessoais)
  return grava0(c, k, novo); };

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
  const s = sessaoDe(req), c = s && s.conta, lista = contas();

  if (caminho === '/api/estado' && req.method === 'GET') return json(200, { configurado: lista.length > 0, sessao: c ? publica(c) : null });

  if (caminho === '/api/configurar' && req.method === 'POST') {
    if (lista.length) return json(409, { erro: 'O servidor já está configurado' });
    const b = await lerCorpo(req);
    if (!b.nome || !b.utilizador || String(b.palavra || '').length < 8) return json(400, { erro: 'Indique o nome, o utilizador e uma palavra-passe com pelo menos 8 caracteres' });
    const nova = { id: 'c' + crypto.randomBytes(6).toString('hex'), nome: String(b.nome).trim(), utilizador: String(b.utilizador).trim().toLowerCase(), email: EMAIL.test(String(b.utilizador).trim().toLowerCase()) ? String(b.utilizador).trim().toLowerCase() : '', hash: hashPalavra(b.palavra), admin: true, sistemas: ['*'], criadaEm: new Date().toISOString() };
    gravarContas([nova]); abrirSessao(res, nova); return json(200, { sessao: publica(nova) });
  }
  if (caminho === '/api/entrar' && req.method === 'POST') {
    const b = await lerCorpo(req), u = String(b.email || b.utilizador || '').trim().toLowerCase(), f = falhas.get(u);
    if (f && f.ate > Date.now()) return json(429, { erro: 'Demasiadas tentativas. Tente de novo dentro de alguns minutos.' });
    const conta = lista.find(x => x.ativo !== false && ((x.email && x.email === u) || x.utilizador === u));
    if (!conta || !confere(b.palavra, conta.hash)) { const n = (f && f.ate && f.ate <= Date.now() ? 0 : (f ? f.n : 0)) + 1; falhas.set(u, { n, ate: n >= 5 ? Date.now() + 5 * 60000 : 0 }); return json(401, { erro: 'Email ou palavra-passe incorretos' }); }
    if (cliente(conta) && b.tipo && b.tipo !== conta.tipo) return json(401, { erro: conta.tipo === 'empresa' ? 'Esta conta é de empresa: entre no separador Empresas.' : 'Esta conta é de particular: entre no separador Particulares.' });
    falhas.delete(u); try { atribuirDonos(); } catch (e) { } abrirSessao(res, conta); return json(200, { sessao: publica(conta) });
  }
  // criar conta no site: um particular recebe um plano pessoal novo; uma empresa recebe um sistema de empresa novo.
  // Cada conta só vê os seus dados. Dentro do sistema, o PIN (para assinar) define-se no primeiro acesso.
  if (caminho === '/api/registar' && req.method === 'POST') {
    if (!lista.length) return json(409, { erro: 'O servidor ainda não está configurado' });
    const ip = ipDe(req), r0 = registos.get(ip), agora = Date.now();
    if (r0 && agora - r0.desde < 3600000 && r0.n >= 5) return json(429, { erro: 'Demasiadas contas criadas a partir deste endereço. Tente mais tarde.' });
    const b = await lerCorpo(req), tipo = b.tipo === 'empresa' ? 'empresa' : 'particular';
    const nome = String(b.nome || '').trim().slice(0, 80), email = String(b.email || '').trim().toLowerCase(), empresa = String(b.empresa || '').trim().slice(0, 80), nif = String(b.nif || '').replace(/\s+/g, '').slice(0, 12);
    if (!nome) return json(400, { erro: 'Indique o seu nome' });
    if (!EMAIL.test(email) || email.length > 120) return json(400, { erro: 'Indique um email válido' });
    if (String(b.palavra || '').length < 8) return json(400, { erro: 'A palavra-passe tem de ter pelo menos 8 caracteres' });
    if (tipo === 'empresa' && !empresa) return json(400, { erro: 'Indique o nome da empresa' });
    if (nif && !/^\d{9}$/.test(nif)) return json(400, { erro: 'O NIF tem 9 dígitos' });
    if (lista.some(x => x.email === email || x.utilizador === email)) return json(409, { erro: 'Já existe uma conta com esse email' });
    const rnd = crypto.randomBytes(3).toString('hex'), nomeSis = tipo === 'empresa' ? empresa : nome;
    const sub = { key: (tipo === 'empresa' ? 'e-' : 'p-') + slug(nomeSis) + '-' + rnd, nome: tipo === 'empresa' ? empresa : nome + ' (pessoal)', sigla: iniciais(nomeSis), nif, setor: '',
      modelo: tipo === 'empresa' ? 'servicos' : 'planeamento', cor1: tipo === 'empresa' ? '#0ea5e9' : '#8b5cf6', cor2: tipo === 'empresa' ? '#22d3ee' : '#ec4899', participacao: 0, ativa: true,
      criadaEm: new Date().toISOString().slice(0, 10), contaCaixa: 'CAIXA', contaOperacional: 'OPERACIONAL', contaHolding: 'HOLDING', independente: true, tipo,
      utilizadores: [{ id: 'u_' + crypto.randomBytes(4).toString('hex'), nome, username: email.split('@')[0].slice(0, 30), role: 'ADMIN', limite: 0 }] };
    const nova = { id: 'c' + crypto.randomBytes(6).toString('hex'), nome, email, utilizador: email, hash: hashPalavra(b.palavra), admin: false, tipo, sistemas: [sub.key], proprios: [sub], criadaEm: new Date().toISOString() };
    const l = contas(); if (l.some(x => x.email === email || x.utilizador === email)) return json(409, { erro: 'Já existe uma conta com esse email' });
    l.push(nova); gravarContas(l);
    if (tipo === 'particular') { const d = donos(); d[sub.key] = nova.id; gravarJSON(FICH_DONOS, d); }
    registos.set(ip, r0 && agora - r0.desde < 3600000 ? { n: r0.n + 1, desde: r0.desde } : { n: 1, desde: agora });
    abrirSessao(res, nova); return json(200, { sessao: publica(nova), destino: '/SISTEMAS/subsidiaria/index.html?s=' + encodeURIComponent(sub.key) });
  }
  if (caminho === '/api/sair' && req.method === 'POST') { if (s) sessoes.delete(s.token); res.setHeader('Set-Cookie', 'bxb_sessao=; Path=/; Max-Age=0'); return json(200, { ok: true }); }

  if (!c) return json(401, { erro: 'Sessão expirada' });

  if (caminho === '/api/palavra' && req.method === 'POST') {
    const b = await lerCorpo(req); if (!confere(b.atual, c.hash)) return json(400, { erro: 'Palavra-passe atual incorreta' });
    if (String(b.nova || '').length < 8) return json(400, { erro: 'A nova palavra-passe tem de ter pelo menos 8 caracteres' });
    const l = contas(); const x = l.find(y => y.id === c.id); x.hash = hashPalavra(b.nova); gravarContas(l); return json(200, { ok: true });
  }
  // todas as chaves que a conta pode ver (com a versão de cada uma)
  if (caminho === '/api/dados' && req.method === 'GET') {
    const out = {}; for (const k of todasChaves()) if (ve(c, k)) { const r = lerJSON(ficheiroChave(k), null); if (r) out[k] = { valor: r.valor, versao: r.versao }; }
    return json(200, out);
  }
  if (caminho === '/api/versoes' && req.method === 'GET') {
    const out = {}; for (const k of todasChaves()) if (ve(c, k)) { const r = lerJSON(ficheiroChave(k), null); if (r) out[k] = r.versao; }
    return json(200, out);
  }
  if (caminho.startsWith('/api/dados/')) {
    const k = decodeURIComponent(caminho.slice('/api/dados/'.length));
    if (!/^spap:/.test(k) || k.length > 300) return json(400, { erro: 'Chave inválida' });
    const atual = lerJSON(ficheiroChave(k), null), b = await lerCorpo(req), vAtual = atual ? atual.versao : 0;
    if (!grava(c, k, b.valor)) return json(403, { erro: 'Sem acesso a este sistema' });
    // controlo de concorrência: só grava se a versão de base for a do servidor (senão outro utilizador gravou entretanto)
    if ((+b.versao || 0) !== vAtual) return json(409, { erro: 'Alterado por outro utilizador', versao: vAtual, valor: atual ? atual.valor : null });
    copiaDiaria();
    if (req.method === 'PUT') { if (typeof b.valor !== 'string') return json(400, { erro: 'Valor inválido' });
      gravarJSON(ficheiroChave(k), { valor: b.valor, versao: vAtual + 1, por: c.utilizador, em: new Date().toISOString() }); return json(200, { versao: vAtual + 1 }); }
    if (req.method === 'DELETE') { try { fs.unlinkSync(ficheiroChave(k)); } catch (e) { } return json(200, { versao: 0 }); }
    return json(405, { erro: 'Método não permitido' });
  }
  // redefinir o PIN de um utilizador dentro de um sistema (ex.: o administrador esqueceu-se do PIN e é o único com PIN)
  // usa o mesmo mecanismo do sistema: PIN temporário, troca obrigatória no próximo acesso e novo certificado de assinatura
  if (caminho === '/api/redefinir-pin' && req.method === 'POST') {
    if (!c.admin) return json(403, { erro: 'Só administradores do servidor' });
    const b = await lerCorpo(req);
    if (!confere(b.palavra, c.hash)) return json(401, { erro: 'Palavra-passe do servidor incorreta' });
    if (!/^\d{4,8}$/.test(String(b.pin || ''))) return json(400, { erro: 'O PIN temporário deve ter 4 a 8 dígitos' });
    const k = 'spap:' + String(b.sistema || ''), atual = lerJSON(ficheiroChave(k), null);
    if (ePessoal(String(b.sistema || '')) && !dono(c, String(b.sistema || ''))) return json(403, { erro: 'Plano pessoal de outra pessoa: só o dono lhe pode aceder' });
    if (!atual) return json(404, { erro: 'Sistema não encontrado no servidor' });
    let d; try { d = JSON.parse(atual.valor); } catch (e) { return json(400, { erro: 'Dados do sistema ilegíveis' }); }
    const u = (d.users || []).find(x => x.id === b.userId); if (!u) return json(404, { erro: 'Utilizador não encontrado nesse sistema' });
    const sha = t => crypto.createHash('sha256').update(String(t), 'utf8').digest('hex');
    const salt = Date.now().toString(36) + crypto.randomBytes(8).toString('hex');
    let h = salt + ':' + b.pin; for (let i = 0; i < 1500; i++) h = sha(h + salt); // igual ao hashPin do sistema
    const agora = new Date().toISOString();
    Object.assign(u, { salt, pinHash: h, mustChange: true, avisoPin: { por: `${c.nome} (administrador do servidor)`, em: agora } });
    d.meta = d.meta || {}; d.meta.locks = d.meta.locks || {}; d.meta.locks[u.id] = { n: 0, until: 0 };
    // entrada no registo de auditoria, encadeada como as do sistema
    d.audit = d.audit || []; const prev = d.audit.length ? d.audit[d.audit.length - 1].hash : 'GENESIS';
    const e = { ts: agora, user: 'servidor:' + c.utilizador, acao: 'PIN_REDEFINIDO_SERVIDOR', detalhe: `${u.username} · PIN temporário definido pelo administrador do servidor ${c.nome}; troca obrigatória no próximo acesso`, ref: null, prev };
    e.hash = sha([prev, e.ts, e.user, e.acao, e.detalhe, ''].join('|')); d.audit.push(e);
    copiaDiaria();
    gravarJSON(ficheiroChave(k), { valor: JSON.stringify(d), versao: atual.versao + 1, por: c.utilizador, em: agora });
    return json(200, { ok: true, utilizador: u.nome });
  }
  // gestão de contas (só administradores)
  if (caminho === '/api/contas') {
    if (!c.admin) return json(403, { erro: 'Só administradores' });
    if (req.method === 'GET') return json(200, contas().map(publica));
    if (req.method === 'PUT') return json(405, { erro: 'Método não permitido' });
    if (req.method === 'POST') {
      const b = await lerCorpo(req), l = contas(), u = String(b.utilizador || '').trim().toLowerCase(), em = String(b.email || '').trim().toLowerCase();
      if (!b.nome || !u) return json(400, { erro: 'Indique o nome e o utilizador' });
      if (l.some(x => x.utilizador === u && x.id !== b.id)) return json(409, { erro: 'Esse utilizador já existe' });
      if (em && !EMAIL.test(em)) return json(400, { erro: 'Email inválido' });
      if (em && l.some(x => x.id !== b.id && (x.email === em || x.utilizador === em))) return json(409, { erro: 'Esse email já está noutra conta' });
      let x = b.id ? l.find(y => y.id === b.id) : null;
      if (!x) { if (String(b.palavra || '').length < 8) return json(400, { erro: 'A palavra-passe tem de ter pelo menos 8 caracteres' }); x = { id: 'c' + crypto.randomBytes(6).toString('hex'), criadaEm: new Date().toISOString() }; l.push(x); }
      Object.assign(x, { nome: String(b.nome).trim(), utilizador: u, email: em, admin: !!b.admin, sistemas: Array.isArray(b.sistemas) ? b.sistemas.map(String) : [] });
      // os sistemas próprios de um cliente continuam acessíveis a ele
      (x.proprios || []).forEach(p => { if (!x.sistemas.includes(p.key)) x.sistemas.push(p.key); });
      // planos pessoais: um plano sem dono passa a ser desta conta; um plano com outro dono não se pode dar a ninguém
      const d = donos(); let mudouD = false;
      for (const sis of x.sistemas.slice()) if (ePessoal(sis)) { if (!d[sis]) { d[sis] = x.id; mudouD = true; } else if (d[sis] !== x.id) return json(403, { erro: 'Esse plano pessoal já pertence a outra conta' }); }
      if (b.palavra) { if (String(b.palavra).length < 8) return json(400, { erro: 'A palavra-passe tem de ter pelo menos 8 caracteres' }); x.hash = hashPalavra(b.palavra); }
      if (!l.some(y => y.admin)) return json(400, { erro: 'Tem de existir pelo menos um administrador' });
      gravarContas(l); if (mudouD) { gravarJSON(FICH_DONOS, d); } return json(200, publica(x));
    }
  }
  if (caminho === '/api/meu-plano' && req.method === 'POST') {
    const d = donos(), ja = Object.keys(d).find(s => d[s] === c.id);
    if (ja) return json(200, { destino: '/SISTEMAS/subsidiaria/index.html?s=' + encodeURIComponent(ja) });
    const l = contas(), x = l.find(y => y.id === c.id); if (!x) return json(404, { erro: 'Conta não encontrada' });
    const sub = { key: 'p-' + slug(x.nome) + '-' + crypto.randomBytes(3).toString('hex'), nome: x.nome + ' (pessoal)', sigla: iniciais(x.nome), nif: '', setor: '', modelo: 'planeamento', cor1: '#8b5cf6', cor2: '#ec4899',
      participacao: 0, ativa: true, criadaEm: new Date().toISOString().slice(0, 10), contaCaixa: 'CAIXA', contaOperacional: 'OPERACIONAL', contaHolding: 'HOLDING', independente: true, tipo: 'particular',
      utilizadores: [{ id: 'u_' + crypto.randomBytes(4).toString('hex'), nome: x.nome, username: String(x.email || x.utilizador || 'eu').split('@')[0].slice(0, 30), role: 'ADMIN', limite: 0 }] };
    x.proprios = (x.proprios || []).concat([sub]); x.sistemas = (x.sistemas || []).concat([sub.key]); gravarContas(l);
    d[sub.key] = x.id; gravarJSON(FICH_DONOS, d);
    return json(200, { sessao: publica(x), destino: '/SISTEMAS/subsidiaria/index.html?s=' + encodeURIComponent(sub.key) });
  }
  if (caminho === '/api/donos' && req.method === 'GET') { // só quem é dono de cada plano pessoal (nome da conta), nunca os dados
    if (!c.admin) return json(403, { erro: 'Só administradores' });
    const d = donos(), l = contas(), out = {}; for (const sis of pessoais()) { const x = d[sis] ? l.find(y => y.id === d[sis]) : null; const pr = x && (x.proprios || []).find(p => p.key === sis); out[sis] = d[sis] ? { id: d[sis], nome: x ? x.nome : '(conta removida)', plano: pr ? pr.nome : '' } : null; }
    return json(200, out);
  }
  if (caminho.startsWith('/api/contas/') && req.method === 'DELETE') {
    if (!c.admin) return json(403, { erro: 'Só administradores' });
    const id = caminho.slice('/api/contas/'.length); if (id === c.id) return json(400, { erro: 'Não pode remover a sua própria conta' });
    gravarContas(contas().filter(x => x.id !== id)); for (const [t, ss] of sessoes) if (ss.conta === id) sessoes.delete(t); return json(200, { ok: true });
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

try { atribuirDonos(); } catch (e) { console.error('donos:', e.message); }
servidor.listen(PORT, HOST, () => {
  console.log('');
  console.log('  Grupo BXB - servidor local a correr');
  console.log(`  Abra: ${URL_PORTAL}`);
  console.log(`  Dados guardados em: ${DADOS}`);
  console.log('');
  abrirRede();
  console.log('  Nao feche esta janela enquanto usa o sistema.');
  abrirBrowser(URL_PORTAL);
});
