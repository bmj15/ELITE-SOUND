/* =========================================================
   DADOS NO SERVIDOR LOCAL
   Carrega-se antes de todos os outros scripts. Quando o sistema é
   aberto através do servidor do Grupo BXB, as chaves "spap:..."
   deixam de ficar no navegador e passam a ser lidas e gravadas no
   servidor (com a conta de cada pessoa e só os sistemas a que tem
   acesso). Aberto como ficheiro (file://), tudo fica como antes.
   ========================================================= */
(function () {
'use strict';
if (location.protocol === 'file:') return;
const LOCAIS = new Set(['spap:theme']); // preferências deste navegador: não vão para o servidor
const ENTRAR = '/SISTEMAS/entrar.html';
function pedido(metodo, url, corpo) {
  const x = new XMLHttpRequest(); x.open(metodo, url, false); x.setRequestHeader('X-BXB', '1');
  if (corpo !== undefined) x.setRequestHeader('Content-Type', 'application/json');
  try { x.send(corpo === undefined ? null : JSON.stringify(corpo)); } catch (e) { return { status: 0 }; }
  let json = null; try { json = JSON.parse(x.responseText); } catch (e) { } return { status: x.status, json };
}
const est = pedido('GET', '/api/estado');
if (!est.json || est.status !== 200) return; // servidor antigo, sem contas: os dados continuam no navegador
if (location.pathname === ENTRAR || location.pathname === '/SISTEMAS/acessos.html' || location.pathname === '/SISTEMAS/conta.html') { window.BXBServidor = { sessao: est.json.sessao, configurado: est.json.configurado }; return; }

const real = { get: Storage.prototype.getItem, set: Storage.prototype.setItem, rem: Storage.prototype.removeItem };
const nossa = (st, k) => st === window.localStorage && typeof k === 'string' && k.startsWith('spap:') && !LOCAIS.has(k);
const sessao = est.json.sessao;
if (!sessao) {
  // sem sessão: nada é lido nem gravado e vai para a página de entrada
  Storage.prototype.getItem = function (k) { return nossa(this, k) ? null : real.get.call(this, k); };
  Storage.prototype.setItem = function (k, v) { if (!nossa(this, k)) real.set.call(this, k, v); };
  Storage.prototype.removeItem = function (k) { if (!nossa(this, k)) real.rem.call(this, k); };
  location.replace(ENTRAR + '?voltar=' + encodeURIComponent(location.pathname + location.search + location.hash));
  return;
}
// como num banco: cada conta só tem acesso às suas áreas (e às partilhas em que essas áreas estão); o servidor confirma sempre
const podeVer = key => (sessao.sistemas || []).includes(key);
const sistemaDaChave = k => { const m = /^spap:([^:]+)/.exec(k); return m ? m[1] : null; };
const podeGravar = k => sistemaDaChave(k) === 'partilha' || podeVer(sistemaDaChave(k));

let dados = pedido('GET', '/api/dados');
if (dados.status !== 200) { alert('Não foi possível ler os dados do servidor. Tente de novo.'); return; }
dados = dados.json || {};
const mem = new Map(), versao = new Map(); // valor atual e versão confirmada pelo servidor
Object.entries(dados).forEach(([k, r]) => { mem.set(k, r.valor); versao.set(k, r.versao); });

/* ---------- gravação em segundo plano, por chave, com controlo de concorrência ---------- */
const pendentes = new Set(); let aEnviar = false, conflito = false, semLigacao = false;
function aviso(html, tipo = 'warn', botao) {
  let b = document.getElementById('bxb-aviso-servidor');
  if (!b) { b = document.createElement('div'); b.id = 'bxb-aviso-servidor'; b.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:14px;z-index:9999;max-width:min(680px,94vw);padding:10px 14px;border-radius:12px;font:500 13px/1.4 Inter,system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.35);display:flex;gap:12px;align-items:center'; document.body && document.body.appendChild(b); }
  if (!html) { b.remove(); return; }
  b.style.background = tipo === 'bad' ? '#7f1d1d' : tipo === 'ok' ? '#14532d' : '#78350f'; b.style.color = '#fff';
  b.innerHTML = `<span>${html}</span>${botao ? `<button style="border:0;border-radius:8px;padding:6px 10px;font-weight:700;cursor:pointer">${botao.texto}</button>` : ''}`;
  if (botao) b.querySelector('button').onclick = botao.acao;
}
async function enviar() {
  if (aEnviar || conflito) return; aEnviar = true;
  try {
    while (pendentes.size && !conflito) {
      const k = pendentes.values().next().value; pendentes.delete(k);
      const valor = mem.has(k) ? mem.get(k) : null;
      let r;
      try { r = await fetch('/api/dados/' + encodeURIComponent(k), { method: valor == null ? 'DELETE' : 'PUT', headers: { 'Content-Type': 'application/json', 'X-BXB': '1' }, body: JSON.stringify({ valor, versao: versao.get(k) || 0 }) }); }
      catch (e) { pendentes.add(k); semLigacao = true; aviso('Sem ligação ao servidor: as últimas alterações ainda não foram gravadas. A tentar de novo…', 'bad'); setTimeout(() => { aEnviar = false; enviar(); }, 5000); return; }
      if (r.status === 200) { versao.set(k, (await r.json()).versao); if (semLigacao) { semLigacao = false; aviso('Ligação ao servidor restabelecida. Alterações gravadas.', 'ok'); setTimeout(() => aviso(null), 3000); } continue; }
      if (r.status === 409) { conflito = true; aviso('Outra pessoa alterou estes dados ao mesmo tempo. A sua última alteração não foi gravada: a página vai ser recarregada com os dados mais recentes, para a repetir.', 'bad', { texto: 'Recarregar', acao: () => location.reload() }); return; }
      if (r.status === 401) { aviso('A sessão no servidor terminou. Entre de novo para continuar (a última alteração não foi gravada).', 'bad', { texto: 'Entrar', acao: () => location.replace(ENTRAR + '?voltar=' + encodeURIComponent(location.pathname + location.search + location.hash)) }); return; }
      if (r.status === 403) { mem.delete(k); continue; } // sem acesso a esse sistema: ignora
      pendentes.add(k); aviso('O servidor recusou gravar os dados (' + r.status + '). Veja a janela do servidor.', 'bad'); return;
    }
  } finally { aEnviar = false; }
}
Storage.prototype.getItem = function (k) { if (nossa(this, k)) return mem.has(k) ? mem.get(k) : null; return real.get.call(this, k); };
Storage.prototype.setItem = function (k, v) {
  if (!nossa(this, k)) return real.set.call(this, k, v);
  v = String(v); if (mem.get(k) === v) return; mem.set(k, v);
  if (podeGravar(k)) { pendentes.add(k); enviar(); }
};
Storage.prototype.removeItem = function (k) {
  if (!nossa(this, k)) return real.rem.call(this, k);
  if (!mem.has(k)) return; mem.delete(k); if (podeGravar(k)) { pendentes.add(k); enviar(); }
};
window.addEventListener('beforeunload', e => { if (pendentes.size || aEnviar) { e.preventDefault(); e.returnValue = 'Ainda há alterações a gravar no servidor.'; } });

/* ---------- alterações de outras pessoas: avisa para atualizar ---------- */
async function verificar() {
  if (conflito || document.hidden) return;
  try {
    const r = await fetch('/api/versoes', { headers: { 'X-BXB': '1' } }); if (r.status === 401) return; const v = await r.json();
    const novas = Object.entries(v).filter(([k, n]) => !pendentes.has(k) && n > (versao.get(k) || 0));
    if (novas.length) aviso('Há dados novos de outra pessoa.', 'warn', { texto: 'Atualizar', acao: () => location.reload() });
  } catch (e) { }
}
setInterval(verificar, 20000); document.addEventListener('visibilitychange', verificar);

/* ---------- sistema sem acesso para esta conta ---------- */
const params = new URLSearchParams(location.search), pagina = location.pathname;
const sistemaPagina = /\/bxb-investimentos\//.test(pagina) ? 'bxb' : /\/subsidiaria\//.test(pagina) ? (params.get('s') || (sessao.sistemas || [])[0] || '-') : /\/elite-sound\//.test(pagina) ? 'elite' : null;
const semAcesso = sistemaPagina && !podeVer(sistemaPagina);

/* ---------- página de um sistema sem acesso para esta conta ---------- */
document.addEventListener('DOMContentLoaded', () => {
  if (semAcesso) {
    document.body.innerHTML = `<div style="min-height:100vh;display:grid;place-items:center;padding:24px;text-align:center;font-family:Inter,system-ui,sans-serif;background:#07090d;color:#e9edf5"><div><h1 style="margin:0 0 8px">Sem acesso</h1><p style="opacity:.75">Esta área não pertence à conta <b>${(sessao.email || sessao.nome).replace(/</g, '&lt;')}</b>.</p><a href="/SISTEMAS/index.html" style="color:#c3a6ff">Ir para a minha área</a></div></div>`;
    return;
  }
});
// chaves disponíveis para esta conta (ex.: para encontrar as partilhas em que é membro)
const chaves = () => [...mem.keys()];
window.BXBServidor = { sessao, podeVer, semAcesso, chaves };
if (semAcesso) { Storage.prototype.setItem = function (k, v) { if (!nossa(this, k)) real.set.call(this, k, v); }; Storage.prototype.removeItem = function (k) { if (!nossa(this, k)) real.rem.call(this, k); }; }
})();
