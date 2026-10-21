/* =========================================================
   MODELO DE SUBSIDIÁRIA: PLANEAMENTO FINANCEIRO
   Nasceu do Planeador Financeiro Anual (Python/Streamlit):
   recibos de vencimento e projeção anual, despesas fixas,
   dívidas e créditos, simulador de amortização (avalanche,
   snowball, equilibrada), objetivos e saúde financeira.
   Os pagamentos e as entradas seguem o circuito SPAP.
   ========================================================= */
(function () {
'use strict';
SPAP.modelos = SPAP.modelos || {};

SPAP.modelos.planeamento = function (sub) {
const { eur, pct, date, esc, uid, today, r2, MES3, MESES, icon, ui, chart } = SPAP;
const CAIXA = sub.contaCaixa || 'CAIXA', OPER = sub.contaOperacional || 'OPERACIONAL', HOLD = sub.contaHolding || 'HOLDING';
const ENTRADA = 'ENTRADA DE FUNDOS';
let app;
const sum = (list, f) => r2(list.reduce((s, x) => s + (typeof f === 'function' ? f(x) : +x[f] || 0), 0));
const ymOf = (y, m) => `${y}-${String(m).padStart(2, '0')}`;
const tab = (k, def) => { try { return sessionStorage.getItem(sub.key + ':' + k) || def; } catch (e) { return def; } };
const setTab = (k, v) => { try { sessionStorage.setItem(sub.key + ':' + k, v); } catch (e) { } };
const linkPeds = peds => peds.map(p => `<a class="mono" href="#/pedidos/${p.id}" style="font-size:12px">${esc(p.numero)}</a>`).join(' ');
const vivos = key => app.db.pedidos.filter(p => p.origem && p.origem.key === key && !['REJEITADO', 'CANCELADO'].includes(p.estado));

/* ---------- Constantes (iguais às do Planeador) ---------- */
const MES_FERIAS = 6, MES_NATAL = 11;
const TIPOS_DIVIDA = [['habitacao', 'Habitação'], ['consumo', 'Consumo'], ['cartao', 'Cartão de crédito'], ['auto', 'Automóvel'], ['pessoal', 'Pessoal']];
const TIPOS_TAXA = [['TAN-fixa', 'TAN fixa'], ['TAN-variavel', 'TAN variável'], ['TAEG-fixa', 'TAEG fixa'], ['TAEG-variavel', 'TAEG variável']];
const PERIODOS = [['mensal', 'Mensal', 1], ['trimestral', 'Trimestral', 3], ['semestral', 'Semestral', 6], ['anual', 'Anual', 12]];
const CATS_DESP = ['Habitação', 'Alimentação', 'Serviços (água/luz/gás)', 'Comunicações', 'Seguros', 'Transportes', 'Saúde', 'Educação', 'Lazer', 'Outros'];
const ESTRATEGIAS = [['avalanche', 'Avalanche'], ['snowball', 'Snowball'], ['equilibrada', 'Equilibrada']];
const nomeTipo = k => (TIPOS_DIVIDA.find(t => t[0] === k) || [k, k])[1];
const nomeEstr = k => k === 'baseline' ? 'Só prestações' : (ESTRATEGIAS.find(t => t[0] === k) || [k, k])[1];
const BENCH = { dtiAviso: 0.35, dtiCritico: 0.50, poupMin: 0.10, poupBoa: 0.20, tanAlta: 0.15, tanCartao: 0.18, emergMin: 1, emergSeguro: 3 };
const PLANO_PADRAO = () => ({ salarioBase: 0, outrosRendimentos: 0, incluirRefeicao: true, extraFixo: 0, emergMeses: 3, emergProgressivo: 0,
  fundoOrigem: 'tesouraria', fundoInicial: 0, poupancaTipo: 'none', poupancaFixa: 0, poupancaPct: 0, horizonte: 240, diaSalario: 1 });

const M = () => { const m = app.db.mod; ['recibos', 'despesas', 'dividas', 'objetivos'].forEach(k => { if (!Array.isArray(m[k])) m[k] = []; });
  m.plano = Object.assign(PLANO_PADRAO(), m.plano || {}); return m; };

/* ---------- Motor: taxas, comissões e prestações ---------- */
// TAEG → taxa mensal composta; TAN → taxa anual / 12
const taxaMensal = d => String(d.tipoTaxa || '').toLowerCase().startsWith('taeg') ? Math.pow(1 + (+d.taxa || 0), 1 / 12) - 1 : (+d.taxa || 0) / 12;
// comissões legais de amortização antecipada (DL 74-A/2017 e DL 80-A/2022)
function comissaoLegal(tipo, tipoTaxa, meses) {
  if (tipo === 'habitacao') return String(tipoTaxa).includes('variavel') ? 0 : 0.005;
  if (tipo === 'cartao') return 0;
  if (['consumo', 'auto', 'pessoal'].includes(tipo)) return meses != null && meses !== '' && +meses <= 12 ? 0.0025 : 0.005;
  return 0;
}
// meses para liquidar uma dívida só com a prestação (sistema francês)
function mesesParaLiquidar(d) {
  const P = +d.capital || 0, A = +d.prestacao || 0, r = taxaMensal(d);
  if (P <= 0.005) return 0; if (A <= 0) return Infinity; if (r === 0) return Math.ceil(P / A);
  if (A <= r * P) return Infinity;
  return Math.ceil(-Math.log(1 - r * P / A) / Math.log(1 + r));
}
const mensalDesp = e => (+e.valor || 0) / ((PERIODOS.find(p => p[0] === e.periodicidade) || [0, 0, 1])[2]);
const despAtivas = () => M().despesas.filter(e => e.ativo !== false);
const divAtivas = () => M().dividas.filter(d => d.ativo !== false && (+d.capital || 0) > 0.005);
const despesasMensais = () => r2(despAtivas().reduce((s, e) => s + mensalDesp(e), 0));
const prestacoesMensais = () => r2(divAtivas().reduce((s, d) => s + (+d.prestacao || 0), 0));

/* ---------- Motor: rendimentos e projeção anual ---------- */
// líquido recorrente "limpo": o mais recente se estiver perto da mediana, senão o máximo sem outliers
function estimarLiquido(recibos, semRefeicao = true) {
  const c = recibos.filter(p => (+p.liquido || 0) > 0).map(p => ({ ano: +p.ano, mes: +p.mes, v: (+p.liquido || 0) - (semRefeicao ? +p.refeicao || 0 : 0) }));
  if (!c.length) return { base: 0, metodo: 'sem dados', n: 0 };
  const recente = c.slice().sort((a, b) => b.ano - a.ano || b.mes - a.mes)[0];
  const vs = c.map(x => x.v).sort((a, b) => a - b), n = vs.length, med = n % 2 ? vs[(n - 1) / 2] : (vs[n / 2 - 1] + vs[n / 2]) / 2;
  if (Math.abs(recente.v - med) / Math.max(med, 1) < 0.05) return { base: r2(recente.v), metodo: 'recibo mais recente', n, mediana: r2(med) };
  const limpos = c.map(x => x.v).filter(v => Math.abs(v - med) / Math.max(med, 1) < 0.15);
  return { base: r2(limpos.length ? Math.max(...limpos) : med), metodo: 'máximo sem valores atípicos', n, mediana: r2(med) };
}
const salarioBase = () => +M().plano.salarioBase || estimarLiquido(M().recibos).base || 0;
// YTD real + projeção até dezembro, com subsídios de férias (junho) e Natal (novembro) estimados se ainda não recebidos
function projecao(ano) {
  const rs = M().recibos.filter(p => +p.ano === +ano), base = salarioBase();
  const real = {}, ref = {}, so = [], refs = []; let temF = false, temN = false, valF = 0, valN = 0;
  rs.forEach(p => {
    const m = +p.mes, liq = +p.liquido || 0, rf = +p.refeicao || 0;
    real[m] = (real[m] || 0) + liq;
    if (rf > 0) { ref[m] = (ref[m] || 0) + rf; refs.push(rf); }
    if (p.subFerias) { temF = true; valF += +p.subFeriasValor || 0; }
    if (p.subNatal) { temN = true; valN += +p.subNatalValor || 0; }
    if (!p.subFerias && !p.subNatal) so.push(liq);
  });
  const media = so.length ? so.reduce((a, b) => a + b, 0) / so.length : base;
  const projF = temF ? valF : (base || media), projN = temN ? valN : (base || media);
  const mediaRef = refs.length ? refs.reduce((a, b) => a + b, 0) / refs.length : 0;
  const linhas = [];
  for (let m = 1; m <= 12; m++) {
    if (m in real) linhas.push({ m, real: r2(real[m]), proj: r2(real[m]), refeicao: r2(ref[m] || mediaRef), refReal: m in ref, sub: (m === MES_FERIAS && temF) || (m === MES_NATAL && temN) });
    else { let v = media, sb = false; if (m === MES_FERIAS && !temF) { v += projF; sb = true; } if (m === MES_NATAL && !temN) { v += projN; sb = true; }
      linhas.push({ m, real: null, proj: r2(v), refeicao: r2(mediaRef), sub: sb }); }
  }
  const ytd = r2(Object.values(real).reduce((a, b) => a + b, 0)), n = Object.keys(real).length;
  return { linhas, ytd, n, media: r2(media), mediaMes: n ? r2(ytd / n) : r2(media), total: sum(linhas, 'proj'), refeicaoTotal: sum(linhas, 'refeicao'), mediaRef: r2(mediaRef),
    subF: temF ? 0 : r2(projF), subN: temN ? 0 : r2(projN), temF, temN };
}
// rendimento líquido mensal médio a 12 meses (inclui subsídios, refeição se configurado e outros rendimentos)
function rendimentoMensal(ano = +today().slice(0, 4)) {
  const p = projecao(ano), pl = M().plano;
  return r2((p.total + (pl.incluirRefeicao ? p.refeicaoTotal : 0)) / 12 + (+pl.outrosRendimentos || 0));
}

/* ---------- Motor: simulador mês a mês (porta direta de simulator.py) ---------- */
function construirCashflow(horizonte) {
  const pl = M().plano, hoje = today(), y0 = +hoje.slice(0, 4), m0 = +hoje.slice(5, 7), desp = despesasMensais();
  const proj = {}, P = a => proj[a] || (proj[a] = projecao(a));
  const out = [];
  for (let i = 0; i < horizonte; i++) {
    const t = (m0 - 1) + i, y = y0 + Math.floor(t / 12), m = (t % 12) + 1;
    let inc;
    if (y === y0) { const l = P(y).linhas[m - 1]; inc = l.proj + (pl.incluirRefeicao ? l.refeicao : 0); }
    else { const p = P(y0), base = salarioBase() || p.media; inc = p.media + (m === MES_FERIAS || m === MES_NATAL ? base : 0) + (pl.incluirRefeicao ? p.mediaRef : 0); }
    out.push({ y, m, rendimento: inc + (+pl.outrosRendimentos || 0), despesas: desp });
  }
  return out;
}
function escolherAlvo(ds, estrategia) {
  const at = ds.filter(d => d.capital > 0.005); if (!at.length) return null;
  if (estrategia === 'snowball') return at.reduce((a, b) => b.capital < a.capital ? b : a);
  if (estrategia === 'equilibrada') {
    const rs = at.map(d => d.r), ps = at.map(d => d.capital), rmin = Math.min(...rs), pmin = Math.min(...ps);
    const rsp = (Math.max(...rs) - rmin) || 1, psp = (Math.max(...ps) - pmin) || 1;
    const sc = d => 0.6 * (d.r - rmin) / rsp + 0.4 * (1 - (d.capital - pmin) / psp);
    return at.reduce((a, b) => sc(b) > sc(a) ? b : a);
  }
  return at.reduce((a, b) => b.r > a.r ? b : a);
}
function simular(dividas, cf, o) {
  const ds = dividas.map(d => ({ id: d.id, nome: d.nome, capital: +d.capital || 0, r: taxaMensal(d), prest: +d.prestacao || 0, fee: Math.max(0, +d.comissao || 0) }));
  const fim = {}; ds.forEach(d => fim[d.id] = null);
  let livre = null, jurosT = 0, comT = 0, minT = 0, extraT = 0, emerg = +o.fundoInicial || 0, poup = 0;
  const meses = [];
  cf.forEach((m, idx) => {
    if (livre) return;
    const juros = ds.reduce((s, d) => s + (d.capital > 0 ? d.capital * d.r : 0), 0);
    let cash = Math.max(0, m.rendimento - m.despesas), minPago = 0;
    // 1) prestações contratadas (sem comissão); se não cobrirem o juro, o défice capitaliza
    ds.forEach(d => {
      if (d.capital <= 0) return;
      const j = d.capital * d.r, pg = Math.min(d.prest, cash, d.capital + j);
      if (pg <= 0) { d.capital += j; return; }
      if (pg < j) { d.capital += j - pg; minPago += pg; cash -= pg; return; }
      d.capital -= Math.min(d.capital, pg - j); minPago += pg; cash -= pg;
    });
    minT += minPago;
    // 2) poupança configurada
    const k = o.poupancaTipo, alvoP = k === 'fixed' ? o.poupancaFixa : k === 'percentage' ? m.rendimento * o.poupancaPct
      : k === 'percentage_surplus' ? Math.max(0, m.rendimento - m.despesas) * o.poupancaPct : k === 'percentage_after_min_payments' ? Math.max(0, m.rendimento - m.despesas - minPago) * o.poupancaPct : 0;
    const contP = Math.min(Math.max(0, alvoP), cash); poup += contP; cash -= contP;
    // 3) fundo de emergência (alvo imediato com teto mensal de 1/12, ou rampa linear)
    const alvoFinal = m.despesas * o.emergMeses, alvoE = o.emergProgressivo > 0 ? alvoFinal * Math.min(1, (idx + 1) / o.emergProgressivo) : alvoFinal;
    const tetoE = o.emergProgressivo > 0 ? Infinity : alvoFinal / 12;
    const contE = Math.min(Math.max(0, alvoE - emerg), cash, tetoE); emerg += contE;
    // 4) amortização extra, sempre na dívida-alvo da estratégia
    let extra = 0, com = 0; const porDiv = {};
    if (o.aplicarExtra) {
      let disp = cash - contE + Math.max(0, +o.extraFixo || 0);
      while (disp > 0.005) {
        const d = escolherAlvo(ds, o.estrategia); if (!d) break;
        const cap = Math.min(disp, disp / (1 + d.fee), d.capital); if (cap <= 0) break;
        const fee = cap * d.fee; d.capital -= cap; extra += cap; com += fee; porDiv[d.id] = (porDiv[d.id] || 0) + cap; disp -= cap + fee;
      }
      extraT += extra; comT += com;
    }
    jurosT += juros;
    meses.push({ y: m.y, m: m.m, rendimento: r2(m.rendimento), despesas: r2(m.despesas), prestacoes: r2(minPago), poupanca: r2(contP), poupancaSaldo: r2(poup),
      emergencia: r2(contE), emergenciaSaldo: r2(emerg), emergenciaAlvo: r2(alvoE), extra: r2(extra), comissoes: r2(com), juros: r2(juros),
      divida: r2(ds.reduce((s, d) => s + Math.max(0, d.capital), 0)), porDiv, saldos: Object.fromEntries(ds.map(d => [d.id, r2(Math.max(0, d.capital))])) });
    ds.forEach(d => { if (fim[d.id] == null && d.capital <= 0.01) fim[d.id] = ymOf(m.y, m.m); });
    if (ds.every(d => d.capital <= 0.01)) livre = ymOf(m.y, m.m);
  });
  return { estrategia: o.aplicarExtra ? o.estrategia : 'baseline', meses, fim, livre, juros: r2(jurosT), comissoes: r2(comT), prestacoes: r2(minT), extra: r2(extraT), poupado: 0 };
}
function opcoesPlano() {
  const pl = M().plano;
  return { extraFixo: +pl.extraFixo || 0, emergMeses: +pl.emergMeses || 0, emergProgressivo: +pl.emergProgressivo || 0, fundoInicial: fundoAtual(),
    poupancaTipo: pl.poupancaTipo, poupancaFixa: +pl.poupancaFixa || 0, poupancaPct: +pl.poupancaPct || 0 };
}
function compararEstrategias() {
  const pl = M().plano, cf = construirCashflow(Math.max(12, Math.min(480, +pl.horizonte || 240))), ds = divAtivas(), o = opcoesPlano();
  const base = simular(ds, cf, { ...o, estrategia: 'avalanche', aplicarExtra: false }), res = { baseline: base };
  ESTRATEGIAS.forEach(([k]) => { const r = simular(ds, cf, { ...o, estrategia: k, aplicarExtra: true }); r.poupado = r2(base.juros - r.juros); res[k] = r; });
  return res;
}

/* ---------- Fundos, saúde financeira e alertas ---------- */
const tesouraria = () => app.contasInternas().filter(c => c.categoria === 'TESOURARIA');
const fundoAtual = () => M().plano.fundoOrigem === 'manual' ? +M().plano.fundoInicial || 0 : r2(tesouraria().reduce((s, c) => s + app.saldo(c.id), 0));
function indicadores() {
  const rend = rendimentoMensal(), desp = despesasMensais(), prest = prestacoesMensais(), ds = divAtivas();
  const exc = r2(rend - desp - prest), divida = sum(ds, 'capital'), fundo = fundoAtual();
  const dti = rend > 0 ? prest / rend : null, poup = rend > 0 ? Math.max(0, exc) / rend : null, emerg = desp + prest > 0 ? fundo / (desp + prest) : null;
  const tanMedia = divida > 0 ? ds.reduce((s, d) => s + (+d.taxa || 0) * (+d.capital || 0), 0) / divida : 0;
  const comp = [];
  const lin = (v, a, b, max) => Math.round(Math.max(0, Math.min(max, max * (1 - (v - a) / (b - a)))));
  comp.push(dti == null ? { k: 'pf_dti', n: 'Taxa de esforço', p: 0, max: 25, t: 'Sem rendimento registado' }
    : { k: 'pf_dti', n: 'Taxa de esforço', p: dti <= 0.2 ? 25 : dti >= 0.5 ? 0 : lin(dti, 0.2, 0.5, 25), max: 25, t: `Prestações/rendimento = ${pct(dti)} (alvo ≤ 20%)` });
  comp.push(emerg == null ? { k: 'pf_emerg', n: 'Fundo de emergência', p: 0, max: 20, t: 'Sem despesas registadas' }
    : { k: 'pf_emerg', n: 'Fundo de emergência', p: Math.round(20 * Math.min(1, emerg / 6)), max: 20, t: `Cobre ${emerg.toLocaleString('pt-PT', { maximumFractionDigits: 1 })} meses de despesas (alvo ≥ 6)` });
  comp.push(poup == null ? { k: 'pf_poup', n: 'Taxa de poupança', p: 0, max: 20, t: 'Sem rendimento registado' }
    : { k: 'pf_poup', n: 'Taxa de poupança', p: Math.round(Math.min(20, 20 * poup / 0.2)), max: 20, t: `${pct(poup)} do rendimento líquido (alvo ≥ 20%)` });
  const cartoes = ds.filter(d => d.tipo === 'cartao'), revolving = cartoes.some(d => (+d.taxa || 0) >= 0.10);
  comp.push({ k: 'pf_div', n: 'Tipo de dívida', p: !ds.length ? 10 : cartoes.length >= 2 && revolving ? 2 : revolving ? 5 : 10, max: 10,
    t: !ds.length ? 'Sem dívidas ativas' : cartoes.length >= 2 && revolving ? 'Vários cartões com crédito rotativo caro' : revolving ? 'Cartão com crédito rotativo ativo' : 'Mix de dívidas razoável' });
  comp.push({ k: 'pf_custo', n: 'Custo médio da dívida', p: !ds.length ? 10 : tanMedia <= 0.05 ? 10 : tanMedia >= 0.15 ? 0 : lin(tanMedia, 0.05, 0.15, 10), max: 10,
    t: !ds.length ? 'Sem dívida ativa' : `Taxa ponderada ${pct(tanMedia)} (alvo ≤ 5%)` });
  const pts = comp.reduce((s, c) => s + c.p, 0), max = comp.reduce((s, c) => s + c.max, 0), score = Math.round(100 * pts / max);
  const nota = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F';
  const alertas = [];
  if (!M().recibos.length && !+M().plano.salarioBase) alertas.push(['info', `Ainda não há rendimentos. Registe recibos de vencimento em <a href="#/rendimentos" data-aba="pf-rend=rec">Rendimentos</a> ou indique o salário líquido em <a href="#/simulador" data-aba="pf-sim=par">Parâmetros do plano</a>.`]);
  if (dti != null && dti > BENCH.dtiCritico) alertas.push(['bad', `A taxa de esforço é ${pct(dti)}: mais de metade do rendimento vai para prestações.`]);
  else if (dti != null && dti > BENCH.dtiAviso) alertas.push(['warn', `A taxa de esforço é ${pct(dti)} (acima de 35%).`]);
  if (emerg != null && emerg < BENCH.emergMin) alertas.push(['bad', `O fundo de emergência cobre menos de 1 mês de despesas (${eur(fundo)}).`]);
  if (poup != null && poup < BENCH.poupMin) alertas.push(['warn', exc < 0 ? `As saídas mensais superam o rendimento em ${eur(-exc)}.` : `A taxa de poupança é só ${pct(poup)} (recomendado ≥ 10%).`]);
  ds.filter(d => d.tipo === 'cartao' ? (+d.taxa || 0) >= BENCH.tanCartao : (+d.taxa || 0) > BENCH.tanAlta).forEach(d => alertas.push(['warn', `<b>${esc(d.nome)}</b> tem uma taxa de ${pct(d.taxa)}: é a dívida mais cara a amortizar primeiro.`]));
  ds.filter(d => mesesParaLiquidar(d) === Infinity).forEach(d => alertas.push(['bad', `A prestação de <b>${esc(d.nome)}</b> não cobre os juros: a dívida cresce todos os meses.`]));
  return { rend, desp, prest, exc, divida, fundo, dti, poup, emerg, tanMedia, comp, score, nota, alertas };
}

/* ---------- Ligação ao SPAP: contas de entidade e pedidos ---------- */
function garantirConta(x, categoria, prefixo) {
  if (x.conta && app.conta(x.conta)) return x.conta;
  let id = prefixo + '_' + x.id; while (app.conta(id)) id += '1';
  app.db.contas.push({ id, codigo: (sub.sigla || 'PF') + '-' + prefixo + '-' + String(app.db.contas.length + 1).padStart(3, '0'), nome: x.credor || x.entidade || x.nome,
    tipo: 'INTERNA', categoria, saldoInicial: 0, ativo: true, criadoEm: new Date().toISOString() });
  app.log('CONTA_CRIADA', `${id} · ${x.credor || x.entidade || x.nome} (planeamento financeiro)`);
  x.conta = id; app.save(); return id;
}
// próxima data de cobrança (despesa) ou de prestação (dívida), a partir de hoje
function proxima(x, periodo = 'mensal', desde = today()) {
  const passo = (PERIODOS.find(p => p[0] === periodo) || [0, 0, 1])[2], dia = Math.min(28, Math.max(1, +x.dia || 1)), mesIni = Math.min(12, Math.max(1, +x.mes || 1));
  let y = +desde.slice(0, 4), m = +desde.slice(5, 7);
  for (let i = 0; i < 30; i++) {
    const d = `${ymOf(y, m)}-${String(dia).padStart(2, '0')}`;
    if (((m - mesIni) % passo + passo) % passo === 0 && d >= desde) return d;
    m++; if (m > 12) { m = 1; y++; }
  }
  return desde;
}
function ocorrencias(x, periodo, ini, fim) {
  const out = []; let d = proxima(x, periodo, ini);
  while (d <= fim && out.length < 60) { out.push(d); const n = new Date(d + 'T12:00:00'); n.setDate(n.getDate() + 1); d = proxima(x, periodo, n.toISOString().slice(0, 10)); }
  return out;
}
const chaveDesp = (x, d) => `pf:desp:${x.id}:${d.slice(0, 7)}`, chaveDiv = (x, d) => `pf:div:${x.id}:${d.slice(0, 7)}`, chaveRec = r => `pf:rend:${r.id}`;
function pedirDespesa(x) {
  const d = proxima(x, x.periodicidade), key = chaveDesp(x, d);
  if (vivos(key).length) { app.go('pedidos/' + vivos(key)[0].id); return; }
  const destino = garantirConta(x, 'FORNECEDOR', 'FN');
  app.novoPedido({ categoria: 'PAGAMENTO DE ENCARGOS E TAXAS', contaOrigem: x.contaOrigem || CAIXA, contaDestino: destino, valor: +x.valor || 0, metodo: 'DÉBITO',
    descricao: `${x.nome} · ${MESES[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`, dataPrevista: d, origem: { mod: 'despesas', key } });
}
function pedirPrestacao(x) {
  const d = proxima(x), key = chaveDiv(x, d);
  if (vivos(key).length) { app.go('pedidos/' + vivos(key)[0].id); return; }
  const destino = garantirConta(x, 'CRÉDITO', 'CR');
  app.novoPedido({ categoria: 'MENSALIDADE / PRESTAÇÃO', contaOrigem: x.contaOrigem || CAIXA, contaDestino: destino, valor: +x.prestacao || 0, metodo: 'DÉBITO',
    descricao: `Prestação ${x.nome} · ${MESES[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`, dataPrevista: d, origem: { mod: 'dividas', key } });
}
function pedirAmortizacao(x, valor) {
  const destino = garantirConta(x, 'CRÉDITO', 'CR');
  app.novoPedido({ categoria: 'LIQUIDAÇÃO DE CRÉDITO', contaOrigem: x.contaOrigem || CAIXA, contaDestino: destino, valor: r2(valor), metodo: 'DÉBITO',
    descricao: `Amortização antecipada ${x.nome}${+x.comissao ? ` (comissão ${pct(x.comissao)} incluída)` : ''}`, dataPrevista: today(), origem: { mod: 'dividas', key: `pf:amort:${x.id}:${uid()}` } });
}
function registarEntrada(r) {
  const key = chaveRec(r); if (vivos(key).length) { app.go('pedidos/' + vivos(key)[0].id); return; }
  app.novoPedido({ categoria: ENTRADA, contaDestino: CAIXA, valor: +r.liquido || 0, metodo: 'CAPITALIZAÇÃO', dataPrevista: today(),
    descricao: `Vencimento ${MESES[+r.mes - 1]} ${r.ano}${r.entidade ? ' · ' + r.entidade : ''}`, origem: { mod: 'rendimentos', key } });
}
const estadoPed = key => { const ps = vivos(key); return ps.length ? `${linkPeds(ps)} ${SPAP.ui.estadoBadge(ps[0].estado)}` : ''; };

/* ---------- Formulários ---------- */
function campo(c, x) {
  const val = x[c.k];
  if (c.type === 'check') return `<div class="fld ${c.full ? 'full' : ''}"><label>&nbsp;</label><label class="check"><input type="checkbox" name="${c.k}" ${val ? 'checked' : ''}> ${c.label}</label></div>`;
  if (c.type === 'select') return `<div class="fld ${c.full ? 'full' : ''}"><label>${c.label}</label><select class="inp" name="${c.k}">${c.opts.map(o => `<option value="${esc(o[0])}" ${String(o[0]) === String(val) ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select>${c.hint ? `<span class="hint">${c.hint}</span>` : ''}</div>`;
  const v2 = c.type === 'pct' ? (val == null || val === '' ? '' : r2((+val || 0) * 10000) / 100) : (val ?? '');
  const num = ['money', 'pct', 'number', 'int'].includes(c.type);
  return `<div class="fld ${c.full ? 'full' : ''}"><label>${c.label}${c.type === 'pct' ? ' (%)' : c.type === 'money' ? ' (€)' : ''}</label><input class="inp ${num ? 'num' : ''}" name="${c.k}" ${num ? `type="number" step="${c.type === 'int' ? 1 : 'any'}"` : c.type === 'date' ? 'type="date"' : ''} ${c.min != null ? `min="${c.min}"` : ''} ${c.max != null ? `max="${c.max}"` : ''} value="${esc(v2)}" ${c.ph ? `placeholder="${esc(c.ph)}"` : ''}>${c.hint ? `<span class="hint">${c.hint}</span>` : ''}</div>`;
}
function lerCampos(el, cols) {
  const f = ui.formData(el);
  cols.forEach(c => { if (c.type === 'pct') f[c.k] = f[c.k] === '' ? null : (+f[c.k] || 0) / 100; else if (['money', 'number'].includes(c.type)) f[c.k] = +f[c.k] || 0; else if (c.type === 'int') f[c.k] = f[c.k] === '' ? null : parseInt(f[c.k], 10) || 0; });
  return f;
}
function editar({ titulo, sub: subt, cols, x, novo, onSave, onDelete, validar }) {
  ui.modal({ title: (novo ? 'Adicionar · ' : 'Editar · ') + titulo, sub: subt || '', wide: cols.length > 6, body: `<form class="form">${cols.map(c => campo(c, x)).join('')}</form>`,
    actions: [...(!novo && onDelete ? [{ label: icon('trash') + 'Remover', kind: 'bad', onClick: async () => {
      if (!await ui.confirm('Remover', 'Remover este registo? Os pedidos já criados não são afetados.', { danger: true, okLabel: 'Remover' })) return false;
      onDelete(x); app.save(); app.refresh(); } }] : []),
    { label: 'Cancelar', kind: 'ghost' }, { label: 'Guardar', kind: 'primary', onClick: el => {
      const f = lerCampos(el, cols); const erro = validar && validar(f); if (erro) { ui.toast(erro, 'warn'); return false; }
      onSave(f); app.save(); app.refresh(); } }] });
}
const audit = (acao, txt) => app.log(acao, txt);
const podeEditar = () => app.can('criar');
const aviso = txt => `<div class="alert info" style="margin-bottom:16px">${icon('alert')}<div>${txt}</div></div>`;
const tabs = (k, def, lista) => { const t = tab(k, def); return { t, html: `<div class="tabs" style="margin-bottom:16px">${lista.map(([id, l]) => `<button data-tab="${k}=${id}" class="${t === id ? 'on' : ''}">${l}</button>`).join('')}</div>` }; };
const bindTabs = v => v.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { const [k, val] = b.dataset.tab.split('='); setTab(k, val); app.refresh(); });
const kpi = (rot, val, foot = '', cls = '', hero = false) => `<div class="card kpi ${hero ? 'hero' : ''}"><div class="lbl">${rot}</div><div class="val num ${cls}">${val}</div>${foot ? `<div class="foot">${foot}</div>` : ''}</div>`;
const fmtMes = k => k ? `${MESES[+k.slice(5, 7) - 1]} ${k.slice(0, 4)}` : '—';

/* ---------- Painel ---------- */
function visao(v) {
  const I = indicadores(), ano = +today().slice(0, 4), P = projecao(ano), kn = app.kn;
  const cor = I.score >= 75 ? 'var(--ok)' : I.score >= 50 ? 'var(--warn)' : 'var(--bad)';
  const R = compararEstrategias(), melhor = ESTRATEGIAS.map(e => R[e[0]]).sort((a, b) => (a.meses.length - b.meses.length) || (a.juros - b.juros))[0];
  v.innerHTML = `${I.alertas.map(([k, t]) => `<div class="alert ${k}" style="margin-bottom:10px">${icon('alert')}<div>${t}</div></div>`).join('')}
    <div class="grid g4" style="margin-top:${I.alertas.length ? 6 : 0}px">
      ${kpi(`${icon('wallet')} ${kn('pf_rend', 'Rendimento líquido mensal')}`, eur(I.rend), `média a 12 meses · ${P.n} ${P.n === 1 ? 'mês' : 'meses'} com recibo em ${ano}`, '', true)}
      ${kpi(`${icon('list')} ${kn('pf_desp', 'Despesas fixas / mês')}`, eur(I.desp), `<a href="#/despesas">${despAtivas().length} despesas</a>`)}
      ${kpi(`${icon('credit')} ${kn('pf_prest', 'Prestações / mês')}`, eur(I.prest), `<a href="#/dividas">${divAtivas().length} dívidas · ${eur(I.divida)}</a>`)}
      ${kpi(`${icon('coins')} ${kn('pf_exc', 'Excedente mensal')}`, eur(I.exc), I.rend > 0 ? `${pct(Math.max(0, I.exc) / I.rend)} do rendimento` : '', I.exc < 0 ? 'neg' : 'pos')}
    </div>
    <div class="grid g2" style="margin-top:16px">
      <div class="card"><div class="card-h"><h3>${kn('pf_saude', 'Saúde financeira')}</h3><span class="badge plain" style="background:${cor};color:#fff;font-size:14px">${I.nota} · ${I.score}/100</span></div>
        <div class="stack" style="gap:12px">${I.comp.map(c => `<div><div class="row between" style="font-size:13px;margin-bottom:5px"><span>${kn(c.k, c.n)}</span><b class="num">${c.p}/${c.max}</b></div>
          <div class="progress ${c.p / c.max < 0.4 ? 'bad' : c.p / c.max < 0.75 ? 'warn' : ''}"><i style="width:${Math.round(100 * c.p / c.max)}%"></i></div><div class="faint" style="font-size:12px;margin-top:3px">${esc(c.t)}</div></div>`).join('')}</div></div>
      <div class="card"><div class="card-h"><h3>${kn('pf_debtfree', 'Livre de dívidas')}</h3><a class="btn sm" href="#/simulador">${icon('target')} Simulador</a></div>
        ${divAtivas().length ? `<div class="kv" style="margin-bottom:14px"><div><span>Melhor estratégia</span><b>${esc(nomeEstr(melhor.estrategia))}</b></div><div><span>Data prevista</span><b>${melhor.livre ? fmtMes(melhor.livre) : 'além do horizonte'}</b></div>
          <div><span>Juros a pagar</span><b class="num">${eur(melhor.juros)}</b></div><div><span>Juros poupados vs só prestações</span><b class="num pos">${eur(melhor.poupado)}</b></div>
          <div><span>Fundo de emergência</span><b class="num">${eur(I.fundo)}</b></div><div><span>Cobertura</span><b>${I.emerg == null ? '—' : I.emerg.toLocaleString('pt-PT', { maximumFractionDigits: 1 }) + ' meses'}</b></div></div>
          <div id="chd"></div>` : '<div class="empty">Sem dívidas ativas. Registe créditos e cartões em <a href="#/dividas">Dívidas e créditos</a>.</div>'}</div>
    </div>
    <div class="card" style="margin-top:16px"><div class="card-h"><h3>${kn('pf_proj', 'Rendimento líquido')} ${ano}</h3><span class="sub">real ${eur(P.ytd)} · projetado ${eur(P.total)} · <a href="#/rendimentos" data-aba="pf-rend=proj">ver projeção</a></span></div><div id="chr"></div></div>`;
  chart.bars(v.querySelector('#chr'), { labels: MES3, stacked: true, series: [
    { name: 'Real', values: P.linhas.map(l => l.real || 0) }, { name: 'Projetado', values: P.linhas.map(l => l.real == null ? l.proj : 0), color: 'var(--accent2)' },
    ...(M().plano.incluirRefeicao && P.refeicaoTotal ? [{ name: 'Subsídio de refeição', values: P.linhas.map(l => l.refeicao), color: 'var(--info)' }] : [])] });
  const chd = v.querySelector('#chd');
  if (chd) { const ms = melhor.meses, passo = Math.max(1, Math.ceil(ms.length / 24)), pts = ms.filter((_, i) => i % passo === 0 || i === ms.length - 1);
    chart.linha(chd, { height: 170, labels: pts.map(x => `${MES3[x.m - 1]} ${String(x.y).slice(2)}`), series: [{ name: 'Dívida total', values: pts.map(x => x.divida) }] }); }
}

/* ---------- Rendimentos: recibos de vencimento e projeção ---------- */
const COLS_REC = () => [
  { k: 'ano', label: 'Ano', type: 'int', min: 2000, max: 2100 }, { k: 'mes', label: 'Mês', type: 'select', opts: MESES.map((n, i) => [i + 1, n]) },
  { k: 'entidade', label: 'Entidade patronal', ph: 'opcional' }, { k: 'nifEntidade', label: 'NIF da entidade', ph: 'opcional' },
  { k: 'bruto', label: 'Vencimento bruto', type: 'money' }, { k: 'liquido', label: 'Líquido recebido', type: 'money', hint: 'Total líquido do recibo, incluindo subsídios pagos nesse mês.' },
  { k: 'irs', label: 'Retenção de IRS', type: 'money' }, { k: 'ss', label: 'Segurança Social', type: 'money' },
  { k: 'refeicao', label: 'Subsídio de refeição', type: 'money', hint: 'Parte do líquido que é subsídio de refeição.' }, { k: 'notas', label: 'Notas' },
  { k: 'subFerias', label: 'Inclui subsídio de férias', type: 'check' }, { k: 'subFeriasValor', label: 'Valor do subsídio de férias', type: 'money' },
  { k: 'subNatal', label: 'Inclui subsídio de Natal', type: 'check' }, { k: 'subNatalValor', label: 'Valor do subsídio de Natal', type: 'money' }];
function editarRecibo(x) {
  const novo = !x, m = M(), ult = m.recibos.slice().sort((a, b) => b.ano - a.ano || b.mes - a.mes)[0];
  const r = x || (() => { const hoje = today(); return { ano: +hoje.slice(0, 4), mes: +hoje.slice(5, 7), entidade: ult ? ult.entidade : '', nifEntidade: ult ? ult.nifEntidade : '', refeicao: ult ? ult.refeicao : 0 }; })();
  editar({ titulo: 'Recibo de vencimento', sub: 'Introduza os valores do recibo. A entrada do dinheiro na tesouraria é feita por pedido SPAP.', cols: COLS_REC(), x: r, novo,
    validar: f => !(f.liquido > 0) ? 'Indique o líquido recebido' : !(f.ano >= 2000) ? 'Ano inválido' : null,
    onSave: f => { f.mes = +f.mes; Object.assign(r, f); if (novo) { r.id = 'R' + uid(); r.criadoEm = new Date().toISOString(); m.recibos.push(r); }
      audit('PF_RECIBO', `${MESES[r.mes - 1]} ${r.ano} · líquido ${eur(r.liquido)}`); },
    onDelete: novo ? null : y => { m.recibos = m.recibos.filter(z => z !== y); audit('PF_RECIBO_REMOVIDO', `${MESES[y.mes - 1]} ${y.ano}`); } });
}
function rendimentos(v) {
  const T = tabs('pf-rend', 'rec', [['rec', 'Recibos de vencimento'], ['proj', 'Projeção anual']]), m = M(), kn = app.kn, ed = podeEditar();
  const anos = [...new Set([+today().slice(0, 4), ...m.recibos.map(r => +r.ano)])].sort((a, b) => b - a);
  let ano = +tab('pf-ano', anos[0]); if (!anos.includes(ano)) ano = anos[0];
  const anoSel = `<select class="inp inp-sm" id="pfa">${anos.map(y => `<option ${y === ano ? 'selected' : ''}>${y}</option>`).join('')}</select>`;
  const est = estimarLiquido(m.recibos);
  if (T.t === 'rec') {
    const rs = m.recibos.filter(r => +r.ano === ano).sort((a, b) => b.mes - a.mes);
    v.innerHTML = `${T.html}<div class="row between" style="margin-bottom:16px"><div class="row"><span class="muted">Ano</span>${anoSel}</div>${ed ? `<button class="btn primary" id="nr">${icon('plus')} Registar recibo</button>` : ''}</div>
      <div class="grid g4">${kpi(`${icon('wallet')} Líquido recebido ${ano}`, eur(sum(rs, 'liquido')), `${rs.length} ${rs.length === 1 ? 'recibo' : 'recibos'}`, '', true)}${kpi('Bruto ' + ano, eur(sum(rs, 'bruto')))}${kpi('IRS retido', eur(sum(rs, 'irs')), `SS ${eur(sum(rs, 'ss'))}`)}
        ${kpi(kn('pf_liqrec', 'Líquido recorrente'), eur(salarioBase()), +m.plano.salarioBase ? 'definido nos parâmetros' : est.n ? esc(est.metodo) : 'sem recibos')}</div>
      <div class="card flush" style="margin-top:16px"><div class="card-h"><h3>Recibos ${ano}</h3><span class="sub">clique numa linha para editar</span></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Mês</th><th>Entidade</th><th class="r">Bruto</th><th class="r">IRS</th><th class="r">SS</th><th class="r">Refeição</th><th class="r">Líquido</th><th>Subsídios</th><th>Entrada na tesouraria</th></tr></thead><tbody>
      ${rs.map(r => { const ps = estadoPed(chaveRec(r)); return `<tr class="${ed ? 'click' : ''}" data-r="${r.id}"><td><b>${MESES[r.mes - 1]}</b></td><td>${esc(r.entidade || '—')}</td><td class="r num">${eur(r.bruto)}</td><td class="r num">${eur(r.irs)}</td><td class="r num">${eur(r.ss)}</td><td class="r num">${eur(r.refeicao)}</td><td class="r num"><b>${eur(r.liquido)}</b></td>
        <td>${r.subFerias ? '<span class="badge info">Férias</span> ' : ''}${r.subNatal ? '<span class="badge info">Natal</span>' : ''}</td>
        <td>${ps || (app.can('criar') ? `<button class="btn sm" data-e="${r.id}">${icon('download')} Registar entrada</button>` : '<span class="faint">—</span>')}</td></tr>`; }).join('') || '<tr><td colspan="9" class="empty">Sem recibos neste ano.</td></tr>'}</tbody></table></div></div>`;
    v.querySelectorAll('[data-r]').forEach(tr => tr.onclick = e => { if (e.target.closest('button,a') || !ed) return; editarRecibo(m.recibos.find(r => r.id === tr.dataset.r)); });
    v.querySelectorAll('[data-e]').forEach(b => b.onclick = () => registarEntrada(m.recibos.find(r => r.id === b.dataset.e)));
    const nr = v.querySelector('#nr'); if (nr) nr.onclick = () => editarRecibo();
  } else {
    const P = projecao(ano), refOn = m.plano.incluirRefeicao;
    v.innerHTML = `${T.html}<div class="row" style="margin-bottom:16px"><span class="muted">Ano</span>${anoSel}</div>
      <div class="grid g4">${kpi(`${icon('chart')} ${kn('pf_proj', 'Projeção anual líquida')}`, eur(P.total + (refOn ? P.refeicaoTotal : 0)), refOn ? `inclui ${eur(P.refeicaoTotal)} de refeição` : 'sem subsídio de refeição', '', true)}
        ${kpi('Recebido até agora (YTD)', eur(P.ytd), `${P.n} meses com recibo`)}${kpi('Média mensal (sem subsídios)', eur(P.media))}
        ${kpi('Subsídios por receber', eur(P.subF + P.subN), `${P.temF ? 'férias recebido' : 'férias ' + eur(P.subF)} · ${P.temN ? 'Natal recebido' : 'Natal ' + eur(P.subN)}`)}</div>
      <div class="card" style="margin-top:16px"><div class="card-h"><h3>Mês a mês</h3><span class="sub">meses sem recibo usam a média; subsídios estimados em junho e novembro</span></div><div id="ch"></div></div>
      <div class="card flush" style="margin-top:16px"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Mês</th><th class="r">Real</th><th class="r">Projetado</th><th class="r">Refeição</th><th>Notas</th></tr></thead><tbody>
      ${P.linhas.map(l => `<tr><td><b>${MESES[l.m - 1]}</b></td><td class="r num">${l.real == null ? '<span class="faint">—</span>' : eur(l.real)}</td><td class="r num">${eur(l.proj)}</td><td class="r num">${eur(l.refeicao)}</td><td>${l.real == null ? '<span class="badge">estimado</span> ' : '<span class="badge ok">recibo</span> '}${l.sub ? '<span class="badge info">subsídio</span>' : ''}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td>TOTAL</td><td class="r num">${eur(P.ytd)}</td><td class="r num">${eur(P.total)}</td><td class="r num">${eur(P.refeicaoTotal)}</td><td></td></tr></tfoot></table></div></div>`;
    chart.bars(v.querySelector('#ch'), { labels: MES3, stacked: true, series: [{ name: 'Real', values: P.linhas.map(l => l.real || 0) }, { name: 'Projetado', values: P.linhas.map(l => l.real == null ? l.proj : 0), color: 'var(--accent2)' },
      ...(refOn && P.refeicaoTotal ? [{ name: 'Subsídio de refeição', values: P.linhas.map(l => l.refeicao), color: 'var(--info)' }] : [])] });
  }
  bindTabs(v); const s = v.querySelector('#pfa'); if (s) s.onchange = () => { setTab('pf-ano', s.value); app.refresh(); };
}

/* ---------- Despesas fixas ---------- */
const optsContas = () => tesouraria().map(c => [c.id, c.nome]);
const COLS_DESP = () => [{ k: 'nome', label: 'Designação', ph: 'ex.: Renda, Eletricidade' }, { k: 'categoria', label: 'Categoria', type: 'select', opts: CATS_DESP.map(c => [c, c]) },
  { k: 'valor', label: 'Valor por cobrança', type: 'money' }, { k: 'periodicidade', label: 'Periodicidade', type: 'select', opts: PERIODOS.map(p => [p[0], p[1]]) },
  { k: 'mes', label: 'Mês da 1.ª cobrança', type: 'select', opts: MESES.map((n, i) => [i + 1, n]), hint: 'Só conta nas despesas trimestrais, semestrais e anuais.' },
  { k: 'dia', label: 'Dia de cobrança', type: 'int', min: 1, max: 28 }, { k: 'entidade', label: 'Entidade a pagar', ph: 'ex.: EDP Comercial' },
  { k: 'contaOrigem', label: 'Pagar a partir de', type: 'select', opts: optsContas() },
  { k: 'variavel', label: 'Valor variável (é uma média)', type: 'check' }, { k: 'ativo', label: 'Ativa', type: 'check' }];
function despesas(v) {
  const m = M(), ed = podeEditar(), at = despAtivas(), tot = despesasMensais(), kn = app.kn;
  const porCat = CATS_DESP.map(c => ({ label: c, value: r2(at.filter(e => e.categoria === c).reduce((s, e) => s + mensalDesp(e), 0)) })).filter(x => x.value > 0);
  v.innerHTML = `<div class="row between" style="margin-bottom:16px"><span class="muted">Encargos que se repetem (renda, serviços, seguros…). As prestações de créditos registam-se em <a href="#/dividas">Dívidas e créditos</a>.</span>${ed ? `<button class="btn primary" id="nd">${icon('plus')} Nova despesa</button>` : ''}</div>
    <div class="grid g3">${kpi(`${icon('list')} ${kn('pf_desp', 'Despesas fixas / mês')}`, eur(tot), `${at.length} ativas`, '', true)}${kpi('Por ano', eur(tot * 12))}${kpi('Peso no rendimento', rendimentoMensal() > 0 ? pct(tot / rendimentoMensal()) : '—', 'face ao rendimento líquido mensal')}</div>
    <div class="grid g2" style="margin-top:16px;grid-template-columns:2fr 1fr">
      <div class="card flush"><div class="card-h"><h3>Despesas</h3><span class="sub">o pedido de pagamento segue o circuito de autorização</span></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Despesa</th><th>Periodicidade</th><th class="r">Valor</th><th class="r">Mensal</th><th>Próxima</th><th>Pedido</th></tr></thead><tbody>
      ${m.despesas.map(e => { const d = proxima(e, e.periodicidade), ps = estadoPed(chaveDesp(e, d)); return `<tr class="${ed ? 'click' : ''}" data-d="${e.id}" style="${e.ativo === false ? 'opacity:.5' : ''}"><td><b>${esc(e.nome)}</b><div class="faint" style="font-size:12px">${esc(e.categoria || '')}${e.entidade ? ' · ' + esc(e.entidade) : ''}${e.variavel ? ' · variável' : ''}</div></td>
        <td>${esc((PERIODOS.find(p => p[0] === e.periodicidade) || [0, e.periodicidade])[1])}</td><td class="r num">${eur(e.valor)}</td><td class="r num">${eur(mensalDesp(e))}</td><td>${date(d)}</td>
        <td>${e.ativo === false ? '<span class="faint">inativa</span>' : ps || (app.can('criar') ? `<button class="btn sm" data-p="${e.id}">Pedir ${eur(e.valor)}</button>` : '—')}</td></tr>`; }).join('') || '<tr><td colspan="6" class="empty">Sem despesas fixas.</td></tr>'}</tbody></table></div></div>
      <div class="card"><div class="card-h"><h3>Por categoria</h3><span class="sub">equivalente mensal</span></div><div id="dn"></div></div></div>`;
  chart.donut(v.querySelector('#dn'), { items: porCat, center: eur(tot), sub: 'por mês' });
  const ed1 = e => { const novo = !e, x = e || { categoria: 'Outros', periodicidade: 'mensal', mes: +today().slice(5, 7), dia: 1, contaOrigem: CAIXA, ativo: true, valor: 0 };
    editar({ titulo: 'Despesa fixa', cols: COLS_DESP(), x, novo, validar: f => !f.nome ? 'Indique a designação' : !(f.valor > 0) ? 'Indique o valor' : null,
      onSave: f => { f.mes = +f.mes; Object.assign(x, f); if (novo) { x.id = 'D' + uid(); m.despesas.push(x); } const c = x.conta && app.conta(x.conta); if (c && f.entidade) c.nome = f.entidade; audit('PF_DESPESA', `${x.nome} · ${eur(x.valor)} ${x.periodicidade}`); },
      onDelete: y => { m.despesas = m.despesas.filter(z => z !== y); audit('PF_DESPESA_REMOVIDA', y.nome); } }); };
  v.querySelectorAll('[data-d]').forEach(tr => tr.onclick = e => { if (e.target.closest('button,a') || !ed) return; ed1(m.despesas.find(x => x.id === tr.dataset.d)); });
  v.querySelectorAll('[data-p]').forEach(b => b.onclick = () => pedirDespesa(m.despesas.find(x => x.id === b.dataset.p)));
  const nd = v.querySelector('#nd'); if (nd) nd.onclick = () => ed1();
}

/* ---------- Dívidas e créditos ---------- */
const COLS_DIV = () => [{ k: 'nome', label: 'Designação', ph: 'ex.: Crédito habitação' }, { k: 'credor', label: 'Credor', ph: 'ex.: Banco X' },
  { k: 'tipo', label: 'Tipo', type: 'select', opts: TIPOS_DIVIDA }, { k: 'tipoTaxa', label: 'Tipo de taxa', type: 'select', opts: TIPOS_TAXA },
  { k: 'capital', label: 'Capital em dívida', type: 'money' }, { k: 'taxa', label: 'Taxa anual', type: 'pct' },
  { k: 'prestacao', label: 'Prestação mensal', type: 'money' }, { k: 'meses', label: 'Meses em falta', type: 'int', min: 0 },
  { k: 'comissao', label: 'Comissão de amortização antecipada', type: 'pct', hint: 'Deixe vazio para usar a comissão legal (0,5% / 0,25% / 0%).' },
  { k: 'dia', label: 'Dia da prestação', type: 'int', min: 1, max: 28 }, { k: 'contaOrigem', label: 'Pagar a partir de', type: 'select', opts: optsContas() }, { k: 'ativo', label: 'Ativa', type: 'check' }];
function dividas(v) {
  const m = M(), ed = podeEditar(), ds = divAtivas(), kn = app.kn, tot = sum(ds, 'capital');
  const jurosMes = r2(ds.reduce((s, d) => s + d.capital * taxaMensal(d), 0)), tan = tot > 0 ? ds.reduce((s, d) => s + d.taxa * d.capital, 0) / tot : 0;
  v.innerHTML = `<div class="row between" style="margin-bottom:16px"><span class="muted">Créditos, cartões e empréstimos. O capital em dívida atualiza-se aqui depois de cada prestação ou amortização.</span>${ed ? `<button class="btn primary" id="nv">${icon('plus')} Nova dívida</button>` : ''}</div>
    <div class="grid g4">${kpi(`${icon('credit')} Capital em dívida`, eur(tot), `${ds.length} dívidas ativas`, '', true)}${kpi(kn('pf_prest', 'Prestações / mês'), eur(prestacoesMensais()))}
      ${kpi('Juros deste mês', eur(jurosMes), 'sobre o capital atual')}${kpi(kn('pf_custo', 'Taxa média ponderada'), pct(tan))}</div>
    <div class="card flush" style="margin-top:16px"><div class="card-h"><h3>Dívidas</h3><span class="sub">clique numa linha para editar</span></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Dívida</th><th class="r">Capital</th><th class="r">${kn('pf_tan', 'Taxa')}</th><th class="r">Prestação</th><th class="r">Juro / mês</th><th>Fim só com prestações</th><th>Prestação seguinte</th><th></th></tr></thead><tbody>
    ${m.dividas.map(d => { const n = mesesParaLiquidar(d), pr = proxima(d), ps = estadoPed(chaveDiv(d, pr)), on = d.ativo !== false && d.capital > 0.005;
      return `<tr class="${ed ? 'click' : ''}" data-v="${d.id}" style="${on ? '' : 'opacity:.5'}"><td><b>${esc(d.nome)}</b><div class="faint" style="font-size:12px">${esc(nomeTipo(d.tipo))}${d.credor ? ' · ' + esc(d.credor) : ''}</div></td>
      <td class="r num">${eur(d.capital)}</td><td class="r num">${pct(d.taxa)} <span class="faint" style="font-size:11px">${esc((d.tipoTaxa || '').replace('-', ' '))}</span></td><td class="r num">${eur(d.prestacao)}</td><td class="r num">${eur(d.capital * taxaMensal(d))}</td>
      <td>${!on ? '<span class="badge ok">liquidada</span>' : n === Infinity ? '<span class="badge bad">nunca (juro > prestação)</span>' : `${n} meses`}</td>
      <td>${on ? ps || (app.can('criar') ? `<button class="btn sm" data-p="${d.id}">Pedir ${eur(d.prestacao)}</button>` : date(pr)) : '—'}</td>
      <td class="r">${on && app.can('criar') ? `<button class="btn sm ghost" data-a="${d.id}">Amortizar</button>` : ''}</td></tr>`; }).join('') || '<tr><td colspan="8" class="empty">Sem dívidas registadas.</td></tr>'}</tbody></table></div></div>`;
  const ed1 = d0 => { const novo = !d0, x = d0 || { tipo: 'consumo', tipoTaxa: 'TAN-fixa', dia: 1, contaOrigem: CAIXA, ativo: true, capital: 0, taxa: 0, prestacao: 0, comissao: null };
    editar({ titulo: 'Dívida / crédito', cols: COLS_DIV(), x, novo, validar: f => !f.nome ? 'Indique a designação' : f.capital < 0 ? 'Capital inválido' : null,
      onSave: f => { if (f.comissao == null) f.comissao = comissaoLegal(f.tipo, f.tipoTaxa, f.meses); Object.assign(x, f); if (novo) { x.id = 'V' + uid(); m.dividas.push(x); }
        const c = x.conta && app.conta(x.conta); if (c && f.credor) c.nome = f.credor; audit('PF_DIVIDA', `${x.nome} · capital ${eur(x.capital)} · ${pct(x.taxa)}`); },
      onDelete: y => { m.dividas = m.dividas.filter(z => z !== y); audit('PF_DIVIDA_REMOVIDA', y.nome); } }); };
  v.querySelectorAll('[data-v]').forEach(tr => tr.onclick = e => { if (e.target.closest('button,a') || !ed) return; ed1(m.dividas.find(x => x.id === tr.dataset.v)); });
  v.querySelectorAll('[data-p]').forEach(b => b.onclick = () => pedirPrestacao(m.dividas.find(x => x.id === b.dataset.p)));
  v.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { const d = m.dividas.find(x => x.id === b.dataset.a);
    ui.modal({ title: 'Amortização antecipada · ' + esc(d.nome), sub: `Capital em dívida ${eur(d.capital)} · comissão ${pct(d.comissao || 0)}`, body: `<form class="form"><div class="fld full"><label>Capital a amortizar (€)</label><input class="inp num" type="number" step="any" name="v" value="${r2(Math.min(d.capital, Math.max(0, indicadores().exc)))}"></div><div class="fld full" id="am"></div></form>`,
      onOpen: el => { const upd = () => { const c = Math.min(+ui.formData(el).v || 0, d.capital), fee = r2(c * (+d.comissao || 0)), poup = r2(c * taxaMensal(d));
        el.querySelector('#am').innerHTML = `<div class="kv"><div><span>Comissão</span><b class="num">${eur(fee)}</b></div><div><span>Total do pedido</span><b class="num">${eur(c + fee)}</b></div><div><span>Juro poupado já no próximo mês</span><b class="num pos">${eur(poup)}</b></div><div><span>Capital depois</span><b class="num">${eur(d.capital - c)}</b></div></div>`; };
        el.querySelector('[name=v]').addEventListener('input', upd); upd(); },
      actions: [{ label: 'Cancelar', kind: 'ghost' }, { label: 'Criar pedido', kind: 'primary', onClick: el => { const c = Math.min(+ui.formData(el).v || 0, d.capital); if (!(c > 0)) { ui.toast('Indique o valor', 'warn'); return false; }
        setTimeout(() => pedirAmortizacao(d, c * (1 + (+d.comissao || 0))), 0); } }] }); });
  const nv = v.querySelector('#nv'); if (nv) nv.onclick = () => ed1();
}

/* ---------- Simulador de estratégias e parâmetros do plano ---------- */
const COLS_PLANO = () => [
  { k: 'salarioBase', label: 'Salário líquido recorrente', type: 'money', hint: `Deixe 0 para estimar pelos recibos (${eur(estimarLiquido(M().recibos).base)}).` },
  { k: 'outrosRendimentos', label: 'Outros rendimentos mensais', type: 'money', hint: 'Rendas, recibos verdes, pensões…' },
  { k: 'incluirRefeicao', label: 'Contar o subsídio de refeição como rendimento', type: 'check' },
  { k: 'extraFixo', label: 'Amortização extra fixa por mês', type: 'money', hint: 'Somada ao excedente do mês.' },
  { k: 'emergMeses', label: 'Fundo de emergência (meses de despesas)', type: 'number' }, { k: 'emergProgressivo', label: 'Atingir o fundo em (meses)', type: 'int', min: 0, hint: '0 = alvo imediato, com reforço máximo de 1/12 por mês.' },
  { k: 'fundoOrigem', label: 'Saldo atual do fundo', type: 'select', opts: [['tesouraria', 'Saldos das contas de tesouraria'], ['manual', 'Valor indicado abaixo']] },
  { k: 'fundoInicial', label: 'Valor do fundo (se manual)', type: 'money' },
  { k: 'poupancaTipo', label: 'Poupança mensal', type: 'select', opts: [['none', 'Sem poupança separada'], ['fixed', 'Valor fixo'], ['percentage', '% do rendimento'], ['percentage_surplus', '% do excedente'], ['percentage_after_min_payments', '% do excedente depois das prestações']] },
  { k: 'poupancaFixa', label: 'Poupança fixa', type: 'money' }, { k: 'poupancaPct', label: 'Poupança em %', type: 'pct' },
  { k: 'horizonte', label: 'Horizonte da simulação (meses)', type: 'int', min: 12, max: 480 }];
function simulador(v) {
  const T = tabs('pf-sim', 'est', [['est', 'Comparar estratégias'], ['plano', 'Plano mês a mês'], ['par', 'Parâmetros do plano']]), m = M(), kn = app.kn;
  if (T.t === 'par') {
    const cols = COLS_PLANO();
    v.innerHTML = `${T.html}<div class="card"><div class="card-h"><h3>Parâmetros do plano</h3><span class="sub">usados no painel, no simulador e nos objetivos</span></div><form class="form" id="pp">${cols.map(c => campo(c, m.plano)).join('')}</form>
      <div class="row" style="justify-content:flex-end;margin-top:14px">${podeEditar() ? `<button class="btn primary" id="gp">Guardar parâmetros</button>` : ''}</div></div>`;
    bindTabs(v);
    const gp = v.querySelector('#gp'); if (gp) gp.onclick = () => { const f = lerCampos(v.querySelector('#pp'), cols);
      f.horizonte = Math.max(12, Math.min(480, f.horizonte || 240)); f.emergProgressivo = Math.max(0, f.emergProgressivo || 0); f.poupancaPct = f.poupancaPct || 0;
      Object.assign(m.plano, f); audit('PF_PLANO', 'Parâmetros do plano financeiro alterados'); app.save(); ui.toast('Parâmetros guardados', 'ok'); app.refresh(); };
    return;
  }
  const ds = divAtivas();
  if (!ds.length) { v.innerHTML = `${T.html}<div class="empty">Sem dívidas ativas para simular. Registe-as em <a href="#/dividas">Dívidas e créditos</a>.</div>`; bindTabs(v); return; }
  const R = compararEstrategias(), ks = ['baseline', ...ESTRATEGIAS.map(e => e[0])];
  const melhor = ESTRATEGIAS.map(e => R[e[0]]).sort((a, b) => (a.meses.length - b.meses.length) || (a.juros - b.juros))[0].estrategia;
  let esc1 = tab('pf-estr', melhor); if (!R[esc1]) esc1 = melhor;
  const I = indicadores();
  if (T.t === 'est') {
    const n = Math.max(...ks.map(k => R[k].meses.length)), passo = Math.max(1, Math.ceil(n / 30)), idx = [...Array(n).keys()].filter(i => i % passo === 0 || i === n - 1);
    const lab = idx.map(i => { const t = R.baseline.meses[i] || R[ks.find(k => R[k].meses[i])].meses[i]; return `${MES3[t.m - 1]} ${String(t.y).slice(2)}`; });
    v.innerHTML = `${T.html}<div class="alert info" style="margin-bottom:16px">${icon('target')}<div>Todos os meses: paga as prestações, separa a poupança e o ${kn('pf_emerg', 'fundo de emergência')}, e usa o resto (${eur(Math.max(0, I.exc))}${+m.plano.extraFixo ? ` + ${eur(m.plano.extraFixo)} fixos` : ''}) para amortizar a dívida escolhida pela estratégia. Ajuste em <a href="#/simulador" data-aba="pf-sim=par">Parâmetros do plano</a>.</div></div>
      <div class="grid g4">${ks.map(k => { const r = R[k]; return `<div class="card kpi ${k === melhor ? 'hero' : ''}"><div class="lbl">${k === 'baseline' ? 'Só prestações' : kn('pf_' + k, nomeEstr(k))}${k === melhor ? ' · <b>melhor</b>' : ''}</div>
        <div class="val" style="font-size:20px">${r.livre ? fmtMes(r.livre) : 'além do horizonte'}</div><div class="foot">${r.livre ? r.meses.length + ' meses · ' : ''}juros ${eur(r.juros)}${k !== 'baseline' ? `<br>poupa <b class="pos">${eur(r.poupado)}</b> em juros · comissões ${eur(r.comissoes)}` : ''}</div></div>`; }).join('')}</div>
      <div class="card" style="margin-top:16px"><div class="card-h"><h3>Dívida total ao longo do tempo</h3></div><div id="ch"></div></div>
      <div class="card flush" style="margin-top:16px"><div class="card-h"><h3>Quando fica liquidada cada dívida</h3></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Dívida</th><th class="r">Capital</th><th class="r">Taxa</th>${ks.map(k => `<th>${esc(nomeEstr(k))}</th>`).join('')}</tr></thead><tbody>
      ${ds.map(d => `<tr><td><b>${esc(d.nome)}</b></td><td class="r num">${eur(d.capital)}</td><td class="r num">${pct(d.taxa)}</td>${ks.map(k => `<td>${R[k].fim[d.id] ? fmtMes(R[k].fim[d.id]) : '<span class="faint">—</span>'}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
    chart.linha(v.querySelector('#ch'), { labels: lab, series: ks.map((k, i) => ({ name: nomeEstr(k), dash: k === 'baseline', values: idx.map(j => R[k].meses[j] ? R[k].meses[j].divida : 0) })) });
  } else {
    const r = R[esc1], nomes = Object.fromEntries(ds.map(d => [d.id, d.nome]));
    v.innerHTML = `${T.html}<div class="row between" style="margin-bottom:16px"><div class="row"><span class="muted">Estratégia</span><select class="inp inp-sm" id="es">${ESTRATEGIAS.map(([k, l]) => `<option value="${k}" ${k === esc1 ? 'selected' : ''}>${l}${k === melhor ? ' (melhor)' : ''}</option>`).join('')}</select></div><span class="muted" style="font-size:12px">${r.livre ? 'livre de dívidas em ' + fmtMes(r.livre) : 'não fica liquidado no horizonte'}</span></div>
      <div class="card flush"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Mês</th><th class="r">Rendimento</th><th class="r">Despesas</th><th class="r">Prestações</th><th class="r">Poupança</th><th class="r">Fundo emerg.</th><th class="r">Amortização extra</th><th>Dívida-alvo</th><th class="r">Juros</th><th class="r">Dívida total</th></tr></thead><tbody>
      ${r.meses.slice(0, 120).map(x => `<tr><td><b>${MES3[x.m - 1]} ${x.y}</b></td><td class="r num">${eur(x.rendimento)}</td><td class="r num">${eur(x.despesas)}</td><td class="r num">${eur(x.prestacoes)}</td><td class="r num">${eur(x.poupanca)}</td>
        <td class="r num">${eur(x.emergencia)}<div class="faint" style="font-size:11px">${eur(x.emergenciaSaldo)} / ${eur(x.emergenciaAlvo)}</div></td><td class="r num">${eur(x.extra + x.comissoes)}</td>
        <td style="font-size:12px">${Object.entries(x.porDiv).map(([id, val]) => `${esc(nomes[id] || id)} <span class="num">${eur(val)}</span>`).join('<br>') || '<span class="faint">—</span>'}</td><td class="r num">${eur(x.juros)}</td><td class="r num"><b>${eur(x.divida)}</b></td></tr>`).join('')}</tbody></table></div></div>
      ${r.meses.length > 120 ? '<p class="faint" style="font-size:12px">Mostram-se os primeiros 120 meses.</p>' : ''}`;
    v.querySelector('#es').onchange = e => { setTab('pf-estr', e.target.value); app.refresh(); };
  }
  bindTabs(v);
}

/* ---------- Objetivos e compras ---------- */
const COLS_OBJ = () => [{ k: 'nome', label: 'Objetivo', ph: 'ex.: Entrada para casa' }, { k: 'alvo', label: 'Valor necessário', type: 'money' }, { k: 'poupado', label: 'Já poupado', type: 'money' },
  { k: 'data', label: 'Data pretendida', type: 'date' }, { k: 'prioridade', label: 'Prioridade', type: 'select', opts: [[1, '1 · Máxima'], [2, '2 · Alta'], [3, '3 · Média'], [4, '4 · Baixa'], [5, '5 · Mínima']] }, { k: 'notas', label: 'Notas' }];
function objetivos(v) {
  const m = M(), ed = podeEditar(), I = indicadores(), hoje = today();
  const mesesAte = d => { if (!d) return null; const a = (+d.slice(0, 4) - +hoje.slice(0, 4)) * 12 + (+d.slice(5, 7) - +hoje.slice(5, 7)); return Math.max(1, a); };
  let disp = Math.max(0, I.exc);
  const lista = m.objetivos.slice().sort((a, b) => (+a.prioridade || 3) - (+b.prioridade || 3) || String(a.data || '9').localeCompare(String(b.data || '9'))).map(o => {
    const falta = Math.max(0, (+o.alvo || 0) - (+o.poupado || 0)), n = mesesAte(o.data), mensal = falta <= 0 ? 0 : n ? falta / n : 0;
    const cobre = Math.min(disp, mensal); disp = Math.max(0, disp - mensal);
    const estado = falta <= 0 ? ['ok', 'atingido'] : !n ? ['', 'sem data'] : cobre >= mensal - 0.005 ? ['ok', 'viável'] : cobre > 0 ? ['warn', 'em risco'] : ['bad', 'sem margem'];
    const quando = falta > 0 && mensal > 0 && cobre > 0 && cobre < mensal ? SPAP.addMonths(hoje, Math.ceil(falta / cobre)) : null;
    return { o, falta, n, mensal: r2(mensal), cobre: r2(cobre), estado, quando };
  });
  v.innerHTML = `<div class="row between" style="margin-bottom:16px"><span class="muted">O excedente mensal (${eur(Math.max(0, I.exc))}) é distribuído pelos objetivos por ordem de prioridade.</span>${ed ? `<button class="btn primary" id="no">${icon('plus')} Novo objetivo</button>` : ''}</div>
    <div class="grid g3">${kpi(`${icon('target')} Objetivos`, String(m.objetivos.length), `${lista.filter(x => x.estado[1] === 'viável' || x.estado[1] === 'atingido').length} viáveis ou atingidos`, '', true)}
      ${kpi('Em falta', eur(sum(lista, 'falta')))}${kpi('Necessário por mês', eur(sum(lista, 'mensal')), `excedente ${eur(Math.max(0, I.exc))}`, sum(lista, 'mensal') > Math.max(0, I.exc) ? 'neg' : '')}</div>
    <div class="grid g2" style="margin-top:16px">${lista.map(x => `<div class="card ${ed ? 'click' : ''}" data-o="${x.o.id}" style="cursor:${ed ? 'pointer' : 'default'}"><div class="card-h"><h3>${esc(x.o.nome)}</h3><span class="badge ${x.estado[0]}">${x.estado[1]}</span></div>
      <div class="progress ${x.estado[0] === 'bad' ? 'bad' : x.estado[0] === 'warn' ? 'warn' : ''}"><i style="width:${Math.min(100, Math.round(100 * (+x.o.poupado || 0) / Math.max(1, +x.o.alvo || 0)))}%"></i></div>
      <div class="kv" style="margin-top:12px"><div><span>Poupado / necessário</span><b class="num">${eur(x.o.poupado)} / ${eur(x.o.alvo)}</b></div><div><span>Data pretendida</span><b>${x.o.data ? date(x.o.data) : '—'}${x.n ? ` · ${x.n} meses` : ''}</b></div>
        <div><span>Necessário por mês</span><b class="num">${eur(x.mensal)}</b></div><div><span>Coberto pelo excedente</span><b class="num">${eur(x.cobre)}</b></div>
        ${x.quando ? `<div><span>Ao ritmo possível</span><b>${date(x.quando)}</b></div>` : ''}<div><span>Prioridade</span><b>${esc(String(x.o.prioridade || 3))}</b></div></div></div>`).join('') || '<div class="empty">Sem objetivos. Adicione compras ou metas de poupança.</div>'}</div>`;
  const ed1 = o0 => { const novo = !o0, x = o0 || { alvo: 0, poupado: 0, prioridade: 3, data: SPAP.addMonths(hoje, 12) };
    editar({ titulo: 'Objetivo', cols: COLS_OBJ(), x, novo, validar: f => !f.nome ? 'Indique o objetivo' : !(f.alvo > 0) ? 'Indique o valor necessário' : null,
      onSave: f => { f.prioridade = +f.prioridade; Object.assign(x, f); if (novo) { x.id = 'O' + uid(); m.objetivos.push(x); } audit('PF_OBJETIVO', `${x.nome} · ${eur(x.alvo)}`); },
      onDelete: y => { m.objetivos = m.objetivos.filter(z => z !== y); audit('PF_OBJETIVO_REMOVIDO', y.nome); } }); };
  if (ed) v.querySelectorAll('[data-o]').forEach(c => c.onclick = () => ed1(m.objetivos.find(x => x.id === c.dataset.o)));
  const no = v.querySelector('#no'); if (no) no.onclick = () => ed1();
}

/* ---------- Dados iniciais ---------- */
function seed(db, a) {
  app = a; db.settings.duplaAcima = 1000;
  (sub.utilizadores && sub.utilizadores.length ? sub.utilizadores : [{ id: 'u_bruno', nome: 'Bruno Alexandre Elias Monteiro', username: 'bruno', role: 'ADMIN', limite: 0 }])
    .forEach(u => db.users.push({ id: u.id, nome: u.nome, username: u.username, role: u.role, limite: u.role === 'ADMIN' ? 0 : Math.max(+u.limite || 0, 5000), ativo: true, pinHash: null }));
  const s = sub.sigla || 'PF';
  db.contas.push(
    { id: CAIXA, codigo: s + '-CX-001', nome: 'Tesouraria ' + sub.nome, tipo: 'INTERNA', categoria: 'TESOURARIA', saldoInicial: 0, ativo: true },
    { id: OPER, codigo: s + '-OP-002', nome: 'Reserva / fundo de emergência ' + sub.nome, tipo: 'INTERNA', categoria: 'TESOURARIA', saldoInicial: 0, ativo: true },
    { id: HOLD, codigo: '004_BXB_INVESTIMENTOS', nome: 'BXB Investimentos (holding)', tipo: 'INTERNA', categoria: 'SÓCIO', nif: '518300323', saldoInicial: 0, ativo: true });
  db.mod = { recibos: [], despesas: [], dividas: [], objetivos: [], plano: PLANO_PADRAO() };
}

const GLOSS = {
  pf_rend: { n: 'Rendimento líquido mensal', d: 'Média a 12 meses do que entra: recibos reais, meses projetados, subsídios de férias e Natal, refeição (se configurado) e outros rendimentos.' },
  pf_desp: { n: 'Despesas fixas', d: 'Encargos que se repetem, convertidos em valor mensal (uma despesa trimestral conta 1/3 por mês, uma anual 1/12).' },
  pf_prest: { n: 'Prestações', d: 'Soma das prestações mensais contratadas de todas as dívidas ativas.' },
  pf_exc: { n: 'Excedente mensal', d: 'O que sobra todos os meses depois das despesas fixas e das prestações. É o dinheiro disponível para poupar, reforçar o fundo de emergência e amortizar dívida.', f: 'Rendimento − despesas fixas − prestações' },
  pf_saude: { n: 'Saúde financeira', d: 'Pontuação de 0 a 100 que junta taxa de esforço, fundo de emergência, taxa de poupança, tipo de dívida e custo médio da dívida. A = 90+, B = 75+, C = 60+, D = 40+.' },
  pf_dti: { n: 'Debt-to-income (DTI)', pt: 'Taxa de esforço', d: 'Parte do rendimento mensal que vai para prestações. Até 20% é confortável; acima de 35% é preocupante; acima de 50% é crítico.', f: 'Prestações ÷ rendimento líquido' },
  pf_emerg: { n: 'Emergency fund', pt: 'Fundo de emergência', d: 'Dinheiro disponível para imprevistos, medido em meses de despesas e prestações que consegue cobrir. Recomenda-se 3 a 6 meses.' },
  pf_poup: { n: 'Savings rate', pt: 'Taxa de poupança', d: 'Parte do rendimento que sobra todos os meses. Recomenda-se pelo menos 10%, idealmente 20%.', f: 'Excedente ÷ rendimento líquido' },
  pf_div: { n: 'Tipo de dívida', d: 'Penaliza cartões de crédito com crédito rotativo (taxa ≥ 10%), que são a dívida mais cara.' },
  pf_custo: { n: 'Weighted average rate', pt: 'Taxa média ponderada', d: 'Taxa de juro média das dívidas, pesada pelo capital em dívida de cada uma. Até 5% é baixa; 15% ou mais é cara.' },
  pf_tan: { n: 'TAN / TAEG', d: 'TAN é a taxa anual nominal (só juros). TAEG inclui juros, comissões e seguros. Para a TAEG a taxa mensal é composta: (1 + TAEG)^(1/12) − 1; para a TAN é TAN ÷ 12.' },
  pf_debtfree: { n: 'Debt-free date', pt: 'Data livre de dívidas', d: 'Mês em que, seguindo a estratégia com o excedente atual, todas as dívidas ficam liquidadas.' },
  pf_avalanche: { n: 'Avalanche', d: 'Amortiza primeiro a dívida com a taxa de juro mais alta. É a que poupa mais juros.' },
  pf_snowball: { n: 'Snowball', pt: 'Bola de neve', d: 'Amortiza primeiro a dívida com o capital mais pequeno. Liquida dívidas mais depressa, o que ajuda a manter a motivação.' },
  pf_equilibrada: { n: 'Equilibrada', d: 'Combina as duas: 60% de peso para a taxa de juro e 40% para o capital mais pequeno.' },
  pf_proj: { n: 'Projeção anual', d: 'Meses com recibo usam o valor real; os restantes usam a média dos meses sem subsídios. Se os subsídios de férias (junho) e Natal (novembro) ainda não foram recebidos, soma-se uma estimativa igual ao salário líquido.' },
  pf_liqrec: { n: 'Líquido recorrente', d: 'Salário líquido normal sem subsídio de refeição nem acertos. Usa o recibo mais recente se estiver perto da mediana; senão o máximo sem valores atípicos.' },
};

return {
  seed, alcadaPadrao: 5000, tagline: sub.setor || 'Planeamento financeiro', home: 'visao', logo: `<span style="font-size:13px">${esc(sub.sigla || '')}</span>`,
  heroTitle: 'Rendimentos, dívidas e objetivos num só plano.', heroText: 'Projeção anual, simulação de amortizações e saúde financeira — com cada pagamento autorizado e assinado.',
  // despesas e prestações por pedir, e o salário projetado, entram na previsão de liquidez
  previsao: (a, ini, fim) => {
    const out = [], hoje = today(), de = ini && ini > hoje ? ini : hoje, ate = fim || SPAP.addMonths(hoje, 3), pl = M().plano;
    despAtivas().forEach(e => ocorrencias(e, e.periodicidade, de, ate).forEach(d => { if (!vivos(chaveDesp(e, d)).length) out.push({ conta: e.contaOrigem || CAIXA, data: d, valor: -(+e.valor || 0), tipo: 'Despesa fixa', descricao: e.nome }); }));
    divAtivas().forEach(x => ocorrencias(x, 'mensal', de, ate).forEach(d => { if (!vivos(chaveDiv(x, d)).length) out.push({ conta: x.contaOrigem || CAIXA, data: d, valor: -(+x.prestacao || 0), tipo: 'Prestação', descricao: x.nome }); }));
    ocorrencias({ dia: pl.diaSalario || 1 }, 'mensal', de, ate).forEach(d => {
      const y = +d.slice(0, 4), m = +d.slice(5, 7), rs = M().recibos.filter(r => +r.ano === y && +r.mes === m);
      if (rs.some(r => vivos(chaveRec(r)).length)) return;
      const l = projecao(y).linhas[m - 1], val = r2(l.proj + (pl.incluirRefeicao ? l.refeicao : 0) + (+pl.outrosRendimentos || 0));
      if (val > 0) out.push({ conta: CAIXA, data: d, valor: val, tipo: 'Rendimento previsto', descricao: `Rendimento ${MESES[m - 1]} ${y}` });
    });
    return out;
  },
  modules: [
    { id: 'visao', label: 'Painel', title: 'Painel financeiro', icon: 'chart', render: visao },
    { id: 'rendimentos', label: 'Rendimentos', title: 'Rendimentos e projeção', icon: 'wallet', render: rendimentos },
    { id: 'despesas', label: 'Despesas fixas', title: 'Despesas fixas', icon: 'list', render: despesas },
    { id: 'dividas', label: 'Dívidas e créditos', title: 'Dívidas e créditos', icon: 'credit', render: dividas },
    { id: 'simulador', label: 'Simulador de estratégias', title: 'Simulador de estratégias', icon: 'target', render: simulador },
    { id: 'objetivos', label: 'Objetivos', title: 'Objetivos e compras', icon: 'pie', render: objetivos },
  ],
  registar(a) { app = a; if (a.GLOSS) Object.assign(a.GLOSS, GLOSS); },
  // exposto para testes
  _motor: { taxaMensal, comissaoLegal, mesesParaLiquidar, estimarLiquido, simular, escolherAlvo },
};
};
})();
