'use strict';

// Integração HTTP real do BO; RSA/JWKS fictícios e toda a saída do filho bloqueada.
// Não inicia o site, o Gestor nem o conector. Usa apenas TESTES-CODEX e a porta 8890.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');

const PORTA = 8890;
const LOCAL = 'http://127.0.0.1:' + PORTA;
const HOST = 'gestao.dinmeta.example.test';
const ORIGEM = 'https://' + HOST;
const ISSUER = 'https://dinmeta-http-teste.cloudflareaccess.com';
const AUD = 'a'.repeat(64);
const EMAIL = 'administrador@example.test';
const BASE_TESTES = path.resolve(__dirname, '..', '..', '..', '..', 'TESTES-CODEX');
const SERVIDOR = path.resolve(__dirname, '..', 'servidor-backoffice.js');

function dentro(base, alvo) {
  const relativo = path.relative(path.resolve(base), path.resolve(alvo));
  return relativo !== '' && relativo !== '..' && !relativo.startsWith('..' + path.sep) && !path.isAbsolute(relativo);
}

function pedido(rota, { metodo = 'GET', headers = {}, corpo } = {}) {
  return new Promise((resolve, reject) => {
    const json = corpo === undefined ? undefined : JSON.stringify(corpo);
    const req = http.request({ hostname: '127.0.0.1', port: PORTA, path: rota, method: metodo,
      headers: { Host: '127.0.0.1:' + PORTA, Connection: 'close',
        ...(json === undefined ? {} : { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(json) }), ...headers },
      agent: false }, res => {
      let tamanho = 0; const partes = [];
      res.on('data', parte => {
        tamanho += parte.length;
        if (tamanho > 1024 * 1024) { res.destroy(new Error('Resposta de teste demasiado grande.')); return; }
        partes.push(parte);
      });
      res.on('error', reject);
      res.on('end', () => {
        const texto = Buffer.concat(partes).toString('utf8');
        let dados; try { dados = JSON.parse(texto); } catch { dados = null; }
        resolve({ estado: res.statusCode, headers: res.headers, texto, dados });
      });
    });
    req.setTimeout(4000, () => req.destroy(new Error('O pedido HTTP de teste excedeu o prazo.')));
    req.on('error', reject);
    req.end(json);
  });
}

function cookie(resposta) {
  const cab = resposta.headers['set-cookie'];
  assert.ok(Array.isArray(cab) && cab.length === 1, 'Deve ser emitido um único cookie de sessão.');
  assert.match(cab[0], /^bxb_backoffice=/);
  return cab[0].split(';', 1)[0];
}

async function portaLivre() {
  await new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', () => reject(new Error('A porta 8890 está ocupada; não foi alterado nenhum processo existente.')));
    s.listen(PORTA, '127.0.0.1', () => s.close(resolve));
  });
}

function criarJWT(chave, alteracoes = {}) {
  const agora = Math.floor(Date.now() / 1000);
  const cab = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'chave-http-ficticia' })).toString('base64url');
  const dados = Buffer.from(JSON.stringify({ iss: ISSUER, aud: [AUD], type: 'app', sub: 'identidade-ficticia',
    email: EMAIL, iat: agora - 10, exp: agora + 3600, ...alteracoes })).toString('base64url');
  return cab + '.' + dados + '.' + crypto.sign('RSA-SHA256', Buffer.from(cab + '.' + dados), chave).toString('base64url');
}

const PRELOAD = String.raw`
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const fixturePath = path.resolve(process.env.DINMETA_TESTE_ACCESS_FIXTURE);
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const pasta = path.dirname(fixturePath);
for (const nome of ['BXB_DADOS', 'BXB_DADOS_BACKOFFICE']) {
  const relativo = path.relative(pasta, path.resolve(process.env[nome] || '.'));
  if (!relativo || relativo === '..' || relativo.startsWith('..' + path.sep) || path.isAbsolute(relativo)) throw new Error('Dados de teste fora da fixture.');
}
const contadores = { jwks: 0, redeBloqueada: 0, processosBloqueados: 0, jwksSeguro: true };
const guardar = () => fs.writeFileSync(path.join(pasta, 'contadores.json'), JSON.stringify(contadores));
guardar();
const bloquearRede = () => { contadores.redeBloqueada++; guardar(); throw new Error('Rede externa bloqueada pelo teste.'); };
for (const nome of ['node:http', 'node:https']) {
  const modulo = require(nome); modulo.request = bloquearRede; modulo.get = bloquearRede;
}
require('node:net').Socket.prototype.connect = bloquearRede;
const processos = require('node:child_process');
for (const nome of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']) {
  processos[nome] = () => { contadores.processosBloqueados++; guardar(); throw new Error('Processos adicionais bloqueados pelo teste.'); };
}
globalThis.fetch = async (url, opcoes = {}) => {
  if (String(url) !== fixture.jwksUrl) return bloquearRede();
  contadores.jwks++;
  contadores.jwksSeguro &&= opcoes.redirect === 'error' && Boolean(opcoes.signal);
  guardar();
  return new Response(JSON.stringify({ keys: [fixture.jwk] }), { headers: { 'Content-Type': 'application/json' } });
};
`;

