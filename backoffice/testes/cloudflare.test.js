'use strict';

// Sem rede, ficheiros ou processos reais: o fornecedor, disco e conector são simulados.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { criarCloudflare } = require('../cloudflare');

const zonaId = '1'.repeat(32), contaId = '2'.repeat(32), appId = '3'.repeat(32), otpId = '4'.repeat(32), aud = '5'.repeat(64);
const tunelId = '11111111-2222-4333-8444-555555555555';
const apiToken = 'token_api_ficticio_nunca_devolver_123456';
const tunnelToken = 'token_tunel_ficticio_nunca_devolver_123456';
const contexto = { atorId: 'operador-ficticio', autorizar() {} };
const entrada = { zonaId, hostname: 'www.exemplo.pt', hostnameGestao: 'gestao.exemplo.pt', emailsPermitidos: ['operador@example.test'] };

function fixture(opcoes = {}) {
  const ficheiros = new Map(), escritas = [], chamadas = [], eventos = [];
  let tempo = Date.now(), e = { instalado: true, ligado: false, estado: 'desligado', pid: null, versao: 'teste', erro: null };
  const remoto = { apps: [], policies: [], idps: [{ id: otpId, type: 'onetimepin' }], tuneis: [], config: { ingress: [] }, dns: new Map(), ssl: 'full', https: 'off', origem: 8891, ...opcoes };
  const fsImpl = {
    readFileSync(f) { if (!ficheiros.has(f)) throw Object.assign(new Error(), { code: 'ENOENT' }); return ficheiros.get(f); },
    mkdirSync() {},
    writeFileSync(f, valor, opts) { assert.equal(opts.mode, 0o600); escritas.push(valor); ficheiros.set(f, valor); },
    renameSync(a, b) { ficheiros.set(b, ficheiros.get(a)); ficheiros.delete(a); },
    unlinkSync(f) { ficheiros.delete(f); },
  };
  const conector = {
    estado: () => ({ ...e }),
    async instalar() { e.instalado = true; return e; },
    async ligar(token) { assert.equal(token, tunnelToken); eventos.push('ligar'); e = { ...e, ligado: true, estado: 'ligado', pid: 123 }; return e; },
    async desligar() { eventos.push('desligar'); e = { ...e, ligado: false, estado: 'desligado', pid: null }; return e; },
  };
  const responder = (result, status = 200, informacao = { total_pages: 1 }) => new Response(JSON.stringify({ success: status === 200, result, result_info: informacao }), { status, headers: { 'Content-Type': 'application/json' } });
  function pagina(lista, u) {
    const porPagina = Number(u.searchParams.get('per_page')), atual = Number(u.searchParams.get('page'));
    assert.ok(Number.isInteger(porPagina) && porPagina > 0 && porPagina <= 100);
    assert.ok(Number.isInteger(atual) && atual > 0);
    const informacao = remoto.paginacaoApenasContagem
      ? { total_count: lista.length, ...(remoto.omitirPorPagina ? {} : { per_page: porPagina }) }
      : { total_pages: Math.max(1, Math.ceil(lista.length / porPagina)) };
    return responder(lista.slice((atual - 1) * porPagina, atual * porPagina), 200, informacao);
  }
  async function fetchImpl(endereco, pedido) {
    const u = new URL(endereco), rota = u.pathname.replace('/client/v4', ''), metodo = pedido.method;
    assert.equal(u.origin, 'https://api.cloudflare.com');
    assert.equal(pedido.headers.Authorization, 'Bearer ' + apiToken);
    assert.equal(pedido.headers.Origin, undefined); assert.equal(pedido.headers.Cookie, undefined); assert.equal(pedido.redirect, 'error');
    const corpo = pedido.body === undefined ? null : JSON.parse(pedido.body);
    chamadas.push({ rota, metodo, corpo, query: u.searchParams });
    if (remoto.redeDesligada) throw Error('rede, token=' + apiToken);
    if (remoto.status) return responder({ erro: apiToken }, remoto.status);
    if (metodo !== 'GET') eventos.push(metodo + ' ' + rota);
    if (metodo === 'GET' && rota === '/zones') {
      // A API real recusa per_page superior a 50 nesta rota.
      if (Number(u.searchParams.get('per_page')) > 50 || remoto.statusZonas) return responder({ bruto: 'resposta-bruta-fornecedor-ficticio ' + apiToken + ' ' + tunnelToken }, remoto.statusZonas || 400);
      return pagina(remoto.zonasListagem || [{ id: zonaId, name: 'exemplo.pt', status: 'active', account: { id: contaId } }], u);
    }
    if (metodo === 'GET' && rota === '/zones/' + zonaId) return responder({ id: zonaId, name: 'exemplo.pt', status: 'active', account: { id: contaId } });
    if (rota.endsWith('/ssl/universal/settings')) return responder({ enabled: true }, remoto.universalNegado ? 403 : 200);
    if (rota.endsWith('/settings/ssl')) { if (metodo === 'PATCH') remoto.ssl = corpo.value; return responder({ value: remoto.ssl, editable: true }); }
    if (rota.endsWith('/settings/always_use_https')) { if (metodo === 'PATCH') remoto.https = corpo.value; return responder({ value: remoto.https, editable: true }); }
    if (rota.endsWith('/access/organizations')) return responder({ auth_domain: 'equipa.cloudflareaccess.com' }, remoto.statusOrganizacao || 200);
    if (rota.endsWith('/access/identity_providers')) {
      if (metodo === 'POST') { assert.equal(corpo.type, 'onetimepin'); remoto.idps.push({ ...corpo, id: otpId }); return responder(remoto.idps.at(-1)); }
      return pagina(remoto.idps, u);
    }
    if (rota.endsWith('/access/apps')) {
      if (metodo === 'POST') {
        assert.equal(corpo.type, 'self_hosted'); assert.equal(corpo.domain, entrada.hostnameGestao);
        assert.deepEqual(corpo.allowed_idps, [otpId]); assert.equal(corpo.policies.length, 1); assert.equal(corpo.policies[0].decision, 'allow');
        remoto.apps.push({ ...corpo, id: appId, aud }); remoto.policies = corpo.policies;
        return responder(remoto.apps.at(-1));
      }
      return pagina(remoto.apps, u);
    }
    if (rota.endsWith('/access/apps/' + appId)) return responder(remoto.apps.find(a => a.id === appId));
    if (rota.endsWith('/access/apps/' + appId + '/policies')) return pagina(remoto.policyInvalida ? [{ decision: 'allow', include: [{ everyone: {} }], exclude: [], require: [] }] : remoto.policies, u);
    if (rota.endsWith('/cfd_tunnel')) {
      if (metodo === 'POST') { assert.equal(corpo.config_src, 'cloudflare'); remoto.tuneis.push({ id: tunelId, name: corpo.name, remote_config: true }); return responder({ ...remoto.tuneis.at(-1), credentials_file: { secret: tunnelToken } }); }
      return pagina(remoto.tuneis, u);
    }
    if (rota.endsWith('/configurations')) {
      if (metodo === 'PUT') {
        const persistido = JSON.parse(ficheiros.get(path.resolve('memoria/cloudflare.json')));
        assert.equal(persistido.acesso.confirmado, true, 'Access validado e persistido antes de publicar a porta administrativa');
        assert.equal(persistido.acesso.aud, aud);
        remoto.config = corpo.config;
      }
      return responder({ config: remoto.config });
    }
    if (rota.endsWith('/token')) return responder(tunnelToken);
    if (rota.endsWith('/dns_records')) {
      if (metodo === 'POST') { assert.equal(corpo.type, 'CNAME'); assert.equal(corpo.proxied, true); assert.equal(corpo.content, tunelId + '.cfargotunnel.com'); const r = { id: '6'.repeat(32), ...corpo }; remoto.dns.set(corpo.name, [r]); return responder(r); }
      return pagina(remoto.dns.get(u.searchParams.get('name')) || [], u);
    }
    throw Error('Endpoint não previsto no teste: ' + metodo + ' ' + rota);
  }
  const criar = (chave = '7'.repeat(64), protecao = true) => criarCloudflare({ pastaDados: path.resolve('memoria'), chaveBackoffice: chave, conector, resolverOrigem: async () => ({ servidor: 'grupo-bxb-servidor', portas: { site: remoto.origem, consulta: 8897, gestao: 8898 } }), portaBackoffice: 8890, portasProtegidas: [8890, 8897], validarProtecaoAccess: acesso => protecao && acesso.aud === aud, fetchImpl, fsImpl, agora: () => tempo });
  const api = criar();
  return { api, criar, remoto, chamadas, eventos, ficheiros, escritas, adiantar: ms => tempo += ms };
}
async function ligarEPreparar(f) { await f.api.ligarAPI({ token: apiToken }, contexto); return (await f.api.preparar(entrada, contexto)).plano; }
async function publicar(f) { const p = await ligarEPreparar(f); return f.api.aplicar({ planoId: p.id, confirmarZona: true }, contexto); }

