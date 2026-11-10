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
  fundoOrigem: 'tesouraria', fundoInicial: 0, poupancaTipo: 'none', poupancaFixa: 0, poupancaPct: 0, horizonte: 240, diaSalario: 1,
  atualizarSMN: true, brutoBase: 0, smnTabela: '', smnAumento: 50, pagoMesSeguinte: false, aumentoSalarial: 0, aumentoTipo: 'fixo',
  irsRegras: '', irsDespesas: '', irsNascimento: '', irsInicioAtividade: 0, irsQualificacao: 0, irsMunicipio: 0.05, irsCoefB: 0 });

const M = () => { const m = app.db.mod; ['recibos', 'recibosB', 'despesas', 'dividas', 'objetivos', 'extratos'].forEach(k => { if (!Array.isArray(m[k])) m[k] = []; });
  // completa o plano com os valores por omissão sem o substituir: quem guardou uma referência ao plano continua a alterar o verdadeiro
  if (!m.plano || typeof m.plano !== 'object') m.plano = {}; const d = PLANO_PADRAO(); Object.keys(d).forEach(k => { if (!(k in m.plano)) m.plano[k] = d[k]; }); return m; };

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
// despesas com início e/ou fim (AAAA-MM) só contam nos meses em que estão em vigor
const ymHoje = () => today().slice(0, 7);
const vigente = (e, ym = ymHoje()) => (!e.inicio || ym >= e.inicio) && (!e.fim || ym <= e.fim);
const despAtivas = (ym = ymHoje()) => M().despesas.filter(e => e.ativo !== false && vigente(e, ym) && !partilhaAceite(e, ym));
const divAtivas = () => M().dividas.filter(d => d.ativo !== false && (+d.capital || 0) > 0.005);
// parte desta pessoa nas despesas partilhadas com outros planos pessoais (lida do registo comum da partilha)
function casaParte(ym = ymHoje()) {
  const pl = M().plano; if (!pl.casa || !pl.membroCasa) return null;
  const d = SPAP.contaCasa ? SPAP.contaCasa.livro(pl.casa) : null;
  const s = window.Grupo && Grupo.get(pl.casa), nome = s ? s.nome : ((SPAP.contaCasa && SPAP.contaCasa.registo(pl.casa).nome) || 'Partilha');
  if (!d || !d.mod || !Array.isArray(d.mod.despesas)) return { nome, valor: 0, n: 0, semDados: true };
  const ds = (SPAP.contaCasa ? SPAP.contaCasa.todasDespesas(pl.casa, d) : d.mod.despesas).filter(e => e.ativo !== false && (SPAP.contaCasa ? SPAP.contaCasa.ativaNoMes(e, ym) : vigente(e, ym)) && +((e.partes || {})[pl.membroCasa]) > 0);
  const membro = (d.mod.membros || []).find(x => x.id === pl.membroCasa);
  const val = e => SPAP.contaCasa ? SPAP.contaCasa.valorMes(e, ym).valor : mensalDesp(e);
  return { nome, membro: membro ? membro.nome : '', valor: r2(ds.reduce((t, e) => t + val(e) * +e.partes[pl.membroCasa], 0)), n: ds.length,
    alim: r2(ds.filter(e => ehAlim(e)).reduce((t, e) => t + val(e) * +e.partes[pl.membroCasa], 0)),
    cats: ds.reduce((o, e) => { const c = e.categoria || 'Outros'; o[c] = r2((o[c] || 0) + val(e) * +e.partes[pl.membroCasa]); return o; }, {}) };
}
const ehAlim = e => /aliment/i.test(e.categoria || '') || /aliment|supermercado|refei/i.test(e.nome || '');
// subsídio de refeição reservado à alimentação (não conta como rendimento): paga primeiro as despesas de alimentação desse mês,
// para a comida não ser descontada duas vezes
// subsídio de refeição por entidade patronal: em cada emprego pode contar como rendimento ou ficar reservado à alimentação
// (plano.refeicaoRend = { entidade: true/false }; sem escolha vale a opção geral antiga incluirRefeicao)
const refConta = p => { const pl = M().plano, o = pl.refeicaoRend || {}, k = chaveEnt(p); return k in o ? !!o[k] : !!pl.incluirRefeicao; };
// a parte do subsídio de refeição de um recibo que fica reservada à alimentação (não conta como rendimento)
const refReservada = p => refConta(p) ? 0 : +p.refeicao || 0;
// entidades pagadoras dos recibos (Configurar ordenado, em Rendimentos)
function empregosComRefeicao() {
  const o = {}; M().recibos.filter(r => +r.liquido > 0 || +r.refeicao > 0).forEach(r => { const k = chaveEnt(r), x = o[k] || (o[k] = { k, nome: r.entidade || (r.nifEntidade ? 'NIF ' + r.nifEntidade : 'Sem entidade indicada'), n: 0, tot: 0, nr: 0, ult: '' });
    x.n++; if (+r.refeicao > 0) { x.nr++; x.tot += +r.refeicao; } const ym = ymOf(+r.ano, +r.mes); if (ym > x.ult) { x.ult = ym; if (r.entidade) x.nome = r.entidade; } });
  return Object.values(o).map(x => ({ ...x, media: x.nr ? r2(x.tot / x.nr) : 0 })).sort((a, b) => b.ult.localeCompare(a.ult));
}
function refeicaoCobre(ym = ymHoje(), P = projecao) {
  const [ry, rm] = mesDoRecibo(+ym.slice(0, 4), +ym.slice(5, 7)), ref = +P(ry).linhas[rm - 1].refeicao || 0; if (ref <= 0) return 0;
  const alim = despAtivas(ym).filter(ehAlim).reduce((t, e) => t + mensalDesp(e), 0) + ((casaParte(ym) || {}).alim || 0);
  return r2(Math.min(ref, alim));
}
// despesas de um mês: as próprias em vigor nesse mês + a parte na casa nesse mês (valores reais, médias ou plano do cartão)
const despesasMensais = (ym = ymHoje()) => r2(despAtivas(ym).reduce((s, e) => s + mensalDesp(e), 0) + ((casaParte(ym) || {}).valor || 0));
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
// recibos que representam o salário atual: desde a mudança de emprego (se registada) e sem meses incompletos
const recibosAtuais = () => { const d = M().plano.empregoDesde; return M().recibos.filter(r => !r.parcial && (!d || ymOf(+r.ano, +r.mes) >= d)); };
const salarioBase = () => +M().plano.salarioBase || estimarLiquido(recibosAtuais()).base || 0;
// mudança de emprego: os últimos recibos (2 ou mais) são de uma entidade diferente dos anteriores
const chaveEnt = r => String(r.nifEntidade || '').trim() || String(r.entidade || '').trim().toLowerCase();
function mudancaEmprego() {
  const pl = M().plano, rs = M().recibos.filter(r => +r.liquido > 0).slice().sort((a, b) => a.ano - b.ano || a.mes - b.mes);
  if (rs.length < 3) return null; const k = chaveEnt(rs[rs.length - 1]); if (!k) return null;
  let i = rs.length; while (i > 0 && chaveEnt(rs[i - 1]) === k) i--;
  const novos = rs.slice(i), antigos = rs.slice(0, i); if (novos.length < 2 || !antigos.length) return null;
  const normais = x => !x.subFerias && !x.subNatal, outros = novos.slice(1).filter(normais), medO = outros.length ? sum(outros, 'liquido') / outros.length : 0;
  // primeiro recibo muito abaixo dos seguintes: entrou a meio do mês
  const parcial = novos[0].parcial || (normais(novos[0]) && medO > 0 && +novos[0].liquido < 0.6 * medO) ? novos[0] : null;
  const uteis = novos.filter(r => r !== parcial && !r.parcial), ult = uteis.filter(normais).filter(r => +r.ss > 0).pop();
  const desde = ymOf(+novos[0].ano, +novos[0].mes), chave = 'emprego:' + k;
  return { ent: novos[novos.length - 1].entidade || 'nova entidade', entAnt: antigos[antigos.length - 1].entidade || '', desde, n: novos.length, parcial,
    liquido: estimarLiquido(uteis).base, bruto: ult ? r2(+ult.ss / 0.11) : 0, feito: pl.empregoDesde === desde, chave, dispensada: (pl.sugDispensadas || []).includes(chave) };
}
// avisar só enquanto as previsões ainda não refletem o novo emprego
const avisoEmprego = () => { const e = mudancaEmprego(); return e && !e.feito && !e.dispensada && e.liquido > 0 ? e : null; };
// YTD real + projeção até dezembro, com subsídios de férias (junho) e Natal (novembro) estimados se ainda não recebidos
/* ---------- Salário mínimo nacional (bruto mensal, pago 14 vezes) ----------
   Até 2026: valores publicados. 2027–2028: acordo de rendimentos. 2029: objetivo anunciado.
   Podem ser corrigidos nos parâmetros ("2027: 980; 2030: 1150"); depois do último ano soma-se o aumento anual indicado. */
const SMN_PADRAO = { 2023: 760, 2024: 820, 2025: 870, 2026: 920, 2027: 970, 2028: 1020, 2029: 1100 };
/* AUMENTOS DO ORDENADO — definidos aqui pelo programador, não pelo utilizador.
   Só para quem trabalha em Portugal: tipo 'smn' = o ordenado sobe na mesma % que o salário mínimo; 'fixo' = sobe pct por ano.
   minimo: nos anos futuros nunca fica abaixo do salário mínimo (só em tempo inteiro: em tempo parcial o mínimo é proporcional às horas).
   smnAumento: quanto sobe o mínimo por ano depois do último ano de SMN_PADRAO.
   Fora de Portugal o aumento deteta-se pelos recibos da entidade (variação anual do vencimento). */
const AUMENTO_PT = { tipo: 'smn', pct: 0, minimo: true, smnAumento: 50 };
function tabelaSMN() { return { ...SMN_PADRAO }; }
function smnAno(y) {
  const t = tabelaSMN(), anos = Object.keys(t).map(Number).sort((a, b) => a - b); if (t[y]) return t[y];
  if (y < anos[0]) return t[anos[0]];
  const ult = anos[anos.length - 1];
  return r2(t[ult] + (y - ult) * AUMENTO_PT.smnAumento);
}
// NIF português válido (9 dígitos com dígito de controlo)
const nifPT = n => { const d = String(n || '').replace(/\D/g, ''); if (!/^[1-9]\d{8}$/.test(d)) return false; let t = 0; for (let i = 0; i < 8; i++) t += +d[i] * (9 - i); const c = 11 - t % 11; return (c >= 10 ? 0 : c) === +d[8]; };
const REGIMES = [['inteiro', 'Tempo inteiro'], ['parcial', 'Tempo parcial'], ['outro', 'Outro regime']];
const nomeRegime = k => (REGIMES.find(x => x[0] === k) || REGIMES[0])[1];
// regime de trabalho e país de cada entidade pagadora: plano.entInfo = { entidade: { regime, pais: 'PT' | 'outro' } }
// sem escolha: Portugal, a menos que os recibos tenham um número fiscal que não é um NIF português e nenhum desconto para a Segurança Social
const paisDetetado = k => { const rs = M().recibos.filter(r => chaveEnt(r) === k); return rs.some(r => String(r.nifEntidade || '').trim()) && !rs.some(r => nifPT(r.nifEntidade) || +r.ss > 0) ? 'outro' : 'PT'; };
const infoEnt = k => { const o = (M().plano.entInfo || {})[k] || {}; return { regime: o.regime || 'inteiro', pais: o.pais || paisDetetado(k) }; };
// aumento anual detetado pelos recibos de uma entidade: média do vencimento (sem subsídios) do primeiro e do último ano com recibos
function aumentoDetetado(k) {
  const por = {}; M().recibos.filter(r => chaveEnt(r) === k && !r.subFerias && !r.subNatal && (+r.ss > 0 || +r.bruto > 0)).forEach(r => { const b = +r.ss > 0 ? +r.ss / 0.11 : +r.bruto; (por[r.ano] = por[r.ano] || []).push(b); });
  const anos = Object.keys(por).map(Number).sort((a, b) => a - b); if (anos.length < 2) return { taxa: 0, anos: anos.length };
  const med = y => por[y].reduce((t, x) => t + x, 0) / por[y].length, a = anos[0], b = anos[anos.length - 1];
  const taxa = Math.pow(med(b) / med(a), 1 / (b - a)) - 1;
  return { taxa: Math.max(0, Math.min(0.2, isFinite(taxa) ? taxa : 0)), anos: anos.length, de: a, ate: b };
}
// regra de aumento que se aplica à entidade principal (a do recibo mais recente)
function regraAumento() {
  const k = entPrincipal(), I = infoEnt(k);
  if (I.pais === 'PT') return { pt: true, tipo: AUMENTO_PT.tipo, taxa: AUMENTO_PT.tipo === 'fixo' ? AUMENTO_PT.pct : 0, minimo: AUMENTO_PT.minimo && I.regime === 'inteiro', regime: I.regime,
    texto: (AUMENTO_PT.tipo === 'smn' ? 'sobe na mesma % que o salário mínimo' : `+${pct(AUMENTO_PT.pct)} por ano`) + (AUMENTO_PT.minimo && I.regime === 'inteiro' ? ', nunca abaixo do mínimo' : '') };
  const d = aumentoDetetado(k);
  return { pt: false, tipo: 'fixo', taxa: d.taxa, minimo: false, regime: I.regime, detetado: d,
    texto: d.anos < 2 ? 'sem aumento: ainda não há recibos de dois anos para o detetar' : `+${pct(d.taxa)} por ano, detetado nos recibos de ${d.de} a ${d.ate}` };
}
// vencimento base bruto atual: o indicado nos parâmetros ou, sem ele, a base da Segurança Social (SS ÷ 11%) do último recibo sem subsídios
function brutoBase() {
  const b = +M().plano.brutoBase; if (b > 0) return { valor: b, origem: 'parâmetros' };
  const r = M().recibos.filter(x => !x.subFerias && !x.subNatal && (+x.ss > 0 || +x.bruto > 0)).sort((a, c) => c.ano - a.ano || c.mes - a.mes)[0];
  if (!r) return { valor: 0, origem: 'sem recibos' };
  return +r.ss > 0 ? { valor: r2(+r.ss / 0.11), origem: `base da SS do recibo de ${MESES[r.mes - 1]} ${r.ano}` } : { valor: r2(+r.bruto), origem: `bruto do recibo de ${MESES[r.mes - 1]} ${r.ano}` };
}
// salário de um ano futuro: max(vencimento atual com o aumento anual previsto, mínimo desse ano); fator = usado ÷ vencimento atual
function salarioAno(y) {
  const G = regraAumento(), b = brutoBase().valor, smn = smnAno(y), on = G.minimo, anos = Math.max(0, y - +today().slice(0, 4));
  // 'smn': o salário sobe na mesma % que o salário mínimo (mantém a mesma distância relativa ao mínimo)
  const y0 = +today().slice(0, 4), efetivo = G.tipo === 'smn' ? b * smnAno(Math.max(y, y0)) / smnAno(y0) : b * Math.pow(1 + (+G.taxa || 0), anos), usado = b > 0 ? (on ? Math.max(efetivo, smn) : efetivo) : 0;
  return { bruto: b, smn, efetivo: r2(efetivo), usado: r2(usado), minimo: on && b > 0 && smn > efetivo, fator: b > 0 ? usado / b : 1, regra: G };
}
function projecao(ano) {
  const anoAtual = +today().slice(0, 4);
  if (+ano > anoAtual && !M().recibos.some(p => +p.ano === +ano)) {
    // ano futuro: parte do ano atual (média sem subsídios, subsídios e refeição) atualizado pelo salário mínimo
    // a refeição faz parte do líquido e não acompanha o salário: só o resto é atualizado
    const p0 = projecao(anoAtual), S = salarioAno(+ano), media = r2((p0.media - p0.mediaRefAll) * S.fator + p0.mediaRefAll), sub = r2((salarioBase() || p0.media - p0.mediaRefAll) * S.fator), linhas = [];
    for (let m = 1; m <= 12; m++) { const sb = m === MES_FERIAS || m === MES_NATAL; linhas.push({ m, real: null, proj: r2(media + (sb ? sub : 0)), refeicao: r2(p0.mediaRef), sub: sb, subValor: sb ? sub : 0, subTipo: m === MES_FERIAS ? 'férias' : m === MES_NATAL ? 'Natal' : '' }); }
    return { linhas, ytd: 0, n: 0, media, mediaMes: media, total: sum(linhas, 'proj'), refeicaoTotal: sum(linhas, 'refeicao'), mediaRef: r2(p0.mediaRef), mediaRefAll: r2(p0.mediaRefAll), subF: sub, subN: sub, temF: false, temN: false, futuro: true, salario: S };
  }
  const rs = M().recibos.filter(p => +p.ano === +ano), base = salarioBase();
  const real = {}, ref = {}, so = [], refs = [], refsAll = [], subM = {}; let temF = false, temN = false, valF = 0, valN = 0;
  const porMes = {}; rs.forEach(p => { const m = +p.mes; porMes[m] = porMes[m] || { r: 0, a: 0 }; porMes[m].r += refReservada(p); porMes[m].a += +p.refeicao || 0; });
  Object.values(porMes).forEach(x => { if (x.a > 0) { refs.push(x.r); refsAll.push(x.a); } });
  rs.forEach(p => {
    const m = +p.mes, liq = +p.liquido || 0, rf = refReservada(p);
    real[m] = (real[m] || 0) + liq;
    if (rf > 0) ref[m] = (ref[m] || 0) + rf;
    if (p.subFerias) { temF = true; valF += +p.subFeriasValor || 0; subM[m] = subM[m] || { v: 0, t: [] }; subM[m].v += +p.subFeriasValor || 0; subM[m].t.push('férias'); }
    if (p.subNatal) { temN = true; valN += +p.subNatalValor || 0; subM[m] = subM[m] || { v: 0, t: [] }; subM[m].v += +p.subNatalValor || 0; subM[m].t.push('Natal'); }
    if (!p.subFerias && !p.subNatal && !p.parcial && !(M().plano.empregoDesde && ymOf(+p.ano, m) < M().plano.empregoDesde)) so.push(liq);
  });
  const media = so.length ? so.reduce((a, b) => a + b, 0) / so.length : base;
  // no ano de entrada num emprego, os subsídios são proporcionais aos meses trabalhados nesse ano
  const ed0 = M().plano.empregoDesde, propAno = ed0 && +ed0.slice(0, 4) === +ano ? (13 - +ed0.slice(5, 7)) / 12 : 1;
  const projF = temF ? valF : (base || media) * propAno, projN = temN ? valN : (base || media) * propAno;
  const mediaRef = refs.length ? refs.reduce((a, b) => a + b, 0) / refs.length : 0, mediaRefAll = refsAll.length ? refsAll.reduce((a, b) => a + b, 0) / refsAll.length : 0;
  const linhas = [];
  for (let m = 1; m <= 12; m++) {
    if (m in real) linhas.push({ m, real: r2(real[m]), proj: r2(real[m]), refeicao: r2(ref[m] || 0), refReal: m in ref, sub: (m === MES_FERIAS && temF) || (m === MES_NATAL && temN) || !!subM[m], subValor: subM[m] ? r2(subM[m].v) : 0, subTipo: subM[m] ? subM[m].t.join(' e ') : '' });
    else { let v = media, sb = false, sv = 0, st = ''; if (m === MES_FERIAS && !temF) { v += projF; sv = projF; st = 'férias'; sb = true; } if (m === MES_NATAL && !temN) { v += projN; sv = projN; st = 'Natal'; sb = true; }
      linhas.push({ m, real: null, proj: r2(v), refeicao: r2(mediaRef), sub: sb, subValor: r2(sv), subTipo: st }); }
  }
  const ytd = r2(Object.values(real).reduce((a, b) => a + b, 0)), n = Object.keys(real).length;
  return { linhas, ytd, n, media: r2(media), mediaMes: n ? r2(ytd / n) : r2(media), total: sum(linhas, 'proj'), refeicaoTotal: sum(linhas, 'refeicao'), mediaRef: r2(mediaRef), mediaRefAll: r2(mediaRefAll),
    subF: temF ? 0 : r2(projF), subN: temN ? 0 : r2(projN), temF, temN };
}
// rendimento líquido mensal médio a 12 meses (inclui subsídios, refeição se configurado e outros rendimentos)
function rendimentoMensal(ano = +today().slice(0, 4)) {
  const p = projecao(ano), pl = M().plano;
  return r2((p.total - p.refeicaoTotal) / 12 + (+pl.outrosRendimentos || 0));
}

// rendimento de um mês concreto: recibo real ou projeção desse ano (anos futuros atualizados pelo salário mínimo, se ativo)
// recibo cujo ordenado entra no mês (y, m): o do próprio mês ou, se é pago no mês seguinte, o do mês anterior
// cada entidade pagadora paga à sua maneira: plano.pagamentoEnt = { entidade: { seguinte: true/false, dia: 1–28 (0 = último dia do mês) } }
// sem escolha valem as opções gerais antigas (pagoMesSeguinte, diaSalario)
const pagEnt = k => { const pl = M().plano, o = (pl.pagamentoEnt || {})[k]; return o ? { seguinte: !!o.seguinte, dia: +o.dia || 0 } : { seguinte: !!pl.pagoMesSeguinte, dia: pl.pagoMesSeguinte ? +pl.diaSalario || 1 : 0 }; };
// entidade do recibo mais recente: as projeções (meses sem recibo) seguem a forma de pagamento dela
const entPrincipal = () => { const r = M().recibos.filter(x => +x.liquido > 0).sort((a, b) => b.ano - a.ano || b.mes - a.mes)[0]; return r ? chaveEnt(r) : ''; };
const mesDoRecibo = (y, m, k = entPrincipal()) => pagEnt(k).seguinte ? (m === 1 ? [y - 1, 12] : [y, m - 1]) : [y, m];
// mês em que entra o ordenado de um recibo (y, m)
const mesDaEntrada = (y, m, k = entPrincipal()) => pagEnt(k).seguinte ? (m === 12 ? [y + 1, 1] : [y, m + 1]) : [y, m];
function rendimentoDoMes(y, m, P = projecao) {
  const pl = M().plano, outros = +pl.outrosRendimentos || 0;
  // recibos que entram neste mês (cada um segundo a sua entidade); sem nenhum, usa a projeção
  const rs = M().recibos.filter(r => +r.liquido > 0 && (([ey, em]) => ey === y && em === m)(mesDaEntrada(+r.ano, +r.mes, chaveEnt(r))));
  if (rs.length) return r2(rs.reduce((t, r) => t + (+r.liquido || 0) - refReservada(r), 0) + outros);
  const [ry, rm] = mesDoRecibo(y, m), l = P(ry).linhas[rm - 1];
  return r2((l.real != null ? 0 : l.proj - l.refeicao) + outros);
}

/* ---------- Motor: simulador mês a mês (porta direta de simulator.py) ---------- */
function construirCashflow(horizonte) {
  const pl = M().plano, hoje = today(), y0 = +hoje.slice(0, 4), m0 = +hoje.slice(5, 7);
  const proj = {}, P = a => proj[a] || (proj[a] = projecao(a));
  const out = [];
  for (let i = 0; i < horizonte; i++) {
    const t = (m0 - 1) + i, y = y0 + Math.floor(t / 12), m = (t % 12) + 1;
    out.push({ y, m, rendimento: rendimentoDoMes(y, m, P), despesas: despesasMensais(ymOf(y, m)) });
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
  // cartões de crédito: a prestação é uma % do saldo (com um mínimo), por isso desce quando se amortiza;
  // a % vem do extrato (opção de pagamento) ou, sem ela, da prestação atual ÷ saldo atual
  const ds = dividas.map(d => { const cap = +d.capital || 0, prest = +d.prestacao || 0, cartao = d.tipo === 'cartao' && !d.cartaoDe;
    const pc = cartao ? pctCartao(d).pct : null, pct = cartao ? (pc > 0 && pc <= 1 ? pc : cap > 0 ? Math.min(1, prest / cap) : 0) : 0;
    return { id: d.id, nome: d.nome, capital: cap, r: taxaMensal(d), prest, fee: Math.max(0, +d.comissao || 0), cartao, pct, minimo: d.minimoCartao == null ? 25 : +d.minimoCartao }; });
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
      const j = d.capital * d.r, devido = d.cartao && d.pct > 0 ? Math.max(d.pct * d.capital, Math.min(d.minimo, d.capital + j)) : d.prest;
      const pg = Math.min(devido, cash, d.capital + j);
      if (pg <= 0) { d.capital += j; return; }
      if (pg < j) { d.capital += j - pg; minPago += pg; cash -= pg; return; }
      d.capital -= Math.min(d.capital, pg - j); minPago += pg; cash -= pg;
    });
    minT += minPago;
    // 2) poupança configurada
    const k = o.poupancaTipo, alvoP = k === 'fixed' ? o.poupancaFixa : k === 'percentage' ? m.rendimento * o.poupancaPct
      : k === 'percentage_surplus' ? Math.max(0, m.rendimento - m.despesas) * o.poupancaPct : k === 'percentage_after_min_payments' ? Math.max(0, m.rendimento - m.despesas - minPago) * o.poupancaPct : 0;
    const contP = Math.min(Math.max(0, alvoP), cash); poup += contP; cash -= contP;
    // 2b) objetivos (aba Objetivos): o que se põe de lado este mês sai antes da amortização extra; um objetivo de dívida amortiza-a no mês em que é pago
    const OB = o.objetivos ? o.objetivos[ymOf(m.y, m.m)] : null, contO = OB ? Math.min(OB.guardar, cash) : 0; cash -= contO; let amortO = 0;
    if (OB) OB.amort.forEach(([id, v]) => { const d = ds.find(x => x.id === id); if (d && d.capital > 0.005) { const a = Math.min(d.capital, v); d.capital -= a; amortO += a; cash += v - a; } else cash += v; });
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
    meses.push({ y: m.y, m: m.m, rendimento: r2(m.rendimento), despesas: r2(m.despesas), prestacoes: r2(minPago), poupanca: r2(contP), poupancaSaldo: r2(poup), objetivos: r2(contO), amortObjetivos: r2(amortO), nomesObj: OB ? OB.nomes : [],
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
    poupancaTipo: pl.poupancaTipo, poupancaFixa: +pl.poupancaFixa || 0, poupancaPct: +pl.poupancaPct || 0, objetivos: objetivosPorMes() };
}
// por mês: quanto se põe de lado para objetivos e que dívidas são amortizadas por objetivos de «Pagamento de dívidas»
function objetivosPorMes() {
  try { const { CF, poe, paga } = planoObjetivos(), out = {};
    CF.forEach((c, i) => { const g = r2(poe[i].reduce((t, [, v]) => t + v, 0)), am = paga[i].filter(x => x.div && x.tipo === 'meu').map(x => [x.div.id, x.falta]);
      if (g > 0.005 || am.length) out[c.ym] = { guardar: g, amort: am, nomes: [...new Set(poe[i].map(([x]) => x.nome))] }; });
    return out; } catch (e) { console.warn('objetivosPorMes', e); return {}; }
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
// porMes: rendimento real/projetado desse mês (Painel); sem porMes, a média a 12 meses
function indicadores(ym = ymHoje(), porMes = false) {
  const rend = porMes ? rendimentoDoMes(+ym.slice(0, 4), +ym.slice(5, 7)) : rendimentoMensal(), refC = refeicaoCobre(ym), desp = r2(despesasMensais(ym) - refC), prest = prestacoesMensais(), ds = divAtivas();
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
  { const e = avisoEmprego(); if (e) alertas.push(['warn', `Parece ter mudado de emprego: desde ${fmtMes(e.desde)} os recibos são de <b>${esc(e.ent)}</b>. As previsões ainda usam o salário anterior. <a href="#/rendimentos" data-aba="pf-rend=rec">Atualizar em Rendimentos</a>.`]); }
  if (!M().recibos.length && !+M().plano.salarioBase) alertas.push(['info', `Ainda não há rendimentos. Registe recibos de vencimento em <a href="#/rendimentos" data-aba="pf-rend=rec">Rendimentos</a> .`]);
  if (dti != null && dti > BENCH.dtiCritico) alertas.push(['bad', `A taxa de esforço é ${pct(dti)}: mais de metade do rendimento vai para prestações.`]);
  else if (dti != null && dti > BENCH.dtiAviso) alertas.push(['warn', `A taxa de esforço é ${pct(dti)} (acima de 35%).`]);
  if (emerg != null && emerg < BENCH.emergMin) alertas.push(['bad', `O fundo de emergência cobre menos de 1 mês de despesas (${eur(fundo)}).`]);
  if (poup != null && poup < BENCH.poupMin) alertas.push(['warn', exc < 0 ? `As saídas mensais superam o rendimento em ${eur(-exc)}.` : `A taxa de poupança é só ${pct(poup)} (recomendado ≥ 10%).`]);
  ds.filter(d => d.tipo === 'cartao' ? (+d.taxa || 0) >= BENCH.tanCartao : (+d.taxa || 0) > BENCH.tanAlta).forEach(d => alertas.push(['warn', `<b>${esc(d.nome)}</b> tem uma taxa de ${pct(d.taxa)}: é a dívida mais cara a amortizar primeiro.`]));
  { const L = ligacaoCasa(), ex = L && CC().extrato(L.casa);
    if (ex) { const nm = id => esc(ex.nomeM(id).split(' ')[0]);
      ex.deve.filter(x => x.de === L.eu).forEach(x => alertas.push(['warn', `Deve <b>${eur(x.valor)}</b> a ${nm(x.para)} nas despesas partilhadas. <a href="#/casa">Ver Partilhas</a>`]));
      ex.deve.filter(x => x.para === L.eu).forEach(x => alertas.push(['info', `${nm(x.de)} deve-lhe <b>${eur(x.valor)}</b> nas despesas partilhadas. <a href="#/casa">Ver Partilhas</a>`]));
      const n = ex.linhas.filter(l => l.tipo === 'pagamento' && l.estado === 'registado' && l.para === L.eu).length; if (n) alertas.unshift(['warn', `${n === 1 ? 'Há 1 pagamento' : `Há ${n} pagamentos`} de partilhas a aguardar a sua confirmação. <a href="#/aprovacoes">Caixa de entrada</a>`]); } }
  ds.filter(d => d.incumprimento && !incumprimentoRegularizado(d)).forEach(d => { const u = d.ultimoExtrato || {}; alertas.unshift(['bad', `<b>${esc(d.nome)}</b> está em incumprimento${d.incumprimento.montante ? `: <b>${eur(d.incumprimento.montante)}</b> em atraso` : ''}${d.incumprimento.bloqueado ? ' e a utilização está bloqueada pelo banco' : ''}.${u.pagar ? ` O extrato n.º ${u.numero} pede ${eur(u.pagar)}${u.dataLimite ? ' até ' + date(u.dataLimite) : ''}.` : ''} Veja em <a href="#/dividas">Dívidas e créditos</a>.`]); });
  { const AT = atrasos(); if (AT.length) alertas.unshift(['bad', `${AT.length === 1 ? '1 despesa vencida' : AT.length + ' despesas vencidas'} por pagar: ${AT.map(x => `<b>${esc(x.e.nome)}</b> de ${date(x.d)}`).join(', ')}. <a href="#/despesas">Ver Despesas fixas</a>`]); }
  ds.filter(d => mesesParaLiquidar(d) === Infinity).forEach(d => alertas.push(['bad', `A prestação de <b>${esc(d.nome)}</b> não cobre os juros: a dívida cresce todos os meses.`]));
  return { rend, desp, refC, prest, exc, divida, fundo, dti, poup, emerg, tanMedia, comp, score, nota, alertas };
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
/* Cobranças em atraso: uma cobrança já vencida sem pedido de pagamento continua por pagar e passa para os meses
   seguintes até ser paga. O controlo começa no mês em que a despesa foi registada (ou no do 1.º pedido). */
const controloDesde = e => e.controloDesde || app.db.pedidos.filter(p => p.origem && String(p.origem.key || '').startsWith(`pf:desp:${e.id}:`)).map(p => p.origem.key.slice(-7)).sort()[0] || null;
function emAtraso(e) {
  const desde = e.ativo === false ? null : controloDesde(e); if (!desde) return [];
  const hoje = today(); return ocorrencias(e, e.periodicidade, (e.inicio && e.inicio > desde ? e.inicio : desde) + '-01', hoje)
    .filter(d => d < hoje && vigente(e, d.slice(0, 7)) && !partilhaAceite(e, d.slice(0, 7)) && !vivos(chaveDesp(e, d)).length);
}
const atrasos = () => M().despesas.flatMap(e => emAtraso(e).map(d => ({ e, d })));
// plano pessoal: o titular regista o pagamento com uma assinatura (fica autorizado e executado), sem pedido para aprovar
function pagar(pre) {
  if (!app.registarPagamentos) return app.novoPedido(pre);
  const hoje = today(), contas = app.contasInternas().filter(c => c.categoria === 'TESOURARIA' || c.id === pre.contaOrigem);
  ui.modal({ title: 'Registar pagamento', sub: esc(pre.descricao || ''),
    body: `<form class="form">
      <div class="fld"><label>Valor pago (€)</label><input class="inp num" type="number" step="0.01" min="0" name="valor" value="${r2(+pre.valor || 0)}" style="font-size:18px;font-weight:700"></div>
      <div class="fld"><label>Data do pagamento</label><input class="inp" type="date" name="data" max="${hoje}" value="${pre.dataPrevista && pre.dataPrevista < hoje ? pre.dataPrevista : hoje}"></div>
      <div class="fld full"><label>Pago a partir de</label><select class="inp" name="conta">${contas.map(c => `<option value="${c.id}" ${c.id === pre.contaOrigem ? 'selected' : ''}>${esc(c.nome)} · ${eur(app.saldo(c.id))}</option>`).join('')}</select></div>
      <div class="fld full faint" style="font-size:12px">Fica registado e executado com a sua assinatura, sem circuito de aprovação. Se pagou noutro dia, indique a data real.</div></form>`,
    actions: [{ label: 'Cancelar', kind: 'ghost' }, { label: icon('pen') + 'Assinar e registar', kind: 'primary', onClick: async el => {
      const f = ui.formData(el), v = r2(+f.valor || 0), d = f.data || hoje;
      if (!(v > 0)) { ui.toast('Indique o valor pago', 'warn'); return false; }
      if (d > hoje) { ui.toast('A data do pagamento não pode ser futura', 'warn'); return false; }
      try { const r = await app.registarPagamentos([{ ...pre, valor: v, dataPrevista: d, contaOrigem: f.conta || pre.contaOrigem }], 'Registar pagamento', `${esc(pre.descricao || '')}<br><b>${eur(v)}</b> · ${date(d)}`);
        if (!r) return false; ui.toast('Pagamento registado', 'ok'); app.refresh(); } catch (e) { ui.toast(esc(e.message), 'bad'); return false; } } }] });
}
function pedirDespesa(x, dAtraso) {
  const d = dAtraso || proxima(x, x.periodicidade), key = chaveDesp(x, d);
  if (vivos(key).length) { app.go('pedidos/' + vivos(key)[0].id); return; }
  const destino = garantirConta(x, 'FORNECEDOR', 'FN');
  pagar({ categoria: 'PAGAMENTO DE ENCARGOS E TAXAS', contaOrigem: x.contaOrigem || CAIXA, contaDestino: destino, valor: +x.valor || 0, metodo: 'DÉBITO',
    descricao: `${x.nome} · ${MESES[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}${d < today() ? ' (vencida a ' + date(d) + ')' : ''}`, dataPrevista: d, origem: { mod: 'despesas', key } });
  if (d < today() && !app.registarPagamentos) ui.toast('Cobrança vencida: ao executar o pagamento, indique a data em que foi realmente pago.', 'info');
}
function pedirPrestacao(x) {
  const d = proxima(x), key = chaveDiv(x, d);
  if (vivos(key).length) { app.go('pedidos/' + vivos(key)[0].id); return; }
  const cartao = x.cartaoDe ? M().dividas.find(y => y.id === x.cartaoDe) : null, destino = garantirConta(cartao || x, 'CRÉDITO', 'CR');
  pagar({ categoria: 'MENSALIDADE / PRESTAÇÃO', contaOrigem: x.contaOrigem || CAIXA, contaDestino: destino, valor: +x.prestacao || 0, metodo: 'DÉBITO',
    descricao: `Prestação ${x.nome} · ${MESES[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`, dataPrevista: d, origem: { mod: 'dividas', key } });
}
function pedirAmortizacao(x, valor) {
  const destino = garantirConta(x, 'CRÉDITO', 'CR');
  pagar({ categoria: 'LIQUIDAÇÃO DE CRÉDITO', contaOrigem: x.contaOrigem || CAIXA, contaDestino: destino, valor: r2(valor), metodo: 'DÉBITO',
    descricao: `Amortização antecipada ${x.nome}${+x.comissao ? ` (comissão ${pct(x.comissao)} incluída)` : ''}`, dataPrevista: today(), origem: { mod: 'dividas', key: `pf:amort:${x.id}:${uid()}` } });
}
// entrada do vencimento na tesouraria: data = fim do mês do recibo (ou hoje, se ainda não acabou)
const entradaRecibo = r => { const k = chaveEnt(r), pe = pagEnt(k), [ey, em] = mesDaEntrada(+r.ano, +r.mes, k), fim = new Date(ey, em, 0);
  const dia = pe.dia > 0 ? Math.min(pe.dia, fim.getDate()) : fim.getDate(), d = `${ey}-${String(em).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  return { contaDestino: CAIXA, valor: +r.liquido || 0, metodo: 'CAPITALIZAÇÃO', dataPrevista: d < today() ? d : today(),
    descricao: `Vencimento ${MESES[+r.mes - 1]} ${r.ano}${r.entidade ? ' · ' + r.entidade : ''}`, origem: { mod: 'rendimentos', key: chaveRec(r) } }; };
// rendimentos não passam pelo circuito de aprovação: uma assinatura regista e executa a entrada
async function registarEntradas(rs) {
  rs = rs.filter(r => (+r.liquido || 0) > 0 && !vivos(chaveRec(r)).length); if (!rs.length) return;
  if (!app.registarEntradas || !app.podeRegistarEntrada()) { if (rs.length === 1) app.novoPedido({ categoria: ENTRADA, ...entradaRecibo(rs[0]) }); return; }
  try {
    const feitos = await app.registarEntradas(rs.map(entradaRecibo), rs.length === 1 ? 'Registar entrada do vencimento' : 'Registar entrada dos vencimentos',
      `${rs.map(r => `${MESES[+r.mes - 1]} ${r.ano} · <b>${eur(r.liquido)}</b>`).join('<br>')}<br><span style="font-size:12px">Entra na tesouraria sem circuito de aprovação: fica registada e executada com esta assinatura.</span>`);
    if (feitos) { ui.toast(`${feitos.length === 1 ? 'Entrada registada' : feitos.length + ' entradas registadas'} na tesouraria`, 'ok'); app.refresh(); }
  } catch (e) { ui.toast(esc(e.message), 'bad'); }
}
const registarEntrada = r => registarEntradas([r]);
// plano pessoal: o recibo só fica gravado com a entrada do líquido contabilizada na tesouraria (uma assinatura)
const contabAuto = () => !!(app.registarPagamentos && app.registarEntradas && app.podeRegistarEntrada());
/* Entidade pagadora nova (num recibo acabado de gravar): configuração rápida — se é um novo emprego que substitui
   o anterior ou um trabalho a mais, e se o subsídio de refeição dessa entidade conta como rendimento. */
function entidadesNovas(rs) {
  const pl = M().plano, todas = M().recibos, ant = todas.filter(x => !rs.includes(x));
  const novas = [...new Map(rs.filter(r => chaveEnt(r) && !ant.some(x => chaveEnt(x) === chaveEnt(r))).map(r => [chaveEnt(r), r])).values()];
  const fila = novas.map(r => () => configEntidade(r, ant.some(x => +x.liquido > 0), fila));
  if (fila.length) setTimeout(() => fila.shift()(), 350);
}
function configEntidade(r, temAnterior, fila = []) {
  const pl = M().plano, k = chaveEnt(r), nome = r.entidade || 'NIF ' + r.nifEntidade, ent = { modo: 'extra', ref: refConta(r), regime: infoEnt(k).regime, pais: infoEnt(k).pais }, pe = pagEnt(k), wp = { ['seg:' + k]: String(pe.seguinte), ['dia:' + k]: pe.dia };
  const seg = (id, ops) => `<div class="tabs" data-s="${id}" style="flex-wrap:wrap;width:max-content;max-width:100%">${ops.map(([v, l]) => `<button type="button" data-v="${v}">${l}</button>`).join('')}</div>`;
  ui.modal({ title: 'Nova entidade pagadora', sub: `<b>${esc(nome)}</b> aparece pela primeira vez no recibo de ${MESES[+r.mes - 1].toLowerCase()} de ${r.ano}. Configure como entra no seu plano.`,
    body: `${PAR_CSS}<div style="display:flex;flex-direction:column;gap:18px">
      ${temAnterior ? `<div><div style="font-weight:600;margin-bottom:8px">Este rendimento…</div>${seg('modo', [['novo', 'Substitui o emprego anterior'], ['extra', 'É um trabalho a mais']])}
        <div class="faint" style="font-size:12px;margin-top:6px">Novo emprego: as previsões passam a usar só os recibos desde ${fmtMes(ymOf(+r.ano, +r.mes))}. Trabalho a mais: soma ao que já recebe.</div></div>` : ''}
      <div><div style="font-weight:600;margin-bottom:8px">Regime de trabalho</div>${seg('regime', REGIMES)}
        <div style="margin-top:10px">${seg('pais', [['PT', 'Em Portugal'], ['outro', 'Noutro país']])}</div>
        <div class="faint" style="font-size:12px;margin-top:6px">Em Portugal os aumentos seguem as regras do sistema (salário mínimo). Noutro país detetam-se pelos recibos.</div></div>
      <div><div style="font-weight:600;margin-bottom:8px">Quando paga</div>${ctlPagamento(k)}<div class="faint" style="font-size:12px;margin-top:6px">Ex.: o recibo de novembro entra em dezembro, ao dia 1.</div></div>
      ${+r.refeicao > 0 ? `<div><div style="font-weight:600;margin-bottom:8px">Subsídio de refeição (${eur(r.refeicao)} neste recibo)</div>${seg('ref', [['1', 'Conta como rendimento'], ['0', 'Reservado à alimentação']])}
        <div class="faint" style="font-size:12px;margin-top:6px">Reservado: paga primeiro as despesas de alimentação e não entra no rendimento do plano.</div></div>` : ''}
      <div class="faint" style="font-size:12px">Pode mudar depois em Rendimentos › Recibos de vencimento (botão de configuração ao lado do +).</div></div>`,
    onOpen: el => { ligarControlos(el, wp, { ['dia:' + k]: fmtDia }, () => {}); el.querySelectorAll('[data-s]').forEach(g => { const id = g.dataset.s, cur = () => id === 'ref' ? (ent.ref ? '1' : '0') : ent[id];
      const marca = () => g.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === cur())); marca();
      g.querySelectorAll('button').forEach(b => b.onclick = () => { if (id === 'ref') ent.ref = b.dataset.v === '1'; else ent[id] = b.dataset.v; marca(); }); }); },
    actions: [{ label: 'Mais tarde', kind: 'ghost', onClick: () => { if (fila.length) setTimeout(() => fila.shift()(), 300); } },
      { label: icon('check') + 'Guardar', kind: 'primary', onClick: () => { const P = M().plano;
        if (+r.refeicao > 0) P.refeicaoRend = Object.assign({}, P.refeicaoRend || {}, { [k]: ent.ref });
        P.pagamentoEnt = Object.assign({}, P.pagamentoEnt || {}, { [k]: { seguinte: wp['seg:' + k] === 'true', dia: Math.min(28, Math.max(0, +wp['dia:' + k] || 0)) } });
        P.entInfo = Object.assign({}, P.entInfo || {}, { [k]: { regime: ent.regime, pais: ent.pais } });
        if (temAnterior && ent.modo === 'novo') { P.empregoDesde = ymOf(+r.ano, +r.mes); P.salarioBase = 0; }
        audit('PF_ENTIDADE', `${nome}: ${temAnterior ? (ent.modo === 'novo' ? 'novo emprego desde ' + fmtMes(P.empregoDesde || '') : 'trabalho a mais') : 'primeiro emprego'} · ${nomeRegime(ent.regime)} · ${ent.pais === 'PT' ? 'Portugal' : 'outro país'}${+r.refeicao > 0 ? ` · refeição ${ent.ref ? 'conta como rendimento' : 'reservada à alimentação'}` : ''}`);
        app.save(); ui.toast('Configuração guardada', 'ok'); app.refresh(); if (fila.length) setTimeout(() => fila.shift()(), 300); } }] });
}
async function gravarComEntrada(rs, aposGravar) {
  rs = rs.filter(r => (+r.liquido || 0) > 0);
  try {
    const feitos = await app.registarEntradas(rs.map(entradaRecibo), rs.length === 1 ? 'Gravar recibo' : `Gravar ${rs.length} recibos`,
      `${rs.map(r => `${MESES[+r.mes - 1]} ${r.ano} · <b>${eur(r.liquido)}</b>`).join('<br>')}<br><span style="font-size:12px">O líquido entra na tesouraria e fica contabilizado com esta assinatura.</span>`);
    if (!feitos) { ui.toast('Recibo não gravado: a entrada na tesouraria precisa da sua assinatura.', 'warn'); return false; }
    rs.forEach(r => M().recibos.push(r)); if (aposGravar) aposGravar(rs);
    app.save(); ui.toast(rs.length === 1 ? 'Recibo gravado e contabilizado' : `${rs.length} recibos gravados e contabilizados`, 'ok'); app.refresh(); entidadesNovas(rs); return true;
  } catch (e) { ui.toast(esc(e.message), 'bad'); return false; }
}
const estadoPed = key => { const ps = vivos(key); return ps.length ? `${linkPeds(ps)} ${SPAP.ui.estadoBadge(ps[0].estado)}` : ''; };

/* ---------- Formulários ---------- */
function campo(c, x) {
  const val = x[c.k];
  if (c.type === 'check') return `<div class="fld ${c.full ? 'full' : ''}"><label>&nbsp;</label><label class="check"><input type="checkbox" name="${c.k}" ${val ? 'checked' : ''}> ${c.label}</label></div>`;
  if (c.type === 'select') return `<div class="fld ${c.full ? 'full' : ''}"><label>${c.label}</label><select class="inp" name="${c.k}">${c.opts.map(o => `<option value="${esc(o[0])}" ${String(o[0]) === String(val) ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select>${c.hint ? `<span class="hint">${c.hint}</span>` : ''}</div>`;
  const v2 = c.type === 'pct' ? (val == null || val === '' ? '' : r2((+val || 0) * 10000) / 100) : (val ?? '');
  const num = ['money', 'pct', 'number', 'int'].includes(c.type);
  return `<div class="fld ${c.full ? 'full' : ''}"><label>${c.label}${c.type === 'pct' ? ' (%)' : c.type === 'money' ? ' (€)' : ''}</label><input class="inp ${num ? 'num' : ''}" name="${c.k}" ${num ? `type="number" step="${c.type === 'int' ? 1 : 'any'}"` : c.type === 'date' ? 'type="date"' : c.type === 'month' ? 'type="month"' : ''} ${c.min != null ? `min="${c.min}"` : ''} ${c.max != null ? `max="${c.max}"` : ''} value="${esc(v2)}" ${c.ph ? `placeholder="${esc(c.ph)}"` : ''}>${c.hint ? `<span class="hint">${c.hint}</span>` : ''}</div>`;
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
const MAIS_CSS = 'width:28px;height:28px;padding:0;justify-content:center;font-size:16px;line-height:1;font-weight:400;border-radius:6px;border:1px solid var(--line2);background:transparent;color:var(--muted)';
const botaoMais = (ops, titulo) => `<button class="btn sm" data-mais title="${esc(titulo || ops.map(x => x[0]).join(' · '))}" style="${MAIS_CSS};width:34px;height:34px;font-size:19px">+</button>`;
const kpi = (rot, val, foot = '', cls = '', hero = false, add = '') => `<div class="card kpi ${hero ? 'hero' : ''}"${add ? ' style="position:relative"' : ''}>${add ? `<button class="btn sm" data-add="${add}" title="${esc((ATALHOS[add] || []).map(x => x[0]).join(' · '))}" style="position:absolute;top:10px;right:10px;${MAIS_CSS}">+</button>` : ''}<div class="lbl"${add ? ' style="padding-right:34px"' : ''}>${rot}</div><div class="val num ${cls}">${val}</div>${foot ? `<div class="foot">${foot}</div>` : ''}</div>`;
const fmtMes = k => k ? `${MESES[+k.slice(5, 7) - 1]} ${k.slice(0, 4)}` : '—';

/* ---------- Seletor em fita (meses e anos) ---------- */
// ‹ vizinhos [selecionado] vizinhos ›: o atual leva um ponto; "Hoje" aparece quando o atual fica fora da fita
const FITA_CSS = `<style>.pf-fita{display:flex;gap:8px;align-items:center;flex-wrap:nowrap}.pf-mes{background:none;border:0;width:40px;height:40px;padding:0;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;cursor:pointer;color:var(--muted);font-size:26px;line-height:1}.pf-mes:disabled{opacity:.25;cursor:default}.pf-mes:not(:disabled):hover{color:inherit;background:var(--line)}
  .pf-chip{background:none;border:1px solid transparent;border-radius:999px;padding:9px 18px;font-size:15px;line-height:20px;color:var(--muted);cursor:pointer;white-space:nowrap;position:relative}.pf-chip:hover{color:inherit;border-color:var(--line)}.pf-chip.vh{border-color:var(--line)}
  .pf-chip.on{color:inherit;font-weight:600;font-size:17px;padding:9px 22px;border-color:var(--line2);background:var(--panel2);cursor:default}.pf-chip.hoje:not(.on)::after{content:'';position:absolute;left:50%;bottom:-4px;width:5px;height:5px;margin-left:-2.5px;border-radius:50%;background:var(--accent)}
  .pf-fita.sm{gap:4px}.pf-fita.sm .pf-mes{width:32px;height:32px;font-size:22px}.pf-fita.sm .pf-chip{padding:6px 14px;font-size:14px}.pf-fita.sm .pf-chip.on{font-size:15px;padding:6px 16px}
  @media (max-width:640px){.pf-chip.longe{display:none}.pf-chip,.pf-fita.sm .pf-chip{padding:6px 9px;font-size:13px}.pf-chip.on,.pf-fita.sm .pf-chip.on{font-size:14px;padding:6px 12px}.pf-mes,.pf-fita.sm .pf-mes{width:30px;height:30px;font-size:20px}}</style>`;
function fita(id, itens, sel, { rot = String, rotSel, atual, nome = rot, unidade = 'mês', sm = false, n = 5 } = {}) {
  // anos: a fita é sempre centrada no ano escolhido (dois de cada lado; no telemóvel um)
  if (unidade === 'ano') { const y = +sel; itens = [y - 2, y - 1, y, y + 1, y + 2]; }
  itens = itens.map(String); sel = String(sel); atual = atual == null ? null : String(atual);
  const i = itens.indexOf(sel), a = Math.max(0, Math.min(i - Math.floor(n / 2), itens.length - n)), vis = itens.slice(a, a + n), ano = unidade === 'ano';
  const ant = ano ? 'Ano anterior' : 'Mês anterior', seg = ano ? 'Ano seguinte' : 'Mês seguinte';
  return `${FITA_CSS}<div class="pf-fita${sm ? ' sm' : ''}" data-fita="${id}">
    <button class="pf-mes" data-fv="${i > 0 ? itens[i - 1] : ''}" ${i > 0 ? '' : 'disabled'} title="${ant}" aria-label="${ant}">‹</button>
    ${vis.map(x => `<button class="pf-chip ${x === sel ? 'on' : ''} ${x === atual ? 'hoje' : ''} ${Math.abs(itens.indexOf(x) - i) > 1 ? 'longe' : ''}" data-fv="${x}" title="${esc(nome(x))}${x === atual ? (ano ? ' (ano atual)' : ' (mês atual)') : ''}">${esc(x === sel ? (rotSel || rot)(x) : rot(x))}</button>`).join('')}
    <button class="pf-mes" data-fv="${i < itens.length - 1 ? itens[i + 1] : ''}" ${i < itens.length - 1 ? '' : 'disabled'} title="${seg}" aria-label="${seg}">›</button>
    ${atual != null && (ano || itens.includes(atual)) && !vis.includes(atual) ? `<button class="pf-chip vh" data-fv="${atual}" title="Voltar a ${esc(nome(atual))}">${ano ? 'Este ano' : 'Hoje'}</button>` : ''}</div>`;
}
// barra com a fita ao centro e as ações à direita (em ecrã estreito fica tudo empilhado e centrado)
const barraFita = (htmlFita, direita = '', esquerda = '') => `<div class="pf-barra">${FITA_CSS.replace('<style>', '<style>.pf-barra{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:12px;margin-bottom:16px}.pf-barra>.pf-dir{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}@media (max-width:1250px){.pf-barra{grid-template-columns:1fr}.pf-barra>*{justify-self:center}.pf-barra>.pf-dir{justify-content:center}}')}<div>${esquerda}</div>${htmlFita}<div class="pf-dir">${direita}</div></div>`;
const ligarFita = (v, id, fn) => v.querySelectorAll(`[data-fita="${id}"] [data-fv]`).forEach(b => { if (b.dataset.fv && !b.disabled && !b.classList.contains('on')) b.onclick = () => fn(b.dataset.fv); });
// rótulo curto de um mês (com o ano só quando é diferente do de referência)
const rotMes = ref => x => { const n = MES3[+x.slice(5, 7) - 1], c = n[0] + n.slice(1).toLowerCase(); return x.slice(0, 4) !== String(ref).slice(0, 4) ? `${c} ${x.slice(2, 4)}` : c; };

/* ---------- Atalhos [+] do Painel ---------- */
// [rótulo, rota, botão a acionar na página (ou função), separador]
const ATALHOS = {
  rend: [['Ler recibo', null, () => escolherRecibos(), null, 'upload', 'PDF ou fotografia do recibo de vencimento'], ['Adicionar manualmente', null, () => editarRecibo(), null, 'edit', 'Introduzir os valores do recibo']],
  desp: [['Despesa fixa', 'despesas', 'nd', null, 'edit', 'Despesa fixa só sua'], ['Despesa partilhada', null, () => partilharDespesa(), null, 'users', 'Dividir com outra pessoa do grupo']],
  div: [['Ler extrato', null, () => escolherExtratos(), null, 'upload', 'PDF do extrato do cartão de crédito'], ['Adicionar manualmente', 'dividas', 'nv', null, 'edit', 'Novo crédito, empréstimo ou cartão']],
};
let atalhoPend = null;
const correrAtalho = v => { const id = atalhoPend; atalhoPend = null; const b = id && v.querySelector('#' + id); if (b) setTimeout(() => b.click(), 0); };
const usarAtalho = k => escolherAcao(ATALHOS[k] || []);
// [+] de uma página: as opções que apontam para um botão (escondido) da própria página carregam nele
const ligarMais = (v, ops, sel = '[data-mais]', titulo) => v.querySelectorAll(sel).forEach(b => b.onclick = () => escolherAcao(ops.map(o => typeof o[2] === 'string'
  ? [o[0], null, () => { const x = v.querySelector('#' + o[2]); if (x) x.click(); }, null, o[4], o[5]] : o), titulo));
const escondidos = ids => ids.map(id => `<button type="button" id="${id}" hidden></button>`).join('');
function escolherAcao(ops, titulo = 'Adicionar') {
  const fazer = ([, rota, alvo, aba]) => { if (typeof alvo === 'function') return alvo(); if (aba) setTab(aba[0], aba[1]); atalhoPend = alvo; app.go(rota); };
  if (ops.length === 1) return fazer(ops[0]);
  // opções em quadrados: clicar num faz logo a ação
  ui.modal({ title: titulo, body: `<style>.pf-op{cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;min-height:150px;padding:18px;text-align:center;border:1px solid var(--line2);border-radius:14px;background:var(--panel2);transition:border-color .15s,transform .15s}.pf-op:hover{border-color:var(--accent);transform:translateY(-2px)}.pf-op svg{width:30px;height:30px;color:var(--accent)}.pf-op b{font-size:15px}.pf-op span{font-size:12px;color:var(--muted)}</style>
      <div style="display:grid;grid-template-columns:repeat(${Math.min(3, ops.length)},minmax(0,1fr));gap:12px">${ops.map((o, i) => `<div class="pf-op" data-op="${i}" role="button" tabindex="0">${icon(o[4] || 'plus')}<b>${esc(o[0])}</b>${o[5] ? `<span>${esc(o[5])}</span>` : ''}</div>`).join('')}</div>`,
    onOpen: (el, fechar) => el.querySelectorAll('[data-op]').forEach(t => { const go = () => { const o = ops[+t.dataset.op]; fechar(); fazer(o); }; t.onclick = go; t.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }; }),
    actions: [{ label: 'Cancelar', kind: 'ghost' }] });
}

/* ---------- Painel ---------- */
function visao(v) {
  // mês do Painel: despesas próprias em vigor e parte na casa desse mês (valores reais, médias ou plano do cartão)
  const hojeYm = ymHoje(), mesesSel = Array.from({ length: 24 }, (_, i) => SPAP.addMonths(hojeYm + '-01', i - 12).slice(0, 7));
  let ym = tab('pf-painel-mes', hojeYm); if (!mesesSel.includes(ym)) ym = hojeYm;
  const nomeYm = x => `${MESES[+x.slice(5, 7) - 1]} ${x.slice(0, 4)}`;
  const I = indicadores(ym, true), ano = +today().slice(0, 4), P = projecao(ano), kn = app.kn;
  const [ryY, rmY] = mesDoRecibo(+ym.slice(0, 4), +ym.slice(5, 7)), linhaYm = projecao(ryY).linhas[rmY - 1], subYm = linhaYm.sub, ymRec = ymOf(ryY, rmY);
  const cor = I.score >= 75 ? 'var(--ok)' : I.score >= 50 ? 'var(--warn)' : 'var(--bad)';
  // diversificação das despesas do mês: próprias e parte nas partilhas por categoria, mais as prestações
  const divCat = {}; despAtivas(ym).forEach(e => { const c = e.categoria || 'Outros'; divCat[c] = r2((divCat[c] || 0) + mensalDesp(e)); });
  Object.entries((casaParte(ym) || {}).cats || {}).forEach(([c, val]) => divCat[c] = r2((divCat[c] || 0) + val));
  if (I.prest > 0) divCat['Prestações de dívidas'] = r2((divCat['Prestações de dívidas'] || 0) + I.prest);
  const divItens = Object.entries(divCat).filter(([, val]) => val > 0.005).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value })), divTot = r2(divItens.reduce((t, x) => t + x.value, 0));
  v.innerHTML = `<div style="display:flex;justify-content:center;margin:10px 0 28px">${fita('pfm', mesesSel, ym, { rot: rotMes(ym), rotSel: nomeYm, nome: nomeYm, atual: hojeYm })}</div>${I.alertas.map(([k, t]) => `<div class="alert ${k}" style="margin-bottom:10px">${icon('alert')}<div>${t}</div></div>`).join('')}
    <style>.pf-kpis .kpi .foot{max-height:0;opacity:0;overflow:hidden;margin-top:0;transition:max-height .2s,opacity .2s,margin-top .2s}.pf-kpis .kpi:hover .foot,.pf-kpis .kpi:focus-within .foot{max-height:160px;opacity:1;margin-top:8px}</style>
    <div class="grid g4 pf-kpis" style="margin-top:${I.alertas.length ? 6 : 0}px">
      ${kpi(`${icon('wallet')} ${kn('pf_rend', 'Rendimento líquido do mês')}`, eur(I.rend), `${linhaYm.real != null ? 'Recibo' : 'Previsto'} de ${MES3[rmY - 1].toLowerCase()}.${ymRec !== ym ? ` · pago em ${MES3[+ym.slice(5, 7) - 1].toLowerCase()}.` : ''}${linhaYm.subValor > 0.004 ? `<br>Inclui ${eur(linhaYm.subValor)} sub. de ${linhaYm.subTipo}` : subYm ? '<br>Com subsídio' : ''}${linhaYm.refeicao > 0.004 ? (M().plano.incluirRefeicao ? `<br>Inclui ${eur(linhaYm.refeicao)} de refeição` : `<br>+ ${eur(linhaYm.refeicao)} de refeição (alimentação)`) : ''}<br>Média 12 meses: ${eur(rendimentoMensal())}`, '', true, podeEditar() ? 'rend' : '')}
      ${kpi(`${icon('list')} ${kn('pf_desp', 'Despesas fixas / mês')}`, eur(I.desp), (() => { const c = casaParte(ym), n = despAtivas(ym).length, proprias = r2(despAtivas(ym).reduce((t, e) => t + mensalDesp(e), 0));
        const txt = `${n} ${n === 1 ? 'despesa própria' : 'despesas próprias'}${n ? ' · ' + eur(proprias) : ''}`;
        return `<a href="#/despesas">${txt}</a>${c && !c.semDados ? `<br>+ ${eur(c.valor)} parte nas partilhadas (${c.n} ${c.n === 1 ? 'despesa' : 'despesas'})` : ''}${I.refC > 0.004 ? `<br>− ${eur(I.refC)} de alimentação paga pelo subsídio de refeição` : ''}`; })(), '', false, podeEditar() ? 'desp' : '')}
      ${kpi(`${icon('credit')} ${kn('pf_prest', 'Prestações / mês')}`, eur(I.prest), `<a href="#/dividas">${divAtivas().length} dívidas · ${eur(I.divida)}</a>`, '', false, podeEditar() ? 'div' : '')}
      ${kpi(`${icon('coins')} ${kn('pf_exc', 'Excedente mensal')}`, eur(I.exc), `${nomeYm(ym)}${I.rend > 0 ? ` · ${pct(Math.max(0, I.exc) / I.rend)} do rendimento` : ''}`, I.exc < 0 ? 'neg' : 'pos')}
    </div>
    <div class="grid g2" style="margin-top:16px">
      <div class="card"><div class="card-h"><h3>${kn('pf_saude', 'Saúde financeira')}</h3><span class="badge plain" style="background:${cor};color:#fff;font-size:14px">${I.nota} · ${I.score}/100</span></div>
        <div class="stack" style="gap:12px">${I.comp.map(c => `<div><div class="row between" style="font-size:13px;margin-bottom:5px"><span>${kn(c.k, c.n)}</span><b class="num">${c.p}/${c.max}</b></div>
          <div class="progress ${c.p / c.max < 0.4 ? 'bad' : c.p / c.max < 0.75 ? 'warn' : ''}"><i style="width:${Math.round(100 * c.p / c.max)}%"></i></div><div class="faint" style="font-size:12px;margin-top:3px">${esc(c.t)}</div></div>`).join('')}</div></div>
      <div class="card"><div class="card-h"><h3>Diversificação das despesas</h3><span class="sub">${nomeYm(ym)} · <a href="#/despesas">ver despesas</a></span></div>
        ${divItens.length ? `<div id="chdiv"></div><div class="faint" style="font-size:12px;margin-top:8px">${divItens.slice(0, 3).map(x => `${esc(x.label)} ${pct(x.value / divTot)}`).join(' · ')}</div>` : '<div class="empty">Sem despesas nem prestações neste mês. Registe-as em <a href="#/despesas">Despesas fixas</a>.</div>'}</div>
    </div>`;
  ligarFita(v, 'pfm', x => { setTab('pf-painel-mes', x); app.refresh(); });
  v.querySelectorAll('[data-add]').forEach(b => b.onclick = () => usarAtalho(b.dataset.add));
  const chdiv = v.querySelector('#chdiv'); if (chdiv) chart.donut(chdiv, { items: divItens, center: eur(divTot), sub: 'no mês' });
}

/* ---------- Rendimentos: recibos de vencimento e projeção ---------- */
const COLS_REC = () => [
  { k: 'ano', label: 'Ano', type: 'int', min: 2000, max: 2100 }, { k: 'mes', label: 'Mês', type: 'select', opts: MESES.map((n, i) => [i + 1, n]) },
  { k: 'entidade', label: 'Entidade patronal', ph: 'opcional' }, { k: 'nifEntidade', label: 'NIF da entidade', ph: 'opcional' },
  { k: 'bruto', label: 'Vencimento bruto', type: 'money' }, { k: 'brutoIRS', label: 'Bruto sujeito a IRS', type: 'money', hint: 'Só se o recibo tiver rubricas isentas (abono para falhas isento, ajudas de custo isentas…). Vazio = igual ao bruto.' }, { k: 'liquido', label: 'Líquido recebido', type: 'money', hint: 'Total líquido do recibo, incluindo subsídios pagos nesse mês.' },
  { k: 'irs', label: 'Retenção de IRS', type: 'money' }, { k: 'ss', label: 'Segurança Social', type: 'money' },
  { k: 'refeicao', label: 'Subsídio de refeição', type: 'money', hint: 'Parte do líquido que é subsídio de refeição.' }, { k: 'notas', label: 'Notas' },
  { k: 'subFerias', label: 'Inclui subsídio de férias', type: 'check' }, { k: 'subFeriasValor', label: 'Valor do subsídio de férias', type: 'money' },
  { k: 'subNatal', label: 'Inclui subsídio de Natal', type: 'check' }, { k: 'subNatalValor', label: 'Valor do subsídio de Natal', type: 'money' }];
function editarRecibo(x) {
  const novo = !x, m = M(), ult = m.recibos.slice().sort((a, b) => b.ano - a.ano || b.mes - a.mes)[0];
  const r = x || (() => { const hoje = today(); return { ano: +hoje.slice(0, 4), mes: +hoje.slice(5, 7), entidade: ult ? ult.entidade : '', nifEntidade: ult ? ult.nifEntidade : '', refeicao: ult ? ult.refeicao : 0 }; })();
  editar({ titulo: 'Recibo de vencimento', sub: contabAuto() ? 'Introduza os valores do recibo. Ao gravar, o líquido entra na tesouraria com a sua assinatura.' : 'Introduza os valores do recibo. A entrada do dinheiro na tesouraria é feita por pedido SPAP.', cols: COLS_REC(), x: r, novo,
    validar: f => !(f.liquido > 0) ? 'Indique o líquido recebido' : !(f.ano >= 2000) ? 'Ano inválido' : null,
    onSave: f => { f.mes = +f.mes; Object.assign(r, f);
      if (novo && contabAuto()) { r.id = 'R' + uid(); r.criadoEm = new Date().toISOString(); setTimeout(() => gravarComEntrada([r], () => audit('PF_RECIBO', `${MESES[r.mes - 1]} ${r.ano} · líquido ${eur(r.liquido)}`)), 0); return; }
      if (novo) { r.id = 'R' + uid(); r.criadoEm = new Date().toISOString(); m.recibos.push(r); entidadesNovas([r]); }
      audit('PF_RECIBO', `${MESES[r.mes - 1]} ${r.ano} · líquido ${eur(r.liquido)}`); },
    onDelete: novo ? null : y => { m.recibos = m.recibos.filter(z => z !== y); audit('PF_RECIBO_REMOVIDO', `${MESES[y.mes - 1]} ${y.ano}`); } });
}
/* ---------- Leitura automática de recibos (PDF / fotografia) ---------- */
function escolherRecibos() {
  if (!SPAP.leitorRecibos) { ui.toast('O leitor de recibos não está disponível nesta página.', 'bad'); return; }
  const inp = document.createElement('input'); inp.type = 'file'; inp.multiple = true; inp.accept = '.pdf,application/pdf,image/*';
  inp.onchange = () => { if (inp.files.length) lerRecibos([...inp.files]); };
  inp.click();
}
async function lerRecibos(ficheiros) {
  const pm = ui.modal({ title: 'A ler recibos', locked: true, body: `<p class="muted" style="margin:0" id="lr">A preparar…</p>` });
  const msg = t => { const e = pm.el.querySelector('#lr'); if (e) e.textContent = t; };
  const lidos = [];
  for (let i = 0; i < ficheiros.length; i++) {
    const f = ficheiros[i], pre = ficheiros.length > 1 ? `${i + 1}/${ficheiros.length} · ${f.name}: ` : `${f.name}: `;
    try { const { texto, metodo } = await SPAP.leitorRecibos.lerTexto(f, t => msg(pre + t)); msg(pre + 'a interpretar…'); lidos.push({ nome: f.name, metodo, d: SPAP.leitorRecibos.analisar(texto) }); }
    catch (e) { lidos.push({ nome: f.name, erro: e.message || String(e) }); }
  }
  pm.close();
  if (lidos.every(x => x.erro)) {
    ui.modal({ title: 'Não foi possível ler os recibos', body: `<div class="stack" style="gap:8px">${lidos.map(x => `<div><b>${esc(x.nome)}</b><div class="muted" style="font-size:13px">${esc(x.erro)}</div></div>`).join('')}
      <div class="alert info">${icon('alert')}<div>Pode continuar a registar o recibo à mão em <b>Registar recibo</b>.</div></div></div>`, actions: [{ label: 'Fechar', kind: 'primary' }] });
    return;
  }
  reverRecibos(lidos);
}
function reverRecibos(lidos) {
  const m = M(), ult = m.recibos.slice().sort((a, b) => b.ano - a.ano || b.mes - a.mes)[0];
  const num = (n, v) => `<input class="inp inp-sm num" type="number" step="any" name="${n}" value="${v == null ? '' : esc(v)}" style="width:92px">`;
  const linhas = lidos.map((x, i) => {
    if (x.erro) return `<tr><td></td><td><b>${esc(x.nome)}</b><div class="faint" style="font-size:11.5px">não lido</div></td><td colspan="11"><span class="badge bad">erro</span> <span class="muted" style="font-size:12px">${esc(x.erro)}</span></td></tr>`;
    const d = x.d, avisos = [];
    if (!(d.liquido > 0)) avisos.push('líquido não encontrado');
    if (!d.ano || !d.mes) avisos.push('mês não encontrado');
    if (d.ano && d.mes && m.recibos.some(r => +r.ano === +d.ano && +r.mes === +d.mes)) avisos.push(`já existe um recibo de ${MESES[d.mes - 1]} ${d.ano}`);
    if (lidos.some((y, j) => j < i && y.d && y.d.ano === d.ano && y.d.mes === d.mes)) avisos.push('outro recibo do mesmo mês neste lote');
    const bloqueia = avisos.some(a => !a.startsWith('outro'));
    const ano = d.ano || +today().slice(0, 4), mes = d.mes || +today().slice(5, 7);
    return `<tr data-i="${i}" style="vertical-align:top"><td><input type="checkbox" name="inc" ${bloqueia ? '' : 'checked'}></td>
      <td style="min-width:150px"><b style="font-size:12.5px;word-break:break-all">${esc(x.nome)}</b><div class="faint" style="font-size:11.5px">${esc(x.metodo)}${d.modelo ? ' · ' + esc(d.modelo) : ''}</div>
        ${avisos.length ? `<div style="margin-top:4px">${avisos.map(a => `<span class="badge warn" style="margin:2px 2px 0 0">${esc(a)}</span>`).join('')}</div>` : ''}${d.notas.length ? `<div class="faint" style="font-size:11px;margin-top:3px">${esc(d.notas.join(' · '))}</div>` : ''}</td>
      <td><input class="inp inp-sm num" type="number" name="ano" value="${ano}" style="width:72px"></td>
      <td><select class="inp inp-sm" name="mes" style="min-width:112px">${MESES.map((n, k) => `<option value="${k + 1}" ${k + 1 === +mes ? 'selected' : ''}>${n}</option>`).join('')}</select></td>
      <td>${num('bruto', d.bruto)}</td><td>${num('liquido', d.liquido)}</td><td>${num('irs', d.irs)}</td><td>${num('ss', d.ss)}</td><td>${num('refeicao', d.refeicao)}</td>
      <td>${num('subFeriasValor', d.subFerias ? d.subFeriasValor : null)}</td><td>${num('subNatalValor', d.subNatal ? d.subNatalValor : null)}</td>
      <td><input class="inp inp-sm" name="entidade" value="${esc(d.entidade || (ult && ult.nifEntidade === d.nifEntidade ? ult.entidade || '' : ''))}" style="width:150px"></td>
      <td><input class="inp inp-sm mono" name="nifEntidade" value="${esc(d.nifEntidade || '')}" style="width:96px"></td></tr>`;
  }).join('');
  ui.modal({ title: 'Rever recibos lidos', wide: true, sub: 'Confirme os valores antes de gravar. As linhas com aviso ficam por gravar até as marcar.',
    body: `<div class="tbl-wrap"><table class="tbl"><thead><tr><th></th><th>Ficheiro</th><th>Ano</th><th>Mês</th><th class="r">Bruto</th><th class="r">Líquido</th><th class="r">IRS</th><th class="r">SS</th><th class="r">Refeição</th><th class="r">Sub. férias</th><th class="r">Sub. Natal</th><th>Entidade</th><th>NIF</th></tr></thead><tbody>${linhas}</tbody></table></div>`,
    onOpen: el => { const md = el.querySelector('.modal'); if (md) md.style.width = 'min(1400px, 96vw)'; },
    actions: [{ label: 'Cancelar', kind: 'ghost' }, { label: icon('check') + 'Gravar recibos', kind: 'primary', onClick: el => {
      const novos = [];
      for (const tr of el.querySelectorAll('tr[data-i]')) {
        if (!tr.querySelector('[name=inc]').checked) continue;
        const x = lidos[+tr.dataset.i], v = n => tr.querySelector(`[name=${n}]`).value.trim(), nv = n => v(n) === '' ? 0 : r2(+v(n) || 0);
        const r = { id: 'R' + uid(), ano: parseInt(v('ano'), 10), mes: +v('mes'), entidade: v('entidade'), nifEntidade: v('nifEntidade'), bruto: nv('bruto'), liquido: nv('liquido'), irs: nv('irs'), ss: nv('ss'), refeicao: nv('refeicao'),
          subFerias: nv('subFeriasValor') > 0, subFeriasValor: nv('subFeriasValor'), subNatal: nv('subNatalValor') > 0, subNatalValor: nv('subNatalValor'), notas: '', ficheiro: x.nome, lidoPor: x.metodo, criadoEm: new Date().toISOString() };
        if (!(r.liquido > 0) || !(r.ano >= 2000)) { ui.toast(`${esc(x.nome)}: indique o ano e o líquido recebido`, 'warn'); return false; }
        novos.push(r);
      }
      if (!novos.length) { ui.toast('Nenhum recibo marcado para gravar', 'warn'); return false; }
      const auditar = rs => rs.forEach(r => audit('PF_RECIBO', `${MESES[r.mes - 1]} ${r.ano} · líquido ${eur(r.liquido)} · lido de ${r.ficheiro} (${r.lidoPor})`));
      if (contabAuto()) { setTab('pf-ano', String(novos[novos.length - 1].ano)); setTimeout(() => gravarComEntrada(novos, auditar), 0); return; }
      novos.forEach(r => m.recibos.push(r)); auditar(novos); entidadesNovas(novos);
      app.save(); ui.toast(`${novos.length} ${novos.length === 1 ? 'recibo gravado' : 'recibos gravados'}`, 'ok');
      setTab('pf-ano', String(novos[novos.length - 1].ano)); app.refresh();
      // logo a seguir, uma só assinatura regista a entrada dos vencimentos na tesouraria (pode cancelar e fazê-lo depois)
      if (app.can('criar')) setTimeout(() => registarEntradas(novos), 0); } }] });
}
/* ---------- IRS: liquidação anual (Cat. A + Cat. B), configurada numa linha por ano ----------
   Porta o motor do Planeador antigo: IRS Jovem sobre o bruto (Cat. B primeiro, limite partilhado), coeficiente do regime
   simplificado na Cat. B, dedução específica (ou SS se maior), taxa sobre o rendimento coletável + isentos englobados,
   solidariedade, deduções à coleta, benefício municipal, mínimo de existência e acerto com as retenções. */
const IRS_PADRAO = [
  '=IRS(2024; ESC(7703:13,25%:0; 11623:18%:365,89; 16472:23%:947,04; 21321:26%:1441,40; 27146:32,75%:2880,47; 39791:37%:4034,17; 51997:43,5%:6620,43; 81199:45%:7400,21; 48%:9836,45); ESPECIFICA(4350,24); MINIMO(11480); JOVEM(100%,75%,50%,50%,25%; 20370,4; 35; 4); CATB(75%); SOLID(80000:2,5%; 250000:5%); GERAIS(35%; 250); SAUDE(15%; 1000); EDUCACAO(30%; 800); JUROS(15%; 296); RENDAS(15%; 600); LARES(25%; 403,75); PPR(20%; 400); IVA(250; RESTAURACAO 15%, OFICINAS 15%, CABELEIREIROS 15%, VETERINARIOS 15%, GINASIOS 30%, PASSES 100%, PUBLICACOES 100%, MEDICVET 35%))',
  '=IRS(2025; ESC(8059:12,5%:0; 12160:16%:282,07; 17233:21,5%:950,87; 22306:24,4%:1450,67; 28400:31,4%:3012,09; 41629:34,9%:4006,09; 44987:43,1%:7419,67; 83696:44,6%:8094,47; 48%:10940,13); ESPECIFICA(4462,15); MINIMO(12180); JOVEM(100%,75%,75%,75%,50%,50%,50%,25%,25%,25%; 28737,5; 35); CATB(75%); SOLID(80000:2,5%; 250000:5%); GERAIS(35%; 250); SAUDE(15%; 1000); EDUCACAO(30%; 800); JUROS(15%; 296); RENDAS(15%; 600); LARES(25%; 403,75); PPR(20%; 400); IVA(250; RESTAURACAO 15%, OFICINAS 15%, CABELEIREIROS 15%, VETERINARIOS 15%, GINASIOS 30%, PASSES 100%, PUBLICACOES 100%, MEDICVET 35%))',
  '=IRS(2026; ESC(8059:12,5%:0; 12160:16%:282,07; 17233:21,5%:950,87; 22306:24,4%:1450,67; 28400:31,4%:3012,09; 41629:34,9%:4006,09; 44987:43,1%:7419,67; 83696:44,6%:8094,47; 48%:10940,13); ESPECIFICA(4462,15); MINIMO(12180); JOVEM(100%,75%,75%,75%,50%,50%,50%,25%,25%,25%; 28737,5; 35); CATB(75%); SOLID(80000:2,5%; 250000:5%); GERAIS(35%; 250); SAUDE(15%; 1000); EDUCACAO(30%; 800); JUROS(15%; 296); RENDAS(15%; 600); LARES(25%; 403,75); PPR(20%; 400); IVA(250; RESTAURACAO 15%, OFICINAS 15%, CABELEIREIROS 15%, VETERINARIOS 15%, GINASIOS 30%, PASSES 100%, PUBLICACOES 100%, MEDICVET 35%))'].join('\n');
const NOMES_DED = { GERAIS: 'Despesas gerais familiares', SAUDE: 'Saúde', EDUCACAO: 'Educação', JUROS: 'Juros de habitação', RENDAS: 'Rendas de habitação', LARES: 'Lares', PPR: 'PPR', DONATIVOS: 'Donativos', PENSAO: 'Pensão de alimentos',
  RESTAURACAO: 'IVA · restauração e alojamento', OFICINAS: 'IVA · oficinas', CABELEIREIROS: 'IVA · cabeleireiros', VETERINARIOS: 'IVA · veterinários', GINASIOS: 'IVA · ginásios', PASSES: 'IVA · passes de transportes', PUBLICACOES: 'IVA · jornais e revistas', MEDICVET: 'IVA · medicamentos veterinários' };
const numPT = x => { let t = String(x == null ? '' : x).trim(); const pc = t.endsWith('%'); t = t.replace('%', '').replace(/\s/g, ''); if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.'); const v = parseFloat(t); return isFinite(v) ? (pc ? v / 100 : v) : null; };
const semAcento = t => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
function partirTopo(t) { const out = []; let d = 0, cur = ''; for (const ch of String(t)) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ';' && d === 0) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map(x => x.trim()).filter(Boolean); }
function lerFormula(t) { const m = String(t).trim().replace(/^=/, '').match(/^([A-Za-zÀ-ú_]+)\s*\(([\s\S]*)\)\s*$/); return m ? { nome: semAcento(m[1]), args: partirTopo(m[2]) } : null; }
function lerRegraIRS(l) {
  const f = lerFormula(l); if (!f || f.nome !== 'IRS') throw new Error('deve ser =IRS(ano; …)');
  const ano = parseInt(f.args[0], 10); if (!(ano > 2000)) throw new Error('falta o ano');
  const r = { ano, esc: [], especifica: 0, minimo: 0, jovem: [], jovemLimite: Infinity, jovemIdade: 35, jovemQNQ: null, coefB: 0.75, solid: [], ded: {}, ivaLimite: 250, iva: {} };
  f.args.slice(1).forEach(a => { const g = lerFormula(a); if (!g) throw new Error(`não percebo «${a}»`); const A = g.args;
    if (g.nome === 'ESC') r.esc = A.map((x, i) => { const p = x.split(':').map(t => t.trim()), ult = i === A.length - 1 && !/^[\d.,]+$/.test(p[0]) || p[0] === '';
      // limite:taxa[:parcela] · o último escalão é só taxa[:parcela]
      const [lim, tx, pa] = ult ? [null, p[0], p[1]] : p, e = { ate: lim == null ? Infinity : numPT(lim), taxa: numPT(tx), parcelaFix: pa != null && pa !== '' ? numPT(pa) : null };
      if (e.taxa == null || e.ate == null) throw new Error(`escalão inválido «${x}»`); return e; });
    else if (g.nome === 'ESPECIFICA') r.especifica = numPT(A[0]) || 0;
    else if (g.nome === 'MINIMO') r.minimo = numPT(A[0]) || 0;
    else if (g.nome === 'JOVEM') { r.jovem = String(A[0] || '').split(',').map(numPT).filter(v => v != null); if (A[1]) r.jovemLimite = numPT(A[1]); if (A[2]) r.jovemIdade = numPT(A[2]); if (A[3]) r.jovemQNQ = numPT(A[3]); }
    else if (g.nome === 'CATB') r.coefB = numPT(A[0]);
    else if (g.nome === 'SOLID') r.solid = A.map(x => { const [de, tx] = x.split(':'); return { de: numPT(de), taxa: numPT(tx) }; });
    else if (g.nome === 'IVA') { r.ivaLimite = numPT(A[0]); String(A[1] || '').split(',').forEach(x => { const m = x.trim().match(/^(\S+)\s+(.+)$/); if (m) r.iva[semAcento(m[1])] = numPT(m[2]); }); }
    else r.ded[g.nome] = { taxa: numPT(A[0]) || 0, limite: A[1] != null && String(A[1]).trim() !== '' ? numPT(A[1]) : Infinity }; });
  if (!r.esc.length) throw new Error('faltam os escalões ESC(…)');
  // parcela a abater de cada escalão (método AT), calculada a partir dos limites e taxas
  // parcela a abater: a oficial, se indicada (limite:taxa:parcela); senão calculada a partir dos limites e taxas
  let parc = 0; r.esc.forEach((e, i) => { if (i) parc += r.esc[i - 1].ate * (e.taxa - r.esc[i - 1].taxa); e.parcela = e.parcelaFix != null ? e.parcelaFix : r2(parc); });
  return r;
}
function linhasIRS(texto, ler) { const out = {}, erros = []; String(texto || '').split(/\r?\n/).map(l => l.trim()).forEach((l, i) => { if (!l || l.startsWith('#')) return; try { const r = ler(l); out[r.ano] = r; } catch (e) { erros.push(`linha ${i + 1}: ${e.message}`); } }); return { out, erros }; }
// regras de IRS (escalões, deduções, IRS Jovem…): definidas no sistema (IRS_PADRAO), não pelo utilizador
const regrasIRS = () => linhasIRS(IRS_PADRAO, lerRegraIRS);
// despesas do e-Fatura guardadas como =DESPESAS(ano; NOME valor; …), uma linha por ano
const fmtPT = x => String(r2(x)).replace('.', ',');
function gravarDespesasIRS(texto, ano, v) {
  const linhas = String(texto || '').split(/\r?\n/).filter(l => { const t = l.trim(); if (!t) return false; try { return lerDespesasIRS(t).ano !== ano; } catch (e) { return true; } });
  const itens = Object.entries(v).filter(([, x]) => x > 0).map(([k, x]) => `${k} ${fmtPT(x)}`);
  if (itens.length) linhas.push(`=DESPESAS(${ano}; ${itens.join('; ')})`);
  return linhas.sort().join('\n');
}
function lerDespesasIRS(l) { const f = lerFormula(l); if (!f || f.nome !== 'DESPESAS') throw new Error('deve ser =DESPESAS(ano; …)'); const ano = parseInt(f.args[0], 10); if (!(ano > 2000)) throw new Error('falta o ano');
  const v = {}; f.args.slice(1).forEach(a => { const m = a.match(/^(\S+)\s+(.+)$/); if (!m || numPT(m[2]) == null) throw new Error(`não percebo «${a}»`); v[semAcento(m[1])] = numPT(m[2]); }); return { ano, v }; }
const despesasIRS = () => linhasIRS(M().plano.irsDespesas, lerDespesasIRS);
const escalaoIRS = (x, r) => { const i = r.esc.findIndex(e => x <= e.ate); return { i: i < 0 ? r.esc.length - 1 : i, ...r.esc[i < 0 ? r.esc.length - 1 : i] }; };
// Cat. A do ano (bruto sujeito a IRS, sem rubricas isentas): recibos reais + (ano atual ou futuro) meses em falta projetados pela média sem subsídios
function catAIRS(ano) {
  const m = M(), rs = m.recibos.filter(p => +p.ano === ano), y0 = +today().slice(0, 4), soma = (xs, k) => xs.reduce((t, p) => t + (k === 'bruto' && +p.brutoIRS > 0 ? +p.brutoIRS : +p[k] || 0), 0);
  const o = { bruto: soma(rs, 'bruto'), irs: soma(rs, 'irs'), ss: soma(rs, 'ss'), real: rs.length, proj: 0, fonte: null };
  if (ano < y0) return o;
  let base = rs; for (let y = ano - 1; !base.length && y >= ano - 3; y--) { base = m.recibos.filter(p => +p.ano === y); o.fonte = y; }
  if (!base.length) return o;
  const so = base.filter(p => !p.subFerias && !p.subNatal), med = (so.length ? soma(so, 'bruto') / so.length : soma(base, 'bruto') / base.length) * (o.fonte ? salarioAno(ano).fator / salarioAno(o.fonte).fator : 1);
  const taxa = soma(base, 'bruto') > 0 ? soma(base, 'irs') / soma(base, 'bruto') : 0, meses = new Set(rs.map(p => +p.mes));
  let temF = rs.some(p => p.subFerias), temN = rs.some(p => p.subNatal);
  for (let mm = 1; mm <= 12; mm++) { if (meses.has(mm)) continue; let g = med; if (mm === MES_FERIAS && !temF) { g += med; temF = true; } if (mm === MES_NATAL && !temN) { g += med; temN = true; }
    o.bruto += g; o.irs += g * taxa; o.ss += g * 0.11; o.proj++; }
  return o;
}
// Cat. B do ano: faturas-recibo (FR) e recibos (RG); uma fatura (FT) sozinha não é rendimento recebido
const temCatB = () => { try { return M().recibosB.some(contaCatB); } catch (e) { return false; } };
const contaCatB = x => !x.anulado && ['FR', 'RG'].includes(String(x.tipo || '').toUpperCase());
const catBIRS = ano => { const rs = M().recibosB.filter(x => +String(x.data).slice(0, 4) === ano && contaCatB(x)); return { bruto: r2(sum(rs, 'bruto')), irs: r2(sum(rs, 'irs')), iva: r2(sum(rs, 'iva')), n: rs.length }; };
function calcIRS(ano) {
  const pl = M().plano, { out: regras, erros } = regrasIRS(), avisos = [];
  let r = regras[ano]; if (!r) { const ys = Object.keys(regras).map(Number).filter(y => y <= ano).sort((a, b) => b - a); if (!ys.length) return { erro: 'Não há regra de IRS para este ano.', erros }; r = regras[ys[0]]; avisos.push(`Sem regra para ${ano}: usa-se a de ${ys[0]}.`); }
  const A = catAIRS(ano), B = catBIRS(ano), especifica = Math.max(r.especifica, A.ss);
  const nasc = pl.irsNascimento ? +String(pl.irsNascimento).slice(0, 4) : null, idade = nasc ? ano - nasc : null, idx = +pl.irsInicioAtividade ? ano - +pl.irsInicioAtividade + 1 : null;
  let pj = 0;
  if (idade != null && idx >= 1 && idx <= r.jovem.length && idade <= r.jovemIdade) {
    if (r.jovemQNQ && !(+pl.irsQualificacao >= r.jovemQNQ)) avisos.push(`IRS Jovem não aplicado: em ${r.ano} exigia qualificação de nível ${r.jovemQNQ} (QNQ).`); else pj = r.jovem[idx - 1] || 0;
  } else if (!nasc || !+pl.irsInicioAtividade) avisos.push('Indique a data de nascimento e o ano de início de atividade para calcular o IRS Jovem.');
  let cap = r.jovemLimite; const isB = r2(Math.min(B.bruto * pj, cap)); cap = Math.max(0, cap - isB); const isA = r2(Math.min(r2(A.bruto) * pj, cap));
  const coefB = +pl.irsCoefB || r.coefB, tribB = r2(r2(B.bruto - isB) * coefB);
  A.bruto = r2(A.bruto); A.irs = r2(A.irs); A.ss = r2(A.ss);
  const global = r2(r2(A.bruto - isA) + tribB), coletavel = r2(Math.max(0, global - especifica)), isentos = r2(isA + isB), paraTaxa = r2(coletavel + isentos);
  const E = escalaoIRS(paraTaxa, r), coleta = paraTaxa > 0 ? r2(Math.max(0, paraTaxa * E.taxa - E.parcela)) : 0, redJ = paraTaxa > 0 ? r2(coleta * isentos / paraTaxa) : 0, coletaJ = r2(coleta - redJ);
  const solid = r2(r.solid.reduce((t, x, i) => { const ate = r.solid[i + 1] ? r.solid[i + 1].de : Infinity; return t + (paraTaxa > x.de ? (Math.min(paraTaxa, ate) - x.de) * x.taxa : 0); }, 0));
  const dp = (despesasIRS().out[ano] || { v: {} }).v, det = []; let ded = 0, iva = 0;
  Object.entries(dp).forEach(([k, val]) => { if (r.ded[k]) { const d = Math.min(val * r.ded[k].taxa, r.ded[k].limite); ded += d; det.push({ k, val, d, regra: `${pct(r.ded[k].taxa)}${isFinite(r.ded[k].limite) ? ', máx. ' + eur(r.ded[k].limite) : ''}` }); }
    else if (r.iva[k] != null) { const d = val * r.iva[k]; iva += d; det.push({ k, val, d, regra: `${pct(r.iva[k])} do IVA`, iva: true }); } else avisos.push(`Despesa ${k} sem regra no ano ${r.ano}: não conta.`); });
  const ivaAplic = Math.min(iva, r.ivaLimite); ded += ivaAplic;
  ded = r2(ded); const aposDed = Math.max(0, coletaJ + solid - ded), mun = pl.irsMunicipio == null || pl.irsMunicipio === '' ? 0.05 : +pl.irsMunicipio, benef = r2(aposDed * Math.max(0, 0.05 - mun));
  const preJovem = A.bruto + B.bruto * coefB - especifica, minimo = r.minimo > 0 && preJovem <= r.minimo, devido = minimo ? 0 : aposDed - benef, retido = A.irs + B.irs;
  return { ano, r, avisos, erros, A, B, pj, idx, idade, isA, isB, coefB, tribB, especifica, global, coletavel, isentos, paraTaxa, E, coleta, redJ, coletaJ, solid, det, ded, iva, ivaAplic, aposDed, mun, benef, minimo, preJovem, devido: r2(devido), retido: r2(retido), acerto: r2(retido - devido) };
}
// CSV exportado do Portal das Finanças (Faturas e Recibos / SIRE): ";" separado, números em formato PT ("1.040", "781,56")
const numSIRE = x => { const t = String(x == null ? '' : x).trim().replace(/\./g, '').replace(',', '.'); const v = parseFloat(t); return isFinite(v) ? v : 0; };
function lerSIRE(texto) {
  const linhas = String(texto).replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim()); if (linhas.length < 2) throw new Error('ficheiro vazio');
  const cab = linhas[0].split(';').map(semAcento), col = re => cab.findIndex(h => re.test(h));
  const c = { ref: col(/^REFERENCIA/), tipo: col(/^TIPO DOCUMENTO/), sit: col(/^SITUACAO/), data: col(/^DATA DA TRANSACAO/), emis: col(/^DATA DE EMISSAO/), nif: col(/^NIF ADQUIRENTE/), nome: col(/^NOME DO ADQUIRENTE/), base: col(/^VALOR TRIBUTAVEL/), iva: col(/^VALOR DO IVA/), irs: col(/^VALOR DO IRS/), atcud: col(/^ATCUD/) };
  if (c.ref < 0 || c.base < 0) throw new Error('não parece um ficheiro de faturas e recibos do Portal das Finanças');
  return linhas.slice(1).map(l => { const f = l.split(';'), g = k => c[k] < 0 ? '' : (f[c[k]] || '').trim(), ref = g('ref');
    return { numero: ref, tipo: (ref.match(/^(FR|RG|FT|NC)\b/i) || [, ''])[1].toUpperCase() || (/RECIBO/i.test(g('tipo')) ? 'FR' : 'FT'), anulado: /ANULAD/i.test(g('sit')), data: g('data') || g('emis'), nif: g('nif'), cliente: g('nome'), atcud: g('atcud'), bruto: r2(numSIRE(g('base'))), iva: r2(numSIRE(g('iva'))), irs: r2(numSIRE(g('irs'))) }; }).filter(x => x.numero && /^\d{4}-\d{2}-\d{2}$/.test(x.data));
}
function importarSIRE() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.csv,text/csv';
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return; let docs;
    try { docs = lerSIRE(await f.text()); } catch (e) { ui.toast('Não consegui ler o ficheiro: ' + e.message, 'bad'); return; }
    const m = M(), chave = n => { const t = String(n || '').replace(/\s+/g, '').toUpperCase(), k = t.match(/(FR|RG|FT|NC)\/\d+$/); return k ? k[0] : t; }, ex = new Map(m.recibosB.map(x => [chave(x.numero), x]));
    let novos = 0, atual = 0, anul = 0;
    docs.forEach(d => { const x = ex.get(chave(d.numero));
      if (d.anulado) { if (x && !x.anulado) { x.anulado = true; x.tipo = d.tipo; anul++; } return; }
      if (x) { let mud = false; ['cliente', 'nif', 'atcud'].forEach(k => { if (d[k] && x[k] !== d[k]) { x[k] = d[k]; mud = true; } }); if (x.numero !== d.numero) { x.numero = d.numero; mud = true; } if (mud) atual++; return; }
      m.recibosB.push({ id: 'B' + uid(), data: d.data, tipo: d.tipo, numero: d.numero, cliente: d.cliente, nif: d.nif, atcud: d.atcud, bruto: d.bruto, iva: d.iva, irs: d.irs, origem: 'portal', criadoEm: new Date().toISOString() }); novos++; });
    if (!novos && !atual && !anul) { ui.toast('Nada de novo: todos os documentos já estavam registados.', 'info'); return; }
    audit('PF_CATB_IMPORT', `Portal das Finanças: ${novos} novos, ${atual} atualizados, ${anul} anulados`); app.save();
    ui.toast(`Importado: ${novos} novos · ${atual} atualizados${anul ? ` · ${anul} anulados ignorados` : ''}`, 'ok'); app.refresh(); };
  inp.click();
}
function rendCatB(v, T) {
  const m = M(), ed = podeEditar(), y0 = +today().slice(0, 4), anos = [...new Set([y0, ...m.recibosB.map(x => +String(x.data).slice(0, 4))])].sort((a, b) => b - a);
  let ano = +tab('pf-anob', y0); if (!(ano >= 2000 && ano <= y0 + 10)) ano = y0;
  const rs = m.recibosB.filter(x => +String(x.data).slice(0, 4) === ano).sort((a, b) => String(b.data).localeCompare(String(a.data))), B = catBIRS(ano), lim = 15000;
  v.innerHTML = `${T.html}${barraFita(fita('pfb', anos, ano, { atual: y0, unidade: 'ano', sm: true }), ed ? botaoMais([['Importar do Portal'], ['Adicionar manualmente']]) : '')}
    <div class="grid g4">${kpi(`${icon('wallet')} Recebido em ${ano} (Cat. B)`, eur(B.bruto), `${B.n} faturas-recibo / recibos`, '', true)}${kpi('IRS retido', eur(B.irs))}${kpi('IVA liquidado', eur(B.iva))}
      ${kpi('Limite de isenção de IVA (art. 53.º)', pct(B.bruto / lim), `${eur(B.bruto)} de ${eur(lim)}`, B.bruto >= lim ? 'neg' : B.bruto >= lim * 0.8 ? 'neg' : '')}</div>
    <div class="card flush" style="margin-top:16px"><div class="card-h"><h3>Recibos verdes ${ano}</h3><span class="sub">FR e RG contam como rendimento; uma FT sozinha é só informativa · clique para editar</span></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Data</th><th>Documento</th><th>Cliente</th><th class="r">Valor</th><th class="r">IVA</th><th class="r">Retenção IRS</th><th class="r">Total</th><th></th></tr></thead><tbody>
    ${rs.map(x => `<tr class="${ed ? 'click' : ''}" data-b="${x.id}" style="${contaCatB(x) ? '' : 'opacity:.6'}"><td>${date(x.data)}</td><td><span class="badge ${contaCatB(x) ? 'ok' : ''}">${esc(x.tipo || '—')}</span> ${esc(x.numero || '')}</td><td>${esc(x.cliente || '—')}${x.nif ? `<div class="faint" style="font-size:11px">NIF ${esc(x.nif)}</div>` : ''}</td><td class="r num">${eur(x.bruto)}</td><td class="r num">${eur(x.iva)}</td><td class="r num">${eur(x.irs)}</td><td class="r num">${eur((+x.bruto || 0) + (+x.iva || 0) - (+x.irs || 0))}</td><td>${contaCatB(x) ? '' : `<span class="faint" style="font-size:11px">${x.anulado ? 'anulado' : 'não conta'}</span>`}</td></tr>`).join('') || '<tr><td colspan="8" class="empty">Sem recibos verdes neste ano.</td></tr>'}</tbody></table></div></div>`;
  bindTabs(v); ligarFita(v, 'pfb', y => { setTab('pf-anob', y); app.refresh(); });
  const editarB = x0 => { const x = x0 || { data: today(), tipo: 'FR', bruto: 0, iva: 0, irs: 0 };
    ui.modal({ title: x0 ? 'Recibo verde' : 'Novo recibo verde', sub: 'Categoria B · fatura-recibo emitida no Portal das Finanças',
      body: `<form class="form"><div class="fld"><label>Data</label><input class="inp" type="date" name="data" value="${esc(x.data)}"></div><div class="fld"><label>Tipo</label><select class="inp" name="tipo">${[['FR', 'FR · Fatura-recibo'], ['RG', 'RG · Recibo (de uma FT)'], ['FT', 'FT · Fatura (ainda não paga)']].map(([k, l]) => `<option value="${k}" ${k === x.tipo ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="fld"><label>N.º do documento</label><input class="inp" name="numero" value="${esc(x.numero || '')}" placeholder="FR ATSIRE01FR/1"></div><div class="fld"><label>Cliente</label><input class="inp" name="cliente" value="${esc(x.cliente || '')}"></div><div class="fld"><label>NIF do cliente</label><input class="inp" name="nif" value="${esc(x.nif || '')}"></div>
        <div class="fld"><label>Valor (sem IVA) (€)</label><input class="inp num" type="number" step="any" name="bruto" value="${esc(x.bruto)}"></div><div class="fld"><label>IVA (€)</label><input class="inp num" type="number" step="any" name="iva" value="${esc(x.iva || 0)}"></div><div class="fld"><label>Retenção de IRS (€)</label><input class="inp num" type="number" step="any" name="irs" value="${esc(x.irs || 0)}"></div></form>`,
      actions: [...(x0 ? [{ label: icon('trash') + 'Remover', kind: 'bad', onClick: async () => { if (!await ui.confirm('Remover', 'Remover este recibo verde?', { danger: true, okLabel: 'Remover' })) return false; m.recibosB = m.recibosB.filter(y => y !== x0); audit('PF_CATB_REMOVIDO', `${x0.numero || ''} ${eur(x0.bruto)}`); app.save(); app.refresh(); } }] : []),
        { label: 'Cancelar', kind: 'ghost' }, { label: 'Guardar', kind: 'primary', onClick: el => { const f = ui.formData(el); if (!f.data || !(+f.bruto > 0)) { ui.toast('Indique a data e o valor', 'warn'); return false; }
          const y = x0 || { id: 'B' + uid(), criadoEm: new Date().toISOString() }; Object.assign(y, { data: f.data, tipo: f.tipo, numero: f.numero.trim(), cliente: f.cliente.trim(), nif: f.nif.trim(), bruto: r2(+f.bruto), iva: r2(+f.iva || 0), irs: r2(+f.irs || 0) });
          if (!x0) m.recibosB.push(y); audit('PF_CATB', `${y.tipo} ${y.numero} · ${y.data} · ${eur(y.bruto)}`); app.save(); app.refresh(); } }] }); };
  v.querySelectorAll('[data-mais]').forEach(b => b.onclick = () => escolherAcao([['Importar do Portal', null, importarSIRE, null, 'upload', 'CSV do Portal das Finanças (Faturas e Recibos › Consultar › Exportar)'], ['Adicionar manualmente', null, () => editarB(), null, 'edit', 'Introduzir uma fatura-recibo']]));
  v.querySelectorAll('[data-b]').forEach(tr => tr.onclick = () => { if (ed) editarB(m.recibosB.find(x => x.id === tr.dataset.b)); });
}
// despesas do e-Fatura de um ano (deduções à coleta)
function editarDeducoes(ano) {
  const pl = M().plano, dv = (despesasIRS().out[ano] || { v: {} }).v || {};
  ui.modal({ title: `Despesas do e-Fatura ${ano}`, sub: 'Valores do Portal das Finanças (e-Fatura › Dedução das despesas). Nas linhas de IVA indique o IVA suportado.', wide: true,
    body: `<form class="form">${Object.entries(NOMES_DED).map(([k, n]) => `<div class="fld"><label>${esc(n)}</label><input class="inp num" type="number" step="0.01" min="0" name="${k}" value="${+dv[k] ? r2(dv[k]) : ''}" placeholder="0,00"></div>`).join('')}</form>`,
    actions: [{ label: 'Cancelar', kind: 'ghost' }, { label: 'Guardar', kind: 'primary', onClick: el => { const f = ui.formData(el), nv = {};
      Object.keys(NOMES_DED).forEach(k => { const x = +f[k]; if (x > 0) nv[k] = r2(x); });
      pl.irsRegras = ''; pl.irsDespesas = gravarDespesasIRS(pl.irsDespesas, ano, nv);
      audit('PF_IRS_DEDUCOES', `Despesas do e-Fatura ${ano}: ${Object.entries(nv).map(([k, x]) => `${k} ${eur(x)}`).join('; ') || 'nenhuma'}`.slice(0, 400)); app.save(); ui.toast('Deduções guardadas', 'ok'); app.refresh(); } }] });
}
// perfil do titular do plano pessoal: dados usados nos cálculos (IRS)
function perfilPessoal() {
  const pl = M().plano, ed = podeEditar(), dis = ed ? '' : 'disabled';
  ui.modal({ title: 'O meu perfil', sub: 'Dados pessoais usados nos cálculos do plano (IRS).', wide: true,
    body: `<form class="form">
      <div class="fld"><label>Data de nascimento</label><input class="inp" type="date" name="irsNascimento" value="${esc(pl.irsNascimento || '')}" ${dis}></div>
      <div class="fld"><label>Ano de início de atividade</label><input class="inp num" type="number" name="irsInicioAtividade" value="${esc(pl.irsInicioAtividade || '')}" ${dis}><span class="hint">1.º ano de rendimentos de trabalho (IRS Jovem).</span></div>
      <div class="fld"><label>Nível de qualificação (QNQ)</label><input class="inp num" type="number" min="1" max="8" name="irsQualificacao" value="${esc(pl.irsQualificacao || '')}" ${dis}></div>
      <div class="fld"><label>Participação do município (%)</label><input class="inp num" type="number" step="any" name="irsMunicipio" value="${r2((pl.irsMunicipio ?? 0.05) * 100)}" ${dis}><span class="hint">Ex.: Faro 4,5% devolve 0,5% da coleta.</span></div>
      <div class="fld full"><label>Coeficiente da Cat. B (%)</label><input class="inp num" type="number" step="any" name="irsCoefB" value="${+pl.irsCoefB ? r2(pl.irsCoefB * 100) : ''}" placeholder="o habitual do ano" ${dis}><span class="hint">Anexo B: campo 403 → 75%; 404 (serviços genéricos) → 35%; vendas → 15%.</span></div></form>`,
    actions: [{ label: ed ? 'Cancelar' : 'Fechar', kind: 'ghost' }, ...(ed ? [{ label: 'Guardar', kind: 'primary', onClick: el => { const f = ui.formData(el);
      Object.assign(pl, { irsNascimento: f.irsNascimento, irsInicioAtividade: parseInt(f.irsInicioAtividade, 10) || 0, irsQualificacao: parseInt(f.irsQualificacao, 10) || 0,
        irsMunicipio: f.irsMunicipio === '' ? 0.05 : (+f.irsMunicipio || 0) / 100, irsCoefB: f.irsCoefB === '' ? 0 : (+f.irsCoefB || 0) / 100 });
      audit('PF_PERFIL', 'Dados pessoais atualizados'); app.save(); ui.toast('Perfil guardado', 'ok'); app.refresh(); } }] : [])] });
}
/* Outros rendimentos (rendas, pensões, trabalhos extra…): uma lista de fontes com o valor por mês.
   O plano usa a soma (plano.outrosRendimentos); um valor antigo sem lista aparece como uma fonte. */
const TIPOS_OUTROS = ['Renda', 'Pensão', 'Trabalho extra', 'Prestação social', 'Pensão de alimentos', 'Outro'];
function outrosLista() {
  const pl = M().plano; if (!Array.isArray(pl.outrosLista)) pl.outrosLista = +pl.outrosRendimentos > 0 ? [{ id: 'O' + uid(), nome: 'Outros rendimentos', tipo: 'Outro', valor: r2(+pl.outrosRendimentos) }] : [];
  return pl.outrosLista;
}
const somaOutros = () => r2(outrosLista().filter(o => o.ativo !== false).reduce((t, o) => t + (+o.valor || 0), 0));
function rendOutros(v, T) {
  const pl = M().plano, ed = podeEditar(), L = outrosLista(), tot = somaOutros();
  v.innerHTML = `${T.html}<div class="grid g3">${kpi(`${icon('plus')} Outros rendimentos / mês`, eur(tot), `${L.filter(o => o.ativo !== false).length} ${L.length === 1 ? 'fonte' : 'fontes'} · somados ao ordenado no plano`, '', true, ed ? 'outros' : '')}${kpi('Por ano', eur(tot * 12))}${kpi('Peso no rendimento', rendimentoMensal() > 0 ? pct(tot / rendimentoMensal()) : '—', 'do rendimento líquido mensal')}</div>
    <div class="card flush" style="margin-top:16px"><div class="card-h"><h3>Fontes de rendimento</h3><span class="sub">valor líquido por mês${ed ? ' · clique para alterar' : ''}</span></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Designação</th><th>Tipo</th><th class="r">Por mês</th><th class="r">Por ano</th></tr></thead><tbody>
    ${L.map(o => `<tr class="${ed ? 'click' : ''}" data-o="${o.id}" style="${o.ativo === false ? 'opacity:.5' : ''}"><td><b>${esc(o.nome)}</b>${o.ativo === false ? ' <span class="faint">inativa</span>' : ''}${o.notas ? `<div class="faint" style="font-size:12px">${esc(o.notas)}</div>` : ''}</td><td>${esc(o.tipo || '')}</td><td class="r num">${eur(o.valor)}</td><td class="r num">${eur((+o.valor || 0) * 12)}</td></tr>`).join('')
      || `<tr><td colspan="4" class="empty">Sem outros rendimentos.${ed ? ' Use o + para acrescentar uma renda, pensão ou trabalho extra.' : ''}</td></tr>`}</tbody></table></div></div>
    <p class="faint" style="font-size:12px;margin-top:10px">Os recibos verdes (categoria B) registam-se em <a href="#/rendimentos" data-tab="pf-rend=catb">Recibos verdes</a>.</p>`;
  bindTabs(v);
  const ed1 = o => { const novo = !o, x = o || { tipo: 'Renda', valor: 0, ativo: true };
    editar({ titulo: 'Outro rendimento', cols: [{ k: 'nome', label: 'Designação', ph: 'ex.: Renda do T1' }, { k: 'tipo', label: 'Tipo', type: 'select', opts: TIPOS_OUTROS.map(t => [t, t]) },
      { k: 'valor', label: 'Valor líquido por mês', type: 'money' }, { k: 'ativo', label: 'Ativa', type: 'check' }, { k: 'notas', label: 'Notas', full: true }], x, novo,
      validar: f => !f.nome ? 'Indique a designação' : !(f.valor > 0) ? 'Indique o valor' : null,
      onSave: f => { Object.assign(x, f, { valor: r2(f.valor) }); if (novo) { x.id = 'O' + uid(); outrosLista().push(x); } M().plano.outrosRendimentos = somaOutros(); audit('PF_OUTRO_RENDIMENTO', `${x.nome} · ${eur(x.valor)}/mês`); },
      onDelete: y => { M().plano.outrosLista = outrosLista().filter(z => z !== y); M().plano.outrosRendimentos = somaOutros(); audit('PF_OUTRO_RENDIMENTO_REMOVIDO', y.nome); } }); };
  v.querySelectorAll('[data-o]').forEach(tr => tr.onclick = () => { if (ed) ed1(L.find(o => o.id === tr.dataset.o)); });
  v.querySelectorAll('[data-add="outros"]').forEach(b => b.onclick = () => ed1());
}
function rendIRS(v, T) {
  const m = M(), pl = m.plano, ed = podeEditar(), y0 = +today().slice(0, 4), { out: regras, erros } = regrasIRS();
  const anos = [...new Set([y0, y0 + 1, ...Object.keys(regras).map(Number), ...m.recibos.map(r => +r.ano)])].sort((a, b) => b - a);
  let ano = +tab('pf-anoirs', y0); if (!(ano >= 2000 && ano <= y0 + 10)) ano = y0;
  const X = calcIRS(ano), linha = (rot, val, nota = '', forte = false) => `<tr><td>${forte ? `<b>${rot}</b>` : rot}${nota ? `<div class="faint" style="font-size:11px">${nota}</div>` : ''}</td><td class="r num">${forte ? `<b>${val}</b>` : val}</td></tr>`;
  const dErr = despesasIRS().erros;
  v.innerHTML = `${T.html}${barraFita(fita('pfi', anos.slice().sort((a, b) => a - b), ano, { atual: y0, unidade: 'ano', sm: true }), '<span class="faint" style="font-size:12px;text-align:right">Liquidação estimada · a declaração entrega-se no ano seguinte</span>', '<span class="muted">Ano fiscal</span>')}
    ${[...erros, ...dErr].length ? `<div class="alert bad" style="margin-bottom:12px">${icon('alert')}<div>Erros na configuração: ${[...erros, ...dErr].map(esc).join(' · ')}</div></div>` : ''}
    ${X.erro ? `<div class="empty">${esc(X.erro)}</div>` : `
    ${X.avisos.length ? `<div class="alert warn" style="margin-bottom:12px">${icon('info')}<div>${X.avisos.map(esc).join('<br>')}</div></div>` : ''}
    <div class="grid g4">${kpi(`${icon('wallet')} ${X.acerto >= 0 ? 'Reembolso estimado' : 'IRS a pagar (estimado)'}`, eur(Math.abs(X.acerto)), `retido ${eur(X.retido)} · devido ${eur(X.devido)}`, X.acerto >= 0 ? 'pos' : 'neg', true)}
      ${kpi('Rendimento bruto', eur(X.A.bruto + X.B.bruto), `Cat. A ${eur(X.A.bruto)} · Cat. B ${eur(X.B.bruto)}`)}${kpi('IRS devido', eur(X.devido), X.minimo ? 'mínimo de existência' : `taxa efetiva ${pct(X.A.bruto + X.B.bruto > 0 ? X.devido / (X.A.bruto + X.B.bruto) : 0)}`)}
      ${kpi('IRS Jovem', X.pj ? pct(X.pj) : '—', X.pj ? `${X.idx}.º ano · isento ${eur(X.isA + X.isB)}` : 'não se aplica')}</div>
    <div class="grid g2" style="margin-top:16px;align-items:start">
      <div class="card flush"><div class="card-h"><h3>Como se chega lá</h3><span class="sub">regras de ${X.r.ano}</span></div><div class="tbl-wrap"><table class="tbl"><tbody>
        ${linha('Cat. A · trabalho dependente (bruto)', eur(X.A.bruto), `${X.A.real} recibos${X.A.proj ? ` + ${X.A.proj} meses projetados${X.A.fonte ? ' (base ' + X.A.fonte + ')' : ''}` : ''} · retido ${eur(X.A.irs)} · SS ${eur(X.A.ss)}`)}
        ${linha('Cat. B · recibos verdes (bruto)', eur(X.B.bruto), `${X.B.n} documentos · retido ${eur(X.B.irs)} · coeficiente ${pct(X.coefB)}`)}
        ${X.pj ? linha('− Isento por IRS Jovem', eur(X.isA + X.isB), `${pct(X.pj)} do bruto (${X.idx}.º ano, ${X.idade} anos)${isFinite(X.r.jovemLimite) ? `, máx. ${eur(X.r.jovemLimite)}` : ''} · Cat. B ${eur(X.isB)} · Cat. A ${eur(X.isA)}`) : ''}
        ${linha('Rendimento global (não isento)', eur(X.global), X.B.bruto ? `Cat. B tributável: ${eur(X.tribB)}` : '')}
        ${linha('− Dedução específica', eur(X.especifica), X.especifica > X.r.especifica ? 'a Segurança Social paga é maior do que a dedução fixa' : `fixa de ${X.r.ano}`)}
        ${linha('Rendimento coletável', eur(X.coletavel), '', true)}
        ${X.isentos ? linha('Rendimento para a taxa', eur(X.paraTaxa), 'coletável + isentos englobados (a taxa calcula-se sobre o total)') : ''}
        ${linha(`Coleta · ${X.E.i + 1}.º escalão`, eur(X.coleta), `${eur(X.paraTaxa)} × ${pct(X.E.taxa)} − ${eur(X.E.parcela)}`)}
        ${X.redJ ? linha('− Imposto sobre os rendimentos isentos', eur(X.redJ)) : ''}
        ${X.solid ? linha('+ Taxa de solidariedade', eur(X.solid)) : ''}
        ${linha('− Deduções à coleta', eur(X.ded), X.det.length ? X.det.map(d => `${esc(NOMES_DED[d.k] || d.k)} ${eur(d.d)}`).join(' · ') + (X.iva > X.ivaAplic ? ` · IVA limitado a ${eur(X.r.ivaLimite)}` : '') : 'sem despesas indicadas')}
        ${X.benef ? linha('− Benefício municipal', eur(X.benef), `o município fica com ${pct(X.mun)} em vez de 5%`) : ''}
        ${X.minimo ? linha('Mínimo de existência', eur(0), `rendimento ${eur(X.preJovem)} ≤ ${eur(X.r.minimo)}: não paga IRS`) : ''}
        ${linha('IRS devido', eur(X.devido), '', true)}${linha('− Retenções na fonte', eur(X.retido))}
        ${linha(X.acerto >= 0 ? 'Reembolso' : 'A pagar', eur(Math.abs(X.acerto)), '', true)}</tbody></table></div></div>
      <div class="card"><div class="card-h"><h3>Escalões de ${X.r.ano}</h3><span class="sub">parcela a abater calculada</span></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Até</th><th class="r">Taxa</th><th class="r">Parcela</th></tr></thead><tbody>
        ${X.r.esc.map((e, i) => `<tr style="${i === X.E.i ? 'background:var(--panel3)' : ''}"><td>${isFinite(e.ate) ? eur(e.ate) : 'acima'}</td><td class="r num">${pct(e.taxa)}</td><td class="r num">${eur(e.parcela)}</td></tr>`).join('')}</tbody></table></div></div></div>`}
    <div class="card flush" style="margin-top:16px"><div class="card-h"><h3>Deduções à coleta ${ano}</h3><span class="sub">despesas do e-Fatura</span>${ed ? `<span style="margin-left:auto">${botaoMais([['Editar despesas do e-Fatura']]).replace('data-mais', 'id="eded"')}</span>` : ''}</div>
      ${(() => { const dv = (despesasIRS().out[ano] || { v: {} }).v || {}, dd = Object.fromEntries(((X && X.det) || []).map(d => [d.k, d.d])), ks = Object.keys(NOMES_DED).filter(k => +dv[k] > 0);
        return ks.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Despesa</th><th class="r">Valor no e-Fatura</th><th class="r">Dedução</th></tr></thead><tbody>${ks.map(k => `<tr><td>${esc(NOMES_DED[k])}</td><td class="r num">${eur(dv[k])}</td><td class="r num">${dd[k] != null ? eur(dd[k]) : '—'}</td></tr>`).join('')}
          <tr><td><b>Total</b></td><td class="r num"><b>${eur(ks.reduce((t, k) => t + +dv[k], 0))}</b></td><td class="r num"><b>${X && !X.erro ? eur(X.ded) : '—'}</b></td></tr></tbody></table></div>`
          : `<div class="empty">Sem despesas do e-Fatura indicadas para ${ano}.${ed ? ' Use o + para as indicar.' : ''}</div>`; })()}</div>
    ${!pl.irsNascimento || !+pl.irsInicioAtividade ? `<div class="alert info" style="margin-top:12px">${icon('info')}<div>A data de nascimento, o início de atividade e os outros dados usados no cálculo indicam-se no <a href="#" data-perfil>seu perfil</a>.</div></div>` : `<div class="faint" style="font-size:12px;margin-top:10px">Dados pessoais usados no cálculo: no <a href="#" data-perfil>seu perfil</a>.</div>`}`;
  v.querySelectorAll('[data-perfil]').forEach(a => a.onclick = e => { e.preventDefault(); perfilPessoal(); });
  const eded = v.querySelector('#eded'); if (eded) eded.onclick = () => editarDeducoes(ano);
  bindTabs(v); ligarFita(v, 'pfi', y => { setTab('pf-anoirs', y); app.refresh(); });
}
// menu de quadrados de uma página: clicar num abre essa área sozinha, com um botão Voltar para o menu
// (Rendimentos, Simulador, Partilhas): q = [[chave, ícone, rótulo]]
function menuQuadrados(chave, nome, q) {
  const t = tab(chave, ''), sel = q.find(x => x[0] === t);
  if (sel) return { t, html: `<div class="row" style="gap:14px;align-items:center;margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid var(--line)">
      <button class="btn sm" data-tab="${chave}=" title="Voltar ao menu de ${nome}">‹ Voltar</button>
      <h2 style="margin:0;font-size:20px;display:flex;align-items:center;gap:10px"><span style="display:inline-flex;width:22px;height:22px;color:var(--accent)">${icon(sel[1]).replace('<svg ', '<svg width="22" height="22" ')}</span>${sel[2]}</h2></div>` };
  return { t: '', html: `<style>.pf-tile{cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;min-height:140px;text-align:center;font-weight:600;font-size:16px;transition:border-color .15s,transform .15s}.pf-tile svg{width:28px;height:28px;color:var(--muted)}.pf-tile:hover{border-color:var(--accent);transform:translateY(-2px)}.pf-tile:hover svg{color:var(--accent)}</style>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(190px,1fr))">${q.map(([k, ic, rot]) => `<div class="card pf-tile" data-tab="${chave}=${k}" role="button" tabindex="0">${icon(ic)}<span>${rot}</span></div>`).join('')}</div>` };
}
const menuRend = () => menuQuadrados('pf-rend', 'Rendimentos', [['rec', 'wallet', 'Recibos de vencimento'], ['catb', 'file', 'Recibos verdes'], ['outros', 'plus', 'Outros rendimentos'], ['proj', 'chart', 'Projeção anual'], ['irs', 'shield', 'IRS']]);
function rendimentos(v) {
  const T = menuRend(), m = M(), kn = app.kn, ed = podeEditar();
  if (!T.t) { v.innerHTML = T.html; bindTabs(v); return; }
  if (T.t === 'catb') return rendCatB(v, T);
  if (T.t === 'irs') return rendIRS(v, T);
  if (T.t === 'outros') return rendOutros(v, T);
  const anoAtual = +today().slice(0, 4), futuros = [1, 2, 3, 4, 5].map(i => anoAtual + i);
  const anos = [...new Set([anoAtual, ...futuros, ...m.recibos.map(r => +r.ano)])].sort((a, b) => b - a);
  let ano = +tab('pf-ano', anoAtual); if (!(ano >= 2000 && ano <= anoAtual + 10)) ano = anoAtual;
  const anoSel = fita('pfa', anos.slice().sort((a, b) => a - b), ano, { atual: anoAtual, unidade: 'ano', sm: true });
  const est = estimarLiquido(m.recibos);
  if (T.t === 'rec') {
    const rs = m.recibos.filter(r => +r.ano === ano).sort((a, b) => b.mes - a.mes), PR = projecao(ano);
    const EMP = avisoEmprego();
    v.innerHTML = `${T.html}${EMP ? `<div class="alert warn" style="margin-bottom:16px">${icon('alert')}<div style="flex:1"><b>Mudança de emprego detetada.</b> Desde ${fmtMes(EMP.desde)} há ${EMP.n} recibos de <b>${esc(EMP.ent)}</b>${EMP.entAnt ? ` (antes: ${esc(EMP.entAnt)})` : ', diferente dos anteriores'}.
        As previsões usam ${eur(salarioBase())} de líquido recorrente; com o novo emprego são <b>${eur(EMP.liquido)}</b>${EMP.bruto ? ` (vencimento sujeito a SS ≈ ${eur(EMP.bruto)})` : ''}.${EMP.parcial ? ` O recibo de ${MESES[EMP.parcial.mes - 1]} ${EMP.parcial.ano} (${eur(EMP.parcial.liquido)}) é de um mês incompleto e deixa de contar para as médias.` : ''}
        ${dica('Atualizar grava o novo líquido recorrente e o vencimento do plano e passa a usar só os recibos do novo emprego para as médias. Os valores recebidos continuam todos registados.')}</div>
        ${ed ? `<button class="btn sm primary" id="emp">${icon('check')} Atualizar previsões</button><button class="btn sm ghost" id="empx">Dispensar</button>` : ''}</div>` : ''}${barraFita(anoSel, ed ? `<span style="display:inline-flex;gap:8px;justify-content:flex-end"><button class="btn sm" id="cford" title="Configurar ordenado: quando é pago e subsídio de refeição de cada entidade" style="${MAIS_CSS};width:34px;height:34px">${icon('settings')}</button>${botaoMais(ATALHOS.rend)}</span>` : '')}
      <div class="grid g4">${kpi(`${icon('wallet')} Líquido recebido ${ano}`, eur(sum(rs, 'liquido')), `${rs.length} ${rs.length === 1 ? 'recibo' : 'recibos'}`, '', true)}${kpi('Bruto ' + ano, eur(sum(rs, 'bruto')))}${kpi('IRS retido', eur(sum(rs, 'irs')), `SS ${eur(sum(rs, 'ss'))}`)}
        ${kpi(kn('pf_liqrec', 'Líquido recorrente'), eur(salarioBase()), +m.plano.salarioBase ? 'do novo emprego' : est.n ? esc(est.metodo) : 'sem recibos')}</div>
      <div class="card" style="margin-top:16px"><div class="card-h"><h3>${kn('pf_proj', 'Rendimento líquido')} ${ano}</h3><span class="sub">real ${eur(PR.ytd)} · projetado ${eur(PR.total)} · <a href="#/rendimentos" data-aba="pf-rend=proj">ver projeção</a></span></div><div id="chr"></div></div>
      <div class="card flush" style="margin-top:16px"><div class="card-h"><h3>Recibos ${ano}</h3><span class="sub">clique numa linha para editar</span></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Mês</th><th>Entidade</th><th class="r">Bruto</th><th class="r">IRS</th><th class="r">SS</th><th class="r">Refeição</th><th class="r">Líquido</th><th>Subsídios</th>${contabAuto() ? '' : '<th>Entrada na tesouraria</th>'}</tr></thead><tbody>
      ${rs.map(r => { const ps = estadoPed(chaveRec(r)); return `<tr class="${ed ? 'click' : ''}" data-r="${r.id}"><td><b>${MESES[r.mes - 1]}</b></td><td>${esc(r.entidade || '—')}</td><td class="r num">${eur(r.bruto)}</td><td class="r num">${eur(r.irs)}</td><td class="r num">${eur(r.ss)}</td><td class="r num">${eur(r.refeicao)}</td><td class="r num"><b>${eur(r.liquido)}</b></td>
        <td>${r.subFerias ? '<span class="badge info">Férias</span> ' : ''}${r.subNatal ? '<span class="badge info">Natal</span>' : ''}${r.parcial ? '<span class="badge plain" data-tip="Mês incompleto: não conta para as médias">mês incompleto</span>' : ''}</td>
        ${contabAuto() ? '' : `<td>${ps || (app.can('criar') ? `<button class="btn sm" data-e="${r.id}">${icon('download')} Registar entrada</button>` : '<span class="faint">—</span>')}</td>`}</tr>`; }).join('') || '<tr><td colspan="${contabAuto() ? 8 : 9}" class="empty">Sem recibos neste ano.</td></tr>'}</tbody></table></div></div>`;
    v.querySelectorAll('[data-r]').forEach(tr => tr.onclick = e => { if (e.target.closest('button,a') || !ed) return; editarRecibo(m.recibos.find(r => r.id === tr.dataset.r)); });
    v.querySelectorAll('[data-e]').forEach(b => b.onclick = () => registarEntrada(m.recibos.find(r => r.id === b.dataset.e)));
    chart.bars(v.querySelector('#chr'), { labels: MES3, stacked: true, height: 190, series: [
      { name: 'Real', values: PR.linhas.map(l => l.real != null ? r2(l.real - l.refeicao) : 0) }, { name: 'Projetado', values: PR.linhas.map(l => l.real == null ? r2(l.proj - l.refeicao) : 0), color: 'var(--accent2)' },
] });
    v.querySelectorAll('[data-mais]').forEach(b => b.onclick = () => escolherAcao(ATALHOS.rend));
    const cford = v.querySelector('#cford'); if (cford) cford.onclick = configOrdenado;
    correrAtalho(v);
    const emp = v.querySelector('#emp'); if (emp) emp.onclick = () => { const e = mudancaEmprego(); if (!e) return; const pl = m.plano;
      pl.salarioBase = e.liquido; if (e.bruto) pl.brutoBase = e.bruto; pl.empregoDesde = e.desde; if (e.parcial) e.parcial.parcial = true;
      audit('PF_PLANO', `Mudança de emprego: ${e.ent} desde ${fmtMes(e.desde)} · líquido recorrente ${eur(e.liquido)}${e.bruto ? ` · vencimento ${eur(e.bruto)}` : ''}${e.parcial ? ` · ${MESES[e.parcial.mes - 1]} ${e.parcial.ano} marcado como mês incompleto` : ''}`);
      app.save(); ui.toast('Previsões atualizadas para o novo emprego', 'ok'); app.refresh(); };
    const empx = v.querySelector('#empx'); if (empx) empx.onclick = () => { const e = mudancaEmprego(); if (!e) return; m.plano.sugDispensadas = [...new Set([...(m.plano.sugDispensadas || []), e.chave])]; app.save(); app.refresh(); };

  } else {
    const P = projecao(ano), refOn = false, G = regraAumento(), BB = brutoBase();
    const proximos = [anoAtual, ...futuros].map(y => ({ y, p: projecao(y), S: salarioAno(y) }));
    const smnCard = `<div class="card flush" style="margin-top:16px"><div class="card-h"><h3>Próximos anos</h3><span class="sub">vencimento base ${eur(BB.valor)} (${esc(BB.origem)}) · ${esc(G.texto)}</span></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Ano</th><th class="r">Salário mínimo</th><th class="r">Vencimento usado</th><th></th><th class="r">Líquido/mês (sem subsídios)</th><th class="r">Projeção anual líquida</th></tr></thead><tbody>
      ${proximos.map(({ y, p, S }) => `<tr class="click" data-ano="${y}"${y === ano ? ' style="background:rgba(127,127,127,.10)"' : ''}><td><b>${y}</b></td><td class="r num">${eur(S.smn)}</td><td class="r num">${eur(y === anoAtual ? S.bruto : S.usado)}</td><td>${y === anoAtual ? '<span class="badge ok">recibos</span>' : S.minimo ? '<span class="badge warn">salário mínimo</span>' : '<span class="badge info">valor efetivo</span>'}</td><td class="r num">${eur(p.media)}</td><td class="r num"><b>${eur(p.total - (refOn ? 0 : p.refeicaoTotal))}</b></td></tr>`).join('')}</tbody></table></div></div>`;
    v.innerHTML = `${T.html}${barraFita(anoSel, '')}
      ${P.futuro ? `<div class="alert info" style="margin-bottom:16px">${icon('chart')}<div>Projeção de ${ano}: ${P.salario.minimo ? `o salário mínimo previsto (<b>${eur(P.salario.smn)}</b>) é superior ao seu vencimento atualizado (${eur(P.salario.efetivo)}), por isso usa-se o mínimo` : `vencimento previsto <b>${eur(P.salario.efetivo)}</b>`} · ${G.pt ? 'regras do sistema para Portugal' : 'trabalho fora de Portugal'}: ${esc(G.texto)}. <b>${P.salario.fator >= 1 ? '+' : ''}${pct(P.salario.fator - 1)}</b> sobre o líquido atual sem refeição.</div></div>` : ''}
      <div class="grid g4">${kpi(`${icon('chart')} ${kn('pf_proj', 'Projeção anual líquida')}`, eur(P.total - P.refeicaoTotal), P.refeicaoTotal ? `sem ${eur(P.refeicaoTotal)} de refeição reservados à alimentação` : 'inclui o subsídio de refeição', '', true)}
        ${P.futuro ? kpi('Vencimento base previsto', eur(P.salario.usado), `${P.salario.minimo ? 'salário mínimo' : 'o seu salário'} · ${P.salario.fator >= 1 ? '+' : ''}${pct(P.salario.fator - 1)} face a hoje`) : kpi('Recebido até agora (YTD)', eur(P.ytd), `${P.n} meses com recibo`)}${kpi('Média mensal (sem subsídios)', eur(P.media), `inclui ${eur(P.mediaRefAll)} de refeição`)}
        ${kpi(P.futuro ? 'Subsídios previstos' : 'Subsídios por receber', eur(P.subF + P.subN), `${P.temF ? 'férias recebido' : 'férias ' + eur(P.subF)} · ${P.temN ? 'Natal recebido' : 'Natal ' + eur(P.subN)}`)}</div>
      <div class="card" style="margin-top:16px"><div class="card-h"><h3>Mês a mês</h3><span class="sub">meses sem recibo usam a média; subsídios estimados em junho e novembro</span></div><div id="ch"></div></div>
      <div class="card flush" style="margin-top:16px"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Mês</th><th class="r">Real</th><th class="r">Projetado</th><th class="r">dos quais refeição</th><th>Notas</th></tr></thead><tbody>
      ${P.linhas.map(l => `<tr><td><b>${MESES[l.m - 1]}</b></td><td class="r num">${l.real == null ? '<span class="faint">—</span>' : eur(l.real)}</td><td class="r num">${eur(l.proj)}</td><td class="r num">${eur(l.refeicao)}</td><td>${l.real == null ? '<span class="badge">estimado</span> ' : '<span class="badge ok">recibo</span> '}${l.sub ? '<span class="badge info">subsídio</span>' : ''}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td>TOTAL</td><td class="r num">${eur(P.ytd)}</td><td class="r num">${eur(P.total)}</td><td class="r num">${eur(P.refeicaoTotal)}</td><td></td></tr></tfoot></table></div></div>${smnCard}`;
    v.querySelectorAll('[data-ano]').forEach(tr => tr.onclick = () => { setTab('pf-ano', tr.dataset.ano); app.refresh(); });
    chart.bars(v.querySelector('#ch'), { labels: MES3, stacked: true, series: [{ name: 'Real', values: P.linhas.map(l => l.real != null ? r2(l.real - l.refeicao) : 0) }, { name: 'Projetado', values: P.linhas.map(l => l.real == null ? r2(l.proj - l.refeicao) : 0), color: 'var(--accent2)' },
      ...(refOn && P.refeicaoTotal ? [{ name: 'Subsídio de refeição', values: P.linhas.map(l => l.refeicao), color: 'var(--info)' }] : [])] });
  }
  bindTabs(v); ligarFita(v, 'pfa', y => { setTab('pf-ano', y); if (+y > anoAtual && T.t === 'rec') setTab('pf-rend', 'proj'); app.refresh(); });
}

/* ---------- Despesas fixas ---------- */
const optsContas = () => tesouraria().map(c => [c.id, c.nome]);
const COLS_DESP = () => [{ k: 'nome', label: 'Designação', ph: 'ex.: Renda, Eletricidade' }, { k: 'categoria', label: 'Categoria', type: 'select', opts: CATS_DESP.map(c => [c, c]) },
  { k: 'valor', label: 'Valor por cobrança', type: 'money' }, { k: 'periodicidade', label: 'Periodicidade', type: 'select', opts: PERIODOS.map(p => [p[0], p[1]]) },
  { k: 'mes', label: 'Mês da 1.ª cobrança', type: 'select', opts: MESES.map((n, i) => [i + 1, n]), hint: 'Só conta nas despesas trimestrais, semestrais e anuais.' },
  { k: 'dia', label: 'Dia de cobrança', type: 'int', min: 1, max: 28 }, { k: 'entidade', label: 'Entidade a pagar', ph: 'ex.: EDP Comercial' },
  { k: 'contaOrigem', label: 'Pagar a partir de', type: 'select', opts: optsContas() },
  { k: 'inicio', label: 'Desde (mês)', type: 'month', hint: 'Opcional.' }, { k: 'fim', label: 'Até (mês)', type: 'month', hint: 'Opcional: despesas temporárias.' },
  { k: 'variavel', label: 'Valor variável (é uma média)', type: 'check' }, { k: 'ativo', label: 'Ativa', type: 'check' }];
function despesas(v) {
  const m = M(), ed = podeEditar(), at = despAtivas(), tot = despesasMensais(), kn = app.kn;
  // começa o controlo de atrasos nas despesas que ainda não o têm (mês atual, ou o do 1.º pedido)
  { let mudou = false; m.despesas.forEach(e => { if (!e.controloDesde) { e.controloDesde = controloDesde(e) || ymHoje(); mudou = true; } }); if (mudou && ed) app.save(); }
  const AT = atrasos(), LP = ligacaoCasa(), RP = LP ? CC().registo(LP.casa) : null;
  const SH = LP ? CC().todasDespesas(LP.casa).filter(e => e.ativo !== false && +((e.partes || {})[LP.eu]) > 0 && e.periodicidade !== 'pontual' && (!e.fim || e.fim >= ymHoje())).sort((a, b) => String(a.nome).localeCompare(String(b.nome))) : [];
  const linhaSH = e => { const vm = CC().valorMes(e, ymHoje()), q = +e.partes[LP.eu], daqui = (RP.despesas || []).some(x => x.id === e.id), alt = altPendente(LP.casa, e.id), nm = id => esc(nomeMembro(LP.casa, id).split(' ')[0]);
    const com = Object.keys(e.partes || {}).filter(id => id !== LP.eu && +e.partes[id] > 0).map(nm).join(', ');
    return `<tr class="${ed && daqui ? 'click' : ''}" ${daqui ? `data-sh="${e.id}"` : ''} style="${e.inicio && e.inicio > ymHoje() ? 'opacity:.5' : ''}"><td><b>${esc(e.nome)}</b> <span class="badge ok">partilhada${com ? ' com ' + com : ''}</span>${alt ? ' <span class="badge warn">alteração por aprovar</span>' : ''}<div class="faint" style="font-size:12px">${esc(e.categoria || '')} · paga ${e.pagaPor === LP.eu ? 'eu' : nm(e.pagaPor)}${e.variavel ? ' · variável' : ''}${e.inicio ? ' · desde ' + fmtMes(e.inicio) : ''}${e.fim ? ' até ' + fmtMes(e.fim) : ''}</div></td>
      <td>${esc(nomePer(e.periodicidade))}</td><td class="r num">${eur(vm.valor)}<div class="faint" style="font-size:11px">total${vm.real === false ? ' · média' : ''}</div></td><td class="r num"><b>${eur(vm.valor * q)}</b><div class="faint" style="font-size:11px">a sua parte · ${pct(q)}</div></td><td>${e.periodicidade === 'compras' ? '—' : 'dia ' + (e.dia || 1)}</td>
      <td><a class="faint" href="#/casa">paga-se nas Partilhas</a></td></tr>`; };
  const cp = (casaParte() || {}).cats || {}, catsT = [...new Set([...CATS_DESP, ...Object.keys(cp)])];
  const porCat = catsT.map(c => ({ label: c, value: r2(at.filter(e => (e.categoria || 'Outros') === c).reduce((s, e) => s + mensalDesp(e), 0) + (+cp[c] || 0)) })).filter(x => x.value > 0);
  v.innerHTML = `${ed ? escondidos(['nd']) : ''}
    ${(() => { const c = casaParte(); return c ? `<div class="alert info" style="margin-bottom:16px">${icon('users')}<div>${c.semDados ? 'Os dados das despesas partilhadas não estão disponíveis: a sua parte não está a ser contada.' : `Inclui <b>${eur(c.valor)}</b> por mês da sua parte nas ${c.n} ${c.n === 1 ? 'despesa partilhada' : 'despesas partilhadas'} (${esc(c.nome)}).`} Ver em <a href="#/casa">Partilhas</a>.</div></div>` : ''; })()}
    ${AT.length ? `<div class="alert bad" style="margin-bottom:16px">${icon('alert')}<div><b>${AT.length === 1 ? '1 cobrança vencida' : AT.length + ' cobranças vencidas'} por pagar</b> (${eur(AT.reduce((t, x) => t + (+x.e.valor || 0), 0))}): ${AT.map(x => `${esc(x.e.nome)} de ${date(x.d)}`).join(' · ')}.
      Continuam por pagar nos meses seguintes até haver pagamento. Use <b>Pagar</b> e indique a data em que foi realmente pago.</div></div>` : ''}
    <div class="grid g3">${kpi(`${icon('list')} ${kn('pf_desp', 'Despesas fixas / mês')}`, eur(tot), (() => { const c = casaParte(); return `${at.length} ${at.length === 1 ? 'própria' : 'próprias'}${c && !c.semDados ? ` + ${eur(c.valor)} parte nas partilhadas` : ''}`; })(), '', true, ed ? 'desp' : '')}${kpi('Por ano', eur(tot * 12))}${kpi('Peso no rendimento', rendimentoMensal() > 0 ? pct(tot / rendimentoMensal()) : '—', 'face ao rendimento líquido mensal')}</div>
    <div class="grid g2" style="margin-top:16px;grid-template-columns:2fr 1fr">
      <div class="card flush"><div class="card-h"><h3>Despesas</h3><span class="sub">cada pagamento fica registado com a sua assinatura</span></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Despesa</th><th>Periodicidade</th><th class="r">Valor</th><th class="r">Mensal</th><th>Próxima</th><th>Pedido</th></tr></thead><tbody>
      ${SH.length ? `<tr><td colspan="6" style="background:var(--panel2);font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--muted)">Partilhadas · total e a sua parte${ed ? ' · alterar requer aprovação dos outros participantes' : ''}</td></tr>${SH.map(linhaSH).join('')}<tr><td colspan="6" style="background:var(--panel2);font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--muted)">Próprias</td></tr>` : ''}
      ${m.despesas.filter(e => !(SH.length && partilhaAceite(e, ymHoje()))).map(e => { const d = proxima(e, e.periodicidade), ps = estadoPed(chaveDesp(e, d)), cv = convDe(e), part = partilhaAceite(e, ymHoje()), on = e.ativo !== false && vigente(e) && !part; return `<tr class="${ed ? 'click' : ''}" data-d="${e.id}" style="${on ? '' : 'opacity:.5'}"><td><b>${esc(e.nome)}</b> ${badgePartilha(cv)}<div class="faint" style="font-size:12px">${esc(e.categoria || '')}${e.entidade ? ' · ' + esc(e.entidade) : ''}${e.variavel ? ' · variável' : ''}${e.inicio || e.fim ? ` · ${e.inicio ? 'desde ' + fmtMes(e.inicio) : ''}${e.inicio && e.fim ? ' ' : ''}${e.fim ? 'até ' + fmtMes(e.fim) : ''}` : ''}</div></td>
        <td>${esc((PERIODOS.find(p => p[0] === e.periodicidade) || [0, e.periodicidade])[1])}</td><td class="r num">${eur(e.valor)}</td><td class="r num">${eur(mensalDesp(e))}</td><td>${date(d)}</td>
        <td style="white-space:nowrap">${emAtraso(e).map(dv => `<div style="margin-bottom:4px"><span class="badge bad">vencida ${date(dv)}</span>${app.can('criar') ? ` <button class="btn sm primary" data-p="${e.id}" data-pd="${dv}">Pagar ${eur(e.valor)}</button>` : ''}</div>`).join('')}${e.ativo === false ? '<span class="faint">inativa</span>' : part ? '<a class="faint" href="#/casa">paga-se nas Partilhas</a>' : !vigente(e) ? `<span class="faint">${e.fim && e.fim < ymHoje() ? 'terminou' : 'ainda não começou'}</span>` : ps || (app.can('criar') ? `<button class="btn sm" data-p="${e.id}">Pagar ${eur(e.valor)}</button>` : '—')}
          ${ed && e.ativo !== false && (!cv || ['recusado', 'cancelado'].includes(cv.estado)) && (!e.fim || e.fim >= ymHoje()) ? ` <button class="btn sm ghost" data-ps="${e.id}" title="Partilhar com outra pessoa">${icon('users')} Partilhar</button>` : ''}</td></tr>`; }).join('') || '<tr><td colspan="6" class="empty">Sem despesas fixas.</td></tr>'}</tbody></table></div></div>
      <div class="card"><div class="card-h"><h3>Por categoria</h3><span class="sub">equivalente mensal</span></div><div id="dn"></div></div></div>`;
  if (porCat.length) chart.donut(v.querySelector('#dn'), { items: porCat, center: eur(tot), sub: 'por mês' }); else v.querySelector('#dn').innerHTML = '<div class="empty">Sem despesas este mês.</div>';
  const ed1 = e => { const novo = !e, x = e || { categoria: 'Outros', periodicidade: 'mensal', mes: +today().slice(5, 7), dia: 1, contaOrigem: CAIXA, ativo: true, valor: 0 };
    editar({ titulo: 'Despesa fixa', cols: COLS_DESP(), x, novo, validar: f => !f.nome ? 'Indique a designação' : !(f.valor > 0) ? 'Indique o valor' : null,
      onSave: f => { f.mes = +f.mes; Object.assign(x, f); if (novo) { x.id = 'D' + uid(); x.controloDesde = f.inicio && f.inicio > ymHoje() ? f.inicio : ymHoje(); m.despesas.push(x); } const c = x.conta && app.conta(x.conta); if (c && f.entidade) c.nome = f.entidade; audit('PF_DESPESA', `${x.nome} · ${eur(x.valor)} ${x.periodicidade}`); },
      onDelete: y => { m.despesas = m.despesas.filter(z => z !== y); audit('PF_DESPESA_REMOVIDA', y.nome); } }); };
  v.querySelectorAll('[data-d]').forEach(tr => tr.onclick = e => { if (e.target.closest('button,a') || !ed) return; ed1(m.despesas.find(x => x.id === tr.dataset.d)); });
  v.querySelectorAll('[data-p]').forEach(b => b.onclick = () => pedirDespesa(m.despesas.find(x => x.id === b.dataset.p), b.dataset.pd));
  v.querySelectorAll('[data-ps]').forEach(b => b.onclick = () => partilharDespesa(m.despesas.find(x => x.id === b.dataset.ps)));
  v.querySelectorAll('[data-sh]').forEach(tr => tr.onclick = e => { if (e.target.closest('button,a') || !ed) return; editarPartilhada(LP, tr.dataset.sh); });
  const nd = v.querySelector('#nd'); if (nd) nd.onclick = () => ed1();
  ligarMais(v, pessoasGrupo().length ? ATALHOS.desp : ATALHOS.desp.slice(0, 1), '[data-add]');
  correrAtalho(v);
}

/* ---------- Dívidas e créditos ---------- */
function pctCartao(d) {
  const ux = d && d.contaCartao ? M().extratos.filter(e => e.conta === d.contaCartao).sort((a, b) => String(b.data).localeCompare(String(a.data)))[0] : null;
  const ext = (ux && +ux.opcaoPct > 0 ? +ux.opcaoPct : null) ?? (+d.opcaoPct > 0 ? +d.opcaoPct : null);
  if (+d.opcaoPctNova > 0 && !(ux && d.opcaoPctDesde && String(ux.data) > String(d.opcaoPctDesde))) return { pct: +d.opcaoPctNova, provisorio: true, extrato: ext };
  return { pct: ext, provisorio: false, extrato: ext };
}
const COLS_DIV = (x = {}) => [{ k: 'nome', label: 'Designação', ph: 'ex.: Crédito habitação' }, { k: 'credor', label: 'Credor', ph: 'ex.: Banco X' },
  { k: 'tipo', label: 'Tipo', type: 'select', opts: TIPOS_DIVIDA }, { k: 'tipoTaxa', label: 'Tipo de taxa', type: 'select', opts: TIPOS_TAXA },
  { k: 'capital', label: 'Capital em dívida', type: 'money' }, { k: 'taxa', label: 'Taxa anual', type: 'pct' },
  { k: 'prestacao', label: 'Prestação mensal', type: 'money' }, { k: 'meses', label: 'Meses em falta', type: 'int', min: 0 },
  { k: 'comissao', label: 'Comissão de amortização antecipada', type: 'pct', hint: 'Deixe vazio para usar a comissão legal (0,5% / 0,25% / 0%).' },
  ...(x.tipo === 'cartao' && !x.cartaoDe ? [{ k: 'opcaoPctNova', label: 'Nova opção de pagamento (% do saldo)', type: 'pct', full: true,
    hint: `O último extrato indica ${(e => e ? pct(e) : '—')(pctCartao(x).extrato)}. Se pediu ao banco outra %, indique-a: conta nos cálculos só até ao extrato seguinte, que passa a mandar. Vazio = segue o extrato.` }] : []),
  { k: 'dia', label: 'Dia da prestação', type: 'int', min: 1, max: 28 }, { k: 'contaOrigem', label: 'Pagar a partir de', type: 'select', opts: optsContas() }, { k: 'ativo', label: 'Ativa', type: 'check' }];
function dividas(v) {
  const m = M(), ed = podeEditar(), ds = divAtivas(), kn = app.kn, tot = sum(ds, 'capital');
  const jurosMes = r2(ds.reduce((s, d) => s + d.capital * taxaMensal(d), 0)), tan = tot > 0 ? ds.reduce((s, d) => s + d.taxa * d.capital, 0) / tot : 0;
  v.innerHTML = `<div class="row between" style="margin-bottom:16px"><span class="muted">Créditos, cartões e empréstimos. O capital em dívida atualiza-se aqui depois de cada prestação ou amortização, ou ao ler o extrato do cartão.</span>${ed ? escondidos(['nv']) : ''}</div>
    <div class="grid g4">${kpi(`${icon('credit')} Capital em dívida`, eur(tot), `${ds.length} dívidas ativas`, '', true, ed ? 'div' : '')}${kpi(kn('pf_prest', 'Prestações / mês'), eur(prestacoesMensais()))}
      ${kpi('Juros deste mês', eur(jurosMes), 'sobre o capital atual')}${kpi(kn('pf_custo', 'Taxa média ponderada'), pct(tan))}</div>
    <div class="card flush" style="margin-top:16px"><div class="card-h"><h3>Dívidas</h3><span class="sub">clique numa linha para editar</span></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Dívida</th><th class="r">Capital</th><th class="r">${kn('pf_tan', 'Taxa')}</th><th class="r">Prestação</th><th class="r">Juro / mês</th><th>Fim só com prestações</th><th>Prestação seguinte</th><th></th></tr></thead><tbody>
    ${ordenarDividas(m.dividas).map(d => { const n = mesesParaLiquidar(d), pr = proxima(d), ps = estadoPed(chaveDiv(d, pr)), on = d.ativo !== false && d.capital > 0.005, cart = d.cartaoDe ? m.dividas.find(y => y.id === d.cartaoDe) : null;
      return `<tr class="${ed ? 'click' : ''}" data-v="${d.id}" style="${on ? '' : 'opacity:.5'}"><td style="${cart ? 'padding-left:28px' : ''}"><b>${esc(d.nome)}</b><div class="faint" style="font-size:12px">${cart ? `plano PagaSimples · ${esc(cart.nome)}${d.prazo ? ` · ${d.prazo} prestações` : ''}` : `${esc(nomeTipo(d.tipo))}${d.credor ? ' · ' + esc(d.credor) : ''}${d.limite ? ` · limite ${eur(d.limite)}` : ''}${d.ultimoExtrato ? ` · extrato n.º ${d.ultimoExtrato.numero} de ${date(d.ultimoExtrato.data)}` : ''}${d.tipo === 'cartao' && !d.cartaoDe ? (pc => pc.pct ? ` · paga ${pct(pc.pct)} do saldo${pc.provisorio ? ` <span class="badge info" data-tip="${esc(`Alterado em ${date(d.opcaoPctDesde)}; o extrato indica ${pc.extrato ? pct(pc.extrato) : '—'}. Confirma-se no extrato seguinte.`)}">por confirmar</span>` : ''}` : '')(pctCartao(d)) : ''}`}</div></td>
      <td class="r num">${eur(d.capital)}</td><td class="r num">${pct(d.taxa)} <span class="faint" style="font-size:11px">${esc((d.tipoTaxa || '').replace('-', ' '))}</span></td><td class="r num">${eur(d.prestacao)}</td><td class="r num">${eur(d.capital * taxaMensal(d))}</td>
      <td>${!on ? (d.canceladoEm ? `<span class="badge warn" data-tip="O banco cancelou o plano em ${date(d.canceladoEm)} e o valor em dívida passou para o saldo do cartão.">cancelado · passou para o cartão</span>` : '<span class="badge ok">liquidada</span>') : incumprimentoRegularizado(d) ? '<span class="badge info" data-tip="Pagou o montante do último extrato; a regularização confirma-se no extrato seguinte.">incumprimento regularizado · por confirmar</span>' : d.incumprimento ? `<span class="badge bad">em incumprimento${d.incumprimento.montante ? ' · ' + eur(d.incumprimento.montante) + ' em atraso' : ''}</span>${d.incumprimento.bloqueado ? ' <span class="badge bad">bloqueado</span>' : ''}` : n === Infinity ? '<span class="badge bad">nunca (juro > prestação)</span>' : `${n} meses`}</td>
      <td>${!on ? '—' : cartaoComExtratos(d) ? (d.cartaoDe ? '<span class="faint" style="font-size:12px">paga-se no cartão</span>' : (() => { const ux = M().extratos.filter(e => e.conta === d.contaCartao).sort((a, b) => String(b.data).localeCompare(String(a.data)))[0]; const sx = ux && estadoExtrato(ux); return ux ? badgeExtrato(sx) + (podeDeclarar(sx) ? ` <button class="btn sm" data-dx="${ux.id}">${icon('check')} Marcar pago</button>` : '') : ''; })()) : ps || (app.can('criar') ? `<button class="btn sm" data-p="${d.id}">Pagar ${eur(d.prestacao)}</button>` : date(pr))}</td>
      <td class="r">${on && app.can('criar') && !(cartaoComExtratos(d) && d.cartaoDe) ? `<button class="btn sm ghost" data-a="${d.id}">Amortizar</button>` : on && d.cartaoDe ? '<span class="faint" style="font-size:11px" data-tip="No Santander, o que se paga a mais vai para o saldo do cartão, não para os planos PagaSimples. Para liquidar um plano antes do fim é preciso pedi-lo ao banco.">só pelo banco</span>' : ''}</td></tr>`; }).join('') || '<tr><td colspan="8" class="empty">Sem dívidas registadas.</td></tr>'}</tbody></table></div></div>
    ${m.extratos.length ? `<div class="card flush" style="margin-top:16px"><div class="card-h"><h3>Extratos de cartão</h3><span class="sub">${m.extratos.length} extratos · o pagamento confirma-se no extrato seguinte · clique para ver os movimentos</span></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Data</th><th>Cartão</th><th>N.º</th><th class="r">Saldo em dívida</th><th class="r">A pagar</th><th>Data limite</th><th>Pagamento</th><th class="r">Movimentos</th></tr></thead><tbody>
      ${m.extratos.slice().sort((a, b) => String(b.data).localeCompare(String(a.data))).slice(0, 36).map(x => { const c = m.dividas.find(y => y.id === x.divida); return `<tr class="click" data-x="${x.id}"><td>${date(x.data)}</td><td>${esc(c ? c.nome : x.conta)}</td><td class="mono">${esc(String(x.numero ?? '—'))}</td><td class="r num">${eur(x.saldo)}</td><td class="r num">${eur(x.pagar)}</td><td>${x.dataLimite ? date(x.dataLimite) : '—'}</td><td>${badgeExtrato(estadoExtrato(x))}</td><td class="r">${(x.movimentos || []).length}</td></tr>`; }).join('')}</tbody></table></div></div>` : ''}`;
  v.querySelectorAll('[data-x]').forEach(tr => tr.onclick = () => verExtrato(m.extratos.find(x => x.id === tr.dataset.x)));
  v.querySelectorAll('[data-dx]').forEach(b => b.onclick = ev => { ev.stopPropagation(); declararPagamento(m.extratos.find(x => x.id === b.dataset.dx)); });
  ligarMais(v, ATALHOS.div, '[data-add]');
  const ed1 = d0 => { const novo = !d0, x = d0 || { tipo: 'consumo', tipoTaxa: 'TAN-fixa', dia: 1, contaOrigem: CAIXA, ativo: true, capital: 0, taxa: 0, prestacao: 0, comissao: null };
    editar({ titulo: 'Dívida / crédito', cols: COLS_DIV(x), x, novo, validar: f => !f.nome ? 'Indique a designação' : f.capital < 0 ? 'Capital inválido' : null,
      onSave: f => { if (f.comissao == null) f.comissao = comissaoLegal(f.tipo, f.tipoTaxa, f.meses);
        if ('opcaoPctNova' in f) { if (!(+f.opcaoPctNova > 0)) { delete f.opcaoPctNova; delete x.opcaoPctNova; delete x.opcaoPctDesde; } else if (+f.opcaoPctNova !== +x.opcaoPctNova) { x.opcaoPctDesde = today(); audit('PF_CARTAO_OPCAO', `${x.nome}: pagamento de ${pct(f.opcaoPctNova)} do saldo (até ao extrato seguinte)`); } }
        Object.assign(x, f); if (novo) { x.id = 'V' + uid(); m.dividas.push(x); }
        const c = x.conta && app.conta(x.conta); if (c && f.credor) c.nome = f.credor; audit('PF_DIVIDA', `${x.nome} · capital ${eur(x.capital)} · ${pct(x.taxa)}`); },
      onDelete: y => { m.dividas = m.dividas.filter(z => z !== y); audit('PF_DIVIDA_REMOVIDA', y.nome); } }); };
  v.querySelectorAll('[data-v]').forEach(tr => tr.onclick = e => { if (e.target.closest('button,a') || !ed) return; ed1(m.dividas.find(x => x.id === tr.dataset.v)); });
  v.querySelectorAll('[data-p]').forEach(b => b.onclick = () => pedirPrestacao(m.dividas.find(x => x.id === b.dataset.p)));
  v.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { const d = m.dividas.find(x => x.id === b.dataset.a);
    if (cartaoComExtratos(d)) { amortizarCartao(d); return; }
    ui.modal({ title: 'Amortização antecipada · ' + esc(d.nome), sub: `Capital em dívida ${eur(d.capital)} · comissão ${pct(d.comissao || 0)}`, body: `<form class="form"><div class="fld full"><label>Capital a amortizar (€)</label><input class="inp num" type="number" step="any" name="v" value="${r2(Math.min(d.capital, Math.max(0, indicadores().exc)))}"></div><div class="fld full" id="am"></div></form>`,
      onOpen: el => { const upd = () => { const c = Math.min(+ui.formData(el).v || 0, d.capital), fee = r2(c * (+d.comissao || 0)), poup = r2(c * taxaMensal(d));
        el.querySelector('#am').innerHTML = `<div class="kv"><div><span>Comissão</span><b class="num">${eur(fee)}</b></div><div><span>Total a pagar</span><b class="num">${eur(c + fee)}</b></div><div><span>Juro poupado já no próximo mês</span><b class="num pos">${eur(poup)}</b></div><div><span>Capital depois</span><b class="num">${eur(d.capital - c)}</b></div></div>`; };
        el.querySelector('[name=v]').addEventListener('input', upd); upd(); },
      actions: [{ label: 'Cancelar', kind: 'ghost' }, { label: 'Continuar', kind: 'primary', onClick: el => { const c = Math.min(+ui.formData(el).v || 0, d.capital); if (!(c > 0)) { ui.toast('Indique o valor', 'warn'); return false; }
        setTimeout(() => pedirAmortizacao(d, c * (1 + (+d.comissao || 0))), 0); } }] }); });
  const nv = v.querySelector('#nv'); if (nv) nv.onclick = () => ed1();
  correrAtalho(v);
}


/* ---------- Cartões de crédito: extratos (PDF) ---------- */
// cartões primeiro, cada um seguido dos seus planos PagaSimples
function ordenarDividas(ds) {
  const planos = ds.filter(d => d.cartaoDe && ds.some(c => c.id === d.cartaoDe));
  return ds.filter(d => !planos.includes(d)).flatMap(d => [d, ...planos.filter(p => p.cartaoDe === d.id)]);
}
const diaDe = iso => iso ? Math.min(28, +String(iso).slice(8, 10) || 5) : null;
// aplica um extrato lido: atualiza (ou cria) o cartão e os planos PagaSimples, e guarda o extrato no histórico
function aplicarExtrato(x, ov = {}) {
  const m = M(), conta = x.conta || ('cartao-' + (x.fimCartao || uid()));
  let c = m.dividas.find(d => d.tipo === 'cartao' && !d.cartaoDe && d.contaCartao === conta);
  const novo = !c;
  if (!c) { c = { id: 'V' + uid(), tipo: 'cartao', tipoTaxa: 'TAN-fixa', comissao: 0, contaOrigem: CAIXA, ativo: true, contaCartao: conta, capital: 0, taxa: 0, prestacao: 0, dia: 5 }; m.dividas.push(c); }
  const recente = !c.ultimoExtrato || String(x.data || '') >= String(c.ultimoExtrato.data || '');
  if (!m.extratos.some(e => e.conta === conta && e.numero === x.numero)) m.extratos.push({ id: 'X' + uid(), divida: c.id, conta, numero: x.numero, data: x.data, periodoIni: x.periodoIni, periodoFim: x.periodoFim,
    limite: x.limite, saldo: x.saldo, rotativo: x.rotativo, pagar: x.pagar, minimo: x.minimo, dataLimite: x.dataLimite, tan: x.tan, opcaoPct: x.opcaoPct, incumprimento: x.incumprimento || null,
    planos: (x.planos || []).map(p => ({ descricao: p.descricao, inicio: p.inicio, montante: p.montante, prazo: p.prazo, tan: p.tan, saldo: p.saldo, proxima: p.proxima, prestacao: p.prestacao })),
    movimentos: (x.movimentos || []).map(mv => ({ data: mv.data, descricao: mv.descricao, valor: mv.valor, tipo: mv.tipo })), ficheiro: ov.ficheiro || x.ficheiro || '', importadoEm: new Date().toISOString() });
  if (recente) {
    const nome = ov.nome || c.nome || `Cartão ${x.produto || ''} ····${x.fimCartao || conta.slice(-4)}`.replace(/\s+/g, ' ');
    Object.assign(c, { nome, credor: x.emissor || c.credor || '', produto: x.produto || c.produto, fimCartao: x.fimCartao || c.fimCartao, limite: x.limite ?? c.limite,
      capital: r2(ov.rotativo ?? x.rotativo ?? x.saldo ?? c.capital), taxa: ov.taxa ?? x.tan ?? c.taxa, prestacao: r2(ov.prestacao ?? x.prestacaoCartao ?? c.prestacao),
      dia: diaDe(x.dataLimite) || c.dia, opcaoPct: x.opcaoPct ?? c.opcaoPct ?? null, ultimoExtrato: { numero: x.numero, data: x.data, pagar: x.pagar, minimo: x.minimo, dataLimite: x.dataLimite }, incumprimento: x.incumprimento || null });
    if (ov.titular !== undefined) c.titular = ov.titular;
    if (c.opcaoPctNova && c.opcaoPctDesde && String(x.data || '') > String(c.opcaoPctDesde)) { delete c.opcaoPctNova; delete c.opcaoPctDesde; }
    const chaves = new Set();
    (x.planos || []).forEach(p => {
      const chave = `${conta}|${p.descricao}|${p.inicio || ''}`; chaves.add(chave);
      let d = m.dividas.find(y => y.chavePlano === chave);
      if (!d) { d = { id: 'V' + uid(), tipo: 'cartao', tipoTaxa: 'TAN-fixa', comissao: 0, contaOrigem: c.contaOrigem || CAIXA, ativo: true, cartaoDe: c.id, chavePlano: chave }; m.dividas.push(d); }
      Object.assign(d, { nome: 'PagaSimples ' + p.descricao, credor: c.credor, capital: r2(p.saldo ?? d.capital ?? 0), taxa: p.tan ?? d.taxa ?? 0, prestacao: r2(p.prestacao ?? d.prestacao ?? 0),
        meses: p.emFalta ?? d.meses ?? null, montante: p.montante, prazo: p.prazo, inicio: p.inicio, dia: c.dia });
    });
    // planos que deixaram de aparecer: cancelados pelo banco (o valor passou para o saldo do cartão) ou liquidados
    const cancelados = (x.planosCancelados || []).length > 0 || (x.movimentos || []).some(mv => /CANC\.?\s*P(AGA)?SIMPLES/i.test(mv.descricao));
    m.dividas.filter(y => y.cartaoDe === c.id && y.chavePlano && !chaves.has(y.chavePlano)).forEach(y => {
      if (cancelados && !y.canceladoEm && ((+y.capital || 0) > 0 || y.liquidadaEm === x.data)) { y.capital = 0; y.canceladoEm = x.data; delete y.liquidadaEm; }
      else if ((+y.capital || 0) > 0) { y.capital = 0; y.liquidadaEm = x.data; } });
  }
  return { cartao: c, novo, recente };
}
/* Pagamento de cada extrato: não se marca à mão. Compara-se com o extrato seguinte do mesmo cartão: os movimentos
   "Pagamento" depois da data do extrato, até à data limite, dizem se foi pago (total ou mínimo), pago em atraso ou está
   em falta; as comissões de atraso / incumprimento cobradas no extrato seguinte aparecem como multa. */
const RX_MULTA = /ATRASO|INCUMPR|\bMORA\b|RECUP|IRREGULAR|DESCOBERTO|EXCESSO/i;
// extratos antigos (importados do Planeador) têm tipos menos rigorosos: reclassifica pela descrição e ignora o quadro de incumprimento
const resumoIncump = m => /^\d+\s+Incumprimento\b/i.test(m.descricao || '');
const tipoDe = m => (SPAP.leitorExtratos && SPAP.leitorExtratos.tipoMov ? SPAP.leitorExtratos.tipoMov(m.descricao || '') : m.tipo) || m.tipo;
const movsDe = x => (x.movimentos || []).filter(m => !resumoIncump(m)).map(m => Object.assign({}, m, { tipo: tipoDe(m) }));
const ehPagamento = m => (+m.valor || 0) < 0 && (tipoDe(m) === 'Pagamento' || /^PAG(AMENTO|\.?\s*TRANS)/i.test(m.descricao || ''));
function estadoExtrato(x) {
  const hoje = today(), seg = M().extratos.filter(e => e.conta === x.conta && String(e.data) > String(x.data)).sort((a, b) => String(a.data).localeCompare(String(b.data)))[0] || null;
  const pagar = +x.pagar || 0, minimo = +x.minimo || 0, lim = x.dataLimite || null;
  const dec = x.declarado || null;
  if (!seg) return { x, seg: null, dec, estado: pagar <= 0.004 ? 'nada' : dec ? 'declarado' : lim && lim >= hoje ? 'aberto' : 'aguarda', pagar, minimo, lim, pago: 0, pagoAte: 0, multa: 0, multas: [] };
  // pagamentos: todos os do extrato seguinte (o período começa no dia do extrato); alguns bancos chamam-lhes "PAG.TRANS.BANCARIA"
  const pags = movsDe(seg).filter(ehPagamento);
  const pago = r2(pags.reduce((t, m) => t + Math.abs(+m.valor || 0), 0)), pagoAte = r2(pags.filter(m => !lim || String(m.data) <= lim).reduce((t, m) => t + Math.abs(+m.valor || 0), 0));
  const multas = movsDe(seg).filter(m => m.tipo !== 'Pagamento' && m.tipo !== 'Plano cancelado' && (+m.valor || 0) > 0 && RX_MULTA.test(m.descricao || '')), multa = r2(multas.reduce((t, m) => t + (+m.valor || 0), 0));
  const ultimo = pags.map(m => m.data).sort().pop() || null;
  const estado = pagar <= 0.004 ? 'nada' : pagoAte >= pagar - 0.01 ? 'pago' : pagoAte >= minimo - 0.01 ? 'minimo' : pago >= minimo - 0.01 ? 'atraso' : 'falta';
  // o pagamento declarado não aparece (ou aparece mais baixo) no extrato seguinte
  const naoConfirmado = dec && pago < (+dec.valor || 0) - 0.01 ? r2((+dec.valor || 0) - pago) : 0;
  return { x, seg, dec, naoConfirmado, estado, pagar, minimo, lim, pago, pagoAte, ultimo, multa, multas, incumprimento: seg.incumprimento || null };
}
const badgeExtrato = s => {
  const mt = s.multa > 0.004 ? ` <span class="badge bad" data-tip="${esc(s.multas.map(m => `${m.descricao}: ${eur(m.valor)}`).join(' · '))}">multa ${eur(s.multa)}</span>` : '';
  const inc = (s.incumprimento ? ' <span class="badge bad">incumprimento</span>' : '') + (s.naoConfirmado ? ` <span class="badge bad" data-tip="${esc(`Marcou ${eur(s.dec.valor)} como pago em ${date(s.dec.data)}, mas o extrato de ${date(s.seg.data)} só mostra ${eur(s.pago)} de pagamentos.`)}">pagamento marcado não confirmado (${eur(s.naoConfirmado)})</span>` : '');
  if (s.estado === 'nada') return '<span class="badge plain">nada a pagar</span>';
  if (s.estado === 'declarado') return `<span class="badge info" data-tip="${esc(`Marcado como pago por ${s.dec.nome || '—'}. Confirma-se (ou não) ao ler o extrato seguinte do cartão.`)}">pago ${eur(s.dec.valor)} ${date(s.dec.data)} · por confirmar</span>`;
  if (s.estado === 'aberto') return `<span class="badge info">a pagar até ${date(s.lim)}</span>`;
  if (s.estado === 'aguarda') return `<span class="badge warn" data-tip="A data limite já passou: o pagamento confirma-se ao ler o extrato seguinte.">aguarda extrato seguinte</span>`;
  if (s.estado === 'pago') return `<span class="badge ok" data-tip="${esc(`Pagamentos até ${date(s.lim)}: ${eur(s.pagoAte)} (extrato de ${date(s.seg.data)})`)}">pago${s.ultimo ? ' ' + date(s.ultimo) : ''}</span>` + (s.pago - s.pagar > 0.5 ? ` <span class="badge acc" data-tip="O valor a mais abateu ao saldo do cartão; o pagamento seguinte foi calculado sobre o saldo mais baixo.">+ ${eur(s.pago - s.pagar)} amortizado</span>` : '') + mt + inc;
  if (s.estado === 'minimo') return `<span class="badge ok" data-tip="${esc(`Pagou ${eur(s.pagoAte)} até ${date(s.lim)}: o resto (${eur(s.pagar - s.pagoAte)}) fica a crédito, com juros.`)}">pago o mínimo (${eur(s.pagoAte)})</span>` + mt + inc;
  if (s.estado === 'atraso') return `<span class="badge warn" data-tip="${esc(`Até ${date(s.lim)} pagou ${eur(s.pagoAte)} (mínimo ${eur(s.minimo)}); completou depois.`)}">pago em atraso${s.ultimo ? ' ' + date(s.ultimo) : ''}</span>` + mt + inc;
  return `<span class="badge bad" data-tip="${esc(`Mínimo ${eur(s.minimo)}, pago ${eur(s.pago)} até ao extrato de ${date(s.seg.data)}.`)}">em falta ${eur(Math.max(0, s.minimo - s.pago))}</span>` + mt + inc;
};
const podeDeclarar = s => s && ['aberto', 'aguarda'].includes(s.estado) && podeEditar();
function declararPagamento(x, depois) {
  const st = estadoExtrato(x);
  ui.modal({ title: 'Marcar como pago', sub: `Extrato de ${date(x.data)} · a pagar ${eur(x.pagar)} (mínimo ${eur(x.minimo)}) até ${date(x.dataLimite)}`,
    body: `<div class="alert info" style="margin-bottom:12px">${icon('info')}<div>Fica <b>pago · por confirmar</b>. Ao ler o extrato seguinte do cartão o sistema confirma o pagamento, a data (atraso) e as multas; se não o encontrar, avisa.</div></div>
      <form class="form"><div class="fld"><label>Valor pago (€)</label><input class="inp num" type="number" step="any" name="valor" value="${r2(+x.pagar || 0)}"></div><div class="fld"><label>Data do pagamento</label><input class="inp" type="date" name="data" value="${today()}"></div></form>`,
    actions: [{ label: 'Cancelar', kind: 'ghost' }, { label: icon('key') + 'Assinar', kind: 'primary', onClick: el => { const f = ui.formData(el); if (!(+f.valor > 0) || !f.data) { ui.toast('Indique o valor e a data', 'warn'); return false; }
      setTimeout(async () => { const s = await app.assinar('Pagamento do cartão', `Extrato de ${date(x.data)} · <b>${eur(f.valor)}</b> pago em ${date(f.data)}<br><span style="font-size:12px">Fica por confirmar até ao extrato seguinte.</span>`); if (!s) return;
        x.declarado = { valor: r2(+f.valor), data: f.data, user: app.user.id, nome: app.user.nome, em: new Date().toISOString(),
          assinatura: await s.signer.texto('CARTAO_PAGO', ['CARTAO-PAGO', x.conta, x.numero ?? '', x.data, r2(+f.valor).toFixed(2), f.data].join('|')) };
        audit('PF_CARTAO_PAGO', `${x.conta} · extrato de ${x.data} · ${eur(f.valor)} em ${f.data} (por confirmar)`); app.save(); ui.toast('Marcado como pago: fica por confirmar no extrato seguinte', 'ok'); if (depois) depois(); else app.refresh(); }, 0); } }] });
}
// extrato de um cartão cuja data limite cai num mês (AAAA-MM): é o que paga a prestação desse mês
const extratoDoMes = (conta, ym) => M().extratos.filter(e => e.conta === conta && String(e.dataLimite || '').slice(0, 7) === ym).sort((a, b) => String(b.data).localeCompare(String(a.data)))[0] || null;
// incumprimento do último extrato já pago (marcado como pago pelo montante pedido): só volta a contar se o extrato seguinte o mostrar
function incumprimentoRegularizado(d) {
  if (!d || !d.incumprimento || !d.contaCartao) return false;
  const ux = M().extratos.filter(e => e.conta === d.contaCartao).sort((a, b) => String(b.data).localeCompare(String(a.data)))[0], sx = ux && estadoExtrato(ux);
  return !!(sx && sx.estado === 'declarado' && +sx.dec.valor >= sx.pagar - 0.01);
}
const cartaoComExtratos = d => d && d.tipo === 'cartao' && (d.cartaoDe || (d.contaCartao && M().extratos.some(e => e.conta === d.contaCartao)));
/* Amortizar um cartão = pagar à conta-cartão mais do que o "montante a pagar" do extrato. Visto nos extratos do Santander:
   o que se paga a mais abate ao saldo do cartão (crédito rotativo), não aos planos PagaSimples, e o pagamento seguinte é
   recalculado sobre o saldo mais baixo (% do saldo + prestações dos planos). O capital não muda aqui: confirma-se no extrato seguinte. */
function amortizarCartao(d) {
  const m = M(), xs = m.extratos.filter(e => e.conta === d.contaCartao).sort((a, b) => String(b.data).localeCompare(String(a.data))), ux = xs[0], st = ux ? estadoExtrato(ux) : null;
  const pctC = pctCartao(d).pct || 0.05, planos = m.dividas.filter(y => y.cartaoDe === d.id && (+y.capital || 0) > 0.005), prestPl = r2(planos.reduce((t, y) => t + (+y.prestacao || 0), 0));
  const rot = +d.capital || 0, devido = st && ['aberto', 'aguarda'].includes(st.estado) ? st.pagar : 0;
  ui.modal({ title: 'Amortizar · ' + esc(d.nome), sub: `Saldo do cartão ${eur(rot)} · pagamento de ${pct(pctC)} do saldo${prestPl ? ` + ${eur(prestPl)} dos planos PagaSimples` : ''}`,
    body: `<div class="alert info" style="margin-bottom:12px">${icon('info')}<div>Para amortizar, pague à conta-cartão mais do que o montante a pagar do extrato. O valor a mais abate ao saldo do cartão (não aos planos PagaSimples) e o pagamento seguinte desce. <b>Não se marca aqui como pago</b>: confirma-se ao ler o extrato seguinte.${ux ? ` Último extrato: ${date(ux.data)}, ${badgeExtrato(st)}.` : ''}</div></div>
      <form class="form">${devido ? `<div class="fld full"><label class="check"><input type="checkbox" name="inclui" checked> Incluir o montante a pagar do extrato de ${date(ux.data)} (${eur(devido)}, até ${date(ux.dataLimite)})</label></div>` : ''}
      <div class="fld full"><label>Valor a mais, para amortizar (€)</label><input class="inp num" type="number" step="any" name="v" value="${r2(Math.min(rot, Math.max(0, indicadores().exc)))}"></div><div class="fld full" id="am"></div></form>`,
    onOpen: el => { const upd = () => { const f = ui.formData(el), c = Math.min(+f.v || 0, rot), novo = r2(rot - c), prox = r2(Math.max(novo * pctC, Math.min(25, novo)) + prestPl), antes = r2(Math.max(rot * pctC, Math.min(25, rot)) + prestPl);
      el.querySelector('#am').innerHTML = `<div class="kv"><div><span>A transferir</span><b class="num">${eur(c + (devido && f.inclui ? devido : 0))}</b></div><div><span>Saldo do cartão depois</span><b class="num">${eur(novo)}</b></div><div><span>Pagamento seguinte (estimado)</span><b class="num">${eur(prox)}</b> <span class="faint" style="font-size:11px">em vez de ${eur(antes)}</span></div><div><span>Juro poupado por mês</span><b class="num pos">${eur(c * taxaMensal(d))}</b></div></div>`; };
      el.querySelectorAll('input').forEach(i => i.addEventListener('input', upd)); upd(); },
    actions: [{ label: 'Cancelar', kind: 'ghost' }, { label: 'Continuar', kind: 'primary', onClick: el => { const f = ui.formData(el), c = Math.min(+f.v || 0, rot), tot = r2(c + (devido && f.inclui ? devido : 0));
      if (!(tot > 0)) { ui.toast('Indique o valor', 'warn'); return false; }
      setTimeout(() => { const destino = garantirConta(d, 'CRÉDITO', 'CR');
        pagar({ categoria: 'LIQUIDAÇÃO DE CRÉDITO', contaOrigem: d.contaOrigem || CAIXA, contaDestino: destino, valor: tot, metodo: 'DÉBITO',
          descricao: `Pagamento ao ${d.nome}${devido && f.inclui ? ` · extrato de ${date(ux.data)} ${eur(devido)}` : ''}${c > 0 ? ` + ${eur(c)} a amortizar` : ''} · confirma-se no extrato seguinte`, dataPrevista: today(), origem: { mod: 'dividas', key: `pf:amort:${d.id}:${uid()}` } }); }, 0); } }] });
}
function escolherExtratos() {
  if (!SPAP.leitorRecibos || !SPAP.leitorExtratos) { ui.toast('O leitor de extratos não está disponível nesta página.', 'bad'); return; }
  const inp = document.createElement('input'); inp.type = 'file'; inp.multiple = true; inp.accept = '.pdf,application/pdf,image/*';
  inp.onchange = () => { if (inp.files.length) lerExtratos([...inp.files]); };
  inp.click();
}
async function lerExtratos(ficheiros) {
  const pm = ui.modal({ title: 'A ler extratos', locked: true, body: `<p class="muted" style="margin:0" id="lr">A preparar…</p>` });
  const msg = t => { const e = pm.el.querySelector('#lr'); if (e) e.textContent = t; };
  const lidos = [];
  for (let i = 0; i < ficheiros.length; i++) {
    const f = ficheiros[i], pre = `${ficheiros.length > 1 ? i + 1 + '/' + ficheiros.length + ' · ' : ''}${f.name}: `;
    try { const { texto, metodo } = await SPAP.leitorRecibos.lerTexto(f, t => msg(pre + t)); const d = SPAP.leitorExtratos.analisar(texto); d.ficheiro = f.name; lidos.push({ nome: f.name, metodo, d }); }
    catch (e) { lidos.push({ nome: f.name, erro: e.message || String(e) }); }
  }
  pm.close();
  if (lidos.every(x => x.erro)) {
    ui.modal({ title: 'Não foi possível ler os extratos', body: `<div class="stack" style="gap:8px">${lidos.map(x => `<div><b>${esc(x.nome)}</b><div class="muted" style="font-size:13px">${esc(x.erro)}</div></div>`).join('')}
      <div class="alert info">${icon('alert')}<div>Pode continuar a registar o cartão à mão em <b>Nova dívida</b> (tipo "Cartão de crédito").</div></div></div>`, actions: [{ label: 'Fechar', kind: 'primary' }] });
    return;
  }
  reverExtratos(lidos);
}
function reverExtratos(lidos) {
  const m = M(), ok = lidos.filter(x => !x.erro).sort((a, b) => String(a.d.data || '').localeCompare(String(b.d.data || '')));
  const num = (n, v, w = 96) => `<input class="inp inp-sm num" type="number" step="any" name="${n}" value="${v == null ? '' : esc(v)}" style="width:${w}px">`;
  // sem saltos: cada extrato precisa do extrato do mês anterior do mesmo cartão (já gravado ou neste lote), exceto o primeiro do cartão
  const mesAnt = ym => { let [a, mm] = ym.split('-').map(Number); mm--; if (!mm) { mm = 12; a--; } return `${a}-${String(mm).padStart(2, '0')}`; };
  const faltaAnterior = (d, lote) => { if (!d.conta || !d.data) return null; const todos = [...m.extratos.filter(e => e.conta === d.conta), ...lote.filter(y => y.conta === d.conta && y !== d)];
    if (!todos.some(e => String(e.data) < String(d.data))) return null; const ant = mesAnt(String(d.data).slice(0, 7));
    return todos.some(e => String(e.data).slice(0, 7) === ant) ? null : ant; };
  const blocos = ok.map((x, i) => {
    const d = x.d, c = m.dividas.find(y => y.tipo === 'cartao' && !y.cartaoDe && y.contaCartao === d.conta), avisos = [];
    const fa = faltaAnterior(d, ok.map(y => y.d)); if (fa) avisos.push(`falta o extrato de ${fmtMes(fa)}: leia-o primeiro (ou junto com este)`);
    const ultimo = ok.filter(y => y.d.conta === d.conta).pop() === x;
    if (m.extratos.some(e => e.conta === d.conta && e.numero === d.numero)) avisos.push('este extrato já foi lido');
    if (d.saldo == null) avisos.push('saldo em dívida não encontrado');
    if (!d.conta) avisos.push('n.º de conta-cartão não encontrado');
    const historico = !ultimo || (c && c.ultimoExtrato && String(d.data || '') < String(c.ultimoExtrato.data || ''));
    const bloqueia = avisos.length > 0;
    return `<div class="card" data-i="${lidos.indexOf(x)}" style="margin-bottom:12px"><div class="row between" style="align-items:flex-start;gap:12px;flex-wrap:wrap">
      <label class="check" style="align-items:flex-start"><input type="checkbox" name="inc" ${bloqueia ? '' : 'checked'} style="margin-top:3px"><span><b>${esc(x.nome)}</b><br><span class="faint" style="font-size:12px">${esc(x.metodo)} · ${esc(d.modelo)}${d.produto ? ' · ' + esc(d.produto) : ''} · conta-cartão ${esc(d.conta || '—')}</span></span></label>
      <span>${c ? `<span class="badge info">atualiza ${esc(c.nome)}</span>` : '<span class="badge acc">cartão novo</span>'} ${historico ? '<span class="badge">só histórico (há extrato mais recente)</span>' : ''}</span></div>
      ${avisos.length ? `<div style="margin-top:6px">${avisos.map(a => `<span class="badge warn" style="margin-right:4px">${esc(a)}</span>`).join('')}</div>` : ''}
      <div class="kv" style="grid-template-columns:repeat(4,minmax(0,1fr));margin-top:10px"><div><span>Extrato</span><b>n.º ${esc(String(d.numero ?? '—'))} · ${d.data ? date(d.data) : '—'}</b></div><div><span>Saldo em dívida</span><b class="num">${eur(d.saldo)}</b></div>
        <div><span>Montante a pagar</span><b class="num">${eur(d.pagar)}</b> <span class="faint" style="font-size:11px">mín. ${eur(d.minimo)}</span></div><div><span>Data limite</span><b>${d.dataLimite ? date(d.dataLimite) : '—'}</b></div></div>
      ${historico ? '' : `<div class="row" style="gap:10px;margin-top:10px;flex-wrap:wrap">
        <div class="fld"><label>Nome do cartão</label><input class="inp inp-sm" name="nome" value="${esc(c ? c.nome : `Cartão ${d.produto || ''} ····${d.fimCartao || String(d.conta || '').slice(-4)}`.replace(/\s+/g, ' '))}" style="width:230px"></div>
        <div class="fld"><label>Saldo do cartão sem planos (€)</label>${num('rotativo', d.rotativo, 120)}</div>
        <div class="fld"><label>TAN (%)</label>${num('taxa', d.tan == null ? null : r2(d.tan * 10000) / 100, 80)}</div>
        <div class="fld"><label>Prestação do cartão (€)</label>${num('prestacao', d.prestacaoCartao, 110)}</div></div>`}
      ${d.planos.length ? `<div class="tbl-wrap" style="margin-top:10px"><table class="tbl"><thead><tr><th>Plano PagaSimples</th><th>Início</th><th class="r">Montante</th><th class="r">Em dívida</th><th class="r">TAN</th><th class="r">Prestação</th><th class="r">Em falta</th></tr></thead><tbody>
        ${d.planos.map(p => `<tr><td>${esc(p.descricao)}</td><td>${p.inicio ? date(p.inicio) : '—'}</td><td class="r num">${eur(p.montante)}</td><td class="r num">${eur(p.saldo)}</td><td class="r num">${p.tan == null ? '—' : pct(p.tan)}</td><td class="r num">${eur(p.prestacao)}</td><td class="r">${p.emFalta ?? '—'}</td></tr>`).join('')}</tbody></table></div>` : ''}
      <div class="faint" style="font-size:12px;margin-top:8px">${d.movimentos.length} movimentos${d.notas.length ? ' · ' + esc(d.notas.join(' · ')) : ''}</div></div>`;
  }).join('');
  const erros = lidos.filter(x => x.erro).map(x => `<div class="alert bad" style="margin-bottom:8px">${icon('alert')}<div><b>${esc(x.nome)}</b>: ${esc(x.erro)}</div></div>`).join('');
  ui.modal({ title: 'Rever extratos lidos', wide: true, sub: 'Cada cartão fica como dívida própria e cada plano PagaSimples como dívida associada ao cartão. Confirme os valores antes de gravar.', body: erros + blocos,
    onOpen: el => { const md = el.querySelector('.modal'); if (md) md.style.width = 'min(1200px, 96vw)'; },
    actions: [{ label: 'Cancelar', kind: 'ghost' }, { label: icon('check') + 'Gravar extratos', kind: 'primary', onClick: el => {
      const sel = [...el.querySelectorAll('.card[data-i]')].filter(b => b.querySelector('[name=inc]').checked);
      if (!sel.length) { ui.toast('Nenhum extrato marcado para gravar', 'warn'); return false; }
      const lote = sel.map(b => lidos[+b.dataset.i].d), sem = lote.map(d => [d, faltaAnterior(d, lote)]).filter(([, fa]) => fa);
      if (sem.length) { ui.toast(`Falta o extrato de ${fmtMes(sem[0][1])} do cartão ····${String(sem[0][0].conta).slice(-4)}: não é possível gravar o extrato seguinte sem ele.`, 'bad'); return false; }
      sel.sort((a, b) => String(lidos[+a.dataset.i].d.data || '').localeCompare(String(lidos[+b.dataset.i].d.data || '')));
      let n = 0;
      sel.forEach(b => { const x = lidos[+b.dataset.i], g = k => { const e = b.querySelector(`[name=${k}]`); return e && e.value.trim() !== '' ? e.value.trim() : null; };
        const ov = { ficheiro: x.nome }; if (g('nome')) ov.nome = g('nome'); if (g('rotativo') != null) ov.rotativo = +g('rotativo'); if (g('taxa') != null) ov.taxa = +g('taxa') / 100; if (g('prestacao') != null) ov.prestacao = +g('prestacao');
        const r = aplicarExtrato(x.d, ov); n++; audit('PF_EXTRATO', `${r.cartao.nome} · extrato n.º ${x.d.numero ?? '—'} de ${x.d.data || '—'} · saldo ${eur(x.d.saldo)}${r.recente ? '' : ' (histórico)'}`); });
      app.save(); ui.toast(`${n} ${n === 1 ? 'extrato gravado' : 'extratos gravados'}`, 'ok'); app.refresh(); } }] });
}
// divisões de compras do cartão com outros membros da casa (dívidas no registo comum com referência à compra)
const refCompra = (x, mv) => ({ conta: x.conta, extrato: x.numero, data: mv.data, descricao: mv.descricao, valor: mv.valor });
const mesmaCompra = (a, b) => a && b && a.conta === b.conta && a.data === b.data && a.descricao === b.descricao && Math.abs((+a.valor || 0) - (+b.valor || 0)) < 0.005;
const divisoesDe = (x, mv) => { const L = ligacaoCasa(); if (!L) return []; const ref = refCompra(x, mv), R = CC().registo(L.casa);
  return [...R.dividas.filter(d => mesmaCompra(d.ref, ref) && !d.anulada), ...(R.despesas || []).filter(d => mesmaCompra(d.ref, ref) && !d.anulada).map(d => Object.assign({ casa: true }, d))]; };
function dividirCompra(x, mv, c) {
  const L = ligacaoCasa(), ex = L && CC().extrato(L.casa); if (!ex) return;
  const outros = ex.membros.filter(m => m.id !== L.eu), nomeCartao = c ? c.nome : x.conta, igual = r2(100 / ex.membros.length);
  ui.modal({ title: 'Partilhar a compra', sub: `${esc(mv.descricao)} · ${date(mv.data)} · <b>${eur(mv.valor)}</b> · ${esc(nomeCartao)}`,
    body: `<form class="form"><div class="fld full"><label>Como dividir</label><select class="inp" name="tipo"><option value="casa">Despesa partilhada: divide-se pelas partes de cada um</option><option value="membro">Parte de um membro: um membro paga-me uma parte</option></select></div>
      <div class="fld full" data-t="casa"><div class="row" style="gap:12px;flex-wrap:wrap">${ex.membros.map(mb => `<label style="display:flex;gap:6px;align-items:center">${esc(mb.nome.split(' ')[0])} <input class="inp inp-sm num" type="number" step="any" data-parte="${mb.id}" value="${igual}" style="width:80px"> %</label>`).join('')}</div></div>
      <div class="fld" data-t="casa"><label>Como é paga</label><select class="inp" name="pag"><option value="cartao" ${(c && +c.taxa > 0 && (x.opcaoPct == null || x.opcaoPct < 1)) ? 'selected' : ''}>A prestações pelo cartão (com juros)</option><option value="unica" ${(c && +c.taxa > 0 && (x.opcaoPct == null || x.opcaoPct < 1)) ? '' : 'selected'}>De uma vez</option></select></div>
      <div class="fld" data-t="casa"><label>Comissões e impostos da operação (€)</label><input class="inp num" type="number" step="any" name="enc" value="0"><span class="hint">Ex.: comissão de transferência e imposto do selo cobrados com a operação.</span></div>
      <div class="fld" data-t="casa" data-pg="cartao"><label>TAN (%)</label><input class="inp num" type="number" step="any" name="tan" value="${c ? r2((+c.taxa || 0) * 10000) / 100 : ''}"></div>
      <div class="fld" data-t="casa" data-pg="cartao"><label>Pagamento mensal (% do saldo)</label><input class="inp num" type="number" step="any" name="ppct" value="${x.opcaoPct != null && x.opcaoPct < 1 ? r2(x.opcaoPct * 100) : 5}"></div>
      <div class="fld" data-t="casa" data-pg="cartao"><label>Prestação mínima (€)</label><input class="inp num" type="number" step="any" name="pmin" value="25"></div>
      <div class="fld" data-t="casa" data-pg="cartao"><label>1.ª prestação (mês)</label><input class="inp" type="month" name="pini" value="${(x.dataLimite || SPAP.addMonths(mv.data, 1)).slice(0, 7)}"></div>
      <div class="fld" data-t="membro"><label>Com quem</label><select class="inp" name="outro">${outros.map(o => `<option value="${o.id}">${esc(o.nome)}</option>`).join('')}</select></div>
      <div class="fld" data-t="membro"><label>Como</label><select class="inp" name="modo"><option value="pct">Percentagem</option><option value="valor">Valor</option></select></div>
      <div class="fld" data-t="membro"><label id="lq">Parte do outro (%)</label><input class="inp num" type="number" step="any" name="q" value="50"></div>
      <div class="fld full" id="res"></div>
      <div class="fld full"><label>Descrição</label><input class="inp" name="descricao"></div></form>`,
    onOpen: el => {
      const partes = () => Object.fromEntries([...el.querySelectorAll('[data-parte]')].map(i => [i.dataset.parte, (+i.value || 0) / 100]));
      const upd = () => { const f = ui.formData(el), casa = f.tipo === 'casa';
        el.querySelectorAll('[data-t]').forEach(z => z.style.display = z.dataset.t === f.tipo && (!z.dataset.pg || z.dataset.pg === f.pag) ? '' : 'none');
        el.querySelector('#lq').textContent = f.modo === 'pct' ? 'Parte do outro (%)' : 'Parte do outro (€)';
        const d = el.querySelector('[name=descricao]');
        if (casa) { const tot = r2(mv.valor + (+f.enc || 0)), q = partes();
          if (f.pag === 'cartao') { const pl = CC().planoCartao({ capital: tot, inicio: f.pini, tan: (+f.tan || 0) / 100, pct: (+f.ppct || 5) / 100, minimo: +f.pmin || 0 }), tj = pl.reduce((t, l) => t + l.juros + l.impostos, 0);
            el.querySelector('#res').innerHTML = `<div class="alert info">${icon('credit')}<div><b>${eur(tot)}</b> pagos a prestações pelo cartão: 1.ª prestação <b>${pl[0] ? eur(pl[0].prestacao) : '—'}</b> em ${fmtMes(f.pini)}, ${pl.length} meses, ${eur(tj)} de juros e impostos no total. Cada prestação é dividida: ${ex.membros.map(mb => `${esc(mb.nome.split(' ')[0])} ${pct(q[mb.id] || 0)}`).join(' · ')}.</div></div>`; }
          else el.querySelector('#res').innerHTML = `<div class="alert info">${icon('home')}<div>Despesa partilhada de <b>${eur(tot)}</b>, paga por si em ${fmtMes(mv.data.slice(0, 7))}: ${ex.membros.map(mb => `${esc(mb.nome.split(' ')[0])} ${eur(tot * (q[mb.id] || 0))}`).join(' · ')}. A parte dos outros entra no acerto desse mês.</div></div>`;
          if (!d.dataset.mexido) d.value = `${mv.descricao} (${nomeCartao}, ${date(mv.data)})`; }
        else { const o = outros.find(z => z.id === f.outro) || outros[0], val = f.modo === 'pct' ? r2(mv.valor * (+f.q || 0) / 100) : r2(+f.q || 0);
          el.querySelector('#res').innerHTML = `<div class="alert info">${icon('users')}<div>${esc(o.nome.split(' ')[0])} fica a dever-lhe <b>${eur(val)}</b>.</div></div>`;
          if (!d.dataset.mexido) d.value = `Parte de ${o.nome.split(' ')[0]} · ${mv.descricao} (${nomeCartao}, ${date(mv.data)})`; } };
      el.querySelector('[name=descricao]').addEventListener('input', e => { e.target.dataset.mexido = '1'; });
      el.querySelector('[name=tipo]').addEventListener('change', () => { delete el.querySelector('[name=descricao]').dataset.mexido; upd(); });
      el.querySelectorAll('input,select').forEach(i => { i.addEventListener('input', upd); i.addEventListener('change', upd); }); upd(); },
    actions: [{ label: 'Cancelar', kind: 'ghost' }, { label: 'Dividir', kind: 'primary', onClick: el => { const f = ui.formData(el);
      if (f.tipo === 'casa') {
        const partes = Object.fromEntries([...el.querySelectorAll('[data-parte]')].map(i => [i.dataset.parte, r2((+i.value || 0) / 100 * 10000) / 10000]));
        const soma = Object.values(partes).reduce((t, q) => t + q, 0); if (Math.abs(soma - 1) > 0.0001) { ui.toast(`As partes somam ${pct(soma)}: devem somar 100%`, 'warn'); return false; }
        const tot = r2(mv.valor + (+f.enc || 0)), ym = mv.data.slice(0, 7), notas = +f.enc ? `${eur(mv.valor)} + ${eur(+f.enc)} de comissões e impostos da operação` : '';
        if (f.pag === 'cartao') { if (!f.pini || !(+f.ppct > 0)) { ui.toast('Indique a 1.ª prestação e a % de pagamento', 'warn'); return false; }
          const d = { capital: tot, inicio: f.pini, tan: (+f.tan || 0) / 100, pct: (+f.ppct) / 100, minimo: +f.pmin || 0 }, pl = CC().planoCartao(d);
          CC().alterar(L.casa, r => r.despesas.push(Object.assign({ id: 'Ce' + uid(), nome: f.descricao, categoria: 'Outros', valor: tot, periodicidade: 'cartao', fim: pl.length ? pl[pl.length - 1].ym : f.pini, pagaPor: L.eu, partes, ativo: true,
            notas, cartao: c ? c.id : null, ref: refCompra(x, mv), criadoPor: app.user.nome, sistema: sub.key }, d))); }
        else CC().alterar(L.casa, r => r.despesas.push({ id: 'Ce' + uid(), nome: f.descricao, categoria: 'Outros', valor: tot, periodicidade: 'pontual', inicio: ym, fim: ym, pagaPor: L.eu, partes, ativo: true,
          notas, ref: refCompra(x, mv), criadoPor: app.user.nome, sistema: sub.key }));
        audit('CASA_DESPESA_CARTAO', `${mv.descricao} (${nomeCartao}, ${mv.data}) passou a despesa partilhada · ${eur(tot)}`); app.save(); ui.toast('Passou a despesa partilhada', 'ok');
      } else {
        const val = f.modo === 'pct' ? r2(mv.valor * (+f.q || 0) / 100) : r2(+f.q || 0);
        if (!(val > 0) || val > mv.valor + 0.005) { ui.toast('A parte do outro tem de estar entre 0 e o valor da compra', 'warn'); return false; }
        CC().alterar(L.casa, r => r.dividas.push({ id: 'Dv' + uid(), de: f.outro, para: L.eu, valor: val, data: mv.data, descricao: f.descricao, ref: refCompra(x, mv), criadoPor: app.user.nome, sistema: sub.key }));
        audit('CASA_DIVISAO_COMPRA', `${ex.nomeM(f.outro)} deve ${eur(val)} · ${mv.descricao} (${nomeCartao}, ${mv.data})`); app.save();
        ui.toast(`Compra dividida: ${esc(ex.nomeM(f.outro).split(' ')[0])} deve-lhe ${eur(val)}`, 'ok');
      }
      setTimeout(() => verExtrato(x), 50); } }] });
}
async function anularDivisao(x, id) {
  const L = ligacaoCasa(); if (!L) return; const R = CC().registo(L.casa), d = R.dividas.find(z => z.id === id) || (R.despesas || []).find(z => z.id === id); if (!d) return;
  if (!await ui.confirm('Anular divisão', `Retirar a dívida "${esc(d.descricao)}" (${eur(d.valor)}) das partilhas?`, { okLabel: 'Anular', danger: true })) return;
  CC().alterar(L.casa, r => { const z = r.dividas.find(y => y.id === id) || (r.despesas || []).find(y => y.id === id); if (z) Object.assign(z, { anulada: true, anuladaEm: today(), anuladaPor: app.user.nome }); });
  audit('CASA_DIVISAO_ANULADA', `${d.descricao} · ${eur(d.valor)}`); app.save(); setTimeout(() => verExtrato(x), 50);
}
function verExtrato(x) {
  if (!x) return; const c = M().dividas.find(y => y.id === x.divida), casa = ligacaoCasa(), ex = casa && CC().extrato(casa.casa);
  ui.modal({ title: `Extrato n.º ${esc(String(x.numero ?? '—'))} · ${esc(c ? c.nome : x.conta)}`, wide: true, sub: `${x.periodoIni ? date(x.periodoIni) + ' a ' + date(x.periodoFim) : date(x.data)}${x.ficheiro ? ' · ' + esc(x.ficheiro) : ''}`,
    body: `<div class="kv" style="grid-template-columns:repeat(4,minmax(0,1fr))"><div><span>Saldo em dívida</span><b class="num">${eur(x.saldo)}</b></div><div><span>Montante a pagar</span><b class="num">${eur(x.pagar)}</b></div><div><span>Mínimo</span><b class="num">${eur(x.minimo)}</b></div><div><span>Data limite</span><b>${x.dataLimite ? date(x.dataLimite) : '—'}</b></div></div>
      <div style="margin-top:10px">Pagamento: ${badgeExtrato(estadoExtrato(x))}${podeDeclarar(estadoExtrato(x)) ? ` <button class="btn sm" id="dxm">${icon('check')} Marcar pago</button>` : ''}</div>
      <div class="tbl-wrap" style="margin-top:14px"><table class="tbl"><thead><tr><th>Data</th><th>Movimento</th><th>Tipo</th><th class="r">Montante</th>${ex ? '<th>Partilha</th>' : ''}</tr></thead><tbody>
      ${(x.movimentos || []).map((mv, i) => { if (resumoIncump(mv)) return ''; mv = Object.assign({}, mv, { tipo: tipoDe(mv) }); const dv = ex ? divisoesDe(x, mv) : [];
        return `<tr><td>${date(mv.data)}</td><td>${esc(mv.descricao)}</td><td><span class="badge ${mv.tipo === 'Pagamento' ? 'ok' : mv.tipo === 'Compra' ? '' : 'warn'}">${esc(mv.tipo)}</span></td><td class="r num ${mv.valor < 0 ? 'pos' : ''}">${eur(mv.valor)}</td>
        ${ex ? `<td style="white-space:nowrap">${dv.map(d => `<span class="badge acc">${d.casa ? (d.periodicidade === 'cartao' ? `despesa partilhada a prestações · ${Object.entries(d.partes || {}).filter(([id]) => id !== casa.eu).map(([id, q]) => `${esc(ex.nomeM(id).split(' ')[0])} ${pct(q)}`).join(', ')}` : `despesa partilhada · ${Object.entries(d.partes || {}).filter(([id]) => id !== casa.eu).map(([id, q]) => `${esc(ex.nomeM(id).split(' ')[0])} ${eur(d.valor * q)}`).join(', ')}`) : `dividida · ${esc(ex.nomeM(d.de).split(' ')[0])} ${eur(d.valor)}`}</span>${d.sistema === sub.key ? ` <button type="button" class="btn sm ghost" data-an="${d.id}" title="Anular divisão">${icon('x')}</button>` : ''}`).join(' ')}
          ${!dv.length && ['Compra', 'Transferência', 'Adiantamento'].includes(mv.tipo) && mv.valor > 0 && podeEditar() ? `<button type="button" class="btn sm" data-dv="${i}">${icon('users')} Partilhar</button>` : ''}${dv.length ? `<div class="faint" style="font-size:11px">${dv.some(d => d.periodicidade === 'cartao') ? 'prestações divididas na casa' : `a sua parte ${eur(dv.some(d => d.casa) ? dv.filter(d => d.casa).reduce((t, d) => t + d.valor * ((d.partes || {})[casa.eu] || 0), 0) : mv.valor - dv.reduce((t, d) => t + d.valor, 0))}`}</div>` : ''}</td>` : ''}</tr>`; }).join('') || `<tr><td colspan="${ex ? 5 : 4}" class="empty">Sem movimentos.</td></tr>`}</tbody></table></div>
      ${(x.planos || []).length ? `<div class="tbl-wrap" style="margin-top:14px"><table class="tbl"><thead><tr><th>Plano PagaSimples</th><th class="r">Em dívida</th><th class="r">Prestação</th><th class="r">Prestação n.º</th></tr></thead><tbody>${x.planos.map(p => `<tr><td>${esc(p.descricao)}</td><td class="r num">${eur(p.saldo)}</td><td class="r num">${eur(p.prestacao)}</td><td class="r">${p.proxima ? `${p.proxima}/${p.prazo}` : '—'}</td></tr>`).join('')}</tbody></table></div>` : ''}`,
    onOpen: (el, close) => {
      el.querySelectorAll('[data-dv]').forEach(b => b.onclick = () => { close(); dividirCompra(x, x.movimentos[+b.dataset.dv], c); });
      el.querySelectorAll('[data-an]').forEach(b => b.onclick = () => { close(); anularDivisao(x, b.dataset.an); });
      const dm = el.querySelector('#dxm'); if (dm) dm.onclick = () => { close(); declararPagamento(x); }; },
    actions: [{ label: 'Fechar', kind: 'primary' }] });
}

/* ---------- Importação do Planeador Financeiro (ficheiro gerado a partir do sistema antigo) ---------- */
function importarPlaneador() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return; let j;
    try { j = JSON.parse(await f.text()); } catch (e) { ui.toast('O ficheiro não é um ficheiro de importação válido.', 'bad'); return; }
    if (!j || j.formato !== 'planeador-bxb') { ui.toast('Este ficheiro não foi gerado a partir do Planeador Financeiro.', 'bad'); return; }
    if (j.perfil !== 'pessoal') { ui.toast('Este ficheiro é de uma casa partilhada: importe-o num sistema do tipo "Casa partilhada".', 'warn'); return; }
    const m = M(), tem = (l, o) => l.some(x => x.origem === o);
    const novos = { rec: (j.recibos || []).filter(r => !tem(m.recibos, r.origem)), desp: (j.despesas || []).filter(r => !tem(m.despesas, r.origem)),
      cred: (j.creditos || []).filter(r => !tem(m.dividas, r.origem)), ext: (j.extratos || []).filter(x => !m.extratos.some(e => e.conta === x.conta && e.numero === x.numero)) };
    const cartoes = new Set(novos.ext.map(x => x.conta)).size;
    ui.modal({ title: 'Importar do Planeador Financeiro', sub: `${esc(f.name)} · ${esc((j.pessoa || {}).nome || '')}`, body: `<div class="kv" style="grid-template-columns:repeat(2,minmax(0,1fr))">
        <div><span>Recibos de vencimento</span><b>${novos.rec.length} de ${(j.recibos || []).length}</b></div><div><span>Despesas fixas</span><b>${novos.desp.length} de ${(j.despesas || []).length}</b></div>
        <div><span>Créditos</span><b>${novos.cred.length} de ${(j.creditos || []).length}</b></div><div><span>Extratos de cartão</span><b>${novos.ext.length} de ${(j.extratos || []).length}${cartoes ? ` · ${cartoes} cartões` : ''}</b></div></div>
      <p class="muted" style="font-size:13px;margin:14px 0 0">O que já tinha sido importado antes não é repetido. Os cartões ficam com os valores do extrato mais recente e os planos PagaSimples como dívidas próprias.${(j.despesasCasa || []).length ? ` As ${(j.despesasCasa || []).length} despesas partilhadas ficam no sistema da casa (ficheiro próprio).` : ''}</p>`,
      actions: [{ label: 'Cancelar', kind: 'ghost' }, { label: icon('download') + 'Importar', kind: 'primary', onClick: () => {
        novos.rec.forEach(r => m.recibos.push(Object.assign({ id: 'R' + uid(), criadoEm: new Date().toISOString() }, r)));
        novos.desp.forEach(r => m.despesas.push(Object.assign({ id: 'D' + uid(), contaOrigem: CAIXA, ativo: true }, r)));
        novos.cred.forEach(r => m.dividas.push(Object.assign({ id: 'V' + uid(), contaOrigem: CAIXA, ativo: true }, r)));
        novos.ext.slice().sort((a, b) => String(a.data).localeCompare(String(b.data))).forEach(x => aplicarExtrato(x, { ficheiro: x.ficheiro }));
        if (j.plano) ['salarioBase', 'emergMeses', 'emergProgressivo', 'poupancaTipo', 'poupancaFixa', 'poupancaPct'].forEach(k => { if (j.plano[k] != null) m.plano[k] = j.plano[k]; });
        // liga o plano à casa partilhada indicada no ficheiro, se já existir no grupo
        if (j.casa && !m.plano.casa) { const c = ((window.Grupo && Grupo.lista()) || []).find(x => x.modelo === 'casa' && x.nome.toLowerCase() === String(j.casa.nome || '').toLowerCase()); if (c) { m.plano.casa = c.key; m.plano.membroCasa = j.casa.membro; } }
        audit('PF_IMPORTACAO', `Planeador Financeiro (${f.name}): ${novos.rec.length} recibos, ${novos.desp.length} despesas, ${novos.cred.length} créditos, ${novos.ext.length} extratos`);
        app.save(); ui.toast('Dados importados', 'ok'); app.refresh(); } }] });
  };
  inp.click();
}


/* ---------- Casa partilhada: conta corrente com os outros membros ----------
   Os acertos e o saldo vivem aqui, no plano pessoal. Quem deve regista o pagamento (assinado);
   quem recebe confirma na sua Caixa de entrada (assinado) e o pagamento fica concluído. */
const CC = () => SPAP.contaCasa;
const ligacaoCasa = () => { const pl = M().plano; return pl.casa && pl.membroCasa && CC() ? { casa: pl.casa, eu: pl.membroCasa } : null; };
const textoPag = p => ['CASA-PAG', p.casa || '', p.id, p.de, p.para, (+p.valor || 0).toFixed(2), p.data || '', p.descricao || '', ...(p.mes ? [p.mes] : [])].join('|');
const textoCompra = c => ['CASA-COMPRA', c.casa || '', c.id, c.despesa, c.membro, (+c.valor || 0).toFixed(2), c.data || '', c.descricao || ''].join('|');
const textoConta = c => ['CASA-CONTA', c.casa || '', c.id, c.despesa, c.mes, (+c.valor || 0).toFixed(2), c.data || '', c.membro].join('|');

/* Contas da casa que este membro paga por inteiro (a despesa está em nome dele). Cada uma só pode ser dada como
   paga quando o acerto desse mês, enviado por quem divide, já está confirmado: o acerto serve de saldo e é gasto
   pela ordem do dia de cobrança. Se não chegar, aparece "falta acerto de X €". */
function contasAPagar(L, ym) {
  const d0 = CC().livro(L.casa); if (!d0 || !d0.mod) return null;
  const desp = CC().todasDespesas(L.casa, d0).filter(e => e.ativo !== false && CC().ativaNoMes(e, ym)), R = CC().registo(L.casa);
  const val = e => CC().valorMes(e, ym).valor, parte = (e, id) => +((e.partes || {})[id]) || 0;
  const outros = (d0.mod.membros || []).filter(x => x.id !== L.eu), acerto = {}, minhas = desp.filter(e => e.pagaPor === L.eu && e.periodicidade !== 'compras');
  const hoje = today().slice(0, 7), ex = CC().extrato(L.casa, ym > hoje ? ym : hoje);
  outros.forEach(o => {
    // acerto do mês que este membro me envia: as minhas contas menos as que ele paga e as compras de cada um (por compras)
    const obrig = minhas.reduce((t, e) => t + val(e) * parte(e, o.id), 0), linha = ex && ex.linhas.find(l => l.tipo === 'acerto' && l.mes === ym && l.de === o.id && l.para === L.eu);
    const pags = R.pagamentos.filter(p => p.de === o.id && p.para === L.eu && p.mes === ym);
    const recebido = r2(pags.filter(p => p.estado === 'concluido').reduce((t, p) => t + p.valor, 0)), porConfirmar = r2(pags.filter(p => p.estado === 'registado').reduce((t, p) => t + p.valor, 0));
    const deve = r2(linha ? linha.valor : 0);
    // o que ainda falta deste acerto: o saldo em dívida até ao fim do mês (pagamentos confirmados, crédito de meses anteriores
    // e liquidações antigas descontam), no máximo o acerto do mês
    const emDivida = CC().saldoAte(L.casa, o.id, L.eu, ym), pendente = r2(Math.max(0, Math.min(deve, emDivida)));
    acerto[o.id] = { nome: (o.nome || o.id), deve, recebido, porConfirmar, pendente, liquidado: deve > 0.004 && pendente <= 0.004, credito: obrig - pendente, emCurso: !!(linha && linha.emCurso) };
  });
  const cum = {};
  const linhas = minhas.slice().sort((a, b) => (+a.dia || 1) - (+b.dia || 1) || String(a.nome).localeCompare(String(b.nome))).map(e => {
    const v = val(e); let falta = 0, deOutros = 0;
    outros.forEach(o => { const x = v * parte(e, o.id); deOutros += x; cum[o.id] = (cum[o.id] || 0) + x; falta += Math.max(0, cum[o.id] - acerto[o.id].credito); });
    // paga: registada com "Paga", ou já passou o dia de cobrança (débito direto / transferência feita nesse dia)
    const dia = Math.min(28, Math.max(1, +e.dia || 1)), dataCob = `${ym}-${String(dia).padStart(2, '0')}`;
    const conta = e.periodicidade === 'cartao' && e.ref && e.ref.conta && M().extratos.some(z => z.conta === e.ref.conta) ? e.ref.conta : null;
    if (conta) { const xe = extratoDoMes(conta, ym), st = xe ? estadoExtrato(xe) : null;
      return { e, valor: r2(v), deOutros: r2(deOutros), falta: r2(falta), cartao: true, st, xe, paga: st && ['pago', 'minimo', 'atraso', 'declarado'].includes(st.estado) ? { data: st.ultimo || (st.dec && st.dec.data) || st.lim } : null }; }
    const paga = (R.contasPagas || []).find(c => c.despesa === e.id && c.mes === ym && !c.anulada) || (dataCob <= today() ? { data: dataCob, auto: true } : null);
    return { e, valor: r2(v), deOutros: r2(deOutros), falta: r2(falta), paga };
  });
  return { ym, linhas, acerto, outros };
}
async function pagarConta(L, ym, x) {
  const s = await app.assinar('Conta partilhada paga', `<b>${esc(x.e.nome)}</b> · ${fmtMes(ym)} · <b>${eur(x.valor)}</b><br><span style="font-size:12px">Fica registada como paga por si, com esta assinatura.</span>`);
  if (!s) return false;
  const c = { id: 'K' + uid(), casa: L.casa, despesa: x.e.id, nome: x.e.nome, mes: ym, valor: x.valor, data: today(), membro: L.eu, sistema: sub.key, criadoEm: new Date().toISOString() };
  c.registo = { user: app.user.id, nome: app.user.nome, membro: L.eu, assinatura: await s.signer.texto('CONTA_PAGA', textoConta(c)) };
  CC().alterar(L.casa, r => { r.contasPagas = r.contasPagas || []; if (!r.contasPagas.some(y => y.despesa === c.despesa && y.mes === ym && !y.anulada)) r.contasPagas.push(c); });
  audit('CASA_CONTA_PAGA', `${x.e.nome} · ${fmtMes(ym)} · ${eur(x.valor)}`); app.save(); ui.toast('Conta registada como paga', 'ok'); return true;
}
/* Despesas "por compras" (ex.: alimentação): cada membro regista as compras que fez; a parte de cada um é sobre o total do mês
   e quem comprou mais do que a sua parte recebe a diferença no acerto mensal. */
function comprasCasa(L, ym) {
  const d0 = CC().livro(L.casa); if (!d0 || !d0.mod) return [];
  const ms = d0.mod.membros || [];
  return CC().todasDespesas(L.casa, d0).filter(e => e.periodicidade === 'compras' && e.ativo !== false && CC().ativaNoMes(e, ym)).map(e => {
    const cs = CC().comprasMes(e, ym).sort((a, b) => String(a.data).localeCompare(String(b.data))), total = r2(cs.reduce((t, c) => t + (+c.valor || 0), 0));
    const por = ms.map(x => { const comprou = r2(cs.filter(c => c.membro === x.id).reduce((t, c) => t + (+c.valor || 0), 0)), parte = r2(total * (+((e.partes || {})[x.id]) || 0));
      return { id: x.id, nome: x.nome, comprou, parte, saldo: r2(comprou - parte) }; });
    return { e, cs, total, por };
  });
}
async function registarCompra(L, e, f) {
  const s = await app.assinar('Compra partilhada', `<b>${esc(e.nome)}</b> · ${esc(f.descricao || 'Compra')} · ${date(f.data)} · <b>${eur(f.valor)}</b><br><span style="font-size:12px">Conta no acerto do mês: cada um paga a sua parte do total das compras.</span>`);
  if (!s) return false;
  const c = { id: 'Q' + uid(), casa: L.casa, despesa: e.id, membro: L.eu, data: f.data || today(), valor: r2(+f.valor), descricao: f.descricao || '', sistema: sub.key, criadoEm: new Date().toISOString() };
  c.registo = { user: app.user.id, nome: app.user.nome, membro: L.eu, assinatura: await s.signer.texto('CASA_COMPRA', textoCompra(c)) };
  CC().alterar(L.casa, r => { r.compras = r.compras || []; r.compras.push(c); });
  audit('CASA_COMPRA', `${e.nome} · ${c.descricao} · ${date(c.data)} · ${eur(c.valor)}`); app.save(); ui.toast('Compra registada', 'ok'); return true;
}
async function anularCompra(L, c) {
  const s = await app.assinar('Anular compra', `${esc(c.descricao || 'Compra')} · ${date(c.data)} · <b>${eur(c.valor)}</b><br><span style="font-size:12px">Deixa de contar no acerto do mês.</span>`);
  if (!s) return false;
  const an = { user: app.user.id, nome: app.user.nome, em: new Date().toISOString(), assinatura: await s.signer.texto('CASA_COMPRA_ANULADA', textoCompra(c)) };
  CC().alterar(L.casa, r => { const x = (r.compras || []).find(y => y.id === c.id); if (x && x.membro === L.eu) Object.assign(x, { anulada: true, anulacao: an }); });
  audit('CASA_COMPRA_ANULADA', `${c.descricao || 'Compra'} · ${date(c.data)} · ${eur(c.valor)}`); app.save(); ui.toast('Compra anulada', 'ok'); return true;
}
const estadoPag = p => p.estado === 'concluido' ? `<span class="badge ok">concluído${p.concluidoEm ? ' ' + date(p.concluidoEm) : ''}</span>`
  : p.estado === 'registado' ? '<span class="badge info">pagamento registado · aguarda confirmação</span>' : '<span class="badge warn">pendente</span>';
async function assinarPagamento({ de, para, valor, data, descricao, concluir, mes }, ex) {
  const L = ligacaoCasa(); const s = await app.assinar(concluir ? 'Registar recebimento' : 'Registar pagamento',
    `${concluir ? `Recebi <b>${eur(valor)}</b> de ${esc(ex.nomeM(de))}` : `Paguei <b>${eur(valor)}</b> a ${esc(ex.nomeM(para))}`} · ${esc(descricao)}<br><span style="font-size:12px">${concluir ? 'Fica concluído.' : `Fica a aguardar a confirmação de ${esc(ex.nomeM(para).split(' ')[0])}, na Caixa de entrada.`}</span>`);
  if (!s) return false;
  const pag = { id: 'P' + uid(), casa: L.casa, de, para, valor: r2(valor), data: data || today(), descricao, criadoEm: new Date().toISOString(), sistema: sub.key, ...(mes ? { mes } : {}) };
  const reg = { user: app.user.id, nome: app.user.nome, membro: L.eu, assinatura: await s.signer.texto(concluir ? 'REGISTAR_RECEBIMENTO' : 'REGISTAR_PAGAMENTO', textoPag(pag)) };
  if (concluir) Object.assign(pag, { estado: 'concluido', concluidoEm: today(), confirmacao: reg, registo: reg }); else Object.assign(pag, { estado: 'registado', registo: reg });
  CC().alterar(L.casa, r => r.pagamentos.push(pag));
  audit(concluir ? 'CASA_RECEBIMENTO' : 'CASA_PAGAMENTO', `${ex.nome}: ${ex.nomeM(de)} → ${ex.nomeM(para)} ${eur(valor)} · ${descricao}`); app.save();
  ui.toast(concluir ? 'Recebimento registado: concluído' : 'Pagamento registado: aguarda confirmação', 'ok'); return true;
}
async function confirmarPagamento(id) {
  const L = ligacaoCasa(); const ex = CC().extrato(L.casa); const p = CC().registo(L.casa).pagamentos.find(x => x.id === id);
  if (!p || p.estado !== 'registado' || p.para !== L.eu) return false;
  const s = await app.assinar('Confirmar recebimento', `Recebi <b>${eur(p.valor)}</b> de ${esc(ex.nomeM(p.de))} · ${esc(p.descricao)}<br><span style="font-size:12px">O pagamento fica concluído.</span>`);
  if (!s) return false;
  const conf = { user: app.user.id, nome: app.user.nome, membro: L.eu, assinatura: await s.signer.texto('CONFIRMAR_RECEBIMENTO', textoPag(p)) };
  CC().alterar(L.casa, r => { const x = r.pagamentos.find(y => y.id === id); if (x && x.estado === 'registado') Object.assign(x, { estado: 'concluido', concluidoEm: today(), confirmacao: conf }); });
  audit('CASA_RECEBIMENTO_CONFIRMADO', `${ex.nome}: ${ex.nomeM(p.de)} → ${ex.nomeM(p.para)} ${eur(p.valor)} · ${p.descricao}`); app.save();
  ui.toast('Recebimento confirmado: concluído', 'ok'); return true;
}
/* ---------- Partilhas entre planos pessoais ----------
   Quem quer partilhar uma despesa propõe-na (assinado) a outro plano pessoal do grupo; a outra pessoa recebe o pedido
   na Caixa de entrada e aceita ou recusa (assinado). Só depois de aceite a despesa passa a ser dividida. */
const PER_PARTILHA = [['mensal', 'Mensal'], ['trimestral', 'Trimestral'], ['semestral', 'Semestral'], ['anual', 'Anual'], ['pontual', 'Pontual (uma vez)'], ['compras', 'Por compras (cada um regista as suas)']];
const nomePer = k => (PER_PARTILHA.find(x => x[0] === k) || [0, k === 'cartao' ? 'A prestações pelo cartão' : k])[1];
const semPessoal = n => String(n || '').replace(/\s*\(pessoal\)\s*$/i, '');
const pessoasGrupo = () => ((window.Grupo && Grupo.lista()) || []).filter(s => s.modelo === 'planeamento' && s.ativa !== false && s.key !== sub.key);
function convDe(e) { if (!e || !e.partilha || !CC()) return null; return (CC().registo(e.partilha.casa).convites || []).find(c => c.id === e.partilha.convite) || null; }
function partilhaAceite(e, ym) { const c = e && e.partilha ? convDe(e) : null; return !!(c && c.estado === 'aceite' && (!c.despesa.inicio || ym >= c.despesa.inicio)); }
const nomeMembro = (casa, id) => { const mb = ((CC() && CC().registo(casa).membros) || []).find(x => x.id === id); return mb ? mb.nome : '—'; };
function badgePartilha(cv) {
  if (!cv) return '';
  const todos = cv.paraNomes ? cv.paraNomes.map(primeiro) : [primeiro(cv.paraNome)], rs = cv.respostas || {};
  const faltam = cv.paraNomes ? cv.paraNomes.filter((n, i) => !rs[cv.paraSistemas[i]]).map(primeiro) : todos;
  const recusou = cv.paraNomes ? cv.paraNomes.filter((n, i) => rs[cv.paraSistemas[i]] && rs[cv.paraSistemas[i]].aceite === false).map(primeiro) : todos;
  const L = l => esc(l.join(', ') || 'a outra pessoa');
  return cv.estado === 'pendente' ? `<span class="badge info" data-tip="Aguarda que ${L(faltam)} aceite na Caixa de entrada. Até lá conta por inteiro neste plano.">partilha proposta · aguarda ${L(faltam)}</span>`
    : cv.estado === 'aceite' ? `<span class="badge ok" data-tip="Desde ${fmtMes(cv.despesa.inicio)} conta só a sua parte, na página Partilhas.">partilhada com ${L(todos)}</span>`
    : cv.estado === 'recusado' ? `<span class="badge warn">partilha recusada por ${L(recusou)}</span>` : '';
}
const ehObj = c => !!c && c.tipo === 'objetivo';
const ehAlt = c => !!c && c.tipo === 'alteracao';
const nomeConv = c => ehAlt(c) ? 'alteração a ' + c.nome : ehObj(c) ? c.objetivo.nome : c.despesa.nome, valorConv = c => ehAlt(c) ? null : ehObj(c) ? c.objetivo.alvo : c.despesa.valor;
// um pedido espera a minha resposta? (nas alterações respondem todos os outros participantes, um a um)
const paraMim = c => c.paraSistemas ? c.paraSistemas.includes(sub.key) && !(c.respostas || {})[sub.key] : c.paraSistema === sub.key;
// o meu membro num pedido (com várias pessoas, cada uma tem o seu)
const meuIdConv = c => c.paraMembros ? c.paraMembros[c.paraSistemas.indexOf(sub.key)] : c.para;
const primeiro = n => semPessoal(n || '').split(' ')[0];
const textoConviteObj = (casa, c) => ['PARTILHA-OBJETIVO', casa, c.id, c.de, c.para, c.deSistema, c.paraSistema, c.objetivo.nome, (+c.objetivo.alvo || 0).toFixed(2), c.objetivo.data || '', JSON.stringify(c.objetivo.partes), (+c.objetivo.inicial || 0).toFixed(2)].join('|');
const textoAlteracao = (casa, c) => ['PARTILHA-ALTERACAO', casa, c.id, c.de, c.deSistema, c.despesaId, JSON.stringify(c.mudancas)].join('|');
const textoConv = (casa, c) => ehAlt(c) ? textoAlteracao(casa, c) : ehObj(c) ? textoConviteObj(casa, c) : textoConvite(casa, c);
const textoContrib = (casa, o, c) => ['PARTILHA-CONTRIBUICAO', casa, o.id, c.id, c.membro, (+c.valor || 0).toFixed(2), c.data || '', c.descricao || ''].join('|');
const textoConvite = (casa, c) => ['PARTILHA', casa, c.id, c.de, c.para, c.deSistema, c.paraSistema, c.despesa.nome, (+c.despesa.valor || 0).toFixed(2), c.despesa.periodicidade, c.despesa.inicio || '', c.despesa.fim || '', c.despesa.pagaPor, JSON.stringify(c.despesa.partes), ...(c.paraSistemas ? [JSON.stringify(c.paraSistemas)] : [])].join('|');
function partilharDespesa(e0) {
  const pessoas = pessoasGrupo(); if (!pessoas.length) { ui.toast('Não há outros planos pessoais no grupo com quem partilhar.', 'warn'); return; }
  const e = e0 || { categoria: 'Habitação', periodicidade: 'mensal', valor: 0, dia: 1 }, ini = e0 && e0.inicio && e0.inicio > ymHoje() ? e0.inicio : ymHoje();
  ui.modal({ title: e0 ? 'Partilhar · ' + esc(e0.nome) : 'Nova despesa partilhada', wide: true, sub: 'Cada pessoa recebe o pedido na Caixa de entrada.',
    body: `<form class="form"><div class="fld full"><label>Partilhar com</label><div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px 14px;align-items:center;max-width:420px">${pessoas.map((x, i) => `<label class="check" style="margin:0"><input type="checkbox" data-com="${x.key}" ${i === 0 ? 'checked' : ''}> ${esc(semPessoal(x.nome))}</label><span style="display:inline-flex;gap:6px;align-items:center"><input class="inp inp-sm num" type="number" step="any" min="0" max="100" data-pc="${x.key}" style="width:80px"> %</span>`).join('')}</div><span class="hint">Escolha uma ou mais pessoas e a parte de cada uma. A partilha começa quando todas aceitarem.</span></div>
      <div class="fld"><label>Designação</label><input class="inp" name="nome" value="${esc(e.nome || '')}" placeholder="ex.: Renda"></div>
      <div class="fld"><label>Categoria</label><select class="inp" name="categoria">${CATS_DESP.map(c => `<option ${c === e.categoria ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
      <div class="fld"><label>Valor por cobrança (€)</label><input class="inp num" type="number" step="any" name="valor" value="${esc(e.valor || '')}"><span class="hint">Por compras: orçamento mensal, só para a previsão.</span></div>
      <div class="fld"><label>Periodicidade</label><select class="inp" name="periodicidade">${PER_PARTILHA.map(([k, l]) => `<option value="${k}" ${k === e.periodicidade ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="fld"><label>Dia de cobrança</label><input class="inp num" type="number" min="1" max="28" name="dia" value="${esc(e.dia || 1)}"></div>
      <div class="fld"><label>Quem paga</label><select class="inp" name="paga"><option value="eu">Eu (está em meu nome)</option>${pessoas.map(x => `<option value="${x.key}">${esc(semPessoal(x.nome))}</option>`).join('')}</select><span class="hint">Quem paga adianta a parte dos outros; acerta-se no fim do mês.</span></div>
      <div class="fld"><label>A minha parte (%)</label><input class="inp num" type="number" step="any" min="0" max="100" name="minha" value="50"></div>
      <div class="fld"><label>Desde (mês)</label><input class="inp" type="month" name="inicio" value="${esc(ini)}"></div>
      <div class="fld"><label>Até (mês)</label><input class="inp" type="month" name="fim" value="${esc(e.fim || '')}"><span class="hint">Opcional.</span></div>
      <div class="fld"><label>&nbsp;</label><label class="check"><input type="checkbox" name="variavel" ${e.variavel ? 'checked' : ''}> Valor variável (é uma média)</label></div></form>`,
    actions: [{ label: 'Cancelar', kind: 'ghost' }, { label: icon('key') + 'Assinar e enviar', kind: 'primary', onClick: el => { const f = ui.formData(el);
      if (!f.nome) { ui.toast('Indique a designação', 'warn'); return false; } if (!(+f.valor > 0) && f.periodicidade !== 'compras') { ui.toast('Indique o valor', 'warn'); return false; }
      if (!(+f.minha >= 0 && +f.minha <= 100)) { ui.toast('A sua parte tem de estar entre 0% e 100%', 'warn'); return false; } if (!f.inicio) { ui.toast('Indique desde quando', 'warn'); return false; }
      f.com = [...el.querySelectorAll('[data-com]:checked')].map(c => c.dataset.com); f.pcs = {};
      if (!f.com.length) { ui.toast('Escolha pelo menos uma pessoa', 'warn'); return false; }
      for (const k of f.com) { const x = +el.querySelector(`[data-pc="${k}"]`).value; if (!(x > 0 && x <= 100)) { ui.toast('Indique a parte de cada pessoa', 'warn'); return false; } f.pcs[k] = x; }
      const soma = +f.minha + Object.values(f.pcs).reduce((a, b) => a + b, 0); if (Math.abs(soma - 100) > 0.05) { ui.toast(`As partes somam ${r2(soma)}%: devem somar 100%`, 'warn'); return false; }
      if (f.paga !== 'eu' && !f.com.includes(f.paga)) { ui.toast('Quem paga tem de fazer parte da partilha', 'warn'); return false; }
      setTimeout(async () => { if (await enviarConvite(e0, f)) app.refresh(); }, 0); } }],
    // divide em partes iguais sempre que se escolhe ou tira uma pessoa
    onOpen: el => { const igual = () => { const sel = [...el.querySelectorAll('[data-com]')].filter(c => c.checked), q = r2(100 / (sel.length + 1));
        el.querySelectorAll('[data-com]').forEach(c => { const i = el.querySelector(`[data-pc="${c.dataset.com}"]`); i.disabled = !c.checked; i.value = c.checked ? q : ''; const o = el.querySelector(`[name="paga"] option[value="${c.dataset.com}"]`); if (o) o.disabled = !c.checked; });
        el.querySelector('[name="minha"]').value = r2(100 - q * sel.length); const pg = el.querySelector('[name="paga"]'); if (pg.selectedOptions[0] && pg.selectedOptions[0].disabled) pg.value = 'eu'; };
      el.querySelectorAll('[data-com]').forEach(c => c.onchange = igual); igual(); } });
}
function livroCom(alvo) {
  const L = ligacaoCasa(), outroNome = semPessoal(alvo.nome); let casa, eu, outro;
  if (L) { casa = L.casa; eu = L.eu; const mb = (CC().registo(casa).membros || []).find(x => x.sistema === alvo.key); outro = mb ? mb.id : 'M' + uid();
    if (!mb) CC().alterar(casa, r => { r.membros = r.membros || []; r.membros.push({ id: outro, nome: outroNome, sistema: alvo.key }); }); }
  else { eu = 'M' + uid(); outro = 'M' + uid();
    casa = CC().nova({ nome: `${app.user.nome.split(' ')[0]} e ${outroNome.split(' ')[0]}`, membros: [{ id: eu, nome: app.user.nome, sistema: sub.key }, { id: outro, nome: outroNome, sistema: alvo.key }] });
    M().plano.casa = casa; M().plano.membroCasa = eu; }
  return { casa, eu, outro };
}
async function enviarConvite(e0, f) {
  const com = Array.isArray(f.com) ? f.com : [f.com], alvos = pessoasGrupo().filter(x => com.includes(x.key)); if (!alvos.length) return false;
  const pcs = f.pcs || { [alvos[0].key]: 100 - (+f.minha || 0) };
  const minha = r2(Math.min(100, Math.max(0, +f.minha || 0))) / 100, nomes = alvos.map(a => semPessoal(a.nome)), lista = nomes.map(esc).join(', ');
  let L = ligacaoCasa();
  if (L && !(CC().livro(L.casa) || {}).partilha) { ui.toast('Este plano ainda está ligado a uma casa antiga. Peça a migração para partilhas.', 'bad'); return false; }
  const pagaNome = f.paga === 'eu' ? 'eu' : esc(semPessoal((alvos.find(a => a.key === f.paga) || {}).nome));
  const s = await app.assinar('Propor partilha', `<b>${esc(f.nome)}</b> · ${eur(+f.valor || 0)} (${esc(nomePer(f.periodicidade))}) com <b>${lista}</b><br>A sua parte: <b>${pct(minha)}</b>${alvos.length > 1 ? ' · ' + alvos.map(a => `${esc(primeiro(a.nome))} ${pct(pcs[a.key] / 100)}`).join(' · ') : ''} · paga: ${pagaNome} · desde ${fmtMes(f.inicio)}<br><span style="font-size:12px">${alvos.length > 1 ? 'Cada pessoa recebe o pedido na Caixa de entrada e a partilha começa quando todas aceitarem.' : `${lista} recebe o pedido na Caixa de entrada e a partilha começa quando aceitar.`}</span>`);
  if (!s) return false;
  let casa, eu; const ids = {};
  alvos.forEach(a => { const r = livroCom(a); casa = r.casa; eu = r.eu; ids[a.key] = r.outro; });
  const partes = { [eu]: minha }; alvos.forEach(a => { partes[ids[a.key]] = r2((+pcs[a.key] || 0) * 100) / 10000; });
  const despesa = { id: 'C' + uid(), nome: f.nome.trim(), categoria: f.categoria, valor: r2(+f.valor || 0), periodicidade: f.periodicidade, dia: Math.min(28, Math.max(1, parseInt(f.dia, 10) || 1)), inicio: f.inicio, fim: f.fim || '',
    variavel: f.periodicidade !== 'compras' && !!f.variavel, ativo: true, pagaPor: f.paga === 'eu' || !ids[f.paga] ? eu : ids[f.paga], partes, ...(e0 ? { origem: { sistema: sub.key, despesa: e0.id } } : {}) };
  const c = { id: 'Cv' + uid(), tipo: 'despesa', de: eu, para: ids[alvos[0].key], deSistema: sub.key, paraSistema: alvos[0].key, deNome: app.user.nome, paraNome: nomes.join(', '), despesa, estado: 'pendente', criadoEm: new Date().toISOString(),
    ...(alvos.length > 1 ? { paraSistemas: alvos.map(a => a.key), paraMembros: alvos.map(a => ids[a.key]), paraNomes: nomes, respostas: {} } : {}) };
  c.proposta = { user: app.user.id, nome: app.user.nome, assinatura: await s.signer.texto('PROPOR_PARTILHA', textoConvite(casa, c)) };
  CC().alterar(casa, r => { r.convites = r.convites || []; r.convites.push(c); });
  if (e0) e0.partilha = { casa, convite: c.id };
  audit('PF_PARTILHA_PROPOSTA', `${despesa.nome} · ${eur(despesa.valor)} com ${nomes.join(', ')} · minha parte ${pct(minha)}`); app.save();
  ui.toast(`Pedido enviado a ${nomes.map(primeiro).join(', ')}`, 'ok'); return true;
}
// pedidos de partilha dirigidos a este plano, em todas as partilhas a que tem acesso
const convitesParaMim = () => CC() ? CC().partilhas().flatMap(casa => (CC().registo(casa).convites || []).filter(c => c.estado === 'pendente' && paraMim(c)).map(c => ({ casa, c }))) : [];
const resumoConvite = (casa, c) => { if (ehAlt(c)) return `<b>${esc(semPessoal(c.deNome))}</b> propõe alterar a despesa partilhada <b>${esc(c.nome)}</b>: ${descMudancas(casa, c)}`;
  if (ehObj(c)) { const o = c.objetivo, parte = +((o.partes || {})[c.para]) || 0;
    return `<b>${esc(semPessoal(c.deNome))}</b> propõe um objetivo em conjunto: <b>${esc(o.nome)}</b> · ${eur(o.alvo)}${o.data ? ' até ' + date(o.data) : ''} · a sua parte <b>${pct(parte)}</b> (${eur(o.alvo * parte)})${+o.inicial > 0 ? ` · ${esc(semPessoal(c.deNome).split(' ')[0])} já tem ${eur(o.inicial)} poupados` : ''}`; }
  const d = c.despesa, me = meuIdConv(c), parte = +((d.partes || {})[me]) || 0, quem = d.pagaPor === me ? 'paga você' : `paga ${esc(d.pagaPor === c.de ? primeiro(c.deNome) : primeiro(nomeMembro(casa, d.pagaPor)))}`;
  const outros = c.paraNomes ? c.paraNomes.filter((n, i) => c.paraSistemas[i] !== sub.key).map(primeiro) : [];
  return `<b>${esc(semPessoal(c.deNome))}</b> propõe partilhar <b>${esc(d.nome)}</b>${outros.length ? ` (também com ${esc(outros.join(', '))})` : ''} · ${d.periodicidade === 'compras' ? `orçamento ${eur(d.valor)}/mês, cada um regista as compras` : `${eur(d.valor)} ${esc(nomePer(d.periodicidade).toLowerCase())}`} · ${quem} · a sua parte <b>${pct(parte)}</b>${d.periodicidade !== 'compras' ? ` (${eur(d.valor * parte)})` : ''} · desde ${fmtMes(d.inicio)}${d.fim ? ' até ' + fmtMes(d.fim) : ''}`; };
function responderConvite(casa, id) {
  const c = (CC().registo(casa).convites || []).find(x => x.id === id); if (!c) return false;
  return new Promise(res => ui.modal({ title: ehAlt(c) ? 'Alteração a despesa partilhada' : 'Pedido de partilha', sub: ehAlt(c) ? 'A alteração só é aplicada quando todos os participantes aprovarem. A sua resposta fica assinada.' : 'A sua resposta fica assinada.', body: `<p style="margin:0">${resumoConvite(casa, c)}</p>`,
    actions: [{ label: 'Recusar', kind: 'bad', onClick: () => { setTimeout(async () => res(await decidirConvite(casa, id, false)), 0); } }, { label: 'Fechar', kind: 'ghost', onClick: () => { res(false); } },
      { label: icon('key') + 'Aceitar', kind: 'primary', onClick: () => { setTimeout(async () => res(await decidirConvite(casa, id, true)), 0); } }] }));
}
async function decidirConvite(casa, id, aceitar) {
  const c = (CC().registo(casa).convites || []).find(x => x.id === id); if (!c || c.estado !== 'pendente') return false;
  if (ehAlt(c)) return decidirAlteracao(casa, c, aceitar);
  const pl = M().plano; if (aceitar && pl.casa && pl.casa !== casa) { ui.toast('Este plano já partilha despesas noutro registo: não é possível juntar os dois.', 'bad'); return false; }
  const s = await app.assinar(aceitar ? 'Aceitar partilha' : 'Recusar partilha', resumoConvite(casa, c)); if (!s) return false;
  const resp = { user: app.user.id, nome: app.user.nome, em: new Date().toISOString(), assinatura: await s.signer.texto(aceitar ? 'ACEITAR_PARTILHA' : 'RECUSAR_PARTILHA', textoConv(casa, c)) };
  const me = meuIdConv(c); let falta = false;
  CC().alterar(casa, r => { const x = (r.convites || []).find(y => y.id === id); if (!x || x.estado !== 'pendente') return;
    if (x.paraSistemas) { x.respostas = x.respostas || {}; x.respostas[sub.key] = Object.assign({}, resp, { aceite: !!aceitar });
      const mb = (r.membros || []).find(m => m.id === me); if (aceitar && mb) mb.nome = app.user.nome;
      if (!aceitar) { x.estado = 'recusado'; return; }
      if (!x.paraSistemas.every(k => (x.respostas[k] || {}).aceite)) { falta = true; return; }
      x.estado = 'aceite'; r.despesas.push(Object.assign({}, x.despesa, { convite: x.id })); return; }
    x.estado = aceitar ? 'aceite' : 'recusado'; x.resposta = resp;
    if (aceitar && ehObj(x)) { const o = x.objetivo; r.objetivos = r.objetivos || [];
      r.objetivos.push({ id: o.id, nome: o.nome, categoria: o.categoria || 'outro', alvo: o.alvo, data: o.data || '', prioridade: o.prioridade || 3, partes: o.partes, convite: x.id, criadoPor: x.de,
        contribuicoes: +o.inicial > 0 ? [{ id: 'Ct' + uid(), membro: x.de, valor: r2(+o.inicial), data: String(x.criadoEm || '').slice(0, 10), descricao: 'Já poupado ao propor', inicial: true }] : [] }); }
    else if (aceitar) r.despesas.push(Object.assign({}, x.despesa, { convite: x.id }));
    if (aceitar) { const mb = (r.membros || []).find(m => m.id === x.para); if (mb) mb.nome = app.user.nome; } });
  if (aceitar && !pl.casa) { pl.casa = casa; pl.membroCasa = me; }
  audit(aceitar ? 'PF_PARTILHA_ACEITE' : 'PF_PARTILHA_RECUSADA', `${nomeConv(c)} · proposta de ${semPessoal(c.deNome)}`); app.save();
  ui.toast(!aceitar ? 'Partilha recusada' : falta ? 'Aceite: a partilha começa quando os outros participantes aceitarem' : 'Partilha aceite', 'ok'); return true;
}
async function cancelarConvite(casa, id) {
  const c = (CC().registo(casa).convites || []).find(x => x.id === id); if (!c || c.estado !== 'pendente' || c.deSistema !== sub.key) return false;
  if (!await ui.confirm('Cancelar pedido', `Cancelar o pedido de partilha de "${esc(nomeConv(c))}"?`, { okLabel: 'Cancelar pedido', danger: true })) return false;
  CC().alterar(casa, r => { const x = (r.convites || []).find(y => y.id === id); if (x && x.estado === 'pendente') Object.assign(x, { estado: 'cancelado', canceladoEm: new Date().toISOString(), canceladoPor: app.user.nome }); });
  audit('PF_PARTILHA_CANCELADA', nomeConv(c)); app.save(); return true;
}
/* Alterar uma despesa partilhada: quem altera propõe (assinado) e a alteração só se aplica quando
   todos os outros participantes aprovarem na Caixa de entrada (assinado); uma recusa anula a proposta. */
const CAMPOS_ALT = { nome: 'Designação', categoria: 'Categoria', valor: 'Valor', dia: 'Dia de cobrança', pagaPor: 'Quem paga', fim: 'Até', partes: 'Partes', variavel: 'Valor variável', valores: 'Valores reais' };
const altPendente = (casa, id) => (CC().registo(casa).convites || []).find(c => ehAlt(c) && c.estado === 'pendente' && c.despesaId === id) || null;
function descMudancas(casa, c) {
  const nm = id => esc(nomeMembro(casa, id).split(' ')[0]);
  const f = (k, x) => k === 'valor' ? eur(x) : k === 'pagaPor' ? nm(x) : k === 'fim' ? (x ? fmtMes(x) : 'sem fim') : k === 'variavel' ? (x ? 'sim' : 'não')
    : k === 'partes' ? Object.entries(x || {}).map(([m, q]) => `${nm(m)} ${pct(q)}`).join(' / ') : esc(x ?? '—');
  return Object.entries(c.mudancas || {}).map(([k, x]) => {
    if (k === 'valores') { const a = (c.antes || {}).valores || {}, ms = [...new Set([...Object.keys(a), ...Object.keys(x || {})])].sort().filter(ym => (x || {})[ym] !== a[ym]);
      return `Valores reais: ${ms.map(ym => `${fmtMes(ym)} <b>${(x || {})[ym] != null ? eur(x[ym]) : 'média'}</b>`).join(', ')}`; }
    return `${CAMPOS_ALT[k] || k}: ${f(k, (c.antes || {})[k])} → <b>${f(k, x)}</b>`; }).join(' · ');
}
const aplicarAlt = (r, c) => { const x = (r.despesas || []).find(y => y.id === c.despesaId); if (x) Object.assign(x, JSON.parse(JSON.stringify(c.mudancas)), { alteradoPor: c.deNome, alteradoEm: new Date().toISOString(), alteracao: c.id }); };
async function proporAlteracao(L, e, mud) {
  const antes = {}; Object.keys(mud).forEach(k => { if (JSON.stringify(mud[k] ?? '') === JSON.stringify(e[k] ?? '')) delete mud[k]; else antes[k] = e[k] === undefined ? null : JSON.parse(JSON.stringify(e[k])); });
  if (!Object.keys(mud).length) { ui.toast('Não alterou nada', 'warn'); return false; }
  if (altPendente(L.casa, e.id)) { ui.toast('Já há uma alteração a esta despesa à espera de aprovação', 'warn'); return false; }
  const env = new Set([...Object.keys(e.partes || {}), ...Object.keys(mud.partes || {}), e.pagaPor, mud.pagaPor].filter(Boolean));
  const outros = (CC().registo(L.casa).membros || []).filter(m => m.id !== L.eu && m.sistema && m.sistema !== sub.key && env.has(m.id));
  const c = { id: 'Cv' + uid(), tipo: 'alteracao', de: L.eu, deSistema: sub.key, deNome: app.user.nome, despesaId: e.id, nome: e.nome, mudancas: mud, antes,
    paraSistemas: outros.map(m => m.sistema), paraNomes: outros.map(m => m.nome), respostas: {}, estado: 'pendente', criadoEm: new Date().toISOString() };
  const quem = outros.map(m => esc(semPessoal(m.nome).split(' ')[0])).join(', ');
  const s = await app.assinar('Propor alteração', `<b>${esc(e.nome)}</b><br>${descMudancas(L.casa, c)}<br><span style="font-size:12px">${outros.length ? `Só é aplicada quando ${quem} aprovar na Caixa de entrada.` : 'Não há outros participantes: é aplicada já.'}</span>`);
  if (!s) return false;
  c.proposta = { user: app.user.id, nome: app.user.nome, assinatura: await s.signer.texto('PROPOR_ALTERACAO', textoAlteracao(L.casa, c)) };
  if (!outros.length) c.estado = 'aceite';
  CC().alterar(L.casa, r => { r.convites = r.convites || []; r.convites.push(c); if (c.estado === 'aceite') aplicarAlt(r, c); });
  audit('PF_PARTILHA_ALTERACAO_PROPOSTA', `${e.nome}: ${Object.keys(mud).map(k => CAMPOS_ALT[k] || k).join(', ')}`); app.save();
  ui.toast(outros.length ? `Alteração enviada para aprovação de ${quem}` : 'Alteração aplicada', 'ok'); return true;
}
async function decidirAlteracao(casa, c, aceitar) {
  if (!paraMim(c)) return false;
  const s = await app.assinar(aceitar ? 'Aprovar alteração' : 'Recusar alteração', resumoConvite(casa, c)); if (!s) return false;
  const resp = { user: app.user.id, nome: app.user.nome, em: new Date().toISOString(), aceite: !!aceitar, assinatura: await s.signer.texto(aceitar ? 'APROVAR_ALTERACAO' : 'RECUSAR_ALTERACAO', textoAlteracao(casa, c)) };
  let fim = '';
  CC().alterar(casa, r => { const x = (r.convites || []).find(y => y.id === c.id); if (!x || x.estado !== 'pendente') return;
    x.respostas = x.respostas || {}; x.respostas[sub.key] = resp;
    if (!aceitar) { x.estado = 'recusado'; fim = 'recusada'; }
    else if ((x.paraSistemas || []).every(k => (x.respostas[k] || {}).aceite)) { x.estado = 'aceite'; aplicarAlt(r, x); fim = 'aplicada'; } });
  audit(aceitar ? 'PF_PARTILHA_ALTERACAO_APROVADA' : 'PF_PARTILHA_ALTERACAO_RECUSADA', `${c.nome} · proposta de ${semPessoal(c.deNome)}`); app.save();
  ui.toast(fim === 'aplicada' ? 'Alteração aprovada e aplicada' : fim === 'recusada' ? 'Alteração recusada' : 'Aprovada: falta a aprovação dos outros participantes', 'ok'); return true;
}
// editar uma despesa já partilhada: gera uma proposta de alteração; para deixar de partilhar indica-se o último mês
function editarPartilhada(L, id) {
  const e = (CC().registo(L.casa).despesas || []).find(x => x.id === id); if (!e) return;
  if (altPendente(L.casa, id)) { ui.toast('Esta despesa já tem uma alteração à espera de aprovação', 'warn'); return; }
  const ms = CC().registo(L.casa).membros || [];
  ui.modal({ title: 'Despesa partilhada · ' + esc(e.nome), wide: true, sub: 'As alterações valem para todos e só são aplicadas quando os outros participantes as aprovarem.', body: `<form class="form">
      <div class="fld"><label>Designação</label><input class="inp" name="nome" value="${esc(e.nome || '')}"></div>
      <div class="fld"><label>Categoria</label><select class="inp" name="categoria">${CATS_DESP.map(c => `<option ${c === e.categoria ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
      ${e.periodicidade === 'cartao' ? '' : `<div class="fld"><label>Valor por cobrança (€)</label><input class="inp num" type="number" step="any" name="valor" value="${esc(e.valor)}"></div>`}
      <div class="fld"><label>Dia de cobrança</label><input class="inp num" type="number" min="1" max="28" name="dia" value="${esc(e.dia || 1)}"></div>
      <div class="fld"><label>Quem paga</label><select class="inp" name="pagaPor">${ms.map(x => `<option value="${x.id}" ${x.id === e.pagaPor ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}</select></div>
      <div class="fld"><label>Até (mês)</label><input class="inp" type="month" name="fim" value="${esc(e.fim || '')}"><span class="hint">Para deixar de partilhar, indique o último mês.</span></div>
      <div class="fld full"><label>Parte de cada um (%)</label><div class="row" style="gap:12px;flex-wrap:wrap">${ms.map(x => `<label style="display:flex;gap:6px;align-items:center">${esc(x.nome.split(' ')[0])} <input class="inp inp-sm num" type="number" step="any" min="0" max="100" data-parte="${x.id}" value="${r2((+((e.partes || {})[x.id]) || 0) * 100)}" style="width:80px"></label>`).join('')}</div></div>
      ${e.periodicidade === 'cartao' ? '' : `<div class="fld"><label>&nbsp;</label><label class="check"><input type="checkbox" name="variavel" ${e.variavel ? 'checked' : ''}> Valor variável (é uma média)</label></div>`}</form>`,
    actions: [{ label: 'Cancelar', kind: 'ghost' }, { label: icon('key') + 'Assinar e propor', kind: 'primary', onClick: el => {
      const f = ui.formData(el), partes = {}; el.querySelectorAll('[data-parte]').forEach(i => { if (+i.value > 0) partes[i.dataset.parte] = r2((+i.value || 0) / 100 * 10000) / 10000; });
      const soma = Object.values(partes).reduce((a, b) => a + b, 0); if (Math.abs(soma - 1) > 0.0001) { ui.toast(`As partes somam ${pct(soma)}: devem somar 100%`, 'warn'); return false; }
      if (!f.nome) { ui.toast('Indique a designação', 'warn'); return false; }
      const mud = { nome: f.nome.trim(), categoria: f.categoria, dia: Math.min(28, Math.max(1, parseInt(f.dia, 10) || 1)), pagaPor: f.pagaPor, fim: f.fim || '', partes };
      if (f.valor != null && e.periodicidade !== 'cartao') mud.valor = r2(+f.valor || 0); if (e.periodicidade !== 'cartao' && e.periodicidade !== 'compras') mud.variavel = !!f.variavel;
      setTimeout(async () => { if (await proporAlteracao(L, e, mud)) app.refresh(); }, 0); } }] });
}
function valoresPartilhada(L, id) {
  const e = (CC().registo(L.casa).despesas || []).find(x => x.id === id); if (!e) return;
  if (altPendente(L.casa, id)) { ui.toast('Esta despesa já tem uma alteração à espera de aprovação', 'warn'); return; }
  const meses = []; for (let ym = e.inicio || ymHoje(); ym <= ymHoje() && (!e.fim || ym <= e.fim); ym = CC().mesSeguinte(ym)) meses.push(ym);
  const med = CC().media(e);
  ui.modal({ title: 'Valores reais · ' + esc(e.nome), sub: `Valor cobrado em cada mês. Os meses sem valor usam a média (${eur(med)}) e o acerto fica marcado como estimado.`,
    body: `<form class="form">${meses.reverse().map(ym => `<div class="fld"><label>${fmtMes(ym)}</label><input class="inp num" type="number" step="any" data-ym="${ym}" value="${esc((e.valores || {})[ym] ?? '')}" placeholder="média ${eur(med)}"></div>`).join('')}</form>`,
    actions: [{ label: 'Cancelar', kind: 'ghost' }, { label: icon('key') + 'Assinar e propor', kind: 'primary', onClick: el => { const vals = {};
      el.querySelectorAll('[data-ym]').forEach(i => { if (i.value.trim() !== '' && isFinite(+i.value)) vals[i.dataset.ym] = r2(+i.value); });
      setTimeout(async () => { if (await proporAlteracao(L, e, { valores: vals })) app.refresh(); }, 0); } }] });
}
function cartaoPartilhas(L, ex) {
  const eu = L.eu, R = CC().registo(L.casa), nm = id => ex.nomeM(id).split(' ')[0], ed = podeEditar();
  const ds = CC().todasDespesas(L.casa).filter(e => e.ativo !== false && +((e.partes || {})[eu]) > 0 && e.periodicidade !== 'pontual' && (!e.fim || e.fim >= ymHoje()))
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
  const pend = (R.convites || []).filter(c => c.estado === 'pendente');
  return `<div class="card flush"><div class="card-h"><h3>Despesas partilhadas</h3><span class="sub">${ed ? 'clique numa linha para alterar' : ''}</span></div>
    ${pend.length ? `<div style="padding:0 16px 8px">${pend.map(c => `<div class="row between" style="padding:6px 0;border-bottom:1px solid var(--line)"><span>${c.deSistema === sub.key && ehAlt(c) ? `Alteração proposta a <b>${esc(c.nome)}</b>: ${descMudancas(L.casa, c)}` : c.deSistema === sub.key ? `Pedido enviado a <b>${esc(semPessoal(c.paraNome))}</b>: ${ehObj(c) ? 'objetivo ' : ''}${esc(nomeConv(c))} · ${eur(valorConv(c))}` : resumoConvite(L.casa, c)}</span>
      <span>${c.deSistema === sub.key ? `<span class="badge info">aguarda resposta</span> ${ed ? `<button class="btn sm ghost" data-cc="${c.id}">Cancelar</button>` : ''}` : paraMim(c) && ed ? `<button class="btn sm primary" data-rc="${c.id}">${icon('key')} Responder</button>` : ''}</span></div>`).join('')}</div>` : ''}
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Despesa</th><th>Periodicidade</th><th class="r">Valor do mês</th><th>Quem paga</th><th class="r">A minha parte</th><th>Período</th><th></th></tr></thead><tbody>
    ${ds.map(e => { const vm = CC().valorMes(e, ymHoje()), daqui = (R.despesas || []).some(x => x.id === e.id);
      return `<tr class="${ed && daqui ? 'click' : ''}" ${daqui ? `data-ep="${e.id}"` : ''}><td><b>${esc(e.nome)}</b><div class="faint" style="font-size:12px">${esc(e.categoria || '')}${e.variavel ? ' · variável' : ''}${e.alteradoPor ? ` · alterada por ${esc(e.alteradoPor.split(' ')[0])}` : ''}${altPendente(L.casa, e.id) ? ' <span class="badge warn">alteração por aprovar</span>' : ''}</div></td>
        <td>${esc(nomePer(e.periodicidade))}</td><td class="r num">${eur(vm.valor)}${vm.real === false ? '<div class="faint" style="font-size:11px">média</div>' : ''}</td><td>${e.pagaPor === eu ? 'eu' : esc(nm(e.pagaPor))}</td>
        <td class="r num">${eur(vm.valor * e.partes[eu])} <span class="faint" style="font-size:11px">${pct(e.partes[eu])}</span></td>
        <td style="font-size:12px">${e.inicio ? 'desde ' + fmtMes(e.inicio) : ''} ${e.fim ? 'até ' + fmtMes(e.fim) : ''}</td>
        <td class="r">${ed && daqui && e.variavel ? `<button class="btn sm ghost" data-vp="${e.id}">Valores reais</button>` : ''}</td></tr>`; }).join('') || '<tr><td colspan="7" class="empty">Sem despesas partilhadas em vigor.</td></tr>'}</tbody></table></div></div>`;
}
function ligarPartilhas(v, L) {
  const nps = v.querySelector('#nps'); if (nps) nps.onclick = () => partilharDespesa();
  v.querySelectorAll('[data-ep]').forEach(tr => tr.onclick = ev => { if (ev.target.closest('button,a') || !podeEditar()) return; editarPartilhada(L, tr.dataset.ep); });
  v.querySelectorAll('[data-vp]').forEach(b => b.onclick = () => valoresPartilhada(L, b.dataset.vp));
  v.querySelectorAll('[data-cc]').forEach(b => b.onclick = async () => { if (await cancelarConvite(L.casa, b.dataset.cc)) app.refresh(); });
  v.querySelectorAll('[data-rc]').forEach(b => b.onclick = async () => { if (await responderConvite(L.casa, b.dataset.rc)) app.refresh(); });
}
function casaPessoal(v) {
  const L = ligacaoCasa();
  if (!L) { const pend = convitesParaMim();
    v.innerHTML = `${pend.length ? `<div class="alert warn" style="margin-bottom:16px">${icon('inbox')}<div>Tem ${pend.length === 1 ? '1 pedido' : pend.length + ' pedidos'} de partilha à espera de resposta. <a href="#/aprovacoes">Abrir a Caixa de entrada</a></div></div>` : ''}
      <div class="empty">Ainda não partilha despesas com ninguém.<br>Em <a href="#/despesas">Despesas fixas</a> use <b>Partilhar</b> numa despesa, ou crie uma nova. A outra pessoa recebe o pedido na Caixa de entrada e a partilha começa quando aceitar.
      ${podeEditar() ? `<div style="margin-top:12px">${botaoMais([['Nova despesa partilhada']]).replace('data-mais', 'id="nps"')}</div>` : ''}</div>`;
    const nps = v.querySelector('#nps'); if (nps) nps.onclick = () => partilharDespesa(); return; }
  const ex = CC().extrato(L.casa);
  if (!ex) { v.innerHTML = `<div class="empty">Os dados das partilhas não estão disponíveis neste momento.</div>`; return; }
  const eu = L.eu, nm = id => ex.nomeM(id).split(' ')[0], ed = podeEditar();
  const aReceber = ex.deve.filter(x => x.para === eu), aPagar = ex.deve.filter(x => x.de === eu);
  const ymC = tab('pf-casa-mes', today().slice(0, 7)), CP = contasAPagar(L, ymC), COMP = comprasCasa(L, ymC);
  const meus = ex.linhas.filter(l => l.de === eu || l.para === eu), porConfirmar = meus.filter(l => l.tipo === 'pagamento' && l.estado === 'registado' && l.para === eu);
  const outros = ex.membros.filter(x => x.id !== eu);
  const minhas = CC().todasDespesas(L.casa).filter(e => e.ativo !== false && +((e.partes || {})[eu]) > 0 && e.periodicidade !== 'pontual' && (!e.fim || e.fim >= ymHoje()) && (!e.inicio || e.inicio <= ymHoje()));
  const minhaParte = r2(minhas.reduce((t, e) => t + CC().valorMes(e, ymHoje()).valor * e.partes[eu], 0));
  const podePagar = aPagar.length || ex.linhas.some(l => l.tipo === 'acerto' && l.de === eu && l.mes === ymC);
  const OPS = [['Despesa partilhada', null, () => partilharDespesa(), null, 'users', 'Dividir uma despesa com quem partilha consigo'],
    ...(podePagar ? [['Registar pagamento', null, 'pg', null, 'key', 'O que pagou a quem partilha consigo']] : []),
    ...(aReceber.length ? [['Registar recebimento', null, 'rc', null, 'key', 'O que lhe pagaram'], ['Liquidar até…', null, 'lq', null, 'check', 'Dar como recebido tudo até um mês']] : []),
    ['Nova dívida', null, 'nd', null, 'credit', 'Ex.: a parte de uma compra feita por um de vocês']];
  // separadores: só os que têm conteúdo
  const mesesC = Array.from({ length: 6 }, (_, i) => SPAP.addMonths(today().slice(0, 7) + '-01', i - 4).slice(0, 7));
  const SEPS = [['desp', 'users', 'Despesas partilhadas'], ...(CP && CP.linhas.length ? [['contas', 'credit', 'Contas que paga']] : []), ...(COMP.length ? [['compras', 'pie', 'Compras partilhadas']] : []), ['ext', 'file', 'Extrato']];
  if (tab('pf-casa', '') && !SEPS.some(x => x[0] === tab('pf-casa', ''))) setTab('pf-casa', '');
  const T = menuQuadrados('pf-casa', 'Partilhas', SEPS);
  const fitaMes = fita('cmes', mesesC, ymC, { rot: rotMes(ymC), rotSel: fmtMes, nome: fmtMes, atual: today().slice(0, 7), sm: true });
  v.innerHTML = `${ed ? escondidos(['pg', 'rc', 'lq', 'nd']) : ''}${T.t ? T.html + barraFita(T.t === 'contas' || T.t === 'compras' ? fitaMes : '', ed ? botaoMais(OPS) : '') : ''}
    ${porConfirmar.length ? `<div class="alert warn" style="margin-bottom:16px">${icon('inbox')}<div>${porConfirmar.length === 1 ? 'Há 1 pagamento' : `Há ${porConfirmar.length} pagamentos`} registados a aguardar a sua confirmação. <a href="#/aprovacoes">Abrir a Caixa de entrada</a></div></div>` : ''}
    ${T.t ? '' : (n => n ? `<div class="alert info" style="margin-bottom:16px">${icon('inbox')}<div>${n === 1 ? 'Há 1 pedido de partilha' : `Há ${n} pedidos de partilha`} à espera da sua resposta. <a href="javascript:void 0" data-tab="pf-casa=desp">Abrir Despesas partilhadas</a></div></div>` : '')((CC().registo(L.casa).convites || []).filter(c => c.estado === 'pendente' && paraMim(c)).length)}
    ${T.t ? '' : `<div class="grid g4" style="margin-bottom:16px">
      ${outros.map((o, oi) => { const add = ed && oi === 0 ? 'casa' : ''; const r = aReceber.find(x => x.de === o.id), pg = aPagar.find(x => x.para === o.id);
        // pagou a mais (ex.: acerto adiantado): não é dívida, é crédito dele que desconta no próximo acerto que ele me envia
        const prox = CC().mesSeguinte(today().slice(0, 7)), lp = pg && CC().extrato(L.casa, prox).linhas.find(l => l.tipo === 'acerto' && l.mes === prox && l.de === o.id && l.para === eu);
        if (lp) return kpi(`${icon('users')} Conta com ${esc(nm(o.id))}`, eur(pg.valor), `crédito de ${esc(nm(o.id))} (pagou a mais) · desconta no acerto de ${fmtMes(prox)}: em vez de ${eur(lp.valor)} envia ${eur(Math.max(0, lp.valor - pg.valor))}`, '', true, add);
        return kpi(`${icon('users')} Conta com ${esc(nm(o.id))}`, r ? eur(r.valor) : pg ? eur(pg.valor) : eur(0), r ? `${esc(nm(o.id))} deve-lhe` : pg ? `deve a ${esc(nm(o.id))}` : 'contas acertadas', r ? 'pos' : pg ? 'neg' : '', true, add); }).join('')}
      ${kpi('A minha parte / mês', eur(minhaParte), `${minhas.length} ${minhas.length === 1 ? 'despesa partilhada' : 'despesas partilhadas'}`, '', !outros.length, !outros.length && ed ? 'casa' : '')}
      ${kpi('Pagamentos por confirmar', String(meus.filter(l => l.tipo === 'pagamento' && l.estado === 'registado').length), 'registados e à espera de quem recebe')}
      ${kpi('Acerto deste mês', (() => { const t = meus.find(l => l.tipo === 'acerto' && l.mes === today().slice(0, 7)); return t ? eur(t.valor) : eur(0); })(), (() => { const t = meus.find(l => l.tipo === 'acerto' && l.mes === today().slice(0, 7)); return t ? (t.de === eu ? `a pagar a ${esc(nm(t.para))}` : `a receber de ${esc(nm(t.de))}`) : 'sem acerto'; })())}</div>${T.html}`}
    ${T.t === 'desp' ? cartaoPartilhas(L, ex) : ''}
    ${T.t === 'contas' && CP && CP.linhas.length ? (() => {
      const res = CP.outros.map(o => { const a = CP.acerto[o.id];
        return `<div class="row between" style="padding:6px 0;border-bottom:1px solid var(--line)"><span>Acerto de ${esc(nm(o.id))} · ${fmtMes(ymC)}: <b class="num">${eur(a.deve)}</b></span><span>${a.deve <= 0.004 ? '<span class="badge plain">sem acerto a receber</span>' : a.liquidado ? `<span class="badge ok">pago${a.recebido < a.deve - 0.004 ? ' (com crédito anterior)' : ''}</span>` : `${a.recebido ? `<span class="badge ok">${eur(a.recebido)} confirmado</span> ` : ''}${a.porConfirmar ? `<span class="badge info">${eur(a.porConfirmar)} enviado · por confirmar</span> ` : ''}<span class="badge warn">falta receber ${eur(a.pendente)}</span>`}</span></div>`; }).join('');
      return `<div class="card flush"><div class="card-h"><h3>Contas que paga · ${fmtMes(ymC)}</h3><span class="sub">em seu nome · pagam-se com o acerto confirmado de quem divide</span></div>
        <div style="padding:0 16px 8px">${res}</div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Conta</th><th>Dia</th><th class="r">Valor total</th><th class="r">Parte dos outros</th><th>Estado</th><th></th></tr></thead><tbody>
        ${CP.linhas.map((x, i) => `<tr><td><b>${esc(x.e.nome)}</b></td><td>${x.e.dia || 1}</td><td class="r num">${eur(x.valor)}</td><td class="r num">${eur(x.deOutros)}</td>
          <td>${x.cartao ? `${x.st ? badgeExtrato(x.st) : '<span class="badge plain" data-tip="Ainda não há extrato do cartão com data limite neste mês.">aguarda extrato</span>'}${x.falta > 0.004 ? ` <span class="badge warn">falta acerto de ${eur(x.falta)}</span>` : ''}` : x.paga ? `<span class="badge ok" ${x.paga.auto ? 'data-tip="Paga no dia de cobrança."' : ''}>paga ${date(x.paga.data)}</span>${x.falta > 0.004 ? ` <span class="badge warn">falta acerto de ${eur(x.falta)}</span>` : ''}` : x.falta > 0.004 ? `<span class="badge warn">falta acerto de ${eur(x.falta)}</span>` : '<span class="badge info">pode pagar</span>'}</td>
          <td class="r">${!x.paga && x.falta <= 0.004 && ed && (!x.cartao || podeDeclarar(x.st)) ? `<button class="btn sm primary" data-cp="${i}">${icon('key')} Paga</button>` : ''}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td>TOTAL</td><td></td><td class="r num">${eur(sum(CP.linhas, 'valor'))}</td><td class="r num">${eur(sum(CP.linhas, 'deOutros'))}</td><td colspan="2"></td></tr></tfoot></table></div></div>`; })() : ''}
    ${T.t !== 'compras' ? '' : COMP.map((k, ki) => { const eu0 = k.por.find(x => x.id === eu);
      return `<div class="card flush" style="${ki ? 'margin-top:16px' : ''}"><div class="card-h"><h3>${esc(k.e.nome)} · ${fmtMes(ymC)}</h3><span class="sub">cada um regista as compras que fez · paga-se a parte do total</span>
        ${ed ? `<span style="margin-left:auto"><button class="btn sm" data-nc="${ki}" title="Registar compra" style="${MAIS_CSS};width:34px;height:34px;font-size:19px">+</button></span>` : ''}</div>
        <div style="padding:0 16px 8px">${k.por.map(x => `<div class="row between" style="padding:6px 0;border-bottom:1px solid var(--line)"><span>${x.id === eu ? '<b>Eu</b>' : esc(nm(x.id))}: comprou <b class="num">${eur(x.comprou)}</b> · parte ${eur(x.parte)}</span>
          <span>${Math.abs(x.saldo) <= 0.004 ? '<span class="badge plain">certo</span>' : x.saldo > 0 ? `<span class="badge ok">adiantou ${eur(x.saldo)}</span>` : `<span class="badge warn">falta ${eur(-x.saldo)}</span>`}</span></div>`).join('')}
          <p class="faint" style="font-size:12px;margin:8px 0 0">Total de ${fmtMes(ymC)}: <b>${eur(k.total)}</b>${+k.e.valor ? ` (orçamento ${eur(k.e.valor)})` : ''}. A diferença entra no acerto do mês${eu0 && eu0.saldo < -0.004 ? `: pode abater os ${eur(-eu0.saldo)} em falta registando as suas compras` : ''}.</p></div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Data</th><th>Quem</th><th>Descrição</th><th class="r">Valor</th><th></th></tr></thead><tbody>
        ${k.cs.slice().reverse().map(c => `<tr><td>${date(c.data)}</td><td>${c.membro === eu ? 'eu' : esc(nm(c.membro))}</td><td>${esc(c.descricao || '—')}</td><td class="r num">${eur(c.valor)}</td>
          <td class="r">${c.membro === eu && ed ? `<button class="btn sm ghost" data-ac="${c.id}" title="Anular">${icon('trash')}</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">Sem compras registadas neste mês.</td></tr>'}</tbody>
        <tfoot><tr><td colspan="3">TOTAL</td><td class="r num">${eur(k.total)}</td><td></td></tr></tfoot></table></div></div>`; }).join('')}
    ${T.t !== 'ext' ? '' : `<div class="card flush"><div class="card-h"><h3>Extrato</h3><span class="sub">acertos, dívidas e pagamentos</span></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Data</th><th>Movimento</th><th>Tipo</th><th class="r">Deve</th><th class="r">Pago</th><th>Estado</th><th></th></tr></thead><tbody>
    ${meus.slice().reverse().map(l => { const sentido = l.de === eu ? `eu → ${esc(nm(l.para))}` : `${esc(nm(l.de))} → eu`;
      if (l.tipo === 'pagamento') return `<tr><td>${date(l.data)}</td><td>${esc(l.descricao || 'Pagamento')}<div class="faint" style="font-size:12px">${sentido}${l.registo ? ' · registado por ' + esc(l.registo.nome.split(' ')[0]) : ''}${l.confirmacao && (!l.registo || l.confirmacao.nome !== l.registo.nome) ? ' · confirmado por ' + esc(l.confirmacao.nome.split(' ')[0]) : ''}</div></td><td><span class="badge plain">pagamento</span></td><td></td><td class="r num">${eur(l.valor)}</td><td>${estadoPag(l)}</td>
        <td class="r">${l.estado === 'registado' && l.para === eu ? `<button class="btn sm primary" data-cf="${l.id}">${icon('key')} Confirmar</button>` : ''}</td></tr>`;
      return `<tr><td>${date(l.data)}</td><td>${esc(l.tipo === 'acerto' ? 'Acerto das despesas comuns · ' + fmtMes(l.mes) : l.descricao)}<div class="faint" style="font-size:12px">${sentido}</div>${l.estimado && l.estimado.length ? `<div style="font-size:11px"><span class="badge warn" data-tip="${esc('Ainda sem valor real de: ' + l.estimado.join(', ') + '. Usa-se a média; quando o valor real for registado (Despesas partilhadas › Valores reais), o acerto é corrigido.')}">estimado</span></div>` : ''}</td><td><span class="badge plain">${l.tipo === 'acerto' ? 'acerto mensal' : 'dívida'}</span>${l.emCurso ? ' <span class="badge info" data-tip="Inclui compras partilhadas: o valor muda à medida que se registam compras neste mês.">em curso</span>' : ''}</td><td class="r num">${eur(l.valor)}</td><td></td><td></td><td></td></tr>`; }).join('') || '<tr><td colspan="7" class="empty">Sem movimentos.</td></tr>'}</tbody></table></div></div>`}`;
  bindTabs(v); ligarPartilhas(v, L); ligarMais(v, OPS, '[data-add="casa"],[data-mais]', 'Partilhas');
  v.querySelectorAll('[data-cf]').forEach(b => b.onclick = async () => { if (await confirmarPagamento(b.dataset.cf)) app.refresh(); });
  ligarFita(v, 'cmes', x => { setTab('pf-casa-mes', x); app.refresh(); });
  v.querySelectorAll('[data-ac]').forEach(b => b.onclick = async () => { const c = COMP.flatMap(k => k.cs).find(x => x.id === b.dataset.ac); if (c && await anularCompra(L, c)) app.refresh(); });
  v.querySelectorAll('[data-nc]').forEach(b => b.onclick = () => { const e = COMP[+b.dataset.nc].e;
    ui.modal({ title: 'Registar compra · ' + esc(e.nome), sub: 'Conta no acerto do mês da data da compra. Fica registada com a sua assinatura.',
      body: `<form class="form"><div class="fld"><label>Data</label><input class="inp" type="date" name="data" value="${ymC === today().slice(0, 7) ? today() : SPAP.contaCasa.fimMes(ymC)}"></div><div class="fld"><label>Valor (€)</label><input class="inp num" type="number" step="any" name="valor"></div>
        <div class="fld full"><label>Descrição</label><input class="inp" name="descricao" placeholder="ex.: Continente, Lidl, talho…"></div></form>`,
      actions: [{ label: 'Cancelar', kind: 'ghost' }, { label: icon('key') + 'Assinar', kind: 'primary', onClick: el => { const f = ui.formData(el); if (!(+f.valor > 0)) { ui.toast('Indique o valor', 'warn'); return false; } if (!f.data) { ui.toast('Indique a data', 'warn'); return false; }
        setTimeout(async () => { if (await registarCompra(L, e, f)) { setTab('pf-casa-mes', f.data.slice(0, 7)); app.refresh(); } }, 0); } }] }); });
  v.querySelectorAll('[data-cp]').forEach(b => b.onclick = async () => { const x = CP.linhas[+b.dataset.cp]; if (x.cartao) { declararPagamento(x.xe); return; } if (await pagarConta(L, ymC, x)) app.refresh(); });
  const formPag = (concluir, lista) => {
    const opts = lista.map(x => { const o = concluir ? x.de : x.para; return `<option value="${o}" data-v="${x.valor}">${esc(ex.nomeM(o))} (${concluir ? 'deve-lhe' : 'deve'} ${eur(x.valor)})</option>`; }).join('');
    ui.modal({ title: concluir ? 'Registar recebimento' : 'Registar pagamento', sub: concluir ? 'Fica concluído com a sua assinatura.' : 'Fica a aguardar a confirmação de quem recebe, na Caixa de entrada do plano dele.',
      body: `<form class="form"><div class="fld"><label>${concluir ? 'Recebido de' : 'Pago a'}</label><select class="inp" name="outro">${opts}</select></div><div class="fld"><label>Valor (€)</label><input class="inp num" type="number" step="any" name="valor" value="${lista[0].valor}"></div>
        <div class="fld"><label>Acerto do mês</label><input class="inp" type="month" name="mes" value="${today().slice(0, 7)}"><span class="hint">Com o acerto confirmado, quem tem as contas em seu nome pode pagá-las.</span></div>
        <div class="fld"><label>Data</label><input class="inp" type="date" name="data" value="${today()}"></div><div class="fld"><label>Descrição</label><input class="inp" name="descricao" value="Acerto"></div></form>`,
      onOpen: el => { const sel = el.querySelector('[name=outro]'), mes = el.querySelector('[name=mes]');
        // valor do acerto desse mês entre os dois (se existir); senão o saldo total em dívida
        const valorMes = () => { const o = sel.value, l = ex.linhas.find(x => x.tipo === 'acerto' && x.mes === mes.value && (concluir ? x.de === o && x.para === eu : x.de === eu && x.para === o));
          el.querySelector('[name=valor]').value = l ? l.valor : sel.selectedOptions[0].dataset.v; el.querySelector('[name=descricao]').value = l ? `Acerto · ${fmtMes(mes.value)}` : 'Acerto'; };
        sel.onchange = valorMes; mes.oninput = valorMes; valorMes(); },
      actions: [{ label: 'Cancelar', kind: 'ghost' }, { label: icon('key') + 'Assinar', kind: 'primary', onClick: el => { const f = ui.formData(el); if (!(+f.valor > 0)) { ui.toast('Indique o valor', 'warn'); return false; }
        setTimeout(async () => { if (await assinarPagamento({ de: concluir ? f.outro : eu, para: concluir ? eu : f.outro, valor: +f.valor, data: f.data, descricao: f.descricao || 'Acerto', concluir, mes: f.mes || null }, ex)) app.refresh(); }, 0); } }] });
  };
  const pg = v.querySelector('#pg'); if (pg) pg.onclick = () => formPag(false, aPagar.length ? aPagar : outros.map(o => ({ para: o.id, valor: 0 })));
  const rc = v.querySelector('#rc'); if (rc) rc.onclick = () => formPag(true, aReceber);
  const lq = v.querySelector('#lq'); if (lq) lq.onclick = () => {
    const ant = (() => { let [a, mm] = today().slice(0, 7).split('-').map(Number); mm--; if (!mm) { mm = 12; a--; } return `${a}-${String(mm).padStart(2, '0')}`; })();
    ui.modal({ title: 'Liquidar até…', sub: 'Regista como recebido tudo o que lhe deviam até ao fim do mês escolhido. Fica concluído com a sua assinatura.',
      body: `<form class="form"><div class="fld"><label>Até ao mês (inclusive)</label><input class="inp" type="month" name="ate" value="${ant}"></div><div class="fld"><label>Data</label><input class="inp" type="date" name="data" value="${today()}"></div><div class="fld full" id="prev"></div></form>`,
      onOpen: el => { const upd = () => { const f = ui.formData(el); el.querySelector('#prev').innerHTML = !f.ate ? '' : outros.map(o => { const val = CC().saldoAte(L.casa, o.id, eu, f.ate);
        return `<div class="row between" style="padding:6px 0;border-bottom:1px solid var(--line)"><span>${esc(ex.nomeM(o.id))} deve-lhe até ${fmtMes(f.ate)}</span><b class="num">${eur(Math.max(0, val))}</b></div>`; }).join(''); };
        el.querySelectorAll('input').forEach(i => i.addEventListener('input', upd)); upd(); },
      actions: [{ label: 'Cancelar', kind: 'ghost' }, { label: icon('key') + 'Assinar', kind: 'primary', onClick: el => { const f = ui.formData(el); if (!f.ate) { ui.toast('Escolha o mês', 'warn'); return false; }
        const lista = outros.map(o => ({ o, val: CC().saldoAte(L.casa, o.id, eu, f.ate) })).filter(x => x.val > 0.004); if (!lista.length) { ui.toast('Nada a liquidar até esse mês', 'warn'); return false; }
        setTimeout(async () => { let ok = true; for (const x of lista) ok = ok && await assinarPagamento({ de: x.o.id, para: eu, valor: x.val, data: f.data, descricao: `Liquidação de tudo até ${fmtMes(f.ate)}`, concluir: true }, ex); if (ok) app.refresh(); }, 0); } }] });
  };
  const nd = v.querySelector('#nd'); if (nd) nd.onclick = () => ui.modal({ title: 'Nova dívida', sub: 'Por exemplo, a parte de uma compra feita por um de vocês.',
    body: `<form class="form"><div class="fld full"><label>Descrição</label><input class="inp" name="descricao"></div>
      <div class="fld"><label>Quem deve</label><select class="inp" name="de">${ex.membros.map(x => `<option value="${x.id}" ${x.id !== eu ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}</select></div>
      <div class="fld"><label>A quem</label><select class="inp" name="para">${ex.membros.map(x => `<option value="${x.id}" ${x.id === eu ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}</select></div>
      <div class="fld"><label>Valor (€)</label><input class="inp num" type="number" step="any" name="valor"></div><div class="fld"><label>Data</label><input class="inp" type="date" name="data" value="${today()}"></div></form>`,
    actions: [{ label: 'Cancelar', kind: 'ghost' }, { label: 'Guardar', kind: 'primary', onClick: el => { const f = ui.formData(el);
      if (!f.descricao || !(+f.valor > 0)) { ui.toast('Indique a descrição e o valor', 'warn'); return false; } if (f.de === f.para) { ui.toast('Escolha duas pessoas diferentes', 'warn'); return false; }
      CC().alterar(L.casa, r => r.dividas.push({ id: 'Dv' + uid(), de: f.de, para: f.para, valor: r2(+f.valor), data: f.data || today(), descricao: f.descricao, criadoPor: app.user.nome, sistema: sub.key }));
      audit('CASA_DIVIDA', `${ex.nome}: ${ex.nomeM(f.de)} → ${ex.nomeM(f.para)} ${eur(f.valor)} · ${f.descricao}`); app.save(); app.refresh(); } }] });
}

/* ---------- Simulador de estratégias e parâmetros do plano ---------- */
const COLS_PLANO = () => [
  { k: 'salarioBase', label: 'Salário líquido recorrente', type: 'money', hint: `Deixe 0 para estimar pelos recibos (${eur(estimarLiquido(M().recibos).base)}).` },
  { k: 'atualizarSMN', label: 'Projetar os anos futuros com a atualização do salário mínimo', type: 'check', full: true },
  { k: 'brutoBase', label: 'Vencimento base bruto mensal', type: 'money', hint: `Para comparar com o salário mínimo. Deixe 0 para estimar (${(b => b.valor ? eur(b.valor) + ', ' + b.origem : 'sem recibos')(brutoBase())}).` },
  { k: 'aumentoTipo', label: 'Como sobe o seu salário', type: 'select', opts: [['fixo', 'Aumento anual fixo (%)'], ['smn', 'Na mesma % que o salário mínimo']], hint: 'Na mesma % que o mínimo: ex. de 918 € para 971 € em 2026, quando o mínimo passou de 870 € para 920 € (+5,7%).' },
  { k: 'aumentoSalarial', label: 'Aumento anual do seu salário (se fixo)', type: 'pct', hint: 'Aumento esperado por ano (mérito, categoria, contrato coletivo). Nos anos futuros usa-se o maior entre o seu salário com este aumento e o salário mínimo.' },
  { k: 'smnAumento', label: 'Aumento anual do mínimo depois do último ano da tabela', type: 'money' },
  { k: 'smnTabela', label: 'Corrigir salário mínimo por ano', full: true, ph: 'ex.: 2027: 980; 2030: 1150', hint: `Tabela usada: ${Object.entries(SMN_PADRAO).map(([a, v]) => a + ': ' + v).join(' · ')} €. Escreva só os anos a corrigir ou a acrescentar.` },
  { k: 'pagoMesSeguinte', label: 'O ordenado de cada mês é pago no início do mês seguinte', type: 'check', full: true, hint: 'Ex.: o recibo de novembro entra a 1 de dezembro. Muda o mês em que cada recibo conta no Painel, no simulador e na previsão de liquidez.' },
  { k: 'diaSalario', label: 'Dia em que o ordenado entra', type: 'int', min: 1, max: 28 },
  { k: 'outrosRendimentos', label: 'Outros rendimentos mensais', type: 'money', hint: 'Rendas, recibos verdes, pensões…' },
  { k: 'incluirRefeicao', label: 'Contar o subsídio de refeição como rendimento', type: 'check' },
  { k: 'extraFixo', label: 'Amortização extra fixa por mês', type: 'money', hint: 'Somada ao excedente do mês.' },
  { k: 'emergMeses', label: 'Fundo de emergência (meses de despesas)', type: 'number' }, { k: 'emergProgressivo', label: 'Atingir o fundo em (meses)', type: 'int', min: 0, hint: '0 = alvo imediato, com reforço máximo de 1/12 por mês.' },
  { k: 'fundoOrigem', label: 'Saldo atual do fundo', type: 'select', opts: [['tesouraria', 'Saldos das contas de tesouraria'], ['manual', 'Valor indicado abaixo']] },
  { k: 'fundoInicial', label: 'Valor do fundo (se manual)', type: 'money' },
  { k: 'poupancaTipo', label: 'Poupança mensal', type: 'select', opts: [['none', 'Sem poupança separada'], ['fixed', 'Valor fixo'], ['percentage', '% do rendimento'], ['percentage_surplus', '% do excedente'], ['percentage_after_min_payments', '% do excedente depois das prestações']] },
  { k: 'poupancaFixa', label: 'Poupança fixa', type: 'money' }, { k: 'poupancaPct', label: 'Poupança em %', type: 'pct' },
  { k: 'horizonte', label: 'Horizonte da simulação (meses)', type: 'int', min: 12, max: 480 }];
/* Parâmetros do plano: perguntas simples, escolhas por botões e barras, e o efeito de cada escolha mostrado logo.
   Nada fica gravado até carregar em Guardar. */
const SW_CSS = `.pf-sw{display:inline-flex;gap:10px;align-items:center;cursor:pointer;font-size:13px;color:var(--muted)}.pf-sw input{appearance:none;width:36px;height:20px;border-radius:10px;background:var(--line2);position:relative;cursor:pointer;flex:none;transition:background .15s;margin:0}
.pf-sw input::after{content:'';position:absolute;top:3px;left:3px;width:14px;height:14px;border-radius:50%;background:var(--text);transition:left .15s}.pf-sw input:checked{background:var(--accent)}.pf-sw input:checked::after{left:19px;background:#fff}`;
const PAR_CSS = `<style>${SW_CSS}.pf-par{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,540px),1fr));gap:16px;align-items:start}
.pf-par .card{padding:0;overflow:hidden}.pf-par .card-h{padding:16px 20px 12px;margin:0}.pf-par .card-h h3{display:flex;gap:9px;align-items:center}.pf-par .card-h h3 svg{width:17px;height:17px;color:var(--muted)}
.pf-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.25fr);gap:24px;align-items:center;padding:14px 20px;border-top:1px solid var(--line)}
.pf-row>div:first-child b{display:block;font-weight:600;font-size:13.5px}.pf-row>div:first-child span{display:block;font-size:12px;color:var(--muted);margin-top:2px}
@media(max-width:760px){.pf-row{grid-template-columns:1fr;gap:10px}}@container (max-width:520px){.pf-row{grid-template-columns:1fr;gap:10px}}.pf-par .card{container-type:inline-size}
.pf-par .tabs{flex-wrap:wrap;width:max-content;max-width:100%}.pf-par .tabs button:disabled{cursor:default}
.pf-rng{display:flex;gap:16px;align-items:center}.pf-rng input[type=range]{flex:1;accent-color:var(--accent);height:4px}.pf-rng output{min-width:130px;text-align:right;font-size:13px;color:var(--muted);font-variant-numeric:tabular-nums}
.pf-eur{position:relative;display:inline-block}.pf-eur input{width:180px;padding-right:30px}.pf-eur::after{content:'€';position:absolute;right:12px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:13px}
.pf-par details>summary{cursor:pointer;padding:12px 20px;border-top:1px solid var(--line);font-size:13px;color:var(--muted);list-style:none}.pf-par details>summary::before{content:'›';display:inline-block;margin-right:8px;transition:transform .15s}.pf-par details[open]>summary::before{transform:rotate(90deg)}
.pf-bar{position:sticky;bottom:12px;z-index:5;display:none;margin-top:16px;padding:10px 12px 10px 18px;border:1px solid var(--line2);border-radius:12px;background:var(--panel2);box-shadow:0 10px 30px -10px rgba(0,0,0,.5);align-items:center;gap:10px;font-size:13px}.pf-bar.on{display:flex}</style>`;
function parametrosPlano(v, T, modo = 'par') {
  const POUP = modo === 'poup';
  const m = M(), pl = m.plano, ed = podeEditar(), w = JSON.parse(JSON.stringify(pl)), dis = ed ? '' : 'disabled';
  const est = salarioBase(), EMP = empregosComRefeicao(), desp = despesasMensais(), prest = prestacoesMensais(), saldoT = r2(tesouraria().reduce((t, c) => t + app.saldo(c.id), 0));
  // escolhas com o mesmo aspeto dos separadores do sistema
  const seg = (k, ops) => `<div class="tabs" data-seg="${k}">${ops.map(([val, rot]) => `<button type="button" data-v="${esc(String(val))}" ${dis}>${rot}</button>`).join('')}</div>`;
  const sw = (k, rot) => `<label class="pf-sw"><input type="checkbox" data-k="${esc(k)}" ${dis}><span>${rot}</span></label>`;
  const rng = (k, min, max, step) => `<div class="pf-rng"><input type="range" data-k="${k}" min="${min}" max="${max}" step="${step}" ${dis}><output data-out="${k}"></output></div>`;
  const eurIn = (k, ph = '0,00') => `<span class="pf-eur"><input class="inp num" type="number" step="any" min="0" data-k="${k}" placeholder="${ph}" ${dis}></span>`;
  const row = (tit, sub, ctl, show = '') => `<div class="pf-row" ${show ? `data-show="${show}"` : ''}><div><b>${tit}</b>${sub ? `<span>${sub}</span>` : ''}</div><div>${ctl}</div></div>`;
  const sec = (ic, tit, corpo) => `<div class="card"><div class="card-h"><h3>${icon(ic)} ${tit}</h3></div>${corpo}</div>`;
  const pv = id => `<span id="pv-${id}"></span>`;
  v.innerHTML = `${T.html}${PAR_CSS}
    ${POUP ? `<p class="muted" style="margin:0 0 16px">O que separa todos os meses antes de pensar nos <a href="#/objetivos">objetivos</a>: a reserva para imprevistos, a poupança e o que vai a mais para as dívidas.</p>` : ''}
    <div class="grid ${POUP ? 'g3' : 'g2'}" style="margin-bottom:16px">${POUP ? `${kpi('Fundo de emergência', pv('emg'), pv('emg-s'))}${kpi('Poupança por mês', pv('poup'), pv('poup-s'))}${kpi('Amortização extra', pv('div'), 'por mês, além do que sobrar')}`
      : ''}</div>
    <div class="pf-par">
    ${!POUP ? '' : sec('shield', 'Fundo de emergência',
      row('Reserva', `Em meses das suas despesas fixas (${eur(desp)}/mês).`, rng('emergMeses', 0, 12, 1))
      + row('Prazo para lá chegar', '', rng('emergProgressivo', 0, 60, 3))
      + row('Já tem guardado', '', seg('fundoOrigem', [['tesouraria', `Saldo das contas · ${eur(saldoT)}`], ['manual', 'Outro valor']]))
      + row('Valor guardado', '', eurIn('fundoInicial'), 'fundoOrigem=manual'))}
    ${!POUP ? '' : sec('target', 'Poupança mensal',
      row('Pôr de parte todos os meses', 'Sai primeiro, antes dos objetivos e da amortização extra.', seg('poupancaTipo', [['none', 'Não'], ['fixed', 'Valor fixo'], ['percentage', '% do que ganho'], ['percentage_surplus', '% do que sobra'], ['percentage_after_min_payments', '% após prestações']]))
      + row('Valor por mês', '', eurIn('poupancaFixa'), 'poupancaTipo=fixed')
      + row('Percentagem', '', rng('poupancaPc', 0, 50, 1), 'poupancaTipo=percentage,percentage_surplus,percentage_after_min_payments'))}
    ${!POUP ? '' : sec('credit', 'Pagar as dívidas mais depressa',
      row('Amortização extra por mês', 'Somada ao que sobrar em cada mês. A ordem de pagamento escolhe-se no <a href="#/simulador">Simulador de estratégias</a>.', eurIn('extraFixo')))}
    </div>
    ${ed ? `<div class="pf-bar" id="pbar"><span style="flex:1">Tem alterações por guardar</span><button class="btn ghost sm" id="pdesc">Descartar</button><button class="btn primary sm" id="pgrd">${icon('check')} Guardar</button></div>` : ''}`;
  bindTabs(v);
  // valores do formulário <-> plano de trabalho (w)
  EMP.filter(e => e.media).forEach(e => { w['ref:' + e.k] = refConta({ entidade: e.k === '—' ? '' : e.k }); });
  w.aumentoSalarialPc = r2((+w.aumentoSalarial || 0) * 100); w.poupancaPc = r2((+w.poupancaPct || 0) * 100);
  w.pagoMesSeguinte = String(!!w.pagoMesSeguinte); w.horizonte = String([60, 120, 240, 360, 480].reduce((a, b) => Math.abs(b - (+w.horizonte || 240)) < Math.abs(a - (+w.horizonte || 240)) ? b : a));
  const fmtOut = { diaSalario: x => 'dia ' + x, aumentoSalarialPc: x => '+' + String(x).replace('.', ',') + '% / ano', emergMeses: x => +x === 0 ? 'sem fundo' : `${x} ${+x === 1 ? 'mês' : 'meses'} · ${eur(desp * x)}`,
    emergProgressivo: x => +x === 0 ? 'o mais depressa possível' : `${x} meses`, poupancaPc: x => x + '%' };
  const rendM = () => est + (+w.outrosRendimentos || 0);
  const preview = () => {
    const pv = (id, val, sub) => { const a = v.querySelector('#pv-' + id), b = v.querySelector('#pv-' + id + '-s'); if (a) a.textContent = val; if (b && sub != null) b.textContent = sub; };
    pv('sal', eur(rendM()));
    const alvo = desp * (+w.emergMeses || 0), ja = w.fundoOrigem === 'manual' ? +w.fundoInicial || 0 : saldoT, falta = Math.max(0, alvo - ja);
    const porMes = falta <= 0 ? 0 : +w.emergProgressivo > 0 ? falta / +w.emergProgressivo : alvo / 12;
    pv('emg', eur(alvo), falta <= 0 ? (alvo ? 'completo' : +w.emergMeses ? 'ainda sem despesas fixas' : 'sem reserva') : `faltam ${eur(falta)} · ${eur(porMes)}/mês`);
    const pc = (+w.poupancaPc || 0) / 100, r = rendM(), k = w.poupancaTipo;
    const pm = k === 'fixed' ? +w.poupancaFixa || 0 : k === 'percentage' ? r * pc : k === 'percentage_surplus' ? Math.max(0, r - desp) * pc : k === 'percentage_after_min_payments' ? Math.max(0, r - desp - prest) * pc : 0;
    pv('poup', eur(pm), k === 'none' ? 'sem poupança separada' : 'estimativa deste mês');
    pv('div', eur(+w.extraFixo || 0));
    v.querySelectorAll('[data-show]').forEach(el => { const [k, vals] = el.dataset.show.split('='); el.style.display = vals.split(',').includes(String(w[k])) ? '' : 'none'; });
  };
  const sujo = () => { const b = v.querySelector('#pbar'); if (b) b.classList.add('on'); };
  v.querySelectorAll('[data-seg]').forEach(g => { const k = g.dataset.seg, marca = () => g.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === String(w[k])));
    marca(); g.querySelectorAll('button').forEach(b => b.onclick = () => { w[k] = b.dataset.v; marca(); preview(); sujo(); }); });
  v.querySelectorAll('[data-k]').forEach(i => { const k = i.dataset.k, out = v.querySelector(`[data-out="${k}"]`);
    if (i.type === 'checkbox') i.checked = !!w[k]; else i.value = w[k] == null || (i.type === 'number' && !+w[k]) ? '' : w[k];
    if (i.type === 'range' && i.value === '') i.value = i.min;
    const upd = () => { w[k] = i.type === 'checkbox' ? i.checked : i.type === 'range' || i.type === 'number' ? +i.value || 0 : i.value; if (out) out.textContent = (fmtOut[k] || String)(w[k]); };
    upd(); i.oninput = () => { upd(); preview(); sujo(); }; i.onchange = i.oninput; });
  preview();
  const pd = v.querySelector('#pdesc'); if (pd) pd.onclick = () => app.refresh();
  const pg = v.querySelector('#pgrd'); if (pg) pg.onclick = () => {
    Object.assign(pl, { emergMeses: +w.emergMeses || 0, emergProgressivo: Math.max(0, +w.emergProgressivo || 0), fundoOrigem: w.fundoOrigem === 'manual' ? 'manual' : 'tesouraria', fundoInicial: r2(+w.fundoInicial || 0),
      poupancaTipo: w.poupancaTipo || 'none', poupancaFixa: r2(+w.poupancaFixa || 0), poupancaPct: (+w.poupancaPc || 0) / 100, extraFixo: r2(+w.extraFixo || 0) });
    audit('PF_PLANO', POUP ? 'Poupanças (fundo de emergência, poupança mensal, amortização extra) alteradas' : 'Parâmetros do plano financeiro alterados'); app.save(); ui.toast(POUP ? 'Poupanças guardadas' : 'Parâmetros guardados', 'ok'); app.refresh(); };
}
/* ---------- Poupanças ----------
   Página de indicadores: quanto se põe de lado por mês, a taxa de poupança, o fundo de emergência e a evolução
   nos próximos 24 meses. As escolhas (fundo, poupança mensal, amortização extra) ajustam-se pelo [+], em modais. */
const cSeg = (k, ops) => `<div class="tabs" data-seg="${k}" style="flex-wrap:wrap;width:max-content;max-width:100%">${ops.map(([val, rot]) => `<button type="button" data-v="${esc(String(val))}">${rot}</button>`).join('')}</div>`;
const cRng = (k, min, max, step) => `<div class="pf-rng"><input type="range" data-k="${k}" min="${min}" max="${max}" step="${step}"><output data-out="${k}"></output></div>`;
const cEur = k => `<span class="pf-eur"><input class="inp num" type="number" step="any" min="0" data-k="${k}" placeholder="0,00"></span>`;
const cRow = (tit, sub, ctl, show = '') => `<div class="pf-row" ${show ? `data-show="${show}"` : ''}><div><b>${tit}</b>${sub ? `<span>${sub}</span>` : ''}</div><div>${ctl}</div></div>`;
function ligarControlos(el, w, fmtOut, depois) {
  const tudo = () => { el.querySelectorAll('[data-show]').forEach(x => { const [k, vals] = x.dataset.show.split('='); x.style.display = vals.split(',').includes(String(w[k])) ? '' : 'none'; }); depois(); };
  el.querySelectorAll('[data-seg]').forEach(g => { const k = g.dataset.seg, marca = () => g.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === String(w[k])));
    marca(); g.querySelectorAll('button').forEach(b => b.onclick = () => { w[k] = b.dataset.v; marca(); tudo(); }); });
  el.querySelectorAll('[data-k]').forEach(i => { const k = i.dataset.k, out = el.querySelector(`[data-out="${k}"]`);
    if (i.type === 'checkbox') i.checked = !!w[k]; else i.value = w[k] == null || (i.type === 'number' && !+w[k]) ? '' : w[k]; if (i.type === 'range' && i.value === '') i.value = i.min;
    const upd = () => { w[k] = i.type === 'checkbox' ? i.checked : i.type === 'range' || i.type === 'number' ? +i.value || 0 : i.value; if (out) out.textContent = (fmtOut[k] || String)(w[k]); };
    upd(); i.oninput = () => { upd(); tudo(); }; });
  tudo();
}
const NOME_POUP = { none: 'Sem poupança separada', fixed: 'Valor fixo', percentage: '% do que ganha', percentage_surplus: '% do que sobra', percentage_after_min_payments: '% do que sobra depois das prestações' };
// projeção a n meses: poupança acumulada e fundo de emergência (mesma regra do simulador: alvo imediato com teto de 1/12 por mês, ou rampa)
function projPoupanca(n = 24) {
  const pl = M().plano, meses = +pl.emergMeses || 0, prog = +pl.emergProgressivo || 0; let f = fundoAtual(), acc = 0;
  return excedentesMes(n).map((x, i) => { acc += x.poup; const alvo = x.desp * meses, alvoE = prog > 0 ? alvo * Math.min(1, (i + 1) / prog) : alvo, teto = prog > 0 ? Infinity : alvo / 12;
    const c = Math.max(0, Math.min(Math.max(0, alvoE - f), Math.max(0, x.exc), teto)); f += c; return { ym: x.ym, poup: x.poup, acc: r2(acc), fundoMes: r2(c), fundo: r2(f), alvo: r2(alvo) }; });
}
function ajustarPoupanca(qual) {
  const pl = M().plano, w = JSON.parse(JSON.stringify(pl)), desp = despesasMensais(), prest = prestacoesMensais(), rend = rendimentoMensal(), saldoT = r2(tesouraria().reduce((t, c) => t + app.saldo(c.id), 0));
  w.poupancaPc = r2((+w.poupancaPct || 0) * 100);
  const cfg = {
    fundo: ['Fundo de emergência', 'Uma reserva para imprevistos (perder o emprego, uma avaria, uma doença).',
      cRow('Reserva', `Em meses das suas despesas fixas (${eur(desp)}/mês).`, cRng('emergMeses', 0, 12, 1)) + cRow('Prazo para lá chegar', 'Sem prazo, junta até 1/12 do alvo por mês.', cRng('emergProgressivo', 0, 60, 3))
      + cRow('Já tem guardado', '', cSeg('fundoOrigem', [['tesouraria', `Saldo das contas · ${eur(saldoT)}`], ['manual', 'Outro valor']])) + cRow('Valor guardado', '', cEur('fundoInicial'), 'fundoOrigem=manual'),
      () => { const alvo = desp * (+w.emergMeses || 0), ja = w.fundoOrigem === 'manual' ? +w.fundoInicial || 0 : saldoT, falta = Math.max(0, alvo - ja);
        return alvo ? `Alvo <b>${eur(alvo)}</b> · ${falta ? `faltam ${eur(falta)} (≈ ${eur(+w.emergProgressivo > 0 ? falta / +w.emergProgressivo : alvo / 12)}/mês)` : 'já completo'}` : 'Sem fundo de emergência.'; },
      () => ({ emergMeses: +w.emergMeses || 0, emergProgressivo: Math.max(0, +w.emergProgressivo || 0), fundoOrigem: w.fundoOrigem === 'manual' ? 'manual' : 'tesouraria', fundoInicial: r2(+w.fundoInicial || 0) })],
    poup: ['Poupança mensal', 'Sai primeiro, antes dos objetivos e da amortização extra.',
      cRow('Pôr de parte todos os meses', '', cSeg('poupancaTipo', [['none', 'Não'], ['fixed', 'Valor fixo'], ['percentage', '% do que ganho'], ['percentage_surplus', '% do que sobra'], ['percentage_after_min_payments', '% após prestações']]))
      + cRow('Valor por mês', '', cEur('poupancaFixa'), 'poupancaTipo=fixed') + cRow('Percentagem', '', cRng('poupancaPc', 0, 50, 1), 'poupancaTipo=percentage,percentage_surplus,percentage_after_min_payments'),
      () => { const pc = (+w.poupancaPc || 0) / 100, k = w.poupancaTipo, pm = k === 'fixed' ? +w.poupancaFixa || 0 : k === 'percentage' ? rend * pc : k === 'percentage_surplus' ? Math.max(0, rend - desp) * pc : k === 'percentage_after_min_payments' ? Math.max(0, rend - desp - prest) * pc : 0;
        return k === 'none' ? 'Não separa poupança todos os meses.' : `≈ <b>${eur(pm)}</b> por mês · <b>${eur(pm * 12)}</b> por ano`; },
      () => ({ poupancaTipo: w.poupancaTipo || 'none', poupancaFixa: r2(+w.poupancaFixa || 0), poupancaPct: (+w.poupancaPc || 0) / 100 })],
    extra: ['Amortização extra', 'Valor a mais por mês para pagar as dívidas, somado ao que sobrar.',
      cRow('Valor extra por mês', 'A ordem de pagamento escolhe-se no Simulador de estratégias.', cEur('extraFixo')),
      () => `<b>${eur(+w.extraFixo || 0)}</b> por mês · ${eur((+w.extraFixo || 0) * 12)} por ano`, () => ({ extraFixo: r2(+w.extraFixo || 0) })] }[qual];
  const fmtOut = { emergMeses: x => +x === 0 ? 'sem fundo' : `${x} ${+x === 1 ? 'mês' : 'meses'} · ${eur(desp * x)}`, emergProgressivo: x => +x === 0 ? 'sem prazo' : `${x} meses`, poupancaPc: x => x + '%' };
  ui.modal({ title: cfg[0], sub: cfg[1], wide: true, body: `${PAR_CSS}<div class="pf-par" style="display:block"><div class="card" style="border:0;background:none">${cfg[2]}</div></div>
      <div class="alert info" style="margin-top:12px">${icon('info')}<div data-res></div></div>`,
    onOpen: el => ligarControlos(el, w, fmtOut, () => { el.querySelector('[data-res]').innerHTML = cfg[3](); }),
    actions: [{ label: 'Cancelar', kind: 'ghost' }, { label: icon('check') + 'Guardar', kind: 'primary', onClick: () => {
      Object.assign(M().plano, cfg[4]()); audit('PF_PLANO', `Poupanças: ${cfg[0]} alterado`); app.save(); ui.toast(`${cfg[0]} guardado`, 'ok'); app.refresh(); } }] });
}
const fmtDia = x => +x ? 'dia ' + x : 'último dia do mês';
const ctlPagamento = k => cSeg('seg:' + k, [['false', 'No próprio mês'], ['true', 'No mês seguinte']]) + `<div style="margin-top:10px">${cRng('dia:' + k, 0, 28, 1)}</div>`;
// como e quando paga cada entidade pagadora, e o subsídio de refeição de cada uma
function configOrdenado() {
  const pl = M().plano, w = {}, EMP = empregosComRefeicao(), fmt = {};
  EMP.forEach(e => { const pe = pagEnt(e.k), I = infoEnt(e.k); w['reg:' + e.k] = I.regime; w['pais:' + e.k] = I.pais; w['seg:' + e.k] = String(pe.seguinte); w['dia:' + e.k] = pe.dia; fmt['dia:' + e.k] = fmtDia; if (e.media) w['ref:' + e.k] = refConta({ entidade: e.k }); });
  const sw = (k, rot) => `<label class="pf-sw"><input type="checkbox" data-k="${esc(k)}"><span>${rot}</span></label>`;
  ui.modal({ title: 'Configurar ordenado', sub: 'Cada entidade pagadora paga à sua maneira: quando entra o dinheiro e como conta o subsídio de refeição.', wide: true,
    body: `${PAR_CSS}<style>.pf-acc>.card-h{cursor:pointer;user-select:none}.pf-acc>.card-h:hover{background:rgba(127,127,127,.06)}.pf-acc .pf-chev{display:inline-block;transition:transform .15s;color:var(--muted);margin-left:10px}
      .pf-acc.on .pf-chev{transform:rotate(90deg)}.pf-acc:not(.on)>.pf-acc-b{display:none}.pf-acc .pf-res{font-size:12px;color:var(--muted)}</style>
      <div class="pf-par" style="display:flex;flex-direction:column;align-items:stretch;gap:10px">${EMP.map(e => `<div class="card pf-acc" data-acc="${esc(e.k)}">
        <div class="card-h"><h3>${icon('wallet')} ${esc(e.nome)}</h3><span style="display:flex;align-items:center;gap:4px;text-align:right"><span><span class="sub">${e.n} ${e.n === 1 ? 'recibo' : 'recibos'} · último ${fmtMes(e.ult)}</span><br><span class="pf-res" data-res></span></span><span class="pf-chev">›</span></span></div>
        <div class="pf-acc-b">
        ${cRow('Regime de trabalho', 'Em Portugal os aumentos seguem as regras do sistema; noutro país detetam-se pelos recibos.', cSeg('reg:' + e.k, REGIMES) + `<div style="margin-top:10px">${cSeg('pais:' + e.k, [['PT', 'Em Portugal'], ['outro', 'Noutro país']])}</div>`)}
        ${cRow('Quando paga', 'Ex.: o recibo de novembro entra em dezembro. E em que dia entra na conta.', ctlPagamento(e.k))}
        ${cRow('Subsídio de refeição', e.media ? `≈ ${eur(e.media)}/mês. O que não contar fica reservado à alimentação.` : '', e.media ? sw('ref:' + e.k, 'Conta como rendimento') : '<span class="faint" style="font-size:13px">Sem subsídio de refeição nos recibos</span>')}</div></div>`).join('')
      || '<div class="empty">Ainda não há recibos de vencimento.</div>'}</div>`,
    onOpen: el => {
      // acordeão: todas fechadas; abrir uma fecha as outras. O resumo de cada entidade fica visível no cabeçalho.
      const resumo = () => el.querySelectorAll('[data-acc]').forEach(c => { const k = EMP.find(e => esc(e.k) === c.dataset.acc).k;
        c.querySelector('[data-res]').textContent = `${nomeRegime(w['reg:' + k])} · ${w['pais:' + k] === 'outro' ? 'outro país' : 'Portugal'} · ${w['seg:' + k] === 'true' ? 'mês seguinte' : 'próprio mês'}, ${fmtDia(w['dia:' + k])}`; });
      el.querySelectorAll('[data-acc]').forEach(c => c.querySelector('.card-h').onclick = () => { const abrir = !c.classList.contains('on'); el.querySelectorAll('[data-acc]').forEach(x => x.classList.remove('on')); if (abrir) c.classList.add('on'); });
      ligarControlos(el, w, fmt, resumo); },
    actions: [{ label: 'Cancelar', kind: 'ghost' }, { label: icon('check') + 'Guardar', kind: 'primary', onClick: () => { const P = M().plano, rr = Object.assign({}, P.refeicaoRend || {}), pg = Object.assign({}, P.pagamentoEnt || {}), ei = Object.assign({}, P.entInfo || {});
      EMP.forEach(e => { ei[e.k] = { regime: w['reg:' + e.k] || 'inteiro', pais: w['pais:' + e.k] === 'outro' ? 'outro' : 'PT' }; pg[e.k] = { seguinte: w['seg:' + e.k] === 'true', dia: Math.min(28, Math.max(0, +w['dia:' + e.k] || 0)) }; if (e.media) rr[e.k] = !!w['ref:' + e.k]; });
      Object.assign(P, { refeicaoRend: rr, pagamentoEnt: pg, entInfo: ei });
      audit('PF_PLANO', 'Configuração do ordenado por entidade pagadora (pagamento e subsídio de refeição)'); app.save(); ui.toast('Configuração guardada', 'ok'); app.refresh(); } }] });
}
function poupancas(v) {
  const pl = M().plano, ed = podeEditar(), desp = despesasMensais(), rend = rendimentoMensal(), P = projPoupanca(24), p0 = P[0] || { poup: 0, fundoMes: 0 };
  const alvo = r2(desp * (+pl.emergMeses || 0)), saldoF = fundoAtual(), fr = alvo > 0 ? Math.min(1, saldoF / alvo) : 0, cobertos = desp > 0 ? saldoF / desp : 0;
  const completo = alvo > 0 ? (saldoF >= alvo ? 'já' : (P.find(x => x.fundo >= x.alvo - 0.5) || {}).ym) : null, extra = +pl.extraFixo || 0;
  const mes = r2(p0.poup + p0.fundoMes + extra), taxa = rend > 0 ? mes / rend : 0, em12 = P[11] || P[P.length - 1] || { acc: 0, fundo: saldoF };
  const ops = [['Fundo de emergência', null, () => ajustarPoupanca('fundo'), null, 'shield', 'Reserva e prazo'], ['Poupança mensal', null, () => ajustarPoupanca('poup'), null, 'target', 'Quanto pôr de parte'], ['Amortização extra', null, () => ajustarPoupanca('extra'), null, 'credit', 'Valor a mais para as dívidas']];
  const taxaCls = taxa >= BENCH.poupBoa ? 'pos' : taxa < BENCH.poupMin ? 'neg' : '';
  const regra = pl.poupancaTipo === 'fixed' ? eur(pl.poupancaFixa) + ' por mês' : pl.poupancaTipo && pl.poupancaTipo !== 'none' ? `${pct(+pl.poupancaPct || 0)} ${NOME_POUP[pl.poupancaTipo].replace('% ', '')}` : 'nenhuma';
  const ajustar = q => ed ? `<button class="btn sm ghost" data-aj="${q}" style="margin-left:auto">${icon('edit')} Ajustar</button>` : '';
  v.innerHTML = `<div class="grid g4">
      ${kpi(`${icon('target')} Poupa este mês`, eur(mes), `poupança ${eur(p0.poup)} · fundo ${eur(p0.fundoMes)} · extra ${eur(extra)}`, '', true, ed ? 'poup' : '')}
      ${kpi('Taxa de poupança', pct(taxa), `do rendimento · recomendado ≥ ${pct(BENCH.poupMin)}, bom ≥ ${pct(BENCH.poupBoa)}`, taxaCls)}
      ${kpi('Fundo de emergência', eur(saldoF), alvo ? `${pct(fr)} de ${eur(alvo)} · ${String(r2(cobertos)).replace('.', ',')} meses cobertos` : +pl.emergMeses && !desp ? 'sem despesas fixas para calcular o alvo' : 'sem alvo definido', fr >= 1 ? 'pos' : '')}
      ${kpi('Daqui a 12 meses', eur(em12.acc + em12.fundo), `poupança ${eur(em12.acc)} + fundo ${eur(em12.fundo)}`)}</div>
    <div class="grid g2" style="margin-top:16px;align-items:stretch">
      <div class="card"><div class="card-h"><h3>${icon('shield')} Fundo de emergência</h3>${ajustar('fundo')}</div>
        ${alvo ? `<div class="row between" style="margin:4px 0 8px"><span class="num" style="font-size:22px;font-weight:700">${eur(saldoF)}</span><span class="muted">de ${eur(alvo)}</span></div>
        <div class="progress" style="height:10px"><i style="width:${r2(fr * 100)}%"></i></div>
        <div class="grid g3" style="margin-top:16px;gap:12px">
          <div><div class="faint" style="font-size:12px">Alvo</div><b>${+pl.emergMeses} ${+pl.emergMeses === 1 ? 'mês' : 'meses'}</b><div class="faint" style="font-size:12px">de despesas fixas</div></div>
          <div><div class="faint" style="font-size:12px">Cobre hoje</div><b>${String(r2(cobertos)).replace('.', ',')} meses</b><div class="faint" style="font-size:12px">sem nenhum rendimento</div></div>
          <div><div class="faint" style="font-size:12px">Completo</div><b>${completo === 'já' ? 'já está' : completo ? fmtMes(completo) : 'não em 24 meses'}</b><div class="faint" style="font-size:12px">${+pl.emergProgressivo ? `prazo de ${pl.emergProgressivo} meses` : 'sem prazo definido'}</div></div></div>
        <div class="faint" style="font-size:12px;margin-top:12px">${pl.fundoOrigem === 'manual' ? 'Valor guardado indicado por si.' : 'Conta o saldo das suas contas de tesouraria.'}</div>`
        : `<div class="empty">${+pl.emergMeses && !desp ? `O alvo é de ${pl.emergMeses} meses de despesas fixas, mas ainda não há <a href="#/despesas">despesas fixas</a> registadas.` : `Sem fundo de emergência definido.${ed ? ' Use Ajustar para escolher quantos meses de despesas quer ter de reserva.' : ''}`}</div>`}</div>
      <div class="card"><div class="card-h"><h3>${icon('target')} Poupança mensal</h3>${ajustar('poup')}</div>
        ${pl.poupancaTipo && pl.poupancaTipo !== 'none' ? `<div class="row between" style="margin:4px 0 8px"><span class="num" style="font-size:22px;font-weight:700">${eur(p0.poup)}</span><span class="muted">este mês</span></div>
        <div class="grid g3" style="margin-top:8px;gap:12px">
          <div><div class="faint" style="font-size:12px">Regra</div><b>${esc(NOME_POUP[pl.poupancaTipo])}</b><div class="faint" style="font-size:12px">${regra}</div></div>
          <div><div class="faint" style="font-size:12px">Em 12 meses</div><b>${eur(em12.acc)}</b><div class="faint" style="font-size:12px">acumulado</div></div>
          <div><div class="faint" style="font-size:12px">Em 24 meses</div><b>${eur((P[P.length - 1] || { acc: 0 }).acc)}</b><div class="faint" style="font-size:12px">acumulado</div></div></div>
        <div class="faint" style="font-size:12px;margin-top:12px">Sai primeiro, antes dos <a href="#/objetivos">objetivos</a> e da amortização extra.</div>`
        : `<div class="empty">Não separa poupança todos os meses.${ed ? ' Use Ajustar para pôr de parte um valor fixo ou uma percentagem.' : ''}</div>`}</div></div>
    <div class="grid g2" style="margin-top:16px;grid-template-columns:2fr 1fr;align-items:stretch">
      <div class="card"><div class="card-h"><h3>Evolução</h3><span class="sub">próximos 24 meses</span></div><div id="chp"></div></div>
      <div class="card"><div class="card-h"><h3>${icon('credit')} Dívidas</h3>${ajustar('extra')}</div>
        <div class="row between" style="margin:4px 0 8px"><span class="num" style="font-size:22px;font-weight:700">${eur(extra)}</span><span class="muted">extra por mês</span></div>
        <div class="faint" style="font-size:12.5px">Além do que sobrar em cada mês. Prestações atuais: ${eur(prestacoesMensais())}/mês.</div>
        <div style="margin-top:14px"><a href="#/simulador">Ver no Simulador de estratégias</a></div></div></div>`;
  if (P.length) chart.linha(v.querySelector('#chp'), { labels: P.map(x => `${MES3[+x.ym.slice(5) - 1]} ${x.ym.slice(2, 4)}`), series: [{ name: 'Fundo de emergência', values: P.map(x => x.fundo) }, { name: 'Poupança acumulada', values: P.map(x => x.acc) }] });
  v.querySelectorAll('[data-add="poup"]').forEach(b => b.onclick = () => escolherAcao(ops, 'Ajustar poupanças'));
  v.querySelectorAll('[data-aj]').forEach(b => b.onclick = () => ajustarPoupanca(b.dataset.aj));
}
function simulador(v) {
  if (tab('pf-sim', 'est') === 'par') setTab('pf-sim', 'est');
  const T = menuQuadrados('pf-sim', 'Simulador', [['est', 'chart', 'Comparar estratégias'], ['plano', 'calendar', 'Plano mês a mês']]), m = M(), kn = app.kn;
  if (!T.t) { v.innerHTML = T.html; bindTabs(v); return; }
  const ds = divAtivas();
  if (!ds.length) { v.innerHTML = `${T.html}<div class="empty">Sem dívidas ativas para simular. Registe-as em <a href="#/dividas">Dívidas e créditos</a>.</div>`; bindTabs(v); return; }
  const R = compararEstrategias(), ks = ['baseline', ...ESTRATEGIAS.map(e => e[0])];
  const melhor = ESTRATEGIAS.map(e => R[e[0]]).sort((a, b) => (a.meses.length - b.meses.length) || (a.juros - b.juros))[0].estrategia;
  let esc1 = tab('pf-estr', melhor); if (!R[esc1]) esc1 = melhor;
  const I = indicadores();
  if (T.t === 'est') {
    const n = Math.max(...ks.map(k => R[k].meses.length)), passo = Math.max(1, Math.ceil(n / 30)), idx = [...Array(n).keys()].filter(i => i % passo === 0 || i === n - 1);
    const lab = idx.map(i => { const t = R.baseline.meses[i] || R[ks.find(k => R[k].meses[i])].meses[i]; return `${MES3[t.m - 1]} ${String(t.y).slice(2)}`; });
    v.innerHTML = `${T.html}<div class="alert info" style="margin-bottom:16px">${icon('target')}<div>Todos os meses: paga as prestações, separa a poupança, o que vai para os <a href="#/objetivos">objetivos</a> e o ${kn('pf_emerg', 'fundo de emergência')}, e usa o resto (${eur(Math.max(0, I.exc))}${+m.plano.extraFixo ? ` + ${eur(m.plano.extraFixo)} fixos` : ''}) para amortizar a dívida escolhida pela estratégia. Ajuste em <a href="#/poupancas">Poupanças</a>.</div></div>
      <div class="grid g4">${ks.map(k => { const r = R[k]; return `<div class="card kpi ${k === melhor ? 'hero' : ''}"><div class="lbl">${k === 'baseline' ? 'Só prestações' : kn('pf_' + k, nomeEstr(k))}${k === melhor ? ' · <b>melhor</b>' : ''}</div>
        <div class="val" style="font-size:20px">${r.livre ? fmtMes(r.livre) : 'além do horizonte'}</div><div class="foot">${r.livre ? r.meses.length + ' meses · ' : ''}juros ${eur(r.juros)}${k !== 'baseline' ? `<br>poupa <b class="pos">${eur(r.poupado)}</b> em juros · comissões ${eur(r.comissoes)}` : ''}</div></div>`; }).join('')}</div>
      <div class="card" style="margin-top:16px"><div class="card-h"><h3>Dívida total ao longo do tempo</h3></div><div id="ch"></div></div>
      <div class="card flush" style="margin-top:16px"><div class="card-h"><h3>Quando fica liquidada cada dívida</h3></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Dívida</th><th class="r">Capital</th><th class="r">Taxa</th>${ks.map(k => `<th>${esc(nomeEstr(k))}</th>`).join('')}</tr></thead><tbody>
      ${ds.map(d => `<tr><td><b>${esc(d.nome)}</b></td><td class="r num">${eur(d.capital)}</td><td class="r num">${pct(d.taxa)}</td>${ks.map(k => `<td>${R[k].fim[d.id] ? fmtMes(R[k].fim[d.id]) : '<span class="faint">—</span>'}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
    chart.linha(v.querySelector('#ch'), { labels: lab, series: ks.map((k, i) => ({ name: nomeEstr(k), dash: k === 'baseline', values: idx.map(j => R[k].meses[j] ? R[k].meses[j].divida : 0) })) });
  } else {
    const r = R[esc1], nomes = Object.fromEntries(ds.map(d => [d.id, d.nome]));
    // um ano de cada vez, escolhido na fita (como os outros seletores de ano)
    const y0 = +ymHoje().slice(0, 4), yMax = r.meses.length ? r.meses[r.meses.length - 1].y : y0;
    let ano = +tab('pf-anoplano', y0); if (!(ano >= y0 - 2 && ano <= Math.max(yMax, y0) + 2)) ano = y0;
    const doAno = r.meses.filter(x => x.y === ano), ed1 = podeEditar();
    const HORIZ = [[60, '5 anos'], [120, '10 anos'], [240, '20 anos'], [360, '30 anos'], [480, '40 anos']], hz0 = +M().plano.horizonte || 240, hz = HORIZ.reduce((a, b) => Math.abs(b[0] - hz0) < Math.abs(a[0] - hz0) ? b : a)[0];
    v.innerHTML = `${T.html}${barraFita(fita('pfpl', [], ano, { atual: y0, unidade: 'ano', sm: true }), `<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px"><div class="row" style="gap:8px;align-items:center;justify-content:flex-end;flex-wrap:wrap"><span class="muted" style="font-size:12px">Simular até</span><div class="tabs" style="width:max-content;max-width:100%;flex-wrap:wrap;margin:0">${HORIZ.map(([n, l]) => `<button type="button" data-hz="${n}" class="${n === hz ? 'on' : ''}" ${ed1 ? '' : 'disabled'}>${l}</button>`).join('')}</div></div>
      <span class="muted" style="font-size:12px;text-align:right">${r.livre ? 'livre de dívidas em ' + fmtMes(r.livre) : 'não fica liquidado em ' + HORIZ.find(x => x[0] === hz)[1]}</span></div>`, `<div class="tabs" style="width:max-content;max-width:100%;flex-wrap:wrap">${ESTRATEGIAS.map(([k, l]) => `<button type="button" data-es="${k}" class="${k === esc1 ? 'on' : ''}" ${k === melhor ? 'title="A melhor estratégia para si"' : ''}>${l}${k === melhor ? ' ★' : ''}</button>`).join('')}</div>`)}
      <div class="card flush"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Mês</th><th class="r">Rendimento</th><th class="r">Despesas</th><th class="r">Prestações</th><th class="r">Poupança</th><th class="r">Objetivos</th><th class="r">Fundo emerg.</th><th class="r">Amortização extra</th><th>Dívida-alvo</th><th class="r">Juros</th><th class="r">Dívida total</th></tr></thead><tbody>
      ${doAno.map(x => `<tr><td><b>${MES3[x.m - 1]} ${x.y}</b></td><td class="r num">${eur(x.rendimento)}</td><td class="r num">${eur(x.despesas)}</td><td class="r num">${eur(x.prestacoes)}</td><td class="r num">${eur(x.poupanca)}</td>
        <td class="r num"${x.nomesObj.length ? ` data-tip="${esc(x.nomesObj.join(', '))}"` : ''}>${eur(x.objetivos)}${x.amortObjetivos > 0.005 ? `<div class="faint" style="font-size:11px">amortiza ${eur(x.amortObjetivos)}</div>` : ''}</td>
        <td class="r num">${eur(x.emergencia)}<div class="faint" style="font-size:11px">${eur(x.emergenciaSaldo)} / ${eur(x.emergenciaAlvo)}</div></td><td class="r num">${eur(x.extra + x.comissoes)}</td>
        <td style="font-size:12px">${Object.entries(x.porDiv).map(([id, val]) => `${esc(nomes[id] || id)} <span class="num">${eur(val)}</span>`).join('<br>') || '<span class="faint">—</span>'}</td><td class="r num">${eur(x.juros)}</td><td class="r num"><b>${eur(x.divida)}</b></td></tr>`).join('') || `<tr><td colspan="11" class="empty">${ano < y0 ? 'O plano começa no mês atual.' : r.livre ? `Livre de dívidas em ${fmtMes(r.livre)}: o plano termina aí.` : 'Fora do horizonte do plano.'}</td></tr>`}</tbody></table></div></div>`;
    ligarFita(v, 'pfpl', y => { setTab('pf-anoplano', y); app.refresh(); });
    v.querySelectorAll('[data-hz]').forEach(b => b.onclick = () => { const n = +b.dataset.hz; if (n === hz || !ed1) return; M().plano.horizonte = n;
      audit('PF_PLANO', `Horizonte da simulação: ${HORIZ.find(x => x[0] === n)[1]}`); app.save(); app.refresh(); });
    v.querySelectorAll('[data-es]').forEach(b => b.onclick = () => { if (b.dataset.es !== esc1) { setTab('pf-estr', b.dataset.es); app.refresh(); } });
  }
  bindTabs(v);
}

/* ---------- Objetivos e compras ---------- */
function excedentesMes(n = 120) {
  const ds = divAtivas(), fim = ds.map(d => mesesParaLiquidar(d)), proj = {}, P = a => proj[a] || (proj[a] = projecao(a));
  // cartões: a prestação é uma % do saldo (com mínimo), por isso desce à medida que se paga; a deste mês é a do último extrato
  const cart = ds.map(d => { if (d.tipo !== 'cartao' || d.cartaoDe) return null; const pc = pctCartao(d).pct;
    return pc > 0 && pc <= 1 ? { pct: pc, r: taxaMensal(d), min: d.minimoCartao == null ? 25 : +d.minimoCartao, saldo: +d.capital || 0 } : null; });
  const prestDe = (d, k, i) => { const c = cart[k]; if (!c) return i < fim[k] ? +d.prestacao || 0 : 0;
    if (c.saldo <= 0.005) return 0; const sj = c.saldo * (1 + c.r), p = i === 0 ? Math.min(sj, +d.prestacao || 0) : Math.min(sj, Math.max(c.min, c.pct * c.saldo)); c.saldo = Math.max(0, sj - p); return p; };
  const y0 = +ymHoje().slice(0, 4), m0 = +ymHoje().slice(5, 7), out = [];
  for (let i = 0; i < n; i++) { const t = m0 - 1 + i, y = y0 + Math.floor(t / 12), mm = t % 12 + 1, ym = ymOf(y, mm);
    const rend = rendimentoDoMes(y, mm, P), desp = r2(despesasMensais(ym) - refeicaoCobre(ym, P)), prest = r2(ds.reduce((a, d, k) => a + prestDe(d, k, i), 0));
    // a poupança mensal do plano (Simulador › Parâmetros) sai primeiro, como um objetivo fixo, para não usar o mesmo dinheiro duas vezes
    const sobra = rend - desp - prest, poup = r2(Math.min(Math.max(0, sobra), Math.max(0, poupancaMes(rend, desp, prest))));
    out.push({ ym, rend, desp, prest, poup, exc: r2(sobra - poup) }); }
  return out;
}
function poupancaMes(rend, desp, prest) {
  const pl = M().plano, k = pl.poupancaTipo, pc = +pl.poupancaPct || 0;
  return k === 'fixed' ? +pl.poupancaFixa || 0 : k === 'percentage' ? rend * pc : k === 'percentage_surplus' ? Math.max(0, rend - desp) * pc
    : k === 'percentage_after_min_payments' ? Math.max(0, rend - desp - prest) * pc : 0;
}
/* Categoria: com a mesma prioridade, passa à frente o que protege (fundo de emergência) e o que poupa juros (dívidas, as mais caras primeiro);
   férias e compras ficam para o fim. O peso é sempre menor que um nível de prioridade, por isso a prioridade manda. */
const CATS_OBJ = [['emergencia', 'Fundo de emergência', -0.4], ['dividas', 'Pagamento de dívidas', -0.3], ['saude', 'Saúde', -0.2], ['habitacao', 'Habitação', -0.1],
  ['educacao', 'Educação', 0], ['outro', 'Outro', 0.1], ['compras', 'Compras', 0.2], ['ferias', 'Férias e lazer', 0.3]];
const catDe = o => o.categoria || (/f[ée]rias|viagem|zool|passeio/i.test(o.nome || '') ? 'ferias' : 'outro');
const nomeCat = k => (CATS_OBJ.find(c => c[0] === k) || [0, 'Outro'])[1];
const dividaDe = o => o && o.divida ? M().dividas.find(d => d.id === o.divida && d.ativo !== false) || null : null;
const pesoCat = o => { const k = catDe(o), c = CATS_OBJ.find(x => x[0] === k) || CATS_OBJ[5], d = k === 'dividas' ? dividaDe(o) : null; return c[2] - (d ? Math.min(0.09, (+d.taxa || 0) * 0.5) : 0); };
const OPTS_PRIO = [[1, '1 · Máxima'], [2, '2 · Alta'], [3, '3 · Média'], [4, '4 · Baixa'], [5, '5 · Mínima']];
const COLS_OBJ = () => [{ k: 'nome', label: 'Objetivo', ph: 'ex.: Entrada para casa' }, { k: 'categoria', label: 'Categoria', type: 'select', opts: CATS_OBJ.map(c => [c[0], c[1]]) },
  { k: 'divida', label: 'Dívida a amortizar', type: 'select', hint: 'Só para «Pagamento de dívidas». Com o valor necessário a 0, usa o capital em dívida.',
    opts: [['', '—'], ...divAtivas().filter(d => !d.cartaoDe).sort((a, b) => (+b.taxa || 0) - (+a.taxa || 0)).map(d => [d.id, `${d.nome} · ${eur(d.capital)} · TAN ${pct(d.taxa)}`])] },
  { k: 'alvo', label: 'Valor necessário', type: 'money' }, { k: 'poupado', label: 'Já poupado', type: 'money' },
  { k: 'data', label: 'Data pretendida', type: 'date' }, { k: 'prioridade', label: 'Prioridade', type: 'select', opts: OPTS_PRIO }, { k: 'notas', label: 'Notas' }];
// objetivos partilhados (no livro de partilhas): cada um tem a sua parte do valor e regista as suas contribuições
function objPartilhados() {
  const L = ligacaoCasa(); if (!L) return []; const R = CC().registo(L.casa);
  return (R.objetivos || []).filter(o => !o.arquivado && +((o.partes || {})[L.eu]) > 0).map(o => {
    const cs = (o.contribuicoes || []).filter(c => !c.anulada), parte = +o.partes[L.eu];
    return { o, cs, L, R, parte, total: sum(cs, 'valor'), meuAlvo: r2((+o.alvo || 0) * parte), meu: sum(cs.filter(c => c.membro === L.eu), 'valor') };
  });
}
function novoObjPartilhado(o0) {
  const pessoas = pessoasGrupo(); if (!pessoas.length) { ui.toast('Não há outros planos pessoais no grupo com quem partilhar.', 'warn'); return; }
  const L = ligacaoCasa(); if (L && !(CC().livro(L.casa) || {}).partilha) { ui.toast('Este plano ainda está ligado a uma casa antiga. Peça a migração para partilhas.', 'bad'); return; }
  const v0 = o0 || {}; ui.modal({ title: o0 ? 'Partilhar · ' + esc(o0.nome) : 'Novo objetivo partilhado', wide: true, sub: 'A outra pessoa recebe o pedido na Caixa de entrada. O objetivo começa quando ela aceitar.',
    body: `<form class="form"><div class="fld"><label>Partilhar com</label><select class="inp" name="com">${pessoas.map(x => `<option value="${x.key}">${esc(semPessoal(x.nome))}</option>`).join('')}</select></div>
      <div class="fld"><label>Objetivo</label><input class="inp" name="nome" value="${esc(v0.nome || '')}" placeholder="ex.: Férias, sofá novo, caução da casa"></div>
      <div class="fld"><label>Categoria</label><select class="inp" name="categoria">${CATS_OBJ.filter(c => c[0] !== 'dividas').map(c => `<option value="${c[0]}" ${c[0] === (v0.nome != null ? catDe(v0) : 'outro') ? 'selected' : ''}>${c[1]}</option>`).join('')}</select></div>
      <div class="fld"><label>Valor total necessário (€)</label><input class="inp num" type="number" step="any" name="alvo" value="${esc(v0.alvo || '')}"><span class="hint">O valor total, dos dois.</span></div>
      <div class="fld"><label>Data pretendida</label><input class="inp" type="date" name="data" value="${esc(v0.data || SPAP.addMonths(today(), 12))}"></div>
      <div class="fld"><label>A minha parte (%)</label><input class="inp num" type="number" step="any" min="0" max="100" name="minha" value="50"><span class="hint">Cada um junta a sua parte do valor total.</span></div>
      <div class="fld"><label>Eu já tenho poupado (€)</label><input class="inp num" type="number" step="any" name="inicial" value="${esc(+v0.poupado || 0)}"><span class="hint">Opcional. Conta como a sua primeira contribuição.</span></div>
      <div class="fld"><label>Prioridade (no meu plano)</label><select class="inp" name="prioridade">${[[1, '1 · Máxima'], [2, '2 · Alta'], [3, '3 · Média'], [4, '4 · Baixa'], [5, '5 · Mínima']].map(([k, l]) => `<option value="${k}" ${k === (+v0.prioridade || 3) ? 'selected' : ''}>${l}</option>`).join('')}</select></div></form>`,
    actions: [{ label: 'Cancelar', kind: 'ghost' }, { label: icon('key') + 'Assinar e enviar', kind: 'primary', onClick: el => { const f = ui.formData(el);
      if (!f.nome) { ui.toast('Indique o objetivo', 'warn'); return false; } if (!(+f.alvo > 0)) { ui.toast('Indique o valor necessário', 'warn'); return false; }
      if (!(+f.minha > 0 && +f.minha < 100)) { ui.toast('A sua parte tem de estar entre 0% e 100%', 'warn'); return false; }
      setTimeout(async () => { if (await enviarObjPartilhado(f, o0)) app.refresh(); }, 0); } }] });
}
async function enviarObjPartilhado(f, o0) {
  const alvo = pessoasGrupo().find(x => x.key === f.com); if (!alvo) return false;
  const minha = r2(+f.minha) / 100, outroNome = semPessoal(alvo.nome), inicial = Math.max(0, r2(+f.inicial || 0));
  const s = await app.assinar('Propor objetivo partilhado', `<b>${esc(f.nome)}</b> · ${eur(+f.alvo)}${f.data ? ' até ' + date(f.data) : ''} com <b>${esc(outroNome)}</b><br>A sua parte: <b>${pct(minha)}</b> (${eur(+f.alvo * minha)})${inicial ? ` · já poupado: ${eur(inicial)}` : ''}<br><span style="font-size:12px">${esc(outroNome)} recebe o pedido na Caixa de entrada.</span>`);
  if (!s) return false;
  const { casa, eu, outro } = livroCom(alvo);
  const objetivo = { id: 'J' + uid(), nome: f.nome.trim(), categoria: f.categoria || 'outro', alvo: r2(+f.alvo), data: f.data || '', prioridade: +f.prioridade || 3, inicial, partes: { [eu]: minha, [outro]: r2((1 - minha) * 10000) / 10000 } };
  const c = { id: 'Cv' + uid(), tipo: 'objetivo', de: eu, para: outro, deSistema: sub.key, paraSistema: alvo.key, deNome: app.user.nome, paraNome: outroNome, objetivo, estado: 'pendente', criadoEm: new Date().toISOString() };
  c.proposta = { user: app.user.id, nome: app.user.nome, assinatura: await s.signer.texto('PROPOR_PARTILHA', textoConviteObj(casa, c)) };
  CC().alterar(casa, r => { r.convites = r.convites || []; r.convites.push(c); });
  if (o0) o0.partilha = { casa, convite: c.id };   // depois de aceite, passa a contar só a versão partilhada
  audit('PF_OBJETIVO_PARTILHA_PROPOSTA', `${objetivo.nome} · ${eur(objetivo.alvo)} com ${outroNome} · minha parte ${pct(minha)}`); app.save();
  ui.toast(`Pedido enviado a ${outroNome.split(' ')[0]}`, 'ok'); return true;
}
function contribuirObj(x) {
  ui.modal({ title: 'Pôr de lado · ' + esc(x.o.nome), sub: 'Registe o que juntou para este objetivo. Quem partilha consigo vê o progresso.', body: `<form class="form">
      <div class="fld"><label>Valor (€)</label><input class="inp num" type="number" step="any" name="valor" value="${x.mensal || ''}"></div>
      <div class="fld"><label>Data</label><input class="inp" type="date" name="data" max="${today()}" value="${today()}"></div>
      <div class="fld full"><label>Descrição</label><input class="inp" name="descricao" placeholder="opcional"></div></form>`,
    actions: [{ label: 'Cancelar', kind: 'ghost' }, { label: icon('key') + 'Assinar e registar', kind: 'primary', onClick: el => { const f = ui.formData(el);
      if (!(+f.valor > 0)) { ui.toast('Indique o valor', 'warn'); return false; }
      setTimeout(async () => { const s = await app.assinar('Contribuição para objetivo', `<b>${esc(x.o.nome)}</b> · ${date(f.data || today())} · <b>${eur(+f.valor)}</b>`); if (!s) return;
        const c = { id: 'Ct' + uid(), membro: x.L.eu, valor: r2(+f.valor), data: f.data || today(), descricao: f.descricao || '', sistema: sub.key, criadoEm: new Date().toISOString() };
        c.registo = { user: app.user.id, nome: app.user.nome, assinatura: await s.signer.texto('CONTRIBUIR_OBJETIVO', textoContrib(x.L.casa, x.o, c)) };
        CC().alterar(x.L.casa, r => { const o = (r.objetivos || []).find(y => y.id === x.o.id); if (o) { o.contribuicoes = o.contribuicoes || []; o.contribuicoes.push(c); } });
        audit('PF_OBJETIVO_CONTRIBUICAO', `${x.o.nome} · ${eur(c.valor)}`); app.save(); ui.toast('Contribuição registada', 'ok'); app.refresh(); }, 0); } }] });
}
function verObjPartilhado(x) {
  const nm = id => semPessoal(nomeMembro(x.L.casa, id)).split(' ')[0], ms = x.R.membros || [], ed = podeEditar();
  ui.modal({ title: 'Objetivo partilhado · ' + esc(x.o.nome), wide: true, sub: 'As alterações valem para todos e ficam registadas com o seu nome.', body: `
    <div class="tbl-wrap" style="margin-bottom:16px"><table class="tbl"><thead><tr><th>Data</th><th>Quem</th><th>Descrição</th><th class="r">Valor</th><th></th></tr></thead><tbody>
      ${x.cs.slice().sort((a, b) => String(b.data).localeCompare(String(a.data))).map(c => `<tr><td>${date(c.data)}</td><td>${esc(nm(c.membro))}</td><td>${esc(c.descricao || '')}</td><td class="r num">${eur(c.valor)}</td>
        <td class="r">${ed && c.membro === x.L.eu && !c.inicial ? `<button class="btn sm ghost" data-an="${c.id}">Anular</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">Ainda sem contribuições.</td></tr>'}</tbody></table></div>
    ${ed ? `<form class="form"><div class="fld"><label>Objetivo</label><input class="inp" name="nome" value="${esc(x.o.nome)}"></div>
      <div class="fld"><label>Categoria</label><select class="inp" name="categoria">${CATS_OBJ.filter(c => c[0] !== 'dividas').map(c => `<option value="${c[0]}" ${c[0] === catDe(x.o) ? 'selected' : ''}>${c[1]}</option>`).join('')}</select></div>
      <div class="fld"><label>Valor total necessário (€)</label><input class="inp num" type="number" step="any" name="alvo" value="${esc(x.o.alvo)}"></div>
      <div class="fld"><label>Data pretendida</label><input class="inp" type="date" name="data" value="${esc(x.o.data || '')}"></div>
      <div class="fld full"><label>Parte de cada um (%)</label><div class="row" style="gap:12px;flex-wrap:wrap">${ms.filter(m => (x.o.partes || {})[m.id] != null).map(m => `<label style="display:flex;gap:6px;align-items:center">${esc(nm(m.id))} <input class="inp inp-sm num" type="number" step="any" min="0" max="100" data-parte="${m.id}" value="${r2((+x.o.partes[m.id] || 0) * 100)}" style="width:80px"></label>`).join('')}</div></div>
      <div class="fld"><label>&nbsp;</label><label class="check"><input type="checkbox" name="arquivar"> Terminar (atingido ou desistiram)</label></div></form>` : ''}`,
    actions: ed ? [{ label: 'Fechar', kind: 'ghost' }, { label: 'Guardar', kind: 'primary', onClick: el => {
      const f = ui.formData(el), partes = {}; el.querySelectorAll('[data-parte]').forEach(i => { partes[i.dataset.parte] = r2((+i.value || 0) / 100 * 10000) / 10000; });
      const soma = Object.values(partes).reduce((a, b) => a + b, 0); if (Math.abs(soma - 1) > 0.0001) { ui.toast(`As partes somam ${pct(soma)}: devem somar 100%`, 'warn'); return false; }
      if (!f.nome || !(+f.alvo > 0)) { ui.toast('Indique o objetivo e o valor', 'warn'); return false; }
      CC().alterar(x.L.casa, r => { const o = (r.objetivos || []).find(y => y.id === x.o.id); if (!o) return;
        Object.assign(o, { nome: f.nome, categoria: f.categoria || o.categoria || 'outro', alvo: r2(+f.alvo), data: f.data || '', partes, alteradoPor: app.user.nome, alteradoEm: new Date().toISOString() });
        if (f.arquivar) Object.assign(o, { arquivado: true, arquivadoPor: app.user.nome, arquivadoEm: new Date().toISOString() }); });
      audit('PF_OBJETIVO_PARTILHA_ALTERADO', `${f.nome} · ${eur(+f.alvo)}${f.arquivar ? ' · terminado' : ''}`); app.save(); app.refresh(); } }] : [{ label: 'Fechar', kind: 'ghost' }],
    onOpen: (el, fechar) => el.querySelectorAll('[data-an]').forEach(b => b.onclick = async () => { const c = x.cs.find(y => y.id === b.dataset.an); if (!c) return; fechar();
      const s = await app.assinar('Anular contribuição', `${esc(x.o.nome)} · ${date(c.data)} · <b>${eur(c.valor)}</b>`); if (!s) return;
      const an = { user: app.user.id, nome: app.user.nome, em: new Date().toISOString(), assinatura: await s.signer.texto('ANULAR_CONTRIBUICAO', textoContrib(x.L.casa, x.o, c)) };
      CC().alterar(x.L.casa, r => { const o = (r.objetivos || []).find(y => y.id === x.o.id); const y = o && (o.contribuicoes || []).find(z => z.id === c.id); if (y && y.membro === x.L.eu) Object.assign(y, { anulada: true, anulacao: an }); });
      audit('PF_OBJETIVO_CONTRIBUICAO_ANULADA', `${x.o.nome} · ${eur(c.valor)}`); app.save(); app.refresh(); }) });
}
/* Sugestões da página Objetivos:
   1) meses negativos: guardar parte da sobra dos meses anteriores e/ou amortizar a dívida cuja prestação mais desce por cada euro;
   2) objetivo que só tem dinheiro depois da data: pagar com o cartão mais barato com disponível, comprando depois do fecho do extrato
      e devolvendo o valor ao cartão antes do extrato seguinte (ou pagando esse extrato por inteiro). */
const dias = (a, b) => Math.max(0, Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5));
const comDia = (ym, d) => `${ym}-${String(Math.min(28, Math.max(1, d || 1))).padStart(2, '0')}`;
function cartoesDisponiveis() {
  return divAtivas().filter(d => d.tipo === 'cartao' && !d.cartaoDe && d.contaCartao).map(d => {
    const ux = M().extratos.filter(e => e.conta === d.contaCartao).sort((a, b) => String(b.data).localeCompare(String(a.data)))[0];
    if (!ux || !(+ux.limite > 0)) return null;
    const decl = ux.declarado ? +ux.declarado.valor || 0 : 0, porPagar = !decl && ux.dataLimite && ux.dataLimite < today() ? +ux.pagar || 0 : 0;
    const base = (+ux.limite || 0) - (+ux.saldo || 0) + decl;
    return { d, ux, disp: r2(Math.max(0, base)), dispSePago: r2(Math.max(0, base + porPagar)), porPagar, diaExt: +String(ux.data).slice(8, 10), diaLim: +String(ux.dataLimite || '').slice(8, 10) || +d.dia || 5, taxa: +d.taxa || +ux.tan || 0 };
  }).filter(Boolean).sort((a, b) => a.taxa - b.taxa);
}
// dívidas por ordem de "quanto desce a prestação por cada euro amortizado"
function alavancas() {
  return divAtivas().filter(d => !d.cartaoDe && +d.prestacao > 0).map(d => { const cartao = d.tipo === 'cartao', pc = cartao ? pctCartao(d).pct : null;
    return { d, cartao, ratio: cartao && pc > 0 && pc <= 1 ? pc : Math.min(1, +d.prestacao / +d.capital) }; })
    .sort((a, b) => b.ratio - a.ratio || (+b.d.taxa || 0) - (+a.d.taxa || 0));
}
const semTags = h => String(h || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const dica = h => `<span class="info-tip" tabindex="0" role="note" aria-label="${esc(semTags(h))}" data-tip="${esc(semTags(h))}">i</span>`;
const mesCurto = ym => `${MESES[+ym.slice(5, 7) - 1].slice(0, 3)} ${ym.slice(2, 4)}`;
function sugestoesObjetivos(CF, lista, idx, pool) {
  const out = [], H = Math.min(13, CF.length), gasto = CF.map(() => 0);
  lista.forEach(x => { if (x.falta <= 0 || !x.n) return; const k = x.estado[1] === 'no bom caminho' ? x.ate : x.quando ? CF.findIndex(c => c.ym === x.quando) : -1; if (k >= 0) gasto[k] += x.falta; });
  const objDiv = lista.find(x => x.div && x.falta > 0), AL0 = alavancas(), AL = objDiv ? [AL0.find(a => a.d.id === objDiv.div.id), ...AL0].filter(Boolean) : AL0, periodo = (a, b) => a === b ? fmtMes(a) : `${fmtMes(a)} a ${fmtMes(b)}`;
  const notaAmort = (al, A) => al.cartao ? `Faça-o logo que o dinheiro entre e antes do fecho do extrato, para a prestação seguinte já descer.`
    : `Peça ao credor para <b>reduzir a prestação</b> (e não o prazo)${+al.d.comissao > 0 ? `; a comissão de amortização ronda ${eur(A * al.d.comissao)}` : ''}.`;
  // 1) períodos de meses negativos (a partir do próximo mês)
  for (let i = 1, ini = 1; i < H;) {
    if (CF[i].exc >= 0) { i++; continue; }
    let j = i; while (j + 1 < H && CF[j + 1].exc < 0) j++;
    const run = CF.slice(i, j + 1), defs = run.map(c => -c.exc), def = r2(defs.reduce((a, b) => a + b, 0));
    const fontes = CF.slice(ini, i).filter(c => c.exc > 0), livre = r2(CF.slice(ini, j + 1).reduce((a, c, t) => a + c.exc - gasto[ini + t], 0) + def);
    const nomeF = fontes.length ? periodo(fontes[0].ym, fontes[fontes.length - 1].ym) : '', per = periodo(run[0].ym, run[run.length - 1].ym);
    const lista1 = run.map(c => `${MESES[+c.ym.slice(5, 7) - 1].toLowerCase()} ${eur(c.exc)}`).join(', ');
    if (!fontes.length || livre <= 0.5) out.push(['bad', 'alert', `${per} fecham negativos (${lista1}; ${eur(def)} no total) e antes disso não sobra nada${fontes.length ? ' depois dos objetivos' : ''}. Considere adiar objetivos ou rever despesas fixas.`, `${per}: faltam ${eur(def)} e não há sobra antes`]);
    else if (livre >= def - 0.005) {
      const resto = r2(livre - def), al = AL[0];
      out.push(['ok', 'shield', `<b>Guarde ${eur(def)}</b> do que sobra em ${nomeF} para cobrir <b>${per}</b> (${lista1}).`
        + (resto > 5 && al ? ` Sobram ainda ${eur(resto)} depois dos objetivos: amortizar <b>${esc(al.d.nome)}</b>${al.cartao ? ` (a prestação é ${pct(al.ratio)} do saldo)` : ''} baixa a prestação em cerca de <b>${eur(resto * al.ratio)}/mês</b>${+al.d.taxa ? ` e poupa juros a ${pct(al.d.taxa)}` : ''}. ${notaAmort(al, resto)}` : ''), `Guarde ${eur(def)} de ${nomeF} para cobrir ${per}`]);
    } else {
      const al = AL[0], g = A => defs.reduce((t, x) => t + Math.max(0, x - (al ? al.ratio : 0) * A), 0) - (livre - A);
      let best = 0, gb = g(0); const max = al ? Math.min(livre, +al.d.capital) : 0;
      for (let t = 1; t <= 200; t++) { const A = max * t / 200, v = g(A); if (v < gb - 0.005) { gb = v; best = A; } }
      out.push(best > 1 ? ['warn', 'shield', `<b>${per}</b> fecham negativos (${lista1}) e em ${nomeF} só sobram ${eur(livre)} depois dos objetivos. Melhor combinação:
          amortizar <b>${eur(best)}</b> em <b>${esc(al.d.nome)}</b> (a prestação desce cerca de ${eur(best * al.ratio)}/mês) e guardar <b>${eur(livre - best)}</b>. ${notaAmort(al, best)}${gb > 0.5 ? ` Ainda ficam a faltar ${eur(gb)}.` : ''}`, `Amortize ${eur(best)} em ${esc(al.d.nome)} e guarde ${eur(livre - best)} para ${per}`]
        : ['warn', 'shield', `<b>${per}</b> fecham negativos (${lista1}; ${eur(def)}). Guarde os ${eur(livre)} que sobram em ${nomeF}: ainda ficam a faltar ${eur(def - livre)}.`, `Guarde ${eur(livre)} de ${nomeF} para ${per} (faltam ${eur(def - livre)})`]);
    }
    ini = j + 1; i = j + 1;
  }
  // 1b) sobra dos próximos 12 meses que nenhum objetivo usa: pô-la a amortizar a dívida mais cara (se ainda não houver objetivo para ela)
  { const k12 = Math.min(11, CF.length - 1), reservado = lista.reduce((t, x) => t + (x.falta > 0 && x.quando && x.quando <= CF[k12].ym ? x.falta : 0), 0), livre = r2(pool[k12] - reservado);
    const cara = alavancas().filter(a => !lista.some(x => x.div && x.div.id === a.d.id)).sort((a, b) => (+b.d.taxa || 0) - (+a.d.taxa || 0))[0];
    // primeiro: os planos de amortização que já existem e que a sobra permite fazer mais cedo
    const antecipar = lista.filter(x => x.tipo === 'meu' && x.div && x.falta > 0 && x.estado[1] === 'no bom caminho' && !x.ajuste && x.quando && x.quando < String(x.data).slice(0, 7));
    antecipar.forEach(x => out.push(['info', 'credit', `O seu plano <b>${esc(x.nome)}</b> já fica coberto em <b>${fmtMes(x.quando)}</b>, antes da data que escolheu (${date(x.data)}). Amortizar mais cedo faz a prestação descer mais cedo${x.alivio ? ` (cerca de ${eur(x.alivio.red)}/mês)` : ''} e poupa juros de ${pct(x.div.taxa)} nesses meses, sem tirar dinheiro aos outros objetivos.`, `Pode antecipar ${esc(x.nome)} para ${fmtMes(x.quando)}`,
      podeEditar() ? `<button class="btn sm primary" data-ant="${x.o.id}" data-ym="${x.quando}">${icon('check')} Antecipar</button>` : '', `ant:${x.o.id}:${x.quando}`]));
    // depois: se ainda sobrar, a dívida mais cara que ainda não tem plano
    const comPlano = lista.filter(x => x.div && x.falta > 0);
    if (!antecipar.length && livre > 50 && cara && +cara.d.taxa >= 0.05) { const v = r2(Math.min(livre, +cara.d.capital || 0));
      const resAte = i => lista.reduce((t, x) => t + (x.falta > 0 && x.quando && x.quando <= CF[i].ym ? x.falta : 0), 0);
      let t0 = k12; while (t0 > 0 && pool[t0 - 1] - resAte(t0 - 1) >= v - 0.005) t0--; const desde = CF[t0].ym;
      out.push(['info', 'credit', `${comPlano.length ? `Mesmo com ${comPlano.map(x => `<b>${esc(x.nome)}</b>`).join(' e ')}, nos próximos 12 meses ainda sobram` : 'Nos próximos 12 meses sobram'} cerca de <b>${eur(livre)}</b> que nenhum objetivo usa. ${comPlano.length ? 'Pode juntar um segundo plano: amortizar' : 'Amortizar'} <b>${esc(cara.d.nome)}</b> (a dívida mais cara, TAN ${pct(cara.d.taxa)}) com ${eur(v)} poupa cerca de ${eur(v * cara.d.taxa)}/ano em juros e baixa a prestação em cerca de ${eur(Math.min(+cara.d.prestacao || 0, v * cara.ratio))}/mês.${comPlano.length ? ` Este seria um plano novo, além de ${comPlano.map(x => esc(x.nome)).join(' e ')}, que fica como está.` : ''} O dinheiro só está livre a partir de ${fmtMes(desde)}.`,
        comPlano.length ? `Além do plano atual, pode criar um 2.º plano: ${esc(cara.d.nome)} (${eur(v)} a partir de ${mesCurto(desde)})` : `Sobram ${eur(livre)} em 12 meses: amortize ${esc(cara.d.nome)} a partir de ${mesCurto(desde)}`,
        podeEditar() ? `<button class="btn sm primary" data-sa="${cara.d.id}" data-v="${v}" data-ym="${desde}">${icon('plus')} Criar plano</button>` : '', `sa:${cara.d.id}`]); } }
  // 1c) categoria: um objetivo de férias/compras coberto à frente de um de emergência/dívidas que fica por cobrir
  lista.forEach(y => { if (!['emergencia', 'dividas'].includes(y.cat) || y.falta <= 0 || y.estado[0] === 'ok') return;
    const x = lista.find(z => ['ferias', 'compras'].includes(z.cat) && z.ordem < y.ordem && z.falta > 0 && z.estado[0] === 'ok' && z.prioridade < y.prioridade);
    if (x) out.push(['warn', 'alert', `<b>${esc(x.nome)}</b> (${esc(nomeCat(x.cat).toLowerCase())}) está coberto e passa à frente de <b>${esc(y.nome)}</b> (${esc(nomeCat(y.cat).toLowerCase())}) só por ter prioridade mais alta (${x.prioridade} contra ${y.prioridade}). Se lhes der a mesma prioridade, a categoria põe ${esc(y.nome)} primeiro.`, `${esc(y.nome)} devia vir antes de ${esc(x.nome)}`]); });
  // 2) objetivos com data antes de haver dinheiro: cartão de crédito como ponte
  const CT = cartoesDisponiveis();
  lista.filter(x => !['emergencia', 'dividas'].includes(x.cat) && x.estado[0] === 'warn' && x.quando && x.data && x.falta > 0 && x.quando > String(x.data).slice(0, 7)).forEach(x => {
    const c = CT.find(k => k.dispSePago >= x.falta - 0.005), g = String(x.data).slice(0, 10);
    if (!CT.length) return;
    if (!c) { out.push(['warn', 'credit', `<b>${esc(x.nome)}</b> (${eur(x.falta)} até ${date(g)}): só há dinheiro em ${fmtMes(x.quando)} e nenhum cartão tem disponível suficiente (${CT.map(k => `${esc(k.d.nome)} ≈ ${eur(k.dispSePago)}`).join(', ')}). Pense em mudar a data.`, `${esc(x.nome)}: nenhum cartão tem disponível suficiente`]); return; }
    let ext = comDia(g.slice(0, 7), c.diaExt); if (ext <= g) ext = comDia(SPAP.addMonths(g.slice(0, 7) + '-01', 1).slice(0, 7), c.diaExt);
    const lim = comDia(SPAP.addMonths(ext.slice(0, 7) + '-01', 1).slice(0, 7), c.diaLim);
    const antesExt = x.quando <= ext.slice(0, 7), pagaLim = x.quando <= lim.slice(0, 7);
    const ate = antesExt ? ext : pagaLim ? lim : comDia(x.quando, 1), juros = r2(x.falta * c.taxa * dias(g, ate) / 365);
    const disp = c.disp >= x.falta ? `disponível ≈ ${eur(c.disp)}` : `disponível ≈ ${eur(c.dispSePago)}, contando que já pagou os ${eur(c.porPagar)} do extrato de ${date(c.ux.data)}`;
    const como = antesExt ? `Pagando a ${date(g)}, depois do fecho do extrato, a compra só entraria no extrato de <b>${date(ext)}</b>. Em ${fmtMes(x.quando)}, logo que o dinheiro entre, transfira ${eur(x.falta)} para o cartão <b>antes de ${date(ext)}</b>: o saldo volta ao que era e a compra não pesa na prestação.`
      : pagaLim ? `A compra entra no extrato de ${date(ext)}; pague esse extrato por inteiro até <b>${date(lim)}</b>, com o dinheiro de ${fmtMes(x.quando)}.`
      : `Só há dinheiro em ${fmtMes(x.quando)}: o valor ficaria a crédito até lá.`;
    out.push(['info', 'credit', `<b>${esc(x.nome)}</b> (${eur(x.falta)} até ${date(g)}): só há dinheiro em ${fmtMes(x.quando)}. Sugestão: pagar com o <b>${esc(c.d.nome)}</b>, o cartão mais barato com disponível (TAN ${pct(c.taxa)}; ${disp}). ${como} Juros, no pior caso: cerca de <b>${eur(juros)}</b>.${CT.some(k => k !== c && k.taxa < c.taxa) ? ` (${CT.filter(k => k !== c && k.taxa < c.taxa).map(k => `${esc(k.d.nome)} é mais barato mas tem ≈ ${eur(k.dispSePago)} disponíveis`).join('; ')}.)` : ''}`,
      `${esc(x.nome)}: pague com o ${esc(c.d.nome)} e devolva ${antesExt ? 'antes de ' + date(ext) : pagaLim ? 'até ' + date(lim) : 'em ' + fmtMes(x.quando)}`]);
  });
  return out;
}
// fila de objetivos e calendário de poupança (usado nos Objetivos e no Simulador, para o mesmo dinheiro não contar duas vezes)
function planoObjetivos() {
  const m = M(), hoje = today(), CF0 = excedentesMes();
  let CF = CF0.map(c => ({ ...c }));
  // o que fica de lado acumulado até cada mês: os meses com sobra (ex.: subsídio de Natal) juntam, os negativos gastam o que havia (nunca abaixo de 0)
  // o que fica de lado acumulado até cada mês: os meses com sobra (ex.: subsídio de Natal) juntam, os negativos gastam o que havia (nunca abaixo de 0)
  let pool = []; const calcPool = () => { pool = []; CF.reduce((a, c) => { const v = Math.max(0, a + c.exc); pool.push(v); return v; }, 0); }; calcPool();
  const idx = d => { const k = CF.findIndex(c => c.ym >= String(d).slice(0, 7)); return k < 0 ? CF.length - 1 : k; };
  const AL = alavancas();
  const mesesAte = d => { if (!d) return null; const a = (+d.slice(0, 4) - +hoje.slice(0, 4)) * 12 + (+d.slice(5, 7) - +hoje.slice(5, 7)); return Math.max(1, a); };
  // os meus objetivos e a minha parte dos partilhados entram na mesma fila de prioridades
  const itens0 = [...m.objetivos.filter(o => { const cv = o.partilha ? convDe(o) : null; return !(cv && cv.estado === 'aceite'); }).map(o => ({ tipo: 'meu', o, nome: o.nome, alvo: +o.alvo || 0, poupado: +o.poupado || 0, data: o.data, prioridade: +o.prioridade || 3, cat: catDe(o), peso: pesoCat(o), div: catDe(o) === 'dividas' ? dividaDe(o) : null })),
    ...objPartilhados().map(x => Object.assign(x, { tipo: 'part', nome: x.o.nome, alvo: x.meuAlvo, poupado: x.meu, data: x.o.data, prioridade: +((x.o.prioridades || {})[x.L.eu] || x.o.prioridade) || 3, cat: catDe(x.o), peso: pesoCat(x.o), div: null }))];
  itens0.sort((a, b) => (a.prioridade + a.peso) - (b.prioridade + b.peso) || String(a.data || '9').localeCompare(String(b.data || '9')));
  // adiar: {id do objetivo de dívida: meses}. Um plano de amortização não tem prazo real; os outros objetivos (férias, compras...) têm.
  let S, lista;
  const alocar = adiar => {
  CF = CF0.map(c => ({ ...c })); calcPool();
  // gasto planeado: cada objetivo tira o seu valor no mês em que é pago, e daí para a frente; um objetivo cabe num mês t
  // se, de t em diante, nunca faltar dinheiro para ele e para os mais prioritários (que pagam nos seus próprios meses)
  S = CF.map(() => 0); const gastar = (t, v) => { for (let i = t; i < CF.length; i++) S[i] += v; };
  const livreDesde = t => { let mn = Infinity; for (let i = t; i < CF.length; i++) mn = Math.min(mn, pool[i] - S[i]); return Math.max(0, r2(mn)); };
  lista = itens0.map(x0 => ({ ...x0 })).map((x, ordem) => {
    const falta = r2(Math.max(0, x.alvo - x.poupado)), n = mesesAte(x.data), mensal = falta <= 0 ? 0 : n ? falta / n : 0;
    const ad = x.div && x.tipo === 'meu' ? adiar[x.o.id] || 0 : 0, ate = Math.min(CF.length - 1, (x.data ? idx(x.data) : CF.length - 1) + ad), antes = S[CF.length - 1] > 0.005, possivel = livreDesde(ate), cobre = r2(Math.min(falta, possivel));
    let k = -1; if (falta > 0) for (let t = 0; t < CF.length; t++) if (livreDesde(t) >= falta - 0.005) { k = t; break; }
    const quando = k >= 0 ? CF[k].ym : null;
    if (falta > 0 && n) { if (cobre >= falta - 0.005) gastar(ate, falta); else if (k >= 0) gastar(k, falta); }
    const estado = falta <= 0 ? ['ok', 'atingido'] : !n ? ['', 'sem data'] : cobre >= falta - 0.005 ? ['ok', 'no bom caminho'] : quando ? ['warn', 'atrasa para ' + fmtMes(quando)] : ['bad', 'sem margem'];
    // amortizar uma dívida baixa a prestação a partir do mês seguinte: esse dinheiro passa a contar para os objetivos que vêm depois
    let alivio = null;
    if (x.div && falta > 0) { const kPag = estado[1] === 'no bom caminho' ? ate : k, al = AL.find(a => a.d.id === x.div.id);
      if (kPag >= 0 && al) { const red = r2(Math.min(+x.div.prestacao || 0, falta * al.ratio)); if (red > 0.005) {
        for (let i = kPag + 1; i < CF.length; i++) { CF[i].exc = r2(CF[i].exc + red); CF[i].prest = r2(CF[i].prest - red); CF[i].alivio = r2((CF[i].alivio || 0) + red); }
        calcPool(); alivio = { red, desde: CF[Math.min(CF.length - 1, kPag + 1)].ym, juros: r2(falta * (+x.div.taxa || 0)), cartao: al.cartao }; } } }
    return Object.assign(x, { falta, n, mensal: r2(mensal), possivel, cobre, estado, quando, antes, ordem: ordem + 1, alivio, ate, ajuste: ad ? { de: String(x.data).slice(0, 7), para: CF[ate].ym } : null });
  });
  };
  // se um objetivo com prazo fica atrasado por causa de um plano de dívida à frente na fila, adia-se esse plano o mínimo
  // necessário, desde que continue coberto e nenhum outro objetivo piore
  const okDe = () => lista.filter(x => !x.div && x.falta > 0 && x.n && x.estado[0] === 'ok').map(x => x.nome);
  alocar({}); const base = okDe(), atras = lista.filter(x => !x.div && x.falta > 0 && x.n && x.estado[0] !== 'ok');
  const flex = lista.filter(x => x.div && x.tipo === 'meu' && x.falta > 0 && x.estado[1] === 'no bom caminho' && atras.some(y => y.ordem > x.ordem));
  if (atras.length && flex.length) { let melhor = null;
    for (let p = 1; p <= 24; p++) { const ad = Object.fromEntries(flex.map(x => [x.o.id, p])); alocar(ad); const ok = okDe();
      if (base.every(n => ok.includes(n)) && ok.length > base.length && lista.filter(x => ad[x.o && x.o.id]).every(x => x.estado[1] === 'no bom caminho')
        && (!melhor || ok.length > melhor.n)) { melhor = { ad, n: ok.length, por: atras.filter(y => ok.includes(y.nome)).map(y => y.nome) }; if (ok.length === base.length + atras.length) break; } }
    alocar(melhor ? melhor.ad : {}); if (melhor) lista.forEach(x => { if (x.ajuste) x.ajuste.por = melhor.por; }); }
  const resto = CF.map(c => Math.max(0, c.exc)), poe = CF.map(() => []), paga = CF.map(() => []), reserva = CF.map(() => 0), cobreNeg = CF.map(() => 0);
  CF.forEach((c, i) => { let f = -c.exc; for (let j = i - 1; j >= 0 && f > 0.005; j--) { const v = Math.min(resto[j], f); if (v > 0.005) { resto[j] -= v; reserva[j] += v; cobreNeg[i] += v; f -= v; } } });
  // calendário: junta-se primeiro para o que se paga mais cedo (quem cabe já foi decidido pela fila de prioridades)
  lista.map(x => ({ x, t: x.falta <= 0 || !x.n ? -1 : x.estado[1] === 'no bom caminho' ? x.ate : x.quando ? CF.findIndex(c => c.ym === x.quando) : -1 }))
    .filter(y => y.t >= 0).sort((a, b) => a.t - b.t || a.x.ordem - b.x.ordem).forEach(({ x, t }) => {
    let f = x.falta; for (let i = 0; i <= t && f > 0.005; i++) { const v = r2(Math.min(resto[i], f)); if (v > 0.005) { resto[i] = r2(resto[i] - v); poe[i].push([x, v]); f = r2(f - v); } }
    paga[t].push(x); });
  return { CF, pool, S, lista, idx, AL, resto, poe, paga, reserva, cobreNeg };
}
function objetivos(v) {
  const m = M(), ed = podeEditar(), I = indicadores(), hoje = today(), PO = planoObjetivos(), { CF, pool, S, lista, idx, AL, resto, poe, paga, reserva, cobreNeg } = PO;
  const ateMes = x => x.data ? fmtMes(String(x.data).slice(0, 7)) : '';
  const frase = x => x.falta <= 0 ? 'Objetivo atingido. Pode terminá-lo ou aumentar o valor.'
    : !x.n ? `Faltam ${eur(x.falta)}. Indique uma data pretendida para o sistema verificar se chega.`
    : x.ajuste ? `Faltam ${eur(x.falta)}. Ajustado: fica pago em ${fmtMes(x.ajuste.para)} em vez de ${fmtMes(x.ajuste.de)}, para que ${x.ajuste.por.join(', ')} fique${x.ajuste.por.length > 1 ? 'm' : ''} na data pretendida. Um plano de amortização pode esperar um pouco; as férias e as compras têm data marcada.`
    : x.estado[1] === 'no bom caminho' ? `Faltam ${eur(x.falta)}. Até ${ateMes(x)} ficam livres ${eur(x.possivel)}${x.antes ? ', já descontados os objetivos que vêm antes na fila' : ''}: chega.`
    : `Faltam ${eur(x.falta)}. Até ${ateMes(x)} ${x.cobre > 0 ? `só ficam livres ${eur(x.cobre)}` : 'não fica nada livre'}${x.antes ? ' depois dos objetivos que vêm antes na fila' : ''}. `
      + (x.quando ? `Ao ritmo previsto chega lá em ${fmtMes(x.quando)}.` : 'Ao ritmo previsto não chega lá nos próximos 10 anos.');
  const linhaDiv = x => !x.div ? (x.cat === 'dividas' && x.tipo === 'meu' ? `<div class="faint" style="font-size:12px;margin-top:8px">Escolha a dívida em Alterar</div>` : '')
    : `<div style="font-size:12px;margin-top:8px" class="muted">${icon('credit')} ${esc(x.div.nome)}${x.alivio ? ` · <b class="pos">−${eur(x.alivio.red)}/mês</b> desde ${mesCurto(x.alivio.desde)} · −${eur(x.alivio.juros)}/ano em juros` : ''}
      ${dica(`Amortiza ${x.div.nome} (TAN ${pct(x.div.taxa)}, em dívida ${eur(x.div.capital)}). Depois de feito, a prestação desce e essa folga passa a contar para os objetivos seguintes.${x.alivio && !x.alivio.cartao ? ' Peça ao credor para reduzir a prestação (e não o prazo).' : ''}`)}</div>`;
  const disp0 = M().plano.sugDispensadas || [], SUG = sugestoesObjetivos(CF, lista, idx, pool).filter(x => !x[5] || !disp0.includes(x[5])), med = r2(sum(CF.slice(0, 12), 'exc') / 12), k12 = Math.min(11, CF.length - 1), livre12 = r2(pool[k12] - S[k12]);
  const nCurto = x => { const n = String(x.nome).replace(/\s*(DEZ|JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV)\d{4}\s*/i, ' ').trim(); return n.length > 26 ? n.slice(0, 25) + '…' : n; };
  const ultimoPag = Math.max(11, ...paga.map((p, i) => p.length ? i : -1)), mesesPlano = Math.min(CF.length, Math.min(24, ultimoPag + 1));
  let semDestino = 0; const livreCal = resto.map(v => (semDestino = r2(semDestino + v)));
  const poup12 = r2(sum(CF.slice(0, 12), 'poup'));
  const PLANO = CF.slice(0, mesesPlano).map((c, i) => `<tr><td style="white-space:nowrap"><b>${mesCurto(c.ym)}</b></td>
      <td class="r num ${c.exc < 0 ? 'neg' : ''}">${c.exc > 0 ? '+' : ''}${eur(c.exc)}</td>
      <td>${c.poup > 0.005 ? `<span class="badge info" style="margin:2px 4px 2px 0" data-tip="Poupança mensal definida em Poupanças. Sai antes dos objetivos.">Poupança mensal <b class="num">${eur(c.poup)}</b></span>` : ''}${poe[i].map(([x, v]) => `<span class="badge plain" style="margin:2px 4px 2px 0">${esc(nCurto(x))} <b class="num">${eur(v)}</b></span>`).join('')}${reserva[i] > 0.005 ? `<span class="badge warn" style="margin:2px 4px 2px 0" data-tip="Guardar para cobrir meses seguintes que fecham negativos">reserva <b class="num">${eur(reserva[i])}</b></span>` : ''}${cobreNeg[i] > 0.005 ? `<span class="faint" style="font-size:12px">usa ${eur(cobreNeg[i])} da reserva</span>` : ''}</td>
      <td>${paga[i].map(x => `<span class="badge ok" style="margin:2px 4px 2px 0">${icon('check')} ${esc(nCurto(x))}</span>`).join('')}</td>
      <td class="r num faint">${eur(livreCal[i])}</td></tr>`).join('');
  const barra = (pc, cls) => `<div class="progress ${cls}"><i style="width:${Math.min(100, Math.max(0, Math.round(pc)))}%"></i></div>`;
  const topo = x => `<div class="card-h" style="align-items:flex-start"><div style="min-width:0"><h3 style="margin:0">${esc(x.nome)}</h3>
      <div class="faint" style="font-size:12px;margin-top:2px">${x.ordem}.º na fila · ${esc(nomeCat(x.cat))} · prioridade ${x.prioridade} ${dica('Ordem pela qual o dinheiro livre é distribuído: primeiro a prioridade; com a mesma prioridade, a categoria (emergência, dívidas, saúde, habitação, educação, compras, férias) e depois a data.')}</div></div>
      <span class="badge ${x.estado[0]}" style="margin-left:auto;white-space:nowrap">${x.ajuste ? 'ajustado para ' + mesCurto(x.ajuste.para) : x.estado[1]}</span> ${dica(frase(x))}</div>`;
  const numeros = (feito, alvo, x) => `<div class="row between" style="margin:10px 0 6px"><b class="num" style="font-size:18px">${eur(feito)} <span class="faint" style="font-size:13px;font-weight:400">de ${eur(alvo)}</span></b>
      <span class="faint" style="font-size:12px">${x.data ? 'até ' + date(x.data) : 'sem data'}${x.falta > 0 ? ` · faltam ${eur(x.falta)}` : ''}</span></div>`;
  const cartao = x => { const cls = x.estado[0] === 'bad' ? 'bad' : x.estado[0] === 'warn' ? 'warn' : '';
    const cv = x.tipo === 'meu' && x.o.partilha ? convDe(x.o) : null, propostoA = cv && cv.estado === 'pendente' ? semPessoal(cv.paraNome).split(' ')[0] : null;
    if (x.tipo === 'meu') return `<div class="card">${topo(x)}${numeros(x.poupado, x.alvo, x)}${barra(100 * x.poupado / Math.max(1, x.alvo), cls)}${linhaDiv(x)}
      ${propostoA ? `<div style="margin-top:8px"><span class="badge info">partilha proposta · aguarda ${esc(propostoA)}</span></div>` : cv && cv.estado === 'recusado' ? '<div style="margin-top:8px"><span class="badge warn">partilha recusada</span></div>' : ''}
      ${ed ? `<div class="row" style="margin-top:14px;gap:6px;flex-wrap:wrap"><button class="btn sm primary" data-pp="${x.o.id}">${icon('plus')} Pôr de lado</button>${x.div && x.poupado > 0.005 && app.can('criar') ? `<button class="btn sm" data-am="${x.o.id}" data-tip="Regista a amortização antecipada com o valor já poupado">${icon('check')} Amortizar ${eur(Math.min(x.poupado, +x.div.capital || 0))}</button>` : ''}<button class="btn sm ghost" data-o="${x.o.id}">Alterar</button>${!propostoA && pessoasGrupo().length ? `<button class="btn sm ghost" data-sj="${x.o.id}">${icon('users')} Partilhar</button>` : ''}</div>` : ''}</div>`;
    const nm = id => semPessoal(nomeMembro(x.L.casa, id)).split(' ')[0];
    const porMembro = Object.keys(x.o.partes || {}).map(id => ({ id, alvo: r2((+x.o.alvo || 0) * (+x.o.partes[id] || 0)), juntou: sum(x.cs.filter(c => c.membro === id), 'valor') }));
    return `<div class="card">${topo(x)}${numeros(x.total, +x.o.alvo || 0, Object.assign({}, x, { falta: r2(Math.max(0, (+x.o.alvo || 0) - x.total)) }))}${barra(100 * x.total / Math.max(1, +x.o.alvo || 0), cls)}
      <div class="row" style="gap:6px;flex-wrap:wrap;margin-top:10px"><span class="badge info">${icon('users')} partilhado</span>${porMembro.map(p => `<span class="badge ${p.juntou >= p.alvo - 0.005 ? 'ok' : 'plain'}">${p.id === x.L.eu ? 'Eu' : esc(nm(p.id))} ${eur(p.juntou)} / ${eur(p.alvo)}</span>`).join('')}</div>
      ${ed ? `<div class="row" style="margin-top:14px;gap:6px"><button class="btn sm primary" data-cj="${x.o.id}">${icon('key')} Pôr de lado</button><button class="btn sm ghost" data-vj="${x.o.id}">Contribuições e alterar</button></div>` : ''}</div>`; };
  const L = ligacaoCasa(), pend = L ? (CC().registo(L.casa).convites || []).filter(c => c.estado === 'pendente' && ehObj(c)) : [];
  const recebidos = convitesParaMim().filter(({ c }) => ehObj(c));
  const EXPLICA = 'Um objetivo é algo para que quer juntar dinheiro até uma data. O sistema faz a conta mês a mês: rendimento desse mês (com subsídios) − despesas fixas − prestações − poupança mensal do plano. O que sobra paga os objetivos pela ordem da fila. Um objetivo de pagamento de dívidas baixa a prestação depois de feito, e essa folga passa a contar para os seguintes. Um objetivo partilhado é feito a meias: cada um junta a sua parte.';
  v.innerHTML = `<div class="row between" style="margin-bottom:16px;gap:12px;flex-wrap:wrap"><span class="muted">Pagos com o que sobra em cada mês, por ordem de prioridade ${dica(EXPLICA)}${poup12 > 0.005 ? `<br><span style="font-size:12px">A <a href="#/poupancas">poupança mensal</a> (${eur(poup12)} em 12 meses) sai primeiro, como um objetivo fixo.</span>` : ''}</span>
      ${ed ? botaoMais([['Novo objetivo'], ['Objetivo partilhado'], ['Amortizar dívida']]) + escondidos(['no', 'nj', 'na']) : ''}</div>
    <div class="grid g4">${kpi(`${icon('target')} Livre em 12 meses ${dica('O que fica livre daqui a 12 meses, depois de pagar todos os objetivos planeados.')}`, eur(livre12), 'depois dos objetivos', livre12 < 0 ? 'neg' : 'pos', true)}
      ${kpi(`Falta juntar ${dica('Soma do que falta a cada objetivo (nos partilhados, só a sua parte).')}`, eur(sum(lista, 'falta')), `${lista.length} objetivo${lista.length === 1 ? '' : 's'}`)}
      ${kpi(`Sobra em 12 meses ${dica('Rendimento − despesas fixas − prestações − poupança mensal do plano, somado nos próximos 12 meses, antes dos objetivos.')}`, eur(sum(CF.slice(0, 12), 'exc')), poup12 > 0.005 ? `já sem ${eur(poup12)} de poupança` : 'antes dos objetivos', sum(CF.slice(0, 12), 'exc') < 0 ? 'neg' : '')}
      ${kpi(`Média por mês ${dica('Média da sobra mensal nos próximos 12 meses. Os meses com subsídio sobem a média.')}`, eur(med), 'próximos 12 meses', med < 0 ? 'neg' : '')}</div>
    ${!pool.some(v => v > 0.005) ? `<div class="alert bad" style="margin-top:16px">${icon('alert')}<div>Não sobra dinheiro em nenhum mês ${dica('Sem sobra mensal, nenhum objetivo tem financiamento. Reveja despesas fixas, dívidas ou o rendimento.')} · <a href="#/despesas">Despesas fixas</a> · <a href="#/dividas">Dívidas</a></div></div>`
      : med < 0 ? `<div class="alert warn" style="margin-top:16px">${icon('alert')}<div>Em média o mês fecha negativo (${eur(med)}) ${dica('Só sobra dinheiro nos meses com +, como os de subsídio. Os objetivos são pagos com essa sobra e os meses negativos gastam-na.')}</div></div>` : ''}
    ${SUG.length ? `<div class="card flush" style="margin-top:16px"><div class="card-h"><h3>${icon('info')} Sugestões ${dica('Calculadas com a sobra de cada mês, as prestações e os extratos dos cartões. Confirme valores e datas com o banco. Passe o rato no (i) de cada sugestão para ver o detalhe.')}</h3></div>
      ${SUG.map(([t, ic, det, curto, btn, chave]) => `<div class="row" style="gap:10px;padding:10px 16px;border-top:1px solid var(--line);align-items:center"><span class="badge ${t === 'ok' ? 'ok' : t === 'bad' ? 'bad' : t === 'warn' ? 'warn' : 'info'}" style="padding:4px 6px">${icon(ic)}</span>
        <span style="flex:1;min-width:0">${curto || semTags(det)} ${curto ? dica(det) : ''}</span>${btn || ''}${chave && ed ? `<button class="btn sm ghost" data-dis="${esc(chave)}" data-tip="Esconder esta sugestão">Dispensar</button>` : ''}</div>`).join('')}</div>` : ''}
    ${recebidos.map(({ casa, c }) => `<div class="alert info" style="margin-top:16px">${icon('inbox')}<div style="flex:1">${resumoConvite(casa, c)}</div>${ed ? `<button class="btn sm primary" data-rj="${c.id}" data-casa="${casa}">${icon('key')} Responder</button>` : ''}</div>`).join('')}
    ${pend.filter(c => c.deSistema === sub.key).map(c => `<div class="alert" style="margin-top:16px">${icon('users')}<div style="flex:1">Pedido enviado a <b>${esc(semPessoal(c.paraNome))}</b>: ${esc(c.objetivo.nome)} · ${eur(c.objetivo.alvo)} · aguarda resposta</div>${ed ? `<button class="btn sm ghost" data-cc="${c.id}">Cancelar</button>` : ''}</div>`).join('')}
    <div class="grid g2" style="margin-top:16px">${lista.map(cartao).join('') || `<div class="empty" style="grid-column:1/-1">Ainda não tem objetivos. Crie um com <b>Novo objetivo</b> (ex.: portátil novo, 900 €, até junho).</div>`}</div>
    <div class="card flush" style="margin-top:16px"><div class="card-h"><h3>${icon('calendar')} Plano de poupança mês a mês ${dica('Quanto pôr de lado em cada mês para cada objetivo, usando a sobra desse mês (rendimento − despesas fixas − prestações). Os objetivos são juntados pela ordem da fila, com a sobra dos meses mais cedo possíveis até ao mês em que são pagos. Nos meses que fecham negativos, usa-se a reserva guardada antes. Livre: o que fica acumulado sem destino.')}</h3></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Mês</th><th class="r">Sobra</th><th>Pôr de lado</th><th>Pagar</th><th class="r">Livre</th></tr></thead><tbody>${PLANO}</tbody></table></div></div>`;
  const ed1 = (o0, pre) => { const novo = !o0, x = o0 || Object.assign({ alvo: 0, poupado: 0, prioridade: 3, categoria: 'outro', data: SPAP.addMonths(hoje, 12) }, pre || {});
    if (!novo && !x.categoria) x.categoria = catDe(x);
    editar({ titulo: 'Objetivo', cols: COLS_OBJ(), x, novo, validar: f => !f.nome ? 'Indique o objetivo' : f.categoria === 'dividas' && !f.divida ? 'Escolha a dívida a amortizar'
        : !(f.alvo > 0) && !(f.categoria === 'dividas' && f.divida) ? 'Indique o valor necessário' : null,
      onSave: f => { f.prioridade = +f.prioridade; if (f.categoria !== 'dividas') f.divida = '';
        if (f.categoria === 'dividas' && !(f.alvo > 0)) { const d = M().dividas.find(y => y.id === f.divida); f.alvo = r2(d ? +d.capital || 0 : 0); }
        Object.assign(x, f); if (novo) { x.id = 'O' + uid(); m.objetivos.push(x); } audit('PF_OBJETIVO', `${x.nome} · ${eur(x.alvo)}`); },
      onDelete: y => { m.objetivos = m.objetivos.filter(z => z !== y); audit('PF_OBJETIVO_REMOVIDO', y.nome); } }); };
  const porParte = id => lista.find(x => x.tipo === 'part' && x.o.id === id);
  v.querySelectorAll('[data-o]').forEach(b => b.onclick = () => ed1(m.objetivos.find(x => x.id === b.dataset.o)));
  v.querySelectorAll('[data-pp]').forEach(b => b.onclick = () => { const o = m.objetivos.find(x => x.id === b.dataset.pp); if (!o) return;
    ui.modal({ title: 'Pôr de lado · ' + esc(o.nome), body: `<form class="form"><div class="fld"><label>Valor (€)</label><input class="inp num" type="number" step="any" name="valor"></div><div class="fld"><label>Data</label><input class="inp" type="date" name="data" max="${today()}" value="${today()}"></div></form>`,
      actions: [{ label: 'Cancelar', kind: 'ghost' }, { label: 'Registar', kind: 'primary', onClick: el => { const f = ui.formData(el); if (!(+f.valor > 0)) { ui.toast('Indique o valor', 'warn'); return false; }
        o.poupado = r2((+o.poupado || 0) + +f.valor); (o.movimentos = o.movimentos || []).push({ data: f.data || today(), valor: r2(+f.valor) });
        audit('PF_OBJETIVO_POUPANCA', `${o.nome} · ${eur(+f.valor)}`); app.save(); app.refresh(); } }] }); });
  v.querySelectorAll('[data-sj]').forEach(b => b.onclick = () => novoObjPartilhado(m.objetivos.find(x => x.id === b.dataset.sj)));
  v.querySelectorAll('[data-cj]').forEach(b => b.onclick = () => { const x = porParte(b.dataset.cj); if (x) contribuirObj(x); });
  v.querySelectorAll('[data-vj]').forEach(b => b.onclick = () => { const x = porParte(b.dataset.vj); if (x) verObjPartilhado(x); });
  v.querySelectorAll('[data-rj]').forEach(b => b.onclick = async () => { if (await responderConvite(b.dataset.casa, b.dataset.rj)) app.refresh(); });
  v.querySelectorAll('[data-cc]').forEach(b => b.onclick = async () => { if (L && await cancelarConvite(L.casa, b.dataset.cc)) app.refresh(); });
  const no = v.querySelector('#no'); if (no) no.onclick = () => ed1();
  ligarMais(v, [['Novo objetivo', null, 'no', null, 'edit', 'Poupar para um objetivo seu'], ['Objetivo partilhado', null, 'nj', null, 'users', 'Poupar em conjunto com outra pessoa'], ['Amortizar dívida', null, 'na', null, 'credit', 'Objetivo para amortizar um crédito']]);
  const na = v.querySelector('#na'); if (na) na.onclick = () => { const d = AL.slice().sort((a, b) => (+b.d.taxa || 0) - (+a.d.taxa || 0))[0];
    ed1(null, { categoria: 'dividas', prioridade: 3, divida: d ? d.d.id : '', nome: d ? 'Amortizar ' + d.d.nome : 'Amortizar dívida', alvo: d ? r2(Math.min(+d.d.capital || 0, 500)) : 0, data: SPAP.addMonths(hoje, 3) }); };
  v.querySelectorAll('[data-am]').forEach(b => b.onclick = () => { const o = m.objetivos.find(x => x.id === b.dataset.am), d = o && dividaDe(o); if (!d) return;
    pedirAmortizacao(d, Math.min(+o.poupado || 0, +d.capital || 0)); });
  v.querySelectorAll('[data-ant]').forEach(b => b.onclick = () => { const o = m.objetivos.find(x => x.id === b.dataset.ant); if (!o) return;
    const ant = o.data; o.data = comDia(b.dataset.ym, 28); audit('PF_OBJETIVO', `${o.nome}: data antecipada de ${date(ant)} para ${date(o.data)}`); app.save(); ui.toast(`${o.nome}: antecipado para ${date(o.data)}`, 'ok'); app.refresh(); });
  v.querySelectorAll('[data-sa]').forEach(b => b.onclick = () => { const d = M().dividas.find(y => y.id === b.dataset.sa); if (!d) return;
    ed1(null, { categoria: 'dividas', prioridade: 3, divida: d.id, nome: 'Amortizar ' + d.nome, alvo: r2(Math.min(+d.capital || 0, +b.dataset.v || 0)), data: b.dataset.ym ? comDia(b.dataset.ym, 28) : SPAP.addMonths(hoje, 12) }); });
  v.querySelectorAll('[data-dis]').forEach(b => b.onclick = () => { const p = M().plano; p.sugDispensadas = [...new Set([...(p.sugDispensadas || []), b.dataset.dis])].slice(-50);
    audit('PF_OBJETIVO', 'Sugestão dispensada'); app.save(); ui.toast('Sugestão escondida', 'ok'); app.refresh(); });
  const nj = v.querySelector('#nj'); if (nj) nj.onclick = novoObjPartilhado;
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
  pf_rend: { n: 'Rendimento líquido mensal', d: 'No Painel: o que entra no mês escolhido (recibo real, ou projeção com subsídios em junho e novembro), com refeição (se configurado) e outros rendimentos. A média a 12 meses aparece por baixo.' },
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
  seed, alcadaPadrao: 5000, tagline: sub.setor || 'Planeamento financeiro', home: 'visao',
  // relatórios de empresa só fazem sentido com atividade independente (categoria B): aparecem quando há recibos verdes emitidos
  // intercompany e delegação de alçadas são coisas de empresa: um plano pessoal não os mostra
  pagamentoDireto: true,
  // perfil do titular (botão no rodapé do menu): dados pessoais usados nos cálculos
  perfil: () => perfilPessoal(),
  grupoSpap: 'Contas e documentos',
  // pagamentos sem circuito de aprovação: as páginas de autorizações saem do menu (Pedidos fica acessível por link para o histórico)
  navVisivel: id => ['pedidos', 'alteracoes', 'verificar', 'auditoria', 'utilizadores', 'definicoes', 'fechos'].includes(id) ? 'menu' : !['intercompany', 'delegacoes', 'spap', 'recorrentes', 'orcamentos'].includes(id) && (!['indicadores', 'financeiro', 'investimentos', 'relatorios'].includes(id) || temCatB()),
  // a receita da atividade são os recibos verdes (valor sem IVA); os custos continuam a vir dos pagamentos classificados
  analiseTexto: ' e dos recibos verdes (categoria B)', analiseOrigem: 'A receita vem dos recibos verdes emitidos (<a href="#/rendimentos" data-aba="pf-rend=catb">Rendimentos › Recibos verdes</a>), sem IVA.',
  analise: (a, ano) => { if (!temCatB()) return null; const z = () => Array(12).fill(0), r = { receitas: z(), custosVar: z(), unidades: z(), n: z(), rotUnidade: 'recibos', cvPedidos: true };
    M().recibosB.filter(x => contaCatB(x) && String(x.data).startsWith(ano)).forEach(x => { const m = +String(x.data).slice(5, 7) - 1; r.receitas[m] += +x.bruto || 0; r.n[m]++; r.unidades[m]++; }); return r; }, logo: `<span style="font-size:13px">${esc(sub.sigla || '')}</span>`,
  heroTitle: 'Rendimentos, dívidas e objetivos num só plano.', heroText: 'Projeção anual, simulação de amortizações e saúde financeira — com cada pagamento autorizado e assinado.',
  // despesas e prestações por pedir, e o salário projetado, entram na previsão de liquidez
  previsao: (a, ini, fim) => {
    const out = [], hoje = today(), de = ini && ini > hoje ? ini : hoje, ate = fim || SPAP.addMonths(hoje, 3), pl = M().plano;
    if (de <= hoje) atrasos().forEach(({ e, d }) => out.push({ conta: e.contaOrigem || CAIXA, data: hoje, valor: -(+e.valor || 0), tipo: 'Despesa vencida', descricao: `${e.nome} (vencida a ${date(d)})` }));
    M().despesas.filter(e => e.ativo !== false).forEach(e => ocorrencias(e, e.periodicidade, de, ate).forEach(d => { if (vigente(e, d.slice(0, 7)) && !vivos(chaveDesp(e, d)).length) out.push({ conta: e.contaOrigem || CAIXA, data: d, valor: -(+e.valor || 0), tipo: 'Despesa fixa', descricao: e.nome }); }));
    divAtivas().forEach(x => ocorrencias(x, 'mensal', de, ate).forEach(d => { if (!vivos(chaveDiv(x, d)).length) out.push({ conta: x.contaOrigem || CAIXA, data: d, valor: -(+x.prestacao || 0), tipo: 'Prestação', descricao: x.nome }); }));
    ocorrencias({ dia: pagEnt(entPrincipal()).dia || 28 }, 'mensal', de, ate).forEach(d => {
      const y = +d.slice(0, 4), m = +d.slice(5, 7), [ry, rm] = mesDoRecibo(y, m), rs = M().recibos.filter(r => +r.ano === ry && +r.mes === rm);
      if (rs.some(r => vivos(chaveRec(r)).length)) return;
      const val = rendimentoDoMes(y, m);
      if (val > 0) out.push({ conta: CAIXA, data: d, valor: val, tipo: 'Rendimento previsto', descricao: `Rendimento ${MESES[rm - 1]} ${ry}${ry !== y || rm !== m ? ' (recebido em ' + MESES[m - 1] + ')' : ''}` });
    });
    return out;
  },
  modules: [
    { id: 'visao', label: 'Painel', title: 'Painel financeiro', icon: 'chart', render: visao },
    { id: 'rendimentos', label: 'Rendimentos', title: 'Rendimentos e projeção', icon: 'wallet', render: rendimentos },
    { id: 'dividas', label: 'Dívidas e créditos', title: 'Dívidas e créditos', icon: 'credit', render: dividas },
    { id: 'despesas', label: 'Despesas fixas', title: 'Despesas fixas', icon: 'list', render: despesas },
    { id: 'casa', label: 'Partilhas', title: 'Despesas partilhadas · conta corrente', icon: 'users', render: casaPessoal },
    { id: 'simulador', label: 'Simulador de estratégias', title: 'Simulador de estratégias', icon: 'target', render: simulador },
    { id: 'poupancas', label: 'Poupanças', title: 'Poupanças', icon: 'shield', render: poupancas },
    { id: 'objetivos', label: 'Objetivos', title: 'Objetivos e compras', icon: 'pie', render: objetivos },
  ],
  // pedidos de partilha dirigidos a este plano e pagamentos registados por quem partilha, à espera da minha confirmação
  caixa: () => { const out = convitesParaMim().map(({ casa, c }) => ({ titulo: ehAlt(c) ? 'Alteração a despesa partilhada' : ehObj(c) ? 'Objetivo partilhado' : 'Pedido de partilha', data: String(c.criadoEm || '').slice(0, 10), descricao: resumoConvite(casa, c),
      valor: ehAlt(c) ? null : ehObj(c) ? c.objetivo.alvo : c.despesa.periodicidade === 'compras' ? null : c.despesa.valor, botao: 'Responder', ver: ehObj(c) ? '#/objetivos' : '#/casa', acao: () => responderConvite(casa, c.id) }));
    const L = ligacaoCasa(); if (!L) return out; const ex = CC().extrato(L.casa); if (!ex) return out;
    return out.concat(ex.linhas.filter(l => l.tipo === 'pagamento' && l.estado === 'registado' && l.para === L.eu).map(l => ({ titulo: 'Confirmar recebimento', data: l.data,
      descricao: `<b>${esc(ex.nomeM(l.de))}</b> registou que lhe pagou: ${esc(l.descricao)}`, valor: l.valor, botao: 'Confirmar recebimento', ver: '#/casa',
      acao: () => confirmarPagamento(l.id) }))); },
  registar(a) { app = a; if (a.GLOSS) Object.assign(a.GLOSS, GLOSS); },
  // exposto para testes
  _motor: { taxaMensal, comissaoLegal, mesesParaLiquidar, estimarLiquido, simular, escolherAlvo },
};
};
})();
