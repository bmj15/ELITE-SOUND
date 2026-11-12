'use strict';

// Túnel gerido apenas por este processo. Não instala serviços nem altera o Windows.
// Referências oficiais: developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/
// e configure-tunnels/run-parameters/ (#token: variável TUNNEL_TOKEN).
const fsReal = require('node:fs');
const path = require('node:path');
const httpsReal = require('node:https');
const crypto = require('node:crypto');
const { spawn: spawnReal } = require('node:child_process');

const API_RELEASE = 'https://api.github.com/repos/cloudflare/cloudflared/releases/latest';
const ASSET = 'cloudflared-windows-amd64.exe';
const MAX_BINARIO = 128 * 1024 * 1024;
const HOSTS_RELEASE = new Set(['github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com', 'github-releases.githubusercontent.com']);
const MENSAGENS = Object.freeze({
  CF_CONFIGURACAO: 'A pasta de dados do conector não é válida.',
  CF_SISTEMA: 'O conector precisa de Windows de 64 bits.',
  CF_ORIGEM: 'A origem da transferência não é permitida.',
  CF_REDE: 'Não foi possível descarregar o conector. Verifique a ligação.',
  CF_TEMPO: 'A transferência demorou demasiado. Tente novamente.',
  CF_TAMANHO: 'O ficheiro do conector excede o tamanho permitido.',
  CF_RELEASE: 'Não foi possível confirmar a versão oficial do conector.',
  CF_HASH: 'A verificação do conector falhou. Tente instalar novamente.',
  CF_GUARDAR: 'Não foi possível guardar o conector na pasta de dados.',
  CF_OCUPADO: 'Aguarde a operação atual do conector.',
  CF_INSTALAR: 'Instale o conector antes de ligar o túnel.',
  CF_TOKEN: 'Indique um token válido de Cloudflare Tunnel.',
  CF_ARRANQUE: 'Não foi possível iniciar o conector Cloudflare.',
  CF_CANCELADO: 'A ligação do conector foi cancelada.',
  CF_TERMINOU: 'O conector Cloudflare terminou. Volte a ligar.',
  CF_AUTENTICACAO: 'O token do túnel não foi aceite pela Cloudflare.',
  CF_PARAGEM: 'Não foi possível parar o conector. Tente novamente.',
});

function falha(codigo) {
  const e = new Error(MENSAGENS[codigo] || MENSAGENS.CF_REDE);
  e.code = Object.hasOwn(MENSAGENS, codigo) ? codigo : 'CF_REDE';
  return e;
}
function curar(erro, alternativa) {
  return falha(Object.hasOwn(MENSAGENS, erro && erro.code) ? erro.code : alternativa);
}
const limitar = (n, maximo) => Number.isSafeInteger(n) && n > 0 ? Math.min(n, maximo) : maximo;
const versaoValida = v => typeof v === 'string' && /^v?\d{4}\.\d{1,2}\.\d{1,4}(?:-[A-Za-z0-9.-]+)?$/.test(v);