test('pré-visualização só lê; segredos AES-GCM não aparecem em respostas ou no disco', async () => {
  const f = fixture(); const p = await ligarEPreparar(f);
  assert.equal(f.chamadas.some(c => c.metodo !== 'GET'), false);
  assert.equal(p.gestao.organizacaoPronta, true); assert.equal(p.alteraConfiguracaoZona, true);
  assert.equal(p.origem, 'http://127.0.0.1:8891');
  assert.ok(!JSON.stringify([p, f.api.estado(), ...f.escritas]).includes(apiToken));
  const segunda = f.criar(); assert.equal(segunda.estado().temToken, true);
  const errada = f.criar('8'.repeat(64)); assert.equal(errada.estado().temToken, false); assert.match(errada.estado().erro, /cifrada/);
});
test('Access allowlist e JWT guard existem antes de qualquer ingress ou DNS administrativo', async () => {
  const f = fixture(); const resultado = await publicar(f);
  assert.equal(resultado.configuracao.autoligar, false); assert.equal(resultado.configuracao.hostnameGestao, entrada.hostnameGestao);
  const cfg = f.remoto.config.ingress;
  assert.equal(cfg.length, 3); assert.equal(cfg[0].service, 'http://127.0.0.1:8891'); assert.equal(cfg[1].service, 'http://127.0.0.1:8890');
  assert.deepEqual(cfg[1].originRequest, { httpHostHeader: entrada.hostnameGestao }); assert.equal(cfg[2].service, 'http_status:404');
  const app = f.eventos.findIndex(e => e.includes('/access/apps'));
  const ingress = f.eventos.findIndex(e => e.startsWith('PUT ')); const dns = f.eventos.findIndex(e => e.includes('/dns_records'));
  assert.ok(app >= 0 && app < ingress && ingress < dns);
  assert.equal(f.remoto.ssl, 'strict'); assert.equal(f.remoto.https, 'on');
  assert.ok(!JSON.stringify([resultado, f.api.estado(), ...f.escritas]).includes(tunnelToken));
  assert.ok(!f.chamadas.some(c => /billing|subscription|purchase|certificate_packs|total_tls|advanced/i.test(c.rota)));
});
test('sem guarda JWT não publica ingress nem DNS, mesmo com aplicação Access criada', async () => {
  const f = fixture(), api = f.criar('7'.repeat(64), false);
  await api.ligarAPI({ token: apiToken }, contexto); const p = (await api.preparar(entrada, contexto)).plano;
  await assert.rejects(api.aplicar({ planoId: p.id, confirmarZona: true }, contexto), e => e.estado === 409 && /JWT/.test(e.message));
  assert.equal(f.chamadas.some(c => c.metodo === 'PUT' || c.rota.endsWith('/dns_records') && c.metodo === 'POST'), false);
});
test('readback recusa Everyone antes de persistir Access ou publicar administração', async () => {
  const f = fixture({ policyInvalida: true }), p = await ligarEPreparar(f);
  await assert.rejects(f.api.aplicar({ planoId: p.id, confirmarZona: true }, contexto), e => e.estado === 409 && /política/.test(e.message));
  assert.equal(f.api.configAccess(), null);
  assert.equal(f.chamadas.some(c => c.metodo === 'PUT' || c.rota.endsWith('/dns_records') && c.metodo === 'POST'), false);
});
test('impede substituir registos DNS ou aplicações Access de terceiros', async () => {
  for (const host of [entrada.hostname, entrada.hostnameGestao]) {
    const f = fixture(); f.remoto.dns.set(host, [{ type: 'A', content: '192.0.2.1', proxied: true }]);
    await f.api.ligarAPI({ token: apiToken }, contexto);
    await assert.rejects(f.api.preparar(entrada, contexto), e => e.estado === 409);
    assert.equal(f.chamadas.some(c => c.metodo !== 'GET'), false);
  }
  const f = fixture({ apps: [{ id: appId, domain: entrada.hostnameGestao, type: 'self_hosted', aud }] });
  await f.api.ligarAPI({ token: apiToken }, contexto);
  await assert.rejects(f.api.preparar(entrada, contexto), e => e.estado === 409 && /Access/.test(e.message));
});
test('bloqueia domínio profundo, nomes de gestão usados como site e portas reservadas', async () => {
  const f = fixture(); await f.api.ligarAPI({ token: apiToken }, contexto);
  for (const hostname of ['www.outro.pt', 'um.dois.exemplo.pt', 'https://exemplo.pt', 'gestao.exemplo.pt']) await assert.rejects(f.api.preparar({ ...entrada, hostname }, contexto), e => e.estado === 400);
  for (const porta of [8100, 8097, 8099, 8890, 8897, 8898]) { f.remoto.origem = porta; await assert.rejects(f.api.preparar(entrada, contexto), e => e.estado === 409); }
  for (const emails of [[], Array(51).fill('x@example.test'), ['invalido']]) await assert.rejects(f.api.preparar({ ...entrada, emailsPermitidos: emails }, contexto), e => e.estado === 400 || e.estado === 409);
});
test('plano exige confirmação zonal, expira, pertence ao operador e é de uso único', async () => {
  const f = fixture(), p = await ligarEPreparar(f);
  await assert.rejects(f.api.aplicar({ planoId: p.id }, contexto), e => e.estado === 409);
  await assert.rejects(f.api.aplicar({ planoId: p.id, confirmarZona: true }, { atorId: 'outro' }), e => e.estado === 409);
  f.adiantar(600001); await assert.rejects(f.api.aplicar({ planoId: p.id, confirmarZona: true }, contexto), e => e.estado === 409);
  const r = await f.api.preparar(entrada, contexto); await f.api.aplicar({ planoId: r.plano.id, confirmarZona: true }, contexto);
  await assert.rejects(f.api.aplicar({ planoId: r.plano.id, confirmarZona: true }, contexto), e => e.estado === 409);
});
test('alteração remota após preview impede escrita; não reduz configuração SSL mais forte', async () => {
  const f = fixture({ ssl: 'origin_pull', https: 'on' }), p = await ligarEPreparar(f);
  assert.equal(p.alteraConfiguracaoZona, false);
  f.remoto.https = 'off'; await assert.rejects(f.api.aplicar({ planoId: p.id }, contexto), e => e.estado === 409);
  assert.equal(f.chamadas.some(c => c.metodo !== 'GET'), false);
});
test('retoma apenas após Ligar explícito; Desligar impede autoarranque futuro', async () => {
  const f = fixture(); await publicar(f); await f.api.retomar(); assert.equal(f.eventos.includes('ligar'), false);
  await f.api.ligar(contexto); assert.equal(f.api.estado().configuracao.autoligar, true);
  await f.api.encerrar(); const segunda = f.criar(); await segunda.retomar(); assert.equal(segunda.estado().conector.ligado, true);
  await segunda.desligar(contexto); const terceira = f.criar(); await terceira.retomar(); assert.equal(terceira.estado().configuracao.autoligar, false);
});
test('erros do fornecedor não são 401 do back-office nem revelam tokens', async () => {
  for (const status of [401, 403, 429, 500, 503]) {
    const f = fixture({ status });
    await assert.rejects(f.api.ligarAPI({ token: apiToken }, contexto), e => [502, 503].includes(e.estado) && e.provedor === 'cloudflare' && !e.message.includes(apiToken));
  }
  const f = fixture({ redeDesligada: true }); await assert.rejects(f.api.ligarAPI({ token: apiToken }, contexto), e => e.estado === 503);
  const opcional = fixture({ universalNegado: true }), p = await ligarEPreparar(opcional); assert.equal(p.ssl.universal, 'desconhecido');
  const organizacao = fixture({ statusOrganizacao: 503 }); await organizacao.api.ligarAPI({ token: apiToken }, contexto);
  await assert.rejects(organizacao.api.preparar(entrada, contexto), e => e.estado === 503 && e.provedor === 'cloudflare');
});
test('preserva regras adicionais de túnel em vez de as sobrescrever', async () => {
  const f = fixture(); await publicar(f);
  f.remoto.config.ingress.unshift({ hostname: 'outro.exemplo.pt', service: 'http://127.0.0.1:8097' });
  f.chamadas.length = 0;
  await assert.rejects(f.api.preparar(entrada, contexto), e => e.estado === 409);
  await assert.rejects(f.api.ligar(contexto), e => e.estado === 409);
  assert.equal(f.chamadas.some(c => c.metodo !== 'GET'), false);
});


