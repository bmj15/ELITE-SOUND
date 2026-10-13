/* =========================================================
   BXB INVESTIMENTOS — Entidades, crédito / plano de pagamentos
   (PIA), aplicações e participadas. Pagamentos via SPAP.
   ========================================================= */
(function () {
'use strict';
const { eur, pct, date, esc, uid, today, r2, MES3, MESES, icon, ui, chart, addMonths, ym } = SPAP;
let app;
const M = () => app.db.mod;
const sum = (list, f) => r2(list.reduce((s, x) => s + (typeof f === 'function' ? f(x) : +x[f] || 0), 0));
const CATS = ['EMPRESA', 'PARTICULAR', 'FUNDO', 'CRÉDITO', 'FORNECEDOR', 'OUTRA'];
const TIPOS_MENS = ['TAXA FIXA', 'MENSALIDADE FIXA', 'MENSALIDADE VARIÁVEL', 'TAXA MENSAL + MENSALIDADE VARIÁVEL'];
const DESATIVAR_TXT = 'Sim, pretendo desativar a entidade acima mencionada de forma permanente.';

/* ---------- Dados iniciais: a holding e a sua primeira subsidiária (Elite Sound) ---------- */
function seed(db, a) {
  app = a;
  Object.assign(db.settings, { duplaAcima: 2500, reqStep: 100, autStep: 6, prefixoAut: '7104984' });
  Object.assign(db.meta, { seqReq: 5549, seqAut: 26 });
  db.categorias = ['PAGAMENTO DE ENCARGOS E TAXAS', 'LIQUIDAÇÃO DE CRÉDITO', 'MENSALIDADE / PRESTAÇÃO', 'APLICAÇÃO / INVESTIMENTO', 'RESGATE DE APLICAÇÃO',
    'CONCESSÃO DE CRÉDITO', 'AQUISIÇÃO DE BENS E SERVIÇOS', 'TRANSFERÊNCIA INTERNA', 'REEMBOLSO DE DESPESAS', 'ENTRADA DE FUNDOS', 'OUTROS'];
  db.users.push(
    { id: 'u_bruno', nome: 'Bruno Alexandre Elias Monteiro', username: 'bruno', role: 'ADMIN', limite: 0, ativo: true, pinHash: null },
    { id: 'u_beatriz', nome: 'Beatriz Elias Monteiro', username: 'beatriz', role: 'APROVADOR', limite: 50000, ativo: true, pinHash: null });
  const E = (id, sigla, nome, categoria, tipo, extra = {}) => db.contas.push({ id, codigo: id, sigla, nome, categoria, tipo, saldoInicial: 0, ativo: true, criadoEm: '2024-08-10T23:38:55Z', ...extra });
  E('004_BXB_INVESTIMENTOS', 'B_I', 'BXB Investimentos', 'EMPRESA', 'INTERNA', { nif: '518300323' });
  E('0021_BXB_SOUND', 'B_S', 'BXB Sound / Elite Sound', 'EMPRESA', 'INTERNA', { subsidiaria: 'elite' });
  db.meta.limpeza1 = new Date().toISOString();
  db.mod = { contratos: [], aplicacoes: [], subsidiarias: [Object.assign({}, Grupo.ELITE)] };
}

/* =========================================================
   GRUPO E SUBSIDIÁRIAS
   A BXB é a holding: cria subsidiárias, cada uma com o seu
   próprio sistema (livro, utilizadores, autorizações e auditoria).
   Criar ou alterar uma subsidiária segue a regra das duas pessoas.
   ========================================================= */
const LEGADO_ENTIDADES = ['005_BRUNO_MONTEIRO', '006_BEATRIZ_MONTEIRO', '007_B_A_SANTANDER_BK', '0010_B_A_SANTANDER_GOLD', '0011_B_A_SANTANDER_CP7849745', '0016_B_A_RESOLUÇÃO_FCA_2024',
  '0017_FUNDO_DE_DÍVIDAS_E_GARANTIAS', '0019_B_I_RESOLUÇÃO_FCA_2024', '0020_FUNDO_DE_INVESTIMENTOS_E_APLICAÇÕES', '0022_B_I_FUNDO_DE_DIVIDAS_E_GARANTIAS'];
const LEGADO_PEDIDOS = ['5249/225', '5349/225', '5449/225', '5549/225'];
// executado em cada arranque; cada passo só corre uma vez
function migrarBXB(db) {
  let mudou = false;
  db.mod = db.mod || {};
  if (!Array.isArray(db.mod.subsidiarias)) { db.mod.subsidiarias = [Object.assign({}, Grupo.ELITE)]; mudou = true; }
  if (!db.meta.limpeza1) {
    // retira os dados migrados das folhas de cálculo, mantendo a BXB e a Elite Sound (e tudo o que o utilizador criou)
    const legados = db.pedidos.filter(p => LEGADO_PEDIDOS.includes(p.numero) && p.criadoPor === 'u_bruno' && /^2025-02-16/.test(p.criadoEm || ''));
    const ids = new Set(legados.map(p => p.id));
    db.pedidos = db.pedidos.filter(p => !ids.has(p.id));
    db.movimentos = db.movimentos.filter(m => !ids.has(m.pedido));
    const antesApl = (db.mod.aplicacoes || []).length;
    db.mod.aplicacoes = (db.mod.aplicacoes || []).filter(a => !a.migrada);
    const usada = id => db.movimentos.some(m => m.conta === id) || db.pedidos.some(p => [p.contaOrigem, p.contaDestino, p.requerente].includes(id))
      || (db.mod.contratos || []).some(c => c.credor === id || c.devedor === id) || (db.mod.aplicacoes || []).some(a => a.investidor === id || a.fundo === id);
    const removidas = db.contas.filter(c => LEGADO_ENTIDADES.includes(c.id) && !usada(c.id)).map(c => c.id);
    db.contas = db.contas.filter(c => !removidas.includes(c.id));
    db.meta.limpeza1 = new Date().toISOString(); mudou = true;
    app.log('LIMPEZA_DADOS_INICIAIS', `Removidos ${legados.length} requerimentos migrados, ${removidas.length} entidades e ${antesApl - db.mod.aplicacoes.length} aplicação(ões) migradas. Mantidas: BXB Investimentos e Elite Sound.`);
  }
  return mudou;
}
const sincronizarGrupo = () => Grupo.guardar(M().subsidiarias || []);
const slug = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 18) || 'empresa';

function registarSubsidiarias(a) {
  a.registarAlteracao('SUBSIDIARIA_CRIAR', { titulo: 'Nova subsidiária',
    aplicar: p => {
      const s = Object.assign({}, p.sub);
      if ((a.db.mod.subsidiarias || []).some(x => x.key === s.key)) return;
      const id = nextEntId(s.nome);
      a.db.contas.push({ id, codigo: id, sigla: s.sigla, nome: s.nome, categoria: 'EMPRESA', tipo: 'INTERNA', nif: s.nif || '', saldoInicial: 0, ativo: true, subsidiaria: s.key, criadoEm: new Date().toISOString() });
      s.contaNaHolding = id;
      a.db.mod.subsidiarias.push(s); sincronizarGrupo();
    } });
  a.registarAlteracao('SUBSIDIARIA_EDITAR', { titulo: 'Alteração de subsidiária',
    snapshot: p => JSON.stringify((a.db.mod.subsidiarias || []).find(s => s.key === p.key) || null),
    aplicar: p => { const s = (a.db.mod.subsidiarias || []).find(x => x.key === p.key); if (!s) return; Object.assign(s, p.campos);
      const c = a.conta(s.contaNaHolding); if (c) { c.nome = s.nome; c.nif = s.nif || c.nif; if (p.campos.ativa === false) c.ativo = false; if (p.campos.ativa === true) c.ativo = true; }
      sincronizarGrupo(); } });
}

function formSubsidiaria(s0) {
  const novo = !s0, s = s0 || { modelo: 'servicos', participacao: 1, cor1: '#22c55e', cor2: '#22d3ee', ativa: true };
  const md = ui.modal({ title: novo ? 'Nova subsidiária' : 'Editar ' + s.nome, sub: novo ? 'A subsidiária recebe um sistema próprio: livro de contas, utilizadores, autorizações e auditoria independentes, ligados à holding.' : 'As alterações seguem a regra das duas pessoas.', wide: true,
    body: `<form class="form">
      <div class="fld"><label>Nome da empresa</label><input class="inp" name="nome" value="${esc(s.nome || '')}" placeholder="ex.: BXB Eventos"></div>
      <div class="fld"><label>Sigla (até 4 letras)</label><input class="inp mono" name="sigla" maxlength="4" value="${esc(s.sigla || '')}" placeholder="ex.: EV"></div>
      <div class="fld"><label>NIF</label><input class="inp mono" name="nif" value="${esc(s.nif || '')}"></div>
      <div class="fld"><label>Setor / descrição curta</label><input class="inp" name="setor" value="${esc(s.setor || '')}" placeholder="ex.: Organização de eventos"></div>
      ${novo ? `<div class="fld full"><label>Modelo de sistema</label><div class="stack" style="gap:8px">${Object.entries(Grupo.MODELOS).map(([k, m]) => `<label class="check" style="align-items:flex-start;padding:10px 12px;border:1px solid var(--line2);border-radius:10px"><input type="radio" name="modelo" value="${k}" ${s.modelo === k ? 'checked' : ''} style="margin-top:3px"><span><b>${esc(m.nome)}</b><br><span class="muted" style="font-size:13px">${esc(m.desc)}</span></span></label>`).join('')}</div></div>` : ''}
      <div class="fld"><label>Participação da BXB (%)</label><input class="inp num" type="number" min="0" max="100" step="0.01" name="participacao" value="${r2((+s.participacao || 0) * 100)}"><span class="hint">${novo ? 'Define a quota da BXB nos resultados da subsidiária.' : 'Alterar aqui não muda as quotas já definidas no sistema da subsidiária.'}</span></div>
      <div class="fld"><label>Cores da marca</label><div class="row"><input type="color" name="cor1" value="${esc(s.cor1)}" style="width:52px;height:38px;border:0;background:none"><input type="color" name="cor2" value="${esc(s.cor2)}" style="width:52px;height:38px;border:0;background:none"><div id="prev" style="flex:1;height:38px;border-radius:10px"></div></div></div>
      ${novo ? '' : `<div class="fld"><label>&nbsp;</label><label class="check"><input type="checkbox" name="ativa" ${s.ativa !== false ? 'checked' : ''}> Sistema ativo</label></div>`}</form>`,
    actions: [{ label: 'Cancelar', kind: 'ghost' }, { label: icon('pen') + (novo ? 'Assinar e criar' : 'Assinar alteração'), kind: 'primary', onClick: async el => {
      const f = ui.formData(el); const modelo = (el.querySelector('[name=modelo]:checked') || {}).value || s.modelo;
      if (!f.nome || !f.sigla) { ui.toast('Indica o nome e a sigla', 'warn'); return false; }
      if ((M().subsidiarias || []).some(x => x.nome.toLowerCase() === f.nome.toLowerCase() && x.key !== s.key)) { ui.toast('Já existe uma subsidiária com esse nome', 'bad'); return false; }
      const part = Math.min(1, Math.max(0, (+f.participacao || 0) / 100));
      if (novo) {
        const sub = { key: 'sub-' + slug(f.nome) + '-' + uid().slice(-4), nome: f.nome, sigla: f.sigla.toUpperCase(), nif: f.nif, setor: f.setor, modelo, cor1: f.cor1, cor2: f.cor2, participacao: part, ativa: true,
          criadaEm: today(), contaCaixa: 'CAIXA', contaOperacional: 'OPERACIONAL', contaHolding: 'HOLDING',
          utilizadores: app.db.users.filter(u => u.ativo !== false).map(u => ({ id: u.id, nome: u.nome, username: u.username, role: u.role, limite: u.limite })) };
        const r = await app.proporAlteracao('SUBSIDIARIA_CRIAR', { sub }, `${sub.nome} (${Grupo.MODELOS[modelo].nome})`,
          [['Empresa', '—', sub.nome], ['Modelo de sistema', '—', Grupo.MODELOS[modelo].nome], ['Participação da BXB', '—', pct(part)], ['Utilizadores copiados', '—', String(sub.utilizadores.length)]]);
        if (!r) return false;
      } else {
        const campos = { nome: f.nome, sigla: f.sigla.toUpperCase(), nif: f.nif, setor: f.setor, cor1: f.cor1, cor2: f.cor2, participacao: part, ativa: !!f.ativa };
        const nomes = { nome: 'Nome', sigla: 'Sigla', nif: 'NIF', setor: 'Setor', participacao: 'Participação', ativa: 'Estado', cor1: 'Cor 1', cor2: 'Cor 2' };
        const fm = (k, v) => k === 'participacao' ? pct(v) : k === 'ativa' ? (v !== false ? 'Ativo' : 'Desativado') : String(v || '—');
        const det = Object.keys(nomes).filter(k => fm(k, s[k]) !== fm(k, campos[k])).map(k => [nomes[k], fm(k, s[k]), fm(k, campos[k])]);
        if (!det.length) { ui.toast('Sem alterações', 'warn'); return false; }
        if (!await app.proporAlteracao('SUBSIDIARIA_EDITAR', { key: s.key, campos }, s.nome, det)) return false;
      }
      app.refresh(); } }] });
  const el = md.el, pv = () => { const f = ui.formData(el); el.querySelector('#prev').style.background = `linear-gradient(135deg,${f.cor1},${f.cor2})`; };
  el.querySelectorAll('[name=cor1],[name=cor2]').forEach(i => i.addEventListener('input', pv)); pv();
}

function subsidiarias(v) {
  const subs = M().subsidiarias || [];
  const res = subs.map(s => ({ s, r: Grupo.resumo(s) }));
  const fundos = sum(res, x => x.r ? x.r.fundos : 0), pend = sum(res, x => x.r ? x.r.pend : 0);
  v.innerHTML = `<div class="row between" style="margin-bottom:16px"><div class="muted">A BXB Investimentos é a holding do grupo. Cada subsidiária tem o seu próprio sistema, ligado à holding pelo intercompany.</div>
    ${app.can('admin') ? `<button class="btn primary" id="nova">${icon('plus')} Nova subsidiária</button>` : ''}</div>
    <div class="grid g4" style="margin-bottom:18px">
      <div class="card kpi hero"><div class="lbl">${icon('building')} Subsidiárias</div><div class="val num">${subs.filter(s => s.ativa !== false).length}</div><div class="foot">${subs.length} no total</div></div>
      <div class="card kpi"><div class="lbl">${icon('wallet')} Fundos nas subsidiárias</div><div class="val num">${eur(fundos)}</div><div class="foot">lido do livro de cada empresa</div></div>
      <div class="card kpi"><div class="lbl">${icon('shield')} Pedidos em curso</div><div class="val num">${pend}</div><div class="foot">em todas as subsidiárias</div></div>
      <div class="card kpi"><div class="lbl">${icon('swap')} Contas na holding</div><div class="val num">${eur(sum(subs, s => app.saldo(s.contaNaHolding)))}</div><div class="foot">investido pela BXB</div></div></div>
    <div class="grid g3">${res.map(({ s, r }) => `<div class="card flush" style="${s.ativa === false ? 'opacity:.6' : ''}">
      <div style="height:84px;background:linear-gradient(135deg,${esc(s.cor1)},${esc(s.cor2)});position:relative;padding:14px 16px;color:#fff;display:flex;align-items:flex-end;justify-content:space-between">
        <span style="font-family:var(--mono);font-size:26px;font-weight:700;opacity:.9">${esc(s.sigla)}</span><span class="badge plain" style="background:rgba(0,0,0,.28);color:#fff">${esc((Grupo.MODELOS[s.modelo] || {}).nome || s.modelo)}</span></div>
      <div style="padding:16px">
        <div class="row between"><div><b style="font-size:16px">${esc(s.nome)}</b><div class="muted" style="font-size:13px">${esc(s.setor || '')}</div></div>${s.ativa === false ? '<span class="badge bad">Desativada</span>' : r && r.ativo ? '<span class="badge ok">Ativa</span>' : '<span class="badge warn">Por ativar</span>'}</div>
        <div class="kv" style="margin-top:14px">
          <div><span>Participação BXB</span><b>${pct(s.participacao)}</b></div><div><span>Criada em</span><b>${date(s.criadaEm)}</b></div>
          ${r ? `<div><span>Fundos</span><b class="num">${eur(r.fundos)}</b></div><div><span>Pedidos em curso</span><b>${r.pend}</b></div>
            ${r.temVendas ? `<div><span>Faturação ${r.ano}</span><b class="num">${eur(r.fat)}</b></div><div><span>Atribuível à BXB</span><b class="num">${eur(r.atrib)}</b></div>` : ''}`
            : `<div style="grid-column:1/-1"><span>Sistema</span><b style="font-weight:500">Ainda não foi aberto. Ao abrir, o administrador define o PIN.</b></div>`}
          <div style="grid-column:1/-1"><span>Conta na holding</span><b class="mono" style="font-size:12.5px">${esc(s.contaNaHolding || '—')} · ${eur(app.saldo(s.contaNaHolding))}</b></div></div>
        <div class="row" style="margin-top:14px">${s.ativa === false ? '' : `<a class="btn primary sm" href="${Grupo.href(s)}">${icon('arrow')} Abrir sistema</a>`}${app.can('admin') ? `<button class="btn sm" data-ed="${esc(s.key)}">${icon('edit')} Editar</button>` : ''}
          ${s.contaNaHolding ? `<a class="btn ghost sm" href="#/contas/${encodeURIComponent(s.contaNaHolding)}">Extrato</a>` : ''}</div></div></div>`).join('') || '<div class="empty">Sem subsidiárias.</div>'}</div>`;
  const nv = v.querySelector('#nova'); if (nv) nv.onclick = () => formSubsidiaria();
  v.querySelectorAll('[data-ed]').forEach(b => b.onclick = () => formSubsidiaria(subs.find(s => s.key === b.dataset.ed)));
}

const icParceiros = () => (M().subsidiarias || []).filter(s => s.ativa !== false).map(s => {
  const ped = (p, k) => ({ key: k, numero: p.numero, autorizacao: p.autorizacao, data: p.dataExecucao || p.dataPrevista, valor: p.valor, descricao: p.descricao, categoria: p.categoria });
  return { parceiro: s.key, nome: s.nome, sigla: s.sigla, href: Grupo.href(s), contaDestino: '004_BXB_INVESTIMENTOS',
    recebidas: d => d.pedidos.filter(p => p.estado === 'EXECUTADO' && p.contaDestino === s.contaHolding && p.valor > 0).map(p => ped(p, 'ic:' + s.key + ':' + p.id)),
    enviadas: d => d.pedidos.filter(p => p.estado === 'EXECUTADO' && p.contaDestino === s.contaNaHolding && p.valor > 0).map(p => ped(p, 'ic:bxb:' + p.id)) };
});

/* ---------- Utilitários de entidades ---------- */
const ent = id => app.conta(id);
const siglaDe = c => esc(c.sigla || (c.nome || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 3).toUpperCase());
const nextEntId = nome => {
  const n = Math.max(0, ...app.db.contas.map(c => parseInt(String(c.id).split('_')[0], 10)).filter(x => !isNaN(x))) + 1;
  return '00' + n + '_' + String(nome || 'NOVA').toUpperCase().trim().replace(/[^A-Z0-9À-Ü]+/g, '_').replace(/^_|_$/g, '');
};
const dividaEntidade = id => sum(M().contratos.filter(c => c.credor === id && c.estado !== 'ANULADO'), c => resumoContrato(c).divida);

function editarEntidade(c) {
  const novo = !c; c = c || { categoria: 'PARTICULAR', tipo: 'INTERNA', ativo: true, saldoInicial: 0, credito: {} };
  const cr = c.credito || {};
  const md = ui.modal({ title: novo ? 'Adicionar entidade' : 'Editar entidade', sub: novo ? 'Equivalente ao formulário “ADICIONAR ENTIDADE”.' : esc(c.id), wide: true,
    body: `<form class="form">
      <div class="fld"><label>Entidade (nome)</label><input class="inp" name="nome" value="${esc(c.nome || '')}"></div>
      <div class="fld"><label>Sigla</label><input class="inp mono" name="sigla" maxlength="5" value="${esc(c.sigla || '')}" placeholder="ex.: B_I"></div>
      <div class="fld"><label>Categoria</label><select class="inp" name="categoria">${CATS.map(x => `<option ${x === c.categoria ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
      <div class="fld"><label>NIF</label><input class="inp mono" name="nif" value="${esc(c.nif || '')}"></div>
      ${novo ? `<div class="fld"><label>Saldo inicial (€)</label><input class="inp num" type="number" step="0.01" name="saldoInicial" value="0"></div>` : ''}
      <div class="fld ${novo ? '' : 'full'}"><label>ID atribuído</label><input class="inp mono" name="idprev" readonly value="${esc(c.id || nextEntId(c.nome))}"></div>
      <div class="full" data-cred><div class="sep" style="margin-top:0"></div><b style="font-size:13px">Condições de crédito</b></div>
      <div class="fld" data-cred><label>TAEG (%)</label><input class="inp num" type="number" step="0.001" name="taeg" value="${cr.taeg != null ? r2(cr.taeg * 1000) / 10 : ''}"></div>
      <div class="fld" data-cred><label>Tipo de mensalidade</label><select class="inp" name="tipoMensalidade">${TIPOS_MENS.map(x => `<option ${x === cr.tipoMensalidade ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
      <div class="fld" data-cred><label>Taxa mensal (%)</label><input class="inp num" type="number" step="0.01" name="taxaMensal" value="${cr.taxaMensal != null ? r2(cr.taxaMensal * 100) : ''}"></div>
      <div class="fld" data-cred><label>Mensalidade fixa (€)</label><input class="inp num" type="number" step="0.01" name="mensalidadeFixa" value="${cr.mensalidadeFixa ?? ''}"></div>
      <div class="fld" data-cred><label>Limite / montante contratado (€)</label><input class="inp num" type="number" step="0.01" name="limite" value="${cr.limite ?? ''}"></div></form>`,
    actions: [{ label: 'Cancelar', kind: 'ghost' }, { label: novo ? 'Adicionar entidade' : 'Guardar', kind: 'primary', onClick: el => {
      const f = ui.formData(el);
      if (!f.nome) { ui.toast('Indique o nome da entidade', 'warn'); return false; }
      const credito = f.categoria === 'CRÉDITO' ? { taeg: f.taeg === '' ? null : (+f.taeg) / 100, tipoMensalidade: f.tipoMensalidade, taxaMensal: f.taxaMensal === '' ? null : (+f.taxaMensal) / 100,
        mensalidadeFixa: f.mensalidadeFixa === '' ? null : +f.mensalidadeFixa, limite: f.limite === '' ? null : +f.limite } : undefined;
      const data = { nome: f.nome, sigla: f.sigla.toUpperCase(), categoria: f.categoria, tipo: 'INTERNA', nif: f.nif, credito };
      if (novo) { const id = nextEntId(f.nome); app.db.contas.push({ id, codigo: id, ...data, saldoInicial: r2(f.saldoInicial), ativo: true, criadoEm: new Date().toISOString() });
        app.log('ENTIDADE_ADICIONADA', `${id} · ${f.categoria}${credito && credito.taeg != null ? ' · TAEG ' + pct(credito.taeg) : ''}`); }
      else { Object.assign(c, data); app.log('ENTIDADE_ALTERADA', `${c.id} · ${c.nome}`); }
      app.save(); app.refresh(); } }] });
  const el = md.el;
  const upd = () => { const f = ui.formData(el);
    el.querySelectorAll('[data-cred]').forEach(x => x.style.display = f.categoria === 'CRÉDITO' ? '' : 'none');
    if (novo) el.querySelector('[name=idprev]').value = nextEntId(f.nome); };
  el.querySelector('[name=categoria]').addEventListener('change', () => {
    upd(); });
  el.querySelector('[name=nome]').addEventListener('input', upd); upd();
}
function desativarEntidade(c) {
  ui.modal({ title: 'Desativar entidade', sub: esc(c.id), body: `<form class="stack">
    <div class="alert warn">${icon('alert')}<div>A entidade deixa de estar disponível para novos pedidos. O histórico é mantido.</div></div>
    ${app.saldo(c.id) ? `<div class="alert bad">${icon('alert')}<div>Esta entidade ainda tem saldo de <b>${eur(app.saldo(c.id))}</b>.</div></div>` : ''}
    <label class="check"><input type="checkbox" name="ok"> ${DESATIVAR_TXT}</label></form>`,
    actions: [{ label: 'Cancelar', kind: 'ghost' }, { label: 'Desativar', kind: 'bad', onClick: async el => {
      if (!ui.formData(el).ok) { ui.toast('Confirme a desativação', 'warn'); return false; }
      const s = await app.assinar('Desativar ' + c.nome); if (!s) return;
      c.ativo = false; c.desativadoEm = new Date().toISOString(); app.log('ENTIDADE_DESATIVADA', `${c.id} · ${DESATIVAR_TXT}`); app.save(); app.refresh(); } }] });
}

/* =========================================================
   CRÉDITO — contratos e plano de pagamentos
   ========================================================= */
function plano(c) {
  const P = +c.montante || 0, n = Math.max(1, +c.meses || 1), rows = []; let div = P;
  if (c.tipo === 'FIXA') {
    const pm = +c.mensalidade || r2(P / n); let k = 1;
    while (div > 0.004 && k <= 600) { const am = r2(Math.min(pm, div)); div = r2(div - am); rows.push({ n: k, data: addMonths(c.inicio, k - 1), prestacao: am, juros: 0, amort: am, divida: div }); k++; }
  } else {
    const i = Math.pow(1 + (+c.taeg || 0), 1 / 12) - 1;
    const pm = i ? P * i / (1 - Math.pow(1 + i, -n)) : P / n;
    for (let k = 1; k <= n; k++) {
      const j = r2(div * i); let am = r2(pm - j); if (k === n) am = div;
      div = r2(div - am); rows.push({ n: k, data: addMonths(c.inicio, k - 1), prestacao: r2(am + j), juros: j, amort: am, divida: div });
    }
  }
  return rows;
}
const keyParcela = (c, n) => `pia:${c.id}:${n}`;
function estadoParcela(c, row) {
  const peds = app.pedidosPorOrigem(keyParcela(c, row.n)); const p = peds[peds.length - 1];
  if (p) return { p, estado: p.estado };
  return { p: null, estado: row.data < today() ? 'ATRASO' : 'POR_AUTORIZAR' };
}
const badgeParcela = e => e === 'ATRASO' ? '<span class="badge bad">Em atraso · por autorizar</span>' : e === 'POR_AUTORIZAR' ? '<span class="badge plain">Por autorizar</span>' : ui.estadoBadge(e);
function resumoContrato(c) {
  const rows = plano(c); let pago = 0, pagas = 0, prox = null, atraso = 0;
  rows.forEach(r => { const e = estadoParcela(c, r).estado;
    if (e === 'EXECUTADO') { pago += r.amort; pagas++; } else if (!prox) prox = r;
    if (e === 'ATRASO') atraso++; });
  return { rows, pagas, prox, atraso, divida: c.estado === 'ANULADO' ? 0 : r2((+c.montante || 0) - pago), juros: sum(rows, 'juros'), total: sum(rows, 'prestacao') };
}
const prePar = (c, r, total) => ({ categoria: 'MENSALIDADE / PRESTAÇÃO', contaOrigem: c.devedor, contaDestino: c.credor, valor: r.prestacao, metodo: c.metodo || 'DÉBITO', dataPrevista: r.data,
  requerente: c.devedor, parcela: `${r.n}/${total}`, associado: c.ref,
  descricao: `${c.ref} · prestação ${r.n}/${total} · capital ${eur(r.amort)} + juros ${eur(r.juros)}`, origem: { mod: 'pia', key: keyParcela(c, r.n) } });

function novoContrato() {
  const credores = app.db.contas.filter(x => x.ativo !== false && x.categoria === 'CRÉDITO');
  const internas = app.contasInternas();
  if (!credores.length) return ui.toast('Adicione primeiro uma entidade da categoria CRÉDITO', 'warn');
  const md = ui.modal({ title: 'Novo contrato de crédito', sub: 'Gera o plano de pagamentos; cada prestação passa pelo circuito de autorização.', wide: true,
    body: `<form class="form">
      <div class="fld"><label>Referência</label><input class="inp mono" name="ref" value="CT-${today().slice(0, 4)}-${String(M().contratos.length + 1).padStart(3, '0')}"></div>
      <div class="fld"><label>Credor</label><select class="inp" name="credor">${credores.map(x => `<option value="${x.id}">${esc(x.nome)}${x.credito && x.credito.taeg != null ? ' · TAEG ' + pct(x.credito.taeg) : ''}</option>`).join('')}</select></div>
      <div class="fld"><label>Devedor (paga as prestações)</label><select class="inp" name="devedor">${internas.map(x => `<option value="${x.id}">${esc(x.nome)}</option>`).join('')}</select></div>
      <div class="fld"><label>Montante (€)</label><input class="inp num" type="number" step="0.01" name="montante"></div>
      <div class="fld"><label>Modalidade</label><select class="inp" name="tipo"><option value="CONSTANTE">Prestação constante (TAEG)</option><option value="FIXA">Mensalidade fixa, sem juros</option></select></div>
      <div class="fld" data-t="CONSTANTE"><label>TAEG (%)</label><input class="inp num" type="number" step="0.001" name="taeg"></div>
      <div class="fld" data-t="FIXA"><label>Mensalidade fixa (€)</label><input class="inp num" type="number" step="0.01" name="mensalidade"></div>
      <div class="fld" data-t="CONSTANTE"><label>Prazo (meses)</label><input class="inp num" type="number" min="1" max="600" name="meses" value="12"></div>
      <div class="fld"><label>Data da 1.ª prestação</label><input class="inp" type="date" name="inicio" value="${addMonths(today(), 1)}"></div>
      <div class="fld"><label>Método</label><select class="inp" name="metodo">${app.db.metodos.map(m => `<option>${esc(m)}</option>`).join('')}</select></div>
      <div class="fld full"><label>Descrição</label><input class="inp" name="descricao"></div>
      <label class="check full"><input type="checkbox" name="entrada"> Registar pedido de entrada do capital na conta do devedor</label>
      <div class="full calc" id="calc"></div></form>`,
    actions: [{ label: 'Cancelar', kind: 'ghost' }, { label: 'Criar contrato', kind: 'primary', onClick: async el => {
      const f = ui.formData(el);
      const c = { id: uid(), ref: f.ref, credor: f.credor, devedor: f.devedor, montante: r2(f.montante), tipo: f.tipo, taeg: (+f.taeg || 0) / 100, mensalidade: r2(f.mensalidade),
        meses: f.tipo === 'FIXA' ? Math.ceil((+f.montante || 0) / (+f.mensalidade || 1)) : +f.meses, inicio: f.inicio, metodo: f.metodo, descricao: f.descricao, estado: 'ATIVO', criadoEm: new Date().toISOString(), criadoPor: app.user.id };
      if (!(c.montante > 0) || !c.inicio || (c.tipo === 'FIXA' && !(c.mensalidade > 0))) { ui.toast('Preencha montante, data e condições', 'warn'); return false; }
      M().contratos.push(c);
      app.log('CONTRATO_CRIADO', `${c.ref} · ${ent(c.credor).nome} · ${eur(c.montante)} · ${c.tipo === 'FIXA' ? 'mensalidade ' + eur(c.mensalidade) : 'TAEG ' + pct(c.taeg) + ' · ' + c.meses + ' meses'}`);
      try { if (f.entrada) await app.criarAssinado([{ categoria: 'ENTRADA DE FUNDOS', contaDestino: c.devedor, requerente: c.devedor, valor: c.montante, metodo: 'CAPITALIZAÇÃO', dataPrevista: today(),
        beneficiario: '', descricao: `Entrada de capital · contrato ${c.ref} · ${ent(c.credor).nome}`, associado: c.ref, origem: { mod: 'credito', key: 'cap:' + c.id } }], 'Assinar entrada de capital'); } catch (e) { ui.toast(esc(e.message), 'bad'); }
      app.save(); ui.toast('Contrato criado', 'ok'); app.go('credito/' + c.id); } }] });
  const el = md.el;
  const upd = e => { const f = ui.formData(el);
    if (e && e.target.name === 'credor') { const cr = (ent(f.credor) || {}).credito || {}; if (cr.taeg != null) el.querySelector('[name=taeg]').value = r2(cr.taeg * 1000) / 10; if (cr.mensalidadeFixa) el.querySelector('[name=mensalidade]').value = cr.mensalidadeFixa; }
    el.querySelectorAll('[data-t]').forEach(x => x.style.display = x.dataset.t === f.tipo ? '' : 'none');
    const c = { montante: +f.montante, tipo: f.tipo, taeg: (+f.taeg || 0) / 100, mensalidade: +f.mensalidade, meses: +f.meses, inicio: f.inicio || today() };
    const rows = c.montante > 0 && (c.tipo !== 'FIXA' || c.mensalidade > 0) ? plano(c) : [];
    el.querySelector('#calc').innerHTML = rows.length ? `<div><span>Prestação</span><b class="num">${eur(rows[0].prestacao)}</b></div><div><span>N.º prestações</span><b>${rows.length}</b></div>
      <div><span>Total de juros</span><b class="num">${eur(sum(rows, 'juros'))}</b></div><div><span>Total a pagar</span><b class="num">${eur(sum(rows, 'prestacao'))}</b></div><div><span>Última</span><b>${date(rows[rows.length - 1].data)}</b></div>` : '<div><span>Simulação</span><b class="muted" style="font-size:13px">Indique o montante</b></div>';
  };
  el.querySelectorAll('input,select').forEach(i => i.addEventListener('input', upd));
  upd({ target: { name: 'credor' } });
}

function credito(v, _a, params) {
  if (params[0]) return contratoDetalhe(v, params[0]);
  let tab = sessionStorage.getItem('bxb:cr') || 'pia';
  v.innerHTML = `<div class="row between" style="margin-bottom:16px"><div class="tabs">${[['pia', 'PIA · Processamento Integrado de Autorizações'], ['ct', 'Contratos']].map(([k, l]) => `<button data-t="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    ${app.can('criar') ? `<button class="btn primary" id="nc">${icon('plus')} Novo contrato</button>` : ''}</div><div id="c"></div>`;
  v.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { sessionStorage.setItem('bxb:cr', b.dataset.t); app.refresh(); });
  if (v.querySelector('#nc')) v.querySelector('#nc').onclick = novoContrato;
  const c = v.querySelector('#c');
  if (tab === 'ct') {
    const list = M().contratos;
    c.innerHTML = list.length ? `<div class="grid g3">${list.map(ct => { const r = resumoContrato(ct); const f = ct.montante ? 1 - r.divida / ct.montante : 0;
      return `<div class="card click-card" data-c="${ct.id}" style="cursor:pointer"><div class="row between"><div><b>${esc(ct.ref)}</b><div class="muted" style="font-size:12.5px">${esc(ent(ct.credor)?.nome || ct.credor)} → pago por ${esc(ent(ct.devedor)?.nome || ct.devedor)}</div></div>
        ${ct.estado === 'ANULADO' ? '<span class="badge">Anulado</span>' : r.divida <= 0 ? '<span class="badge ok">Liquidado</span>' : r.atraso ? `<span class="badge bad">${r.atraso} em atraso</span>` : '<span class="badge acc">Ativo</span>'}</div>
        <div style="margin:14px 0 6px" class="row between"><span class="muted" style="font-size:12px">Capital em dívida</span><b class="num" style="font-size:20px">${eur(r.divida)}</b></div>
        <div class="progress"><i style="width:${Math.max(0, Math.min(100, f * 100))}%"></i></div>
        <div class="row between" style="margin-top:10px;font-size:12.5px"><span class="muted">${r.pagas}/${r.rows.length} pagas · ${ct.tipo === 'FIXA' ? 'mensalidade fixa' : 'TAEG ' + pct(ct.taeg)}</span><span>${r.prox ? 'Próx. ' + date(r.prox.data) + ' · <b>' + eur(r.prox.prestacao) + '</b>' : ''}</span></div></div>`; }).join('')}</div>`
      : `<div class="card empty">${icon('credit')}<p>Ainda não existem contratos de crédito.</p>${app.can('criar') ? '<button class="btn primary" id="nc2">Criar o primeiro contrato</button>' : ''}</div>`;
    c.querySelectorAll('[data-c]').forEach(x => x.onclick = () => app.go('credito/' + x.dataset.c));
    if (c.querySelector('#nc2')) c.querySelector('#nc2').onclick = novoContrato;
    return;
  }
  // ---- PIA: Processamento Integrado de Autorizações (prestações + outros pedidos do ano) ----
  const anosSet = new Set([today().slice(0, 4)]);
  M().contratos.forEach(ct => plano(ct).forEach(r => anosSet.add(r.data.slice(0, 4))));
  app.db.pedidos.forEach(p => anosSet.add((p.dataPrevista || '').slice(0, 4)));
  const anos = [...anosSet].filter(Boolean).sort();
  let ano = sessionStorage.getItem('bxb:ano'); if (!anos.includes(ano)) ano = today().slice(0, 4);
  const linhas = [];
  M().contratos.filter(ct => ct.estado !== 'ANULADO').forEach(ct => { const rows = plano(ct);
    rows.filter(r => r.data.startsWith(ano)).forEach(r => { const e = estadoParcela(ct, r); linhas.push({ tipo: 'P', data: r.data, ct, r, total: rows.length, p: e.p, estado: e.estado, valor: r.prestacao, juros: r.juros }); }); });
  app.db.pedidos.filter(p => (p.dataPrevista || '').startsWith(ano) && !(p.origem && p.origem.mod === 'pia') && p.categoria !== 'ENTRADA DE FUNDOS' && !['REJEITADO', 'CANCELADO'].includes(p.estado))
    .forEach(p => linhas.push({ tipo: 'O', data: p.dataPrevista, p, estado: p.estado, valor: p.valor, juros: 0 }));
  linhas.sort((a, b) => a.data.localeCompare(b.data));
  const tot = f => sum(linhas.filter(f), 'valor');
  const porAut = linhas.filter(l => ['POR_AUTORIZAR', 'ATRASO'].includes(l.estado));
  c.innerHTML = `<div class="row between" style="margin-bottom:14px"><div class="row"><span class="muted">Ano</span><select class="inp inp-sm" id="ano">${anos.map(y => `<option ${y === ano ? 'selected' : ''}>${y}</option>`).join('')}</select></div>
    ${porAut.length && app.can('criar') ? `<button class="btn" id="all">${icon('shield')} Autorizar pagamento de ${porAut.length} prestações</button>` : ''}</div>
    <div class="grid g4" style="margin-bottom:16px">
      <div class="card kpi hero"><div class="lbl">Total planeado ${ano}</div><div class="val num">${eur(tot(() => true))}</div><div class="foot">${linhas.length} pagamentos</div></div>
      <div class="card kpi"><div class="lbl">Executado</div><div class="val num pos">${eur(tot(l => l.estado === 'EXECUTADO'))}</div></div>
      <div class="card kpi"><div class="lbl">Em autorização / aprovado</div><div class="val num">${eur(tot(l => ['PENDENTE', 'EM_APROVACAO', 'APROVADO'].includes(l.estado)))}</div></div>
      <div class="card kpi"><div class="lbl">Por autorizar</div><div class="val num ${linhas.some(l => l.estado === 'ATRASO') ? 'neg' : ''}">${eur(tot(l => ['POR_AUTORIZAR', 'ATRASO'].includes(l.estado)))}</div><div class="foot">${linhas.filter(l => l.estado === 'ATRASO').length} em atraso</div></div></div>
    <div class="card flush"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Autorizar pagamento</th><th>N.º autorização</th><th>Descrição</th><th>Entidade</th><th>Método</th><th class="r">Juros</th><th class="r">Valor</th><th>Estado</th></tr></thead><tbody>
    ${MESES.map((mn, i) => { const mk = `${ano}-${String(i + 1).padStart(2, '0')}`; const ls = linhas.filter(l => ym(l.data) === mk);
      return `<tr><td colspan="6" style="background:var(--panel2);font-weight:700;letter-spacing:.06em">${mn.toUpperCase()}</td><td class="r num" style="background:var(--panel2);font-weight:700">${ls.length ? eur(sum(ls, 'valor')) : ''}</td><td style="background:var(--panel2)"></td></tr>` +
        (ls.length ? ls.map(l => { const idx = linhas.indexOf(l);
          const desc = l.tipo === 'P' ? `<b>${esc(l.ct.ref)}</b> · prestação ${l.r.n}/${l.total}<div class="faint" style="font-size:12px">${date(l.data)} · capital ${eur(l.r.amort)}</div>` : `<b>${esc(l.p.categoria)}</b> · <span class="mono">${esc(l.p.numero)}</span><div class="faint" style="font-size:12px;max-width:340px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${date(l.data)} · ${esc(l.p.descricao)}</div>`;
          const entidade = l.tipo === 'P' ? (ent(l.ct.credor) || {}).nome : (l.p.contaDestino ? app.nomeConta(l.p.contaDestino) : l.p.beneficiario);
          const acao = l.p ? `<a class="btn sm" href="#/pedidos/${l.p.id}">${icon('eye')} ${esc(l.p.numero)}</a>` : app.can('criar') ? `<button class="btn sm ${l.estado === 'ATRASO' ? 'primary' : ''}" data-i="${idx}">${icon('shield')} Autorizar</button>` : '—';
          return `<tr><td>${acao}</td><td class="mono">${esc(l.p && l.p.autorizacao || '—')}</td><td>${desc}</td><td>${esc(entidade || '')}</td><td>${esc(l.p ? l.p.metodo : l.ct.metodo || 'DÉBITO')}</td><td class="r num faint">${l.juros ? eur(l.juros) : '–'}</td><td class="r num"><b>${eur(l.valor)}</b></td><td>${badgeParcela(l.estado)}</td></tr>`; }).join('')
          : `<tr><td colspan="8" class="faint" style="font-size:12px;padding:8px 14px">Sem pagamentos planeados.</td></tr>`); }).join('')}
    </tbody><tfoot><tr><td colspan="5">TOTAIS ${ano}</td><td class="r num">${eur(sum(linhas, 'juros'))}</td><td class="r num">${eur(sum(linhas, 'valor'))}</td><td></td></tr></tfoot></table></div></div>`;
  c.querySelector('#ano').onchange = e => { sessionStorage.setItem('bxb:ano', e.target.value); app.refresh(); };
  c.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { const l = linhas[+b.dataset.i]; app.novoPedido(prePar(l.ct, l.r, l.total)); });
  const all = c.querySelector('#all');
  if (all) all.onclick = async () => {
    try { const cr = await app.criarAssinado(porAut.map(l => prePar(l.ct, l.r, l.total)), 'Assinar pedidos de prestações', `${porAut.length} prestações · total <b>${eur(sum(porAut, 'valor'))}</b>`);
      if (cr) { ui.toast(`${cr.length} pedidos criados e assinados`, 'ok'); app.refresh(); } } catch (e) { ui.toast(esc(e.message), 'bad'); }
  };
}

function contratoDetalhe(v, id) {
  const ct = M().contratos.find(x => x.id === id); if (!ct) { v.innerHTML = '<div class="empty">Contrato não encontrado.</div>'; return; }
  app.setTitle('Contrato ' + ct.ref);
  const r = resumoContrato(ct);
  v.innerHTML = `<div class="row" style="margin-bottom:14px"><a class="btn ghost sm" href="#/credito">← Crédito</a><div style="flex:1"></div>
    ${app.can('admin') && ct.estado !== 'ANULADO' ? `<button class="btn bad sm" id="anl">Anular contrato</button>` : ''}
    <button class="btn sm" id="csv">${icon('download')} Plano CSV</button></div>
    <div class="grid g4"><div class="card kpi hero"><div class="lbl">Capital em dívida</div><div class="val num">${eur(r.divida)}</div><div class="foot">de ${eur(ct.montante)}</div></div>
      <div class="card kpi"><div class="lbl">Prestações pagas</div><div class="val">${r.pagas}/${r.rows.length}</div><div class="foot">${r.atraso ? `<span class="neg">${r.atraso} em atraso</span>` : 'em dia'}</div></div>
      <div class="card kpi"><div class="lbl">Condições</div><div class="val" style="font-size:20px">${ct.tipo === 'FIXA' ? eur(ct.mensalidade) + '/mês' : 'TAEG ' + pct(ct.taeg)}</div><div class="foot">${ct.tipo === 'FIXA' ? 'Mensalidade fixa' : 'Prestação constante · ' + ct.meses + ' meses'}</div></div>
      <div class="card kpi"><div class="lbl">Custo total</div><div class="val num" style="font-size:20px">${eur(r.total)}</div><div class="foot">juros ${eur(r.juros)}</div></div></div>
    <div class="card" style="margin-top:16px"><div class="kv">
      <div><span>Credor</span><b>${esc(ent(ct.credor)?.nome || ct.credor)}</b></div><div><span>Devedor</span><b>${esc(ent(ct.devedor)?.nome || ct.devedor)}</b></div>
      <div><span>1.ª prestação</span><b>${date(ct.inicio)}</b></div><div><span>Método</span><b>${esc(ct.metodo || 'DÉBITO')}</b></div>
      <div style="grid-column:1/-1"><span>Descrição</span><b style="font-weight:500">${esc(ct.descricao || '—')}</b></div></div></div>
    <div class="card" style="margin-top:16px"><div class="card-h"><h3>Evolução do capital em dívida</h3></div><div id="ch"></div></div>
    <div class="card flush" style="margin-top:16px"><div class="card-h"><h3>Plano de pagamentos</h3></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>Data</th><th class="r">Prestação</th><th class="r">Juros</th><th class="r">Amortização</th><th class="r">Capital em dívida</th><th>Estado</th><th></th></tr></thead><tbody>
    ${r.rows.map(x => { const e = estadoParcela(ct, x); return `<tr><td>${x.n}</td><td>${date(x.data)}</td><td class="r num"><b>${eur(x.prestacao)}</b></td><td class="r num">${eur(x.juros)}</td><td class="r num">${eur(x.amort)}</td><td class="r num">${eur(x.divida)}</td><td>${badgeParcela(e.estado)}</td>
      <td class="r">${e.p ? `<a class="btn sm" href="#/pedidos/${e.p.id}">${esc(e.p.numero)}</a>` : app.can('criar') && ct.estado !== 'ANULADO' ? `<button class="btn sm" data-n="${x.n}">Autorizar</button>` : ''}</td></tr>`; }).join('')}
    </tbody><tfoot><tr><td colspan="2">TOTAL</td><td class="r num">${eur(r.total)}</td><td class="r num">${eur(r.juros)}</td><td class="r num">${eur(ct.montante)}</td><td colspan="3"></td></tr></tfoot></table></div></div>`;
  const step = Math.max(1, Math.ceil(r.rows.length / 24)); const sample = r.rows.filter((_, i) => i % step === 0 || i === r.rows.length - 1);
  chart.bars(v.querySelector('#ch'), { labels: sample.map(x => MES3[+x.data.slice(5, 7) - 1] + x.data.slice(2, 4)), series: [{ name: 'Capital em dívida', values: sample.map(x => x.divida) }], height: 200 });
  v.querySelectorAll('[data-n]').forEach(b => b.onclick = () => app.novoPedido(prePar(ct, r.rows[+b.dataset.n - 1], r.rows.length)));
  v.querySelector('#csv').onclick = () => SPAP.csv(`plano_${ct.ref}.csv`, [['#', 'Data', 'Prestação', 'Juros', 'Amortização', 'Capital em dívida', 'Estado'], ...r.rows.map(x => [x.n, x.data, x.prestacao, x.juros, x.amort, x.divida, estadoParcela(ct, x).estado])]);
  const anl = v.querySelector('#anl');
  if (anl) anl.onclick = async () => { if (!await ui.confirm('Anular contrato', 'O contrato deixa de gerar prestações. Os pedidos já criados mantêm-se.', { danger: true, okLabel: 'Anular' })) return;
    const s = await app.assinar('Anular ' + ct.ref); if (!s) return; ct.estado = 'ANULADO'; app.log('CONTRATO_ANULADO', ct.ref); app.save(); app.refresh(); };
}

/* =========================================================
   APLICAÇÕES / FUNDOS
   ========================================================= */
function estadoAplic(a) {
  const res = app.pedidosPorOrigem('resg:' + a.id);
  if (res.some(p => p.estado === 'EXECUTADO')) return { estado: 'RESGATADA', inicio: a.inicio };
  if (a.migrada) return { estado: res.length ? 'RESGATE' : 'ATIVA', inicio: a.inicio };
  const p = app.pedidosPorOrigem('apl:' + a.id).pop();
  if (!p) return { estado: 'ANULADA' };
  if (p.estado === 'EXECUTADO') return { estado: res.length ? 'RESGATE' : 'ATIVA', inicio: p.dataExecucao, p };
  return { estado: 'AUTORIZACAO', p };
}
function rendimento(a, ate = today()) {
  const e = estadoAplic(a); if (!['ATIVA', 'RESGATE'].includes(e.estado) || !e.inicio) return 0;
  const dias = Math.max(0, (new Date(ate) - new Date(e.inicio)) / 864e5);
  return r2(a.capital * (Math.pow(1 + (+a.taxa || 0), dias / 365) - 1));
}
const badgeAplic = e => ({ ATIVA: '<span class="badge ok">Ativa</span>', RESGATE: '<span class="badge info">Resgate em curso</span>', RESGATADA: '<span class="badge">Resgatada</span>',
  AUTORIZACAO: '<span class="badge warn">A aguardar autorização</span>', ANULADA: '<span class="badge bad">Anulada</span>' }[e]);

function aplicacoes(v) {
  const list = M().aplicacoes.map(a => ({ a, e: estadoAplic(a), rend: rendimento(a) }));
  const ativas = list.filter(x => ['ATIVA', 'RESGATE'].includes(x.e.estado));
  const cap = sum(ativas, x => x.a.capital), rend = sum(ativas, 'rend');
  v.innerHTML = `<div class="row between" style="margin-bottom:16px"><div class="muted">Capital aplicado nos fundos internos, com rendimento capitalizado à taxa anual definida.</div>
    ${app.can('criar') ? `<button class="btn primary" id="na">${icon('plus')} Nova aplicação</button>` : ''}</div>
    <div class="grid g4"><div class="card kpi hero"><div class="lbl">Capital aplicado</div><div class="val num">${eur(cap)}</div><div class="foot">${ativas.length} aplicações ativas</div></div>
      <div class="card kpi"><div class="lbl">Rendimento acumulado</div><div class="val num pos">+${eur(rend)}</div><div class="foot">estimado até hoje</div></div>
      <div class="card kpi"><div class="lbl">Valor atual</div><div class="val num">${eur(cap + rend)}</div></div>
      <div class="card kpi"><div class="lbl">Projeção a 12 meses</div><div class="val num">${eur(sum(ativas, x => x.a.capital + rendimento(x.a, addMonths(today(), 12))))}</div></div></div>
    <div class="grid g3" style="margin-top:16px"><div class="card span2"><div class="card-h"><h3>Projeção do valor aplicado</h3><span class="sub">próximos 12 meses</span></div><div id="ch"></div></div>
      <div class="card"><div class="card-h"><h3>Participação por investidor</h3></div><div id="dn"></div></div></div>
    <div class="card flush" style="margin-top:16px"><div class="card-h"><h3>Aplicações</h3></div>${list.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Investidor</th><th>Fundo</th><th class="r">Capital</th><th class="r">Taxa anual</th><th class="r">Participação</th><th>Início</th><th class="r">Rendimento</th><th class="r">Valor atual</th><th>Estado</th><th></th></tr></thead><tbody>
    ${list.map(({ a, e, rend }, i) => `<tr><td><b>${esc(app.nomeConta(a.investidor))}</b>${a.notas ? `<div class="faint" style="font-size:11.5px;max-width:260px">${esc(a.notas)}</div>` : ''}</td><td>${esc(app.nomeConta(a.fundo))}</td><td class="r num">${eur(a.capital)}</td><td class="r">${pct(a.taxa)}</td><td class="r">${pct(a.participacao)}</td>
      <td>${date(e.inicio)}</td><td class="r num pos">${rend ? '+' + eur(rend) : '–'}</td><td class="r num"><b>${eur(['ATIVA', 'RESGATE'].includes(e.estado) ? a.capital + rend : 0)}</b></td><td>${badgeAplic(e.estado)}</td>
      <td class="r">${e.p && e.estado === 'AUTORIZACAO' ? `<a class="btn sm" href="#/pedidos/${e.p.id}">${esc(e.p.numero)}</a>` : ''}${e.estado === 'ATIVA' && app.can('criar') ? `<button class="btn sm" data-r="${i}">Resgatar</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Sem aplicações.</div>'}</div>`;
  const meses = Array.from({ length: 13 }, (_, i) => addMonths(today(), i));
  chart.bars(v.querySelector('#ch'), { labels: meses.map(d => MES3[+d.slice(5, 7) - 1]), series: [
    { name: 'Capital', values: meses.map(() => cap), color: 'var(--accent)' }, { name: 'Rendimento', values: meses.map(d => sum(ativas, x => rendimento(x.a, d))), color: 'var(--ok)' }], stacked: true, height: 210 });
  const byInv = {}; ativas.forEach(x => byInv[x.a.investidor] = (byInv[x.a.investidor] || 0) + x.a.capital);
  chart.donut(v.querySelector('#dn'), { center: eur(cap).replace(/,\d+/, ''), sub: 'capital', items: Object.entries(byInv).map(([k, val]) => ({ label: app.nomeConta(k), value: val })) });
  const na = v.querySelector('#na');
  if (na) na.onclick = () => {
    const fundos = app.contasInternas().filter(c => c.categoria === 'FUNDO');
    ui.modal({ title: 'Nova aplicação', sub: 'Cria um pedido de transferência do investidor para o fundo. A aplicação fica ativa quando o pedido for executado.', body: `<form class="form">
      <div class="fld"><label>Investidor</label><select class="inp" name="investidor">${app.contasInternas().filter(c => c.categoria !== 'FUNDO').map(c => `<option value="${c.id}">${esc(c.nome)} · ${eur(app.disponivel(c.id))}</option>`).join('')}</select></div>
      <div class="fld"><label>Fundo</label><select class="inp" name="fundo">${fundos.map(c => `<option value="${c.id}">${esc(c.nome)}</option>`).join('')}</select></div>
      <div class="fld"><label>Capital (€)</label><input class="inp num" type="number" step="0.01" name="capital"></div>
      <div class="fld"><label>Taxa anual / reaplicação (%)</label><input class="inp num" type="number" step="0.01" name="taxa" value="5"></div>
      <div class="fld"><label>Participação (%)</label><input class="inp num" type="number" step="0.01" name="participacao" value="100"></div>
      <div class="fld full"><label>Notas</label><input class="inp" name="notas"></div></form>`,
      actions: [{ label: 'Cancelar', kind: 'ghost' }, { label: icon('pen') + 'Assinar e submeter', kind: 'primary', onClick: async el => {
        const f = ui.formData(el); if (!(+f.capital > 0)) { ui.toast('Indique o capital', 'warn'); return false; }
        const a = { id: uid(), investidor: f.investidor, fundo: f.fundo, capital: r2(f.capital), taxa: (+f.taxa || 0) / 100, participacao: (+f.participacao || 0) / 100, notas: f.notas, criadoEm: new Date().toISOString() };
        try { const ps = await app.criarAssinado([{ categoria: 'APLICAÇÃO / INVESTIMENTO', contaOrigem: a.investidor, contaDestino: a.fundo, valor: a.capital, metodo: 'COMPENSAÇÃO INTERNA', dataPrevista: today(),
            descricao: `Aplicação em ${app.nomeConta(a.fundo)} · taxa ${pct(a.taxa)}`, origem: { mod: 'aplicacoes', key: 'apl:' + a.id } }], 'Assinar aplicação'); if (!ps) return false; const p = ps[0];
          M().aplicacoes.push(a); app.log('APLICACAO_CRIADA', `${app.nomeConta(a.investidor)} → ${app.nomeConta(a.fundo)} · ${eur(a.capital)}`); app.save(); ui.toast(`Pedido ${p.numero} criado`, 'ok'); app.refresh();
        } catch (e) { ui.toast(esc(e.message), 'bad'); return false; } } }] });
  };
  v.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { const { a, rend } = list[+b.dataset.r];
    app.novoPedido({ categoria: 'RESGATE DE APLICAÇÃO', contaOrigem: a.fundo, contaDestino: a.investidor, valor: r2(a.capital + rend), metodo: 'COMPENSAÇÃO INTERNA',
      descricao: `Resgate de aplicação · capital ${eur(a.capital)} + rendimento ${eur(rend)}`, origem: { mod: 'aplicacoes', key: 'resg:' + a.id } }); });
}

/* =========================================================
   ENTIDADES
   ========================================================= */
function entidades(v) {
  let cat = sessionStorage.getItem('bxb:cat') || '', q = '', inat = false;
  v.innerHTML = `<div class="row between" style="margin-bottom:16px"><div class="tabs" id="tabs"></div>
    <div class="row"><input class="inp inp-sm" id="q" placeholder="Pesquisar entidade, ID, NIF…" style="width:220px"><label class="check"><input type="checkbox" id="in"> Mostrar desativadas</label>
    ${app.can('contas') ? `<button class="btn primary" id="ne">${icon('plus')} Adicionar entidade</button>` : ''}</div></div><div class="grid g3" id="g"></div>`;
  const draw = () => {
    const all = app.db.contas.filter(c => inat || c.ativo !== false);
    v.querySelector('#tabs').innerHTML = [['', 'Todas'], ...CATS.map(c => [c, c.charAt(0) + c.slice(1).toLowerCase()])].filter(([k]) => !k || all.some(c => c.categoria === k))
      .map(([k, l]) => `<button data-t="${k}" class="${cat === k ? 'on' : ''}">${l}<span class="n">${all.filter(c => !k || c.categoria === k).length}</span></button>`).join('');
    v.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { cat = b.dataset.t; sessionStorage.setItem('bxb:cat', cat); draw(); });
    const ql = q.toLowerCase();
    const list = all.filter(c => (!cat || c.categoria === cat) && (!ql || [c.id, c.nome, c.nif, c.sigla].join(' ').toLowerCase().includes(ql)));
    v.querySelector('#g').innerHTML = list.map(c => { const cr = c.credito || {};
      const corpo = `<div><div class="muted" style="font-size:11.5px">Saldo</div><div class="num" style="font-size:22px;font-weight:750;letter-spacing:-.5px">${eur(app.saldo(c.id))}</div><div class="faint" style="font-size:12px">Disponível ${eur(app.disponivel(c.id))} · cativo ${eur(app.cativo(c.id))}</div></div>`
        + (c.categoria === 'CRÉDITO' ? `<div class="kv" style="grid-template-columns:1fr 1fr"><div><span>TAEG</span><b>${cr.taeg != null ? pct(cr.taeg) : '—'}</b></div><div><span>Limite / montante</span><b class="num">${cr.limite != null ? eur(cr.limite) : '—'}</b></div>
            <div><span>Mensalidade</span><b style="font-size:12px">${esc(cr.tipoMensalidade || '—')}</b></div><div><span>Dívida em contratos</span><b class="num">${eur(dividaEntidade(c.id))}</b></div></div>` : '');
      return `<div class="card ent-card ${c.ativo === false ? 'off' : ''}"><div class="row between" style="align-items:flex-start"><div class="row" style="flex-wrap:nowrap;min-width:0"><span class="sigla">${siglaDe(c)}</span>
        <div style="min-width:0"><b style="display:block">${esc(c.nome)}</b><div class="mono faint" style="font-size:11px;word-break:break-all">${esc(c.id)}</div></div></div>
        ${c.ativo === false ? '<span class="badge bad">Desativada</span>' : `<span class="badge acc plain">${esc(c.categoria || 'CONTA')}</span>`}</div>
        ${corpo}
        <div class="row" style="margin-top:auto">${c.nif ? `<span class="faint mono" style="font-size:11.5px">NIF ${esc(c.nif)}</span>` : ''}<div style="flex:1"></div>
          <a class="btn sm" href="#/contas/${encodeURIComponent(c.id)}">${icon('list')} Extrato</a>
          ${app.can('contas') ? `<button class="btn sm ghost" data-ed="${esc(c.id)}">${icon('edit')}</button>` : ''}
          ${app.can('admin') ? (c.ativo === false ? `<button class="btn sm ghost" data-re="${esc(c.id)}">Reativar</button>` : `<button class="btn sm ghost" data-de="${esc(c.id)}" title="Desativar">${icon('x')}</button>`) : ''}</div></div>`; }).join('') || '<div class="empty">Sem entidades.</div>';
    v.querySelectorAll('[data-ed]').forEach(b => b.onclick = () => editarEntidade(ent(b.dataset.ed)));
    v.querySelectorAll('[data-de]').forEach(b => b.onclick = () => desativarEntidade(ent(b.dataset.de)));
    v.querySelectorAll('[data-re]').forEach(b => b.onclick = async () => { const c = ent(b.dataset.re); const s = await app.assinar('Reativar ' + c.nome); if (!s) return;
      c.ativo = true; app.log('ENTIDADE_REATIVADA', c.id); app.save(); draw(); });
  };
  v.querySelector('#q').oninput = e => { q = e.target.value; draw(); };
  v.querySelector('#in').onchange = e => { inat = e.target.checked; draw(); };
  if (v.querySelector('#ne')) v.querySelector('#ne').onclick = () => editarEntidade();
  draw();
}

