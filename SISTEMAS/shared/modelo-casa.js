/* =========================================================
   MODELO DE SUBSIDIÁRIA: CASA PARTILHADA
   Despesas comuns de uma casa (quem paga e a parte de cada
   membro), o acerto mensal entre membros e as dívidas entre
   eles. Cada membro tem o seu plano pessoal (modelo
   "Planeamento financeiro"), que lê daqui a sua parte nas
   despesas comuns. Nasceu das partilhas do Planeador.
   ========================================================= */
(function () {
'use strict';
SPAP.modelos = SPAP.modelos || {};

SPAP.modelos.casa = function (sub) {
const { eur, pct, date, esc, uid, today, r2, MES3, MESES, icon, ui, chart } = SPAP;
const CAIXA = sub.contaCaixa || 'CAIXA', OPER = sub.contaOperacional || 'OPERACIONAL', HOLD = sub.contaHolding || 'HOLDING';
let app;
const M = () => { const m = app.db.mod; ['membros', 'despesas', 'acertos'].forEach(k => { if (!Array.isArray(m[k])) m[k] = []; }); return m; };
const PERIODOS = [['mensal', 'Mensal', 1], ['trimestral', 'Trimestral', 3], ['semestral', 'Semestral', 6], ['anual', 'Anual', 12]];
const CATS = ['Habitação', 'Alimentação', 'Serviços (água/luz/gás)', 'Comunicações', 'Seguros', 'Transportes', 'Saúde', 'Educação', 'Lazer', 'Outros'];
const mensal = e => (+e.valor || 0) / ((PERIODOS.find(p => p[0] === e.periodicidade) || [0, 0, 1])[2]);
const ymHoje = () => today().slice(0, 7);
const vigente = (e, ym = ymHoje()) => (!e.inicio || ym >= e.inicio) && (!e.fim || ym <= e.fim);
const ativas = (ym = ymHoje()) => M().despesas.filter(e => e.ativo !== false && vigente(e, ym));
const fmtMes = k => k ? `${MESES[+k.slice(5, 7) - 1]} ${k.slice(0, 4)}` : '—';
const nomeM = id => (M().membros.find(x => x.id === id) || { nome: id || '—' }).nome;
const curto = id => nomeM(id).split(' ')[0];
const podeEditar = () => app.can('criar');
const audit = (a, t) => app.log(a, t);
const kpi = (rot, val, foot = '', cls = '', hero = false) => `<div class="card kpi ${hero ? 'hero' : ''}"><div class="lbl">${rot}</div><div class="val num ${cls}">${val}</div>${foot ? `<div class="foot">${foot}</div>` : ''}</div>`;

/* ---------- Contas: parte de cada um, quem adianta e o acerto mensal ---------- */
function resumoMes(ym = ymHoje()) {
  const ms = M().membros, out = Object.fromEntries(ms.map(x => [x.id, { parte: 0, paga: 0 }]));
  ativas(ym).forEach(e => { const v = mensal(e);
    Object.entries(e.partes || {}).forEach(([id, q]) => { if (out[id]) out[id].parte += v * (+q || 0); });
    if (out[e.pagaPor]) out[e.pagaPor].paga += v; });
  ms.forEach(x => { const o = out[x.id]; o.parte = r2(o.parte); o.paga = r2(o.paga); o.saldo = r2(o.paga - o.parte); });
  return out;
}
// transforma saldos (positivo = adianta mais do que a sua parte) em transferências entre membros
function transferencias(saldos) {
  const dev = Object.entries(saldos).filter(([, v]) => v < -0.004).map(([id, v]) => ({ id, v: -v })).sort((a, b) => b.v - a.v);
  const cre = Object.entries(saldos).filter(([, v]) => v > 0.004).map(([id, v]) => ({ id, v })).sort((a, b) => b.v - a.v);
  const t = [];
  for (const d of dev) for (const c of cre) { if (d.v < 0.005) break; const x = r2(Math.min(d.v, c.v)); if (x < 0.005) continue; t.push({ de: d.id, para: c.id, valor: x }); d.v -= x; c.v -= x; }
  return t;
}
const pendentes = () => M().acertos.filter(a => a.estado !== 'pago');

/* ---------- Painel ---------- */
function visao(v) {
  const m = M(), R = resumoMes(), tot = r2(ativas().reduce((s, e) => s + mensal(e), 0));
  const mensais = transferencias(Object.fromEntries(Object.entries(R).map(([id, o]) => [id, o.saldo])));
  const porPar = {}; pendentes().forEach(a => { const k = a.de + '>' + a.para; porPar[k] = r2((porPar[k] || 0) + (+a.valor || 0)); });
  v.innerHTML = `${podeEditar() ? `<div class="row" style="justify-content:flex-end;margin-bottom:10px"><button class="btn sm" id="imp">${icon('download')} Importar do Planeador</button></div>` : ''}
    ${!m.membros.length ? `<div class="alert info" style="margin-bottom:16px">${icon('users')}<div>Comece por indicar quem vive na casa em <a href="#/membros">Membros</a>, ou importe os dados do Planeador.</div></div>` : ''}
    <div class="grid g4">${kpi(`${icon('list')} Despesas comuns / mês`, eur(tot), `${ativas().length} despesas em vigor`, '', true)}
      ${m.membros.slice(0, 3).map(x => kpi(`${icon('users')} Parte de ${esc(curto(x.id))}`, eur(R[x.id].parte), `adianta ${eur(R[x.id].paga)} por mês`)).join('')}</div>
    <div class="grid g2" style="margin-top:16px">
      <div class="card"><div class="card-h"><h3>Acerto mensal</h3><span class="sub">${fmtMes(ymHoje())}</span></div>
        ${mensais.length ? mensais.map(t => `<div class="row between" style="padding:8px 0;border-bottom:1px solid var(--line)"><span><b>${esc(curto(t.de))}</b> transfere para <b>${esc(curto(t.para))}</b></span><b class="num">${eur(t.valor)}</b></div>`).join('')
          : '<div class="empty">Cada um paga exatamente a sua parte: não há acerto este mês.</div>'}
        <p class="faint" style="font-size:12px;margin:10px 0 0">Quem paga uma despesa comum adianta a parte dos outros. O acerto compensa a diferença.</p></div>
      <div class="card"><div class="card-h"><h3>Dívidas entre membros</h3><a class="btn sm" href="#/acertos">Ver todas</a></div>
        ${Object.keys(porPar).length ? Object.entries(porPar).map(([k, val]) => { const [de, para] = k.split('>'); return `<div class="row between" style="padding:8px 0;border-bottom:1px solid var(--line)"><span><b>${esc(curto(de))}</b> deve a <b>${esc(curto(para))}</b></span><b class="num">${eur(val)}</b></div>`; }).join('')
          : '<div class="empty">Sem dívidas pendentes entre membros.</div>'}</div></div>
    <div class="card" style="margin-top:16px"><div class="card-h"><h3>Despesas comuns por categoria</h3><span class="sub">equivalente mensal</span></div><div id="dn"></div></div>`;
  chart.donut(v.querySelector('#dn'), { items: CATS.map(c => ({ label: c, value: r2(ativas().filter(e => e.categoria === c).reduce((s, e) => s + mensal(e), 0)) })).filter(x => x.value > 0), center: eur(tot), sub: 'por mês' });
  const imp = v.querySelector('#imp'); if (imp) imp.onclick = importar;
}

/* ---------- Despesas comuns ---------- */
function editarDespesa(e0) {
  const m = M(), novo = !e0, ms = m.membros;
  if (!ms.length) { ui.toast('Indique primeiro os membros da casa', 'warn'); app.go('membros'); return; }
  const e = e0 || { categoria: 'Habitação', periodicidade: 'mensal', mes: +today().slice(5, 7), dia: 1, valor: 0, ativo: true, pagaPor: ms[0].id, partes: Object.fromEntries(ms.map(x => [x.id, r2(1 / ms.length)])) };
  ui.modal({ title: (novo ? 'Nova' : 'Editar') + ' despesa comum', wide: true, body: `<form class="form">
      <div class="fld"><label>Designação</label><input class="inp" name="nome" value="${esc(e.nome || '')}" placeholder="ex.: Renda"></div>
      <div class="fld"><label>Categoria</label><select class="inp" name="categoria">${CATS.map(c => `<option ${c === e.categoria ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
      <div class="fld"><label>Valor por cobrança (€)</label><input class="inp num" type="number" step="any" name="valor" value="${esc(e.valor)}"></div>
      <div class="fld"><label>Periodicidade</label><select class="inp" name="periodicidade">${PERIODOS.map(p => `<option value="${p[0]}" ${p[0] === e.periodicidade ? 'selected' : ''}>${p[1]}</option>`).join('')}</select></div>
      <div class="fld"><label>Quem paga</label><select class="inp" name="pagaPor">${ms.map(x => `<option value="${x.id}" ${x.id === e.pagaPor ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}</select><span class="hint">Quem tem a despesa em seu nome e adianta a parte dos outros.</span></div>
      <div class="fld"><label>Dia de cobrança</label><input class="inp num" type="number" min="1" max="28" name="dia" value="${esc(e.dia || 1)}"></div>
      <div class="fld"><label>Desde (mês)</label><input class="inp" type="month" name="inicio" value="${esc(e.inicio || '')}"></div>
      <div class="fld"><label>Até (mês)</label><input class="inp" type="month" name="fim" value="${esc(e.fim || '')}"><span class="hint">Opcional: despesas temporárias.</span></div>
      <div class="fld full"><label>Parte de cada um (%)</label><div class="row" style="gap:12px;flex-wrap:wrap">${ms.map(x => `<label style="display:flex;gap:6px;align-items:center">${esc(x.nome.split(' ')[0])} <input class="inp inp-sm num" type="number" step="any" min="0" max="100" data-parte="${x.id}" value="${r2((+((e.partes || {})[x.id]) || 0) * 100)}" style="width:80px"> %</label>`).join('')}</div></div>
      <div class="fld"><label>&nbsp;</label><label class="check"><input type="checkbox" name="variavel" ${e.variavel ? 'checked' : ''}> Valor variável (é uma média)</label></div>
      <div class="fld"><label>&nbsp;</label><label class="check"><input type="checkbox" name="ativo" ${e.ativo !== false ? 'checked' : ''}> Ativa</label></div></form>`,
    actions: [...(novo ? [] : [{ label: icon('trash') + 'Remover', kind: 'bad', onClick: async () => { if (!await ui.confirm('Remover', 'Remover esta despesa comum?', { danger: true, okLabel: 'Remover' })) return false; m.despesas = m.despesas.filter(x => x !== e0); audit('CASA_DESPESA_REMOVIDA', e0.nome); app.save(); app.refresh(); } }]),
      { label: 'Cancelar', kind: 'ghost' }, { label: 'Guardar', kind: 'primary', onClick: el => {
        const f = ui.formData(el), partes = {}; el.querySelectorAll('[data-parte]').forEach(i => { partes[i.dataset.parte] = r2((+i.value || 0) / 100 * 10000) / 10000; });
        const soma = Object.values(partes).reduce((a, b) => a + b, 0);
        if (!f.nome) { ui.toast('Indique a designação', 'warn'); return false; }
        if (!(+f.valor > 0)) { ui.toast('Indique o valor', 'warn'); return false; }
        if (Math.abs(soma - 1) > 0.0001) { ui.toast(`As partes somam ${pct(soma)}: devem somar 100%`, 'warn'); return false; }
        const x = e0 || { id: 'C' + uid() };
        Object.assign(x, { nome: f.nome, categoria: f.categoria, valor: r2(+f.valor), periodicidade: f.periodicidade, pagaPor: f.pagaPor, dia: Math.min(28, Math.max(1, parseInt(f.dia, 10) || 1)), inicio: f.inicio || '', fim: f.fim || '', variavel: !!f.variavel, ativo: !!f.ativo, partes });
        if (novo) m.despesas.push(x); audit('CASA_DESPESA', `${x.nome} · ${eur(x.valor)} · paga ${nomeM(x.pagaPor)}`); app.save(); app.refresh(); } }] });
}
function despesas(v) {
  const m = M(), ed = podeEditar(), ms = m.membros;
  v.innerHTML = `<div class="row between" style="margin-bottom:16px"><span class="muted">Despesas da casa divididas entre os membros. A parte de cada um entra no plano pessoal dessa pessoa.</span>${ed ? `<button class="btn primary" id="nd">${icon('plus')} Nova despesa comum</button>` : ''}</div>
    <div class="card flush"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Despesa</th><th>Periodicidade</th><th class="r">Valor</th><th class="r">Mensal</th><th>Quem paga</th>${ms.map(x => `<th class="r">${esc(x.nome.split(' ')[0])}</th>`).join('')}<th>Período</th></tr></thead><tbody>
    ${m.despesas.map(e => { const on = e.ativo !== false && vigente(e); return `<tr class="${ed ? 'click' : ''}" data-d="${e.id}" style="${on ? '' : 'opacity:.5'}"><td><b>${esc(e.nome)}</b><div class="faint" style="font-size:12px">${esc(e.categoria || '')}${e.variavel ? ' · variável' : ''}</div></td>
      <td>${esc((PERIODOS.find(p => p[0] === e.periodicidade) || [0, e.periodicidade])[1])}</td><td class="r num">${eur(e.valor)}</td><td class="r num">${eur(mensal(e))}</td><td>${esc(curto(e.pagaPor))}</td>
      ${ms.map(x => `<td class="r num">${+((e.partes || {})[x.id]) ? `${eur(mensal(e) * e.partes[x.id])} <span class="faint" style="font-size:11px">${pct(e.partes[x.id])}</span>` : '<span class="faint">—</span>'}</td>`).join('')}
      <td style="font-size:12px">${e.ativo === false ? 'inativa' : `${e.inicio ? 'desde ' + fmtMes(e.inicio) : ''} ${e.fim ? 'até ' + fmtMes(e.fim) : ''}`.trim() || 'sem fim'}${on || e.ativo === false ? '' : ` <span class="badge">${e.fim && e.fim < ymHoje() ? 'terminou' : 'futura'}</span>`}</td></tr>`; }).join('') || `<tr><td colspan="${6 + ms.length}" class="empty">Sem despesas comuns.</td></tr>`}</tbody></table></div></div>`;
  v.querySelectorAll('[data-d]').forEach(tr => tr.onclick = () => { if (ed) editarDespesa(m.despesas.find(x => x.id === tr.dataset.d)); });
  const nd = v.querySelector('#nd'); if (nd) nd.onclick = () => editarDespesa();
}

/* ---------- Membros ---------- */
function membros(v) {
  const m = M(), ed = app.can('admin'), pessoais = ((window.Grupo && Grupo.lista()) || []).filter(s => s.modelo === 'planeamento');
  v.innerHTML = `<div class="row between" style="margin-bottom:16px"><span class="muted">Quem vive na casa. Cada membro pode ter o seu plano pessoal (sistema do tipo Planeamento financeiro) ligado a esta casa.</span>${ed ? `<button class="btn primary" id="nm">${icon('plus')} Novo membro</button>` : ''}</div>
    <div class="card flush"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Membro</th><th>NIF</th><th>Plano pessoal</th><th class="r">Parte mensal</th></tr></thead><tbody>
    ${m.membros.map(x => { const s = pessoais.find(p => p.key === x.sistema); return `<tr class="${ed ? 'click' : ''}" data-m="${x.id}"><td><b>${esc(x.nome)}</b></td><td class="mono">${esc(x.nif || '—')}</td><td>${s ? `<a href="${Grupo.href(s)}">${esc(s.nome)}</a>` : '<span class="faint">—</span>'}</td><td class="r num">${eur(resumoMes()[x.id].parte)}</td></tr>`; }).join('') || '<tr><td colspan="4" class="empty">Sem membros.</td></tr>'}</tbody></table></div></div>
    <div class="alert info" style="margin-top:16px">${icon('alert')}<div>No plano pessoal de cada membro, escolha esta casa em <b>Simulador → Parâmetros do plano → Casa partilhada</b> para a sua parte contar como despesa fixa.</div></div>`;
  const ed1 = x0 => { const novo = !x0, x = x0 || {};
    ui.modal({ title: novo ? 'Novo membro' : 'Editar ' + esc(x.nome), body: `<form class="form"><div class="fld full"><label>Nome</label><input class="inp" name="nome" value="${esc(x.nome || '')}"></div>
      <div class="fld"><label>NIF</label><input class="inp mono" name="nif" value="${esc(x.nif || '')}"></div>
      <div class="fld"><label>Plano pessoal</label><select class="inp" name="sistema"><option value="">—</option>${pessoais.map(s => `<option value="${s.key}" ${s.key === x.sistema ? 'selected' : ''}>${esc(s.nome)}</option>`).join('')}</select></div></form>`,
      actions: [...(novo ? [] : [{ label: icon('trash') + 'Remover', kind: 'bad', onClick: async () => {
        if (m.despesas.some(e => e.pagaPor === x.id || +((e.partes || {})[x.id]) > 0) || m.acertos.some(a => a.de === x.id || a.para === x.id)) { ui.toast('Este membro tem despesas ou acertos: retire-o primeiro das despesas.', 'warn'); return false; }
        if (!await ui.confirm('Remover', 'Remover este membro?', { danger: true, okLabel: 'Remover' })) return false; m.membros = m.membros.filter(y => y !== x); app.save(); app.refresh(); } }]),
        { label: 'Cancelar', kind: 'ghost' }, { label: 'Guardar', kind: 'primary', onClick: el => { const f = ui.formData(el); if (!f.nome) { ui.toast('Indique o nome', 'warn'); return false; }
          Object.assign(x, f); if (novo) { x.id = 'M' + uid(); m.membros.push(x); } audit('CASA_MEMBRO', x.nome); app.save(); app.refresh(); } }] }); };
  v.querySelectorAll('[data-m]').forEach(tr => tr.onclick = () => { if (ed) ed1(m.membros.find(x => x.id === tr.dataset.m)); });
  const nm = v.querySelector('#nm'); if (nm) nm.onclick = () => ed1();
}

/* ---------- Dívidas entre membros (acertos) ---------- */
function acertos(v) {
  const m = M(), ed = podeEditar(), ms = m.membros;
  v.innerHTML = `<div class="row between" style="margin-bottom:16px"><span class="muted">Valores que um membro deve a outro (por exemplo, a parte de uma compra ou de um cartão). Marque como pago quando o acerto for feito.</span>${ed ? `<button class="btn primary" id="na">${icon('plus')} Nova dívida entre membros</button>` : ''}</div>
    <div class="card flush"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Data</th><th>Descrição</th><th>Quem deve</th><th>A quem</th><th class="r">Valor</th><th>Estado</th><th></th></tr></thead><tbody>
    ${m.acertos.slice().sort((a, b) => String(b.data).localeCompare(String(a.data))).map(a => `<tr><td>${date(a.data)}</td><td>${esc(a.descricao || '')}${a.notas ? `<div class="faint" style="font-size:12px">${esc(a.notas)}</div>` : ''}</td><td>${esc(curto(a.de))}</td><td>${esc(curto(a.para))}</td><td class="r num">${eur(a.valor)}</td>
      <td>${a.estado === 'pago' ? `<span class="badge ok">pago ${a.pagoEm ? date(a.pagoEm) : ''}</span>` : '<span class="badge warn">pendente</span>'}</td>
      <td class="r">${ed && a.estado !== 'pago' ? `<button class="btn sm" data-p="${a.id}">Marcar pago</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="7" class="empty">Sem dívidas entre membros.</td></tr>'}</tbody></table></div></div>`;
  v.querySelectorAll('[data-p]').forEach(b => b.onclick = async () => { const a = m.acertos.find(x => x.id === b.dataset.p);
    if (!await ui.confirm('Marcar como pago', `${esc(curto(a.de))} pagou ${eur(a.valor)} a ${esc(curto(a.para))}?`, { okLabel: 'Marcar pago' })) return;
    a.estado = 'pago'; a.pagoEm = today(); audit('CASA_ACERTO_PAGO', `${a.descricao} · ${eur(a.valor)}`); app.save(); app.refresh(); });
  const na = v.querySelector('#na'); if (na) na.onclick = () => {
    if (ms.length < 2) { ui.toast('São precisos pelo menos dois membros', 'warn'); return; }
    const opt = sel => ms.map(x => `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${esc(x.nome)}</option>`).join('');
    ui.modal({ title: 'Nova dívida entre membros', body: `<form class="form"><div class="fld full"><label>Descrição</label><input class="inp" name="descricao" placeholder="ex.: Parte da compra do frigorífico"></div>
      <div class="fld"><label>Quem deve</label><select class="inp" name="de">${opt(ms[1].id)}</select></div><div class="fld"><label>A quem</label><select class="inp" name="para">${opt(ms[0].id)}</select></div>
      <div class="fld"><label>Valor (€)</label><input class="inp num" type="number" step="any" name="valor"></div><div class="fld"><label>Data</label><input class="inp" type="date" name="data" value="${today()}"></div>
      <div class="fld full"><label>Notas</label><input class="inp" name="notas"></div></form>`,
      actions: [{ label: 'Cancelar', kind: 'ghost' }, { label: 'Guardar', kind: 'primary', onClick: el => { const f = ui.formData(el);
        if (!f.descricao || !(+f.valor > 0)) { ui.toast('Indique a descrição e o valor', 'warn'); return false; } if (f.de === f.para) { ui.toast('Escolha duas pessoas diferentes', 'warn'); return false; }
        m.acertos.push({ id: 'A' + uid(), descricao: f.descricao, de: f.de, para: f.para, valor: r2(+f.valor), data: f.data || today(), notas: f.notas, estado: 'pendente' });
        audit('CASA_ACERTO', `${f.descricao} · ${eur(f.valor)}`); app.save(); app.refresh(); } }] }); };
}

/* ---------- Importação do Planeador (ficheiro da casa) ---------- */
function importar() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return; let j;
    try { j = JSON.parse(await f.text()); } catch (e) { ui.toast('O ficheiro não é um ficheiro de importação válido.', 'bad'); return; }
    if (!j || j.formato !== 'planeador-bxb') { ui.toast('Este ficheiro não foi gerado a partir do Planeador Financeiro.', 'bad'); return; }
    if (j.perfil !== 'casa') { ui.toast('Este ficheiro é de um plano pessoal: importe-o num sistema do tipo "Planeamento financeiro".', 'warn'); return; }
    const m = M(), novosM = (j.membros || []).filter(x => !m.membros.some(y => y.id === x.id)), novasD = (j.despesas || []).filter(x => !m.despesas.some(y => y.origem === x.origem)),
      novosA = (j.acertos || []).filter(x => !m.acertos.some(y => y.origem === x.origem));
    ui.modal({ title: 'Importar do Planeador Financeiro', sub: esc(f.name), body: `<div class="kv"><div><span>Membros</span><b>${novosM.length} de ${(j.membros || []).length}</b></div><div><span>Despesas comuns</span><b>${novasD.length} de ${(j.despesas || []).length}</b></div>
      <div><span>Dívidas entre membros</span><b>${novosA.length} de ${(j.acertos || []).length}</b></div></div><p class="muted" style="font-size:13px;margin:14px 0 0">O que já tinha sido importado antes não é repetido.</p>`,
      actions: [{ label: 'Cancelar', kind: 'ghost' }, { label: icon('download') + 'Importar', kind: 'primary', onClick: () => {
        novosM.forEach(x => m.membros.push(Object.assign({}, x)));
        novasD.forEach(x => m.despesas.push(Object.assign({ id: 'C' + uid(), ativo: true }, x)));
        novosA.forEach(x => m.acertos.push(Object.assign({ id: 'A' + uid(), estado: 'pendente' }, x)));
        // liga cada membro ao seu plano pessoal, se já existir no grupo com o nome indicado
        ((window.Grupo && Grupo.lista()) || []).filter(s => s.modelo === 'planeamento').forEach(s => m.membros.forEach(x => { if (!x.sistema && x.planoPessoal && s.nome.toLowerCase() === x.planoPessoal.toLowerCase()) x.sistema = s.key; }));
        audit('CASA_IMPORTACAO', `Planeador Financeiro (${f.name}): ${novosM.length} membros, ${novasD.length} despesas, ${novosA.length} dívidas entre membros`);
        app.save(); ui.toast('Dados importados', 'ok'); app.refresh(); } }] });
  };
  inp.click();
}

function seed(db, a) {
  app = a; db.settings.duplaAcima = 1000;
  (sub.utilizadores && sub.utilizadores.length ? sub.utilizadores : [{ id: 'u_bruno', nome: 'Bruno Alexandre Elias Monteiro', username: 'bruno', role: 'ADMIN', limite: 0 }])
    .forEach(u => db.users.push({ id: u.id, nome: u.nome, username: u.username, role: u.role, limite: u.role === 'ADMIN' ? 0 : Math.max(+u.limite || 0, 5000), ativo: true, pinHash: null }));
  const s = sub.sigla || 'CS';
  db.contas.push(
    { id: CAIXA, codigo: s + '-CX-001', nome: 'Caixa comum ' + sub.nome, tipo: 'INTERNA', categoria: 'TESOURARIA', saldoInicial: 0, ativo: true },
    { id: OPER, codigo: s + '-OP-002', nome: 'Reserva da casa ' + sub.nome, tipo: 'INTERNA', categoria: 'TESOURARIA', saldoInicial: 0, ativo: true },
    { id: HOLD, codigo: '004_BXB_INVESTIMENTOS', nome: 'BXB Investimentos (holding)', tipo: 'INTERNA', categoria: 'SÓCIO', nif: '518300323', saldoInicial: 0, ativo: true });
  db.mod = { membros: [], despesas: [], acertos: [] };
}

return {
  seed, alcadaPadrao: 5000, tagline: sub.setor || 'Casa partilhada', home: 'visao', logo: `<span style="font-size:13px">${esc(sub.sigla || '')}</span>`,
  heroTitle: 'As contas da casa, divididas com justiça.', heroText: 'Despesas comuns, a parte de cada um e quem deve a quem — com pagamentos autorizados e assinados.',
  modules: [
    { id: 'visao', label: 'Painel', title: 'Painel da casa', icon: 'home', render: visao },
    { id: 'despesas', label: 'Despesas comuns', title: 'Despesas comuns', icon: 'list', render: despesas },
    { id: 'acertos', label: 'Quem deve a quem', title: 'Dívidas entre membros', icon: 'swap', render: acertos },
    { id: 'membros', label: 'Membros', title: 'Membros da casa', icon: 'users', render: membros },
  ],
  registar(a) { app = a; },
};
};
})();