test('ligação lista duas páginas de 50 zonas sem mutação nem segredo devolvido', async () => {
  const zonasListagem = Array.from({ length: 100 }, (_, i) => ({ id: (i + 1).toString(16).padStart(32, '0'), name: 'zona' + i + '.example.test', status: 'active', account: { id: contaId } }));
  const f = fixture({ zonasListagem });
  const ligado = await f.api.ligarAPI({ token: apiToken }, contexto);
  assert.equal(ligado.zonas.length, 100);
  assert.deepEqual(ligado.zonas.map(z => z.id), zonasListagem.map(z => z.id));
  const chamadas = f.chamadas.filter(c => c.rota === '/zones');
  assert.deepEqual(chamadas.map(c => c.query.get('per_page')), ['50', '50']);
  assert.deepEqual(chamadas.map(c => c.query.get('page')), ['1', '2']);
  assert.ok(f.chamadas.every(c => c.metodo === 'GET'));
  assert.deepEqual(f.eventos, []);
  const devolvido = JSON.stringify([ligado, f.api.estado()]);
  assert.ok(!devolvido.includes(apiToken)); assert.ok(!devolvido.includes(tunnelToken));
});

test('fallback total_count pagina zonas e listagens da conta, com ou sem per_page na resposta', async () => {
  for (const omitirPorPagina of [false, true]) {
    const zonasListagem = Array.from({ length: 100 }, (_, i) => ({ id: (i + 1).toString(16).padStart(32, '0'), name: 'zona' + i + '.example.test', status: 'active', account: { id: contaId } }));
    const apps = Array.from({ length: 101 }, (_, i) => ({ id: (i + 1000).toString(16).padStart(32, '0'), type: 'self_hosted', domain: 'outra' + i + '.exemplo.pt', aud }));
    const idps = Array.from({ length: 100 }, (_, i) => ({ id: (i + 2000).toString(16).padStart(32, '0'), type: 'outro' })).concat({ id: otpId, type: 'onetimepin' });
    const tuneis = Array.from({ length: 101 }, (_, i) => ({ id: 'externo-' + i, name: 'outro-' + i, remote_config: true }));
    const f = fixture({ paginacaoApenasContagem: true, omitirPorPagina, zonasListagem, apps, idps, tuneis });
    const ligado = await f.api.ligarAPI({ token: apiToken }, contexto);
    assert.equal(ligado.zonas.length, 100);
    const p = (await f.api.preparar(entrada, contexto)).plano;
    assert.equal(p.gestao.organizacaoPronta, true);
    assert.deepEqual(f.chamadas.filter(c => c.rota === '/zones').map(c => [c.query.get('per_page'), c.query.get('page')]), [['50', '1'], ['50', '2']]);
    for (const sufixo of ['/cfd_tunnel', '/access/apps', '/access/identity_providers']) {
      const chamadas = f.chamadas.filter(c => c.rota.endsWith(sufixo));
      assert.deepEqual(chamadas.map(c => [c.query.get('per_page'), c.query.get('page')]), [['100', '1'], ['100', '2']], sufixo);
    }
    assert.ok(f.chamadas.every(c => c.metodo === 'GET'));
    assert.deepEqual(f.eventos, []);
    const devolvido = JSON.stringify([ligado, p, f.api.estado()]);
    assert.ok(!devolvido.includes(apiToken)); assert.ok(!devolvido.includes(tunnelToken));
  }
});

test('HTTP 400 ao listar domínios identifica a etapa, oculta o corpo bruto e não guarda credenciais', async () => {
  const f = fixture({ statusZonas: 400 });
  await assert.rejects(f.api.ligarAPI({ token: apiToken }, contexto), erro => {
    assert.equal(erro.estado, 502); assert.equal(erro.provedor, 'cloudflare');
    assert.match(erro.message, /listar os domínios/); assert.match(erro.message, /HTTP 400/);
    const exposto = JSON.stringify(erro, Object.getOwnPropertyNames(erro));
    assert.ok(!exposto.includes('resposta-bruta-fornecedor-ficticio'));
    assert.ok(!exposto.includes(apiToken)); assert.ok(!exposto.includes(tunnelToken));
    return true;
  });
  assert.equal(f.api.estado().temToken, false);
  assert.equal(f.ficheiros.size, 0); assert.equal(f.escritas.length, 0);
  assert.ok(f.chamadas.every(c => c.metodo === 'GET'));
  assert.deepEqual(f.eventos, []);
});
