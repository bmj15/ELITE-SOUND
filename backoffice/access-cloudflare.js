'use strict';

// Valida o Access na origem. A presença de um cabeçalho nunca substitui a assinatura.
const crypto = require('node:crypto');
const MAX_JWKS = 256 * 1024;
class ErroAccess extends Error {
  constructor(estado = 403) {
    super(estado === 503 ? 'Não foi possível validar a proteção Cloudflare Access. Tente novamente.' : 'Acesso recusado pelo Cloudflare Access.');
    this.estado = estado;
    this.codigo = 'access_recusado';
  }
}

function normalizarIssuer(valor) {
  if (typeof valor !== 'string' || valor.length > 200) throw new ErroAccess();
  let url;
  try { url = new URL(valor.startsWith('https://') ? valor : 'https://' + valor); }
  catch { throw new ErroAccess(); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash || url.pathname !== '/' ||
      !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.cloudflareaccess\.com$/.test(url.hostname)) throw new ErroAccess();
  return url.origin;
}

function descodificar(texto, limite) {
  if (!texto || texto.length > limite || !/^[A-Za-z0-9_-]+$/.test(texto)) throw new ErroAccess();
  const valor = Buffer.from(texto, 'base64url');
  if (valor.toString('base64url') !== texto) throw new ErroAccess();
  return valor;
}

function objeto(texto, limite) {
  try {
    const valor = JSON.parse(descodificar(texto, limite).toString('utf8'));
    if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw new ErroAccess();
    return valor;
  } catch { throw new ErroAccess(); }
}

function criarVerificadorAccess({ fetchImpl = globalThis.fetch, agora = Date.now } = {}) {
  const cache = new Map(), pendentes = new Map();

  async function carregar(issuer) {
    if (pendentes.has(issuer)) return pendentes.get(issuer);
    const pedido = (async () => {
      try {
        const resposta = await fetchImpl(issuer + '/cdn-cgi/access/certs', {
          redirect: 'error', signal: AbortSignal.timeout(5000), headers: { Accept: 'application/json' },
        });
        if (!resposta.ok || Number(resposta.headers.get('content-length') || 0) > MAX_JWKS) throw new ErroAccess(503);
        let tamanho = 0; const partes = [];
        if (!resposta.body) throw new ErroAccess(503);
        const leitor = resposta.body.getReader();
        try {
          for (;;) {
            const { value, done } = await leitor.read(); if (done) break;
            tamanho += value.byteLength;
            if (tamanho > MAX_JWKS) { await leitor.cancel(); throw new ErroAccess(503); }
            partes.push(Buffer.from(value));
          }
        } finally { leitor.releaseLock(); }
        const dados = JSON.parse(Buffer.concat(partes).toString('utf8'));
        if (!Array.isArray(dados.keys) || !dados.keys.length || dados.keys.length > 32) throw new ErroAccess(503);
        const chaves = new Map();
        for (const jwk of dados.keys) {
          if (!jwk || typeof jwk.kid !== 'string' || jwk.kid.length > 256 || jwk.kty !== 'RSA' ||
              (jwk.alg && jwk.alg !== 'RS256') || (jwk.use && jwk.use !== 'sig') || jwk.d ||
              typeof jwk.n !== 'string' || descodificar(jwk.n, 4096).length < 256) continue;
          try { chaves.set(jwk.kid, crypto.createPublicKey({ key: jwk, format: 'jwk' })); } catch { }
        }
        if (!chaves.size) throw new ErroAccess(503);
        if (cache.size >= 8 && !cache.has(issuer)) cache.delete(cache.keys().next().value);
        const resultado = { chaves, em: agora() }; cache.set(issuer, resultado); return resultado;
      } catch (erro) { throw erro instanceof ErroAccess && erro.estado === 503 ? erro : new ErroAccess(503); }
    })();
    pendentes.set(issuer, pedido);
    try { return await pedido; } finally { pendentes.delete(issuer); }
  }

  async function verificar(token, configuracao) {
    try {
      if (!configuracao || !/^[a-f0-9]{64}$/i.test(configuracao.aud || '')) throw new ErroAccess();
      const issuer = normalizarIssuer(configuracao.issuer);
      const emails = configuracao.emails;
      if (!Array.isArray(emails) || !emails.length || emails.length > 50 || emails.some(e => typeof e !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))) throw new ErroAccess();
      if (typeof token !== 'string' || token.length > 32768) throw new ErroAccess();
      const partes = token.split('.'); if (partes.length !== 3) throw new ErroAccess();
      const cab = objeto(partes[0], 4096), dados = objeto(partes[1], 24000);
      if (cab.alg !== 'RS256' || (cab.typ && cab.typ !== 'JWT') || typeof cab.kid !== 'string' || !cab.kid || cab.kid.length > 256 || cab.jku || cab.jwk || cab.x5u || cab.crit) throw new ErroAccess();
      const assinatura = descodificar(partes[2], 4096);
      const segundos = Math.floor(agora() / 1000);
      if (dados.type !== 'app' || dados.iss !== issuer || !Array.isArray(dados.aud) || dados.aud.length > 16 || !dados.aud.includes(configuracao.aud) ||
          !Number.isSafeInteger(dados.exp) || dados.exp <= segundos || !Number.isSafeInteger(dados.iat) || dados.iat > segundos + 30 ||
          (dados.nbf !== undefined && (!Number.isSafeInteger(dados.nbf) || dados.nbf > segundos + 30)) ||
          typeof dados.sub !== 'string' || !dados.sub || dados.sub.length > 256 || typeof dados.email !== 'string' ||
          !emails.some(email => email.toLowerCase() === dados.email.toLowerCase())) throw new ErroAccess();
      let atual = cache.get(issuer);
      if (!atual || agora() - atual.em >= 5 * 60 * 1000) atual = await carregar(issuer);
      // Permite rotação sem aceitar uma chave embutida no próprio token; limita pesquisas de kids falsos.
      if (!atual.chaves.has(cab.kid) && agora() - atual.em >= 30000) atual = await carregar(issuer);
      const chave = atual.chaves.get(cab.kid); if (!chave) throw new ErroAccess();
      if (!crypto.verify('RSA-SHA256', Buffer.from(partes[0] + '.' + partes[1]), { key: chave, padding: crypto.constants.RSA_PKCS1_PADDING }, assinatura)) throw new ErroAccess();
      return { email: dados.email, sub: dados.sub, iss: dados.iss, aud: dados.aud, iat: dados.iat, exp: dados.exp, type: 'app' };
    } catch (erro) { throw erro instanceof ErroAccess ? erro : new ErroAccess(); }
  }
  return { verificar };
}

module.exports = { criarVerificadorAccess, normalizarIssuer, ErroAccess };
