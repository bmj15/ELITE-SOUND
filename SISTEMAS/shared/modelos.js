/* =========================================================
   MODELOS DE SUBSIDIÁRIA
   Cada subsidiária criada pela holding BXB usa um modelo de
   sistema. O modelo "servicos" nasceu do sistema da Elite Sound.
   ========================================================= */
(function () {
'use strict';
SPAP.modelos = SPAP.modelos || {};

/* ---------- Modelo: Comércio e serviços ---------- */
SPAP.modelos.servicos = function (sub) {
const { eur, pct, date, esc, uid, today, r2, MES3, MESES, icon, ui, chart } = SPAP;
const CAIXA = sub.contaCaixa || 'CAIXA', OPER = sub.contaOperacional || 'OPERACIONAL', HOLD = sub.contaHolding || 'HOLDING', NOME = sub.nome;
let app;
const M = () => app.db.mod;
const sum = (list, f) => r2(list.reduce((s, x) => s + (typeof f === 'function' ? f(x) : +x[f] || 0), 0));
const mesKey = (ano, m) => `${ano}-${String(m).padStart(2, '0')}`;

/* ---------- Cálculo de uma venda (taxas fixadas no momento do registo) ---------- */
function calcVenda(v) {
  const m = M(); const vd = m.vendedores.find(x => x.id === v.vendedor) || {};
  const total = r2((+v.qtd || 0) * (+v.precoUnit || 0));
  const base = r2(total * (1 - (+v.desconto || 0)));
  const comissaoPct = v.comissaoPct != null ? +v.comissaoPct : (vd.comissao != null ? +vd.comissao : m.params.comissao);
  const fatorIva = v.fatorIva != null ? +v.fatorIva : (vd.ivaComissao !== false ? 1 + m.params.iva : 1);
  const comissao = r2(base * comissaoPct * fatorIva);
  return Object.assign(v, { total, base, comissaoPct, fatorIva, comissao, lucro: r2(base - comissao) });
}
function lancarVenda(v) {
  app.estornarRef('venda:' + v.id);
  if (v.base > 0) app.lancar({ conta: CAIXA, valor: v.base, data: v.data, tipo: 'RECEITA', ref: 'venda:' + v.id,
    descricao: `Venda · ${v.servicoNome} × ${v.qtd} · ${nomeCliente(v.cliente)}` });
}
const nomeVend = id => (M().vendedores.find(x => x.id === id) || { nome: id }).nome;
const nomeCliente = id => (M().clientes.find(x => x.id === id) || { nome: id || '—' }).nome;

/* ---------- Dados iniciais da Elite Sound (migrados de ELITE SOUND.xlsx) ---------- */
function seedElite(db) {
  db.settings.duplaAcima = 500;
  db.users.push(
    { id: 'u_bruno', nome: 'Bruno Alexandre Elias Monteiro', username: 'bruno', role: 'ADMIN', limite: 0, ativo: true, pinHash: null },
    { id: 'u_beatriz', nome: 'Beatriz Elias Monteiro', username: 'beatriz', role: 'APROVADOR', limite: 5000, ativo: true, pinHash: null });
  db.contas.push(
    { id: CAIXA, codigo: 'ES-CX-001', nome: 'Caixa Elite Sound', tipo: 'INTERNA', categoria: 'TESOURARIA', saldoInicial: 0, ativo: true },
    { id: 'ES_BANCO', codigo: 'ES-OP-002', nome: 'Conta operacional Elite Sound', tipo: 'INTERNA', categoria: 'TESOURARIA', saldoInicial: 0, ativo: true },
    { id: 'CR', codigo: 'CR', nome: 'Capital Reservado', tipo: 'INTERNA', categoria: 'SÓCIO / RESERVA', saldoInicial: 0, ativo: true },
    { id: 'BXB_INV', codigo: '004_BXB_INVESTIMENTOS', nome: 'BXB Investimentos (sócio)', tipo: 'INTERNA', saldoInicial: 0, categoria: 'SÓCIO', nif: '518300323', ativo: true },
    { id: 'V_BRUNO', codigo: 'V-001', nome: 'Bruno Alexandre Elias Monteiro', tipo: 'INTERNA', saldoInicial: 0, categoria: 'VENDEDOR', nif: '256451419', ativo: true },
    { id: 'V_BEATRIZ', codigo: 'V-002', nome: 'Beatriz Elias Monteiro', tipo: 'INTERNA', saldoInicial: 0, categoria: 'VENDEDOR', nif: '256451656', ativo: true });
  db.categorias = ['PAGAMENTO DE COMISSÕES', 'DISTRIBUIÇÃO DE RESULTADOS', 'AQUISIÇÃO DE EQUIPAMENTO', 'MANUTENÇÃO E REPARAÇÃO', 'TRANSPORTE E LOGÍSTICA',
    'PAGAMENTO DE ENCARGOS E TAXAS', 'MARKETING E PUBLICIDADE', 'TRANSFERÊNCIA INTERNA', 'REEMBOLSO DE DESPESAS', 'ENTRADA DE FUNDOS', 'OUTROS'];
  db.mod = {
    params: { iva: 0.23, comissao: 0.2135, taxaProcessamento: 0.05 },
    servicos: [
      ['ALUGUER SOM / HORA', 14, 'hora'], ['ALUGUER ALTIFALANTE PS / HORA', 10, 'hora'], ['ALUGUER ALTIFALANTE AT / HORA', 10, 'hora'],
      ['ALUGUER SUBWOOFER AT / HORA (4)', 10, 'hora'], ['ALUGUER SUBWOOFER AT / HORA', 11, 'hora'], ['ALUGUER SOM / DIA', 120, 'dia'],
      ['ALUGUER ALTIFALANTE PS / DIA', 60, 'dia'], ['ALUGUER ALTIFALANTE AT / DIA', 60, 'dia'],
    ].map(([nome, preco, unidade], i) => ({ id: 'S' + (i + 1), nome, preco, unidade, ativo: true })),
    clientes: [
      { id: 'C1', nome: 'CONSUMIDOR FINAL', nif: '', desconto: 0 },
      { id: 'C2', nome: 'DESCONTO F009-1', nif: '', desconto: 0.091 },
      { id: 'C3', nome: 'DESCONTO F005-0', nif: '', desconto: 0.5 }],
    vendedores: [
      { id: 'VB', nome: 'Bruno Alexandre Elias Monteiro', nif: '256451419', regime: 'ISENTO', comissao: 0.2135, ivaComissao: true, conta: 'V_BRUNO', ativo: true },
      { id: 'VE', nome: 'Beatriz Elias Monteiro', nif: '256451656', regime: 'ISENTO', comissao: 0.2135, ivaComissao: true, conta: 'V_BEATRIZ', ativo: true }],
    socios: [
      { id: 'CR', nome: 'Capital Reservado', quota: 0.2, conta: 'CR' },
      { id: 'BXB', nome: 'BXB Investimentos', nif: '518300323', quota: 0.8, conta: 'BXB_INV' }],
    vendas: [],
  };
  const sv = n => db.mod.servicos.find(s => s.nome === n);
  [['2024-07-29', 'VB', 'C1', 'ALUGUER ALTIFALANTE PS / HORA', 2], ['2024-08-11', 'VE', 'C1', 'ALUGUER SUBWOOFER AT / HORA', 4],
   ['2024-08-17', 'VE', 'C1', 'ALUGUER ALTIFALANTE PS / HORA', 3], ['2024-09-08', 'VB', 'C1', 'ALUGUER ALTIFALANTE PS / HORA', 7],
   ['2024-12-31', 'VB', 'C3', 'ALUGUER SOM / DIA', 1]].forEach(([data, vendedor, cliente, s, qtd]) => {
    const c = db.mod.clientes.find(x => x.id === cliente);
    const v = calcVenda({ id: uid(), data, vendedor, cliente, servico: sv(s).id, servicoNome: s, qtd, precoUnit: sv(s).preco, desconto: c.desconto, notas: 'Migrado da folha de cálculo', criadoEm: new Date().toISOString() });
    db.mod.vendas.push(v); lancarVenda(v);
  });
}

/* ---------- Dados iniciais de uma subsidiária nova ---------- */
function seedNova(db) {
  db.settings.duplaAcima = 500;
  (sub.utilizadores && sub.utilizadores.length ? sub.utilizadores : [{ id: 'u_bruno', nome: 'Bruno Alexandre Elias Monteiro', username: 'bruno', role: 'ADMIN', limite: 0 }])
    .forEach(u => db.users.push({ id: u.id, nome: u.nome, username: u.username, role: u.role, limite: u.role === 'ADMIN' ? 0 : Math.max(+u.limite || 0, 5000), ativo: true, pinHash: null }));
  const s = sub.sigla || 'SB', part = Math.min(1, Math.max(0, +sub.participacao || 0));
  db.contas.push(
    { id: CAIXA, codigo: s + '-CX-001', nome: 'Caixa ' + NOME, tipo: 'INTERNA', categoria: 'TESOURARIA', saldoInicial: 0, ativo: true },
    { id: OPER, codigo: s + '-OP-002', nome: 'Conta operacional ' + NOME, tipo: 'INTERNA', categoria: 'TESOURARIA', saldoInicial: 0, ativo: true },
    { id: HOLD, codigo: '004_BXB_INVESTIMENTOS', nome: 'BXB Investimentos (holding)', tipo: 'INTERNA', categoria: 'SÓCIO', nif: '518300323', saldoInicial: 0, ativo: true });
  if (part < 1) db.contas.push({ id: 'CR', codigo: 'CR', nome: 'Capital Reservado', tipo: 'INTERNA', categoria: 'SÓCIO / RESERVA', saldoInicial: 0, ativo: true });
  db.categorias = ['PAGAMENTO DE COMISSÕES', 'DISTRIBUIÇÃO DE RESULTADOS', 'AQUISIÇÃO DE BENS E SERVIÇOS', 'PAGAMENTO DE ENCARGOS E TAXAS', 'MARKETING E PUBLICIDADE',
    'TRANSFERÊNCIA INTERNA', 'REEMBOLSO DE DESPESAS', 'ENTRADA DE FUNDOS', 'OUTROS'];
  db.mod = { params: { iva: 0.23, comissao: 0.10, taxaProcessamento: 0 }, servicos: [], clientes: [{ id: 'C1', nome: 'CONSUMIDOR FINAL', nif: '', desconto: 0 }], vendedores: [],
    socios: [{ id: 'BXB', nome: 'BXB Investimentos', nif: '518300323', quota: part, conta: HOLD }].concat(part < 1 ? [{ id: 'CR', nome: 'Capital Reservado', quota: r2(1 - part), conta: 'CR' }] : []), vendas: [] };
}
function seed(db, a) { app = a; if (sub.dadosIniciais === 'elite') seedElite(db); else seedNova(db); }

/* ---------- Seletor de ano ---------- */
function anos() { const s = new Set(M().vendas.map(v => v.data.slice(0, 4))); s.add(today().slice(0, 4)); return [...s].sort(); }
function anoAtual() {
  let a = sessionStorage.getItem(sub.key + ':ano');
  const list = anos();
  if (!a || !list.includes(a)) { const cur = today().slice(0, 4); a = M().vendas.some(v => v.data.startsWith(cur)) ? cur : list.filter(y => M().vendas.some(v => v.data.startsWith(y))).pop() || cur; }
  return a;
}
const anoSel = a => `<select class="inp inp-sm" id="ano">${anos().map(y => `<option ${y === a ? 'selected' : ''}>${y}</option>`).join('')}</select>`;
const bindAno = v => { const s = v.querySelector('#ano'); if (s) s.onchange = () => { sessionStorage.setItem(sub.key + ':ano', s.value); app.refresh(); }; };
const porMes = (list, f) => { const a = Array(12).fill(0); list.forEach(x => a[+x.data.slice(5, 7) - 1] += f(x)); return a.map(r2); };

/* =========================================================
   VISÃO GERAL
   ========================================================= */
function visao(v) {
  const ano = anoAtual(); const vs = M().vendas.filter(x => x.data.startsWith(ano));
  const fat = sum(vs, 'base'), com = sum(vs, 'comissao'), luc = sum(vs, 'lucro');
  const comPagas = sum(app.db.pedidos.filter(p => p.estado === 'EXECUTADO' && p.origem && p.origem.key.startsWith('com:') && p.origem.key.includes(':' + ano + '-')), 'valor');
  v.innerHTML = `<div class="row between" style="margin-bottom:16px"><div class="row"><span class="eq" style="color:var(--accent2)"><i></i><i></i><i></i><i></i></span><span class="muted">Exercício</span>${anoSel(ano)}</div>
    <div class="row"><button class="btn" id="nv">${icon('plus')} Registar venda</button></div></div>
    <div class="grid g4">
      <div class="card kpi hero"><div class="lbl">${icon('speaker')} Faturação ${ano}</div><div class="val num">${eur(fat)}</div><div class="foot">${vs.length} serviços · ${sum(vs, 'qtd')} unidades</div></div>
      <div class="card kpi"><div class="lbl">${icon('percent')} Comissões revendedores</div><div class="val num">${eur(com)}</div><div class="foot">${eur(comPagas)} pagas via SPAP</div></div>
      <div class="card kpi"><div class="lbl">${icon('coins')} Lucro ${esc(NOME)}</div><div class="val num">${eur(luc)}</div><div class="foot">Margem ${pct(fat ? luc / fat : 0)}</div></div>
      <div class="card kpi"><div class="lbl">${icon('wallet')} Saldo em caixa</div><div class="val num">${eur(app.saldo(CAIXA))}</div><div class="foot">Disponível ${eur(app.disponivel(CAIXA))}</div></div></div>
    <div class="grid g3" style="margin-top:16px">
      <div class="card span2"><div class="card-h"><h3>Faturação, comissões e lucro por mês</h3><span class="sub">${ano}</span></div><div id="c1"></div></div>
      <div class="card"><div class="card-h"><h3>Faturação por serviço</h3></div><div id="c2"></div></div></div>
    <div class="card flush" style="margin-top:16px"><div class="card-h"><h3>Comissões revendedores</h3><span class="sub">vendas e comissões por mês</span></div><div class="tbl-wrap" id="t1"></div></div>
    <div class="grid g2" style="margin-top:16px">
      <div class="card flush"><div class="card-h"><h3>Comissão sócios</h3><a class="btn sm" href="#/distribuicao">Distribuir</a></div><div class="tbl-wrap" id="t2"></div></div>
      <div class="card flush"><div class="card-h"><h3>Melhores clientes</h3></div><div class="tbl-wrap" id="t3"></div></div></div>`;
  bindAno(v); v.querySelector('#nv').onclick = () => editarVenda();
  chart.bars(v.querySelector('#c1'), { labels: MES3, series: [
    { name: 'Faturação', values: porMes(vs, x => x.base) }, { name: 'Comissões', values: porMes(vs, x => x.comissao), color: 'var(--accent2)' }, { name: 'Lucro', values: porMes(vs, x => x.lucro), color: 'var(--ok)' }] });
  const porServ = {}; vs.forEach(x => porServ[x.servicoNome] = (porServ[x.servicoNome] || 0) + x.base);
  chart.donut(v.querySelector('#c2'), { center: eur(fat).replace(/,\d+/, ''), sub: 'faturação', items: Object.entries(porServ).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label: label.replace('ALUGUER ', ''), value: r2(value) })) });
  const th = `<thead><tr><th></th><th></th>${MES3.map(m => `<th class="r">${m}</th>`).join('')}<th class="r">Total</th></tr></thead>`;
  const linha = (a, b, vals, strong) => `<tr><td>${a}</td><td class="muted">${b}</td>${vals.map(x => `<td class="r num ${x ? '' : 'faint'}">${x ? eur(x) : '–'}</td>`).join('')}<td class="r num" style="font-weight:${strong ? 800 : 700}">${eur(sum(vals, x => x))}</td></tr>`;
  v.querySelector('#t1').innerHTML = `<table class="tbl">${th}<tbody>${M().vendedores.map(vd => { const l = vs.filter(x => x.vendedor === vd.id);
    return linha(`<b>${esc(vd.nome)}</b>`, 'Vendas', porMes(l, x => x.base)) + linha('', 'Comissões', porMes(l, x => x.comissao)); }).join('')}</tbody>
    <tfoot>${linha('LUCRO ' + esc(NOME.toUpperCase()), 'Subtotal', porMes(vs, x => x.lucro), true).replace('<tr>', '<tr>')}</tfoot></table>`;
  const lucM = porMes(vs, x => x.lucro);
  v.querySelector('#t2').innerHTML = `<table class="tbl"><thead><tr><th>Sócio</th><th class="r">Quota</th><th class="r">Atribuído ${ano}</th><th class="r">Distribuído</th></tr></thead><tbody>
    ${M().socios.map(s => { const pago = sum(app.db.pedidos.filter(p => p.estado === 'EXECUTADO' && p.origem && p.origem.key.startsWith(`dist:${s.id}:${ano}`)), 'valor');
      return `<tr><td><b>${esc(s.nome)}</b><div class="faint mono" style="font-size:11.5px">${esc(s.nif || s.id)}</div></td><td class="r">${pct(s.quota)}</td><td class="r num">${eur(r2(sum(lucM, x => x) * s.quota))}</td><td class="r num">${eur(pago)}</td></tr>`; }).join('')}</tbody></table>`;
  const porCli = {}; vs.forEach(x => { porCli[x.cliente] = porCli[x.cliente] || { n: 0, v: 0 }; porCli[x.cliente].n++; porCli[x.cliente].v += x.base; });
  const top = Object.entries(porCli).sort((a, b) => b[1].v - a[1].v).slice(0, 6);
  v.querySelector('#t3').innerHTML = top.length ? `<table class="tbl"><thead><tr><th>Cliente</th><th class="r">Serviços</th><th class="r">Faturação</th></tr></thead><tbody>${top.map(([c, o]) => `<tr><td><b>${esc(nomeCliente(c))}</b></td><td class="r">${o.n}</td><td class="r num">${eur(o.v)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Sem vendas neste exercício.</div>';
}

/* =========================================================
   VENDAS
   ========================================================= */
function editarVenda(orig) {
  if (!orig && (!M().servicos.some(s => s.ativo !== false) || !M().vendedores.some(x => x.ativo !== false))) {
    ui.toast(`Antes de registar vendas, adiciona pelo menos um <b>serviço</b> e um <b>vendedor</b> em Catálogo e cadastro.`, 'warn');
    sessionStorage.setItem(sub.key + ':cat', M().servicos.length ? 'vend' : 'serv'); app.go('catalogo'); return;
  }
  const m = M(); const novo = !orig; const v0 = orig || { data: today(), vendedor: (m.vendedores.find(x => x.nome === app.user.nome) || m.vendedores[0] || {}).id, cliente: 'C1', qtd: 1 };
  const opt = (list, sel, lbl = x => x.nome) => list.map(x => `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${esc(lbl(x))}</option>`).join('');
  const md = ui.modal({ title: novo ? 'Registar venda' : 'Editar venda', sub: `A receita entra automaticamente na ${esc(app.nomeConta(CAIXA))}. A comissão fica a aguardar pedido de pagamento.`, wide: true,
    body: `<form class="form">
      <div class="fld"><label>Data</label><input class="inp" type="date" name="data" value="${v0.data}"></div>
      <div class="fld"><label>Vendedor</label><select class="inp" name="vendedor">${opt(m.vendedores.filter(x => x.ativo !== false || x.id === v0.vendedor), v0.vendedor)}</select></div>
      <div class="fld"><label>Cliente</label><select class="inp" name="cliente">${opt(m.clientes, v0.cliente)}</select></div>
      <div class="fld"><label>Serviço</label><select class="inp" name="servico">${opt(m.servicos.filter(s => s.ativo !== false || s.id === v0.servico), v0.servico, s => `${s.nome} · ${eur(s.preco)}`)}</select></div>
      <div class="fld"><label>Quantidade</label><input class="inp num" type="number" step="0.5" min="0" name="qtd" value="${v0.qtd}"></div>
      <div class="fld"><label>Preço unitário (€)</label><input class="inp num" type="number" step="0.01" min="0" name="precoUnit" value="${v0.precoUnit ?? ''}"></div>
      <div class="fld"><label>Desconto (%)</label><input class="inp num" type="number" step="0.01" min="0" max="100" name="desconto" value="${v0.desconto != null ? r2(v0.desconto * 100) : ''}"><span class="hint">Por defeito, o desconto do cliente.</span></div>
      <div class="fld"><label>Notas</label><input class="inp" name="notas" value="${esc(v0.notas || '')}"></div>
      <div class="full calc" id="calc"></div></form>`,
    actions: [
      ...(!novo && app.can('admin') ? [{ label: icon('trash') + 'Eliminar', kind: 'bad', onClick: async () => {
        if (!await ui.confirm('Eliminar venda', 'A receita será estornada da caixa. Esta ação fica registada na auditoria.', { okLabel: 'Eliminar', danger: true })) return false;
        try { app.estornarRef('venda:' + orig.id); } catch (e) { ui.toast(esc(e.message), 'bad'); return false; }
        m.vendas = m.vendas.filter(x => x.id !== orig.id);
        app.log('VENDA_ELIMINADA', `${orig.data} · ${orig.servicoNome} · ${eur(orig.base)}`); app.save(); app.refresh(); } }] : []),
      { label: 'Cancelar', kind: 'ghost' },
      { label: novo ? 'Registar venda' : 'Guardar', kind: 'primary', onClick: el => {
        const v = read(el); if (!v.qtd || !v.precoUnit) { ui.toast('Indique quantidade e preço', 'warn'); return false; }
        if (app.dataFechada(v.data) || (!novo && app.dataFechada(orig.data))) { ui.toast(`Período fechado até ${date(app.ultimoFecho().data)} — não é possível registar ou alterar vendas nessa data`, 'bad'); return false; }
        if (novo) { v.id = uid(); v.criadoEm = new Date().toISOString(); v.criadoPor = app.user.id; m.vendas.push(v); }
        else { Object.assign(orig, v); }
        const tgt = novo ? v : orig; lancarVenda(tgt);
        app.log(novo ? 'VENDA_REGISTADA' : 'VENDA_ALTERADA', `${tgt.data} · ${nomeVend(tgt.vendedor)} · ${tgt.servicoNome} × ${tgt.qtd} · ${eur(tgt.base)} · comissão ${eur(tgt.comissao)}`);
        app.save(); ui.toast(`Venda registada · ${eur(tgt.base)}`, 'ok'); app.refresh(); } }] });
  const el = md.el; let touchedPreco = !novo, touchedDesc = !novo;
  const read = el => { const f = ui.formData(el); const s = m.servicos.find(x => x.id === f.servico);
    return calcVenda({ data: f.data, vendedor: f.vendedor, cliente: f.cliente, servico: f.servico, servicoNome: s ? s.nome : '', qtd: +f.qtd || 0, precoUnit: +f.precoUnit || 0, desconto: (+f.desconto || 0) / 100, notas: f.notas,
      comissaoPct: novo ? null : orig.comissaoPct, fatorIva: novo ? null : orig.fatorIva }); };
  const upd = (e) => {
    const n = e && e.target.name;
    if (n === 'precoUnit') touchedPreco = true; if (n === 'desconto') touchedDesc = true;
    const f = ui.formData(el);
    if (!touchedPreco || n === 'servico') { const s = m.servicos.find(x => x.id === f.servico); if (s) el.querySelector('[name=precoUnit]').value = s.preco; touchedPreco = false; }
    if (!touchedDesc || n === 'cliente') { const c = m.clientes.find(x => x.id === f.cliente); if (c) el.querySelector('[name=desconto]').value = r2(c.desconto * 100); touchedDesc = false; }
    const v = read(el);
    el.querySelector('#calc').innerHTML = `<div><span>Preço</span><b class="num">${eur(v.total)}</b></div><div><span>Preço s/ desconto</span><b class="num">${eur(v.base)}</b></div>
      <div><span>Comissão ${pct(v.comissaoPct)}${v.fatorIva > 1 ? ' + IVA' : ''}</span><b class="num">${eur(v.comissao)}</b></div><div><span>Lucro</span><b class="num pos">${eur(v.lucro)}</b></div>`;
  };
  el.querySelectorAll('input,select').forEach(i => i.addEventListener('input', upd)); upd();
}

function vendas(v) {
  const ano = anoAtual(); let mes = '', vend = '', q = '';
  v.innerHTML = `<div class="row between" style="margin-bottom:14px"><div class="row">${anoSel(ano)}
    <select class="inp inp-sm" id="mes"><option value="">Todos os meses</option>${MESES.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('')}</select>
    <select class="inp inp-sm" id="vd"><option value="">Todos os vendedores</option>${M().vendedores.map(x => `<option value="${x.id}">${esc(x.nome)}</option>`).join('')}</select>
    <input class="inp inp-sm" id="q" placeholder="Pesquisar…"></div>
    <div class="row"><button class="btn" id="csv">${icon('download')} CSV</button><button class="btn primary" id="nv">${icon('plus')} Registar venda</button></div></div>
    <div class="grid g4" id="k" style="margin-bottom:16px"></div><div class="card flush" id="lst"></div>`;
  bindAno(v);
  const draw = () => {
    const ql = q.toLowerCase();
    const list = M().vendas.filter(x => x.data.startsWith(ano) && (!mes || +x.data.slice(5, 7) === +mes) && (!vend || x.vendedor === vend)
      && (!ql || (x.servicoNome + nomeCliente(x.cliente) + nomeVend(x.vendedor) + (x.notas || '')).toLowerCase().includes(ql))).sort((a, b) => b.data.localeCompare(a.data));
    v._list = list;
    v.querySelector('#k').innerHTML = [['Serviços', list.length, ''], ['Faturação', eur(sum(list, 'base')), 'hero'], ['Comissões', eur(sum(list, 'comissao')), ''], ['Lucro', eur(sum(list, 'lucro')), '']]
      .map(([l, val, c]) => `<div class="card kpi ${c}"><div class="lbl">${l}</div><div class="val num">${val}</div></div>`).join('');
    v.querySelector('#lst').innerHTML = list.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Data</th><th>Vendedor</th><th>Cliente</th><th>Serviço</th><th class="r">Qtd.</th><th class="r">Preço</th><th class="r">Desc.</th><th class="r">Preço s/IVA</th><th class="r">% Com.</th><th class="r">Comissão</th><th class="r">Lucro</th></tr></thead><tbody>
      ${list.map(x => `<tr class="click" data-v="${x.id}"><td>${date(x.data)}</td><td>${esc(nomeVend(x.vendedor))}</td><td>${esc(nomeCliente(x.cliente))}</td><td><b style="font-size:12.5px">${esc(x.servicoNome)}</b></td>
        <td class="r num">${x.qtd}</td><td class="r num">${eur(x.total)}</td><td class="r">${x.desconto ? pct(x.desconto) : '–'}</td><td class="r num"><b>${eur(x.base)}</b></td><td class="r">${pct(x.comissaoPct)}</td><td class="r num">${eur(x.comissao)}</td><td class="r num pos">${eur(x.lucro)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="5">TOTAIS</td><td class="r num">${eur(sum(list, 'total'))}</td><td></td><td class="r num">${eur(sum(list, 'base'))}</td><td></td><td class="r num">${eur(sum(list, 'comissao'))}</td><td class="r num">${eur(sum(list, 'lucro'))}</td></tr></tfoot></table></div>` : '<div class="empty">Sem vendas para os filtros escolhidos.</div>';
    v.querySelectorAll('[data-v]').forEach(tr => tr.onclick = () => editarVenda(M().vendas.find(x => x.id === tr.dataset.v)));
  };
  v.querySelector('#mes').onchange = e => { mes = e.target.value; draw(); };
  v.querySelector('#vd').onchange = e => { vend = e.target.value; draw(); };
  v.querySelector('#q').oninput = e => { q = e.target.value; draw(); };
  v.querySelector('#nv').onclick = () => editarVenda();
  v.querySelector('#csv').onclick = () => SPAP.csv(`vendas_${sub.key}_${ano}.csv`, [['Data', 'Vendedor', 'Cliente', 'Serviço', 'Quantidade', 'Preço', 'Desconto', 'Preço s/IVA', '% Comissão', 'Comissão inc. IVA', 'Lucro'],
    ...v._list.map(x => [x.data, nomeVend(x.vendedor), nomeCliente(x.cliente), x.servicoNome, x.qtd, x.total, x.desconto, x.base, x.comissaoPct, x.comissao, x.lucro])]);
  draw();
}

/* =========================================================
   COMISSÕES e DISTRIBUIÇÃO — geram pedidos SPAP
   ========================================================= */
function estadoPedidos(peds, devido) {
  const pedido = sum(peds, 'valor'), pago = sum(peds.filter(p => p.estado === 'EXECUTADO'), 'valor');
  const falta = r2(devido - pedido);
  let badge;
  if (devido <= 0) badge = '<span class="badge plain">Sem valor</span>';
  else if (pago >= devido - 0.004) badge = '<span class="badge ok">Pago</span>';
  else if (falta > 0.004 && !peds.length) badge = '<span class="badge warn">Por pedir</span>';
  else if (falta > 0.004) badge = '<span class="badge warn">Diferença por pedir</span>';
  else if (peds.some(p => p.estado === 'APROVADO')) badge = '<span class="badge acc">Aprovado</span>';
  else badge = '<span class="badge info">Em autorização</span>';
  return { pedido, pago, falta, badge };
}
const linkPeds = peds => peds.map(p => `<a class="mono" href="#/pedidos/${p.id}" style="font-size:12px">${esc(p.numero)}</a>`).join(' ');

function comissoes(v) {
  const ano = anoAtual();
  const rows = [];
  M().vendedores.forEach(vd => { for (let m = 1; m <= 12; m++) {
    const mk = mesKey(ano, m); const vs = M().vendas.filter(x => x.vendedor === vd.id && x.data.startsWith(mk)); if (!vs.length) continue;
    const devido = sum(vs, 'comissao'); const key = `com:${vd.id}:${mk}`; const peds = app.pedidosPorOrigem(key);
    rows.push({ vd, m, mk, key, vendas: sum(vs, 'base'), devido, peds, ...estadoPedidos(peds, devido) });
  } });
  const porPedir = rows.filter(r => r.falta > 0.004);
  v.innerHTML = `<div class="row between" style="margin-bottom:14px"><div class="row"><span class="muted">Exercício</span>${anoSel(ano)}</div>
    ${porPedir.length && app.can('criar') ? `<button class="btn primary" id="all">${icon('shield')} Pedir pagamento de todas (${eur(sum(porPedir, 'falta'))})</button>` : ''}</div>
    <div class="grid g4" style="margin-bottom:16px">
      <div class="card kpi hero"><div class="lbl">Comissões geradas</div><div class="val num">${eur(sum(rows, 'devido'))}</div></div>
      <div class="card kpi"><div class="lbl">Por pedir</div><div class="val num">${eur(sum(porPedir, 'falta'))}</div></div>
      <div class="card kpi"><div class="lbl">Em autorização / aprovadas</div><div class="val num">${eur(r2(sum(rows, 'pedido') - sum(rows, 'pago')))}</div></div>
      <div class="card kpi"><div class="lbl">Pagas</div><div class="val num pos">${eur(sum(rows, 'pago'))}</div></div></div>
    <div class="alert info" style="margin-bottom:16px">${icon('percent')}<div>Comissão = preço s/IVA × ${pct(M().params.comissao)} × (1 + IVA ${pct(M().params.iva)}). O pagamento é feito por pedido SPAP a partir da <b>${esc(app.nomeConta(CAIXA))}</b>.</div></div>
    <div class="card flush">${rows.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Mês</th><th>Vendedor</th><th class="r">Vendas</th><th class="r">Comissão devida</th><th class="r">Pago</th><th>Pedidos</th><th>Estado</th><th></th></tr></thead><tbody>
      ${rows.map((r, i) => `<tr><td><b>${MESES[r.m - 1]}</b></td><td>${esc(r.vd.nome)}<div class="faint mono" style="font-size:11.5px">NIF ${esc(r.vd.nif)} · ${esc(r.vd.regime)}</div></td><td class="r num">${eur(r.vendas)}</td><td class="r num"><b>${eur(r.devido)}</b></td><td class="r num">${eur(r.pago)}</td>
        <td>${linkPeds(r.peds) || '<span class="faint">—</span>'}</td><td>${r.badge}</td><td class="r">${r.falta > 0.004 && app.can('criar') ? `<button class="btn sm" data-i="${i}">Pedir ${eur(r.falta)}</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Sem comissões neste exercício.</div>'}</div>`;
  bindAno(v);
  const pre = r => ({ categoria: 'PAGAMENTO DE COMISSÕES', contaOrigem: CAIXA, contaDestino: r.vd.conta, valor: r.falta, metodo: 'TRANSFERÊNCIA INTERNA', requerente: r.vd.conta,
    descricao: `Comissões ${MESES[r.m - 1]} ${ano} · ${r.vd.nome}`, dataPrevista: today(), origem: { mod: 'comissoes', key: r.key } });
  v.querySelectorAll('[data-i]').forEach(b => b.onclick = () => app.novoPedido(pre(rows[+b.dataset.i])));
  const all = v.querySelector('#all');
  if (all) all.onclick = async () => {
    try { const c = await app.criarAssinado(porPedir.map(pre), 'Assinar pedidos de comissões', `${porPedir.length} pedidos de pagamento · total <b>${eur(sum(porPedir, 'falta'))}</b>`);
      if (c) { ui.toast(`${c.length} pedidos criados e assinados`, 'ok'); app.refresh(); } } catch (e) { ui.toast(esc(e.message), 'bad'); }
  };
}

function distribuicao(v) {
  const ano = anoAtual(); const vs = M().vendas.filter(x => x.data.startsWith(ano));
  const lucM = porMes(vs, x => x.lucro);
  const rows = [];
  for (let m = 1; m <= 12; m++) { if (!lucM[m - 1]) continue; const mk = mesKey(ano, m);
    M().socios.forEach(s => { const devido = r2(lucM[m - 1] * s.quota); const key = `dist:${s.id}:${mk}`; const peds = app.pedidosPorOrigem(key);
      rows.push({ s, m, mk, key, lucro: lucM[m - 1], devido, peds, ...estadoPedidos(peds, devido) }); }); }
  const porPedir = rows.filter(r => r.falta > 0.004);
  v.innerHTML = `<div class="row between" style="margin-bottom:14px"><div class="row"><span class="muted">Exercício</span>${anoSel(ano)}</div>
    ${porPedir.length && app.can('criar') ? `<button class="btn primary" id="all">${icon('shield')} Pedir todas as distribuições (${eur(sum(porPedir, 'falta'))})</button>` : ''}</div>
    <div class="grid g3" style="margin-bottom:16px">
      <div class="card"><div class="card-h"><h3>Quotas</h3></div><div id="dn"></div></div>
      <div class="card span2"><div class="card-h"><h3>Lucro mensal a distribuir</h3><span class="sub">após comissões</span></div><div id="ch"></div></div></div>
    <div class="card flush">${rows.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Mês</th><th class="r">Lucro</th><th>Sócio</th><th class="r">Quota</th><th class="r">A distribuir</th><th class="r">Distribuído</th><th>Pedidos</th><th>Estado</th><th></th></tr></thead><tbody>
      ${rows.map((r, i) => `<tr><td><b>${MESES[r.m - 1]}</b></td><td class="r num faint">${eur(r.lucro)}</td><td>${esc(r.s.nome)}</td><td class="r">${pct(r.s.quota)}</td><td class="r num"><b>${eur(r.devido)}</b></td><td class="r num">${eur(r.pago)}</td>
        <td>${linkPeds(r.peds) || '<span class="faint">—</span>'}</td><td>${r.badge}</td><td class="r">${r.falta > 0.004 && app.can('criar') ? `<button class="btn sm" data-i="${i}">Pedir ${eur(r.falta)}</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Sem lucro apurado neste exercício.</div>'}</div>`;
  bindAno(v);
  const tot = sum(lucM, x => x);
  chart.donut(v.querySelector('#dn'), { center: eur(tot).replace(/,\d+/, ''), sub: 'lucro ' + ano, items: M().socios.map(s => ({ label: `${s.nome} · ${pct(s.quota)}`, value: r2(tot * s.quota) })) });
  chart.bars(v.querySelector('#ch'), { labels: MES3, series: M().socios.map((s, i) => ({ name: s.nome, values: lucM.map(x => r2(x * s.quota)) })), stacked: true, height: 200 });
  const pre = r => {
    return { categoria: 'DISTRIBUIÇÃO DE RESULTADOS', contaOrigem: CAIXA, contaDestino: r.s.conta, valor: r.falta, metodo: 'COMPENSAÇÃO INTERNA',
      descricao: `Distribuição de resultados ${MESES[r.m - 1]} ${ano} · ${r.s.nome} (${pct(r.s.quota)})`, dataPrevista: today(), origem: { mod: 'distribuicao', key: r.key } }; };
  v.querySelectorAll('[data-i]').forEach(b => b.onclick = () => app.novoPedido(pre(rows[+b.dataset.i])));
  const all = v.querySelector('#all');
  if (all) all.onclick = async () => {
    try { const c = await app.criarAssinado(porPedir.map(pre), 'Assinar pedidos de distribuição', `${porPedir.length} pedidos · total <b>${eur(sum(porPedir, 'falta'))}</b>`);
      if (c) { ui.toast(`${c.length} pedidos criados e assinados`, 'ok'); app.refresh(); } } catch (e) { ui.toast(esc(e.message), 'bad'); }
  };
}

/* =========================================================
   CATÁLOGO E CADASTRO
   ========================================================= */
function crud(el, { titulo, items, cols, onNew, onSave, onDelete, canEdit }) {
  const fmt = (c, x) => { const val = x[c.k];
    if (c.type === 'money') return eur(val); if (c.type === 'pct') return pct(val); if (c.type === 'check') return val !== false ? '<span class="badge ok">Sim</span>' : '<span class="badge">Não</span>';
    if (c.type === 'select') { const o = (c.opts || []).find(o => o[0] === val); return esc(o ? o[1] : val); } return esc(val ?? ''); };
  el.innerHTML = `<div class="card flush"><div class="card-h"><h3>${titulo}</h3>${canEdit ? `<button class="btn sm" data-new>${icon('plus')} Adicionar</button>` : ''}</div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr>${cols.map(c => `<th class="${['money', 'pct', 'number'].includes(c.type) ? 'r' : ''}">${c.label}</th>`).join('')}</tr></thead><tbody>
    ${items.map((x, i) => `<tr class="${canEdit ? 'click' : ''}" data-i="${i}">${cols.map(c => `<td class="${['money', 'pct', 'number'].includes(c.type) ? 'r num' : ''} ${c.mono ? 'mono' : ''}">${fmt(c, x)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${cols.length}" class="empty">Sem registos.</td></tr>`}</tbody></table></div></div>`;
  const edit = x => { const novo = !x; x = x || onNew();
    ui.modal({ title: (novo ? 'Adicionar · ' : 'Editar · ') + titulo, body: `<form class="form">${cols.map(c => {
      const val = x[c.k];
      if (c.type === 'check') return `<div class="fld"><label>&nbsp;</label><label class="check"><input type="checkbox" name="${c.k}" ${val !== false ? 'checked' : ''}> ${c.label}</label></div>`;
      if (c.type === 'select') return `<div class="fld"><label>${c.label}</label><select class="inp" name="${c.k}">${c.opts.map(o => `<option value="${esc(o[0])}" ${o[0] === val ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select></div>`;
      const v2 = c.type === 'pct' ? r2((+val || 0) * 100) : (val ?? '');
      return `<div class="fld ${c.full ? 'full' : ''}"><label>${c.label}${c.type === 'pct' ? ' (%)' : c.type === 'money' ? ' (€)' : ''}</label><input class="inp ${c.mono ? 'mono' : ''}" name="${c.k}" ${['money', 'pct', 'number'].includes(c.type) ? 'type="number" step="0.0001"' : ''} value="${esc(v2)}"></div>`;
    }).join('')}</form>`,
      actions: [...(!novo && onDelete ? [{ label: icon('trash') + 'Remover', kind: 'bad', onClick: async () => { if (!await ui.confirm('Remover', 'Remover este registo?', { danger: true, okLabel: 'Remover' })) return false; const r = await onDelete(x); if (r === false) return false; app.save(); app.refresh(); } }] : []),
        { label: 'Cancelar', kind: 'ghost' }, { label: 'Guardar', kind: 'primary', onClick: async el2 => {
          const f = ui.formData(el2); cols.forEach(c => { if (c.type === 'pct') f[c.k] = (+f[c.k] || 0) / 100; else if (['money', 'number'].includes(c.type)) f[c.k] = +f[c.k] || 0; });
          if (cols[0] && !f[cols[0].k] && cols[0].type !== 'check') { ui.toast(cols[0].label + ' é obrigatório', 'warn'); return false; }
          const r = await onSave(x, f, novo); if (r === false) return false; app.save(); app.refresh(); } }] }); };
  const nb = el.querySelector('[data-new]'); if (nb) nb.onclick = () => edit();
  if (canEdit) el.querySelectorAll('[data-i]').forEach(tr => tr.onclick = () => edit(items[+tr.dataset.i]));
}

function catalogo(v) {
  let tab = sessionStorage.getItem(sub.key + ':cat') || 'serv';
  const canEdit = app.can('admin');
  v.innerHTML = `<div class="tabs" style="margin-bottom:16px">${[['serv', 'Serviços e preços'], ['cli', 'Clientes'], ['vend', 'Vendedores'], ['soc', 'Sócios'], ['par', 'Parâmetros']].map(([k, l]) => `<button data-t="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</div><div id="c"></div>
    ${canEdit ? '' : `<div class="alert info" style="margin-top:14px">${icon('lock')}<div>Só administradores podem alterar o catálogo.</div></div>`}`;
  v.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { sessionStorage.setItem(sub.key + ':cat', b.dataset.t); app.refresh(); });
  const c = v.querySelector('#c'); const m = M();
  const audit = (what, x) => app.log('CATALOGO_ALTERADO', `${what} · ${x.nome || x.id}`);
  if (tab === 'serv') crud(c, { titulo: 'Serviços', items: m.servicos, canEdit, cols: [{ k: 'nome', label: 'Designação' }, { k: 'unidade', label: 'Unidade' }, { k: 'preco', label: 'Preço', type: 'money' }, { k: 'ativo', label: 'Ativo', type: 'check' }],
    onNew: () => ({ unidade: 'hora', preco: 0, ativo: true }), onSave: (x, f, novo) => { Object.assign(x, f); if (novo) { x.id = 'S' + uid(); m.servicos.push(x); } audit('Serviço', x); },
    onDelete: x => { if (m.vendas.some(s => s.servico === x.id)) { ui.toast('Serviço com vendas: desative-o em vez de remover', 'warn'); return false; } m.servicos = m.servicos.filter(s => s !== x); audit('Serviço removido', x); } });
  if (tab === 'cli') crud(c, { titulo: 'Clientes', items: m.clientes, canEdit, cols: [{ k: 'nome', label: 'Nome' }, { k: 'nif', label: 'NIF', mono: true }, { k: 'contacto', label: 'Contacto' }, { k: 'desconto', label: 'Desconto / cashback fixo', type: 'pct' }],
    onNew: () => ({ desconto: 0 }), onSave: (x, f, novo) => { Object.assign(x, f); if (novo) { x.id = 'C' + uid(); m.clientes.push(x); } audit('Cliente', x); },
    onDelete: x => { if (m.vendas.some(s => s.cliente === x.id)) { ui.toast('Cliente com vendas registadas', 'warn'); return false; } m.clientes = m.clientes.filter(s => s !== x); } });
  if (tab === 'vend') crud(c, { titulo: 'Vendedores / revendedores', items: m.vendedores, canEdit, cols: [{ k: 'nome', label: 'Nome' }, { k: 'nif', label: 'NIF', mono: true }, { k: 'regime', label: 'Regime de IVA', type: 'select', opts: [['ISENTO', 'ISENTO'], ['IVA - 23%', 'IVA - 23%']] },
      { k: 'comissao', label: 'Comissão', type: 'pct' }, { k: 'ivaComissao', label: 'Comissão inclui IVA 23%', type: 'check' }, { k: 'ativo', label: 'Ativo', type: 'check' }],
    onNew: () => ({ comissao: m.params.comissao, regime: 'ISENTO', ivaComissao: true, ativo: true }),
    onSave: async (x, f, novo) => {
      const nv = { ...x, ...f }; if (novo) { nv.id = 'V' + uid(); nv.conta = 'V_' + nv.id; }
      const fm = (k, val) => k === 'comissao' ? pct(val) : ['ivaComissao', 'ativo'].includes(k) ? (val !== false ? 'Sim' : 'Não') : String(val ?? '—');
      const nomes = { nome: 'Nome', nif: 'NIF', regime: 'Regime de IVA', comissao: 'Comissão', ivaComissao: 'Comissão inclui IVA', ativo: 'Ativo' };
      const det = Object.keys(nomes).filter(k => novo || fm(k, x[k]) !== fm(k, nv[k])).map(k => [nomes[k], novo ? '—' : fm(k, x[k]), fm(k, nv[k])]);
      if (!det.length) { ui.toast('Sem alterações', 'warn'); return false; }
      return (await app.proporAlteracao('VENDEDOR_ES', { novo, vendedor: nv }, (novo ? 'Novo vendedor · ' : 'Vendedor · ') + nv.nome, det)) ? undefined : false; } });
  if (tab === 'soc') {
    crud(c, { titulo: 'Sócios e quotas', items: m.socios, canEdit, cols: [{ k: 'nome', label: 'Sócio' }, { k: 'nif', label: 'NIF', mono: true }, { k: 'quota', label: 'Quota', type: 'pct' },
      { k: 'conta', label: 'Conta de destino', type: 'select', opts: app.db.contas.map(x => [x.id, x.nome]) }],
      onNew: () => ({ quota: 0, conta: 'CR' }),
      onSave: async (x, f, novo) => {
        const nova = m.socios.map(s => s === x ? { ...s, ...f } : { ...s }); if (novo) nova.push({ id: 'SC' + uid(), ...f });
        const det = novo ? [['Sócio', '—', `${f.nome} · ${pct(f.quota)}`]] : [['Nome', x.nome, f.nome], ['Quota', pct(x.quota), pct(f.quota)], ['Conta de destino', app.nomeConta(x.conta), app.nomeConta(f.conta)]].filter(([, a, b]) => a !== b);
        if (!det.length) { ui.toast('Sem alterações', 'warn'); return false; }
        const tq = nova.reduce((s, y) => s + (+y.quota || 0), 0); if (Math.abs(tq - 1) > 0.0001) det.push(['Total das quotas', pct(m.socios.reduce((s, y) => s + (+y.quota || 0), 0)), pct(tq) + ' ⚠']);
        return (await app.proporAlteracao('SOCIOS_ES', { socios: nova }, novo ? 'Novo sócio · ' + f.nome : 'Sócio · ' + x.nome, det)) ? undefined : false; },
      onDelete: async x => (await app.proporAlteracao('SOCIOS_ES', { socios: m.socios.filter(s => s !== x).map(s => ({ ...s })) }, 'Remover sócio · ' + x.nome, [['Sócio', `${x.nome} · ${pct(x.quota)}`, 'removido']])) ? undefined : false });
    const tq = sum(m.socios, 'quota');
    if (Math.abs(tq - 1) > 0.0001) c.insertAdjacentHTML('afterbegin', `<div class="alert warn" style="margin-bottom:14px">${icon('alert')}<div>As quotas somam ${pct(tq)} — devem somar 100%.</div></div>`);
  }
  if (tab === 'par') {
    c.innerHTML = `<div class="card" style="max-width:640px"><div class="card-h"><h3>Parâmetros de cálculo</h3></div><form class="form" id="pf">
      <div class="fld"><label>IVA (%)</label><input class="inp num" type="number" step="0.01" name="iva" value="${r2(m.params.iva * 100)}" ${canEdit ? '' : 'disabled'}></div>
      <div class="fld"><label>Comissão padrão (%)</label><input class="inp num" type="number" step="0.0001" name="comissao" value="${r2(m.params.comissao * 10000) / 100}" ${canEdit ? '' : 'disabled'}></div>
      <div class="fld"><label>Taxa de processamento (%)</label><input class="inp num" type="number" step="0.01" name="taxaProcessamento" value="${r2(m.params.taxaProcessamento * 100)}" ${canEdit ? '' : 'disabled'}></div>
      <div class="fld full"><span class="hint">Alterações aplicam-se apenas a vendas novas — as vendas registadas mantêm as taxas em vigor na data do registo.</span></div>
      ${canEdit ? '<div class="full row" style="justify-content:flex-end"><button class="btn primary">Guardar</button></div>' : ''}</form></div>`;
    const pf = c.querySelector('#pf');
    pf.onsubmit = async e => { e.preventDefault(); const f = ui.formData(pf);
      const np = { iva: (+f.iva || 0) / 100, comissao: (+f.comissao || 0) / 100, taxaProcessamento: (+f.taxaProcessamento || 0) / 100 };
      const det = [['IVA', pct(m.params.iva), pct(np.iva)], ['Comissão padrão', pct(m.params.comissao), pct(np.comissao)], ['Taxa de processamento', pct(m.params.taxaProcessamento), pct(np.taxaProcessamento)]].filter(([, a, b]) => a !== b);
      if (!det.length) return ui.toast('Sem alterações', 'warn');
      if (await app.proporAlteracao('PARAMETROS_ES', { params: np }, 'Parâmetros de cálculo', det)) app.refresh(); };
  }
}


  return {
    seed, alcadaPadrao: 5000, tagline: sub.setor || 'Comércio e serviços', home: 'visao',
    logo: sub.dadosIniciais === 'elite' ? `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 10v4M8 6v12M12 3v18M16 7v10M20 10v4"/></svg>` : `<span style="font-size:13px">${esc(sub.sigla || '')}</span>`,
    heroTitle: sub.dadosIniciais === 'elite' ? 'Cada evento, cada euro, sob controlo.' : 'Cada venda, cada euro, sob controlo.',
    heroText: 'Vendas, comissões de vendedores e distribuição de resultados — com pagamentos autorizados como num banco.',
    migrarV3: db => { const b = db.contas.find(c => c.id === 'ES_BANCO'); if (b && b.nome === 'Conta à ordem Elite Sound') { b.nome = 'Conta operacional Elite Sound'; b.codigo = 'ES-OP-002'; } },
    // comissões já devidas mas ainda não pedidas entram na previsão de liquidez da caixa
    previsao: (a) => { const out = [], vs = M().vendas;
      [...new Set(vs.map(v => v.data.slice(0, 7)))].forEach(mk => M().vendedores.forEach(vd => {
        const f = r2(sum(vs.filter(x => x.vendedor === vd.id && x.data.startsWith(mk)), 'comissao') - sum(a.pedidosPorOrigem(`com:${vd.id}:${mk}`), 'valor'));
        if (f > 0.004) out.push({ conta: CAIXA, data: today(), valor: -f, tipo: 'Comissão por pedir', descricao: `Comissões ${mk} · ${vd.nome}` }, { conta: vd.conta, data: today(), valor: f, tipo: 'Comissão por pedir', descricao: `Comissões ${mk}` }); }));
      return out; },
    // receitas de vendas são os únicos movimentos legítimos sem pedido
    movimentoValido: (m) => {
      if (m.tipo !== 'RECEITA' || !m.ref || !m.ref.startsWith('venda:')) return false;
      const v = M().vendas.find(x => 'venda:' + x.id === m.ref);
      return !!v && m.conta === CAIXA && r2(v.base) === r2(m.valor) && v.data === m.data;
    },
    // receitas e custos variáveis pelo regime de acréscimo (vendas e comissões), para a análise financeira
    analise: (a, ano) => { const z = () => Array(12).fill(0), r = { receitas: z(), custosVar: z(), unidades: z(), n: z(), rotUnidade: 'un.' };
      M().vendas.filter(v => v.data.startsWith(ano)).forEach(v => { const m = +v.data.slice(5, 7) - 1; r.receitas[m] += v.base; r.custosVar[m] += v.comissao; r.unidades[m] += +v.qtd || 0; r.n[m]++; });
      const fim = ano + '-12-31', devidas = sum(M().vendas.filter(v => v.data <= fim), 'comissao');
      const pagas = sum(a.db.pedidos.filter(p => p.estado === 'EXECUTADO' && p.origem && String(p.origem.key).startsWith('com:') && String(p.dataExecucao || '') <= fim), 'valor');
      r.passivo = r2(Math.max(0, devidas - pagas)); return r; },
    provaExtra: (a, erros) => M().vendas.forEach(v => { if (v.base > 0 && a.db.movimentos.filter(m => m.ref === 'venda:' + v.id).length !== 1) erros.push(`Venda de ${date(v.data)} (${v.servicoNome}) sem receita correta na caixa`); }),
    modules: [
      { id: 'visao', label: 'Visão geral', title: 'Visão geral', icon: 'chart', render: visao },
      { id: 'vendas', label: 'Vendas e serviços', title: 'Vendas e serviços', icon: 'speaker', render: vendas },
      { id: 'comissoes', label: 'Comissões', title: 'Comissões de vendedores', icon: 'percent', render: comissoes },
      { id: 'distribuicao', label: 'Distribuição de resultados', title: 'Distribuição de resultados', icon: 'pie', render: distribuicao },
      { id: 'catalogo', label: 'Catálogo e cadastro', title: 'Catálogo e cadastro', icon: 'layers', render: catalogo },
    ],
    registar(a) {
      app = a;
      a.registarAlteracao('PARAMETROS_ES', { titulo: 'Parâmetros de cálculo (IVA / comissão)', snapshot: () => JSON.stringify(a.db.mod.params), aplicar: p => { a.db.mod.params = p.params; } });
      a.registarAlteracao('VENDEDOR_ES', { titulo: 'Vendedores e comissões',
        snapshot: p => JSON.stringify(p.novo ? null : a.db.mod.vendedores.find(v => v.id === p.vendedor.id) || null),
        aplicar: p => { const m = a.db.mod, v = p.vendedor;
          if (p.novo) { if (!a.conta(v.conta)) a.db.contas.push({ id: v.conta, codigo: 'V-' + String(m.vendedores.length + 1).padStart(3, '0'), nome: v.nome, tipo: 'INTERNA', saldoInicial: 0, categoria: 'VENDEDOR', nif: v.nif, ativo: true }); m.vendedores.push(v); }
          else { const x = m.vendedores.find(y => y.id === v.id); if (x) Object.assign(x, v); const ct = a.conta(v.conta); if (ct) { ct.nome = v.nome; ct.nif = v.nif; } } } });
      a.registarAlteracao('SOCIOS_ES', { titulo: 'Sócios e quotas', snapshot: () => JSON.stringify(a.db.mod.socios), aplicar: p => { a.db.mod.socios = p.socios; } });
    },
  };
};

/* ---------- Modelo: Base (só tesouraria e autorizações) ---------- */
SPAP.modelos.base = function (sub) {
  const { eur, esc, icon, r2 } = SPAP;
  const CAIXA = sub.contaCaixa || 'CAIXA', OPER = sub.contaOperacional || 'OPERACIONAL', HOLD = sub.contaHolding || 'HOLDING';
  let app;
  function seed(db, a) {
    app = a; db.settings.duplaAcima = 1000;
    (sub.utilizadores && sub.utilizadores.length ? sub.utilizadores : [{ id: 'u_bruno', nome: 'Bruno Alexandre Elias Monteiro', username: 'bruno', role: 'ADMIN', limite: 0 }])
      .forEach(u => db.users.push({ id: u.id, nome: u.nome, username: u.username, role: u.role, limite: u.role === 'ADMIN' ? 0 : Math.max(+u.limite || 0, 5000), ativo: true, pinHash: null }));
    const s = sub.sigla || 'SB';
    db.contas.push(
      { id: CAIXA, codigo: s + '-CX-001', nome: 'Tesouraria ' + sub.nome, tipo: 'INTERNA', categoria: 'TESOURARIA', saldoInicial: 0, ativo: true },
      { id: OPER, codigo: s + '-OP-002', nome: 'Conta operacional ' + sub.nome, tipo: 'INTERNA', categoria: 'TESOURARIA', saldoInicial: 0, ativo: true },
      { id: HOLD, codigo: '004_BXB_INVESTIMENTOS', nome: 'BXB Investimentos (holding)', tipo: 'INTERNA', categoria: 'SÓCIO', nif: '518300323', saldoInicial: 0, ativo: true });
    db.mod = {};
  }
  function visao(v) {
    const contas = app.contasInternas(), tot = r2(contas.reduce((s, c) => s + app.saldo(c.id), 0));
    const pend = app.db.pedidos.filter(p => ['PENDENTE', 'EM_APROVACAO', 'APROVADO'].includes(p.estado));
    v.innerHTML = `<div class="grid g3">
      <div class="card kpi hero"><div class="lbl">${icon('wallet')} Fundos de ${esc(sub.nome)}</div><div class="val num">${eur(tot)}</div><div class="foot">${contas.length} contas internas</div></div>
      <div class="card kpi"><div class="lbl">${icon('shield')} Pedidos em curso</div><div class="val num">${pend.length}</div><div class="foot">${eur(pend.reduce((s, p) => s + p.valor, 0))}</div></div>
      <div class="card kpi"><div class="lbl">${icon('building')} Holding</div><div class="val" style="font-size:20px">BXB Investimentos</div><div class="foot">participação ${Math.round((+sub.participacao || 0) * 100)}%</div></div></div>
      <div class="grid g4" style="margin-top:16px">${contas.map(c => `<a class="acct" href="#/contas/${encodeURIComponent(c.id)}" style="text-decoration:none"><b style="font-size:13.5px">${esc(c.nome)}</b><div><div class="muted" style="font-size:11.5px">Saldo</div><div class="bal num">${eur(app.saldo(c.id))}</div></div><span class="code">${esc(c.codigo || c.id)}</span></a>`).join('')}</div>
      <div class="card flush" style="margin-top:16px"><div class="card-h"><h3>Pedidos em curso</h3><a class="btn sm" href="#/pedidos">Todos</a></div>${app.tabelaPedidos(pend.slice(0, 8), { empty: 'Sem pedidos em curso.' })}</div>`;
    app.bindPedidos(v);
  }
  return { seed, alcadaPadrao: 5000, tagline: sub.setor || 'Subsidiária', home: 'visao', logo: `<span style="font-size:13px">${esc(sub.sigla || '')}</span>`,
    heroTitle: 'Tesouraria e autorizações da subsidiária.', heroText: 'Pagamentos requeridos, aprovados, assinados e auditados — com ligação à holding BXB.',
    modules: [{ id: 'visao', label: 'Visão geral', title: 'Visão geral', icon: 'chart', render: visao }], registar(a) { app = a; } };
};
})();
