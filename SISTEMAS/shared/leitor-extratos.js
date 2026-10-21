/* =========================================================
   LEITOR DE EXTRATOS DE CARTÃO DE CRÉDITO (PDF)
   Porta de src/ocr/card_statement_pt.py do Planeador Financeiro
   (Santander Totta: cabeçalho, planos PagaSIMPLES e movimentos).
   A extração de texto (pdf.js / OCR) é a do leitor de recibos.
   ========================================================= */
(function () {
'use strict';
const num = s => SPAP.leitorRecibos.numeroPT(s);
const NUM = String.raw`-?[\d.\s]*\d,\d{2}|-?\d+\.\d{2}`;
const pctDe = s => { const n = num(String(s).replace('%', '').trim()); return n == null ? null : n / 100; };
const valor = (texto, re) => { const m = texto.match(re); return m ? num(m[1]) : null; };

const ASSINATURAS_SANTANDER = [/BANCO\s+SANTANDER\s+TOTTA/i, /500\s*844\s*321/i, /\bSantander\b[\s\S]*N[º°.]?\s*Conta\s+Cart/i, /PT50\s*0018/i, /santander\.pt\/precario/i, /PAGASIMPLES/i];
const PRODUTOS = [['Gold', /\bCART[AÃ]O\s+GOLD\b/i], ['Classic', /\bCART[AÃ]O\s+CLASSIC\b/i], ['Black', /\bCART[AÃ]O\s+BLACK\b/i], ['Platinum', /\bCART[AÃ]O\s+PLATIN(UM|A)\b/i],
  ['1|2|3', /\bCART[AÃ]O\s+1\s*[|/]\s*2\s*[|/]\s*3\b/i], ['Santander', /\bCART[AÃ]O\s+DE\s+CR[ÉE]DITO\s+SANTANDER\b/i]];
const BIN_RE = /\b(\d{4})\s*[*+_~^x\s]{2,}\s*(\d{4})\b/i;
function marca(texto) {
  const m = texto.match(BIN_RE); if (!m) return { marca: null, fim: null };
  const b = m[1], b2 = +b.slice(0, 2), b4 = +b;
  return { fim: m[2], marca: b[0] === '4' ? 'Visa' : (b2 >= 51 && b2 <= 55) || (b4 >= 2221 && b4 <= 2720) ? 'Mastercard' : b2 === 34 || b2 === 37 ? 'Amex' : null };
}
const isoDe = dmy => { const p = String(dmy || '').split('/'); return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : null; };

function cabecalho(d, t) {
  let m = t.match(/Per[ií]odo\s+Extrato\s*[:.\-—–]?\s*(\d{2}\/\d{2}\/\d{4})\s*[-–—]\s*(\d{2}\/\d{2}\/\d{4})/i);
  if (m) { d.periodoIni = isoDe(m[1]); d.periodoFim = isoDe(m[2]); }
  m = t.match(/Data\s+Extrato\s*[:.]?\s*(\d{2}\/\d{2}\/\d{4})/i); if (m) d.data = isoDe(m[1]);
  m = t.match(/Extrato\s+n\.?[º°oO]?\s*(\d+)\b(?!\s+ser[áa])/i); if (m) d.numero = +m[1];
  m = t.match(/Conta\s+Cart.{1,3}?o\s*[:.]?\s*([\d.]+)/i); if (m) d.conta = m[1].replace(/\.$/, '');
  m = t.match(/\bTAN\s*[:.]?\s*([\d,]+)\s*%/i); if (m) d.tan = pctDe(m[1]);
  m = t.match(/Op[çc][ãa]o\s+Pagamento\s*[:.\-—–]?\s*([\d,]+)\s*%/i); if (m) d.opcaoPct = pctDe(m[1]);
  d.limite = valor(t, new RegExp(String.raw`Limite\s+de\s+Cr[ée]dito\s*[:.]?\s*(${NUM})`, 'i'));
  d.saldo = valor(t, new RegExp(String.raw`Saldo\s+em\s+D[ií]vida\s*[:.]?\s*(${NUM})`, 'i'));
  d.pagar = valor(t, new RegExp(String.raw`Montante\s+a\s+Pagar\s*[:.\-—–]?\s*(${NUM})`, 'i'));
  d.minimo = valor(t, new RegExp(String.raw`M[ií]nimo\s+a\s+Pagar\s*[:.\-—–]?\s*(${NUM})`, 'i'));
  m = t.match(/Data\s+Limite\s+Pag[.aá]?\s*[:.\-—–]?\s*(\d{2}\/\d{2}\/\d{4})/i); if (m) d.dataLimite = isoDe(m[1]);
}

/* ---------- Planos PagaSIMPLES ---------- */
const CABECALHO = ['MOVIMENTO', 'DATA', 'MONTANTE', 'PRESTA', 'PROXIMA', 'PRÓXIMA', 'EM DÍVIDA', 'EM DIVIDA', 'CAPITAL', 'JUROS', 'IS S/', 'TOTAL', 'PÁGINA', 'PAGINA', 'INÍCIO', 'INICIO', 'PRAZO'];
const ehCabecalho = l => { const u = l.toUpperCase().trim(); return u.length < 2 || CABECALHO.filter(k => u.includes(k)).length >= 2; };
function planos(d, t) {
  const ini = t.search(/DETALHE\s+PLANOS\s+PAGASIMPLES/i);
  if (ini < 0) {
    // sem o detalhe: aproveita as prestações nos movimentos ("PSIM-COMPRA PARCELADA POS 1 09/12 19,47 €")
    for (const m of t.matchAll(/PSIM[-\s]?COMPRA\s+PARCELADA\s+([A-Z0-9\s]+?)\s+(\d{1,2})\s*\/\s*(\d{1,3})\s+([\d.\s]+,\d{2})/gi))
      d.planos.push({ descricao: 'COMPRA PARCELADA ' + m[1].trim(), prazo: +m[3], proxima: +m[2], prestacao: num(m[4]), saldo: null, montante: null, tan: null, inicio: null, confianca: 0.5 });
    return;
  }
  let bloco = t.slice(ini).replace(/^.*\n?/, '');
  const fim = bloco.search(/(P[áa]gina\s+\d+\s+de\s+\d+|©\d{4}|EXMº|urea,\s*n)/i); if (fim >= 0) bloco = bloco.slice(0, fim);
  const ls = bloco.split('\n'); let desc = null;
  ls.forEach((l0, i) => {
    const l = l0.trim(); if (!l) { desc = null; return; }
    const m = l.match(/^(\d{4}-\d{2}-\d{2})["'\s]+(.+)$/);
    if (m && desc) {
      const ns = m[2].split(/\s+/).map(num).filter(v => v != null);
      const ctx = ls.slice(i, i + 6).join('\n'), mp = ctx.match(/pr[óo]xima\s+presta[çc][ãa]o\s+no\s+valor\s+de\s+([\d.\s]+,\d{2})/i);
      const p = { descricao: desc, inicio: m[1], montante: null, prazo: null, tan: null, saldo: null, proxima: null, capital: null, juros: null, is: null, prestacao: null, confianca: 0.6 };
      if (ns.length >= 4) { p.montante = ns[0]; p.prazo = ns[1] ? Math.round(ns[1]) : null; p.tan = ns[2] / 100; p.saldo = ns[3]; }
      if (ns.length >= 8) { p.proxima = Math.round(ns[4]); p.capital = ns[5]; p.juros = ns[6]; if (ns.length >= 9) { p.is = ns[7]; p.prestacao = ns[8]; } else p.prestacao = ns[7]; }
      if (p.prestacao == null && mp) p.prestacao = num(mp[1]);
      if (p.proxima == null && p.montante != null && p.saldo != null && Math.abs(p.montante - p.saldo) < 0.10) p.proxima = 1;
      p.confianca = ns.length >= 8 ? 0.95 : p.prestacao != null ? 0.85 : 0.6;
      d.planos.push(p); desc = null; return;
    }
    if (ehCabecalho(l) || /\d{4}-\d{2}-\d{2}/.test(l) || /pr[óo]xima/i.test(l)) return;
    desc = l;
  });
  // prestações em falta: pela numeração ou pelo saldo
  d.planos.forEach(p => { p.emFalta = p.proxima && p.prazo ? p.prazo - p.proxima + 1 : p.saldo != null && p.capital ? Math.max(0, Math.round(p.saldo / p.capital)) : p.saldo != null && p.prestacao ? Math.max(1, Math.ceil(p.saldo / p.prestacao)) : null; });
}

/* ---------- Movimentos ---------- */
const TIPOS = [[/\bPSIM[\s-]/, 'Prestação PagaSimples'], [/\bIMP\.?\s*SELO|\bIMPOSTO\s+DO\s+SELO|\bI[.\s]+S[.\s]*\(?\d{2}\.\d|\bIS\s*[-/(]|^\s*[1I]\.?\s*S\b/, 'Imposto do selo'],
  [/\bJUROS?\b|\bENCARGOS\s+FINANC/, 'Juros'], [/\bANUIDADE\b|\bCOMISS[ÃAÂ]+O\b|\bMANUTEN|\bDISPONIBILIZA/, 'Comissão'], [/\bPAG(?:T|TO|AMENTO)\b|\bRECEBIDO\b|\bDEVOLU/, 'Pagamento'],
  [/\bLEVANTAMENTO\b|\bATM\b|\bMB\b\s*-\s*|\bCASH\s*ADVANCE/, 'Adiantamento'], [/\bTRANSF/, 'Transferência']];
const tipoMov = s => (TIPOS.find(([re]) => re.test(String(s).toUpperCase())) || [0, 'Compra'])[1];
function movimentos(d, t) {
  const ano0 = +(d.data || d.periodoFim || d.periodoIni || new Date().toISOString()).slice(0, 4);
  const anoDoMes = mes => { if (d.periodoIni && d.periodoFim) { let [y, m] = d.periodoIni.split('-').map(Number); const [ey, em] = d.periodoFim.split('-').map(Number);
    while (y < ey || (y === ey && m <= em)) { if (m === mes) return y; m++; if (m > 12) { m = 1; y++; } } } return ano0; };
  const iso = dm => { const p = dm.split('/'); if (p.length === 3) return `${p[2].length === 4 ? p[2] : '20' + p[2]}-${p[1]}-${p[0]}`; return `${anoDoMes(+p[1])}-${p[1]}-${p[0]}`; };
  const vistos = new Set();
  for (const m of t.matchAll(/^\s*(\d{2}\/\d{2}(?:\/\d{2,4})?)(?:\s+(\d{2}\/\d{2}(?:\/\d{2,4})?))?\s+(.{3,80}?)\s+(-?[\d.\s]*\d[,.][\d/]\d)\s*(?:EUR|€)?\s*$/gm)) {
    const desc = m[3].trim();
    if (/saldo\s+em\s+d[ií]vida|montante\s+a\s+pagar|limite\s+de\s+cr|m[ií]nimo\s+a\s+pagar|per[ií]odo\s+extrato|data\s+limite/i.test(desc)) continue;
    const v = num(m[4].replace(/\//g, '0')); if (v == null) continue;
    const data = iso(m[1]), k = `${data}|${desc.toUpperCase()}|${v.toFixed(2)}`; if (vistos.has(k)) continue; vistos.add(k);
    d.movimentos.push({ data, descricao: desc, valor: v, tipo: tipoMov(desc) });
  }
}

function analisar(texto) {
  const d = { emissor: null, produto: null, fimCartao: null, conta: null, numero: null, data: null, periodoIni: null, periodoFim: null, limite: null, saldo: null, pagar: null, minimo: null,
    dataLimite: null, tan: null, opcaoPct: null, planos: [], movimentos: [], modelo: 'genérico', notas: [] };
  if (!texto || !texto.trim()) return d;
  if (ASSINATURAS_SANTANDER.some(re => re.test(texto))) {
    d.modelo = 'Santander'; d.emissor = 'Banco Santander Totta';
    const b = marca(texto), p = PRODUTOS.find(([, re]) => re.test(texto));
    d.fimCartao = b.fim; d.produto = p ? (b.marca && !p[0].toLowerCase().includes(b.marca.toLowerCase()) ? `${p[0]} · ${b.marca}` : p[0]) : b.marca;
    cabecalho(d, texto); planos(d, texto); movimentos(d, texto);
  } else { cabecalho(d, texto); movimentos(d, texto); d.notas.push('Banco não reconhecido: confirme os valores'); }
  // o saldo em dívida inclui os saldos dos planos PagaSimples (confirmado pelo montante a pagar: % do rotativo + prestações dos planos);
  // se o saldo for menor do que os planos, os planos já não estão lá incluídos
  const somaPlanos = d.planos.reduce((s, p) => s + (p.saldo || 0), 0), prestPlanos = d.planos.reduce((s, p) => s + (p.prestacao || 0), 0);
  const r2 = v => Math.round(v * 100) / 100;
  d.rotativo = d.saldo == null ? null : r2(d.saldo >= somaPlanos - 0.01 ? d.saldo - somaPlanos : d.saldo);
  const base = d.pagar != null ? d.pagar : d.minimo;
  d.prestacaoCartao = base == null ? null : r2(Math.max(0, base - (d.saldo >= somaPlanos - 0.01 ? prestPlanos : 0)));
  if (d.planos.length && d.saldo != null) d.notas.push(d.saldo >= somaPlanos - 0.01 ? 'Saldo do cartão e prestação calculados sem os planos PagaSimples (que ficam como dívidas próprias)' : 'Os planos PagaSimples não estão incluídos no saldo deste extrato');
  return d;
}

SPAP.leitorExtratos = { analisar };
})();