async function ambiente() {
  await portaLivre();
  fs.mkdirSync(BASE_TESTES, { recursive: true });
  const pasta = fs.mkdtempSync(path.join(BASE_TESTES, 'access-http-'));
  assert.ok(dentro(BASE_TESTES, pasta));
  const dadosBO = path.join(pasta, 'backoffice');
  const dadosSite = path.join(pasta, 'site-vazio');
  let filho; let terminou;
  try {
    fs.mkdirSync(dadosBO); fs.mkdirSync(dadosSite);
    const par = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const outra = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const jwk = { ...par.publicKey.export({ format: 'jwk' }), kid: 'chave-http-ficticia', alg: 'RS256', use: 'sig' };
    const acesso = { confirmado: true, hostname: HOST, issuer: ISSUER, aud: AUD, emails: [EMAIL],
      appId: crypto.randomUUID(), contaId: 'b'.repeat(32) };
    fs.writeFileSync(path.join(dadosBO, 'cloudflare.json'), JSON.stringify({ versao: 1, credenciais: null, configuracao: null, acesso }));
    const fixture = path.join(pasta, 'fixture.json');
    const preload = path.join(pasta, 'preload.cjs');
    fs.writeFileSync(fixture, JSON.stringify({ jwk, jwksUrl: ISSUER + '/cdn-cgi/access/certs' }));
    fs.writeFileSync(preload, PRELOAD);
    const env = { ...process.env, PORT_BACKOFFICE: String(PORTA), PORT_CONSULTA: '8897',
      BXB_DADOS_BACKOFFICE: dadosBO, BXB_DADOS: dadosSite, DINMETA_TESTE_ACCESS_FIXTURE: fixture };
    // O preload é específico deste filho e nunca altera o ambiente do servidor real.
    delete env.NODE_OPTIONS; delete env.NODE_PATH; delete env.TUNNEL_TOKEN;
    filho = spawn(process.execPath, ['--require', preload, SERVIDOR], { env, windowsHide: true, shell: false, stdio: 'ignore' });
    let erroFilho = false;
    filho.once('error', () => { erroFilho = true; });
    terminou = new Promise(resolve => { filho.once('exit', resolve); filho.once('error', resolve); });
    const prazo = Date.now() + 10000;
    for (;;) {
      if (erroFilho || filho.exitCode !== null) throw new Error('O BO fictício não arrancou; nenhum registo de credenciais foi impresso.');
      try { const r = await pedido('/api/saude'); if (r.estado === 200 && r.dados?.pid === filho.pid) break; } catch { /* Aguarda apenas este filho. */ }
      if (Date.now() >= prazo) throw new Error('O BO fictício não ficou disponível na porta 8890.');
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    const chave = fs.readFileSync(path.join(dadosBO, 'backoffice.chave'), 'utf8').trim();
    const palavra = 'Ficticia-' + crypto.randomBytes(16).toString('hex');
    const jwt = criarJWT(par.privateKey);
    const remoto = extras => ({ Host: HOST, 'CF-Access-Jwt-Assertion': jwt, 'CF-Connecting-IP': '203.0.113.15',
      'X-Forwarded-Proto': 'https', ...extras });
    const localPost = (rota, corpo, extras = {}) => pedido(rota, { metodo: 'POST', corpo,
      headers: { Origin: LOCAL, 'X-BXB': '1', ...extras } });
    const remotoPost = (rota, corpo, extras = {}) => pedido(rota, { metodo: 'POST', corpo,
      headers: remoto({ Origin: ORIGEM, 'X-BXB': '1', ...extras }) });
    const maquina = { Authorization: 'Bearer ' + chave };
    const novoBilhete = async () => { const r = await localPost('/api/bilhete', {}, maquina); assert.equal(r.estado, 200); return r.dados.bilhete; };
    return { pasta, filho, terminou, jwt, remoto, localPost, remotoPost, maquina, palavra, novoBilhete,
      jwtCom: dados => criarJWT(par.privateKey, dados), jwtFalso: criarJWT(outra.privateKey),
      contadores: () => JSON.parse(fs.readFileSync(path.join(pasta, 'contadores.json'), 'utf8')),
      async fechar() {
        if (filho.exitCode === null && !filho.killed) {
          try { await localPost('/api/desligar', {}, maquina); } catch { /* Limpeza limitada ao nosso filho. */ }
          let timer;
          const saiu = await Promise.race([terminou.then(() => true), new Promise(resolve => { timer = setTimeout(() => resolve(false), 10000); })]);
          clearTimeout(timer);
          if (!saiu) { filho.kill('SIGKILL'); await terminou; }
        }
        assert.ok(dentro(BASE_TESTES, pasta), 'A limpeza só pode remover a pasta temporária deste teste.');
        fs.rmSync(pasta, { recursive: true, force: true });
      },
    };
  } catch (erro) {
    if (filho && filho.exitCode === null && !filho.killed) { filho.kill('SIGKILL'); await terminou; }
    if (dentro(BASE_TESTES, pasta)) fs.rmSync(pasta, { recursive: true, force: true });
    throw erro;
  }
}

test('Access e sessão BO mantêm barreiras HTTP independentes', { timeout: 60000 }, async t => {
  const a = await ambiente();
  t.after(() => a.fechar());
  let sessaoLocal; let sessaoRemota;

  for (const [nome, jwt] of [
    ['ausente', undefined], ['malformado', 'nao-e-jwt'], ['assinatura falsa', a.jwtFalso],
    ['expirado', a.jwtCom({ exp: Math.floor(Date.now() / 1000) - 1 })],
    ['email não permitido', a.jwtCom({ email: 'intruso@example.test' })],
    ['audiência errada', a.jwtCom({ aud: ['c'.repeat(64)] })],
    ['emissor errado', a.jwtCom({ iss: 'https://outra.cloudflareaccess.com' })],
  ]) await t.test('Host público recusa JWT ' + nome, async () => {
    const headers = a.remoto();
    if (jwt === undefined) delete headers['CF-Access-Jwt-Assertion']; else headers['CF-Access-Jwt-Assertion'] = jwt;
    const r = await pedido('/api/saude', { headers });
    assert.equal(r.estado, 403);
    assert.equal(Object.hasOwn(r.dados || {}, 'pid'), false);
  });

  await t.test('JWT válido permite o login público, sem conceder uma sessão BO', async () => {
    const r = await pedido('/', { headers: a.remoto() }); assert.equal(r.estado, 200);
    assert.match(r.headers['content-type'], /text\/html/);
    assert.equal(r.headers['set-cookie'], undefined);
  });

  for (const rota of ['/api/quem', '/api/operadores', '/api/auditoria', '/api/cloudflare/estado', '/api/cloudflare/zonas']) {
    await t.test('Access válido sem sessão não consulta ' + rota, async () => {
      assert.equal((await pedido(rota, { headers: a.remoto() })).estado, 401);
    });
  }
  for (const rota of ['/api/operadores', '/api/perfis', '/api/cloudflare/ligacao', '/api/cloudflare/aplicar', '/api/cloudflare/conector/instalar', '/api/cloudflare/conector/ligar']) {
    await t.test('Access válido sem sessão não escreve em ' + rota, async () => {
      assert.equal((await a.remotoPost(rota, {})).estado, 401);
    });
  }
  await t.test('Cookie BO forjado não substitui a autenticação própria', async () => {
    assert.equal((await pedido('/api/cloudflare/estado', { headers: a.remoto({ Cookie: 'bxb_backoffice=' + 'f'.repeat(64) + '.assinatura-falsa' }) })).estado, 401);
  });
  await t.test('O login público não permite criar o primeiro administrador', async () => {
    assert.equal((await a.remotoPost('/api/entrar', { email: EMAIL, palavra: a.palavra })).estado, 403);
  });

  await t.test('Inicialização exclusivamente local por bilhete de máquina', async () => {
    const bilhete = await a.novoBilhete();
    const entrada = await a.localPost('/api/entrar', { bilhete }); assert.equal(entrada.estado, 200);
    assert.equal(entrada.dados.inicializar, true);
    const resposta = await a.localPost('/api/configurar', { nome: 'Administrador fictício', email: EMAIL, palavra: a.palavra }, { Cookie: cookie(entrada) });
    assert.equal(resposta.estado, 200); assert.equal(resposta.dados.administrador, true);
    sessaoLocal = cookie(resposta);
  });

  for (const rota of ['/api/bilhete', '/api/configurar', '/api/desligar']) {
    await t.test('Operação local recusa remoto mesmo com Access, BO e chave: ' + rota, async () => {
      const r = await a.remotoPost(rota, {}, { Cookie: sessaoLocal, ...a.maquina });
      assert.equal(r.estado, 403);
      assert.match(r.dados.erro, /localmente/);
    });
  }
  await t.test('Bilhete remoto é recusado sem consumir o bilhete local', async () => {
    const bilhete = await a.novoBilhete();
    assert.equal((await a.remotoPost('/api/entrar', { bilhete }, a.maquina)).estado, 403);
    const r = await a.localPost('/api/entrar', { bilhete }); assert.equal(r.estado, 200);
    assert.equal(r.dados.viaGestor, true);
  });

  for (const Origin of ['http://' + HOST, ORIGEM + ':444', ORIGEM + '/', ORIGEM + '.evil.test', 'https://outro.example.test']) {
    await t.test('Mutação pública exige a origem HTTPS exata: ' + Origin, async () => {
      assert.equal((await a.remotoPost('/api/entrar', { email: EMAIL, palavra: a.palavra }, { Origin })).estado, 403);
    });
  }
  await t.test('Origem ausente, pedido cross-site ou X-BXB ausente não permitem mutações', async () => {
    const headers = a.remoto({ 'X-BXB': '1' });
    assert.equal((await pedido('/api/entrar', { metodo: 'POST', headers, corpo: { email: EMAIL, palavra: a.palavra } })).estado, 403);
    assert.equal((await a.remotoPost('/api/entrar', { email: EMAIL, palavra: a.palavra }, { 'Sec-Fetch-Site': 'cross-site' })).estado, 403);
    const semCSRF = a.remoto({ Origin: ORIGEM });
    assert.equal((await pedido('/api/entrar', { metodo: 'POST', headers: semCSRF, corpo: { email: EMAIL, palavra: a.palavra } })).estado, 403);
  });
  await t.test('Login público autenticado emite cookie Secure, HttpOnly e SameSite=Strict', async () => {
    const r = await a.remotoPost('/api/entrar', { email: EMAIL, palavra: a.palavra });
    assert.equal(r.estado, 200); sessaoRemota = cookie(r);
    const cab = r.headers['set-cookie'][0];
    for (const regra of [/; Secure(?:;|$)/, /; HttpOnly(?:;|$)/, /; SameSite=Strict(?:;|$)/, /; Path=\/(?:;|$)/]) assert.match(cab, regra);
    assert.equal((await pedido('/api/cloudflare/estado', { headers: a.remoto({ Cookie: sessaoRemota }) })).estado, 200);
  });
  await t.test('Cookie BO válido continua dependente de JWT válido em cada pedido remoto', async () => {
    const headers = a.remoto({ Cookie: sessaoRemota }); delete headers['CF-Access-Jwt-Assertion'];
    assert.equal((await pedido('/api/quem', { headers })).estado, 403);
    headers['CF-Access-Jwt-Assertion'] = a.jwtFalso;
    assert.equal((await pedido('/api/quem', { headers })).estado, 403);
  });

  for (const Host of ['localhost:' + PORTA, '127.0.0.1:' + PORTA, '[::1]:' + PORTA]) {
    for (const proxy of ['CF-Access-Jwt-Assertion', 'CF-Connecting-IP', 'X-Forwarded-Proto', 'X-Forwarded-Host', 'Forwarded']) {
      await t.test('Host local não contorna Access com ' + proxy + ' (' + Host + ')', async () => {
        const valores = { 'CF-Access-Jwt-Assertion': a.jwt, 'CF-Connecting-IP': '203.0.113.15',
          'X-Forwarded-Proto': 'https', 'X-Forwarded-Host': HOST, Forwarded: 'for=203.0.113.15;proto=https' };
        const headers = { Host, [proxy]: valores[proxy], Cookie: sessaoLocal, ...a.maquina };
        assert.equal((await pedido('/api/quem', { headers })).estado, 403);
        assert.equal((await pedido('/api/bilhete', { metodo: 'POST', corpo: {}, headers: { ...headers, 'X-BXB': '1' } })).estado, 403);
      });
    }
  }
  await t.test('Host público diferente ou porta não autorizada são recusados', async () => {
    for (const Host of ['outro.example.test', HOST + '.evil.test', HOST + ':8890']) {
      assert.equal((await pedido('/api/saude', { headers: a.remoto({ Host }) })).estado, 403);
    }
  });
  await t.test('Saída pública expira o cookie com Secure', async () => {
    const r = await a.remotoPost('/api/sair', {}, { Cookie: sessaoRemota });
    assert.equal(r.estado, 200); const cab = r.headers['set-cookie'][0];
    assert.match(cab, /; Secure(?:;|$)/); assert.match(cab, /; Max-Age=0(?:;|$)/);
    assert.equal((await pedido('/api/quem', { headers: a.remoto({ Cookie: sessaoRemota }) })).estado, 401);
  });
  await t.test('A integração consultou apenas JWKS fictício e nunca iniciou outros processos', () => {
    const c = a.contadores();
    assert.equal(c.jwks, 1); assert.equal(c.jwksSeguro, true);
    assert.equal(c.redeBloqueada, 0); assert.equal(c.processosBloqueados, 0);
  });
});
