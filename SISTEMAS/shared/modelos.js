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

/* ---------- Política de comissões (configurável em Catálogo → Regras de comissão) ----------
   atribuicao: 'vendedor' (só quem vende) | 'equipa' (todos os incluídos na venda)
   divisao (equipa): 'igual' | 'papel' (pesos por papel) | 'manual' (% indicada em cada venda)
   base: 'preco' (preço s/IVA) | 'margem' (preço s/IVA − custo do serviço)
   tipo: 'pct' (percentagem) | 'fixo' (valor fixo por venda)
   escaloes: [{ de, pct, bonus }] — a % de cada vendedor depende do volume do mês; ao atingir
   um escalão com bónus, o bónus é pago uma vez nesse mês. */
const PAPEIS = [['vendedor', 'Vendedor'], ['tecnico', 'Técnico'], ['montagem', 'Montagem'], ['apoio', 'Apoio']];
const nomePapel = k => (PAPEIS.find(p => p[0] === k) || [k, k])[1];
const POLITICA_PADRAO = () => ({ atribuicao: 'vendedor', divisao: 'igual', pesos: { vendedor: 60, tecnico: 20, montagem: 20, apoio: 0 }, base: 'preco', tipo: 'pct', valorFixo: 0, escaloes: [] });
const politica = () => Object.assign(POLITICA_PADRAO(), M().politica || {});
const temEscaloes = pol => !!pol && pol.tipo !== 'fixo' && (pol.escaloes || []).length > 0;
const escalaoDe = (escaloes, volume) => [...escaloes].sort((a, b) => a.de - b.de).filter(e => volume >= +e.de - 0.004).pop() || null;
const r4 = v => Math.round((+v || 0) * 10000) / 10000;
// divide um valor por quotas (somam 1), com o arredondamento na última parte
const repartir = (valor, quotas) => { let acc = 0; return quotas.map((q, i) => { const x = i === quotas.length - 1 ? r2(valor - acc) : r2(valor * q); acc = r2(acc + x); return x; }); };

/* ---------- Participação nos lucros (conversão de comissões em unidades) ---------- */
const FUNDO = 'FUNDO_PART';
const PART_PADRAO = () => ({ ativo: false, precoUnidade: 10, maxPct: 0.3, maxEur: 500, poolPct: 0.1, pool: [], conversoes: [] });
const part = () => { const m = M(); if (!m.participacao) m.participacao = PART_PADRAO(); return Object.assign(PART_PADRAO(), m.participacao, { pool: m.participacao.pool || [], conversoes: m.participacao.conversoes || (m.participacao.conversoes = []) }); };
// % do lucro para os titulares de unidades em vigor num mês (histórico: só afeta meses a partir da alteração)
const poolPctMes = mk => { const e = part().pool.filter(x => x.desde <= mk).sort((a, b) => a.desde.localeCompare(b.desde)).pop(); return e ? +e.pct || 0 : 0; };
const pedidoDe = id => app.db.pedidos.find(p => p.id === id);
// unidades efetivas: só contam conversões cujo pedido foi executado até à data
const unidadesEm = (vdId, ate) => r4(part().conversoes.filter(c => c.vendedor === vdId).reduce((s, c) => { const p = pedidoDe(c.pedido);
  return s + (p && p.estado === 'EXECUTADO' && String(p.dataExecucao || '').slice(0, 10) <= ate ? +c.unidades || 0 : 0); }, 0));
const fimMes = mk => { const [a, m] = mk.split('-').map(Number); return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10); };

