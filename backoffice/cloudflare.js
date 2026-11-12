'use strict';

// Integração independente. Não lê nem escreve dados do sistema dos clientes.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { domainToASCII } = require('node:url');

const BASE = 'https://api.cloudflare.com/client/v4';
const ID = /^[a-f0-9]{32}$/i;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const ESTADOS = new Set(['nao_instalado', 'desligado', 'a_instalar', 'a_arrancar', 'ligado', 'a_religar', 'a_desligar', 'erro']);
const DURACAO_PLANO = 10 * 60 * 1000;

class ErroCloudflare extends Error {
  constructor(estado, mensagem, statusProvedor = null) {
    super(mensagem);
    this.estado = estado;
    this.provedor = 'cloudflare';
    this.statusProvedor = statusProvedor;
  }
}
const falhar = (estado, mensagem) => { throw new ErroCloudflare(estado, mensagem); };
const copiar = valor => valor == null ? valor : JSON.parse(JSON.stringify(valor));
const resumo = valor => crypto.createHash('sha256').update(JSON.stringify(valor)).digest('hex');

function dominio(valor) {
  if (typeof valor !== 'string' || /[\s/:\\@?#*\u0000-\u001f]/.test(valor)) falhar(400, 'Indique apenas o domínio, sem protocolo, porta ou caminho.');
  const nome = domainToASCII(valor.toLowerCase().replace(/\.$/, ''));
  if (!nome || nome.length > 253 || !nome.includes('.') || nome.split('.').some(p => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(p))) falhar(400, 'O domínio indicado não é válido.');
  return nome;
}

function criarCloudflare({ pastaDados, chaveBackoffice, conector, resolverOrigem, validarProtecaoAccess = () => false, portaBackoffice = 8100, fetchImpl = globalThis.fetch, fsImpl = fs, agora = Date.now, portasProtegidas = [] }) {
  if (!/^[a-f0-9]{64}$/i.test(chaveBackoffice || '')) throw new Error('A integração exige a chave própria do back-office.');
  const ficheiro = path.join(path.resolve(pastaDados), 'cloudflare.json');
  const chave = Buffer.from(crypto.hkdfSync('sha256', Buffer.from(chaveBackoffice, 'hex'), Buffer.from('dinmeta:backoffice:v1'), Buffer.from('cloudflare:credenciais:v1'), 32));
  const aad = Buffer.from('dinmeta-cloudflare:1');
  let dados = { versao: 1, configuracao: null, pendente: null, credenciais: null };
  let erroPersistencia = null, ultimoErro = null, ocupado = false, encerrado = false;
  const planos = new Map();
  const origemGestao = 'http://127.0.0.1:' + portaBackoffice;
  try {
    const lido = JSON.parse(fsImpl.readFileSync(ficheiro, 'utf8'));
    if (lido.versao !== 1 || !Object.hasOwn(lido, 'credenciais') || !Object.hasOwn(lido, 'configuracao')) throw new Error();
    dados = lido;
    lerSegredos();
  } catch (erro) {
    if (erro.code !== 'ENOENT') erroPersistencia = 'Não foi possível ler a configuração cifrada da Cloudflare. Verifique os ficheiros próprios do back-office.';
  }

  function lerSegredos() {
    if (!dados.credenciais) return {};
    try {
      const c = dados.credenciais;
      const decifrador = crypto.createDecipheriv('aes-256-gcm', chave, Buffer.from(c.iv, 'base64'));
      decifrador.setAAD(aad); decifrador.setAuthTag(Buffer.from(c.tag, 'base64'));
      const segredos = JSON.parse(Buffer.concat([decifrador.update(Buffer.from(c.dados, 'base64')), decifrador.final()]).toString('utf8'));
      if (!segredos || typeof segredos !== 'object' || Array.isArray(segredos)) throw new Error();
      return segredos;
    } catch { falhar(503, 'Não foi possível decifrar as credenciais da Cloudflare com a chave deste back-office.'); }
  }

  function cifrar(segredos) {
    const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', chave, iv);
    c.setAAD(aad);
    const corpo = Buffer.concat([c.update(JSON.stringify(segredos), 'utf8'), c.final()]);
    return { iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), dados: corpo.toString('base64') };
  }

  function guardar(alteracoes, segredos = null) {
    const novo = { ...dados, ...alteracoes };
    if (segredos !== null) novo.credenciais = cifrar(segredos);
    const temporario = ficheiro + '.' + crypto.randomBytes(8).toString('hex') + '.tmp';
    try {
      fsImpl.mkdirSync(path.dirname(ficheiro), { recursive: true, mode: 0o700 });
      fsImpl.writeFileSync(temporario, JSON.stringify(novo), { flag: 'wx', mode: 0o600 });
      fsImpl.renameSync(temporario, ficheiro);
      dados = novo;
    } catch {
      try { fsImpl.unlinkSync(temporario); } catch { /* Só o temporário desta operação. */ }
      falhar(503, 'Não foi possível guardar a configuração própria da Cloudflare.');
    }
  }

  function verificarDisponivel() {
    if (erroPersistencia) falhar(503, erroPersistencia);
    if (encerrado) falhar(503, 'O back-office está a desligar.');
  }
  function autorizar(contexto) { contexto?.autorizar?.(); verificarDisponivel(); }
  function tokenAtual() {
    verificarDisponivel();
    const token = lerSegredos().apiToken;
    if (!token) falhar(400, 'Ligue primeiro a conta Cloudflare com um token de API.');
    return token;
  }
  async function exclusivo(funcao) {
    verificarDisponivel();
    if (ocupado) falhar(409, 'Já existe uma operação Cloudflare em curso. Aguarde.');
    ocupado = true;
    try { const resultado = await funcao(); ultimoErro = null; return resultado; }
    catch (erro) { if (erro instanceof ErroCloudflare) ultimoErro = erro.message; throw erro; }
    finally { ocupado = false; }
  }
  function estadoConector() {
    try {
      const e = conector.estado();
      return { instalado: Boolean(e.instalado), ligado: Boolean(e.ligado), estado: ESTADOS.has(e.estado) ? e.estado : 'erro', versao: typeof e.versao === 'string' ? e.versao.slice(0, 80) : null, pid: Number.isInteger(e.pid) && e.pid > 0 ? e.pid : null, erro: typeof e.erro === 'string' ? e.erro.slice(0, 300) : null };
    } catch { return { instalado: false, ligado: false, estado: 'erro', versao: null, pid: null, erro: 'Não foi possível consultar o conector local.' }; }
  }
  function configuracaoPublica() {
    const c = dados.configuracao;
    if (!c) return null;
    return { zonaId: c.zonaId, zonaNome: c.zonaNome, contaId: c.contaId, hostname: c.hostname, hostnameGestao: c.hostnameGestao, access: configAccess(), tunelId: c.tunelId, tunelNome: c.tunelNome, autoligar: Boolean(c.autoligar) };
  }
  function configAccess() {
    const a = dados.acesso;
    return a?.confirmado === true ? { hostname: a.hostname, issuer: a.issuer, aud: a.aud, emails: [...a.emails], emailsPermitidos: [...a.emails], appId: a.appId, contaId: a.contaId } : null;
  }
  function estado() {
    let temToken = false;
    try { temToken = !erroPersistencia && Boolean(lerSegredos().apiToken); } catch { /* Estado local continua acessível. */ }
    return { gratuito: true, temToken, configurado: Boolean(dados.configuracao), configuracao: configuracaoPublica(), conector: estadoConector(), erro: erroPersistencia || ultimoErro };
  }
  const resposta = () => ({ ok: true, gratuito: true, configuracao: configuracaoPublica(), conector: estadoConector() });

  async function pedir(caminho, token, metodo = 'GET', corpo = undefined, contexto = null) {
    const leitura = /^\/zones(?:\?|$)|^\/zones\/[a-f0-9]{32}(?:$|\/dns_records\?|\/settings\/(?:ssl|always_use_https)$|\/ssl\/universal\/settings$)|^\/accounts\/[a-f0-9]{32}\/cfd_tunnel(?:\?|\/[a-f0-9-]{36}\/(?:token|configurations)$)|^\/accounts\/[a-f0-9]{32}\/access\/(?:organizations$|identity_providers\?|apps(?:\?|\/[a-f0-9-]{32,36}(?:$|\/policies\?)))/i;
    const escrita = (metodo === 'POST' && /^\/(?:accounts\/[a-f0-9]{32}\/cfd_tunnel|zones\/[a-f0-9]{32}\/dns_records)$/i.test(caminho)) ||
      (metodo === 'PUT' && /^\/accounts\/[a-f0-9]{32}\/cfd_tunnel\/[a-f0-9-]{36}\/configurations$/i.test(caminho)) ||
      (metodo === 'PATCH' && /^\/zones\/[a-f0-9]{32}\/settings\/(?:ssl|always_use_https)$/i.test(caminho)) ||
      (metodo === 'POST' && /^\/accounts\/[a-f0-9]{32}\/access\/(?:apps|identity_providers)$/i.test(caminho));
    if ((metodo === 'GET' && !leitura.test(caminho)) || (metodo !== 'GET' && !escrita)) falhar(400, 'Operação Cloudflare fora da lista gratuita permitida.');
    if (metodo !== 'GET') autorizar(contexto);
    let r;
    try {
      r = await fetchImpl(BASE + caminho, { method: metodo, headers: { Authorization: 'Bearer ' + token, Accept: 'application/json', ...(corpo === undefined ? {} : { 'Content-Type': 'application/json' }) }, body: corpo === undefined ? undefined : JSON.stringify(corpo), signal: AbortSignal.timeout(15000), redirect: 'error' });
    } catch { throw new ErroCloudflare(503, 'Não foi possível contactar a Cloudflare. Verifique a ligação à Internet.'); }
    if (!r.ok) {
      await r.body?.cancel?.();
      if ([401, 403].includes(r.status)) throw new ErroCloudflare(502, 'A Cloudflare recusou o token ou as permissões necessárias. Verifique a conta e a zona autorizadas.', r.status);
      if (r.status === 404) throw new ErroCloudflare(409, 'O recurso já não existe na Cloudflare. Prepare novamente a configuração.', r.status);
      if (r.status === 429) throw new ErroCloudflare(503, 'A Cloudflare limitou temporariamente os pedidos. Aguarde antes de repetir.', r.status);
      throw new ErroCloudflare(r.status >= 500 ? 503 : 502, 'A Cloudflare não conseguiu concluir esta operação. Prepare novamente o plano antes de repetir.', r.status);
    }
    let j;
    try {
      const partes = []; let tamanho = 0;
      for await (const p of r.body) { tamanho += p.length; if (tamanho > 2 * 1024 * 1024) throw new Error(); partes.push(Buffer.from(p)); }
      j = JSON.parse(Buffer.concat(partes).toString('utf8'));
    } catch { throw new ErroCloudflare(502, 'A Cloudflare devolveu uma resposta inválida ou demasiado grande.'); }
    if (!j || j.success !== true || !Object.hasOwn(j, 'result')) throw new ErroCloudflare(502, 'A Cloudflare recusou a operação. Verifique o token, as permissões e a configuração.');
    return j;
  }
  async function lista(caminho, token, parametros = {}) {
    const itens = [];
    for (let pagina = 1; pagina <= 20; pagina++) {
      const q = new URLSearchParams({ ...parametros, per_page: '100', page: String(pagina) });
      const j = await pedir(caminho + '?' + q, token);
      if (!Array.isArray(j.result)) falhar(502, 'A Cloudflare devolveu uma lista inválida.');
      itens.push(...j.result);
      const total = Number(j.result_info?.total_pages || 1);
      if (pagina >= total) return itens;
    }
    falhar(502, 'A lista Cloudflare é demasiado extensa para esta configuração local. Restrinja o token à conta e zona pretendidas.');
  }
  function zonaPublica(z) {
    if (!ID.test(z?.id || '') || !ID.test(z.account?.id || '') || typeof z.name !== 'string') falhar(502, 'A Cloudflare devolveu uma zona inválida.');
    return { id: z.id, nome: dominio(z.name), estado: String(z.status || 'desconhecido'), contaId: z.account.id };
  }
  async function zonas() { return { zonas: (await lista('/zones', tokenAtual())).map(zonaPublica) }; }
  async function ligarAPI(corpo, contexto) {
    return exclusivo(async () => {
      if (typeof corpo.token !== 'string' || !/^[A-Za-z0-9_.-]{20,4096}$/.test(corpo.token.trim())) falhar(400, 'Introduza um token de API Cloudflare válido.');
      const token = corpo.token.trim(), encontradas = (await lista('/zones', token)).map(zonaPublica);
      autorizar(contexto);
      guardar({}, { ...lerSegredos(), apiToken: token }); planos.clear();
      return { ok: true, gratuito: true, temToken: true, zonas: encontradas };
    });
  }
  async function origemLocal() {
    let saude;
    try { saude = await resolverOrigem(); } catch { falhar(503, 'Ligue o servidor do site antes de preparar ou ligar o túnel Cloudflare.'); }
    const p = saude?.portas, site = Number(p?.site);
    const proibidas = new Set([portaBackoffice, 8100, 8097, 8099, 8890, 8897, 8898, ...portasProtegidas, Number(p?.backoffice), Number(p?.consulta), Number(p?.gestao)]);
    if (saude?.servidor !== 'grupo-bxb-servidor' || !Number.isInteger(site) || site < 1 || site > 65535 || proibidas.has(site)) falhar(409, 'A API de consulta não confirmou uma porta segura do site. O túnel nunca publica o back-office nem as APIs locais.');
    return 'http://127.0.0.1:' + site;
  }
  function configuracaoTunel(hostname, origem, hostnameGestao) {
    // Host fixo impede que cabeçalhos do visitante simulem um acesso localhost.
    return { ingress: [{ hostname, service: origem, originRequest: {} }, { hostname: hostnameGestao, service: origemGestao, originRequest: { httpHostHeader: hostnameGestao } }, { service: 'http_status:404' }] };
  }
  function validarConfiguracaoGerida(config, gerido, vazioPermitido = false) {
    if (config && (Object.keys(config).some(k => !['ingress', 'originRequest', 'warp-routing'].includes(k)) || Object.keys(config.originRequest || {}).length || (config['warp-routing'] && config['warp-routing'].enabled !== false))) falhar(409, 'O túnel contém opções adicionais que este back-office preserva sem alterar.');
    if ((!config || (Array.isArray(config.ingress) && !config.ingress.length)) && vazioPermitido) return;
    const ingress = config?.ingress;
    if (!Array.isArray(ingress) || ingress.length !== 3) falhar(409, 'O túnel contém regras que não pertencem a esta configuração. Nenhuma regra existente foi substituída.');
    const [regra, admin, fim] = ingress;
    if (regra.hostname !== gerido.hostname || regra.service !== gerido.origem || fim.service !== 'http_status:404' || Object.keys(regra).some(k => !['hostname', 'service', 'originRequest'].includes(k)) || Object.keys(regra.originRequest || {}).length || Object.keys(fim).some(k => k !== 'service')) falhar(409, 'A configuração do túnel foi alterada fora deste back-office. Reveja-a na Cloudflare antes de continuar.');
    if (admin.hostname !== gerido.hostnameGestao || admin.service !== origemGestao || resumo(admin.originRequest) !== resumo({ httpHostHeader: gerido.hostnameGestao }) || Object.keys(admin).some(k => !['hostname', 'service', 'originRequest'].includes(k))) falhar(409, 'A regra de administração do túnel não corresponde à proteção Access configurada.');
  }
  function emailsValidos(valores) {
    if (!Array.isArray(valores) || !valores.length || valores.length > 50) falhar(400, 'Indique entre 1 e 50 emails autorizados no Cloudflare Access gratuito.');
    const lista = valores.map(v => typeof v === 'string' ? v.trim().toLowerCase() : '');
    if (lista.some(v => v.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))) falhar(400, 'A lista de emails autorizados contém um endereço inválido.');
    return [...new Set(lista)].sort();
  }
  const idAccessValido = valor => ID.test(valor || '') || UUID.test(valor || '');
  async function verificarAplicacao(contaId, appId, hostname, emails, issuer) {
    const base = '/accounts/' + contaId + '/access/apps/' + appId;
    const app = (await pedir(base, tokenAtual())).result;
    const policies = await lista(base + '/policies', tokenAtual());
    if (app?.type !== 'self_hosted' || app.domain !== hostname || !/^[a-f0-9]{64}$/i.test(app.aud || '') || policies.length !== 1) falhar(409, 'A aplicação Access não confirmou a proteção exclusiva deste subdomínio.');
    const p = policies[0];
    if (p.decision !== 'allow' || p.exclude?.length || p.require?.length || !Array.isArray(p.include) || p.include.some(r => !r.email || Object.keys(r).length !== 1 || Object.keys(r.email).some(k => k !== 'email'))) falhar(409, 'A política Access não é uma lista exclusiva de emails autorizados. Nenhuma regra foi substituída.');
    if (resumo(emailsValidos(p.include.map(r => r.email.email))) !== resumo(emails)) falhar(409, 'Os emails da política Access diferem do plano. Reveja a aplicação existente na Cloudflare.');
    return { hostname, issuer, aud: app.aud, appId, contaId, emails, confirmado: true };
  }
  async function recolherAccess(contaId, hostname, emails, token) {
    let org;
    try { org = (await pedir('/accounts/' + contaId + '/access/organizations', token)).result; }
    catch (erro) { if (erro instanceof ErroCloudflare && [403, 404].includes(erro.statusProvedor)) falhar(409, 'Ative primeiro a organização Zero Trust Free na Cloudflare e autorize as permissões Access deste token. Não é necessário contratar um plano pago.'); throw erro; }
    const auth = String(org?.auth_domain || '').toLowerCase();
    if (!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(auth)) falhar(409, 'A organização Zero Trust Free ainda não tem um domínio Access válido. Termine a configuração gratuita na Cloudflare.');
    const issuer = 'https://' + auth;
    const apps = await lista('/accounts/' + contaId + '/access/apps', token);
    const encontradas = apps.filter(a => a.domain === hostname);
    const nossa = [dados.acessoPendente, dados.acesso].find(a => a && a.hostname === hostname && a.contaId === contaId);
    let existente = null;
    if (encontradas.length) {
      if (encontradas.length !== 1 || !nossa || encontradas[0].id !== nossa.appId) falhar(409, 'Este subdomínio já tem uma aplicação Access que não pertence a esta configuração. Nada foi alterado.');
      existente = await verificarAplicacao(contaId, nossa.appId, hostname, emails, issuer);
    }
    const idps = await lista('/accounts/' + contaId + '/access/identity_providers', token);
    const otp = idps.find(p => p.type === 'onetimepin' && idAccessValido(p.id));
    return { hostname, emails, issuer, existente, otpId: otp?.id || null };
  }
  async function criarAccess(r, token, contexto) {
    if (r.access.existente) return r.access.existente;
    const conta = r.zona.contaId;
    let otpId = r.access.otpId;
    if (!otpId) {
      const otp = (await pedir('/accounts/' + conta + '/access/identity_providers', token, 'POST', { name: 'Código por email dinmeta', type: 'onetimepin', config: {} }, contexto)).result;
      if (!idAccessValido(otp?.id) || otp.type !== 'onetimepin') falhar(502, 'A Cloudflare não confirmou a autenticação gratuita por código de email.');
      otpId = otp.id;
    }
    const app = (await pedir('/accounts/' + conta + '/access/apps', token, 'POST', { name: 'dinmeta Gestão', type: 'self_hosted', domain: r.access.hostname, session_duration: '1h', allowed_idps: [otpId], auto_redirect_to_identity: true, app_launcher_visible: false, policies: [{ name: 'Operadores autorizados', decision: 'allow', include: r.access.emails.map(email => ({ email: { email } })), exclude: [], require: [], precedence: 1 }] }, contexto)).result;
    if (!idAccessValido(app?.id)) falhar(502, 'A Cloudflare não confirmou a aplicação Access. O painel não será publicado.');
    autorizar(contexto); guardar({ acessoPendente: { hostname: r.access.hostname, issuer: r.access.issuer, appId: app.id, contaId: conta, emails: r.access.emails, confirmado: false } });
    return verificarAplicacao(conta, app.id, r.access.hostname, r.access.emails, r.access.issuer);
  }
  async function recolher(zonaId, hostname, hostnameGestao, emailsPermitidos, token) {
    if (!ID.test(zonaId || '')) falhar(400, 'Escolha uma zona válida.');
    hostname = dominio(hostname);
    const z = (await pedir('/zones/' + zonaId, token)).result, zona = zonaPublica(z);
    if (zona.estado !== 'active') falhar(409, 'A zona tem de estar ativa na Cloudflare antes de publicar o site.');
    const prefixo = hostname === zona.nome ? '' : hostname.endsWith('.' + zona.nome) ? hostname.slice(0, -zona.nome.length - 1) : null;
    if (prefixo === null || prefixo.includes('.')) falhar(400, 'O HTTPS gratuito permite o domínio principal ou apenas um nível de subdomínio desta zona.');
    if (['gestao', 'backoffice', 'localhost', 'consulta'].includes(prefixo)) falhar(400, 'Este nome está reservado a serviços de gestão locais. Escolha um nome público para o site.');
    hostnameGestao = dominio(hostnameGestao);
    const adminPrefixo = hostnameGestao.endsWith('.' + zona.nome) ? hostnameGestao.slice(0, -zona.nome.length - 1) : '';
    if (!adminPrefixo || adminPrefixo.includes('.') || ['localhost', 'consulta'].includes(adminPrefixo) || hostnameGestao === hostname) falhar(400, 'A gestão exige um subdomínio distinto, de um só nível, nesta mesma zona.');
    const emails = emailsValidos(emailsPermitidos);
    const origem = await origemLocal();
    const tunels = await lista('/accounts/' + zona.contaId + '/cfd_tunnel', token, { is_deleted: 'false' });
    const candidato = [dados.pendente, dados.configuracao].find(c => c && c.zonaId === zonaId && c.hostname === hostname && c.hostnameGestao === hostnameGestao && c.contaId === zona.contaId);
    let gerido = null, configExistente = null;
    if (candidato) {
      const t = tunels.find(t => t.id === candidato.tunelId);
      if (!t || t.name !== candidato.tunelNome || t.remote_config === false) falhar(409, 'O túnel gerido foi removido ou alterado na Cloudflare. Nenhum túnel de outra aplicação será usado.');
      gerido = candidato;
      configExistente = (await pedir('/accounts/' + zona.contaId + '/cfd_tunnel/' + gerido.tunelId + '/configurations', token)).result?.config;
      validarConfiguracaoGerida(configExistente, gerido, dados.pendente?.tunelId === gerido.tunelId);
    }
    const records = await lista('/zones/' + zonaId + '/dns_records', token, { name: hostname });
    const destino = gerido ? gerido.tunelId.toLowerCase() + '.cfargotunnel.com' : null;
    if (records.length && (records.length !== 1 || records[0].type !== 'CNAME' || String(records[0].content || '').toLowerCase().replace(/\.$/, '') !== destino || records[0].proxied !== true)) falhar(409, 'Já existe um registo DNS diferente para este nome. Não foi apagado nem substituído. Escolha outro nome ou reveja o registo na Cloudflare.');
    const recordsAdmin = await lista('/zones/' + zonaId + '/dns_records', token, { name: hostnameGestao });
    if (recordsAdmin.length && (recordsAdmin.length !== 1 || recordsAdmin[0].type !== 'CNAME' || String(recordsAdmin[0].content || '').toLowerCase().replace(/\.$/, '') !== destino || recordsAdmin[0].proxied !== true)) falhar(409, 'O subdomínio de gestão já tem um registo DNS diferente. Não foi apagado nem substituído.');
    const access = await recolherAccess(zona.contaId, hostnameGestao, emails, token);
    const ssl = (await pedir('/zones/' + zonaId + '/settings/ssl', token)).result;
    const https = (await pedir('/zones/' + zonaId + '/settings/always_use_https', token)).result;
    if (!['off', 'flexible', 'full', 'strict', 'origin_pull'].includes(ssl?.value) || !['on', 'off'].includes(https?.value)) falhar(409, 'As definições HTTPS desta zona não são reconhecidas. Não serão alteradas automaticamente.');
    const mudarSSL = !['strict', 'origin_pull'].includes(ssl.value), mudarHTTPS = https.value !== 'on';
    if ((mudarSSL && ssl.editable === false) || (mudarHTTPS && https.editable === false)) falhar(409, 'A Cloudflare não permite alterar gratuitamente estas definições da zona. Não foi ativado nenhum produto pago.');
    let universal = 'desconhecido';
    try { const u = (await pedir('/zones/' + zonaId + '/ssl/universal/settings', token)).result; universal = u?.enabled === true ? 'habilitado' : u?.enabled === false ? 'desativado' : 'desconhecido'; } catch (erro) { if (!(erro instanceof ErroCloudflare)) throw erro; }
    const snapshot = resumo({ zona, origem, hostnameGestao, access, gerido: gerido ? { id: gerido.tunelId, nome: gerido.tunelNome } : null, configExistente, records, recordsAdmin, ssl: { value: ssl.value, editable: ssl.editable }, https: { value: https.value, editable: https.editable }, token: resumo(token) });
    return { zona, hostname, hostnameGestao, access, origem, gerido, configExistente, records, recordsAdmin, mudarSSL, mudarHTTPS, universal, snapshot, ssl: ssl.value, https: https.value };
  }
  async function preparar(corpo, contexto) {
    return exclusivo(async () => {
      const token = tokenAtual(), r = await recolher(corpo.zonaId, corpo.hostname, corpo.hostnameGestao, corpo.emailsPermitidos, token);
      autorizar(contexto);
      for (const [id, plano] of planos) if (plano.publico.expira <= agora()) planos.delete(id);
      if (planos.size >= 20) planos.delete(planos.keys().next().value);
      const id = crypto.randomBytes(32).toString('hex');
      const publico = { id, expira: agora() + DURACAO_PLANO, hostname: r.hostname, zonaId: r.zona.id, zonaNome: r.zona.nome, contaId: r.zona.contaId, origem: r.origem, gratuito: true, alteraConfiguracaoZona: r.mudarSSL || r.mudarHTTPS, avisoZona: r.mudarSSL || r.mudarHTTPS ? 'Estas definições afetam todos os sites desta zona. Full (strict) exige HTTPS válido nas outras origens; confirme que estão preparadas antes de aplicar.' : null, ssl: { modo: r.ssl, sempreHTTPS: r.https, universal: r.universal }, acoes: [r.gerido ? 'Usar apenas o túnel dedicado já gerido por este back-office.' : 'Criar um túnel dedicado gratuito, sem alterar os túneis existentes.', 'Publicar apenas ' + r.hostname + ' para ' + r.origem + '; os restantes nomes recebem 404.', r.records.length ? 'Conservar o CNAME existente que já aponta para este túnel.' : 'Criar um CNAME com proxy para o túnel, sem substituir registos existentes.', ...(r.mudarSSL ? ['Mudar o modo SSL da zona para Full (strict).'] : []), ...(r.mudarHTTPS ? ['Ativar Always Use HTTPS em toda a zona.'] : []), 'Usar Universal SSL gratuito, gerido automaticamente pela Cloudflare; a emissão do certificado pode demorar.', 'Manter o conector desligado até escolher Ligar.'] };
      publico.gestao = { hostname: r.hostnameGestao, emailsPermitidos: [...r.access.emails], issuer: r.access.issuer, organizacaoPronta: true, aplicacaoNova: !r.access.existente };
      publico.acoes.unshift('Proteger ' + r.hostnameGestao + ' com Cloudflare Access gratuito, código por email e lista exclusiva de operadores, antes de publicar o painel. O login próprio do back-office continua obrigatório.');
      planos.set(id, { publico, snapshot: r.snapshot, atorId: contexto?.atorId || null });
      return { gratuito: true, plano: copiar(publico) };
    });
  }
  async function aplicar(corpo, contexto) {
    return exclusivo(async () => {
      const plano = planos.get(corpo.planoId);
      if (!plano || plano.publico.expira <= agora() || plano.atorId !== (contexto?.atorId || null)) falhar(409, 'O plano expirou ou não pertence a esta sessão. Prepare-o novamente.');
      if (plano.publico.alteraConfiguracaoZona && corpo.confirmarZona !== true) falhar(409, 'Confirme separadamente o impacto das alterações HTTPS em toda a zona.');
      const token = tokenAtual(), r = await recolher(plano.publico.zonaId, plano.publico.hostname, plano.publico.gestao.hostname, plano.publico.gestao.emailsPermitidos, token);
      if (r.snapshot !== plano.snapshot) falhar(409, 'A configuração mudou desde a pré-visualização. Prepare e reveja um novo plano.');
      autorizar(contexto); planos.clear();
      if (dados.configuracao?.autoligar) guardar({ configuracao: { ...dados.configuracao, autoligar: false } });
      await conector.desligar();
      const acesso = await criarAccess(r, token, contexto);
      autorizar(contexto); guardar({ acesso, acessoPendente: null });
      // Não se publica a porta administrativa sem JWT verificado na própria origem.
      if (validarProtecaoAccess(configAccess()) !== true) falhar(409, 'A proteção JWT do back-office ainda não está pronta. O subdomínio de gestão não será publicado.');
      let gerido = r.gerido;
      if (!gerido) {
        const nome = 'dinmeta-' + crypto.randomBytes(8).toString('hex');
        const t = (await pedir('/accounts/' + r.zona.contaId + '/cfd_tunnel', token, 'POST', { name: nome, config_src: 'cloudflare' }, contexto)).result;
        if (!UUID.test(t?.id || '')) falhar(502, 'A Cloudflare não confirmou o identificador do novo túnel.');
        gerido = { zonaId: r.zona.id, zonaNome: r.zona.nome, contaId: r.zona.contaId, hostname: r.hostname, hostnameGestao: r.hostnameGestao, tunelId: t.id, tunelNome: nome, origem: r.origem, autoligar: false };
        autorizar(contexto); guardar({ pendente: gerido });
      }
      // Só atualiza o túnel dedicado criado e identificado nos ficheiros próprios.
      const caminhoTunel = '/accounts/' + gerido.contaId + '/cfd_tunnel/' + gerido.tunelId;
      const remoto = (await pedir(caminhoTunel + '/configurations', token)).result?.config;
      validarConfiguracaoGerida(remoto, gerido, dados.pendente?.tunelId === gerido.tunelId);
      const config = { ...(remoto || {}), ...configuracaoTunel(r.hostname, r.origem, r.hostnameGestao) };
      await pedir(caminhoTunel + '/configurations', token, 'PUT', { config }, contexto);
      if (r.mudarSSL) await pedir('/zones/' + r.zona.id + '/settings/ssl', token, 'PATCH', { value: 'strict' }, contexto);
      if (r.mudarHTTPS) await pedir('/zones/' + r.zona.id + '/settings/always_use_https', token, 'PATCH', { value: 'on' }, contexto);
      const atuais = await lista('/zones/' + r.zona.id + '/dns_records', token, { name: r.hostname });
      if (resumo(atuais) !== resumo(r.records)) falhar(409, 'O DNS mudou durante a aplicação. Nenhum registo existente foi substituído. Prepare novamente o plano.');
      if (!atuais.length) await pedir('/zones/' + r.zona.id + '/dns_records', token, 'POST', { type: 'CNAME', name: r.hostname, content: gerido.tunelId + '.cfargotunnel.com', proxied: true, ttl: 1 }, contexto);
      const adminAtuais = await lista('/zones/' + r.zona.id + '/dns_records', token, { name: r.hostnameGestao });
      if (resumo(adminAtuais) !== resumo(r.recordsAdmin)) falhar(409, 'O DNS da gestão mudou durante a aplicação. Nenhum registo existente foi substituído.');
      if (!adminAtuais.length) await pedir('/zones/' + r.zona.id + '/dns_records', token, 'POST', { type: 'CNAME', name: r.hostnameGestao, content: gerido.tunelId + '.cfargotunnel.com', proxied: true, ttl: 1 }, contexto);
      const tunnelToken = await obterTokenTunel(caminhoTunel, token);
      autorizar(contexto);
      guardar({ configuracao: { ...gerido, origem: r.origem, autoligar: false }, pendente: null }, { apiToken: token, tunnelToken });
      return resposta();
    });
  }
  async function obterTokenTunel(caminhoTunel, token) {
    const segredo = (await pedir(caminhoTunel + '/token', token)).result;
    if (typeof segredo !== 'string' || segredo.length < 20 || segredo.length > 16384 || /\s/.test(segredo)) falhar(502, 'A Cloudflare não devolveu uma credencial válida para o conector.');
    return segredo;
  }
  async function instalar(contexto) {
    return exclusivo(async () => {
      autorizar(contexto);
      try { await conector.instalar(); } catch { falhar(503, 'Não foi possível instalar o conector oficial Cloudflare. Tente novamente.'); }
      return resposta();
    });
  }
  async function iniciarConector(contexto, retomar = false) {
    const c = dados.configuracao;
    if (!c) falhar(400, 'Prepare e aplique primeiro a configuração do domínio.');
    if (!estadoConector().instalado) falhar(400, 'Instale primeiro o conector Cloudflare neste computador.');
    const token = tokenAtual(), origem = await origemLocal();
    const acesso = configAccess();
    if (!acesso || acesso.hostname !== c.hostnameGestao || validarProtecaoAccess(acesso) !== true) falhar(409, 'A proteção Access e JWT da gestão não está pronta. O conector permanece desligado.');
    await verificarAplicacao(c.contaId, acesso.appId, acesso.hostname, acesso.emails, acesso.issuer);
    if (origem !== c.origem) falhar(409, 'A porta do site mudou. Prepare e aplique um novo plano antes de ligar o túnel.');
    const caminho = '/accounts/' + c.contaId + '/cfd_tunnel/' + c.tunelId;
    validarConfiguracaoGerida((await pedir(caminho + '/configurations', token)).result?.config, c);
    const tunnelToken = await obterTokenTunel(caminho, token);
    autorizar(contexto);
    try { await conector.ligar(tunnelToken); } catch { falhar(503, 'Não foi possível ligar o conector Cloudflare neste computador.'); }
    if (!retomar || !c.autoligar) guardar({ configuracao: { ...c, autoligar: true } }, { apiToken: token, tunnelToken });
    return resposta();
  }
  async function ligar(contexto) { return exclusivo(() => iniciarConector(contexto)); }
  async function desligar(contexto) {
    return exclusivo(async () => {
      autorizar(contexto);
      if (dados.configuracao) guardar({ configuracao: { ...dados.configuracao, autoligar: false } });
      try { await conector.desligar(); } catch { falhar(503, 'Não foi possível parar o conector Cloudflare.'); }
      return resposta();
    });
  }
  async function retomar() {
    if (encerrado || ocupado || erroPersistencia || !dados.configuracao?.autoligar || !lerSegredos().apiToken || !lerSegredos().tunnelToken) return estado();
    if (['ligado', 'a_arrancar', 'a_religar', 'a_instalar', 'a_desligar'].includes(estadoConector().estado)) return estado();
    try { return await exclusivo(() => iniciarConector(null, true)); } catch { return estado(); }
  }
  async function encerrar() { encerrado = true; planos.clear(); try { await conector.desligar(); } catch { /* Só o processo próprio; preserva a preferência de reinício. */ } }
  return { estado, configAccess, zonas, ligarAPI, preparar, aplicar, instalar, ligar, desligar, retomar, encerrar };
}

module.exports = { criarCloudflare, ErroCloudflare };
