/* =========================================================
   LEITOR DE RECIBOS DE VENCIMENTO (PDF / imagem)
   Porta de src/ocr (parser_pt.py, normalize.py, templates) do
   Planeador Financeiro. PDFs com texto são lidos diretamente
   (pdf.js); PDFs digitalizados e fotografias passam por OCR
   (Tesseract, português). As bibliotecas só são carregadas
   quando se lê o primeiro recibo.
   ========================================================= */
(function () {
'use strict';
const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/';
const TESS = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
const carregados = {};
const script = src => carregados[src] || (carregados[src] = new Promise((ok, falha) => {
  const s = document.createElement('script'); s.src = src; s.onload = ok;
  s.onerror = () => { delete carregados[src]; falha(new Error('Não foi possível carregar o leitor de PDF. É preciso ligação à Internet na primeira leitura.')); };
  document.head.appendChild(s);
}));
async function pdfjs() { await script(PDFJS + 'pdf.min.js'); const p = window.pdfjsLib; p.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js'; return p; }

/* ---------- Números em formato PT (normalize.py) ---------- */
const NUMBER_RE = /-?[\d.\s]*\d\s*[,]\s*\d{2}|-?\d+\.\d{2}/g;
const NUMBER_LOOSE_RE = /-?(?:\d{1,3}(?:[.\s]\d{3})+|\d{1,6})\s\d{2}(?!\d)/g;
function numeroPT(token) {
  if (token == null) return null;
  let s = String(token).replace('€', '').trim();
  if (s.includes(',') || /\d\.\d{2}\b/.test(s)) s = s.replace(/\s/g, '');
  if (!s) return null;
  let sinal = 1; if (s.startsWith('-')) { sinal = -1; s = s.slice(1); }
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const v = Number(s); return Number.isFinite(v) ? sinal * v : null;
}
function numeroSolto(token) {
  let s = String(token).replace('€', '').trim(), sinal = 1; if (s.startsWith('-')) { sinal = -1; s = s.slice(1); }
  const p = s.match(/\d+/g) || []; if (p.length < 2 || p[p.length - 1].length !== 2) return null;
  return sinal * Number(p.slice(0, -1).join('') + '.' + p[p.length - 1]);
}
function primeiroNumero(t) {
  if (!t) return null;
  for (const m of t.match(NUMBER_RE) || []) { const v = numeroPT(m); if (v != null) return v; }
  const m = t.match(new RegExp(NUMBER_LOOSE_RE.source)); return m ? numeroSolto(m[0]) : null;
}
function ultimoNumero(t) {
  if (!t) return null;
  const estritos = [...t.matchAll(NUMBER_RE)], c = [];
  estritos.forEach(m => { const v = numeroPT(m[0]); if (v != null) c.push([m.index + m[0].length, v]); });
  [...t.matchAll(NUMBER_LOOSE_RE)].forEach(m => {
    if (estritos.some(e => e.index <= m.index && m.index < e.index + e[0].length)) return;
    const v = numeroSolto(m[0]); if (v != null) c.push([m.index + m[0].length, v]);
  });
  if (!c.length) return null; c.sort((a, b) => a[0] - b[0]); return c[c.length - 1][1];
}

/* ---------- Modelos por entidade patronal (templates/*.json) ---------- */
const MODELOS = [
  { id: 'joaquim-chaves', nome: 'Joaquim Chaves Clínicas Médicas', prioridade: 100, irsPorDiferenca: true, assinaturas: [/Joaquim\s+Chaves/i, /502157640/i],
    campos: {
      nifEntidade: { tipo: 'constante', valor: '502157640' },
      entidade: { tipo: 'constante', valor: 'Joaquim Chaves Clínicas Médicas' },
      bruto: { tipo: 'captura', re: /(?:Descontos\s+Legais|Participa[çc][ãa]o\s+Resultados[^\n\d]*?)\s*([\d.\s]+,\d{2})/im },
      liquido: { tipo: 'ultimo', re: /Total\s+L[ií]quido/im },
      // todas as linhas de retenção: a do mês, acertos de meses anteriores ("- 2026/01") e a dos subsídios
      irs: { tipo: 'somaLinhas', re: /Reten[çc][ãa]o\s+do\s+IRS/im },
      ss: { tipo: 'somaLinhas', re: /Contribui[çc][ãa]o\s+TSU/im },
      periodo: { tipo: 'periodo', re: /Per[ií]odo\s+de\s+Proc.*?(\d{1,2})\/(\d{1,2})\/(20\d{2})/im, mes: 2, ano: 3 },
      subFerias: { tipo: 'presenca', re: /Subs[ií]dio\s+(de\s+)?F[ée]rias/im },
      subNatal: { tipo: 'presenca', re: /Subs[ií]dio\s+(de\s+)?Natal/im },
      subFeriasValor: { tipo: 'ultimo', re: /Subs[ií]dio\s+(de\s+)?F[ée]rias/im },
      subNatalValor: { tipo: 'ultimo', re: /Subs[ií]dio\s+(de\s+)?Natal/im },
      refeicaoDias: { tipo: 'captura', re: /Ticket\s+Refei[çc][ãa]o\s+Isento\s+(\d{1,2}),00\s/im },
      refeicaoDia: { tipo: 'captura', re: /Ticket\s+Refei[çc][ãa]o\s+Isento\s+\d{1,2},00\s+(\d+,\d{2})/im },
      refeicao: { tipo: 'ultimo', re: /Ticket\s+Refei[çc][ãa]o\s+Isento\s+\d/im },
    } },
  { id: 'generico', nome: 'Genérico PT', prioridade: 0, assinaturas: [/(recibo|vencimento|sal[áa]rio)/i],
    campos: {
      bruto: { tipo: 'ultimo', re: /(vencimento\s+il[ií]quido|total\s+bruto|remunera[çc][ãa]o\s+il[ií]quida)/im },
      liquido: { tipo: 'ultimo', re: /(l[ií]quido\s+(a\s+)?receber|total\s+l[ií]quido|valor\s+a\s+receber)/im },
      irs: { tipo: 'ultimo', re: /(IRS|reten[çc][ãa]o\s+(na\s+)?fonte)/im },
      ss: { tipo: 'ultimo', re: /(seg(uran[çc]a)?\.?\s*social|TSU|contribui[çc][ãa]o)/im },
      periodo: { tipo: 'periodo', re: /(\d{1,2})[/\-.](20\d{2})/im, mes: 1, ano: 2 },
      subFerias: { tipo: 'presenca', re: /subs[ií]dio\s+(de\s+)?f[ée]rias/im },
      subNatal: { tipo: 'presenca', re: /subs[ií]dio\s+(de\s+)?natal/im },
      subFeriasValor: { tipo: 'ultimo', re: /subs[ií]dio\s+(de\s+)?f[ée]rias/im },
      subNatalValor: { tipo: 'ultimo', re: /subs[ií]dio\s+(de\s+)?natal/im },
      refeicao: { tipo: 'ultimo', re: /(subs[ií]dio|ticket|cart[ãa]o)\s+(de\s+)?(refei[çc][ãa]o|alimenta[çc][ãa]o)/im },
    } },
];
function aplicarRegra(r, texto) {
  const linhas = texto.split('\n');
  if (r.tipo === 'constante') return r.valor;
  if (r.tipo === 'presenca') return r.re.test(texto);
  if (r.tipo === 'periodo') { const m = texto.match(r.re); if (!m) return null; const a = +m[r.ano], ms = +m[r.mes]; return a && ms >= 1 && ms <= 12 ? [a, ms] : null; }
  if (r.tipo === 'captura') { const m = texto.match(r.re); return m && m[1] != null ? numeroPT(m[1]) : null; }
  if (r.tipo === 'somaCaptura' || r.tipo === 'somaLinhas') {
    let t = 0, achou = false;
    linhas.forEach(l => { let v = null; if (r.tipo === 'somaCaptura') { const m = l.match(r.re); if (m) v = numeroPT(m[1]); } else if (r.re.test(l)) v = ultimoNumero(l); if (v != null) { t += v; achou = true; } });
    return achou ? t : null;
  }
  const pick = r.tipo === 'primeiro' ? primeiroNumero : ultimoNumero;
  for (const l of linhas) if (r.re.test(l)) { const v = pick(l); if (v != null) return v; }
  return null;
}

/* ---------- Parser genérico linha a linha (parser_pt.py) ---------- */
const MESES_PT = { janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12 };
const PADROES = [['bruto', /(vencimento\s+il[ií]quido|total\s+bruto|remunera[çc][ãa]o\s+ilíquida)/i], ['base', /(vencimento\s+base|sal[áa]rio\s+base|remunera[çc][ãa]o\s+base)/i],
  ['liquido', /(l[ií]quido\s+(a\s+)?receber|total\s+l[ií]quido|valor\s+a\s+receber)/i], ['irs', /(irs|reten[çc][ãa]o\s+(na\s+)?fonte)/i],
  ['ss', /(seg(uran[çc]a)?\.?\s*social|tsu|contribui[çc][ãa]o)/i], ['ferias', /(subs[ií]dio\s+(de\s+)?f[ée]rias)/i], ['natal', /(subs[ií]dio\s+(de\s+)?natal)/i]];
function periodo(texto) {
  const m = texto.toLowerCase().match(/(janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)[\s/\-.de]+(20\d{2})/);
  if (m) return [+m[2], MESES_PT[m[1].replace('ç', 'c')]];
  const d = texto.match(/(0?[1-9]|1[0-2])[/\-.](20\d{2})/); return d ? [+d[2], +d[1]] : [null, null];
}
const NIF_RE = /\b([1235689]\d{8})\b/g;
const PATRAO_RE = /(entidade\s+patronal|entidade\s+empregadora|empregador|empresa|patr[ãa]o|nif\s+empresa|contribuinte\s+empresa|nif\s+entidade|nipc|n[º°o]?\s*contribuinte|\bs\.?a\.?\b|\blda\.?\b|\bsociedade\b|\bsarl\b|\bunipessoal\b)/i;
const TRABALHADOR_RE = /(trabalhador|funcion[áa]rio|colaborador|nif\s+trabalhador|contribuinte\s+(do\s+)?(trabalhador|funcion[áa]rio)|titular)/i;
function nifEntidade(texto, nifProprio) {
  const escolher = l => { const ns = [...l.matchAll(NIF_RE)].map(m => m[1]).filter(n => n !== nifProprio); return ns.find(n => n[0] === '5') || ns[0] || null; };
  const ls = texto.split('\n').map(l => l.trim()).filter(Boolean);
  for (let i = 0; i < ls.length; i++) if (PATRAO_RE.test(ls[i]) && !TRABALHADOR_RE.test(ls[i])) { const n = escolher(ls[i]) || (ls[i + 1] ? escolher(ls[i + 1]) : null); if (n) return n; }
  for (const l of ls) { if (TRABALHADOR_RE.test(l)) continue; for (const m of l.matchAll(NIF_RE)) if (m[1] !== nifProprio && m[1][0] === '5') return m[1]; }
  for (const m of texto.matchAll(NIF_RE)) if (m[1] !== nifProprio && m[1][0] === '5') return m[1];
  return null;
}

function analisar(texto, { nifProprio } = {}) {
  const d = { ano: null, mes: null, bruto: null, liquido: null, irs: null, ss: null, refeicao: null, refeicaoDia: null, refeicaoDias: null,
    subFerias: false, subNatal: false, subFeriasValor: null, subNatalValor: null, nifEntidade: null, entidade: '', modelo: null, notas: [] };
  if (!texto || !texto.trim()) return d;
  // fase 1: modelo da entidade patronal (o de maior prioridade que reconhece o recibo)
  const mod = MODELOS.filter(m => m.assinaturas.every(a => a.test(texto))).sort((a, b) => b.prioridade - a.prioridade)[0];
  if (mod) {
    d.modelo = mod.nome;
    Object.entries(mod.campos).forEach(([k, r]) => { let v = null; try { v = aplicarRegra(r, texto); } catch (e) { } if (v == null || v === '') return;
      if (k === 'periodo') { d.ano = v[0]; d.mes = v[1]; } else d[k] = v; });
    if (d.refeicao == null && d.refeicaoDia && d.refeicaoDias) d.refeicao = d.refeicaoDia * d.refeicaoDias;
    if (mod.irsPorDiferenca && d.irs == null && !/Reten[çc][ãa]o\s+do\s+IRS/i.test(texto)) { d.irs = 0; d.notas.push('Sem retenção de IRS neste recibo'); }
    if (mod.irsPorDiferenca && d.irs == null && d.bruto != null && d.liquido != null) {
      const x = Math.round((d.bruto - d.liquido - (d.ss || 0)) * 100) / 100; if (x > 0 && x < d.bruto) { d.irs = x; d.notas.push('IRS calculado por bruto − líquido − SS'); }
    }
  }
  // fase 2: parser genérico preenche o que faltar
  if (!d.ano || !d.mes) { const [a, m] = periodo(texto); d.ano = d.ano || a; d.mes = d.mes || m; }
  let base = null;
  texto.split('\n').forEach(l0 => { const l = l0.trim(); if (!l) return;
    for (const [k, re] of PADROES) { const m = l.match(re); if (!m) continue;
      const depois = l.slice(m.index + m[0].length); let v = depois.trim() ? ultimoNumero(depois) : null; if (v == null) v = ultimoNumero(l); if (v == null) continue;
      if (k === 'base') { if (base == null) base = v; }
      else if (k === 'ferias') { d.subFerias = true; if (d.subFeriasValor == null) d.subFeriasValor = v; }
      else if (k === 'natal') { d.subNatal = true; if (d.subNatalValor == null) d.subNatalValor = v; }
      else if (d[k] == null) d[k] = v;
      break; } });
  if (d.bruto == null && base != null) { d.bruto = base; d.notas.push('bruto = vencimento base'); }
  if (!d.nifEntidade) d.nifEntidade = nifEntidade(texto, nifProprio);
  ['bruto', 'liquido', 'irs', 'ss', 'refeicao', 'subFeriasValor', 'subNatalValor'].forEach(k => { if (d[k] != null) d[k] = Math.round(Math.abs(d[k]) * 100) / 100; });
  return d;
}

/* ---------- Extração de texto ---------- */
// junta os pedaços de texto do pdf.js em linhas (mesma altura na página), da esquerda para a direita
function linhasDaPagina(items) {
  const ls = [];
  items.filter(i => i.str && i.str.trim()).forEach(i => { const x = i.transform[4], y = i.transform[5];
    let l = ls.find(z => Math.abs(z.y - y) <= 2.5); if (!l) { l = { y, p: [] }; ls.push(l); } l.p.push({ x, s: i.str }); });
  return ls.sort((a, b) => b.y - a.y).map(l => l.p.sort((a, b) => a.x - b.x).map(p => p.s.trim()).join(' ')).join('\n');
}
async function ocr(imagens, progresso) {
  await script(TESS);
  const w = await window.Tesseract.createWorker('por', 1, { logger: m => { if (progresso && m.status === 'recognizing text') progresso(`A reconhecer texto (OCR) · ${Math.round(m.progress * 100)}%`); } });
  try { const out = []; for (const img of imagens) out.push((await w.recognize(img)).data.text); return out.join('\n'); } finally { await w.terminate(); }
}
async function lerTexto(ficheiro, progresso = () => { }) {
  const nome = (ficheiro.name || '').toLowerCase();
  if (nome.endsWith('.pdf') || ficheiro.type === 'application/pdf') {
    progresso('A abrir o PDF…');
    const lib = await pdfjs(), doc = await lib.getDocument({ data: new Uint8Array(await ficheiro.arrayBuffer()) }).promise, pags = [];
    for (let n = 1; n <= doc.numPages; n++) pags.push(linhasDaPagina((await (await doc.getPage(n)).getTextContent()).items));
    const texto = pags.join('\n');
    if (texto.replace(/\s/g, '').length > 40) return { texto, metodo: 'texto do PDF' };
    // PDF digitalizado: desenha cada página e faz OCR
    const imgs = [];
    for (let n = 1; n <= Math.min(doc.numPages, 4); n++) { const pg = await doc.getPage(n), vp = pg.getViewport({ scale: 2.5 }), c = document.createElement('canvas');
      c.width = vp.width; c.height = vp.height; await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise; imgs.push(c); }
    progresso('PDF digitalizado: a preparar o OCR…');
    return { texto: await ocr(imgs, progresso), metodo: 'OCR' };
  }
  if ((ficheiro.type || '').startsWith('image/')) { progresso('A preparar o OCR…'); return { texto: await ocr([ficheiro], progresso), metodo: 'OCR' }; }
  throw new Error('Formato não suportado: use PDF, JPG ou PNG.');
}

SPAP.leitorRecibos = { lerTexto, analisar, linhasDaPagina, numeroPT, ultimoNumero, MODELOS };
})();