/* ---------- Cálculo de uma venda (taxas fixadas no momento do registo) ---------- */
function calcVenda(v, volumes) {
  const m = M();
  const total = r2((+v.qtd || 0) * (+v.precoUnit || 0));
  const base = r2(total * (1 - (+v.desconto || 0)));
  if (!v.politica) {
    // venda registada antes das regras de comissão: uma taxa fixa, só para o vendedor
    const vd = m.vendedores.find(x => x.id === v.vendedor) || {};
    const comissaoPct = v.comissaoPct != null ? +v.comissaoPct : (vd.comissao != null ? +vd.comissao : m.params.comissao);
    const fatorIva = v.fatorIva != null ? +v.fatorIva : (vd.ivaComissao !== false ? 1 + m.params.iva : 1);
    const comissao = r2(base * comissaoPct * fatorIva);
    return Object.assign(v, { total, base, comissaoPct, fatorIva, comissao, lucro: r2(base - comissao),
      partes: [{ vendedor: v.vendedor, papel: 'vendedor', share: 1, baseParte: base, pct: comissaoPct, fatorIva, comissao }] });
  }
  const pol = v.politica;
  const custo = r2((+v.qtd || 0) * (+v.custoUnit || 0));
  const baseCom = pol.base === 'margem' ? Math.max(0, r2(base - custo)) : base;
  const membros = pol.atribuicao === 'equipa' && (v.participantes || []).length ? v.participantes : [{ vendedor: v.vendedor, papel: 'vendedor' }];
  let quotas;
  if (membros.length === 1) quotas = [1];
  else if (pol.divisao === 'papel') { const w = membros.map(p => +(pol.pesos || {})[p.papel] || 0), t = w.reduce((a, b) => a + b, 0); quotas = t > 0 ? w.map(x => x / t) : membros.map(() => 1 / membros.length); }
  else if (pol.divisao === 'manual') quotas = membros.map(p => +p.pct || 0);
  else quotas = membros.map(() => 1 / membros.length);
  const bases = repartir(baseCom, quotas), fixos = pol.tipo === 'fixo' ? repartir(+pol.valorFixo || 0, quotas) : null;
  const antigas = v.partes || [];
  const partes = membros.map((p, i) => {
    const vd = m.vendedores.find(x => x.id === p.vendedor) || {}, ant = antigas.find(a => a.vendedor === p.vendedor) || {};
    const fatorIva = ant.fatorIva != null ? ant.fatorIva : (vd.ivaComissao !== false ? 1 + m.params.iva : 1);
    let pct = null, comissao;
    if (fixos) comissao = r2(fixos[i] * fatorIva);
    else {
      if (temEscaloes(pol)) { const e = escalaoDe(pol.escaloes, volumes ? volumes(p.vendedor) : 0); pct = e ? +e.pct : 0; }
      else pct = ant.pct != null ? +ant.pct : (vd.comissao != null ? +vd.comissao : m.params.comissao);
      comissao = r2(bases[i] * pct * fatorIva);
    }
    return { vendedor: p.vendedor, papel: p.papel || 'vendedor', share: r4(quotas[i]), baseParte: bases[i], pct, fatorIva, comissao };
  });
  const comissao = r2(partes.reduce((s, p) => s + p.comissao, 0));
  return Object.assign(v, { total, base, custo, baseComissao: baseCom, partes, comissao, comissaoPct: partes.length === 1 ? partes[0].pct : null,
    fatorIva: partes[0].fatorIva, lucro: r2(base - comissao) });
}
const partesDe = v => v.partes || [{ vendedor: v.vendedor, papel: 'vendedor', share: 1, baseParte: v.base, pct: v.comissaoPct, fatorIva: v.fatorIva, comissao: v.comissao }];
// volume atribuído a cada vendedor no mês, nas vendas com escalões (para saber o escalão atingido)
function volumesMes(mk, ignorar) {
  const vol = {};
  M().vendas.filter(x => x.data.startsWith(mk) && x !== ignorar && temEscaloes(x.politica)).forEach(x => partesDe(x).forEach(p => vol[p.vendedor] = r2((vol[p.vendedor] || 0) + p.baseParte)));
  return vol;
}
// Recalcula as comissões de um mês: com escalões, a % de cada venda depende do volume total do mês
function recalcularMes(mk) {
  const m = M(); const vs = m.vendas.filter(x => x.data.startsWith(mk));
  vs.forEach(x => calcVenda(x));
  const vol = volumesMes(mk);
  const comEsc = vs.filter(x => temEscaloes(x.politica));
  comEsc.forEach(x => calcVenda(x, id => vol[id] || 0));
  m.bonus = m.bonus || {};
  const bonus = {};
  if (comEsc.length) {
    const esc = comEsc.slice().sort((a, b) => (a.data + (a.criadoEm || '')).localeCompare(b.data + (b.criadoEm || ''))).pop().politica.escaloes;
    Object.entries(vol).forEach(([id, volume]) => { const b = r2(esc.filter(e => +e.bonus > 0 && volume >= +e.de - 0.004).reduce((s, e) => s + +e.bonus, 0)); if (b > 0) bonus[id] = b; });
  }
  if (Object.keys(bonus).length) m.bonus[mk] = bonus; else delete m.bonus[mk];
}
const bonusDe = (vdId, mk) => +(((M().bonus || {})[mk] || {})[vdId]) || 0;
const bonusMes = mk => r2(Object.values((M().bonus || {})[mk] || {}).reduce((s, x) => s + (+x || 0), 0));
const bonusAno = ano => r2(Object.entries(M().bonus || {}).filter(([mk]) => mk.startsWith(ano)).reduce((s, [mk]) => s + bonusMes(mk), 0));
// comissão de um vendedor num mês: a sua parte em cada venda + bónus de escalão
function comissaoVendedorMes(vdId, mk) {
  let volume = 0, comissao = 0, n = 0;
  M().vendas.filter(x => x.data.startsWith(mk)).forEach(v => partesDe(v).forEach(p => { if (p.vendedor === vdId) { volume += p.baseParte; comissao += p.comissao; n++; } }));
  const bonus = bonusDe(vdId, mk);
  return { n, volume: r2(volume), comissao: r2(comissao), bonus, devido: r2(comissao + bonus) };
}
// lucro do mês depois de comissões e bónus
const lucroMeses = ano => { const vs = M().vendas.filter(x => x.data.startsWith(ano)); return porMes(vs, x => x.lucro).map((l, i) => r2(l - bonusMes(mesKey(ano, i + 1)))); };
// distribuição de um mês: primeiro a parte dos titulares de unidades, o resto pelos sócios conforme as quotas
function distribuicaoMes(ano, m, lucro) {
  const mk = mesKey(ano, m), fim = fimMes(mk);
  const titulares = M().vendedores.map(vd => ({ vd, unidades: unidadesEm(vd.id, fim) })).filter(t => t.unidades > 0);
  const totU = titulares.reduce((s, t) => s + t.unidades, 0);
  const pp = lucro > 0 && totU > 0 ? poolPctMes(mk) : 0, pool = r2(lucro * pp);
  const partesPool = repartir(pool, titulares.map(t => t.unidades / (totU || 1)));
  return { mk, lucro, poolPct: pp, pool, titulares: titulares.map((t, i) => ({ ...t, devido: partesPool[i] })),
    socios: M().socios.map(s => ({ s, devido: r2((lucro - pool) * s.quota) })) };
}
function descreverPolitica(pol = politica()) {
  const quem = pol.atribuicao === 'equipa' ? `todos os incluídos na venda (${{ igual: 'partes iguais', papel: 'pesos por papel', manual: '% indicada em cada venda' }[pol.divisao] || pol.divisao})` : 'só o vendedor';
  const base = pol.base === 'margem' ? 'margem (preço s/IVA − custo do serviço)' : 'preço s/IVA';
  const valor = pol.tipo === 'fixo' ? `${eur(pol.valorFixo)} fixos por venda` : temEscaloes(pol)
    ? 'percentagem por escalão do volume mensal: ' + [...pol.escaloes].sort((a, b) => a.de - b.de).map(e => `desde ${eur(e.de)} → ${pct(e.pct)}${+e.bonus ? ` (+${eur(e.bonus)} de bónus)` : ''}`).join('; ')
    : '% de cada vendedor (Catálogo → Vendedores)';
  return `Comissão para <b>${quem}</b>, sobre o <b>${base}</b>, ${pol.tipo === 'fixo' ? '' : '× (1 + IVA quando aplicável), '}com <b>${valor}</b>.`;
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
  const bon = bonusAno(ano), fat = sum(vs, 'base'), com = r2(sum(vs, 'comissao') + bon), luc = r2(sum(vs, 'lucro') - bon);
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
    { name: 'Faturação', values: porMes(vs, x => x.base) }, { name: 'Comissões', values: porMes(vs, x => x.comissao).map((c, i) => r2(c + bonusMes(mesKey(ano, i + 1)))), color: 'var(--accent2)' }, { name: 'Lucro', values: lucroMeses(ano), color: 'var(--ok)' }] });
  const porServ = {}; vs.forEach(x => porServ[x.servicoNome] = (porServ[x.servicoNome] || 0) + x.base);
  chart.donut(v.querySelector('#c2'), { center: eur(fat).replace(/,\d+/, ''), sub: 'faturação', items: Object.entries(porServ).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label: label.replace('ALUGUER ', ''), value: r2(value) })) });
  const th = `<thead><tr><th></th><th></th>${MES3.map(m => `<th class="r">${m}</th>`).join('')}<th class="r">Total</th></tr></thead>`;
  const linha = (a, b, vals, strong) => `<tr><td>${a}</td><td class="muted">${b}</td>${vals.map(x => `<td class="r num ${x ? '' : 'faint'}">${x ? eur(x) : '–'}</td>`).join('')}<td class="r num" style="font-weight:${strong ? 800 : 700}">${eur(sum(vals, x => x))}</td></tr>`;
  const doMes = (vd, f) => MES3.map((_, i) => comissaoVendedorMes(vd.id, mesKey(ano, i + 1))[f]);
  v.querySelector('#t1').innerHTML = `<table class="tbl">${th}<tbody>${M().vendedores.filter(vd => doMes(vd, 'n').some(Boolean)).map(vd =>
    linha(`<b>${esc(vd.nome)}</b>`, 'Volume', doMes(vd, 'volume')) + linha('', 'Comissões', doMes(vd, 'devido'))).join('')}</tbody>
    <tfoot>${linha('LUCRO ' + esc(NOME.toUpperCase()), 'Subtotal', lucroMeses(ano), true)}</tfoot></table>`;
  const lucM = lucroMeses(ano), dists = lucM.map((l, i) => l ? distribuicaoMes(ano, i + 1, l) : null).filter(Boolean);
  v.querySelector('#t2').innerHTML = `<table class="tbl"><thead><tr><th>Sócio</th><th class="r">Quota</th><th class="r">Atribuído ${ano}</th><th class="r">Distribuído</th></tr></thead><tbody>
    ${M().socios.map(s => { const pago = sum(app.db.pedidos.filter(p => p.estado === 'EXECUTADO' && p.origem && p.origem.key.startsWith(`dist:${s.id}:${ano}`)), 'valor');
      return `<tr><td><b>${esc(s.nome)}</b><div class="faint mono" style="font-size:11.5px">${esc(s.nif || s.id)}</div></td><td class="r">${pct(s.quota)}</td><td class="r num">${eur(sum(dists, d => (d.socios.find(x => x.s.id === s.id) || { devido: 0 }).devido))}</td><td class="r num">${eur(pago)}</td></tr>`; }).join('')}
    ${dists.some(d => d.pool) ? `<tr><td><b>Participação dos colaboradores</b><div class="faint" style="font-size:11.5px">titulares de unidades</div></td><td class="r">—</td><td class="r num">${eur(sum(dists, 'pool'))}</td><td class="r num">${eur(sum(app.db.pedidos.filter(p => p.estado === 'EXECUTADO' && p.origem && String(p.origem.key).startsWith('part:') && String(p.origem.key).includes(':' + ano + '-')), 'valor'))}</td></tr>` : ''}</tbody></table>`;
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
  // as vendas novas ficam com as regras de comissão em vigor; as já registadas mantêm as suas
  const pol = novo ? JSON.parse(JSON.stringify(politica())) : orig.politica;
  const equipa = !!pol && pol.atribuicao === 'equipa';
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
      ${equipa ? `<div class="full"><label class="lbl-sm">Equipa da venda — quem recebe comissão</label><div class="tbl-wrap"><table class="tbl" id="eq"></table></div>
        <span class="hint">${pol.divisao === 'manual' ? 'Indique a % de cada pessoa (devem somar 100%).' : pol.divisao === 'papel' ? 'A comissão é dividida pelos pesos de cada papel.' : 'A comissão é dividida em partes iguais.'}</span></div>` : ''}
      <div class="full calc" id="calc"></div><div class="full" id="partes"></div></form>`,
    actions: [
      ...(!novo && app.can('admin') ? [{ label: icon('trash') + 'Eliminar', kind: 'bad', onClick: async () => {
        if (!await ui.confirm('Eliminar venda', 'A receita será estornada da caixa. Esta ação fica registada na auditoria.', { okLabel: 'Eliminar', danger: true })) return false;
        try { app.estornarRef('venda:' + orig.id); } catch (e) { ui.toast(esc(e.message), 'bad'); return false; }
        m.vendas = m.vendas.filter(x => x.id !== orig.id); recalcularMes(orig.data.slice(0, 7));
        app.log('VENDA_ELIMINADA', `${orig.data} · ${orig.servicoNome} · ${eur(orig.base)}`); app.save(); app.refresh(); } }] : []),
      { label: 'Cancelar', kind: 'ghost' },
      { label: novo ? 'Registar venda' : 'Guardar', kind: 'primary', onClick: el => {
        const v = read(el); if (!v.qtd || !v.precoUnit) { ui.toast('Indique quantidade e preço', 'warn'); return false; }
        if (equipa && pol.divisao === 'manual' && Math.abs(v.participantes.reduce((s, p) => s + p.pct, 0) - 1) > 0.0001) { ui.toast('As percentagens da equipa devem somar 100%', 'warn'); return false; }
        if (app.dataFechada(v.data) || (!novo && app.dataFechada(orig.data))) { ui.toast(`Período fechado até ${date(app.ultimoFecho().data)} — não é possível registar ou alterar vendas nessa data`, 'bad'); return false; }
        const mesAntigo = novo ? null : orig.data.slice(0, 7);
        if (novo) { v.id = uid(); v.criadoEm = new Date().toISOString(); v.criadoPor = app.user.id; m.vendas.push(v); }
        else { Object.assign(orig, v); }
        const tgt = novo ? v : orig;
        recalcularMes(tgt.data.slice(0, 7)); if (mesAntigo && mesAntigo !== tgt.data.slice(0, 7)) recalcularMes(mesAntigo);
        lancarVenda(tgt);
        app.log(novo ? 'VENDA_REGISTADA' : 'VENDA_ALTERADA', `${tgt.data} · ${partesDe(tgt).map(p => nomeVend(p.vendedor)).join(' + ')} · ${tgt.servicoNome} × ${tgt.qtd} · ${eur(tgt.base)} · comissão ${eur(tgt.comissao)}`);
        app.save(); ui.toast(`Venda registada · ${eur(tgt.base)}`, 'ok'); app.refresh(); } }] });
  const el = md.el; let touchedPreco = !novo, touchedDesc = !novo;
  // equipa: o vendedor principal está sempre incluído
  const eqInicial = {}; (v0.participantes || []).forEach(p => eqInicial[p.vendedor] = p);
  const desenharEquipa = () => {
    const t = el.querySelector('#eq'); if (!t) return;
    const principal = el.querySelector('[name=vendedor]').value;
    const atual = {}; t.querySelectorAll('[data-eq]').forEach(r => atual[r.dataset.eq] = { inc: r.querySelector('[data-inc]').checked, papel: r.querySelector('[data-papel]').value, pct: r.querySelector('[data-pct]') ? r.querySelector('[data-pct]').value : '' });
    const lista = m.vendedores.filter(x => x.ativo !== false || eqInicial[x.id]);
    t.innerHTML = `<thead><tr><th>Incluído</th><th>Pessoa</th><th>Papel</th>${pol.divisao === 'manual' ? '<th class="r">%</th>' : ''}</tr></thead><tbody>${lista.map(x => {
      const ini = atual[x.id] || (eqInicial[x.id] ? { inc: true, papel: eqInicial[x.id].papel, pct: r2((+eqInicial[x.id].pct || 0) * 100) } : { inc: false, papel: x.id === principal ? 'vendedor' : 'tecnico', pct: '' });
      const inc = x.id === principal || ini.inc;
      return `<tr data-eq="${x.id}"><td><input type="checkbox" data-inc ${inc ? 'checked' : ''} ${x.id === principal ? 'disabled' : ''}></td><td>${esc(x.nome)}</td>
        <td><select class="inp inp-sm" data-papel>${PAPEIS.map(([k, l]) => `<option value="${k}" ${(x.id === principal && !atual[x.id] && !eqInicial[x.id] ? 'vendedor' : ini.papel) === k ? 'selected' : ''}>${l}</option>`).join('')}</select></td>
        ${pol.divisao === 'manual' ? `<td class="r"><input class="inp inp-sm num" type="number" step="0.01" min="0" max="100" data-pct value="${esc(ini.pct)}" style="width:90px"></td>` : ''}</tr>`; }).join('')}</tbody>`;
    t.querySelectorAll('input,select').forEach(i => i.addEventListener('input', () => upd()));
  };
  const lerEquipa = (principal) => {
    const t = el.querySelector('#eq'); if (!t) return null;
    const rows = [...t.querySelectorAll('[data-eq]')].filter(r => r.dataset.eq === principal || r.querySelector('[data-inc]').checked)
      .map(r => ({ vendedor: r.dataset.eq, papel: r.querySelector('[data-papel]').value, pct: r.querySelector('[data-pct]') ? (+r.querySelector('[data-pct]').value || 0) / 100 : null }));
    return rows.sort((a, b) => (b.vendedor === principal) - (a.vendedor === principal));
  };
  const read = el => { const f = ui.formData(el); const s = m.servicos.find(x => x.id === f.servico);
    const v = { data: f.data, vendedor: f.vendedor, cliente: f.cliente, servico: f.servico, servicoNome: s ? s.nome : '', qtd: +f.qtd || 0, precoUnit: +f.precoUnit || 0, desconto: (+f.desconto || 0) / 100, notas: f.notas,
      comissaoPct: novo ? null : orig.comissaoPct, fatorIva: novo ? null : orig.fatorIva };
    if (pol) Object.assign(v, { politica: pol, custoUnit: novo || orig.servico !== f.servico ? (s ? +s.custo || 0 : 0) : orig.custoUnit, participantes: equipa ? lerEquipa(f.vendedor) : null, partes: novo ? null : orig.partes });
    if (!pol) return calcVenda(v);
    calcVenda(v);
    if (!temEscaloes(pol)) return v;
    // pré-visualização do escalão: volume do mês sem esta venda + a parte desta venda
    const vol = volumesMes(v.data.slice(0, 7), orig || null), aqui = {}; v.partes.forEach(p => aqui[p.vendedor] = p.baseParte);
    return calcVenda(v, id => r2((vol[id] || 0) + (aqui[id] || 0)));
  };
  const upd = (e) => {
    const n = e && e.target.name;
    if (n === 'precoUnit') touchedPreco = true; if (n === 'desconto') touchedDesc = true;
    if (n === 'vendedor') desenharEquipa();
    const f = ui.formData(el);
    if (!touchedPreco || n === 'servico') { const s = m.servicos.find(x => x.id === f.servico); if (s) el.querySelector('[name=precoUnit]').value = s.preco; touchedPreco = false; }
    if (!touchedDesc || n === 'cliente') { const c = m.clientes.find(x => x.id === f.cliente); if (c) el.querySelector('[name=desconto]').value = r2(c.desconto * 100); touchedDesc = false; }
    const v = read(el);
    const pctTxt = v.partes.length === 1 && v.partes[0].pct != null ? ` ${pct(v.partes[0].pct)}${v.partes[0].fatorIva > 1 ? ' + IVA' : ''}` : '';
    el.querySelector('#calc').innerHTML = `<div><span>Preço</span><b class="num">${eur(v.total)}</b></div><div><span>Preço s/ desconto</span><b class="num">${eur(v.base)}</b></div>
      <div><span>Comissão${pctTxt}</span><b class="num">${eur(v.comissao)}</b></div><div><span>Lucro</span><b class="num pos">${eur(v.lucro)}</b></div>`;
    el.querySelector('#partes').innerHTML = v.partes.length > 1 || (pol && pol.base === 'margem') || temEscaloes(pol) ? `<table class="tbl"><thead><tr><th>Quem recebe</th><th>Papel</th><th class="r">Parte</th><th class="r">Base</th><th class="r">%</th><th class="r">Comissão</th></tr></thead><tbody>
      ${v.partes.map(p => `<tr><td>${esc(nomeVend(p.vendedor))}</td><td>${nomePapel(p.papel)}</td><td class="r">${pct(p.share)}</td><td class="r num">${eur(p.baseParte)}</td><td class="r">${p.pct != null ? pct(p.pct) : 'fixo'}</td><td class="r num"><b>${eur(p.comissao)}</b></td></tr>`).join('')}</tbody></table>
      ${temEscaloes(pol) ? '<span class="hint">Com escalões, a % é a do escalão atingido pelo volume do mês de cada pessoa e é recalculada sempre que há novas vendas nesse mês.</span>' : ''}` : '';
  };
  desenharEquipa();
  el.querySelectorAll('[name]').forEach(i => i.addEventListener('input', upd)); upd();
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
    const list = M().vendas.filter(x => x.data.startsWith(ano) && (!mes || +x.data.slice(5, 7) === +mes) && (!vend || partesDe(x).some(p => p.vendedor === vend))
      && (!ql || (x.servicoNome + nomeCliente(x.cliente) + partesDe(x).map(p => nomeVend(p.vendedor)).join(' ') + (x.notas || '')).toLowerCase().includes(ql))).sort((a, b) => b.data.localeCompare(a.data));
    v._list = list;
    v.querySelector('#k').innerHTML = [['Serviços', list.length, ''], ['Faturação', eur(sum(list, 'base')), 'hero'], ['Comissões', eur(sum(list, 'comissao')), ''], ['Lucro', eur(sum(list, 'lucro')), '']]
      .map(([l, val, c]) => `<div class="card kpi ${c}"><div class="lbl">${l}</div><div class="val num">${val}</div></div>`).join('');
    v.querySelector('#lst').innerHTML = list.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Data</th><th>Vendedor</th><th>Cliente</th><th>Serviço</th><th class="r">Qtd.</th><th class="r">Preço</th><th class="r">Desc.</th><th class="r">Preço s/IVA</th><th class="r">% Com.</th><th class="r">Comissão</th><th class="r">Lucro</th></tr></thead><tbody>
      ${list.map(x => `<tr class="click" data-v="${x.id}"><td>${date(x.data)}</td><td>${esc(partesDe(x).map(p => nomeVend(p.vendedor)).join(' + '))}</td><td>${esc(nomeCliente(x.cliente))}</td><td><b style="font-size:12.5px">${esc(x.servicoNome)}</b></td>
        <td class="r num">${x.qtd}</td><td class="r num">${eur(x.total)}</td><td class="r">${x.desconto ? pct(x.desconto) : '–'}</td><td class="r num"><b>${eur(x.base)}</b></td><td class="r">${partesDe(x).length > 1 ? 'equipa' : x.comissaoPct != null ? pct(x.comissaoPct) : 'fixo'}</td><td class="r num">${eur(x.comissao)}</td><td class="r num pos">${eur(x.lucro)}</td></tr>`).join('')}</tbody>
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
  const ano = anoAtual(); const P = part();
  const rows = [];
  M().vendedores.forEach(vd => { for (let m = 1; m <= 12; m++) {
    const mk = mesKey(ano, m); const c = comissaoVendedorMes(vd.id, mk); if (!c.n && !c.bonus) continue;
    const key = `com:${vd.id}:${mk}`; const peds = app.pedidosPorOrigem(key);
    const convertido = sum(peds.filter(p => p.origem.mod === 'participacao'), 'valor');
    rows.push({ vd, m, mk, key, ...c, convertido, peds, ...estadoPedidos(peds, c.devido) });
  } });
  rows.forEach(r => r.maxConv = limiteConversao(r, P));
  const porPedir = rows.filter(r => r.falta > 0.004);
  v.innerHTML = `<div class="row between" style="margin-bottom:14px"><div class="row"><span class="muted">Exercício</span>${anoSel(ano)}</div>
    ${porPedir.length && app.can('criar') ? `<button class="btn primary" id="all">${icon('shield')} Pedir pagamento de todas (${eur(sum(porPedir, 'falta'))})</button>` : ''}</div>
    <div class="grid g4" style="margin-bottom:16px">
      <div class="card kpi hero"><div class="lbl">Comissões geradas</div><div class="val num">${eur(sum(rows, 'devido'))}</div>${sum(rows, 'bonus') ? `<div class="foot">inclui ${eur(sum(rows, 'bonus'))} de bónus de metas</div>` : ''}</div>
      <div class="card kpi"><div class="lbl">Por pedir</div><div class="val num">${eur(sum(porPedir, 'falta'))}</div></div>
      <div class="card kpi"><div class="lbl">Em autorização / aprovadas</div><div class="val num">${eur(r2(sum(rows, 'pedido') - sum(rows, 'pago')))}</div></div>
      <div class="card kpi"><div class="lbl">Pagas</div><div class="val num pos">${eur(sum(rows, 'pago'))}</div>${sum(rows, 'convertido') ? `<div class="foot">${eur(sum(rows, 'convertido'))} convertidas em participação</div>` : ''}</div></div>
    <div class="alert info" style="margin-bottom:16px">${icon('percent')}<div>${descreverPolitica()} O pagamento é feito por pedido SPAP a partir da <b>${esc(app.nomeConta(CAIXA))}</b>.
      ${app.can('admin') ? '<a href="#/catalogo" id="regras">Alterar regras</a>' : ''}</div></div>
    ${P.ativo ? `<div class="alert ok" style="margin-bottom:16px">${icon('pie')}<div><b>Participação nos lucros ativa.</b> Em vez de receber a comissão, cada vendedor pode convertê-la em unidades a ${eur(P.precoUnidade)} cada${limitesTxt(P)}.
      As unidades dão direito a ${pct(poolPctMes(mesKey(today().slice(0, 4), +today().slice(5, 7))))} do lucro mensal, repartido pelas unidades de cada titular.</div></div>` : ''}
    <div class="card flush">${rows.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Mês</th><th>Vendedor</th><th class="r">Volume</th><th class="r">Comissão devida</th><th class="r">Pago</th><th>Pedidos</th><th>Estado</th><th></th></tr></thead><tbody>
      ${rows.map((r, i) => `<tr><td><b>${MESES[r.m - 1]}</b></td><td>${esc(r.vd.nome)}<div class="faint mono" style="font-size:11.5px">NIF ${esc(r.vd.nif)} · ${esc(r.vd.regime)}</div></td><td class="r num">${eur(r.volume)}</td>
        <td class="r num"><b>${eur(r.devido)}</b>${r.bonus ? `<div class="faint" style="font-size:11.5px">inclui bónus ${eur(r.bonus)}</div>` : ''}</td><td class="r num">${eur(r.pago)}${r.convertido ? `<div class="faint" style="font-size:11.5px">${eur(r.convertido)} em participação</div>` : ''}</td>
        <td>${linkPeds(r.peds) || '<span class="faint">—</span>'}</td><td>${r.badge}</td><td class="r" style="white-space:nowrap">${r.falta > 0.004 && app.can('criar') ? `${r.maxConv > 0.004 ? `<button class="btn sm" data-c="${i}">Converter</button> ` : ''}<button class="btn sm" data-i="${i}">Pedir ${eur(r.falta)}</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Sem comissões neste exercício.</div>'}</div>
    ${P.ativo || P.conversoes.length ? `<div class="card flush" style="margin-top:16px"><div class="card-h"><h3>Participação nos lucros</h3><span class="sub">unidades dos colaboradores</span></div><div class="tbl-wrap" id="tp"></div></div>` : ''}`;
  bindAno(v);
  const rg = v.querySelector('#regras'); if (rg) rg.onclick = e => { e.preventDefault(); sessionStorage.setItem(sub.key + ':cat', 'com'); app.go('catalogo'); };
  const pre = r => ({ categoria: 'PAGAMENTO DE COMISSÕES', contaOrigem: CAIXA, contaDestino: r.vd.conta, valor: r.falta, metodo: 'TRANSFERÊNCIA INTERNA', requerente: r.vd.conta,
    descricao: `Comissões ${MESES[r.m - 1]} ${ano} · ${r.vd.nome}`, dataPrevista: today(), origem: { mod: 'comissoes', key: r.key } });
  v.querySelectorAll('[data-i]').forEach(b => b.onclick = () => app.novoPedido(pre(rows[+b.dataset.i])));
  v.querySelectorAll('[data-c]').forEach(b => b.onclick = () => converter(rows[+b.dataset.c], ano));
  const all = v.querySelector('#all');
  if (all) all.onclick = async () => {
    try { const c = await app.criarAssinado(porPedir.map(pre), 'Assinar pedidos de comissões', `${porPedir.length} pedidos de pagamento · total <b>${eur(sum(porPedir, 'falta'))}</b>`);
      if (c) { ui.toast(`${c.length} pedidos criados e assinados`, 'ok'); app.refresh(); } } catch (e) { ui.toast(esc(e.message), 'bad'); }
  };
  const tp = v.querySelector('#tp');
  if (tp) {
    const hoje = today();
    const tit = M().vendedores.map(vd => { const cs = P.conversoes.filter(c => c.vendedor === vd.id);
      const emCurso = cs.filter(c => { const p = pedidoDe(c.pedido); return p && !['EXECUTADO', 'REJEITADO', 'CANCELADO'].includes(p.estado); });
      const div = app.db.pedidos.filter(p => p.estado === 'EXECUTADO' && p.origem && String(p.origem.key).startsWith(`part:${vd.id}:`));
      return { vd, unidades: unidadesEm(vd.id, hoje), emCurso: r4(emCurso.reduce((s, c) => s + c.unidades, 0)), investido: sum(cs.filter(c => { const p = pedidoDe(c.pedido); return p && p.estado === 'EXECUTADO'; }), 'valor'), dividendos: sum(div, 'valor') }; })
      .filter(t => t.unidades || t.emCurso);
    const totU = tit.reduce((s, t) => s + t.unidades, 0);
    tp.innerHTML = tit.length ? `<table class="tbl"><thead><tr><th>Titular</th><th class="r">Unidades</th><th class="r">% das unidades</th><th class="r">Em conversão</th><th class="r">Investido</th><th class="r">Lucros recebidos</th></tr></thead><tbody>
      ${tit.map(t => `<tr><td><b>${esc(t.vd.nome)}</b></td><td class="r num">${t.unidades}</td><td class="r">${totU ? pct(t.unidades / totU) : '—'}</td><td class="r num">${t.emCurso || '—'}</td><td class="r num">${eur(t.investido)}</td><td class="r num pos">${eur(t.dividendos)}</td></tr>`).join('')}</tbody></table>`
      : '<div class="empty">Ainda ninguém converteu comissões em participação. As unidades só contam depois de o pedido de conversão ser executado.</div>';
  }
}
const limitesTxt = P => { const l = []; if (P.maxPct != null) l.push(`até ${pct(P.maxPct)} de cada comissão mensal`); if (P.maxEur != null) l.push(`até ${eur(P.maxEur)} por mês`); return l.length ? ' (' + l.join(' e ') + ', aplica-se o mais restritivo)' : ''; };
// máximo que ainda se pode converter da comissão de um vendedor num mês
function limiteConversao(r, P = part()) {
  if (!P.ativo || !(+P.precoUnidade > 0)) return 0;
  let lim = r.falta;
  if (P.maxPct != null) lim = Math.min(lim, r2(r.devido * P.maxPct) - r.convertido);
  if (P.maxEur != null) lim = Math.min(lim, r2(+P.maxEur - r.convertido));
  return Math.max(0, r2(lim));
}
function converter(r, ano) {
  const P = part(); const max = limiteConversao(r, P);
  if (!app.conta(FUNDO)) return ui.toast('Ative a participação nos lucros em Catálogo e cadastro → Participação nos lucros', 'warn');
  const md = ui.modal({ title: 'Converter comissão em participação', sub: `${esc(r.vd.nome)} · comissões de ${MESES[r.m - 1]} ${ano}`,
    body: `<form class="form"><div class="fld"><label>Valor a converter (€)</label><input class="inp num" type="number" step="0.01" min="0.01" max="${max}" name="valor" value="${max}">
      <span class="hint">Máximo ${eur(max)}${limitesTxt(P)}. O resto da comissão continua a poder ser pedido em dinheiro.</span></div>
      <div class="fld"><label>Unidades</label><input class="inp num" name="un" readonly></div>
      <div class="full alert info">${icon('pie')}<div>A conversão é um pedido SPAP (caixa → ${esc(app.nomeConta(FUNDO))}) e segue o circuito normal de aprovação. As unidades só contam depois de o pedido ser <b>executado</b> e dão direito a uma parte do lucro de cada mês seguinte.</div></div></form>`,
    actions: [{ label: 'Cancelar', kind: 'ghost' }, { label: 'Assinar conversão', kind: 'primary', onClick: async el => {
      const valor = r2(+ui.formData(el).valor || 0);
      if (!(valor > 0)) { ui.toast('Indique um valor', 'warn'); return false; }
      if (valor > max + 0.004) { ui.toast(`O máximo é ${eur(max)}`, 'warn'); return false; }
      const conv = { id: uid(), vendedor: r.vd.id, mk: r.mk, valor, preco: +P.precoUnidade, unidades: r4(valor / P.precoUnidade), criadoEm: new Date().toISOString(), criadoPor: app.user.id };
      try {
        const c = await app.criarAssinado([{ categoria: 'PAGAMENTO DE COMISSÕES', contaOrigem: CAIXA, contaDestino: FUNDO, valor, metodo: 'CAPITALIZAÇÃO', requerente: r.vd.conta,
          descricao: `Conversão em participação · Comissões ${MESES[r.m - 1]} ${ano} · ${r.vd.nome} · ${conv.unidades} unidades a ${eur(conv.preco)}`, dataPrevista: today(),
          origem: { mod: 'participacao', key: r.key, conversao: conv.id } }], 'Assinar conversão em participação', `${esc(r.vd.nome)} · <b>${eur(valor)}</b> → ${conv.unidades} unidades`);
        if (!c) return false;
        conv.pedido = c[0].id; M().participacao.conversoes.push(conv);
        app.log('PARTICIPACAO_CONVERSAO', `${r.vd.nome} · ${r.mk} · ${eur(valor)} → ${conv.unidades} unidades · pedido ${c[0].numero}`);
        app.save(); ui.toast(`Pedido ${esc(c[0].numero)} criado · ${conv.unidades} unidades depois de executado`, 'ok'); app.refresh();
      } catch (e) { ui.toast(esc(e.message), 'bad'); return false; }
    } }] });
  const el = md.el, upd = () => { el.querySelector('[name=un]').value = r4((+el.querySelector('[name=valor]').value || 0) / P.precoUnidade); };
  el.querySelector('[name=valor]').addEventListener('input', upd); upd();
}

function distribuicao(v) {
  const ano = anoAtual();
  const lucM = lucroMeses(ano);
  const rows = [], dists = [];
  for (let m = 1; m <= 12; m++) { if (!lucM[m - 1]) continue; const d = distribuicaoMes(ano, m, lucM[m - 1]); dists.push(d);
    d.titulares.forEach(t => { const key = `part:${t.vd.id}:${d.mk}`; const peds = app.pedidosPorOrigem(key);
      rows.push({ tit: t, m, mk: d.mk, key, lucro: d.lucro, devido: t.devido, peds, ...estadoPedidos(peds, t.devido) }); });
    d.socios.forEach(({ s, devido }) => { const key = `dist:${s.id}:${d.mk}`; const peds = app.pedidosPorOrigem(key);
      rows.push({ s, m, mk: d.mk, key, lucro: d.lucro, devido, peds, ...estadoPedidos(peds, devido) }); }); }
  const porPedir = rows.filter(r => r.falta > 0.004);
  const totPool = sum(dists, 'pool');
  v.innerHTML = `<div class="row between" style="margin-bottom:14px"><div class="row"><span class="muted">Exercício</span>${anoSel(ano)}</div>
    ${porPedir.length && app.can('criar') ? `<button class="btn primary" id="all">${icon('shield')} Pedir todas as distribuições (${eur(sum(porPedir, 'falta'))})</button>` : ''}</div>
    ${totPool ? `<div class="alert info" style="margin-bottom:16px">${icon('pie')}<div>Antes das quotas dos sócios, ${eur(totPool)} do lucro deste exercício vão para os colaboradores com <b>unidades de participação</b>, repartidos pelas unidades de cada um no fim de cada mês.</div></div>` : ''}
    <div class="grid g3" style="margin-bottom:16px">
      <div class="card"><div class="card-h"><h3>Quotas</h3></div><div id="dn"></div></div>
      <div class="card span2"><div class="card-h"><h3>Lucro mensal a distribuir</h3><span class="sub">após comissões</span></div><div id="ch"></div></div></div>
    <div class="card flush">${rows.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Mês</th><th class="r">Lucro</th><th>Sócio / titular</th><th class="r">Quota</th><th class="r">A distribuir</th><th class="r">Distribuído</th><th>Pedidos</th><th>Estado</th><th></th></tr></thead><tbody>
      ${rows.map((r, i) => `<tr><td><b>${MESES[r.m - 1]}</b></td><td class="r num faint">${eur(r.lucro)}</td><td>${r.s ? esc(r.s.nome) : `${esc(r.tit.vd.nome)}<div class="faint" style="font-size:11.5px">participação · ${r.tit.unidades} unidades</div>`}</td>
        <td class="r">${r.s ? pct(r.s.quota) : '—'}</td><td class="r num"><b>${eur(r.devido)}</b></td><td class="r num">${eur(r.pago)}</td>
        <td>${linkPeds(r.peds) || '<span class="faint">—</span>'}</td><td>${r.badge}</td><td class="r">${r.falta > 0.004 && app.can('criar') ? `<button class="btn sm" data-i="${i}">Pedir ${eur(r.falta)}</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Sem lucro apurado neste exercício.</div>'}</div>`;
  bindAno(v);
  const tot = sum(lucM, x => x);
  const items = M().socios.map(s => ({ label: `${s.nome} · ${pct(s.quota)}`, value: sum(dists, d => (d.socios.find(x => x.s.id === s.id) || { devido: 0 }).devido) }));
  if (totPool) items.push({ label: 'Participação dos colaboradores', value: totPool });
  chart.donut(v.querySelector('#dn'), { center: eur(tot).replace(/,\d+/, ''), sub: 'lucro ' + ano, items });
  const series = M().socios.map(s => ({ name: s.nome, values: lucM.map((l, i) => { const d = dists.find(x => x.mk === mesKey(ano, i + 1)); return d ? (d.socios.find(x => x.s.id === s.id) || { devido: 0 }).devido : 0; }) }));
  if (totPool) series.push({ name: 'Participação', values: lucM.map((l, i) => { const d = dists.find(x => x.mk === mesKey(ano, i + 1)); return d ? d.pool : 0; }) });
  chart.bars(v.querySelector('#ch'), { labels: MES3, series, stacked: true, height: 200 });
  const pre = r => r.s
    ? { categoria: 'DISTRIBUIÇÃO DE RESULTADOS', contaOrigem: CAIXA, contaDestino: r.s.conta, valor: r.falta, metodo: 'COMPENSAÇÃO INTERNA',
      descricao: `Distribuição de resultados ${MESES[r.m - 1]} ${ano} · ${r.s.nome} (${pct(r.s.quota)})`, dataPrevista: today(), origem: { mod: 'distribuicao', key: r.key } }
    : { categoria: 'DISTRIBUIÇÃO DE RESULTADOS', contaOrigem: CAIXA, contaDestino: r.tit.vd.conta, valor: r.falta, metodo: 'COMPENSAÇÃO INTERNA', requerente: r.tit.vd.conta,
      descricao: `Participação nos lucros ${MESES[r.m - 1]} ${ano} · ${r.tit.vd.nome} (${r.tit.unidades} unidades)`, dataPrevista: today(), origem: { mod: 'participacao_lucros', key: r.key } };
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
  v.innerHTML = `<div class="tabs" style="margin-bottom:16px">${[['serv', 'Serviços e preços'], ['cli', 'Clientes'], ['vend', 'Vendedores'], ['com', 'Regras de comissão'], ['part', 'Participação nos lucros'], ['soc', 'Sócios'], ['par', 'Parâmetros']].map(([k, l]) => `<button data-t="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</div><div id="c"></div>
    ${canEdit ? '' : `<div class="alert info" style="margin-top:14px">${icon('lock')}<div>Só administradores podem alterar o catálogo.</div></div>`}`;
  v.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { sessionStorage.setItem(sub.key + ':cat', b.dataset.t); app.refresh(); });
  const c = v.querySelector('#c'); const m = M();
  const audit = (what, x) => app.log('CATALOGO_ALTERADO', `${what} · ${x.nome || x.id}`);
  if (tab === 'serv') crud(c, { titulo: 'Serviços', items: m.servicos, canEdit, cols: [{ k: 'nome', label: 'Designação' }, { k: 'unidade', label: 'Unidade' }, { k: 'preco', label: 'Preço', type: 'money' }, { k: 'custo', label: 'Custo unitário s/IVA', type: 'money' }, { k: 'ativo', label: 'Ativo', type: 'check' }],
    onNew: () => ({ unidade: 'hora', preco: 0, custo: 0, ativo: true }), onSave: (x, f, novo) => { Object.assign(x, f); if (novo) { x.id = 'S' + uid(); m.servicos.push(x); } audit('Serviço', x); },
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
  if (tab === 'com') regrasComissao(c, canEdit);
  if (tab === 'part') regrasParticipacao(c, canEdit);
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

/* ---------- Regras de comissão (regra das duas pessoas) ---------- */
function regrasComissao(c, canEdit) {
  const pol = politica(), dis = canEdit ? '' : 'disabled';
  const sel = (name, val, opts) => `<select class="inp" name="${name}" ${dis}>${opts.map(([k, l]) => `<option value="${k}" ${k === val ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  c.innerHTML = `<div class="card" style="max-width:860px"><div class="card-h"><h3>Regras de comissão</h3><span class="sub">aplicam-se às vendas registadas depois da alteração</span></div>
    <form class="form" id="rf">
      <div class="fld"><label>Quem recebe a comissão</label>${sel('atribuicao', pol.atribuicao, [['vendedor', 'Só o vendedor'], ['equipa', 'Todos os incluídos na venda (equipa)']])}</div>
      <div class="fld" data-eqo><label>Divisão pela equipa</label>${sel('divisao', pol.divisao, [['igual', 'Partes iguais'], ['papel', 'Pesos por papel'], ['manual', '% indicada em cada venda']])}</div>
      <div class="full" data-pesos><label class="muted" style="font-size:12px">Pesos por papel</label><div class="row" style="flex-wrap:wrap;gap:10px;margin-top:6px">${PAPEIS.map(([k, l]) => `<label class="row" style="gap:6px">${l}<input class="inp inp-sm num" type="number" min="0" step="1" name="peso_${k}" value="${+(pol.pesos || {})[k] || 0}" style="width:80px" ${dis}></label>`).join('')}</div></div>
      <div class="fld"><label>Calcular sobre</label>${sel('base', pol.base, [['preco', 'Preço s/IVA'], ['margem', 'Margem (preço s/IVA − custo do serviço)']])}</div>
      <div class="fld"><label>Tipo de comissão</label>${sel('tipo', pol.tipo, [['pct', 'Percentagem'], ['fixo', 'Valor fixo por venda']])}</div>
      <div class="fld" data-fixo><label>Valor fixo por venda (€)</label><input class="inp num" type="number" step="0.01" min="0" name="valorFixo" value="${+pol.valorFixo || 0}" ${dis}><span class="hint">Dividido pela equipa quando há mais de uma pessoa.</span></div>
      <div class="full" data-esc><label class="check"><input type="checkbox" name="usaEsc" ${(pol.escaloes || []).length ? 'checked' : ''} ${dis}> Escalões e metas mensais (a % sobe com o volume do mês de cada vendedor)</label>
        <div data-esct style="margin-top:10px"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Volume mensal desde (€)</th><th>% de comissão</th><th>Bónus ao atingir (€)</th><th></th></tr></thead><tbody id="esc"></tbody></table></div>
        ${canEdit ? `<button type="button" class="btn sm" id="addEsc" style="margin-top:8px">${icon('plus')} Escalão</button>` : ''}
        <span class="hint">A % do escalão atingido aplica-se a todas as vendas do mês dessa pessoa e substitui a % individual dos vendedores. O primeiro escalão deve começar em 0 €. Cada bónus é pago uma vez no mês em que a meta é atingida.</span></div></div>
      <div class="full alert info" id="resumo"></div>
      ${canEdit ? '<div class="full row" style="justify-content:flex-end"><button class="btn primary">Propor alteração</button></div>' : ''}</form></div>`;
  const rf = c.querySelector('#rf'), tb = c.querySelector('#esc');
  const linhaEsc = e => `<tr><td><input class="inp inp-sm num" type="number" step="0.01" min="0" data-de value="${e.de ?? ''}" ${dis}></td><td><input class="inp inp-sm num" type="number" step="0.01" min="0" data-pct value="${e.pct != null ? r2(e.pct * 100) : ''}" ${dis}></td>
    <td><input class="inp inp-sm num" type="number" step="0.01" min="0" data-bonus value="${e.bonus ?? 0}" ${dis}></td><td class="r">${canEdit ? `<button type="button" class="btn sm ghost" data-rm>${icon('trash')}</button>` : ''}</td></tr>`;
  tb.innerHTML = ((pol.escaloes || []).length ? pol.escaloes : [{ de: 0, pct: M().params.comissao, bonus: 0 }]).slice().sort((a, b) => a.de - b.de).map(linhaEsc).join('');
  const ler = () => { const f = ui.formData(rf);
    const escaloes = f.usaEsc && f.tipo === 'pct' ? [...tb.querySelectorAll('tr')].map(tr => ({ de: r2(+tr.querySelector('[data-de]').value || 0), pct: r4((+tr.querySelector('[data-pct]').value || 0) / 100), bonus: r2(+tr.querySelector('[data-bonus]').value || 0) })).sort((a, b) => a.de - b.de) : [];
    return { atribuicao: f.atribuicao, divisao: f.divisao, pesos: Object.fromEntries(PAPEIS.map(([k]) => [k, +f['peso_' + k] || 0])), base: f.base, tipo: f.tipo, valorFixo: r2(+f.valorFixo || 0), escaloes }; };
  const vis = () => { const p = ler();
    c.querySelector('[data-eqo]').style.display = p.atribuicao === 'equipa' ? '' : 'none';
    c.querySelector('[data-pesos]').style.display = p.atribuicao === 'equipa' && p.divisao === 'papel' ? '' : 'none';
    c.querySelector('[data-fixo]').style.display = p.tipo === 'fixo' ? '' : 'none';
    c.querySelector('[data-esc]').style.display = p.tipo === 'pct' ? '' : 'none';
    c.querySelector('[data-esct]').style.display = rf.querySelector('[name=usaEsc]').checked ? '' : 'none';
    c.querySelector('#resumo').innerHTML = `${icon('percent')}<div>${descreverPolitica(p)}</div>`; };
  const ligar = () => { rf.querySelectorAll('input,select').forEach(i => i.oninput = i.onchange = vis);
    tb.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { b.closest('tr').remove(); vis(); }); };
  const add = c.querySelector('#addEsc'); if (add) add.onclick = () => { const ult = [...tb.querySelectorAll('[data-de]')].pop(); tb.insertAdjacentHTML('beforeend', linhaEsc({ de: ult ? r2((+ult.value || 0) + 5000) : 0, pct: null, bonus: 0 })); ligar(); vis(); };
  ligar(); vis();
  rf.onsubmit = async e => { e.preventDefault(); if (!canEdit) return;
    const np = ler();
    if (np.atribuicao === 'equipa' && np.divisao === 'papel' && !Object.values(np.pesos).some(x => x > 0)) return ui.toast('Indique pelo menos um peso maior que zero', 'warn');
    if (np.tipo === 'fixo' && !(np.valorFixo > 0)) return ui.toast('Indique o valor fixo por venda', 'warn');
    if (np.escaloes.length && np.escaloes[0].de > 0) return ui.toast('O primeiro escalão deve começar em 0 €', 'warn');
    if (new Set(np.escaloes.map(x => x.de)).size !== np.escaloes.length) return ui.toast('Há escalões repetidos', 'warn');
    const txt = p => descreverPolitica(p).replace(/<[^>]+>/g, '');
    if (txt(np) === txt(pol) && JSON.stringify(np.pesos) === JSON.stringify(pol.pesos)) return ui.toast('Sem alterações', 'warn');
    if (await app.proporAlteracao('POLITICA_COMISSAO_ES', { politica: np }, 'Regras de comissão', [['Regras', txt(pol), txt(np)]])) app.refresh(); };
}

/* ---------- Participação nos lucros (regra das duas pessoas) ---------- */
function regrasParticipacao(c, canEdit) {
  const P = part(), dis = canEdit ? '' : 'disabled', mk = today().slice(0, 7);
  c.innerHTML = `<div class="card" style="max-width:760px"><div class="card-h"><h3>Participação nos lucros</h3><span class="sub">conversão de comissões em unidades</span></div>
    <form class="form" id="pf2">
      <div class="full"><label class="check"><input type="checkbox" name="ativo" ${P.ativo ? 'checked' : ''} ${dis}> Permitir converter comissões em unidades de participação nos lucros</label></div>
      <div class="fld"><label>Preço de cada unidade (€)</label><input class="inp num" type="number" step="0.01" min="0.01" name="precoUnidade" value="${P.precoUnidade}" ${dis}><span class="hint">Converter 100 € a 10 € por unidade dá 10 unidades.</span></div>
      <div class="fld"><label>% do lucro mensal para os titulares</label><input class="inp num" type="number" step="0.01" min="0" max="100" name="poolPct" value="${r2((P.poolPct ?? 0) * 100)}" ${dis}><span class="hint">Retirada antes das quotas dos sócios e repartida pelas unidades. Aplica-se a partir deste mês.</span></div>
      <div class="fld"><label>Máximo por comissão (% da comissão mensal)</label><input class="inp num" type="number" step="0.01" min="0" max="100" name="maxPct" value="${P.maxPct != null ? r2(P.maxPct * 100) : ''}" placeholder="sem limite" ${dis}></div>
      <div class="fld"><label>Máximo por mês e por vendedor (€)</label><input class="inp num" type="number" step="0.01" min="0" name="maxEur" value="${P.maxEur ?? ''}" placeholder="sem limite" ${dis}><span class="hint">Aplica-se o limite mais restritivo. Vazio = sem limite.</span></div>
      <div class="full alert info">${icon('pie')}<div>A conversão é feita na página <b>Comissões</b> e é um pedido SPAP da caixa para a conta <b>Fundo de participação dos colaboradores</b>, com aprovação e assinatura como qualquer pagamento. As unidades só contam depois de o pedido ser executado. A parte do lucro de cada titular é paga na <b>Distribuição de resultados</b>.</div></div>
      <div class="full alert warn">${icon('alert')}<div>A participação de colaboradores nos lucros pode ter implicações fiscais e laborais. Valide o enquadramento com o contabilista certificado.</div></div>
      ${canEdit ? '<div class="full row" style="justify-content:flex-end"><button class="btn primary">Propor alteração</button></div>' : ''}</form></div>`;
  const pf = c.querySelector('#pf2');
  pf.onsubmit = async e => { e.preventDefault(); if (!canEdit) return;
    const f = ui.formData(pf);
    const n = { ativo: !!f.ativo, precoUnidade: r2(+f.precoUnidade || 0), poolPct: r4((+f.poolPct || 0) / 100), maxPct: f.maxPct === '' ? null : r4((+f.maxPct || 0) / 100), maxEur: f.maxEur === '' ? null : r2(+f.maxEur || 0) };
    if (n.ativo && !(n.precoUnidade > 0)) return ui.toast('Indique o preço de cada unidade', 'warn');
    if (n.poolPct > 1 || (n.maxPct != null && n.maxPct > 1)) return ui.toast('As percentagens não podem passar de 100%', 'warn');
    const fm = { ativo: x => x ? 'Sim' : 'Não', precoUnidade: x => eur(x), poolPct: x => pct(x), maxPct: x => x == null ? 'sem limite' : pct(x), maxEur: x => x == null ? 'sem limite' : eur(x) };
    const nomes = { ativo: 'Ativa', precoUnidade: 'Preço da unidade', poolPct: '% do lucro para titulares', maxPct: 'Máximo por comissão', maxEur: 'Máximo por mês' };
    const det = Object.keys(nomes).filter(k => fm[k](P[k]) !== fm[k](n[k])).map(k => [nomes[k], fm[k](P[k]), fm[k](n[k])]);
    if (!det.length) return ui.toast('Sem alterações', 'warn');
    if (await app.proporAlteracao('PARTICIPACAO_ES', { cfg: n, desde: mk }, 'Participação nos lucros', det)) app.refresh(); };
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
        const f = r2(comissaoVendedorMes(vd.id, mk).devido - sum(a.pedidosPorOrigem(`com:${vd.id}:${mk}`), 'valor'));
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
      for (let i = 0; i < 12; i++) r.custosVar[i] += bonusMes(mesKey(ano, i + 1));
      const fim = ano + '-12-31', devidas = r2(sum(M().vendas.filter(v => v.data <= fim), 'comissao') + Object.keys(M().bonus || {}).filter(mk => mk <= fim.slice(0, 7)).reduce((t, mk) => t + bonusMes(mk), 0));
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
      a.registarAlteracao('POLITICA_COMISSAO_ES', { titulo: 'Regras de comissão', snapshot: () => JSON.stringify(a.db.mod.politica || null), aplicar: p => { a.db.mod.politica = p.politica; } });
      a.registarAlteracao('PARTICIPACAO_ES', { titulo: 'Participação nos lucros', snapshot: () => JSON.stringify(a.db.mod.participacao ? { ...a.db.mod.participacao, conversoes: undefined } : null),
        aplicar: p => { const mod = a.db.mod; const P = mod.participacao = mod.participacao || PART_PADRAO();
          const antes = P.ativo ? +P.poolPct || 0 : 0, depois = p.cfg.ativo ? +p.cfg.poolPct || 0 : 0;
          Object.assign(P, p.cfg); P.pool = P.pool || []; P.conversoes = P.conversoes || [];
          // a % do lucro só muda a partir do mês da alteração; os meses anteriores ficam como estavam
          if (antes !== depois || !P.pool.length) { P.pool = P.pool.filter(x => x.desde !== p.desde); P.pool.push({ desde: p.desde, pct: depois }); }
          if (p.cfg.ativo && !a.conta(FUNDO)) a.db.contas.push({ id: FUNDO, codigo: (sub.sigla || 'SB') + '-FP-001', nome: 'Fundo de participação dos colaboradores', tipo: 'INTERNA', categoria: 'SÓCIO / RESERVA', saldoInicial: 0, ativo: true }); } });
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
