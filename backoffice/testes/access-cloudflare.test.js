'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { criarVerificadorAccess, normalizarIssuer } = require('../access-cloudflare');
const tempo = Date.UTC(2026, 10, 12, 12);
const issuer = 'https://dinmeta-teste.cloudflareaccess.com';
const config = { issuer, aud: 'a'.repeat(64), emails: ['operador@example.test'] };
const par = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const outro = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = (chave, kid = 'chave-1') => ({ ...chave.export({ format: 'jwk' }), kid, alg: 'RS256', use: 'sig' });
const claims = alteracoes => ({ iss: issuer, aud: [config.aud], exp: tempo / 1000 + 3600, iat: tempo / 1000, type: 'app', sub: 'utilizador-ficticio', email: config.emails[0], ...alteracoes });
function token(dados = claims(), cab = {}, chave = par.privateKey) {
  const h = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'chave-1', ...cab })).toString('base64url');
  const p = Buffer.from(JSON.stringify(dados)).toString('base64url');
  return h + '.' + p + '.' + crypto.sign('RSA-SHA256', Buffer.from(h + '.' + p), chave).toString('base64url');
}
function ambiente(opcoes = {}) {
  const chamadas = [];
  const verificador = criarVerificadorAccess({ agora: () => tempo, fetchImpl: async (url, init) => {
    chamadas.push({ url, init }); return new Response(JSON.stringify({ keys: [jwk(par.publicKey)] }), { headers: { 'content-type': 'application/json' } });
  }, ...opcoes });
  return { ...verificador, chamadas };
}
const recusado = e => e.estado === 403 && e.codigo === 'access_recusado';

test('JWT real RSA válido, email autorizado e chave obtida apenas no emissor configurado', async () => {
  const v = ambiente(); const identidade = await v.verificar(token(), config);
  assert.equal(identidade.email, 'operador@example.test'); assert.equal(v.chamadas.length, 1);
  assert.equal(v.chamadas[0].url, issuer + '/cdn-cgi/access/certs'); assert.equal(v.chamadas[0].init.redirect, 'error');
  assert.equal(JSON.stringify(identidade).includes(token()), false);
});

test('recusa assinatura falsa, alg nenhum/HS256, chave embutida e kid desconhecido', async () => {
  for (const jwt of [token(claims(), {}, outro.privateKey), token(claims(), { alg: 'none' }), token(claims(), { alg: 'HS256' }), token(claims(), { jwk: jwk(outro.publicKey) }), token(claims(), { jku: 'https://example.test/chave' }), token(claims(), { kid: 'desconhecida' })]) {
    await assert.rejects(ambiente().verificar(jwt, config), recusado);
  }
});

test('recusa emissor, audiência, validade, tipo e utilizador errados antes de qualquer rede', async () => {
  const casos = [{ iss: 'https://outra.cloudflareaccess.com' }, { aud: ['b'.repeat(64)] }, { exp: tempo / 1000 }, { exp: '9999999999' }, { iat: tempo / 1000 + 31 }, { nbf: tempo / 1000 + 31 }, { type: 'org' }, { sub: '' }, { email: 'intruso@example.test' }, { email: null }];
  for (const c of casos) { const v = ambiente(); await assert.rejects(v.verificar(token(claims(c)), config), recusado); assert.equal(v.chamadas.length, 0); }
});

test('não aceita configuração pública sem allowlist nem emissor HTTPS da Cloudflare', async () => {
  for (const cfg of [{ ...config, emails: [] }, { ...config, emails: undefined }, { ...config, emails: Array(51).fill('a@example.test') }, { ...config, issuer: 'https://localhost/' }, { ...config, issuer: 'https://equipa.cloudflareaccess.com.evil.test/' }, { ...config, issuer: 'https://equipa.cloudflareaccess.com/fora' }, { ...config, issuer: 'https://equipa.cloudflareaccess.com:443/abc' }, { ...config, aud: '' }]) {
    const v = ambiente(); await assert.rejects(v.verificar(token(), cfg), recusado); assert.equal(v.chamadas.length, 0);
  }
  assert.equal(normalizarIssuer('dinmeta-teste.cloudflareaccess.com'), issuer);
});

test('recusa formato truncado/oversized sem revelar o conteúdo da credencial', async () => {
  for (const jwt of ['', 'segredo-teste', 'a.b.c', token() + '.extra', 'a'.repeat(32769)]) {
    await assert.rejects(ambiente().verificar(jwt, config), e => recusado(e) && !e.message.includes(jwt || 'segredo-teste'));
  }
});

test('falha fechada se o emissor não responder ou a resposta exceder o limite', async () => {
  for (const fetchImpl of [async () => { throw new Error('segredo-simulado'); }, async () => new Response('{}', { status: 500 }), async () => new Response('{}', { headers: { 'content-length': '300000' } }), async () => new Response(JSON.stringify({ keys: [] }))]) {
    await assert.rejects(ambiente({ fetchImpl }).verificar(token(), config), e => e.estado === 503 && !e.message.includes('segredo-simulado'));
  }
});

test('cache e pedidos concorrentes não repetem a consulta das chaves', async () => {
  const v = ambiente(); await Promise.all(Array.from({ length: 8 }, () => v.verificar(token(), config)));
  assert.equal(v.chamadas.length, 1); await v.verificar(token(), config); assert.equal(v.chamadas.length, 1);
});

test('aceita rotação de chave depois de atualizar JWKS e conserva a chave anterior', async () => {
  let atual = tempo, chamadas = 0;
  const v = ambiente({ agora: () => atual, fetchImpl: async () => {
    chamadas++; return new Response(JSON.stringify({ keys: chamadas === 1 ? [jwk(par.publicKey)] : [jwk(par.publicKey), jwk(outro.publicKey, 'chave-2')] }));
  } });
  await v.verificar(token(), config); atual += 31000;
  await v.verificar(token(claims(), { kid: 'chave-2' }, outro.privateKey), config); await v.verificar(token(), config);
  assert.equal(chamadas, 2);
});

test('email só pode variar em maiúsculas/minúsculas e mantém o controlo de sessão', async () => {
  const v = ambiente(); const identidade = await v.verificar(token(claims({ email: 'OPERADOR@example.test' })), config);
  assert.equal(identidade.sub, 'utilizador-ficticio');
  await assert.rejects(v.verificar(token(claims()), { ...config, emails: ['outro@example.test'] }), recusado);
});