function criarConector(opcoes = {}) {
  if (typeof opcoes.pastaDados !== 'string' || !path.isAbsolute(opcoes.pastaDados)) throw falha('CF_CONFIGURACAO');
  const pastaDados = path.resolve(opcoes.pastaDados), pastaBin = path.join(pastaDados, 'bin');
  const binario = path.join(pastaBin, 'cloudflared.exe'), manifesto = path.join(pastaBin, 'cloudflared.json');
  const fs = opcoes.fs || fsReal, https = opcoes.https || httpsReal, spawn = opcoes.spawn || spawnReal;
  const temporizar = opcoes.setTimeout || setTimeout, cancelar = opcoes.clearTimeout || clearTimeout;
  const agora = opcoes.agora || Date.now, pai = opcoes.processoPai || process;
  const plataforma = opcoes.plataforma || process.platform, arquitetura = opcoes.arquitetura || process.arch;
  const ambienteBase = opcoes.ambiente || process.env;
  const limiteBinario = limitar(opcoes.limiteBinario, MAX_BINARIO);
  const tempoMetadata = limitar(opcoes.tempoMetadataMs, 20000), tempoBinario = limitar(opcoes.tempoTransferenciaMs, 120000);
  const tempoArranque = limitar(opcoes.tempoArranqueMs, 5000), tempoParagem = limitar(opcoes.tempoParagemMs, 5000);
  let instalado = false, versao = null, erroPublico = null, situacao = 'nao_instalado';
  let processo = null, instalacao = null, inicio = null, paragem = null, aParar = false;
  const conexoes = new Set();

  function ficheiroRegular(f) { try { const s = fs.lstatSync(f); return s.isFile() && !s.isSymbolicLink(); } catch { return false; } }
  function pastaConfinada() {
    try { const r = path.relative(fs.realpathSync(pastaDados), fs.realpathSync(pastaBin)); return r !== '..' && !r.startsWith('..' + path.sep) && !path.isAbsolute(r); }
    catch { return false; }
  }
  function confirmarInstalado() {
    try {
      if (!pastaConfinada()) return false;
      if (!ficheiroRegular(binario) || !ficheiroRegular(manifesto) || fs.lstatSync(manifesto).size > 4096) return false;
      const m = JSON.parse(fs.readFileSync(manifesto, 'utf8'));
      if (!versaoValida(m.versao) || !/^[a-f0-9]{64}$/.test(m.sha256 || '') || !Number.isSafeInteger(m.bytes) || m.bytes < 2 || m.bytes > limiteBinario) return false;
      if (fs.lstatSync(binario).size !== m.bytes) return false;
      const dados = fs.readFileSync(binario);
      if (dados[0] !== 0x4d || dados[1] !== 0x5a || crypto.createHash('sha256').update(dados).digest('hex') !== m.sha256) return false;
      versao = m.versao; return true;
    } catch { return false; }
  }
  instalado = confirmarInstalado();
  if (instalado) situacao = 'desligado';

  function estado() {
    if (instalado && !ficheiroRegular(binario)) { instalado = false; versao = null; if (!processo && !instalacao) situacao = 'nao_instalado'; }
    return { instalado, ligado: !!processo && !aParar && conexoes.size > 0, estado: situacao, versao, pid: processo && Number.isSafeInteger(processo.pid) ? processo.pid : null, erro: erroPublico };
  }
  function urlPermitida(endereco, metadata) {
    let u; try { u = new URL(endereco); } catch { throw falha('CF_ORIGEM'); }
    if (u.protocol !== 'https:' || u.username || u.password || u.hash || (u.port && u.port !== '443')) throw falha('CF_ORIGEM');
    if (metadata) {
      if (u.hostname !== 'api.github.com' || u.pathname !== '/repos/cloudflare/cloudflared/releases/latest' || u.search) throw falha('CF_ORIGEM');
    } else {
      if (!HOSTS_RELEASE.has(u.hostname)) throw falha('CF_ORIGEM');
      if (u.hostname === 'github.com' && !u.pathname.startsWith('/cloudflare/cloudflared/releases/download/')) throw falha('CF_ORIGEM');
    }
    return u;
  }
  function obter(endereco, { metadata, limite, prazo }, saltos = 0) {
    return new Promise((resolve, reject) => {
      let u; try { u = urlPermitida(endereco, metadata); } catch (e) { reject(e); return; }
      const restante = prazo - agora();
      if (restante <= 0) { reject(falha('CF_TEMPO')); return; }
      let pedido, resposta, timer, terminou = false, partes = [], bytes = 0;
      function concluir(erro, valor) {
        if (terminou) return; terminou = true; cancelar(timer);
        if (erro) { partes = []; reject(curar(erro, 'CF_REDE')); }
        else resolve(valor);
      }
      function abortar(codigo) {
        const e = falha(codigo); concluir(e);
        try { if (resposta) resposta.destroy(); } catch { }
        try { if (pedido) pedido.destroy(); } catch { }
      }
      timer = temporizar(() => abortar('CF_TEMPO'), restante);
      try {
        pedido = https.get(u, { rejectUnauthorized: true, agent: false, headers: { 'User-Agent': 'dinmeta-backoffice', Accept: metadata ? 'application/vnd.github+json' : 'application/octet-stream', 'Accept-Encoding': 'identity', ...(metadata ? { 'X-GitHub-Api-Version': '2022-11-28' } : {}) } }, res => {
          resposta = res;
          res.once('error', e => concluir(e));
          res.once('aborted', () => concluir(falha('CF_REDE')));
          if (terminou) { res.resume(); return; }
          if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
            if (saltos >= 5 || !res.headers.location) { abortar('CF_ORIGEM'); return; }
            let proxima; try { proxima = new URL(res.headers.location, u).href; urlPermitida(proxima, metadata); } catch { abortar('CF_ORIGEM'); return; }
            res.resume(); concluir(null, obter(proxima, { metadata, limite, prazo }, saltos + 1)); return;
          }
          if (res.statusCode !== 200) { abortar('CF_REDE'); return; }
          if (res.headers['content-length'] !== undefined) {
            const tamanho = Number(res.headers['content-length']);
            if (!Number.isSafeInteger(tamanho) || tamanho < 0 || tamanho > limite) { abortar('CF_TAMANHO'); return; }
          }
          res.on('data', parte => {
            if (terminou) return;
            const b = Buffer.isBuffer(parte) ? parte : Buffer.from(parte);
            bytes += b.length;
            if (bytes > limite) { abortar('CF_TAMANHO'); return; }
            partes.push(b);
          });
          res.once('end', () => { if (!terminou) concluir(null, Buffer.concat(partes, bytes)); });
          res.once('close', () => { if (!terminou && !res.complete && !res.readableEnded) concluir(falha('CF_REDE')); });
        });
        pedido.once('error', e => concluir(e));
      } catch (e) { concluir(e); }
    });
  }

  async function confirmarPasta() {
    await fs.promises.mkdir(pastaBin, { recursive: true, mode: 0o700 });
    const relativa = path.relative(fs.realpathSync(pastaDados), fs.realpathSync(pastaBin));
    if (relativa === '..' || relativa.startsWith('..' + path.sep) || path.isAbsolute(relativa)) throw falha('CF_GUARDAR');
    for (const f of [binario, manifesto]) {
      try { if (!fs.lstatSync(f).isFile() || fs.lstatSync(f).isSymbolicLink()) throw falha('CF_GUARDAR'); }
      catch (e) { if (e.code !== 'ENOENT') throw e; }
    }
  }
  async function instalar() {
    if (instalacao) return instalacao;
    if (processo || inicio || paragem) throw falha('CF_OCUPADO');
    instalado = confirmarInstalado();
    if (instalado) return estado();
    versao = null;
    const executar = async () => {
      situacao = 'a_instalar'; erroPublico = null;
      let temporario, metaTemporaria;
      try {
        if (plataforma !== 'win32' || arquitetura !== 'x64') throw falha('CF_SISTEMA');
        const dadosRelease = await obter(API_RELEASE, { metadata: true, limite: 2 * 1024 * 1024, prazo: agora() + tempoMetadata });
        let release; try { release = JSON.parse(dadosRelease.toString('utf8')); } catch { throw falha('CF_RELEASE'); }
        const asset = Array.isArray(release.assets) && release.assets.find(x => x && x.name === ASSET);
        if (!versaoValida(release.tag_name) || release.draft || release.prerelease || !asset || !/^sha256:[a-f0-9]{64}$/i.test(asset.digest || '')) throw falha('CF_RELEASE');
        if (!Number.isSafeInteger(asset.size) || asset.size < 2 || asset.size > limiteBinario) throw falha('CF_TAMANHO');
        const urlEsperado = `https://github.com/cloudflare/cloudflared/releases/download/${release.tag_name}/${ASSET}`;
        if (asset.browser_download_url !== urlEsperado) throw falha('CF_ORIGEM');
        const dados = await obter(urlEsperado, { metadata: false, limite: limiteBinario, prazo: agora() + tempoBinario });
        const hash = crypto.createHash('sha256').update(dados).digest('hex');
        if (dados.length !== asset.size || dados[0] !== 0x4d || dados[1] !== 0x5a || hash !== asset.digest.slice(7).toLowerCase()) throw falha('CF_HASH');
        await confirmarPasta();
        temporario = path.join(pastaBin, `.cloudflared-${crypto.randomBytes(12).toString('hex')}.part`);
        metaTemporaria = temporario + '.json';
        await fs.promises.writeFile(temporario, dados, { flag: 'wx', mode: 0o600 });
        await fs.promises.writeFile(metaTemporaria, JSON.stringify({ versao: release.tag_name, sha256: hash, bytes: dados.length }), { flag: 'wx', mode: 0o600 });
        await fs.promises.rename(temporario, binario);
        await fs.promises.rename(metaTemporaria, manifesto);
        instalado = true; versao = release.tag_name; situacao = 'desligado'; erroPublico = null;
        return estado();
      } catch (e) {
        const seguro = curar(e, 'CF_GUARDAR'); instalado = confirmarInstalado(); if (!instalado) versao = null;
        situacao = 'erro'; erroPublico = seguro.message; throw seguro;
      } finally {
        for (const f of [temporario, metaTemporaria]) if (f) { try { await fs.promises.unlink(f); } catch { } }
      }
    };
    const tarefa = executar(); instalacao = tarefa;
    try { return await tarefa; } finally { if (instalacao === tarefa) instalacao = null; }
  }

  // Reconhece apenas frases de estado: guarda contadores/índices, nunca linhas nem tokens.
  function leitorDeEstado(filho) {
    const frases = ['registered tunnel connection', 'unregistered tunnel connection', 'retrying connection', 'token is not valid', 'invalid tunnel token', 'authentication failed', 'connindex='];
    const progresso = frases.map(() => 0);
    let anteriorLetra = false, evento = null, indice = null, aLerIndice = false, algarismos = '';
    function aplicar() {
      if (processo !== filho || aParar) return;
      if (evento === 'registada') { conexoes.delete('geral'); conexoes.add(indice === null ? 'geral' : indice); situacao = 'ligado'; erroPublico = null; }
      else if (evento === 'retirada') {
        if (indice === null) conexoes.clear(); else { conexoes.delete(indice); conexoes.delete('geral'); }
        if (!conexoes.size) { situacao = 'a_religar'; erroPublico = null; }
      }
    }
    return parte => {
      if (processo !== filho || aParar) return;
      for (const c of String(parte).toLowerCase()) {
        if (aLerIndice) {
          if (/\d/.test(c) && algarismos.length < 3) algarismos += c;
          else { indice = algarismos && Number(algarismos) <= 255 ? Number(algarismos) : null; aLerIndice = false; algarismos = ''; }
        }
        for (let k = 0; k < frases.length; k++) {
          const frase = frases[k], p = progresso[k];
          if (c === frase[p] && (p || !anteriorLetra)) progresso[k]++;
          else progresso[k] = c === frase[0] && !anteriorLetra ? 1 : 0;
          if (progresso[k] === frase.length) {
            progresso[k] = 0;
            if (k === 0) { evento = 'registada'; conexoes.add('geral'); situacao = 'ligado'; erroPublico = null; }
            else if (k === 1) evento = 'retirada';
            else if (k === 2 && !conexoes.size) { situacao = 'a_religar'; erroPublico = null; }
            else if (k >= 3 && k <= 5) { conexoes.clear(); situacao = 'erro'; erroPublico = MENSAGENS.CF_AUTENTICACAO; }
            else if (k === 6) { aLerIndice = true; algarismos = ''; }
          }
        }
        if (c === '\n' || c === '\r') { aplicar(); evento = null; indice = null; aLerIndice = false; algarismos = ''; progresso.fill(0); }
        anteriorLetra = /[a-z]/.test(c);
      }
    };
  }
  function ambienteFilho(segredo) {
    const permitidos = new Set(['SYSTEMROOT', 'WINDIR', 'PATH', 'PATHEXT', 'TEMP', 'TMP', 'NUMBER_OF_PROCESSORS', 'PROCESSOR_ARCHITECTURE']);
    const env = {};
    for (const [k, v] of Object.entries(ambienteBase)) if (permitidos.has(k.toUpperCase()) && typeof v === 'string') env[k] = v;
    return { ...env, HOME: pastaDados, USERPROFILE: pastaDados, NO_AUTOUPDATE: 'true', TUNNEL_LOGLEVEL: 'info', TUNNEL_TOKEN: segredo };
  }
  async function ligar(token) {
    if (paragem || instalacao) throw falha('CF_OCUPADO');
    if (inicio) return inicio;
    if (processo) { if (aParar || situacao === 'erro') throw falha('CF_OCUPADO'); return estado(); }
    if (plataforma !== 'win32' || arquitetura !== 'x64') throw falha('CF_SISTEMA');
    instalado = confirmarInstalado(); if (!instalado) { versao = null; situacao = 'nao_instalado'; throw falha('CF_INSTALAR'); }
    if (typeof token !== 'string' || !/^[A-Za-z0-9+/_=.\-]{16,16384}$/.test(token.trim())) throw falha('CF_TOKEN');
    const env = ambienteFilho(token.trim()); token = '';
    let filho;
    try { filho = spawn(binario, ['tunnel', '--no-autoupdate', 'run'], { windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'], cwd: pastaBin, env }); }
    catch { situacao = 'erro'; erroPublico = MENSAGENS.CF_ARRANQUE; throw falha('CF_ARRANQUE'); }
    finally { delete env.TUNNEL_TOKEN; }
    processo = filho; aParar = false; conexoes.clear(); situacao = 'a_arrancar'; erroPublico = null;
    const lerOut = leitorDeEstado(filho), lerErr = leitorDeEstado(filho);
    filho.stdout?.on('data', lerOut); filho.stderr?.on('data', lerErr);
    const aoSair = () => { if (processo === filho) { try { filho.kill('SIGTERM'); } catch { } } };
    pai.once('exit', aoSair);
    let confirmar, recusar, fechado = false, timer;
    const tarefa = new Promise((resolve, reject) => { confirmar = resolve; recusar = reject; });
    filho.once('spawn', () => { cancelar(timer); confirmar(estado()); });
    filho.on('error', () => {
      if (processo !== filho) return;
      cancelar(timer); conexoes.clear(); situacao = 'erro'; erroPublico = MENSAGENS.CF_ARRANQUE; recusar(falha('CF_ARRANQUE'));
    });
    filho.once('close', () => {
      fechado = true; cancelar(timer); pai.removeListener('exit', aoSair);
      filho.stdout?.removeListener('data', lerOut); filho.stderr?.removeListener('data', lerErr);
      if (processo !== filho) return;
      const solicitado = aParar; processo = null; conexoes.clear(); aParar = false;
      if (solicitado) { situacao = instalado ? 'desligado' : 'nao_instalado'; erroPublico = null; recusar(falha('CF_CANCELADO')); }
      else { situacao = 'erro'; erroPublico ||= MENSAGENS.CF_TERMINOU; recusar(falha('CF_TERMINOU')); }
    });
    timer = temporizar(() => {
      if (fechado || processo !== filho) return;
      situacao = 'erro'; erroPublico = MENSAGENS.CF_ARRANQUE; recusar(falha('CF_ARRANQUE'));
      try { filho.kill('SIGTERM'); } catch { }
    }, tempoArranque);
    inicio = tarefa;
    try { return await tarefa; } finally { if (inicio === tarefa) inicio = null; }
  }
  async function desligar() {
    if (paragem) return paragem;
    if (!processo) { if (!instalacao) { situacao = instalado ? 'desligado' : 'nao_instalado'; erroPublico = null; } return estado(); }
    const filho = processo; aParar = true; situacao = 'a_desligar'; erroPublico = null;
    let primeiro, segundo;
    const tarefa = new Promise((resolve, reject) => {
      let acabou = false;
      function concluir(erro) {
        if (acabou) return; acabou = true; cancelar(primeiro); cancelar(segundo); filho.removeListener('close', fechar);
        if (erro) { situacao = 'erro'; erroPublico = MENSAGENS.CF_PARAGEM; reject(falha('CF_PARAGEM')); }
        else resolve(estado());
      }
      const fechar = () => concluir(); filho.once('close', fechar);
      primeiro = temporizar(() => {
        if (processo !== filho) { concluir(); return; }
        try { filho.kill('SIGKILL'); } catch { }
        if (!acabou) segundo = temporizar(() => concluir(falha('CF_PARAGEM')), 2000);
      }, tempoParagem);
      try { filho.kill('SIGTERM'); } catch { concluir(falha('CF_PARAGEM')); }
    });
    paragem = tarefa;
    try { return await tarefa; } finally { if (paragem === tarefa) paragem = null; }
  }
  return { estado, instalar, ligar, desligar };
}

module.exports = { criarConector };