/* =========================================================
   VISÃO GERAL (inclui o grupo)
   ========================================================= */
function visao(v) {
  const internas = app.contasInternas();
  const patrimonio = sum(internas, c => app.saldo(c.id));
  const contratos = M().contratos.filter(c => c.estado !== 'ANULADO');
  const divida = sum(contratos, c => resumoContrato(c).divida);
  const aplicado = sum(M().aplicacoes.filter(a => ['ATIVA', 'RESGATE'].includes(estadoAplic(a).estado)), a => a.capital + rendimento(a));
  const pend = app.db.pedidos.filter(p => ['PENDENTE', 'EM_APROVACAO', 'APROVADO'].includes(p.estado));
  const prox = []; const lim = addMonths(today(), 2);
  contratos.forEach(ct => { const rows = plano(ct); rows.forEach(r => { const e = estadoParcela(ct, r); if (e.estado !== 'EXECUTADO' && r.data <= lim) prox.push({ ct, r, e, total: rows.length }); }); });
  prox.sort((a, b) => a.r.data.localeCompare(b.r.data));
  const grupo = (M().subsidiarias || []).filter(s => s.ativa !== false).map(s => ({ s, r: Grupo.resumo(s) }));
  v.innerHTML = `<div class="grid g4">
      <div class="card kpi hero"><div class="lbl">${icon('wallet')} Fundos sob gestão</div><div class="val num">${eur(patrimonio)}</div><div class="foot">${internas.length} contas internas</div></div>
      <div class="card kpi"><div class="lbl">${icon('credit')} Crédito em dívida</div><div class="val num">${eur(divida)}</div><div class="foot">${contratos.length} contratos · ${prox.filter(x => x.e.estado === 'ATRASO').length} prestações em atraso</div></div>
      <div class="card kpi"><div class="lbl">${icon('coins')} Aplicações (valor atual)</div><div class="val num">${eur(aplicado)}</div><div class="foot">capital + rendimento estimado</div></div>
      <div class="card kpi"><div class="lbl">${icon('shield')} Pedidos em curso</div><div class="val num">${pend.length}</div><div class="foot">${eur(sum(pend, 'valor'))}</div></div></div>
    <div class="grid g3" style="margin-top:16px">
      <div class="card span2"><div class="card-h"><h3>Fluxo de caixa · últimos 12 meses</h3><span class="sub">movimentos executados nas contas internas</span></div><div id="c1"></div></div>
      <div class="card"><div class="card-h"><h3>Saldos por entidade</h3></div><div id="c2"></div></div></div>
    <div class="grid g2" style="margin-top:16px">
      <div class="card flush"><div class="card-h"><h3>Próximas prestações</h3><a class="btn sm" href="#/credito">Ver PIA</a></div>
        ${prox.length ? `<div class="tbl-wrap"><table class="tbl"><tbody>${prox.slice(0, 8).map(x => `<tr><td>${date(x.r.data)}</td><td><b>${esc(x.ct.ref)}</b> <span class="faint">${x.r.n}/${x.total}</span><div class="faint" style="font-size:12px">${esc(ent(x.ct.credor)?.nome || '')}</div></td><td class="r num"><b>${eur(x.r.prestacao)}</b></td><td>${badgeParcela(x.e.estado)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Sem prestações nos próximos 60 dias.</div>'}</div>
      <div class="card flush"><div class="card-h"><h3>Grupo · subsidiárias</h3><a class="btn sm" href="#/subsidiarias">${icon('building')} Gerir</a></div>
        ${grupo.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Empresa</th><th class="r">Fundos</th><th class="r">Atribuível à BXB</th><th class="r">Pedidos</th><th></th></tr></thead><tbody>
          ${grupo.map(({ s, r }) => `<tr><td><b>${esc(s.nome)}</b><div class="faint" style="font-size:12px">${pct(s.participacao)} · ${esc((Grupo.MODELOS[s.modelo] || {}).nome || '')}</div></td>
            <td class="r num">${r ? eur(r.fundos) : '—'}</td><td class="r num">${r && r.temVendas ? eur(r.atrib) : '—'}</td><td class="r">${r ? r.pend : '—'}</td><td class="r"><a class="btn ghost sm" href="${Grupo.href(s)}">Abrir</a></td></tr>`).join('')}</tbody></table></div>`
          : '<div class="empty">Sem subsidiárias ativas.</div>'}</div></div>
    <div class="card flush" style="margin-top:16px"><div class="card-h"><h3>Pedidos em curso</h3><a class="btn sm" href="#/pedidos">Todos</a></div>${app.tabelaPedidos(pend.slice(0, 8), { empty: 'Sem pedidos em curso.' })}</div>`;
  app.bindPedidos(v);
  const meses = Array.from({ length: 12 }, (_, i) => addMonths(today().slice(0, 8) + '15', i - 11).slice(0, 7));
  const ids = new Set(internas.map(c => c.id));
  const movs = app.db.movimentos.filter(m => ids.has(m.conta));
  chart.bars(v.querySelector('#c1'), { labels: meses.map(m => MES3[+m.slice(5) - 1]), series: [
    { name: 'Entradas', values: meses.map(m => sum(movs.filter(x => ym(x.data) === m && x.valor > 0), 'valor')), color: 'var(--ok)' },
    { name: 'Saídas', values: meses.map(m => sum(movs.filter(x => ym(x.data) === m && x.valor < 0), 'valor')), color: 'var(--bad)' }] });
  const pos = internas.map(c => ({ label: c.nome, value: app.saldo(c.id) })).filter(x => x.value > 0).sort((a, b) => b.value - a.value);
  chart.donut(v.querySelector('#c2'), { center: eur(patrimonio).replace(/,\d+/, ''), sub: 'saldos', items: pos.length ? pos.slice(0, 6) : [{ label: 'Sem saldos positivos', value: 0 }] });
}

/* ---------- Arranque ---------- */
app = SPAP.createApp({
  key: 'bxb', nome: 'BXB Investimentos', alcadaPadrao: 50000, sigla: 'BXB', tagline: 'Gestão de finanças',
  logo: '<span style="font-size:13px;letter-spacing:-.5px">BXB</span>',
  heroTitle: 'Gestão financeira com rigor bancário.',
  heroText: 'Entidades, crédito, plano de pagamentos e aplicações — cada pagamento requerido, aprovado, assinado e auditado.',
  home: 'visao', grupoModulos: 'BXB Investimentos',
  outroSistema: { href: '../index.html', label: 'Portal do grupo' },
  migrar: db => migrarBXB(db),
  // prestações do PIA ainda sem pedido entram na previsão de liquidez
  previsao: (a, ini, fim) => { const out = [];
    M().contratos.filter(ct => ct.estado !== 'ANULADO').forEach(ct => { const rows = plano(ct);
      rows.forEach(r => { if (r.data > fim || !['POR_AUTORIZAR', 'ATRASO'].includes(estadoParcela(ct, r).estado)) return;
        const d = `${ct.ref} · prestação ${r.n}/${rows.length}`;
        out.push({ conta: ct.devedor, data: r.data, valor: -r.prestacao, tipo: 'PIA', descricao: d }, { conta: ct.credor, data: r.data, valor: r.prestacao, tipo: 'PIA', descricao: d }); }); });
    return out; },
  intercompany: () => icParceiros(),
  verGrupo: true,
  // tesouraria própria da holding: a conta da BXB e os seus fundos (as contas das subsidiárias não contam)
  contaPropria: c => c.id === '004_BXB_INVESTIMENTOS' || (c.categoria === 'FUNDO' && !c.subsidiaria),
  editarConta: c => editarEntidade(c),
  seed,
  modules: [
    { id: 'visao', label: 'Visão geral', title: 'Visão geral', icon: 'chart', render: visao },
    { id: 'subsidiarias', label: 'Grupo e subsidiárias', title: 'Grupo e subsidiárias', icon: 'layers', render: subsidiarias },
    { id: 'entidades', label: 'Entidades', title: 'Gestão de entidades', icon: 'building', render: entidades },
    { id: 'credito', label: 'Crédito e PIA', title: 'Crédito e PIA · Processamento Integrado de Autorizações', icon: 'calendar', render: credito },
    { id: 'aplicacoes', label: 'Aplicações e fundos', title: 'Aplicações e fundos', icon: 'coins', render: aplicacoes },
  ],
});
registarSubsidiarias(app);
app.start();
sincronizarGrupo();
})();
