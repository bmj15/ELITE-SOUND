// servidor.js — servidor local do Grupo BXB (sem dependências: só Node.js)
// Serve a pasta do repositório em http://localhost:8080 e guarda os dados dos sistemas
// numa pasta deste computador (fora do repositório, que é público), com contas de acesso.
// Só aceita ligações deste computador (127.0.0.1). Para aceder de outros aparelhos,
// use o Tailscale: "tailscale serve --bg 8080" (HTTPS, só para a sua rede privada).
'use strict';
const http = require('http');
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
const LIMITE_CORPO = 25 * 1024 * 1024;
const DURACAO_SESSAO = 12 * 3600 * 1000;

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
function gravarJSON(f, obj) { const tmp = f + '.' + process.pid + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(obj)); fs.renameSync(tmp, f); }
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
const publica = c => ({ id: c.id, nome: c.nome, utilizador: c.utilizador, admin: !!c.admin, sistemas: c.sistemas || [] });
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
const membroDaPartilha = (c, valor) => { try { const v = typeof valor === 'string' ? JSON.parse(valor) : valor; return ((v && v.membros) || []).some(m => m && m.sistema && (c.sistemas || []).includes(m.sistema)); } catch (e) { return false; } };
const partilhaGuardada = k => { const r = lerJSON(ficheiroChave(k), null); return r ? r.valor : null; };
const ve = (c, k) => !!c && (c.admin || (c.sistemas || []).includes('*') || k === 'spap:grupo' || (c.sistemas || []).includes(sistemaDaChave(k)) || (sistemaDaChave(k) === 'partilha' && membroDaPartilha(c, partilhaGuardada(k))));
// numa partilha nova, quem a cria tem de ser membro; numa existente, tem de já ser membro (não se entra numa partilha alheia)
const grava = (c, k, novo) => !!c && (c.admin || (c.sistemas || []).includes('*') || (k !== 'spap:grupo' && (c.sistemas || []).includes(sistemaDaChave(k))) || (k === 'spap:grupo' && (c.sistemas || []).includes('bxb'))
  || (sistemaDaChave(k) === 'partilha' && (() => { const g = partilhaGuardada(k); return g != null ? membroDaPartilha(c, g) : membroDaPartilha(c, novo); })()));

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
    const nova = { id: 'c' + crypto.randomBytes(6).toString('hex'), nome: String(b.nome).trim(), utilizador: String(b.utilizador).trim().toLowerCase(), hash: hashPalavra(b.palavra), admin: true, sistemas: ['*'], criadaEm: new Date().toISOString() };
    gravarContas([nova]); abrirSessao(res, nova); return json(200, { sessao: publica(nova) });
  }
  if (caminho === '/api/entrar' && req.method === 'POST') {
    const b = await lerCorpo(req), u = String(b.utilizador || '').trim().toLowerCase(), f = falhas.get(u);
    if (f && f.ate > Date.now()) return json(429, { erro: 'Demasiadas tentativas. Tente de novo dentro de alguns minutos.' });
    const conta = lista.find(x => x.utilizador === u && x.ativo !== false);
    if (!conta || !confere(b.palavra, conta.hash)) { const n = (f && f.ate && f.ate <= Date.now() ? 0 : (f ? f.n : 0)) + 1; falhas.set(u, { n, ate: n >= 5 ? Date.now() + 5 * 60000 : 0 }); return json(401, { erro: 'Utilizador ou palavra-passe incorretos' }); }
    falhas.delete(u); abrirSessao(res, conta); return json(200, { sessao: publica(conta) });
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
    if (req.method === 'POST') {
      const b = await lerCorpo(req), l = contas(), u = String(b.utilizador || '').trim().toLowerCase();
      if (!b.nome || !u) return json(400, { erro: 'Indique o nome e o utilizador' });
      if (l.some(x => x.utilizador === u && x.id !== b.id)) return json(409, { erro: 'Esse utilizador já existe' });
      let x = b.id ? l.find(y => y.id === b.id) : null;
      if (!x) { if (String(b.palavra || '').length < 8) return json(400, { erro: 'A palavra-passe tem de ter pelo menos 8 caracteres' }); x = { id: 'c' + crypto.randomBytes(6).toString('hex'), criadaEm: new Date().toISOString() }; l.push(x); }
      Object.assign(x, { nome: String(b.nome).trim(), utilizador: u, admin: !!b.admin, sistemas: Array.isArray(b.sistemas) ? b.sistemas.map(String) : [] });
      if (b.palavra) { if (String(b.palavra).length < 8) return json(400, { erro: 'A palavra-passe tem de ter pelo menos 8 caracteres' }); x.hash = hashPalavra(b.palavra); }
      if (!l.some(y => y.admin)) return json(400, { erro: 'Tem de existir pelo menos um administrador' });
      gravarContas(l); return json(200, publica(x));
    }
  }
  if (caminho.startsWith('/api/contas/') && req.method === 'DELETE') {
    if (!c.admin) return json(403, { erro: 'Só administradores' });
    const id = caminho.slice('/api/contas/'.length); if (id === c.id) return json(400, { erro: 'Não pode remover a sua própria conta' });
    gravarContas(contas().filter(x => x.id !== id)); for (const [t, ss] of sessoes) if (ss.conta === id) sessoes.delete(t); return json(200, { ok: true });
  }
  return json(404, { erro: 'Não encontrado' });
}

const servidor = http.createServer((req, res) => {
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
  console.log(`  Dados guardados em: ${DADOS}`);
  console.log('  Acesso de outros aparelhos: tailscale serve --bg ' + PORT);
  console.log('');
  console.log('  Nao feche esta janela enquanto usa o sistema.');
  abrirBrowser(URL_PORTAL);
});
