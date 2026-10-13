/* =========================================================
   SPAP — Sistema de Pedidos e Autorização de Pagamentos
   Núcleo partilhado entre Elite Sound e BXB Investimentos.
   - Utilizadores com PIN (hash SHA-256 com sal) e perfis
   - Alçadas, dupla aprovação, segregação de funções
   - Saldos, saldo cativo, extratos (contabilidade por movimentos)
   - Orçamentos por categoria
   - Registo de auditoria encadeado por hash (imutável)
   ========================================================= */
(function (global) {
'use strict';

/* ---------------- SHA-256 (síncrono, sem dependências) ---------------- */
function sha256(str) {
  let ascii = unescape(encodeURIComponent(String(str)));
  const rr = (v, a) => (v >>> a) | (v << (32 - a));
  const maxWord = Math.pow(2, 32);
  let result = '', i, j;
  const words = [], bitLen = ascii.length * 8;
  let hash = sha256.h = sha256.h || [];
  const k = sha256.k = sha256.k || [];
  let primeCounter = k.length;
  const isComposite = {};
  for (let c = 2; primeCounter < 64; c++) {
    if (!isComposite[c]) {
      for (i = 0; i < 313; i += c) isComposite[i] = c;
      hash[primeCounter] = (Math.pow(c, .5) * maxWord) | 0;
      k[primeCounter++] = (Math.pow(c, 1 / 3) * maxWord) | 0;
    }
  }
  ascii += '\x80';
  while (ascii.length % 64 - 56) ascii += '\x00';
  for (i = 0; i < ascii.length; i++) {
    j = ascii.charCodeAt(i);
    words[i >> 2] |= j << ((3 - i) % 4) * 8;
  }
  words[words.length] = ((bitLen / maxWord) | 0);
  words[words.length] = bitLen;
  for (j = 0; j < words.length;) {
    const w = words.slice(j, j += 16);
    const old = hash;
    hash = hash.slice(0, 8);
    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15], w2 = w[i - 2];
      const a = hash[0], e = hash[4];
      const t1 = hash[7] + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & hash[5]) ^ ((~e) & hash[6])) + k[i] +
        (w[i] = (i < 16) ? w[i] : (w[i - 16] + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0);
      const t2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(t1 + t2) | 0].concat(hash);
      hash[4] = (hash[4] + t1) | 0;
    }
    for (i = 0; i < 8; i++) hash[i] = (hash[i] + old[i]) | 0;
  }
  for (i = 0; i < 8; i++) for (j = 3; j + 1; j--) {
    const b = (hash[i] >> (j * 8)) & 255;
    result += ((b < 16) ? 0 : '') + b.toString(16);
  }
  return result;
}

/* ---------------- Utilitários ---------------- */
const SPAP = global.SPAP = {};
SPAP.sha256 = sha256;
const fmtEUR = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' });
const r2 = v => Math.round((+v || 0) * 100) / 100;
const eur = v => fmtEUR.format(+v || 0);
const pct = v => ((+v || 0) * 100).toLocaleString('pt-PT', { maximumFractionDigits: 2 }) + '%';
const date = d => d ? new Date(String(d).length === 10 ? d + 'T12:00:00' : d).toLocaleDateString('pt-PT') : '—';
const dt = d => d ? new Date(d).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' }) : '—';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const today = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const ym = d => String(d || '').slice(0, 7);
const addMonths = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 10); };
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const MES3 = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const initials = n => String(n || '?').split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
Object.assign(SPAP, { r2, eur, pct, date, dt, esc, uid, today, ym, addMonths, MESES, MES3, initials });

SPAP.download = (name, content, type = 'application/json') => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
};
SPAP.csv = (name, rows) => {
  const body = rows.map(r => r.map(c => {
    const s = typeof c === 'number' ? String(c).replace('.', ',') : String(c ?? '');
    return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(';')).join('\r\n');
  SPAP.download(name, '﻿' + body, 'text/csv;charset=utf-8');
};

/* ---------------- Ícones ---------------- */
const ICONS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  check: 'M20 6 9 17l-5-5',
  x: 'M18 6 6 18M6 6l12 12',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 7v5l3 2',
  wallet: 'M3 7a2 2 0 0 1 2-2h13v4M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2zM16 14h.01',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  settings: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  plus: 'M12 5v14M5 12h14',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  print: 'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z',
  chart: 'M3 3v18h18M7 16v-4M12 16V8M17 16v-7',
  speaker: 'M5 2h14a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM12 18a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 6h.01',
  building: 'M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 10h.01M15 10h.01',
  credit: 'M2 7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zM2 10h20M6 15h4',
  coins: 'M9 14a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM18.1 10.4A6 6 0 1 1 10.4 18.1M7 6h2v4',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 13h6M9 17h6',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z',
  menu: 'M3 6h18M3 12h18M3 18h18',
  arrow: 'M5 12h14M13 5l7 7-7 7',
  alert: 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01',
  layers: 'M12 2 2 7l10 5 10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  percent: 'M19 5 5 19M6.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM17.5 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  calendar: 'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM16 2v4M8 2v4M3 10h18',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  target: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  inbox: 'M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z',
  swap: 'M16 3l4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16',
  pie: 'M21.2 15.9A10 10 0 1 1 8 2.8M22 12A10 10 0 0 0 12 2v10z',
  pen: 'M12 19l7-7 3 3-7 7-3-3zM18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5zM2 2l7.586 7.586M11 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  qr: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM20 14h1v1M14 20h1v1M17 17h4v4h-4z',
  key: 'M21 2l-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.8 7.8 5.5 5.5 0 0 1 7.8-7.8zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4',
};
const icon = SPAP.icon = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${ICONS[n] || ICONS.file}"/></svg>`;

/* ---------------- UI: toasts, modais, gráficos ---------------- */
const ui = SPAP.ui = {};
ui.toast = (msg, kind = '') => {
  let box = document.getElementById('toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.className = 'toasts'; document.body.appendChild(box); }
  const t = document.createElement('div'); t.className = 'toast ' + kind; t.innerHTML = msg; box.appendChild(t);
  setTimeout(() => { t.style.transition = '.3s'; t.style.opacity = 0; setTimeout(() => t.remove(), 300); }, 3800);
};
ui.modal = ({ title, sub = '', body = '', actions = [], wide = false, locked = false, onOpen }) => {
  const ov = document.createElement('div'); ov.className = 'overlay';
  ov.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">
    <div class="modal-h"><div><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}</div>${locked ? '' : `<button class="btn ghost icon" data-x aria-label="Fechar">${icon('x')}</button>`}</div>
    <div class="modal-b">${body}</div>
    <div class="modal-f"></div></div>`;
  const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape' && !locked) close(); };
  document.addEventListener('keydown', onKey);
  if (!locked) { ov.addEventListener('mousedown', e => { if (e.target === ov) close(); }); ov.querySelector('[data-x]').onclick = close; }
  const foot = ov.querySelector('.modal-f');
  actions.forEach(a => {
    const b = document.createElement('button'); b.className = 'btn ' + (a.kind || ''); b.innerHTML = a.label;
    b.onclick = async () => { if (a.onClick) { const r = await a.onClick(ov, close); if (r !== false && a.close !== false) close(); } else close(); };
    foot.appendChild(b);
  });
  document.body.appendChild(ov);
  const f = ov.querySelector('input:not([type=hidden]):not([readonly]),select,textarea'); if (f) setTimeout(() => f.focus(), 30);
  const form = ov.querySelector('form');
  if (form) form.addEventListener('submit', e => { e.preventDefault(); const p = foot.querySelector('.primary,.ok'); if (p) p.click(); });
  if (onOpen) onOpen(ov, close);
  return { el: ov, close };
};
ui.confirm = (title, text, { okLabel = 'Confirmar', danger = false } = {}) => new Promise(res => {
  ui.modal({ title, body: `<p class="muted" style="margin:0">${text}</p>`, actions: [
    { label: 'Cancelar', kind: 'ghost', onClick: () => res(false) },
    { label: okLabel, kind: danger ? 'bad' : 'primary', onClick: () => res(true) }] });
});
ui.formData = el => {
  const o = {}; el.querySelectorAll('[name]').forEach(i => {
    if (i.type === 'checkbox') o[i.name] = i.checked;
    else if (i.type === 'file') return;
    else o[i.name] = i.value.trim();
  }); return o;
};
ui.estadoBadge = e => { const s = ESTADOS[e] || { label: e, cls: '' }; return `<span class="badge ${s.cls}">${s.label}</span>`; };

/* tooltip global para gráficos */
// (i) e outros elementos com data-tip: teclado (foco) e toque também mostram a explicação
const mostrarTip = (t, x, y) => { let tip = document.getElementById('chart-tip'); if (!tip) { tip = document.createElement('div'); tip.id = 'chart-tip'; tip.className = 'chart-tip'; document.body.appendChild(tip); }
  tip.innerHTML = t.getAttribute('data-tip'); tip.style.display = 'block'; tip.style.left = Math.max(8, Math.min(x, innerWidth - tip.offsetWidth - 8)) + 'px'; tip.style.top = Math.min(y, innerHeight - tip.offsetHeight - 8) + 'px'; };
const esconderTip = () => { const tip = document.getElementById('chart-tip'); if (tip) tip.style.display = 'none'; };
document.addEventListener('focusin', e => { const t = e.target.closest && e.target.closest('[data-tip]'); if (!t) return; const r = t.getBoundingClientRect(); mostrarTip(t, r.left, r.bottom + 8); });
document.addEventListener('focusout', esconderTip);
document.addEventListener('touchstart', e => { const t = e.target.closest && e.target.closest('.info-tip[data-tip]'); if (!t) return esconderTip(); const r = t.getBoundingClientRect(); mostrarTip(t, r.left - 120, r.bottom + 8); }, { passive: true });
document.addEventListener('keydown', e => { if (e.key === 'Escape') esconderTip(); });
document.addEventListener('mousemove', e => {
  const t = e.target.closest && e.target.closest('[data-tip]');
  let tip = document.getElementById('chart-tip');
  if (!t) { if (tip) tip.style.display = 'none'; return; }
  if (!tip) { tip = document.createElement('div'); tip.id = 'chart-tip'; tip.className = 'chart-tip'; document.body.appendChild(tip); }
  tip.innerHTML = t.getAttribute('data-tip'); tip.style.display = 'block';
  tip.style.left = Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 8) + 'px'; tip.style.top = (e.clientY + 14) + 'px';
});

const PALETTE = ['var(--accent)', 'var(--accent2)', 'var(--info)', 'var(--ok)', 'var(--warn)', 'var(--bad)'];
const niceStep = x => { if (x <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(x))); const f = x / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; };
const kfmt = v => Math.abs(v) >= 1000 ? (v / 1000).toLocaleString('pt-PT', { maximumFractionDigits: 1 }) + 'k' : v.toLocaleString('pt-PT', { maximumFractionDigits: 0 });
SPAP.chart = {
  bars(el, { labels, series, height = 240, stacked = false, fmt = eur }) {
    const W = 760, H = height, pl = 48, pr = 8, pt = 10, pb = 24;
    series.forEach((s, i) => s.color = s.color || PALETTE[i % PALETTE.length]);
    let vals = stacked ? labels.flatMap((_, i) => [series.reduce((a, s) => a + Math.max(0, s.values[i] || 0), 0), series.reduce((a, s) => a + Math.min(0, s.values[i] || 0), 0)]) : series.flatMap(s => s.values.map(v => +v || 0));
    let max = Math.max(0, ...vals), min = Math.min(0, ...vals);
    if (max === min) max = 4;
    const step = niceStep((max - min) / 4); max = Math.ceil(max / step) * step; min = Math.floor(min / step) * step;
    const y = v => pt + (max - v) / (max - min) * (H - pt - pb);
    const gw = (W - pl - pr) / labels.length;
    let g = '';
    for (let v = min; v <= max + 1e-9; v += step) g += `<line class="gridl" x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${pl - 8}" y="${y(v) + 3.5}" text-anchor="end">${kfmt(v)}</text>`;
    labels.forEach((l, i) => {
      const x0 = pl + gw * i;
      g += `<text class="axis" x="${x0 + gw / 2}" y="${H - 6}" text-anchor="middle">${esc(l)}</text>`;
      if (stacked) {
        let up = 0, dn = 0; const bw = Math.min(34, gw * .56), bx = x0 + (gw - bw) / 2;
        series.forEach(s => {
          const v = +s.values[i] || 0; if (!v) return;
          const a = v > 0 ? up : dn, b = a + v; if (v > 0) up = b; else dn = b;
          const yt = y(Math.max(a, b)), hh = Math.max(1, Math.abs(y(a) - y(b)));
          g += `<rect x="${bx}" y="${yt}" width="${bw}" height="${hh}" rx="3" style="fill:${s.color}" data-tip="<b>${esc(l)}</b><br>${esc(s.name)}: ${fmt(v)}"/>`;
        });
      } else {
        const inner = gw * .74, bw = Math.min(26, inner / series.length), off = (gw - bw * series.length) / 2;
        series.forEach((s, k) => {
          const v = +s.values[i] || 0; const yt = y(Math.max(0, v)), hh = Math.max(v ? 1.5 : 0, Math.abs(y(0) - y(v)));
          g += `<rect x="${x0 + off + k * bw + 1}" y="${yt}" width="${bw - 2}" height="${hh}" rx="3" style="fill:${s.color}" data-tip="<b>${esc(l)}</b><br>${esc(s.name)}: ${fmt(v)}"/>`;
        });
      }
    });
    g += `<line x1="${pl}" x2="${W - pr}" y1="${y(0)}" y2="${y(0)}" style="stroke:var(--line2)"/>`;
    el.classList.add('chart');
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${g}</svg>` +
      (series.length > 1 ? `<div class="legend">${series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>` : '');
  },
  linha(el, { labels, series, height = 230, fmt = eur }) {
    const W = 760, H = height, pl = 52, pr = 12, pt = 12, pb = 26;
    series.forEach((s, i) => s.color = s.color || PALETTE[i % PALETTE.length]);
    const vals = series.flatMap(s => s.values.map(v => +v || 0)); let max = Math.max(0, ...vals), min = Math.min(0, ...vals); if (max === min) max = 4;
    const step = niceStep((max - min) / 4); max = Math.ceil(max / step) * step; min = Math.floor(min / step) * step;
    const y = v => pt + (max - v) / (max - min) * (H - pt - pb), n = labels.length, x = i => pl + (n === 1 ? (W - pl - pr) / 2 : i * (W - pl - pr) / (n - 1));
    let g = '';
    for (let v = min; v <= max + 1e-9; v += step) g += `<line class="gridl" x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${pl - 8}" y="${y(v) + 3.5}" text-anchor="end">${kfmt(v)}</text>`;
    labels.forEach((l, i) => { if (n <= 14 || i % Math.ceil(n / 12) === 0) g += `<text class="axis" x="${x(i)}" y="${H - 7}" text-anchor="middle">${esc(l)}</text>`; });
    g += `<line x1="${pl}" x2="${W - pr}" y1="${y(0)}" y2="${y(0)}" style="stroke:var(--line2)"/>`;
    series.forEach(s => {
      const pts = s.values.map((v, i) => `${x(i)},${y(+v || 0)}`).join(' ');
      if (!s.dash && series.length <= 3) g += `<polygon points="${x(0)},${y(0)} ${pts} ${x(n - 1)},${y(0)}" style="fill:${s.color};opacity:.08"/>`;
      g += `<polyline points="${pts}" fill="none" style="stroke:${s.color};stroke-width:${s.dash ? 1.6 : 2.4};${s.dash ? 'stroke-dasharray:6 5;' : ''}" stroke-linejoin="round" stroke-linecap="round"/>`;
      if (!s.dash) s.values.forEach((v, i) => { g += `<circle cx="${x(i)}" cy="${y(+v || 0)}" r="${i === n - 1 ? 4.5 : 3}" style="fill:${s.color};stroke:var(--panel);stroke-width:1.5" data-tip="<b>${esc(labels[i])}</b><br>${esc(s.name)}: ${fmt(+v || 0)}"/>`; });
    });
    el.classList.add('chart');
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${g}</svg><div class="legend">${series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>`;
  },
  donut(el, { items, center = '', sub = '', fmt = eur }) {
    const tot = items.reduce((a, i) => a + Math.max(0, +i.value || 0), 0);
    const R = 62, C = 2 * Math.PI * R; let off = 0, g = '';
    items.forEach((it, i) => {
      it.color = it.color || PALETTE[i % PALETTE.length];
      const f = tot ? Math.max(0, it.value) / tot : 0; if (!f) return;
      g += `<circle cx="90" cy="90" r="${R}" fill="none" stroke-width="22" style="stroke:${it.color}" stroke-dasharray="${f * C} ${C}" stroke-dashoffset="${-off * C}" transform="rotate(-90 90 90)" data-tip="${esc(it.label)}: ${fmt(it.value)} (${pct(f)})"/>`;
      off += f;
    });
    if (!tot) g = `<circle cx="90" cy="90" r="${R}" fill="none" stroke-width="22" style="stroke:var(--panel3)"/>`;
    el.classList.add('chart');
    el.innerHTML = `<div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap"><svg viewBox="0 0 180 180" style="width:170px;flex:none">${g}
      <text x="90" y="88" text-anchor="middle" style="fill:var(--text);font-weight:750;font-size:17px">${esc(center)}</text>
      <text x="90" y="106" text-anchor="middle" class="axis">${esc(sub)}</text></svg>
      <div style="display:grid;gap:8px;flex:1;min-width:150px">${items.map(it => `<div class="row between" style="font-size:13px"><span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${it.color};margin-right:8px"></i>${esc(it.label)}</span><b class="num">${fmt(it.value)}</b></div>`).join('')}</div></div>`;
  },
};

/* ---------------- Modelo de autorização ---------------- */
const ESTADOS = SPAP.ESTADOS = {
  PENDENTE: { label: 'Pendente', cls: 'warn' },
  EM_APROVACAO: { label: 'Em aprovação', cls: 'info' },
  APROVADO: { label: 'Aprovado · a executar', cls: 'acc' },
  EXECUTADO: { label: 'Executado', cls: 'ok' },
  REJEITADO: { label: 'Rejeitado', cls: 'bad' },
  CANCELADO: { label: 'Cancelado', cls: '' },
};
const ROLES = SPAP.ROLES = {
  ADMIN: { label: 'Administrador', perms: ['criar', 'aprovar', 'executar', 'ver_todos', 'auditoria', 'admin', 'contas'] },
  APROVADOR: { label: 'Aprovador', perms: ['criar', 'aprovar', 'ver_todos'] },
  TESOURARIA: { label: 'Tesouraria', perms: ['criar', 'executar', 'ver_todos', 'contas'] },
  OPERADOR: { label: 'Operador', perms: ['criar'] },
  AUDITOR: { label: 'Auditor', perms: ['ver_todos', 'auditoria'] },
};
const CATEGORIAS_BASE = ['PAGAMENTO DE ENCARGOS E TAXAS', 'LIQUIDAÇÃO DE CRÉDITO', 'MENSALIDADE / PRESTAÇÃO', 'AQUISIÇÃO DE BENS E SERVIÇOS',
  'PAGAMENTO DE COMISSÕES', 'DISTRIBUIÇÃO DE RESULTADOS', 'TRANSFERÊNCIA INTERNA', 'APLICAÇÃO / INVESTIMENTO', 'REEMBOLSO DE DESPESAS', 'ENTRADA DE FUNDOS', 'OUTROS'];
const METODOS_BASE = ['DÉBITO', 'TRANSFERÊNCIA INTERNA', 'COMPENSAÇÃO INTERNA', 'CAPITALIZAÇÃO', 'REGULARIZAÇÃO'];
const ENTRADA = 'ENTRADA DE FUNDOS';

SPAP.createApp = function (cfg) {
  const KEY = 'spap:' + cfg.key;
  const app = { cfg, db: null, user: null, SPAP };
  let db;

  /* ---------- Persistência ---------- */
  function freshDb() {
    const d = {
      meta: { versao: 3, empresa: cfg.nome, criadoEm: new Date().toISOString(), seqReq: 0, seqAut: 0, locks: {} },
      settings: { segregacao: false, duplaAcima: 1000, bloquearSemSaldo: true, autoLockMin: 10, reqStep: 1, autStep: 1, prefixoAut: '7104984' },
      users: [], contas: [], pedidos: [], movimentos: [], orcamentos: [], audit: [],
      categorias: CATEGORIAS_BASE.slice(), metodos: METODOS_BASE.slice(), mod: {},
    };
    app.db = db = d;
    cfg.seed(d, app);
    log('SISTEMA', 'Base de dados criada e dados migrados das folhas de cálculo');
    return d;
  }
  function load() {
    try { db = JSON.parse(localStorage.getItem(KEY)); } catch (e) { db = null; }
    if (!db || !db.meta) { freshDb(); save(); }
    app.db = db;
    if ((db.meta.versao || 1) < 2) {
      // correção: a alçada inicial da aprovadora era igual ao limite de dupla aprovação,
      // o que impedia a 2.ª aprovação de qualquer pedido acima desse limite
      const b = db.users.find(u => u.id === 'u_beatriz');
      if (b && cfg.alcadaPadrao && +b.limite === +db.settings.duplaAcima) { b.limite = cfg.alcadaPadrao; log('ALCADA_ALTERADA', `${b.username} · ${eur(cfg.alcadaPadrao)} (correção automática)`); }
      db.meta.versao = 2; save();
    }
    if (db.meta.versao < 3) {
      // todas as contas passam a internas; métodos bancários substituídos por métodos internos
      const ext = db.contas.filter(c => c.tipo !== 'INTERNA');
      ext.forEach(c => { c.tipo = 'INTERNA'; if (c.saldoInicial == null) c.saldoInicial = 0; });
      const mapa = { 'TRANSFERÊNCIA BANCÁRIA': 'TRANSFERÊNCIA INTERNA', 'MB WAY': 'TRANSFERÊNCIA INTERNA', 'CARTÃO DE CRÉDITO': 'DÉBITO', 'NUMERÁRIO': 'REGULARIZAÇÃO' };
      db.metodos = ['DÉBITO', 'TRANSFERÊNCIA INTERNA', 'COMPENSAÇÃO INTERNA', 'CAPITALIZAÇÃO', 'REGULARIZAÇÃO'];
      db.pedidos.forEach(p => { if (mapa[p.metodo] && ['PENDENTE', 'EM_APROVACAO', 'APROVADO'].includes(p.estado)) p.metodo = mapa[p.metodo]; });
      if (cfg.migrarV3) cfg.migrarV3(db);
      log('MIGRACAO', `Livro de contas interno: ${ext.length} conta(s) convertida(s) em internas; métodos bancários removidos`);
      db.meta.versao = 3; save();
    }
    if (cfg.migrar && cfg.migrar(db)) save();
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); }
    catch (e) { ui.toast('<b>Erro ao gravar:</b> armazenamento cheio. Exporte uma cópia e remova anexos grandes.', 'bad'); }
  }
  app.save = save;

  /* ---------- Auditoria encadeada ---------- */
  function log(acao, detalhe, ref) {
    const prev = db.audit.length ? db.audit[db.audit.length - 1].hash : 'GENESIS';
    const e = { ts: new Date().toISOString(), user: app.user ? app.user.username : 'sistema', acao, detalhe: String(detalhe || ''), ref: ref || null, prev };
    e.hash = sha256([prev, e.ts, e.user, acao, e.detalhe, e.ref || ''].join('|'));
    db.audit.push(e);
  }
  app.log = log;
  app.verifyChain = () => {
    let prev = 'GENESIS';
    for (let i = 0; i < db.audit.length; i++) {
      const e = db.audit[i];
      const h = sha256([prev, e.ts, e.user, e.acao, e.detalhe, e.ref || ''].join('|'));
      if (e.prev !== prev || e.hash !== h) return { ok: false, at: i };
      prev = e.hash;
    }
    return { ok: true, n: db.audit.length };
  };

  /* ---------- Utilizadores / autenticação ---------- */
  const hashPin = (pin, salt) => { let h = salt + ':' + pin; for (let i = 0; i < 1500; i++) h = sha256(h + salt); return h; };
  app.setPin = (u, pin) => { u.salt = uid() + uid(); u.pinHash = hashPin(pin, u.salt); };
  app.checkPin = (u, pin) => !!u.pinHash && hashPin(pin, u.salt) === u.pinHash;
  const can = app.can = (perm, u = app.user) => !!u && (ROLES[u.role] || { perms: [] }).perms.includes(perm);
  const userById = app.userById = id => db.users.find(u => u.id === id);
  const userName = id => (userById(id) || { nome: id || '—' }).nome;
  app.userName = userName;

  /* ---------- Contas e saldos ---------- */
  const conta = app.conta = id => db.contas.find(c => c.id === id);
  const nomeConta = app.nomeConta = id => { const c = conta(id); return c ? c.nome : (id || '—'); };
  // Todas as contas são internas: o sistema é um livro de contas interno (sem contas bancárias)
  app.contasInternas = (soAtivas = true) => db.contas.filter(c => !soAtivas || c.ativo !== false);
  const saldo = app.saldo = id => { const c = conta(id); return r2((c ? +c.saldoInicial || 0 : 0) + db.movimentos.reduce((s, m) => m.conta === id ? s + m.valor : s, 0)); };
  const cativo = app.cativo = (id, excl) => r2(db.pedidos.reduce((s, p) => p.contaOrigem === id && p.estado === 'APROVADO' && p.id !== excl ? s + p.valor : s, 0));
  const disponivel = app.disponivel = (id, excl) => r2(saldo(id) - cativo(id, excl));
  app.lancar = ({ conta: c, valor, descricao, data, pedido, tipo = 'MANUAL', ref }) => {
    if (app.dataFechada(data || today())) throw new Error(`Período fechado até ${date(app.ultimoFecho().data)}: não são aceites movimentos com data ${date(data || today())}`);
    const m = { id: uid(), data: data || today(), conta: c, valor: r2(valor), descricao, pedido: pedido || null, tipo, ref: ref || null, ts: new Date().toISOString() };
    db.movimentos.push(m); return m;
  };
  app.estornarRef = ref => {
    if (db.movimentos.some(m => m.ref === ref && app.dataFechada(m.data))) throw new Error(`Período fechado até ${date(app.ultimoFecho().data)}: o movimento já não pode ser alterado`);
    const n = db.movimentos.length; db.movimentos = db.movimentos.filter(m => m.ref !== ref); return n - db.movimentos.length; };

  /* ---------- Numeração ---------- */
  const nextReq = () => { db.meta.seqReq += (+db.settings.reqStep || 1); return String(db.meta.seqReq).padStart(4, '0') + '/2' + String(new Date().getFullYear()).slice(-2); };
  const nextAut = () => { db.meta.seqAut += (+db.settings.autStep || 1); return db.settings.prefixoAut + String(db.meta.seqAut).padStart(5, '0'); };

  /* ---------- Orçamentos ---------- */
  app.gastoCategoria = (cat, mes, excl) => r2(db.pedidos.reduce((s, p) => p.categoria === cat && ym(p.dataPrevista) === mes && p.id !== excl && !['REJEITADO', 'CANCELADO'].includes(p.estado) ? s + p.valor : s, 0));
  app.orcamento = cat => { const o = db.orcamentos.find(o => o.categoria === cat); return o ? +o.mensal || 0 : 0; };

  /* ---------- Regras de aprovação ---------- */
  const ativo = p => !['REJEITADO', 'CANCELADO'].includes(p.estado);
  const dupla = () => +db.settings.duplaAcima || Infinity;
  // Valor de referência para alçadas: num pagamento parcelado conta o TOTAL de todas as parcelas
  const valorRef = app.valorRef = p => p.grupo ? r2(db.pedidos.reduce((s, x) => x.grupo === p.grupo && ativo(x) ? s + x.valor : s, 0)) : p.valor;
  const aprovacoesNecessarias = p => {
    let n = valorRef(p) > dupla() ? 2 : 1;
    if ((p.flags || []).some(f => f === 'FORA_ORCAMENTO' || f === 'FRACIONAMENTO' || f === 'FORA_ORCAMENTO_CC')) n = 2;
    return n;
  };
  // Utilizadores com PIN ativo que podem aprovar um determinado valor
  app.aprovadoresElegiveis = valor => db.users.filter(u => { if (u.ativo === false || !u.pinHash) return false; const ef = app.alcadaEfetiva(u); return ef.pode && ef.limite >= valor; });
  app.alertaAlcadas = () => {
    if (dupla() === Infinity) return '';
    const el = app.aprovadoresElegiveis(dupla() + 0.01);
    if (el.length >= 2) return '';
    return `<div class="alert bad" style="margin-bottom:16px">${icon('alert')}<div><b>Pedidos acima de ${eur(dupla())} ainda não podem ser totalmente aprovados.</b> Exigem 2 aprovadores diferentes com alçada suficiente e PIN ativo, mas só ${el.length ? el.map(u => esc(u.nome)).join(', ') : 'ninguém'} cumpre${el.length === 1 ? '' : 'm'} esse requisito. Em <a href="#/utilizadores">Utilizadores e alçadas</a>, defina o PIN de outro aprovador ou suba a sua alçada.</div></div>`;
  };
  const aprovados = p => p.aprovacoes.filter(a => a.decisao === 'APROVADO').length;
  app.aprovacoesNecessarias = aprovacoesNecessarias;
  app.podeAprovar = (p, u = app.user) => {
    const ef = app.alcadaEfetiva(u);
    if (!ef.pode) return [false, 'O seu perfil não tem permissão de aprovação'];
    if (!['PENDENTE', 'EM_APROVACAO'].includes(p.estado)) return [false, 'O estado do pedido não permite aprovação'];
    if (p.aprovacoes.some(a => a.user === u.id && a.decisao === 'APROVADO')) return [false, 'Já aprovou este pedido — é necessário outro aprovador'];
    if (db.settings.segregacao && p.criadoPor === u.id) return [false, 'Segregação de funções: não pode aprovar um pedido criado por si'];
    const vr = valorRef(p);
    if (vr > ef.limite) return [false, `${p.grupo ? 'Total parcelado (' + eur(vr) + ')' : 'Valor'} acima da sua alçada (${eur(ef.limite)}${ef.delegada.de ? ', incluindo delegação' : ''})`];
    const dg = app.delegacaoUsada(u, vr);
    if (dg && p.aprovacoes.some(x => x.decisao === 'APROVADO' && (x.user === dg || x.delegacao === dg))) return [false, `${userName(dg)} já aprovou este pedido — a delegação não pode ser usada para o aprovar uma segunda vez`];
    return [true, ''];
  };
  app.podeExecutar = (p, u = app.user) => {
    if (!can('executar', u)) return [false, 'O seu perfil não tem permissão de execução'];
    if (p.estado !== 'APROVADO') return [false, 'Só pedidos aprovados podem ser executados'];
    if (p.contaOrigem && db.settings.bloquearSemSaldo && p.categoria !== ENTRADA && saldo(p.contaOrigem) < p.valor)
      return [false, `Saldo insuficiente em ${nomeConta(p.contaOrigem)} (${eur(saldo(p.contaOrigem))})`];
    if (p.contaOrigem) { const av = app.avisosLimites(p.contaOrigem, p.valor, today()); if (av.length) return [false, av[0]]; }
    if (p.contaDestino && app.contaBloqueada(p.contaDestino)) return [false, `Conta de destino ${nomeConta(p.contaDestino)} bloqueada`];
    return [true, ''];
  };
  app.podeCancelar = (p, u = app.user) => ['PENDENTE', 'EM_APROVACAO', 'APROVADO'].includes(p.estado) && (p.criadoPor === u.id || can('admin', u));

  app.criarPedido = d => {
    if (!can('criar')) throw new Error('Sem permissão para criar pedidos');
    const valor = r2(d.valor);
    if (!(valor > 0)) throw new Error('Indique um valor superior a zero');
    if (!d.categoria) throw new Error('Indique a categoria');
    const entrada = d.categoria === ENTRADA;
    if (!entrada && !d.contaOrigem) throw new Error('Indique a conta ordenante (entidade de execução)');
    if (entrada && !d.contaDestino) throw new Error('Indique a conta que recebe os fundos');
    if (!d.contaDestino) throw new Error('Indique a conta de destino');
    if (!conta(d.contaDestino)) throw new Error('Conta de destino inexistente');
    if (d.contaOrigem && d.contaOrigem === d.contaDestino) throw new Error('A conta de origem e destino não podem ser iguais');
    if (!entrada && app.contaBloqueada(d.contaOrigem)) throw new Error(`A conta ${nomeConta(d.contaOrigem)} está bloqueada`);
    if (app.contaBloqueada(d.contaDestino)) throw new Error(`A conta de destino ${nomeConta(d.contaDestino)} está bloqueada`);
    const p = {
      id: uid(), numero: nextReq(), autorizacao: null, categoria: d.categoria, requerente: d.requerente || d.contaOrigem || d.contaDestino,
      contaOrigem: entrada ? null : d.contaOrigem, contaDestino: d.contaDestino || null, beneficiario: d.beneficiario || '', iban: d.iban || '',
      valor, metodo: d.metodo || 'DÉBITO', dataPrevista: d.dataPrevista || today(), descricao: d.descricao || '', associado: d.associado || '',
      parcela: d.parcela || '', grupo: d.grupo || null, anexos: d.anexos || [], estado: 'PENDENTE', criadoPor: app.user.id,
      criadoEm: new Date().toISOString(), aprovacoes: [], origem: d.origem || null, flags: [],
    };
    const lim = app.orcamento(p.categoria);
    if (lim && app.gastoCategoria(p.categoria, ym(p.dataPrevista)) + valor > lim) p.flags.push('FORA_ORCAMENTO');
    if (d.centroCusto) {
      const cc = app.ccDe(d.centroCusto); if (!cc || cc.ativo === false) throw new Error('Centro de custo inválido ou inativo');
      p.centroCusto = cc.id; const ano = p.dataPrevista.slice(0, 4);
      if (+cc.orcamentoAnual > 0 && !entrada && app.ccExecutado(cc.id, ano) + app.ccComprometido(cc.id, ano) + valor > +cc.orcamentoAnual) p.flags.push('FORA_ORCAMENTO_CC');
    }
    if (p.contaOrigem && disponivel(p.contaOrigem) < valor) p.flags.push('SALDO_INSUFICIENTE');
    // Anti-fracionamento: pedidos do mesmo utilizador, no mesmo dia, da mesma conta para o mesmo destino
    // que somados ultrapassem o limite de dupla aprovação passam todos a exigir 2 aprovações
    if (!p.grupo && valor <= dupla()) {
      const dest = x => x.contaDestino || (x.beneficiario || '').trim().toLowerCase();
      const irmaos = db.pedidos.filter(x => ativo(x) && x.criadoPor === p.criadoPor && x.criadoEm.slice(0, 10) === p.criadoEm.slice(0, 10) && x.contaOrigem === p.contaOrigem && dest(x) === dest(p));
      const soma = irmaos.reduce((s, x) => s + x.valor, 0) + valor;
      if (soma > dupla()) {
        p.flags.push('FRACIONAMENTO');
        irmaos.filter(x => ['PENDENTE', 'EM_APROVACAO'].includes(x.estado)).forEach(x => {
          if (!x.flags.includes('FRACIONAMENTO')) x.flags.push('FRACIONAMENTO');
          x.necessarias = Math.max(x.necessarias || 1, aprovacoesNecessarias(x));
        });
        log('FRACIONAMENTO_DETETADO', `${p.numero} · ${irmaos.length + 1} pedidos para ${nomeConta(dest(p))} somam ${eur(soma)}`, p.id);
      }
    }
    if (p.contaOrigem && app.avisosLimites(p.contaOrigem, valor, p.dataPrevista).length) p.flags.push('LIMITE_CONTA');
    p.necessarias = aprovacoesNecessarias(p);
    db.pedidos.push(p);
    if (p.grupo) db.pedidos.filter(x => x.grupo === p.grupo && ['PENDENTE', 'EM_APROVACAO'].includes(x.estado)).forEach(x => { x.necessarias = Math.max(x.necessarias || 1, aprovacoesNecessarias(x)); });
    log('PEDIDO_CRIADO', `${p.numero} · ${p.categoria} · ${eur(valor)}`, p.id);
    return p;
  };
  app.aprovar = (p, nota) => {
    const [ok, why] = app.podeAprovar(p); if (!ok) throw new Error(why);
    const deleg = app.delegacaoUsada(app.user, valorRef(p));
    p.aprovacoes.push({ user: app.user.id, em: new Date().toISOString(), decisao: 'APROVADO', nota: nota || '', delegacao: deleg || null });
    if (deleg) log('APROVACAO_POR_DELEGACAO', `${p.numero} · ${app.user.username} por delegação de ${userName(deleg)}`, p.id);
    if (aprovados(p) >= p.necessarias) { p.estado = 'APROVADO'; p.autorizacao = nextAut(); p.aprovadoEm = new Date().toISOString(); }
    else p.estado = 'EM_APROVACAO';
    log('PEDIDO_APROVADO', `${p.numero} · aprovação ${aprovados(p)}/${p.necessarias}${p.autorizacao ? ' · Autorização ' + p.autorizacao : ''}`, p.id);
  };
  app.rejeitar = (p, nota) => {
    if (!app.alcadaEfetiva(app.user).pode) throw new Error('Sem permissão');
    if (!['PENDENTE', 'EM_APROVACAO', 'APROVADO'].includes(p.estado)) throw new Error('Estado não permite rejeição');
    p.aprovacoes.push({ user: app.user.id, em: new Date().toISOString(), decisao: 'REJEITADO', nota: nota || '' });
    p.estado = 'REJEITADO';
    log('PEDIDO_REJEITADO', `${p.numero} · ${nota || 'sem motivo'}`, p.id);
  };
  app.executar = (p, { data, comprovativo } = {}) => {
    const [ok, why] = app.podeExecutar(p); if (!ok) throw new Error(why);
    const d = data || today();
    if (app.dataFechada(d)) throw new Error(`Período fechado até ${date(app.ultimoFecho().data)} — escolha uma data de operação posterior`);
    if (p.contaOrigem) { const av = app.avisosLimites(p.contaOrigem, p.valor, d); if (av.length) throw new Error(av[0]); }
    const desc = `${p.numero} · ${p.categoria}${p.descricao ? ' · ' + p.descricao : ''}`;
    if (p.contaOrigem) app.lancar({ conta: p.contaOrigem, valor: -p.valor, descricao: desc + (p.contaDestino ? ' → ' + nomeConta(p.contaDestino) : p.beneficiario ? ' → ' + p.beneficiario : ''), data: d, pedido: p.id, tipo: 'DÉBITO' });
    if (p.contaDestino && conta(p.contaDestino))
      app.lancar({ conta: p.contaDestino, valor: p.valor, descricao: desc + (p.contaOrigem ? ' ← ' + nomeConta(p.contaOrigem) : ''), data: d, pedido: p.id, tipo: 'CRÉDITO' });
    p.estado = 'EXECUTADO'; p.executadoEm = new Date().toISOString(); p.dataExecucao = d; p.executadoPor = app.user.id; p.comprovativo = comprovativo || '';
    log('PEDIDO_EXECUTADO', `${p.numero} · Autorização ${p.autorizacao} · ${eur(p.valor)}`, p.id);
  };
  app.cancelar = (p, nota) => {
    if (!app.podeCancelar(p)) throw new Error('Não pode cancelar este pedido');
    p.estado = 'CANCELADO'; p.canceladoEm = new Date().toISOString(); p.notaCancel = nota || '';
    log('PEDIDO_CANCELADO', `${p.numero} · ${nota || ''}`, p.id);
  };
  app.pedido = id => db.pedidos.find(p => p.id === id);
  app.pedidosPorOrigem = key => db.pedidos.filter(p => p.origem && p.origem.key === key && !['REJEITADO', 'CANCELADO'].includes(p.estado));
  app.caixaEntrada = () => db.pedidos.filter(p => app.podeAprovar(p)[0] || app.podeExecutar(p)[0]);

  /* =========================================================
     ASSINATURA ELETRÓNICA
     - Cada utilizador tem um par de chaves ECDSA P-256.
     - A chave privada é cifrada (AES-GCM) com uma chave derivada do
       PIN (PBKDF2, 210 000 iterações) — só o titular a consegue usar.
     - Cada ato (submeter, aprovar, executar, rejeitar, cancelar)
       assina a impressão digital SHA-256 do documento.
     - Rubrica manuscrita (desenhada) anexada a cada assinatura.
     ========================================================= */
  const te = new TextEncoder();
  const b64 = buf => { const a = new Uint8Array(buf); let s = ''; for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const subtle = () => { if (!global.crypto || !crypto.subtle) throw new Error('Este navegador não suporta assinatura criptográfica (use o Google Chrome atualizado).'); return crypto.subtle; };
  async function derivar(pin, salt) {
    const base = await subtle().importKey('raw', te.encode(pin), 'PBKDF2', false, ['deriveKey']);
    return subtle().deriveKey({ name: 'PBKDF2', salt: unb64(salt), iterations: 210000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function cifrarPriv(u, pkcs8, pin, keyId) {
    const salt = b64(crypto.getRandomValues(new Uint8Array(16))), iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await subtle().encrypt({ name: 'AES-GCM', iv }, await derivar(pin, salt), pkcs8);
    u.privEnc = { keyId, salt, iv: b64(iv), data: b64(data) };
  }
  async function decifrarPriv(u, pin) {
    const e = u.privEnc; if (!e) throw new Error('Sem chave de assinatura');
    return subtle().decrypt({ name: 'AES-GCM', iv: unb64(e.iv) }, await derivar(pin, e.salt), unb64(e.data));
  }
  app.gerarChaves = async (u, pin) => {
    const kp = await subtle().generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const jwk = await subtle().exportKey('jwk', kp.publicKey);
    const pkcs8 = await subtle().exportKey('pkcs8', kp.privateKey);
    const id = sha256(jwk.x + '.' + jwk.y).slice(0, 16).toUpperCase();
    const agora = new Date().toISOString();
    (u.chaves = u.chaves || []).forEach(c => { if (!c.revogada) c.revogada = agora; });
    u.chaves.push({ id, pub: { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y }, criada: agora });
    await cifrarPriv(u, pkcs8, pin, id);
    log('CHAVE_EMITIDA', `${u.username} · certificado ${id}`);
  };
  app.recifrarChave = async (u, pinAntigo, pinNovo) => {
    if (!u.privEnc) return app.gerarChaves(u, pinNovo);
    try { await cifrarPriv(u, await decifrarPriv(u, pinAntigo), pinNovo, u.privEnc.keyId); }
    catch (e) { await app.gerarChaves(u, pinNovo); }
  };
  const chaveAtiva = u => (u.chaves || []).find(c => !c.revogada);
  app.chaveAtiva = chaveAtiva;
  const fmtId = id => String(id || '').replace(/(.{4})(?=.)/g, '$1 ');
  app.fmtId = fmtId;

  const DOC_FIELDS = ['id', 'numero', 'categoria', 'requerente', 'contaOrigem', 'contaDestino', 'beneficiario', 'iban', 'valor', 'metodo', 'dataPrevista', 'descricao', 'associado', 'parcela'];
  // o centro de custo só entra na impressão digital quando existe (mantém válidas as assinaturas anteriores)
  app.docHash = p => sha256(JSON.stringify(DOC_FIELDS.map(k => p[k] ?? null).concat(p.centroCusto ? [p.centroCusto] : [])));
  const sigMsg = (p, s) => ['SPAP1', cfg.key, s.acao, p.numero, s.docHash, s.ts, s.user, s.keyId].join('|');
  app.selo = p => sha256((p.assinaturas || []).map(s => s.valor).join('.') + '|' + app.docHash(p) + '|' + (p.autorizacao || '') + '|' + p.estado);
  const ACOES = { SUBMETER: 'Submetido e certificado pelo requerente', APROVAR: 'Aprovado', EXECUTAR: 'Execução do pagamento', REJEITAR: 'Rejeitado', CANCELAR: 'Cancelado' };
  app.ACOES = ACOES;

  app.verificarAssinatura = async (p, s) => {
    try {
      const u = userById(s.user); const ch = u && (u.chaves || []).find(c => c.id === s.keyId);
      if (!ch) return { ok: false, motivo: 'Certificado do signatário desconhecido' };
      if (s.docHash !== app.docHash(p)) return { ok: false, motivo: 'O documento foi alterado depois de assinado' };
      const key = await subtle().importKey('jwk', { ...ch.pub, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
      const ok = await subtle().verify({ name: 'ECDSA', hash: 'SHA-256' }, key, unb64(s.valor), te.encode(sigMsg(p, s)));
      return ok ? { ok: true } : { ok: false, motivo: 'Assinatura criptográfica inválida' };
    } catch (e) { return { ok: false, motivo: e.message }; }
  };
  app.verificarPedido = async p => Promise.all((p.assinaturas || []).map(s => app.verificarAssinatura(p, s)));
  const txtMsg = s => ['SPAP1', cfg.key, s.acao, 'TXT', s.docHash, s.ts, s.user, s.keyId].join('|');
  app.verificarTexto = async (texto, s) => {
    try {
      if (!s) return { ok: false, motivo: 'sem assinatura' };
      const u = userById(s.user); const ch = u && (u.chaves || []).find(c => c.id === s.keyId);
      if (!ch) return { ok: false, motivo: 'certificado desconhecido' };
      if (s.docHash !== sha256(texto)) return { ok: false, motivo: 'conteúdo alterado depois de assinado' };
      const key = await subtle().importKey('jwk', { ...ch.pub, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
      return (await subtle().verify({ name: 'ECDSA', hash: 'SHA-256' }, key, unb64(s.valor), te.encode(txtMsg(s)))) ? { ok: true } : { ok: false, motivo: 'assinatura inválida' };
    } catch (e) { return { ok: false, motivo: e.message }; }
  };

  /* rubrica manuscrita */
  ui.signaturePad = (canvas) => {
    const ctx = canvas.getContext('2d'); let draw = false, empty = true, last = null;
    const pos = e => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) * canvas.width / r.width, (e.clientY - r.top) * canvas.height / r.height]; };
    ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#14213d';
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', e => { draw = true; last = pos(e); canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', e => { if (!draw) return; const p = pos(e); ctx.beginPath(); ctx.moveTo(last[0], last[1]); ctx.lineTo(p[0], p[1]); ctx.stroke(); last = p; empty = false; });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => canvas.addEventListener(ev, () => { draw = false; }));
    return { isEmpty: () => empty, clear: () => { ctx.clearRect(0, 0, canvas.width, canvas.height); empty = true; }, toDataURL: () => canvas.toDataURL('image/png') };
  };
  const padHtml = (id = 'pad') => `<div class="sigpad"><canvas id="${id}" width="520" height="160"></canvas><span class="sigpad-line">Assine aqui</span><button type="button" class="btn ghost sm" data-clear="${id}">Limpar</button></div>`;
  function bindPad(el, id = 'pad') { const c = el.querySelector('#' + id); if (!c) return null; const pad = ui.signaturePad(c); el.querySelector(`[data-clear="${id}"]`).onclick = () => pad.clear(); return pad; }

  /* Modal de assinatura: PIN + rubrica → devolve um "signatário" capaz de assinar pedidos */
  app.assinar = (titulo, resumo) => new Promise(res => {
    const u = app.user; let pad = null, trocar = !u.rubrica;
    const rubricaHtml = () => trocar ? padHtml() : `<div class="sigpad has"><img src="${u.rubrica}" alt="Rubrica"><button type="button" class="btn ghost sm" id="trocar">Desenhar nova</button></div>`;
    ui.modal({
      title: titulo, sub: 'Assinatura eletrónica — confirme com o seu PIN e a sua rubrica.',
      body: `${resumo ? `<div class="alert info" style="margin-bottom:14px">${resumo}</div>` : ''}<form class="stack">
        <div class="fld"><label>Rubrica de ${esc(u.nome)}</label><div id="rb">${rubricaHtml()}</div></div>
        <div class="fld"><label>PIN</label><input class="inp mono" name="pin" type="password" inputmode="numeric" autocomplete="off" maxlength="8" style="font-size:20px;letter-spacing:.4em;text-align:center"></div>
        <div class="fld"><label>Nota (opcional)</label><input class="inp" name="nota" maxlength="200"></div>
        <div class="faint" style="font-size:11.5px;display:flex;gap:6px;align-items:center">${icon('shield')} ECDSA P-256 · SHA-256 · certificado ${esc(fmtId(chaveAtiva(u) && chaveAtiva(u).id) || 'a emitir')}</div></form>`,
      onOpen: el => { const wire = () => { pad = bindPad(el); const t = el.querySelector('#trocar'); if (t) t.onclick = () => { trocar = true; el.querySelector('#rb').innerHTML = rubricaHtml(); wire(); }; }; wire(); },
      actions: [{ label: 'Cancelar', kind: 'ghost', onClick: () => res(null) },
        { label: icon('key') + 'Assinar', kind: 'primary', onClick: async el => {
          const f = ui.formData(el);
          if (trocar && (!pad || pad.isEmpty())) { ui.toast('Desenhe a sua rubrica', 'warn'); return false; }
          if (!app.checkPin(u, f.pin)) { ui.toast('PIN incorreto', 'bad'); log('PIN_FALHADO', 'Assinatura recusada: ' + titulo); save(); el.querySelector('[name=pin]').value = ''; return false; }
          let priv;
          try {
            if (!u.privEnc) await app.gerarChaves(u, f.pin);
            priv = await subtle().importKey('pkcs8', await decifrarPriv(u, f.pin), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
          } catch (e) { ui.toast('Não foi possível abrir a chave de assinatura: ' + esc(e.message), 'bad'); return false; }
          if (trocar) { u.rubrica = pad.toDataURL(); log('RUBRICA_REGISTADA', u.username); }
          save();
          const signer = async (p, acao) => {
            const s = { acao, user: u.id, nome: u.nome, ts: new Date().toISOString(), docHash: app.docHash(p), keyId: u.privEnc.keyId, rubrica: u.rubrica, nota: f.nota || '' };
            s.valor = b64(await subtle().sign({ name: 'ECDSA', hash: 'SHA-256' }, priv, te.encode(sigMsg(p, s))));
            (p.assinaturas = p.assinaturas || []).push(s);
            log('ASSINATURA', `${p.numero} · ${acao} · ${u.username} · cert. ${s.keyId}`, p.id);
            return s;
          };
          signer.texto = async (acao, texto) => {
            const s = { acao, user: u.id, nome: u.nome, ts: new Date().toISOString(), docHash: sha256(texto), keyId: u.privEnc.keyId, rubrica: u.rubrica, nota: f.nota || '' };
            s.valor = b64(await subtle().sign({ name: 'ECDSA', hash: 'SHA-256' }, priv, te.encode(txtMsg(s))));
            return s;
          };
          res({ nota: f.nota, signer }); } }],
    });
  });

  /* Cria pedidos já assinados pelo requerente (um PIN para vários) */
  app.criarAssinado = async (lista, titulo, resumo) => {
    if (!can('criar')) throw new Error('Sem permissão para criar pedidos');
    const s = await app.assinar(titulo || 'Assinar e submeter', resumo || `${lista.length} pedido(s) · total <b>${eur(lista.reduce((a, d) => a + r2(d.valor), 0))}</b>`);
    if (!s) return null;
    const criados = [];
    try { lista.forEach(d => criados.push(app.criarPedido(d))); }
    catch (e) { criados.forEach(p => { db.pedidos = db.pedidos.filter(x => x !== p); }); throw e; }
    for (const p of criados) await s.signer(p, 'SUBMETER');
    save(); return criados;
  };

  /* Perfil de assinatura do utilizador */
  function perfilAssinatura() {
    const u = app.user; const ch = chaveAtiva(u); let pad = null;
    const rev = (u.chaves || []).filter(c => c.revogada);
    ui.modal({ title: 'A minha assinatura eletrónica', wide: true, body: `<div class="grid g2">
      <div class="stack"><div class="kv"><div><span>Titular</span><b>${esc(u.nome)}</b></div><div><span>Perfil</span><b>${ROLES[u.role].label}</b></div>
        <div><span>Certificado</span><b class="mono">${ch ? esc(fmtId(ch.id)) : 'Emitido na 1.ª assinatura'}</b></div><div><span>Emitido em</span><b>${ch ? dt(ch.criada) : '—'}</b></div>
        <div><span>Algoritmo</span><b>ECDSA P-256 / SHA-256</b></div><div><span>Proteção da chave</span><b>AES-256-GCM + PIN</b></div></div>
        ${rev.length ? `<div class="faint" style="font-size:12px">Certificados anteriores (revogados): ${rev.map(c => `<span class="mono">${esc(fmtId(c.id))}</span>`).join(', ')}</div>` : ''}
        ${ch ? `<div class="hash">Chave pública<br>x ${esc(ch.pub.x)}<br>y ${esc(ch.pub.y)}</div>` : ''}</div>
      <div class="stack"><div class="fld"><label>Rubrica registada</label>${u.rubrica ? `<div class="sigpad has"><img src="${u.rubrica}" alt=""></div>` : '<div class="muted">Ainda sem rubrica.</div>'}</div>
        <div class="fld"><label>Desenhar nova rubrica</label>${padHtml('pad2')}</div></div></div>`,
      onOpen: el => { pad = bindPad(el, 'pad2'); },
      actions: [{ label: 'Fechar', kind: 'ghost' }, { label: 'Guardar nova rubrica', kind: 'primary', onClick: () => {
        if (!pad || pad.isEmpty()) { ui.toast('Desenhe a rubrica primeiro', 'warn'); return false; }
        u.rubrica = pad.toDataURL(); log('RUBRICA_REGISTADA', u.username); save(); ui.toast('Rubrica guardada', 'ok'); } }] });
  }
  app.perfilAssinatura = perfilAssinatura;

  /* =========================================================
     RENDERIZAÇÃO
     ========================================================= */
  const root = document.getElementById('app');
  const SESSION = KEY + ':sess';
  let lastActive = Date.now();

  function applyTheme() {
    let t = null; try { t = localStorage.getItem('spap:theme'); } catch (e) { }
    document.documentElement.setAttribute('data-theme', t || 'dark');
  }
  function toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    try { localStorage.setItem('spap:theme', cur); } catch (e) { }
    applyTheme(); render();
  }

  function brandHtml() {
    return `<div class="brand"><div class="brand-logo">${cfg.logo || esc(cfg.sigla)}</div><div><div class="brand-name">${esc(cfg.nome)}</div><div class="brand-sub">${esc(cfg.tagline || 'Sistema de gestão')}</div></div></div>`;
  }

  /* ---------- Login ---------- */
  function renderLogin(msg) {
    app.user = null;
    const setup = !db.users.some(u => u.ativo !== false && u.pinHash);
    root.innerHTML = `<div class="login">
      <div class="login-art">${brandHtml()}
        <div><h1>${cfg.heroTitle || cfg.nome}</h1><p>${cfg.heroText || ''}</p>
        <div class="login-feats">
          <div>${icon('shield')} Autorização de despesas com alçadas e dupla aprovação</div>
          <div>${icon('key')} Assinatura eletrónica (ECDSA + rubrica) em cada ato</div>
          <div>${icon('layers')} Registo de auditoria encadeado e verificável</div>
          <div>${icon('wallet')} Saldos, saldo cativo e extratos em tempo real</div></div></div>
        <div class="faint" style="font-size:12px">SPAP · Os dados ficam guardados neste computador (navegador). Faça cópias de segurança regulares.</div>
      </div>
      <div class="login-form"><div class="login-box" id="lb"></div></div></div>`;
    const lb = document.getElementById('lb');
    if (setup) {
      const admin = db.users.find(u => u.role === 'ADMIN');
      lb.innerHTML = `<h2>Configuração inicial</h2><p class="muted">Defina o PIN do administrador <b>${esc(admin.nome)}</b>. Será pedido em cada acesso e para assinar autorizações.</p>
        <form id="sf" class="stack" style="margin-top:20px">
        <div class="fld"><label>Novo PIN (4 a 8 dígitos)</label><input class="inp mono" name="p1" type="password" inputmode="numeric" maxlength="8" style="font-size:20px;letter-spacing:.4em;text-align:center"></div>
        <div class="fld"><label>Confirmar PIN</label><input class="inp mono" name="p2" type="password" inputmode="numeric" maxlength="8" style="font-size:20px;letter-spacing:.4em;text-align:center"></div>
        <button class="btn primary" style="justify-content:center;padding:12px">${icon('lock')} Ativar sistema</button></form>`;
      lb.querySelector('[name=p1]').focus();
      lb.querySelector('#sf').onsubmit = async e => {
        e.preventDefault(); const f = ui.formData(e.target);
        if (!/^\d{4,8}$/.test(f.p1)) return ui.toast('O PIN deve ter 4 a 8 dígitos', 'bad');
        if (f.p1 !== f.p2) return ui.toast('Os PIN não coincidem', 'bad');
        app.setPin(admin, f.p1); app.user = admin; log('PIN_DEFINIDO', 'Configuração inicial do administrador');
        try { await app.gerarChaves(admin, f.p1); } catch (err) { ui.toast(esc(err.message), 'warn'); }
        save(); startSession(admin);
      };
      return;
    }
    const users = db.users.filter(u => u.ativo !== false);
    let sel = users.find(u => u.pinHash);
    lb.innerHTML = `<h2>Iniciar sessão</h2><p class="muted">Selecione o utilizador e introduza o PIN.</p>
      ${msg ? `<div class="alert warn" style="margin-top:14px">${msg}</div>` : ''}
      <div class="users">${users.map(u => `<button type="button" data-u="${u.id}" ${u.pinHash ? '' : 'disabled title="PIN ainda não definido pelo administrador"'}><span class="avatar">${initials(u.nome)}</span>
        <span style="flex:1;min-width:0"><b style="display:block">${esc(u.nome)}</b><span class="muted" style="font-size:12px">${ROLES[u.role]?.label || u.role}${u.pinHash ? '' : ' · sem PIN'}</span></span></button>`).join('')}</div>
      <form id="lf" class="stack"><input class="inp mono" name="pin" type="password" inputmode="numeric" autocomplete="off" maxlength="8" placeholder="• • • •" style="font-size:22px;letter-spacing:.5em;text-align:center;padding:14px">
      <button class="btn primary" style="justify-content:center;padding:12px">${icon('arrow')} Entrar</button></form>
      <div class="lockline">${icon('lock')} 5 tentativas falhadas bloqueiam o utilizador durante 5 minutos.</div>`;
    const mark = () => lb.querySelectorAll('[data-u]').forEach(b => b.classList.toggle('on', sel && b.dataset.u === sel.id));
    mark();
    lb.querySelectorAll('[data-u]').forEach(b => b.onclick = () => { sel = userById(b.dataset.u); mark(); lb.querySelector('[name=pin]').focus(); });
    lb.querySelector('[name=pin]').focus();
    lb.querySelector('#lf').onsubmit = e => {
      e.preventDefault(); if (!sel) return;
      const pin = e.target.pin.value; e.target.pin.value = '';
      const L = db.meta.locks[sel.id] || { n: 0, until: 0 };
      if (L.until > Date.now()) return ui.toast(`Utilizador bloqueado. Tente novamente em ${Math.ceil((L.until - Date.now()) / 60000)} min.`, 'bad');
      if (!app.checkPin(sel, pin)) {
        L.n++; if (L.n >= 5) { L.until = Date.now() + 5 * 60000; L.n = 0; log('UTILIZADOR_BLOQUEADO', sel.username + ' · 5 tentativas falhadas'); }
        db.meta.locks[sel.id] = L; save(); return ui.toast('PIN incorreto', 'bad');
      }
      db.meta.locks[sel.id] = { n: 0, until: 0 };
      startSession(sel);
      if (!sel.privEnc && !sel.mustChange) app.gerarChaves(sel, pin).then(save).catch(() => {});
    };
  }
  function startSession(u) {
    app.user = u; u.ultimoAcesso = new Date().toISOString();
    try { sessionStorage.setItem(SESSION, u.id); } catch (e) { }
    log('SESSAO_INICIADA', u.username); save();
    lastActive = Date.now();
    render();
    if (u.mustChange) changePin(true);
  }
  function logout(reason) {
    if (app.user) { log(reason ? 'SESSAO_BLOQUEADA' : 'SESSAO_TERMINADA', app.user.username + (reason ? ' · ' + reason : '')); save(); }
    try { sessionStorage.removeItem(SESSION); } catch (e) { }
    renderLogin(reason ? 'Sessão bloqueada por inatividade.' : '');
  }
  function changePin(forced) {
    ui.modal({
      title: forced ? 'Defina o seu PIN pessoal' : 'Alterar PIN', locked: forced,
      sub: forced ? (app.user.avisoPin ? `O seu PIN foi redefinido por ${esc(app.user.avisoPin.por)} em ${dt(app.user.avisoPin.em)}. Se não pediu esta alteração, comunique-o de imediato. ` : 'O administrador atribuiu-lhe um PIN temporário. ') + 'Escolha um novo PIN pessoal.' : '',
      body: `<form class="stack">${forced ? '' : `<div class="fld"><label>PIN atual</label><input class="inp mono" name="old" type="password" inputmode="numeric" maxlength="8"></div>`}
        <div class="fld"><label>Novo PIN (4 a 8 dígitos)</label><input class="inp mono" name="p1" type="password" inputmode="numeric" maxlength="8"></div>
        <div class="fld"><label>Confirmar</label><input class="inp mono" name="p2" type="password" inputmode="numeric" maxlength="8"></div></form>`,
      actions: [...(forced ? [] : [{ label: 'Cancelar', kind: 'ghost' }]), { label: 'Guardar PIN', kind: 'primary', onClick: async el => {
        const f = ui.formData(el);
        if (!forced && !app.checkPin(app.user, f.old)) { ui.toast('PIN atual incorreto', 'bad'); return false; }
        if (!/^\d{4,8}$/.test(f.p1)) { ui.toast('O PIN deve ter 4 a 8 dígitos', 'bad'); return false; }
        if (f.p1 !== f.p2) { ui.toast('Os PIN não coincidem', 'bad'); return false; }
        app.setPin(app.user, f.p1); app.user.mustChange = false; log('PIN_ALTERADO', app.user.username);
        if (app.user.avisoPin) { log('AVISO_PIN_TOMADO_CONHECIMENTO', `${app.user.username} · redefinido por ${app.user.avisoPin.por}`); delete app.user.avisoPin; }
        try { if (forced) await app.gerarChaves(app.user, f.p1); else await app.recifrarChave(app.user, f.old, f.p1); } catch (err) { ui.toast(esc(err.message), 'warn'); }
        save(); ui.toast('PIN atualizado', 'ok');
      } }],
    });
  }

  /* ---------- Shell + router ---------- */
  const coreRoutes = {};
  const navCore = [];
  function route(id, def) { coreRoutes[id] = def; }

  function parseHash() { const h = (location.hash || '').replace(/^#\/?/, ''); const [r, ...rest] = h.split('/'); return { r: r || cfg.home, params: rest.map(decodeURIComponent) }; }
  app.go = path => { if (location.hash === '#/' + path) render(); else location.hash = '#/' + path; };
  app.refresh = () => render();

  function allRoutes() { const m = {}; cfg.modules.forEach(x => m[x.id] = x); return Object.assign(m, coreRoutes); }

  function navHtml(cur) {
    const nIn = app.caixaEntrada().length, nAlt = app.alteracoesParaMim().length, nRec = can('criar') ? app.recorrentesDevidos().length : 0;
    const item = (it) => `<a href="#/${it.id}" class="${cur === it.id ? 'active' : ''}">${icon(it.icon)}<span>${it.label}</span>${it.id === 'aprovacoes' && nIn ? `<span class="count">${nIn}</span>` : ''}${it.id === 'alteracoes' && nAlt ? `<span class="count">${nAlt}</span>` : ''}${it.id === 'recorrentes' && nRec ? `<span class="count">${nRec}</span>` : ''}</a>`;
    const groups = [
      { label: cfg.grupoModulos || cfg.nome, items: cfg.modules.filter(m => !m.hidden && (!m.perm || can(m.perm))) },
      { label: 'Autorizações · SPAP', items: navCore.filter(n => n.grupo === 'spap' && (!n.perm || can(n.perm))) },
      { label: 'Análise financeira', items: navCore.filter(n => n.grupo === 'fin' && (!n.perm || can(n.perm))) },
      { label: 'Administração', items: navCore.filter(n => n.grupo === 'admin' && (!n.perm || can(n.perm))) },
    ].filter(g => g.items.length);
    return groups.map(g => `<div class="nav-group"><div class="nav-label">${g.label}</div><nav class="nav">${g.items.map(item).join('')}</nav></div>`).join('');
  }

  function render() {
    if (!app.user) return renderLogin();
    const { r, params } = parseHash();
    const routes = allRoutes();
    const rt = routes[r] || routes[cfg.home];
    if (rt.perm && !can(rt.perm)) { location.hash = '#/' + cfg.home; return; }
    const theme = document.documentElement.getAttribute('data-theme');
    root.innerHTML = `<div class="shell">
      <aside class="side" id="side">${brandHtml()}${navHtml(rt.id || r)}
        <div class="side-foot">
          <div class="user-chip"><span class="avatar">${initials(app.user.nome)}</span><div class="who"><b>${esc(app.user.nome)}</b><span>${ROLES[app.user.role].label}</span></div></div>
          <div class="row" style="padding:4px 4px 0">
            <button class="btn ghost sm" id="b-theme" title="Tema">${icon(theme === 'light' ? 'moon' : 'sun')}</button>
            <button class="btn ghost sm" id="b-sig" title="A minha assinatura eletrónica">${icon('pen')}</button>
            <button class="btn ghost sm" id="b-pin" title="Alterar PIN">${icon('key')}</button>
            <button class="btn ghost sm" id="b-lock" title="Bloquear">${icon('lock')}</button>
            <button class="btn ghost sm" id="b-out" title="Terminar sessão">${icon('logout')}</button>
          </div>
          ${cfg.outroSistema ? `<a class="btn ghost sm" style="margin-top:8px;width:100%" href="${cfg.outroSistema.href}">${icon('swap')} ${esc(cfg.outroSistema.label)}</a>` : ''}
        </div></aside>
      <main><header class="top">
        <button class="btn ghost icon menu-btn" id="b-menu">${icon('menu')}</button>
        <div><div class="crumb">${esc(cfg.nome)}</div><h1 id="ttl">${esc(rt.title || rt.label)}</h1></div>
        <div class="spacer"></div>
        ${can('criar') ? `<button class="btn primary" id="b-new">${icon('plus')}<span>Novo pedido</span></button>` : ''}
      </header><section id="view"></section></main></div>`;
    const $ = s => root.querySelector(s);
    $('#b-theme').onclick = toggleTheme;
    $('#b-pin').onclick = () => changePin(false);
    $('#b-sig').onclick = () => perfilAssinatura();
    $('#b-lock').onclick = () => logout('bloqueio manual');
    $('#b-out').onclick = () => logout();
    $('#b-menu').onclick = () => $('#side').classList.toggle('open');
    if ($('#b-new')) $('#b-new').onclick = () => app.novoPedido();
    const view = $('#view');
    try { rt.render(view, app, params); }
    catch (err) { console.error(err); view.innerHTML = `<div class="alert bad">${icon('alert')}<div><b>Erro ao apresentar a página.</b><br>${esc(err.message)}</div></div>`; }
    window.scrollTo(0, 0);
  }
  app.setTitle = t => { const el = document.getElementById('ttl'); if (el) el.textContent = t; };

  /* ---------- Formulário de novo pedido ---------- */
  app.novoPedido = (pre = {}) => {
    const internas = app.contasInternas();
    const optC = (sel, list) => list.map(c => `<option value="${c.id}" ${sel === c.id ? 'selected' : ''}>${esc(c.nome)} · ${eur(disponivel(c.id))}</option>`).join('');
    const assoc = db.pedidos.slice().reverse().map(p => `<option value="${esc(p.numero)}">${esc(p.categoria)} · ${eur(p.valor)}</option>`).join('');
    const m = ui.modal({
      title: 'Novo pedido de pagamento', sub: 'O pedido segue o circuito de autorização antes de ser executado.', wide: true,
      body: `<form class="form" id="pf">
        <div class="fld"><label>Categoria</label><select class="inp" name="categoria">${db.categorias.map(c => `<option ${pre.categoria === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
        <div class="fld"><label>Método de pagamento</label><select class="inp" name="metodo">${db.metodos.map(c => `<option ${pre.metodo === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
        <div class="fld" data-orig><label>Conta ordenante · entidade de execução</label><select class="inp" name="contaOrigem"><option value="">—</option>${optC(pre.contaOrigem, internas)}</select></div>
        <div class="fld"><label>Conta de destino · entidade beneficiária</label><select class="inp" name="contaDestino"><option value="">—</option>${optC(pre.contaDestino, internas)}</select></div>
        ${(db.centrosCusto || []).some(c => c.ativo !== false) ? `<div class="fld"><label>Centro de custo</label><select class="inp" name="centroCusto"><option value="">—</option>${(db.centrosCusto || []).filter(c => c.ativo !== false).map(c => `<option value="${c.id}" ${pre.centroCusto === c.id ? 'selected' : ''}>${esc(c.codigo)} · ${esc(c.nome)}</option>`).join('')}</select></div>` : ''}
        <div class="fld"><label>Requerente</label><select class="inp" name="requerente"><option value="">(= conta ordenante)</option>${optC(pre.requerente, db.contas.filter(c => c.ativo !== false))}</select></div>
        <div class="fld"><label>Valor (€)</label><input class="inp num" name="valor" type="number" step="0.01" min="0" value="${pre.valor ?? ''}" style="font-size:18px;font-weight:700"></div>
        <div class="fld"><label>Data prevista de execução</label><input class="inp" name="dataPrevista" type="date" value="${pre.dataPrevista || today()}"></div>
        <div class="fld"><label>Parcelas</label><input class="inp" name="parcelas" type="number" min="1" max="120" value="${pre.parcelas || 1}"><span class="hint">Divide o valor em pedidos mensais.</span></div>
        <div class="fld"><label>Requerimento associado</label><input class="inp mono" name="associado" list="dl-assoc" value="${esc(pre.associado || '')}"><datalist id="dl-assoc">${assoc}</datalist></div>
        <div class="fld"><label>Anexos (fatura, ordem de pagamento…)</label><input class="inp" name="anexos" type="file" multiple accept="image/*,application/pdf"></div>
        <div class="fld full"><label>Descrição / finalidade</label><textarea class="inp" name="descricao">${esc(pre.descricao || '')}</textarea></div>
        <div class="full" id="pchk"></div></form>`,
      actions: [{ label: 'Cancelar', kind: 'ghost' }, { label: icon('pen') + 'Assinar e submeter', kind: 'primary', onClick: async (el) => {
        const f = ui.formData(el);
        try {
          const anexos = await readFiles(el.querySelector('[name=anexos]').files);
          const n = Math.max(1, Math.min(120, parseInt(f.parcelas) || 1));
          const total = r2(f.valor), base = r2(Math.floor(total / n * 100) / 100);
          const grupo = n > 1 ? uid() : null; const lista = [];
          for (let i = 0; i < n; i++) {
            const v = i === n - 1 ? r2(total - base * (n - 1)) : base;
            lista.push({ ...f, valor: v, dataPrevista: addMonths(f.dataPrevista || today(), i), parcela: n > 1 ? `${i + 1}/${n}` : (pre.parcela || ''), grupo, anexos: i === 0 ? anexos : [], origem: pre.origem });
          }
          if (!(total > 0)) throw new Error('Indique um valor superior a zero');
          const criados = await app.criarAssinado(lista, 'Assinar e submeter pedido', `${esc(f.categoria)} · <b>${eur(total)}</b>${n > 1 ? ' em ' + n + ' parcelas' : ''}<br><span style="font-size:12px">O requerente declara total responsabilidade pela veracidade dos dados informados.</span>`);
          if (!criados) return false;
          ui.toast(`<b>${n > 1 ? n + ' pedidos criados' : 'Pedido ' + criados[0].numero + ' criado'}</b><br>Aguarda autorização.`, 'ok');
          if (pre.onCreate) pre.onCreate(criados);
          if (n === 1) app.go('pedidos/' + criados[0].id); else app.go('pedidos');
        } catch (e) { ui.toast(esc(e.message), 'bad'); return false; }
      } }],
    });
    const el = m.el;
    const upd = () => {
      const f = ui.formData(el); const entrada = f.categoria === ENTRADA;
      el.querySelector('[data-orig]').style.display = entrada ? 'none' : '';
      const v = r2(f.valor), n = Math.max(1, parseInt(f.parcelas) || 1), vp = r2(v / n);
      const chk = [];
      if (!entrada && f.contaOrigem) {
        const d = disponivel(f.contaOrigem);
        chk.push(d >= vp ? `<div class="alert ok">${icon('check')}<div>Saldo disponível em <b>${esc(nomeConta(f.contaOrigem))}</b>: ${eur(d)}</div></div>`
          : `<div class="alert warn">${icon('alert')}<div>Saldo disponível insuficiente (${eur(d)}). O pedido pode ser aprovado, mas só será executado com saldo.</div></div>`);
      }
      if (!entrada && f.contaOrigem) app.avisosLimites(f.contaOrigem, vp, f.dataPrevista).forEach(t => chk.push(`<div class="alert bad">${icon('lock')}<div>${esc(t)} — o pagamento <b>não poderá ser executado</b> enquanto o limite não o permitir.</div></div>`));
      if (f.contaDestino && app.contaBloqueada(f.contaDestino)) chk.push(`<div class="alert bad">${icon('lock')}<div>A conta de destino está bloqueada.</div></div>`);
      if (f.centroCusto) { const cc = app.ccDe(f.centroCusto), ano = (f.dataPrevista || today()).slice(0, 4);
        if (cc && +cc.orcamentoAnual > 0) { const u = app.ccExecutado(cc.id, ano) + app.ccComprometido(cc.id, ano), fora = u + v > +cc.orcamentoAnual;
          chk.push(`<div class="alert ${fora ? 'warn' : 'info'}">${icon('target')}<div>Centro de custo ${esc(cc.codigo)}: ${eur(u)} de ${eur(cc.orcamentoAnual)} usados em ${ano}${fora ? ' — <b>excede o orçamento anual, exige dupla aprovação</b>' : ''}.</div></div>`); } }
      const lim = app.orcamento(f.categoria);
      if (lim) { const g = app.gastoCategoria(f.categoria, ym(f.dataPrevista)); const fora = g + vp > lim;
        chk.push(`<div class="alert ${fora ? 'warn' : 'info'}">${icon('target')}<div>Orçamento mensal de ${esc(f.categoria)}: ${eur(g)} de ${eur(lim)} comprometido${fora ? ' — <b>excede o orçamento, exige dupla aprovação</b>' : ''}.</div></div>`); }
      const nec = (v > dupla()) ? 2 : 1;
      chk.push(`<div class="alert info">${icon('shield')}<div>Este pedido ${n > 1 ? `(${n} parcelas de ${eur(vp)}) ` : ''}exige <b>${nec} aprovação${nec > 1 ? 'ões' : ''}</b>${nec > 1 ? ` (valor acima de ${eur(db.settings.duplaAcima)})` : ''}${db.settings.segregacao ? ' de utilizador diferente do requerente' : ''}.</div></div>`);
      el.querySelector('#pchk').innerHTML = `<div class="stack" style="gap:8px">${chk.join('')}</div>`;
    };
    el.querySelectorAll('input,select').forEach(i => i.addEventListener('input', upd)); upd();
  };
  function readFiles(files) {
    return Promise.all([...files].map(f => new Promise((res, rej) => {
      if (f.size > 800 * 1024) return rej(new Error(`O anexo "${f.name}" excede 800 KB. Comprima-o ou guarde apenas a referência.`));
      const r = new FileReader(); r.onload = () => res({ nome: f.name, tipo: f.type, data: r.result }); r.onerror = rej; r.readAsDataURL(f);
    })));
  }

  /* ---------- Tabela de pedidos (reutilizável) ---------- */
  app.tabelaPedidos = (list, { empty = 'Sem pedidos.', compact = false } = {}) => {
    if (!list.length) return `<div class="empty">${empty}</div>`;
    return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>N.º</th><th>Data</th>${compact ? '' : '<th>Categoria</th>'}<th>Ordenante → Destino</th><th class="r">Valor</th><th>Aprov.</th><th>Estado</th></tr></thead><tbody>
      ${list.map(p => `<tr class="click" data-p="${p.id}"><td class="mono">${esc(p.numero)}${p.parcela ? `<div class="faint" style="font-size:11px">parcela ${esc(p.parcela)}</div>` : ''}</td>
        <td>${date(p.dataPrevista)}</td>${compact ? '' : `<td><div style="font-weight:600;font-size:12.5px">${esc(p.categoria)}</div><div class="faint" style="font-size:12px;max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.descricao)}</div></td>`}
        <td style="font-size:12.5px">${esc(p.contaOrigem ? nomeConta(p.contaOrigem) : 'Externo')} <span class="faint">→</span> ${esc(p.contaDestino ? nomeConta(p.contaDestino) : p.beneficiario)}</td>
        <td class="r num" style="font-weight:700">${eur(p.valor)}</td>
        <td class="num">${aprovados(p)}/${p.necessarias}${(p.flags || []).includes('FORA_ORCAMENTO') ? ` <span title="Fora de orçamento" class="neg">●</span>` : ''}</td>
        <td>${ui.estadoBadge(p.estado)}</td></tr>`).join('')}</tbody></table></div>`;
  };
  app.bindPedidos = el => el.querySelectorAll('[data-p]').forEach(tr => tr.onclick = () => app.go('pedidos/' + tr.dataset.p));

  /* ---------- Rotas SPAP ---------- */
  navCore.push({ id: 'spap', label: 'Painel de autorizações', icon: 'shield', grupo: 'spap' },
    { id: 'aprovacoes', label: 'Caixa de entrada', icon: 'inbox', grupo: 'spap' },
    { id: 'pedidos', label: 'Pedidos', icon: 'list', grupo: 'spap' },
    { id: 'contas', label: 'Contas e saldos', icon: 'wallet', grupo: 'spap' },
    { id: 'verificar', label: 'Verificar documento', icon: 'qr', grupo: 'spap' },
    { id: 'fechos', label: 'Prova de saldos e fechos', icon: 'lock', grupo: 'spap' },
    { id: 'liquidez', label: 'Previsão de liquidez', icon: 'chart', grupo: 'spap' },
    { id: 'recorrentes', label: 'Pedidos recorrentes', icon: 'clock', grupo: 'spap' },
    { id: 'indicadores', label: 'Indicadores de negócio', icon: 'chart', grupo: 'fin' },
    { id: 'financeiro', label: 'Relatórios financeiros', icon: 'file', grupo: 'fin' },
    { id: 'investimentos', label: 'Planeamento de investimentos', icon: 'target', grupo: 'fin' },
    { id: 'relatorios', label: 'Centros de custo', icon: 'pie', grupo: 'fin' },
    { id: 'delegacoes', label: 'Delegação de alçadas', icon: 'users', grupo: 'admin' },
    ...(cfg.intercompany ? [{ id: 'intercompany', label: 'Intercompany e grupo', icon: 'swap', grupo: 'spap' }] : []),
    { id: 'alteracoes', label: 'Alterações pendentes', icon: 'edit', grupo: 'admin', perm: 'aprovar' },
    { id: 'orcamentos', label: 'Orçamentos', icon: 'target', grupo: 'spap' },
    { id: 'auditoria', label: 'Auditoria', icon: 'layers', grupo: 'admin', perm: 'auditoria' },
    { id: 'utilizadores', label: 'Utilizadores e alçadas', icon: 'users', grupo: 'admin', perm: 'admin' },
    { id: 'definicoes', label: 'Definições e cópias', icon: 'settings', grupo: 'admin', perm: 'admin' });

  route('spap', { id: 'spap', title: 'Painel de autorizações', render(v) {
    const ps = db.pedidos;
    const by = e => ps.filter(p => p.estado === e);
    const pend = ps.filter(p => ['PENDENTE', 'EM_APROVACAO'].includes(p.estado));
    const mesAtual = ym(today());
    const execMes = ps.filter(p => p.estado === 'EXECUTADO' && ym(p.dataExecucao || p.executadoEm) === mesAtual && p.categoria !== ENTRADA);
    const tot = app.contasInternas().reduce((s, c) => s + saldo(c.id), 0);
    v.innerHTML = `
      ${app.alertaAlcadas()}
      ${app.provaSaldos().ok ? '' : `<div class="alert bad" style="margin-bottom:16px">${icon('alert')}<div><b>A prova de saldos tem erros.</b> Veja <a href="#/fechos">Prova de saldos e fechos</a>.</div></div>`}
      ${(() => { const al = app.alertasLiquidez(); return al.length ? `<div class="alert bad" style="margin-bottom:16px">${icon('chart')}<div><b>Alerta de liquidez.</b> ${al.slice(0, 3).map(a => `${esc(a.conta.nome)} fica ${a.min ? 'abaixo do mínimo' : 'negativa'} na semana de ${date(a.semana.ini)} (${eur(a.semana.final)})`).join(' · ')} — <a href="#/liquidez">ver previsão</a></div></div>` : ''; })()}
      ${can('criar') && app.recorrentesDevidos().length ? `<div class="alert warn" style="margin-bottom:16px">${icon('clock')}<div><b>${app.recorrentesDevidos().length} pedido(s) recorrente(s) por gerar.</b> <a href="#/recorrentes">Gerar e assinar</a></div></div>` : ''}
      ${app.alteracoesParaMim().length ? `<div class="alert warn" style="margin-bottom:16px">${icon('edit')}<div><b>${app.alteracoesParaMim().length} alteração(ões) às regras aguarda(m) a sua aprovação.</b> <a href="#/alteracoes">Rever</a></div></div>` : ''}
      ${!db.settings.segregacao ? `<div class="alert warn" style="margin-bottom:16px">${icon('alert')}<div><b>Segregação de funções desativada.</b> Um utilizador pode aprovar os próprios pedidos. Quando existirem dois ou mais aprovadores, ative-a em <a href="#/definicoes">Definições</a>.</div></div>` : ''}
      <div class="grid g4">
        <div class="card kpi hero"><div class="lbl">${icon('wallet')} Saldo total consolidado</div><div class="val num">${eur(tot)}</div><div class="foot">${app.contasInternas().length} contas internas</div></div>
        <div class="card kpi"><div class="lbl">${icon('clock')} A aguardar aprovação</div><div class="val num">${pend.length}</div><div class="foot">${eur(pend.reduce((s, p) => s + p.valor, 0))}</div></div>
        <div class="card kpi"><div class="lbl">${icon('check')} Aprovados por executar</div><div class="val num">${by('APROVADO').length}</div><div class="foot">${eur(by('APROVADO').reduce((s, p) => s + p.valor, 0))} cativos</div></div>
        <div class="card kpi"><div class="lbl">${icon('arrow')} Executado este mês</div><div class="val num">${eur(execMes.reduce((s, p) => s + p.valor, 0))}</div><div class="foot">${execMes.length} operações</div></div>
      </div>
      <div class="grid g3" style="margin-top:16px">
        <div class="card span2"><div class="card-h"><h3>Fluxo de pedidos · últimos 6 meses</h3><span class="sub">por data prevista</span></div><div id="ch1"></div></div>
        <div class="card"><div class="card-h"><h3>Por estado</h3></div><div id="ch2"></div></div>
      </div>
      <div class="card flush" style="margin-top:16px"><div class="card-h"><h3>Requer a sua ação</h3><a class="btn sm" href="#/aprovacoes">Ver tudo</a></div><div id="tb"></div></div>
      <div class="card flush" style="margin-top:16px"><div class="card-h"><h3>Atividade recente</h3><a class="btn sm" href="#/pedidos">Todos os pedidos</a></div><div id="tb2"></div></div>`;
    const months = []; const d0 = new Date(); for (let i = 5; i >= 0; i--) { const d = new Date(d0.getFullYear(), d0.getMonth() - i, 15); months.push(d.toISOString().slice(0, 7)); }
    const sum = (m, f) => r2(ps.filter(p => ym(p.dataPrevista) === m && f(p)).reduce((s, p) => s + p.valor, 0));
    SPAP.chart.bars(v.querySelector('#ch1'), { labels: months.map(m => MES3[+m.slice(5) - 1]), series: [
      { name: 'Executado', values: months.map(m => sum(m, p => p.estado === 'EXECUTADO' && p.categoria !== ENTRADA)), color: 'var(--ok)' },
      { name: 'Aprovado', values: months.map(m => sum(m, p => p.estado === 'APROVADO')), color: 'var(--accent)' },
      { name: 'Pendente', values: months.map(m => sum(m, p => ['PENDENTE', 'EM_APROVACAO'].includes(p.estado))), color: 'var(--warn)' }], stacked: true });
    SPAP.chart.donut(v.querySelector('#ch2'), { center: String(ps.length), sub: 'pedidos', fmt: x => String(x),
      items: [['Pendentes', pend.length, 'var(--warn)'], ['Aprovados', by('APROVADO').length, 'var(--accent)'], ['Executados', by('EXECUTADO').length, 'var(--ok)'], ['Rejeitados', by('REJEITADO').length, 'var(--bad)'], ['Cancelados', by('CANCELADO').length, 'var(--faint)']].map(([label, value, color]) => ({ label, value, color })) });
    v.querySelector('#tb').innerHTML = app.tabelaPedidos(app.caixaEntrada().slice(0, 6), { empty: 'Nada pendente para si. ✓' });
    v.querySelector('#tb2').innerHTML = app.tabelaPedidos(ps.slice().sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)).slice(0, 8));
    app.bindPedidos(v);
  } });

  route('aprovacoes', { id: 'aprovacoes', title: 'Caixa de entrada', render(v) {
    const ap = db.pedidos.filter(p => app.podeAprovar(p)[0]);
    const ex = db.pedidos.filter(p => app.podeExecutar(p)[0]);
    const bloq = db.pedidos.filter(p => p.estado === 'APROVADO' && can('executar') && !app.podeExecutar(p)[0]);
    v.innerHTML = `<div class="stack">
      <div class="card flush"><div class="card-h"><h3>Para aprovar <span class="badge warn plain">${ap.length}</span></h3>${ap.length > 1 ? `<button class="btn sm" id="ap-all">${icon('check')} Aprovar todos (${eur(ap.reduce((s, p) => s + p.valor, 0))})</button>` : ''}</div>${app.tabelaPedidos(ap, { empty: 'Sem pedidos a aguardar a sua aprovação.' })}</div>
      <div class="card flush"><div class="card-h"><h3>Para executar <span class="badge acc plain">${ex.length}</span></h3></div>${app.tabelaPedidos(ex, { empty: 'Sem pedidos aprovados prontos a executar.' })}</div>
      ${bloq.length ? `<div class="card flush"><div class="card-h"><h3>Bloqueados por saldo <span class="badge bad plain">${bloq.length}</span></h3><span class="sub">Registe uma entrada de fundos na conta ordenante</span></div>${app.tabelaPedidos(bloq)}</div>` : ''}
      ${!can('aprovar') && !can('executar') ? `<div class="alert info">${icon('shield')}<div>O seu perfil (${ROLES[app.user.role].label}) não aprova nem executa pedidos.</div></div>` : ''}</div>`;
    app.bindPedidos(v);
    const all = v.querySelector('#ap-all');
    if (all) all.onclick = async () => {
      const s = await app.assinar(`Aprovar ${ap.length} pedidos`, `Total: <b>${eur(ap.reduce((s, p) => s + p.valor, 0))}</b>`); if (!s) return;
      let n = 0; for (const p of ap) { try { if (!app.podeAprovar(p)[0]) continue; await s.signer(p, 'APROVAR'); app.aprovar(p, s.nota); n++; } catch (e) { } } save(); ui.toast(`${n} pedidos aprovados`, 'ok'); render();
    };
  } });

  route('pedidos', { id: 'pedidos', title: 'Pedidos', render(v, _a, params) {
    if (params[0]) return renderPedido(v, params[0]);
    let tab = sessionStorage.getItem(KEY + ':tab') || 'todos', q = '', cat = '';
    const tabs = { todos: () => true, pend: p => ['PENDENTE', 'EM_APROVACAO'].includes(p.estado), aprov: p => p.estado === 'APROVADO', exec: p => p.estado === 'EXECUTADO', out: p => ['REJEITADO', 'CANCELADO'].includes(p.estado) };
    const visiveis = () => db.pedidos.filter(p => can('ver_todos') || p.criadoPor === app.user.id);
    v.innerHTML = `<div class="row between" style="margin-bottom:14px"><div class="tabs" id="tabs"></div>
      <div class="row"><input class="inp inp-sm" id="q" placeholder="Pesquisar n.º, descrição, beneficiário…" style="width:260px">
      <select class="inp inp-sm" id="cat"><option value="">Todas as categorias</option>${db.categorias.map(c => `<option>${esc(c)}</option>`).join('')}</select>
      <button class="btn sm" id="csv">${icon('download')} CSV</button></div></div>
      <div class="card flush" id="lst"></div>`;
    const draw = () => {
      const base = visiveis();
      v.querySelector('#tabs').innerHTML = [['todos', 'Todos'], ['pend', 'Pendentes'], ['aprov', 'Aprovados'], ['exec', 'Executados'], ['out', 'Rejeitados/cancelados']]
        .map(([k, l]) => `<button data-t="${k}" class="${tab === k ? 'on' : ''}">${l}<span class="n">${base.filter(tabs[k]).length}</span></button>`).join('');
      v.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { tab = b.dataset.t; sessionStorage.setItem(KEY + ':tab', tab); draw(); });
      const ql = q.toLowerCase();
      const list = base.filter(tabs[tab]).filter(p => !cat || p.categoria === cat)
        .filter(p => !ql || [p.numero, p.descricao, p.beneficiario, p.autorizacao, nomeConta(p.contaOrigem), nomeConta(p.contaDestino)].join(' ').toLowerCase().includes(ql))
        .sort((a, b) => (b.dataPrevista || '').localeCompare(a.dataPrevista || '') || b.criadoEm.localeCompare(a.criadoEm));
      const lst = v.querySelector('#lst');
      lst.innerHTML = app.tabelaPedidos(list, { empty: 'Nenhum pedido corresponde aos filtros.' }) +
        (list.length ? `<div class="row between" style="padding:12px 16px;border-top:1px solid var(--line);font-size:13px"><span class="muted">${list.length} pedidos</span><b class="num">${eur(list.reduce((s, p) => s + p.valor, 0))}</b></div>` : '');
      app.bindPedidos(lst); v._list = list;
    };
    v.querySelector('#q').oninput = e => { q = e.target.value; draw(); };
    v.querySelector('#cat').onchange = e => { cat = e.target.value; draw(); };
    v.querySelector('#csv').onclick = () => SPAP.csv(`pedidos_${cfg.key}_${today()}.csv`, [['N.º', 'Autorização', 'Estado', 'Categoria', 'Requerente', 'Ordenante', 'Destino', 'Valor', 'Método', 'Data prevista', 'Data execução', 'Parcela', 'Associado', 'Descrição', 'Criado por', 'Criado em'],
      ...v._list.map(p => [p.numero, p.autorizacao || '', ESTADOS[p.estado].label, p.categoria, nomeConta(p.requerente), p.contaOrigem ? nomeConta(p.contaOrigem) : 'Externo', p.contaDestino ? nomeConta(p.contaDestino) : p.beneficiario, p.valor, p.metodo, p.dataPrevista, p.dataExecucao || '', p.parcela, p.associado, p.descricao, userName(p.criadoPor), p.criadoEm])]);
    draw();
  } });

  function renderPedido(v, id) {
    const p = app.pedido(id);
    if (!p) { v.innerHTML = `<div class="empty">Pedido não encontrado.</div>`; return; }
    app.setTitle('Pedido ' + p.numero);
    const [okA, whyA] = app.podeAprovar(p), [okE, whyE] = app.podeExecutar(p);
    const nAp = aprovados(p);
    const stepsAp = []; for (let i = 0; i < p.necessarias; i++) {
      const a = p.aprovacoes.filter(x => x.decisao === 'APROVADO')[i];
      stepsAp.push(a ? `<li><span class="dot ok">${icon('check')}</span><b>Aprovação ${i + 1} de ${p.necessarias}</b><small>${esc(userName(a.user))}${a.delegacao ? ' (por delegação de ' + esc(userName(a.delegacao)) + ')' : ''} · ${dt(a.em)}${a.nota ? ' · “' + esc(a.nota) + '”' : ''}</small></li>`
        : `<li><span class="dot ${['REJEITADO', 'CANCELADO'].includes(p.estado) ? '' : 'wait'}"></span><b>Aprovação ${i + 1} de ${p.necessarias}</b><small>A aguardar aprovador</small></li>`);
    }
    const rej = p.aprovacoes.find(a => a.decisao === 'REJEITADO');
    const orig = p.contaOrigem ? conta(p.contaOrigem) : null;
    const checks = [];
    if (orig) { const s = saldo(orig.id); checks.push([s >= p.valor || p.estado === 'EXECUTADO', `Saldo de ${orig.nome}: ${eur(s)} (disponível ${eur(disponivel(orig.id, p.id))})`]); }
    const lim = app.orcamento(p.categoria);
    if (lim) { const g = app.gastoCategoria(p.categoria, ym(p.dataPrevista)); checks.push([g <= lim, `Orçamento ${MES3[+p.dataPrevista.slice(5, 7) - 1]}: ${eur(g)} / ${eur(lim)}`]); }
    const vr = valorRef(p);
    checks.push([true, `Alçada: ${p.necessarias} aprovação(ões) exigida(s)${vr > dupla() ? ' · ' + (p.grupo ? 'total parcelado ' + eur(vr) : 'valor') + ' acima de ' + eur(db.settings.duplaAcima) : ''}`]);
    if ((p.flags || []).includes('FRACIONAMENTO')) checks.push([false, 'Possível fracionamento: pedidos do mesmo dia para o mesmo destino ultrapassam o limite — exige 2 aprovações']);
    if ((p.flags || []).includes('FORA_ORCAMENTO')) checks.push([false, 'Fora do orçamento mensal — exige 2 aprovações']);
    if ((p.flags || []).includes('FORA_ORCAMENTO_CC')) checks.push([false, 'Excede o orçamento anual do centro de custo — exige 2 aprovações']);
    if (['PENDENTE', 'EM_APROVACAO'].includes(p.estado)) {
      const ja = p.aprovacoes.filter(a => a.decisao === 'APROVADO').map(a => a.user);
      const disp = app.aprovadoresElegiveis(vr).filter(u => !ja.includes(u.id) && !(db.settings.segregacao && u.id === p.criadoPor));
      const faltam = p.necessarias - ja.length;
      checks.push([disp.length >= faltam, disp.length >= faltam ? `Aprovadores com alçada disponíveis: ${disp.map(u => u.nome.split(' ')[0]).join(', ')}` : `Faltam ${faltam} aprovação(ões) e só ${disp.length} utilizador(es) com alçada e PIN ativo o podem aprovar`]);
    }
    if (db.settings.segregacao) checks.push([true, 'Segregação de funções ativa']);
    if (['PENDENTE', 'EM_APROVACAO', 'APROVADO'].includes(p.estado) && p.contaOrigem) {
      const av = app.avisosLimites(p.contaOrigem, p.valor, p.estado === 'APROVADO' ? today() : p.dataPrevista);
      av.forEach(t => checks.push([false, t + ' — execução bloqueada']));
      if (!av.length && orig && orig.limites) checks.push([true, 'Dentro dos limites da conta ordenante']);
    }
    const trail = db.audit.filter(a => a.ref === p.id);
    v.innerHTML = `<div class="row" style="margin-bottom:14px"><a class="btn ghost sm" href="#/pedidos">← Pedidos</a></div>
    <div class="grid g3">
      <div class="stack span2">
        <div class="card kpi hero"><div class="row between"><div><div class="lbl">${esc(p.categoria)}${p.parcela ? ' · parcela ' + esc(p.parcela) : ''}</div>
          <div class="amount-hero num">${eur(p.valor)}</div>
          <div class="muted" style="margin-top:4px">${esc(orig ? orig.nome : 'Entrada externa')} → ${esc(p.contaDestino ? nomeConta(p.contaDestino) : p.beneficiario)}</div></div>
          <div style="text-align:right">${ui.estadoBadge(p.estado)}<div class="mono" style="margin-top:10px;font-size:18px;font-weight:700">${esc(p.numero)}</div><div class="faint" style="font-size:12px">Requerimento</div>
          ${p.autorizacao ? `<div class="mono" style="margin-top:6px;font-weight:600">${esc(p.autorizacao)}</div><div class="faint" style="font-size:12px">N.º de autorização</div>` : ''}</div></div></div>
        <div class="card"><div class="card-h"><h3>Detalhes</h3></div><div class="kv">
          <div><span>Requerente</span><b>${esc(nomeConta(p.requerente))}</b></div>
          <div><span>Entidade de execução</span><b>${esc(orig ? orig.nome : '—')}</b></div>
          <div><span>Destino / beneficiário</span><b>${esc(p.contaDestino ? nomeConta(p.contaDestino) : p.beneficiario)}</b></div>
          <div><span>Método (regime)</span><b>${esc(p.metodo)}</b></div>
          <div><span>Data prevista</span><b>${date(p.dataPrevista)}</b></div>
          ${p.centroCusto ? `<div><span>Centro de custo</span><b>${esc(app.ccNome(p.centroCusto))}</b></div>` : ''}
          <div><span>Requerimento associado</span><b class="mono">${esc(p.associado || '—')}</b></div>
          <div><span>Criado por</span><b>${esc(userName(p.criadoPor))} · ${dt(p.criadoEm)}</b></div>
          ${p.dataExecucao ? `<div><span>Executado</span><b>${date(p.dataExecucao)} · ${esc(userName(p.executadoPor))}</b></div><div><span>Comprovativo</span><b>${esc(p.comprovativo || '—')}</b></div>` : ''}
          <div style="grid-column:1/-1"><span>Descrição / finalidade</span><b style="font-weight:500">${esc(p.descricao || '—')}</b></div></div>
          ${p.anexos && p.anexos.length ? `<div class="sep"></div><div class="chips">${p.anexos.map((a, i) => `<button class="btn sm" data-ax="${i}">${icon('file')} ${esc(a.nome)}</button>`).join('')}</div>` : ''}</div>
        <div class="card"><div class="card-h"><h3>Assinaturas eletrónicas</h3><span id="sigbadge"></span></div>${app.cartaoAssinaturas(p)}</div>
        <div class="card"><div class="card-h"><h3>Rasto de auditoria</h3><span class="sub">cadeia de hash SHA-256</span></div>
          ${trail.map(a => `<div style="padding:8px 0;border-bottom:1px solid var(--line)"><div class="row between"><b style="font-size:13px">${esc(a.acao.replace(/_/g, ' '))}</b><span class="faint" style="font-size:12px">${dt(a.ts)} · ${esc(a.user)}</span></div><div class="muted" style="font-size:12.5px">${esc(a.detalhe)}</div><div class="hash">${a.hash}</div></div>`).join('') || '<div class="muted">—</div>'}</div>
      </div>
      <div class="stack">
        <div class="card"><div class="card-h"><h3>Ações</h3></div><div class="stack" style="gap:8px">
          ${['PENDENTE', 'EM_APROVACAO'].includes(p.estado) ? `<button class="btn ok" id="a-ap" ${okA ? '' : 'disabled'} style="justify-content:center">${icon('check')} Aprovar</button>${!okA ? `<div class="faint" style="font-size:12px">${esc(whyA)}</div>` : ''}` : ''}
          ${p.estado === 'APROVADO' ? `<button class="btn primary" id="a-ex" ${okE ? '' : 'disabled'} style="justify-content:center">${icon('arrow')} Executar pagamento</button>${!okE ? `<div class="faint" style="font-size:12px">${esc(whyE)}</div>` : ''}` : ''}
          ${['PENDENTE', 'EM_APROVACAO', 'APROVADO'].includes(p.estado) && app.alcadaEfetiva(app.user).pode ? `<button class="btn bad" id="a-rj" style="justify-content:center">${icon('x')} Rejeitar</button>` : ''}
          ${app.podeCancelar(p) ? `<button class="btn ghost" id="a-cc" style="justify-content:center">Cancelar pedido</button>` : ''}
          <button class="btn" id="a-pr" style="justify-content:center">${icon('eye')} Visualizar requerimento</button>
          ${can('criar') ? `<button class="btn ghost" id="a-dup" style="justify-content:center">${icon('plus')} Duplicar</button>` : ''}
        </div></div>
        <div class="card"><div class="card-h"><h3>Circuito de autorização</h3><span class="sub">${nAp}/${p.necessarias}</span></div>
          <ul class="tl"><li><span class="dot ok">${icon('check')}</span><b>Submetido</b><small>${esc(userName(p.criadoPor))} · ${dt(p.criadoEm)}</small></li>
          ${stepsAp.join('')}
          ${rej ? `<li><span class="dot bad">${icon('x')}</span><b>Rejeitado</b><small>${esc(userName(rej.user))} · ${dt(rej.em)}${rej.nota ? ' · “' + esc(rej.nota) + '”' : ''}</small></li>` : ''}
          ${p.estado === 'CANCELADO' ? `<li><span class="dot bad">${icon('x')}</span><b>Cancelado</b><small>${dt(p.canceladoEm)}${p.notaCancel ? ' · ' + esc(p.notaCancel) : ''}</small></li>` : ''}
          ${!['REJEITADO', 'CANCELADO'].includes(p.estado) ? `<li><span class="dot ${p.estado === 'EXECUTADO' ? 'ok' : p.estado === 'APROVADO' ? 'wait' : ''}">${p.estado === 'EXECUTADO' ? icon('check') : ''}</span><b>Execução</b><small>${p.estado === 'EXECUTADO' ? esc(userName(p.executadoPor)) + ' · ' + date(p.dataExecucao) : 'Após aprovação'}</small></li>` : ''}</ul></div>
        <div class="card"><div class="card-h"><h3>Verificações</h3></div><div class="stack" style="gap:8px">
          ${checks.map(([ok, t]) => `<div class="row" style="gap:8px;align-items:flex-start;font-size:13px"><span class="${ok ? 'pos' : 'neg'}" style="width:16px;flex:none">${icon(ok ? 'check' : 'alert')}</span><span>${esc(t)}</span></div>`).join('')}</div></div>
        <div class="card"><div class="card-h"><h3>Código de verificação</h3>${icon('qr')}</div>
          <div class="qr-box">${app.qrDataUrl(app.qrPayload(p), 4) ? `<img src="${app.qrDataUrl(app.qrPayload(p), 4)}" alt="QR">` : '<span class="muted">Biblioteca QR indisponível</span>'}</div>
          <div class="hash" style="margin-top:8px">${esc(app.qrPayload(p))}</div></div>
      </div></div>`;
    app.preencherVerificacao(v, p);
    const $ = s => v.querySelector(s);
    v.querySelectorAll('[data-ax]').forEach(b => b.onclick = () => { const a = p.anexos[+b.dataset.ax]; const w = window.open(); if (w) w.document.write(`<title>${esc(a.nome)}</title><iframe src="${a.data}" style="border:0;position:fixed;inset:0;width:100%;height:100%"></iframe>`); });
    if ($('#a-ap') && okA) $('#a-ap').onclick = async () => {
      const s = await app.assinar('Aprovar pedido ' + p.numero, `${esc(p.categoria)} · <b>${eur(p.valor)}</b>`); if (!s) return;
      try { await s.signer(p, 'APROVAR'); app.aprovar(p, s.nota); save(); ui.toast(p.estado === 'APROVADO' ? `<b>Aprovado.</b> Autorização ${p.autorizacao}` : 'Aprovação registada. Falta outro aprovador.', 'ok'); render(); } catch (e) { ui.toast(esc(e.message), 'bad'); }
    };
    if ($('#a-ex') && okE) $('#a-ex').onclick = () => {
      ui.modal({ title: 'Executar pagamento', sub: `${p.numero} · ${eur(p.valor)}`, body: `<form class="form"><div class="fld"><label>Data da operação</label><input class="inp" type="date" name="data" value="${today()}"></div>
        <div class="fld"><label>Comprovativo / referência</label><input class="inp" name="comprovativo" placeholder="Referência interna, documento de suporte…"></div></form>`,
        actions: [{ label: 'Cancelar', kind: 'ghost' }, { label: 'Continuar', kind: 'primary', onClick: async el => {
          const f = ui.formData(el);
          const s = await app.assinar('Executar ' + p.numero, `Debita <b>${eur(p.valor)}</b> de ${esc(orig ? orig.nome : '—')}`); if (!s) return;
          try { if (!app.podeExecutar(p)[0]) throw new Error(app.podeExecutar(p)[1]); await s.signer(p, 'EXECUTAR'); app.executar(p, f); save(); ui.toast('<b>Pagamento executado.</b> Movimentos lançados.', 'ok'); render(); } catch (e) { ui.toast(esc(e.message), 'bad'); }
        } }] });
    };
    if ($('#a-rj')) $('#a-rj').onclick = () => ui.modal({ title: 'Rejeitar pedido ' + p.numero, body: `<form><div class="fld"><label>Motivo da rejeição</label><textarea class="inp" name="m" required></textarea></div></form>`,
      actions: [{ label: 'Voltar', kind: 'ghost' }, { label: 'Rejeitar', kind: 'bad', onClick: async el => {
        const m = ui.formData(el).m; if (!m) { ui.toast('Indique o motivo', 'warn'); return false; }
        const s = await app.assinar('Rejeitar ' + p.numero); if (!s) return;
        try { await s.signer(p, 'REJEITAR'); app.rejeitar(p, m); save(); ui.toast('Pedido rejeitado', 'warn'); render(); } catch (e) { ui.toast(esc(e.message), 'bad'); }
      } }] });
    if ($('#a-cc')) $('#a-cc').onclick = async () => { if (!await ui.confirm('Cancelar pedido', `O pedido ${p.numero} será cancelado e o saldo cativo libertado.`, { okLabel: 'Cancelar pedido', danger: true })) return;
      const s = await app.assinar('Cancelar ' + p.numero); if (!s) return; await s.signer(p, 'CANCELAR'); app.cancelar(p, s.nota); save(); render(); };
    $('#a-pr').onclick = () => visualizarRequerimento(p);
    if ($('#a-dup')) $('#a-dup').onclick = () => app.novoPedido({ ...p, parcelas: 1, origem: null, associado: p.numero });
  }

  /* ---------- Código QR de verificação ---------- */
  app.qrPayload = p => ['SPAP1', cfg.key.toUpperCase(), p.numero, p.autorizacao || '-', (+p.valor).toFixed(2), p.estado,
    app.docHash(p).slice(0, 16).toUpperCase(), app.selo(p).slice(0, 16).toUpperCase()].join('|');
  app.qrDataUrl = (text, cell = 4) => {
    if (typeof global.qrcode !== 'function') return null;
    const q = global.qrcode(0, 'M'); q.addData(text); q.make(); return q.createDataURL(cell, cell * 2);
  };
  const sigEstadoHtml = r => !r ? '<span class="badge plain">A verificar…</span>' : r.ok ? '<span class="badge ok">Assinatura válida</span>' : `<span class="badge bad">Inválida · ${esc(r.motivo)}</span>`;
  app.cartaoAssinaturas = (p) => {
    const sigs = p.assinaturas || [];
    if (!sigs.length) return `<div class="muted" style="font-size:13px">Sem assinaturas eletrónicas${p.criadoPor && !p.assinaturas ? ' (pedido migrado ou anterior à assinatura eletrónica)' : ''}.</div>`;
    return `<div class="sig-list">${sigs.map((s, i) => `<div class="sig-item">
      <div class="sig-img">${s.rubrica ? `<img src="${s.rubrica}" alt="Rubrica">` : ''}</div>
      <div style="min-width:0;flex:1"><div class="row between"><b>${esc(ACOES[s.acao] || s.acao)}</b><span data-sv="${i}">${sigEstadoHtml(null)}</span></div>
        <div style="font-size:13px">${esc(s.nome || userName(s.user))} · ${dt(s.ts)}${s.nota ? ' · “' + esc(s.nota) + '”' : ''}</div>
        <div class="hash">Certificado ${esc(fmtId(s.keyId))} · ECDSA P-256 · doc ${esc(s.docHash.slice(0, 24))}…</div></div></div>`).join('')}</div>`;
  };
  app.preencherVerificacao = async (el, p) => {
    const res = await app.verificarPedido(p);
    res.forEach((r, i) => { const x = el.querySelector(`[data-sv="${i}"]`); if (x) x.innerHTML = sigEstadoHtml(r); });
    const b = el.querySelector('#sigbadge');
    if (b && res.length) b.innerHTML = res.every(r => r.ok) ? `<span class="badge ok">${icon('pen')} ${res.length} assinatura(s) válida(s)</span>` : '<span class="badge bad">Assinatura inválida</span>';
    return res;
  };

  async function htmlRequerimento(p) {
    const res = await app.verificarPedido(p);
    const sigs = p.assinaturas || [];
    const ap = p.aprovacoes.filter(a => a.decisao === 'APROVADO');
    const resultado = { PENDENTE: 'EM ANÁLISE', EM_APROVACAO: 'EM ANÁLISE', APROVADO: 'APROVADO', EXECUTADO: 'REALIZADO', REJEITADO: 'REJEITADO', CANCELADO: 'CANCELADO' }[p.estado];
    const payload = app.qrPayload(p); const qr = app.qrDataUrl(payload, 4);
    const req = sigs.find(s => s.acao === 'SUBMETER');
    const fin = sigs.filter(s => s.acao !== 'SUBMETER');
    const bloco = (s, r) => `<div class="sb"><div class="sbi">${s.rubrica ? `<img src="${s.rubrica}">` : ''}</div><div class="sbn"><b>${esc(s.nome || userName(s.user))}</b><br>${esc(ACOES[s.acao] || s.acao)} · ${dt(s.ts)}</div>
      <div class="sbc">Assinado eletronicamente · ECDSA P-256/SHA-256<br>Certificado <span class="mono">${esc(fmtId(s.keyId))}</span> · ${r && r.ok ? '<b style="color:#137333">VÁLIDA</b>' : '<b style="color:#b3261e">INVÁLIDA</b>'}<br><span class="mono" style="font-size:8.5px;word-break:break-all">${esc(s.valor.slice(0, 64))}…</span></div></div>`;
    return (`<!doctype html><html lang="pt"><head><meta charset="utf-8"><title>Requerimento ${esc(p.numero)}</title><style>
      body{font:12.5px/1.45 'Segoe UI',Arial,sans-serif;color:#111;margin:28px auto;max-width:780px;padding:0 24px}
      h1{font-size:13px;letter-spacing:.14em;margin:0;color:#555} h2{font-size:24px;margin:2px 0 0} .top{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;border-bottom:3px solid #111;padding-bottom:12px}
      table{width:100%;border-collapse:collapse;margin-top:14px} td,th{border:1px solid #bbb;padding:6px 9px;text-align:left;vertical-align:top} th{background:#f1f1f1;font-size:10.5px;letter-spacing:.08em;width:32%}
      .sec{margin-top:18px;font-weight:700;letter-spacing:.1em;font-size:11px;border-bottom:1px solid #111;padding-bottom:4px} .r{text-align:right}
      .mono{font-family:Consolas,monospace} .muted{color:#666;font-size:11px} @media print{button{display:none}}
      .sb{display:flex;gap:12px;align-items:center;border:1px solid #bbb;border-radius:6px;padding:8px 10px;margin-top:8px;page-break-inside:avoid}
      .sbi{width:150px;height:50px;flex:none;display:flex;align-items:center;justify-content:center;border-bottom:1px solid #111} .sbi img{max-width:150px;max-height:50px}
      .sbn{flex:1;font-size:11.5px} .sbc{flex:1.3;font-size:10px;color:#333}
      .ver{display:flex;gap:16px;align-items:center;margin-top:22px;border:2px solid #111;border-radius:8px;padding:12px}
      .ver img{width:128px;height:128px;image-rendering:pixelated;flex:none}</style></head><body>
      <div class="top"><div><h1>${esc(cfg.nome.toUpperCase())} · DEPARTAMENTO FINANCEIRO</h1><h2>Requerimento N.º ${esc(p.numero)}</h2></div>
      <div style="text-align:right"><div class="muted">RESULTADO DE ANÁLISE INTERNA</div><b style="font-size:16px">${resultado}</b>${p.autorizacao ? `<div class="mono" style="margin-top:4px">Autorização ${esc(p.autorizacao)}</div>` : ''}</div></div>
      <table><tr><th>CATEGORIA</th><td>${esc(p.categoria)}</td></tr><tr><th>REQUERENTE</th><td>${esc(nomeConta(p.requerente))}</td></tr>
      <tr><th>REQUERIMENTO ASSOCIADO</th><td class="mono">${esc(p.associado || '—')}</td></tr><tr><th>PREVISÃO DE EXECUÇÃO</th><td>${date(p.dataPrevista)}</td></tr>
      <tr><th>RESPONSÁVEL DE EXECUÇÃO DA OPERAÇÃO</th><td>${esc(p.contaOrigem ? nomeConta(p.contaOrigem) : '—')}</td></tr><tr><th>BENEFICIÁRIO</th><td>${esc(p.contaDestino ? nomeConta(p.contaDestino) : p.beneficiario)} ${p.iban ? '<span class="mono">· ' + esc(p.iban) + '</span>' : ''}</td></tr>
      ${p.centroCusto ? `<tr><th>CENTRO DE CUSTO</th><td>${esc(app.ccNome(p.centroCusto))}</td></tr>` : ''}<tr><th>REGIME</th><td>${esc(p.metodo)}</td></tr><tr><th>PARCELA</th><td>${esc(p.parcela || 'PAGAMENTO ÚNICO')}</td></tr><tr><th>FINALIDADE</th><td>${esc(p.descricao || '—')}</td></tr>
      <tr><th>VALOR DESTE REQUERIMENTO</th><td><b style="font-size:15px">${eur(p.valor)}</b></td></tr></table>
      <div class="sec">CERTIFICAÇÃO DO REQUERENTE</div><p style="margin:6px 0">O requerente declara total responsabilidade pela veracidade dos dados informados, estando disposto(a) a fornecer quaisquer comprovativos adicionais que se façam necessários.</p>
      ${req ? bloco(req, res[sigs.indexOf(req)]) : `<p class="muted">Requerente: ${esc(userName(p.criadoPor))} · ${dt(p.criadoEm)} · sem assinatura eletrónica (registo migrado).</p>`}
      <div class="sec">DELIBERAÇÃO DO DEPARTAMENTO FINANCEIRO</div><p style="margin:6px 0">O Departamento Financeiro, por meio de representação autorizada, confirma que, com base nas observações do requerimento e com o melhor do seu conhecimento, este requerimento reflete com precisão a finalidade a que se destina e atende aos requisitos internos e contratuais suficientes para justificar o pagamento no valor certificado acima.</p>
      ${fin.length ? fin.map(s => bloco(s, res[sigs.indexOf(s)])).join('') : ap.map((a, i) => `<p class="muted">Aprovação ${i + 1}: ${esc(userName(a.user))} · ${dt(a.em)} (registo migrado, sem assinatura eletrónica)</p>`).join('')}
      ${p.dataExecucao ? `<table><tr><th>DATA DA OPERAÇÃO</th><td>${date(p.dataExecucao)} · ${esc(p.comprovativo || '')}</td></tr></table>` : ''}
      <div class="ver">${qr ? `<img src="${qr}" alt="QR de verificação">` : ''}<div><b>Verificação de autenticidade</b><br>
        Leia o código QR no menu <b>Verificar documento</b> do sistema ${esc(cfg.nome)} para confirmar que este requerimento e as suas assinaturas são autênticos e não foram alterados.
        <div class="mono" style="font-size:9.5px;margin-top:6px;word-break:break-all">${esc(payload)}</div>
        <div class="muted" style="margin-top:4px">Impressão digital do documento: <span class="mono">${app.docHash(p).slice(0, 32)}</span> · emitido em ${dt(new Date())}</div></div></div>
      </body></html>`);
  }

  /* Visualizar requerimento dentro do sistema (com opção de imprimir) */
  async function visualizarRequerimento(p) {
    const m = ui.modal({ title: 'Requerimento N.º ' + esc(p.numero), sub: 'Pré-visualização do documento oficial, com assinaturas eletrónicas e código QR de verificação.', wide: true,
      body: `<div class="doc-view"><div class="muted" style="padding:40px;text-align:center">A verificar assinaturas…</div></div>`,
      actions: [{ label: 'Fechar', kind: 'ghost' }, { label: icon('print') + 'Imprimir / guardar PDF', kind: 'primary', close: false, onClick: el => {
        const f = el.querySelector('iframe'); if (f) f.contentWindow.print(); } }] });
    const html = await htmlRequerimento(p);
    const box = m.el.querySelector('.doc-view'); if (!box) return;
    const f = document.createElement('iframe'); f.title = 'Requerimento ' + p.numero; f.srcdoc = html; box.innerHTML = ''; box.appendChild(f);
    log('REQUERIMENTO_VISUALIZADO', p.numero, p.id); save();
  }

  /* ---------- Verificar documento (QR) ---------- */
  route('verificar', { id: 'verificar', title: 'Verificar documento', render(v) {
    let stream = null;
    v.innerHTML = `<div class="grid g2">
      <div class="card"><div class="card-h"><h3>Ler código QR</h3><span class="sub">requerimento impresso ou PDF</span></div>
        <div class="stack"><div class="row"><button class="btn primary" id="cam">${icon('eye')} Usar câmara</button>
          <label class="btn">${icon('upload')} Imagem / fotografia<input type="file" id="img" accept="image/*" hidden></label></div>
          <video id="vid" playsinline muted style="width:100%;border-radius:12px;background:#000;display:none"></video>
          <div class="fld"><label>Ou cole o texto do código</label><textarea class="inp mono" id="code" placeholder="SPAP1|…" style="min-height:70px"></textarea></div>
          <div class="row" style="justify-content:flex-end"><button class="btn" id="go">${icon('shield')} Verificar</button></div></div></div>
      <div id="res"><div class="card empty">${icon('qr')}<p>O resultado da verificação aparece aqui.</p></div></div></div>`;
    const res = v.querySelector('#res'), code = v.querySelector('#code'), vid = v.querySelector('#vid');
    const stop = () => { if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; } vid.style.display = 'none'; };
    window.addEventListener('hashchange', stop, { once: true });
    const decode = (src, w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(src, 0, 0, w, h);
      const r = global.jsQR ? global.jsQR(x.getImageData(0, 0, w, h).data, w, h) : null; return r ? r.data : null; };
    const verificar = async txt => {
      txt = (txt || '').trim(); code.value = txt;
      const parts = txt.split('|');
      const box = (cls, titulo, corpo) => `<div class="card"><div class="alert ${cls}" style="margin-bottom:14px">${icon(cls === 'ok' ? 'check' : 'alert')}<div><b>${titulo}</b></div></div>${corpo || ''}</div>`;
      if (parts[0] !== 'SPAP1' || parts.length < 8) { res.innerHTML = box('bad', 'Código não reconhecido', '<p class="muted">Não é um código de verificação SPAP.</p>'); return; }
      if (parts[1] !== cfg.key.toUpperCase()) { res.innerHTML = box('warn', 'Documento de outro sistema', `<p class="muted">Este requerimento foi emitido pelo sistema <b>${esc(parts[1])}</b>. Verifique-o nesse sistema.</p>`); return; }
      const p = db.pedidos.find(x => x.numero === parts[2]);
      if (!p) { res.innerHTML = box('bad', 'Requerimento inexistente', `<p class="muted">Não existe nenhum requerimento ${esc(parts[2])} neste sistema. O documento pode ser falso.</p>`); return; }
      const docOk = app.docHash(p).slice(0, 16).toUpperCase() === parts[6] && (+p.valor).toFixed(2) === parts[4];
      const autOk = parts[3] === '-' || parts[3] === p.autorizacao;
      const atual = app.selo(p).slice(0, 16).toUpperCase() === parts[7];
      const sv = await app.verificarPedido(p);
      const sigOk = sv.every(r => r.ok);
      const cls = docOk && autOk && sigOk ? 'ok' : 'bad';
      const titulo = cls === 'ok' ? (atual ? 'Documento autêntico — corresponde à versão atual' : 'Documento autêntico — emitido numa fase anterior do circuito') : 'Documento NÃO corresponde aos registos';
      res.innerHTML = box(cls, titulo, `
        <div class="kv" style="margin-bottom:14px"><div><span>Requerimento</span><b class="mono">${esc(p.numero)}</b></div><div><span>Autorização</span><b class="mono">${esc(p.autorizacao || '—')}</b></div>
          <div><span>Valor registado</span><b>${eur(p.valor)}</b></div><div><span>Valor no documento</span><b class="${(+p.valor).toFixed(2) === parts[4] ? '' : 'neg'}">${eur(+parts[4])}</b></div>
          <div><span>Estado no documento</span><b>${esc((ESTADOS[parts[5]] || {}).label || parts[5])}</b></div><div><span>Estado atual</span><b>${ui.estadoBadge(p.estado)}</b></div></div>
        <div class="stack" style="gap:6px;margin-bottom:14px;font-size:13px">
          ${[[docOk, 'Conteúdo do documento íntegro (impressão digital SHA-256)'], [autOk, 'Número de autorização coincide'], [sigOk, `${sv.length} assinatura(s) eletrónica(s) válida(s)`], [atual, atual ? 'Sem alterações de estado desde a emissão' : 'O pedido avançou desde a emissão deste documento']]
            .map(([ok, t]) => `<div class="row" style="gap:8px"><span class="${ok ? 'pos' : 'neg'}">${icon(ok ? 'check' : 'alert')}</span>${t}</div>`).join('')}</div>
        ${app.cartaoAssinaturas(p)}<div class="row" style="margin-top:14px;justify-content:flex-end"><a class="btn" href="#/pedidos/${p.id}">Abrir pedido</a></div>`);
      app.preencherVerificacao(res, p);
      log('DOCUMENTO_VERIFICADO', `${p.numero} · ${cls === 'ok' ? 'autêntico' : 'não corresponde'}`, p.id); save();
    };
    v.querySelector('#go').onclick = () => verificar(code.value);
    v.querySelector('#img').onchange = e => { const f = e.target.files[0]; if (!f) return; const img = new Image();
      img.onload = () => { const sc = Math.min(1, 1600 / Math.max(img.width, img.height)); const t = decode(img, Math.round(img.width * sc), Math.round(img.height * sc)); URL.revokeObjectURL(img.src);
        if (t) verificar(t); else ui.toast('Não foi encontrado nenhum código QR na imagem', 'warn'); };
      img.src = URL.createObjectURL(f); };
    v.querySelector('#cam').onclick = async () => {
      if (stream) return stop();
      try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); }
      catch (e) { ui.toast('Câmara indisponível: ' + esc(e.message), 'bad'); return; }
      vid.srcObject = stream; vid.style.display = 'block'; await vid.play();
      const tick = () => { if (!stream) return; if (vid.videoWidth) { const t = decode(vid, vid.videoWidth, vid.videoHeight); if (t) { stop(); verificar(t); return; } } requestAnimationFrame(tick); };
      tick();
    };
  } });

  route('contas', { id: 'contas', title: 'Contas e saldos', render(v, _a, params) {
    if (params[0]) return renderExtrato(v, params[0]);
    const int = app.contasInternas(false);
    const tot = int.filter(c => c.ativo !== false).reduce((s, c) => s + saldo(c.id), 0);
    v.innerHTML = `<div class="row between" style="margin-bottom:16px"><div><div class="muted" style="font-size:12px">Total de fundos nas contas internas</div><div class="amount-hero num">${eur(tot)}</div></div>
      ${can('contas') ? `<button class="btn" id="nc">${icon('plus')} Nova conta / entidade</button>` : ''}</div>
      <div class="grid g4">${int.map((c, i) => `<div class="acct ${i === 0 ? 'main' : ''}" data-c="${c.id}" style="${c.ativo === false ? 'opacity:.5' : ''}">
        <div class="row between"><b style="font-size:13.5px">${esc(c.nome)}</b>${c.ativo === false ? '<span class="badge">Inativa</span>' : ''}</div>
        <div><div class="muted" style="font-size:11.5px">Saldo contabilístico</div><div class="bal num">${eur(saldo(c.id))}</div></div>
        <div class="meta"><span class="code">${esc(c.codigo || c.id)}</span><span class="muted">Cativo ${eur(cativo(c.id))}</span></div></div>`).join('')}</div>
      <div class="card flush" style="margin-top:18px"><div class="card-h"><h3>Todas as contas e entidades</h3></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Código</th><th>Nome</th><th>Categoria</th><th>NIF</th><th class="r">Saldo</th><th class="r">Cativo</th><th class="r">Disponível</th><th>Estado</th></tr></thead><tbody>
      ${int.map(c => `<tr class="click" data-c="${c.id}"><td class="mono">${esc(c.codigo || c.id)}</td><td><b>${esc(c.nome)}</b></td><td class="muted">${esc(c.categoria || '')}</td><td class="mono">${esc(c.nif || '')}</td>
        <td class="r num">${eur(saldo(c.id))}</td><td class="r num">${eur(cativo(c.id))}</td><td class="r num"><b>${eur(disponivel(c.id))}</b></td>
        <td>${c.ativo === false ? '<span class="badge bad">Desativada</span>' : c.limites && c.limites.bloqueada ? '<span class="badge bad">Bloqueada</span>' : '<span class="badge ok">Ativa</span>'}</td></tr>`).join('')}</tbody></table></div></div>`;
    v.querySelectorAll('[data-c]').forEach(e => e.onclick = () => app.go('contas/' + e.dataset.c));
    if (v.querySelector('#nc')) v.querySelector('#nc').onclick = () => app.editarConta();
  } });

  app.editarConta = (c, extraFields = '') => {
    const novo = !c; c = c || { tipo: 'INTERNA', ativo: true, saldoInicial: 0 };
    ui.modal({ title: novo ? 'Nova conta / entidade' : 'Editar ' + c.nome, body: `<form class="form">
      <div class="fld"><label>Código (ID)</label><input class="inp mono" name="codigo" value="${esc(c.codigo || c.id || '')}" ${novo ? '' : 'readonly'} placeholder="ex.: 0023_NOVA_ENTIDADE"></div>
      <div class="fld"><label>Nome</label><input class="inp" name="nome" value="${esc(c.nome || '')}"></div>
      <div class="fld"><label>Categoria</label><input class="inp" name="categoria" list="dl-cc" value="${esc(c.categoria || '')}"><datalist id="dl-cc">${[...new Set(db.contas.map(x => x.categoria).filter(Boolean))].map(x => `<option>${esc(x)}</option>`).join('')}</datalist></div>
      <div class="fld"><label>NIF</label><input class="inp mono" name="nif" value="${esc(c.nif || '')}"></div>
      <div class="fld"><label>Saldo inicial (€)</label><input class="inp num" type="number" step="0.01" name="saldoInicial" value="${c.saldoInicial || 0}" ${novo ? '' : 'readonly'}><span class="hint">${novo ? 'Saldo de abertura. Depois, só por movimentos autorizados.' : 'Fixo após criação — use uma entrada de fundos.'}</span></div>
      <div class="fld"><label>&nbsp;</label><label class="check"><input type="checkbox" name="ativo" ${c.ativo !== false ? 'checked' : ''}> Ativa</label></div>${extraFields}</form>`,
      actions: [{ label: 'Cancelar', kind: 'ghost' }, { label: 'Guardar', kind: 'primary', onClick: el => {
        const f = ui.formData(el);
        if (!f.codigo || !f.nome) { ui.toast('Código e nome são obrigatórios', 'warn'); return false; }
        if (novo && conta(f.codigo)) { ui.toast('Já existe uma conta com esse código', 'bad'); return false; }
        const { saldoInicial, ...rest } = f;
        if (novo) { const nc = { id: f.codigo, ...rest, tipo: 'INTERNA', saldoInicial: r2(saldoInicial), criadoEm: new Date().toISOString() }; db.contas.push(nc); log('CONTA_CRIADA', `${nc.id} · ${nc.nome} · saldo inicial ${eur(nc.saldoInicial)}`); }
        else { const was = c.ativo; Object.assign(c, rest); log(was !== false && f.ativo === false ? 'CONTA_DESATIVADA' : 'CONTA_ALTERADA', `${c.id} · ${c.nome}`); }
        save(); render();
      } }] });
  };

  function renderExtrato(v, id) {
    const c = conta(id); if (!c) { v.innerHTML = '<div class="empty">Conta não encontrada.</div>'; return; }
    app.setTitle(c.nome);
    const movs = db.movimentos.filter(m => m.conta === id).sort((a, b) => a.data.localeCompare(b.data) || a.ts.localeCompare(b.ts));
    let run = +c.saldoInicial || 0; const rows = movs.map(m => { run = r2(run + m.valor); return { ...m, saldo: run }; }).reverse();
    const ent = movs.filter(m => m.valor > 0).reduce((s, m) => s + m.valor, 0), sai = movs.filter(m => m.valor < 0).reduce((s, m) => s + m.valor, 0);
    const pend = db.pedidos.filter(p => (p.contaOrigem === id || p.contaDestino === id) && ['PENDENTE', 'EM_APROVACAO', 'APROVADO'].includes(p.estado));
    v.innerHTML = `<div class="row" style="margin-bottom:14px"><a class="btn ghost sm" href="#/contas">← Contas</a><div class="spacer" style="flex:1"></div>
      ${can('criar') ? `<button class="btn" id="ent">${icon('download')} Registar entrada de fundos</button>` : ''}
      ${can('criar') ? `<button class="btn" id="pag">${icon('upload')} Pedido de pagamento</button>` : ''}
      ${can('contas') ? `<button class="btn ghost" id="ed">${icon('edit')} Editar</button>` : ''}
      <button class="btn ghost" id="csv">${icon('download')} Extrato CSV</button></div>
      <div class="grid g4"><div class="card kpi hero"><div class="lbl">Saldo contabilístico</div><div class="val num">${eur(saldo(id))}</div><div class="foot mono">${esc(c.codigo || c.id)}</div></div>
        <div class="card kpi"><div class="lbl">Saldo cativo</div><div class="val num">${eur(cativo(id))}</div><div class="foot">aprovado, por executar</div></div>
        <div class="card kpi"><div class="lbl">Disponível</div><div class="val num">${eur(disponivel(id))}</div><div class="foot">${c.nif ? 'NIF ' + esc(c.nif) : '&nbsp;'}</div></div>
        <div class="card kpi"><div class="lbl">Entradas / saídas</div><div class="val num" style="font-size:18px"><span class="pos">+${eur(ent)}</span><br><span class="neg">${eur(sai)}</span></div></div></div>
      ${app.cartaoLimites(c)}
      ${pend.length ? `<div class="card flush" style="margin-top:16px"><div class="card-h"><h3>Pedidos em curso</h3></div>${app.tabelaPedidos(pend, { compact: true })}</div>` : ''}
      <div class="card flush" style="margin-top:16px"><div class="card-h"><h3>Extrato de movimentos</h3><span class="sub">Saldo inicial ${eur(c.saldoInicial)}</span></div>
      ${rows.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Data</th><th>Descrição</th><th>Tipo</th><th class="r">Montante</th><th class="r">Saldo</th></tr></thead><tbody>
      ${rows.map(m => `<tr ${m.pedido ? `class="click" data-p="${m.pedido}"` : ''}><td>${date(m.data)}</td><td>${esc(m.descricao)}</td><td><span class="badge plain">${esc(m.tipo)}</span></td><td class="r num ${m.valor < 0 ? 'neg' : 'pos'}" style="font-weight:700">${m.valor > 0 ? '+' : ''}${eur(m.valor)}</td><td class="r num">${eur(m.saldo)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Sem movimentos.</div>'}</div>`;
    app.bindPedidos(v);
    const $ = s => v.querySelector(s);
    if ($('#ent')) $('#ent').onclick = () => app.novoPedido({ categoria: ENTRADA, contaDestino: id, metodo: 'CAPITALIZAÇÃO' });
    if ($('#pag')) $('#pag').onclick = () => app.novoPedido({ contaOrigem: id });
    if ($('#ed')) $('#ed').onclick = () => (cfg.editarConta || app.editarConta)(c);
    app.bindLimites(v, c);
    $('#csv').onclick = () => SPAP.csv(`extrato_${c.id}_${today()}.csv`, [['Data', 'Descrição', 'Tipo', 'Montante', 'Saldo'], ...rows.slice().reverse().map(m => [m.data, m.descricao, m.tipo, m.valor, m.saldo])]);
  }

  route('orcamentos', { id: 'orcamentos', title: 'Orçamentos mensais', render(v) {
    const mes = ym(today());
    v.innerHTML = `<div class="alert info" style="margin-bottom:16px">${icon('target')}<div>Defina um limite mensal por categoria. Pedidos que excedam o orçamento do mês ficam sinalizados e passam a exigir <b>dupla aprovação</b>.</div></div>
      <div class="card flush"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Categoria</th><th style="width:180px">Limite mensal (€)</th><th>Comprometido em ${MESES[+mes.slice(5) - 1]}</th><th style="width:30%"></th></tr></thead><tbody>
      ${db.categorias.filter(c => c !== ENTRADA).map(c => { const lim = app.orcamento(c), g = app.gastoCategoria(c, mes), f = lim ? g / lim : 0;
        return `<tr><td><b>${esc(c)}</b></td><td><input class="inp inp-sm num" style="width:150px" type="number" step="0.01" min="0" data-o="${esc(c)}" value="${lim || ''}" placeholder="sem limite" ${can('admin') ? '' : 'disabled'}></td>
        <td class="num">${eur(g)}${lim ? ` <span class="faint">/ ${eur(lim)}</span>` : ''}</td><td>${lim ? `<div class="progress ${f > 1 ? 'bad' : f > .8 ? 'warn' : ''}"><i style="width:${Math.min(100, f * 100)}%"></i></div>` : '<span class="faint">—</span>'}</td></tr>`; }).join('')}
      </tbody></table></div></div>${can('admin') ? `<div class="row" style="margin-top:14px;justify-content:flex-end"><button class="btn primary" id="sv">Guardar orçamentos</button></div>` : ''}`;
    const sv = v.querySelector('#sv');
    if (sv) sv.onclick = async () => {
      const novo = [...v.querySelectorAll('[data-o]')].filter(i => +i.value > 0).map(i => ({ categoria: i.dataset.o, mensal: r2(i.value) }));
      const det = db.categorias.map(c => [c, app.orcamento(c), (novo.find(o => o.categoria === c) || {}).mensal || 0]).filter(([, a, b]) => r2(a) !== r2(b)).map(([c, a, b]) => [c, a ? eur(a) : 'sem limite', b ? eur(b) : 'sem limite']);
      if (!det.length) return ui.toast('Sem alterações', 'warn');
      if (await app.proporAlteracao('ORCAMENTOS', { orcamentos: novo }, `${det.length} categoria(s)`, det)) render();
    };
  } });

  route('auditoria', { id: 'auditoria', title: 'Registo de auditoria', perm: 'auditoria', render(v) {
    let q = '';
    v.innerHTML = `<div class="row between" style="margin-bottom:14px"><div id="vf"></div><div class="row">
      <input class="inp inp-sm" id="q" placeholder="Filtrar…" style="width:220px"><button class="btn" id="ver">${icon('shield')} Verificar integridade</button><button class="btn" id="csv">${icon('download')} CSV</button></div></div>
      <div class="card flush" id="lst"></div>`;
    const draw = () => {
      const ql = q.toLowerCase(); const list = db.audit.slice().reverse().filter(a => !ql || (a.acao + a.detalhe + a.user).toLowerCase().includes(ql)).slice(0, 500);
      v.querySelector('#lst').innerHTML = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Data/hora</th><th>Utilizador</th><th>Ação</th><th>Detalhe</th><th>Hash</th></tr></thead><tbody>
        ${list.map(a => `<tr ${a.ref && app.pedido(a.ref) ? `class="click" data-p="${a.ref}"` : ''}><td style="white-space:nowrap">${dt(a.ts)}</td><td>${esc(a.user)}</td><td><span class="badge plain">${esc(a.acao.replace(/_/g, ' '))}</span></td><td style="font-size:12.5px">${esc(a.detalhe)}</td><td class="hash" title="${a.hash}">${a.hash.slice(0, 16)}…</td></tr>`).join('')}</tbody></table></div>`;
      app.bindPedidos(v.querySelector('#lst'));
    };
    v.querySelector('#q').oninput = e => { q = e.target.value; draw(); };
    v.querySelector('#ver').onclick = () => { const r = app.verifyChain();
      v.querySelector('#vf').innerHTML = r.ok ? `<div class="alert ok">${icon('check')}<div><b>Cadeia íntegra.</b> ${r.n} registos verificados.</div></div>` : `<div class="alert bad">${icon('alert')}<div><b>Cadeia quebrada no registo #${r.at + 1}.</b> Os dados foram alterados fora do sistema.</div></div>`; };
    v.querySelector('#csv').onclick = () => SPAP.csv(`auditoria_${cfg.key}_${today()}.csv`, [['Data/hora', 'Utilizador', 'Ação', 'Detalhe', 'Ref', 'Hash anterior', 'Hash'], ...db.audit.map(a => [a.ts, a.user, a.acao, a.detalhe, a.ref || '', a.prev, a.hash])]);
    draw();
  } });

  route('utilizadores', { id: 'utilizadores', title: 'Utilizadores e alçadas', perm: 'admin', render(v) {
    v.innerHTML = `${app.alertaAlcadas()}<div class="alert info" style="margin-bottom:16px">${icon('shield')}<div><b>Como funcionam as alçadas.</b> Pedidos até ${eur(db.settings.duplaAcima)} exigem 1 aprovação. Acima disso — ou fora do orçamento, ou com indícios de fracionamento — exigem 2 aprovações de pessoas diferentes.
      Cada aprovador só aprova pedidos até à sua alçada (o Administrador não tem limite). Em pagamentos parcelados conta o <b>valor total</b> das parcelas.
      Para aprovar pedidos acima de ${eur(db.settings.duplaAcima)} são precisos pelo menos 2 aprovadores com alçada superior a esse valor.</div></div>
      <div class="grid g3" style="margin-bottom:16px">${Object.entries(ROLES).slice(0, 3).map(([k, r]) => `<div class="card"><b>${r.label}</b><div class="chips" style="margin-top:8px">${r.perms.map(p => `<span class="badge plain">${p.replace('_', ' ')}</span>`).join('')}</div></div>`).join('')}</div>
      <div class="card flush"><div class="card-h"><h3>Utilizadores</h3><button class="btn sm" id="nu">${icon('plus')} Novo utilizador</button></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Nome</th><th>Utilizador</th><th>Perfil</th><th class="r">Alçada de aprovação</th><th>PIN</th><th>Último acesso</th><th>Estado</th><th></th></tr></thead><tbody>
      ${db.users.map(u => `<tr><td><div class="row"><span class="avatar">${initials(u.nome)}</span><b>${esc(u.nome)}</b></div></td><td class="mono">${esc(u.username)}</td><td>${ROLES[u.role].label}</td>
        <td class="r num">${u.role === 'ADMIN' ? 'Ilimitada' : ROLES[u.role].perms.includes('aprovar') ? eur(u.limite) : '—'}</td><td>${u.pinHash ? (u.mustChange ? '<span class="badge warn">Temporário</span>' : '<span class="badge ok">Definido</span>') : '<span class="badge bad">Por definir</span>'}</td>
        <td class="muted">${dt(u.ultimoAcesso)}</td><td>${u.ativo === false ? '<span class="badge bad">Inativo</span>' : '<span class="badge ok">Ativo</span>'}</td>
        <td class="r"><button class="btn sm" data-ed="${u.id}">${icon('edit')}</button> <button class="btn sm" data-pin="${u.id}">${icon('key')} PIN</button></td></tr>`).join('')}</tbody></table></div></div>`;
    const edit = u => {
      const novo = !u; u = u || { role: 'OPERADOR', limite: 0, ativo: true };
      ui.modal({ title: novo ? 'Novo utilizador' : 'Editar ' + u.nome, body: `<form class="form">
        <div class="fld full"><label>Nome completo</label><input class="inp" name="nome" value="${esc(u.nome || '')}"></div>
        <div class="fld"><label>Nome de utilizador</label><input class="inp mono" name="username" value="${esc(u.username || '')}"></div>
        <div class="fld"><label>Perfil</label><select class="inp" name="role">${Object.entries(ROLES).map(([k, r]) => `<option value="${k}" ${u.role === k ? 'selected' : ''}>${r.label}</option>`).join('')}</select></div>
        <div class="fld"><label>Alçada de aprovação (€)</label><input class="inp num" type="number" step="0.01" name="limite" value="${u.limite || 0}"><span class="hint">Valor máximo por pedido que pode aprovar.</span></div>
        <div class="fld"><label>&nbsp;</label><label class="check"><input type="checkbox" name="ativo" ${u.ativo !== false ? 'checked' : ''}> Ativo</label></div></form>`,
        actions: [{ label: 'Cancelar', kind: 'ghost' }, { label: 'Guardar', kind: 'primary', onClick: async el => {
          const f = ui.formData(el); if (!f.nome || !f.username) { ui.toast('Nome e utilizador obrigatórios', 'warn'); return false; }
          if (!novo && u.id === app.user.id && f.role !== 'ADMIN') { ui.toast('Não pode retirar o seu próprio perfil de administrador', 'bad'); return false; }
          if (db.users.some(x => x.username === f.username && x.id !== u.id)) { ui.toast('Esse nome de utilizador já existe', 'bad'); return false; }
          f.limite = r2(f.limite);
          const fmtv = (k, val) => k === 'role' ? ROLES[val].label : k === 'limite' ? eur(val) : k === 'ativo' ? (val ? 'Ativo' : 'Inativo') : String(val ?? '');
          const nomes = { nome: 'Nome', username: 'Utilizador', role: 'Perfil', limite: 'Alçada', ativo: 'Estado' };
          let a;
          if (novo) a = await app.proporAlteracao('UTILIZADOR_NOVO', { user: { id: 'u_' + uid(), ...f } }, `${f.nome} (${ROLES[f.role].label})`, Object.keys(nomes).map(k => [nomes[k], '—', fmtv(k, f[k])]));
          else {
            const det = Object.keys(nomes).filter(k => String(u[k] ?? '') !== String(f[k] ?? '')).map(k => [nomes[k], fmtv(k, u[k]), fmtv(k, f[k])]);
            if (!det.length) { ui.toast('Sem alterações', 'warn'); return false; }
            a = await app.proporAlteracao('UTILIZADOR_ALTERAR', { userId: u.id, campos: f }, u.nome, det);
          }
          if (!a) return false; render();
        } }] });
    };
    v.querySelector('#nu').onclick = () => edit();
    v.querySelectorAll('[data-ed]').forEach(b => b.onclick = () => edit(userById(b.dataset.ed)));
    v.querySelectorAll('[data-pin]').forEach(b => b.onclick = () => { const u = userById(b.dataset.pin);
      ui.modal({ title: 'PIN temporário · ' + u.nome, sub: 'O utilizador terá de escolher um novo PIN no próximo acesso.', body: `<form><div class="fld"><label>PIN temporário (4 a 8 dígitos)</label><input class="inp mono" name="p" type="password" inputmode="numeric" maxlength="8"></div></form>`,
        actions: [{ label: 'Cancelar', kind: 'ghost' }, { label: 'Definir', kind: 'primary', onClick: async el => {
          const p = ui.formData(el).p; if (!/^\d{4,8}$/.test(p)) { ui.toast('4 a 8 dígitos', 'warn'); return false; }
          if (u.id === app.user.id) { const s = await app.assinar('Redefinir o meu PIN'); if (!s) return; app.setPin(u, p); log('PIN_REDEFINIDO', u.username); save(); ui.toast('PIN definido', 'ok'); render(); return; }
          const tmp = {}; app.setPin(tmp, p);
          const a = await app.proporAlteracao('PIN_REDEFINIR', { userId: u.id, salt: tmp.salt, pinHash: tmp.pinHash, por: app.user.nome }, u.nome, [['PIN', u.pinHash ? 'definido' : 'por definir', 'temporário (troca obrigatória no próximo acesso)']]);
          if (!a) return false; render();
        } }] }); });
  } });

  route('definicoes', { id: 'definicoes', title: 'Definições e cópias de segurança', perm: 'admin', render(v) {
    const s = db.settings;
    const bytes = (localStorage.getItem(KEY) || '').length;
    v.innerHTML = `<div class="grid g2">
      <div class="card"><div class="card-h"><h3>Regras de autorização</h3></div><form class="form" id="sf">
        <div class="fld"><label>Dupla aprovação acima de (€)</label><input class="inp num" type="number" step="0.01" name="duplaAcima" value="${s.duplaAcima}"></div>
        <div class="fld"><label>Bloqueio por inatividade (min)</label><input class="inp num" type="number" min="1" name="autoLockMin" value="${s.autoLockMin}"></div>
        <label class="check full"><input type="checkbox" name="segregacao" ${s.segregacao ? 'checked' : ''}> Segregação de funções — quem cria não pode aprovar</label>
        <label class="check full"><input type="checkbox" name="bloquearSemSaldo" ${s.bloquearSemSaldo ? 'checked' : ''}> Impedir execução sem saldo suficiente</label>
        <div class="fld"><label>Prefixo do n.º de autorização</label><input class="inp mono" name="prefixoAut" value="${esc(s.prefixoAut)}"></div>
        <div class="fld"><label>Incremento de requerimento</label><input class="inp num" type="number" min="1" name="reqStep" value="${s.reqStep}"></div>
        <div class="fld full"><label>Categorias de pedido (uma por linha)</label><textarea class="inp" name="categorias" style="min-height:150px">${esc(db.categorias.join('\n'))}</textarea></div>
        <div class="fld full"><label>Métodos de pagamento (um por linha)</label><textarea class="inp" name="metodos">${esc(db.metodos.join('\n'))}</textarea></div>
        <div class="full row" style="justify-content:flex-end"><button class="btn primary">Guardar regras</button></div></form></div>
      <div class="stack">
        <div class="card"><div class="card-h"><h3>Cópia de segurança</h3><span class="sub">${(bytes / 1024).toFixed(0)} KB em uso</span></div>
          <p class="muted" style="margin-top:0">Os dados vivem no armazenamento deste navegador. Exporte regularmente — limpar os dados do navegador apaga o sistema.</p>
          <div class="row"><button class="btn primary" id="exp">${icon('download')} Exportar cópia (.json)</button><label class="btn">${icon('upload')} Restaurar cópia<input type="file" id="imp" accept=".json" hidden></label></div></div>
        <div class="card"><div class="card-h"><h3>Integridade</h3></div><div id="ig"></div></div>
        <div class="card" style="border-color:color-mix(in srgb,var(--bad) 40%,transparent)"><div class="card-h"><h3 class="neg">Zona de perigo</h3></div>
          <p class="muted" style="margin-top:0">Repõe a base de dados com os dados migrados das folhas originais. Tudo o que foi registado será perdido.</p>
          <button class="btn bad" id="rst">${icon('trash')} Repor sistema</button></div></div></div>`;
    const ch = app.verifyChain();
    v.querySelector('#ig').innerHTML = ch.ok ? `<div class="alert ok">${icon('check')}<div>Cadeia de auditoria íntegra · ${ch.n} registos.</div></div>` : `<div class="alert bad">${icon('alert')}<div>Cadeia quebrada no registo #${ch.at + 1}.</div></div>`;
    v.querySelector('#sf').onsubmit = async e => { e.preventDefault(); const f = ui.formData(e.target);
      const ns = { duplaAcima: r2(f.duplaAcima), autoLockMin: Math.max(1, +f.autoLockMin || 10), segregacao: f.segregacao, bloquearSemSaldo: f.bloquearSemSaldo, prefixoAut: f.prefixoAut, reqStep: Math.max(1, +f.reqStep || 1) };
      const cats = f.categorias.split('\n').map(x => x.trim()).filter(Boolean); if (!cats.includes(ENTRADA)) cats.push(ENTRADA);
      const mets = f.metodos.split('\n').map(x => x.trim()).filter(Boolean);
      const sim = b => b ? 'Sim' : 'Não';
      const det = [['Dupla aprovação acima de', eur(s.duplaAcima), eur(ns.duplaAcima)], ['Bloqueio por inatividade', s.autoLockMin + ' min', ns.autoLockMin + ' min'], ['Segregação de funções', sim(s.segregacao), sim(ns.segregacao)],
        ['Impedir execução sem saldo', sim(s.bloquearSemSaldo), sim(ns.bloquearSemSaldo)], ['Prefixo de autorização', s.prefixoAut, ns.prefixoAut], ['Incremento de requerimento', String(s.reqStep), String(ns.reqStep)],
        ['Categorias', db.categorias.join(', '), cats.join(', ')], ['Métodos', db.metodos.join(', '), mets.join(', ')]].filter(([, a, b]) => a !== b);
      if (!det.length) return ui.toast('Sem alterações', 'warn');
      if (await app.proporAlteracao('DEFINICOES', { settings: ns, categorias: cats, metodos: mets }, `${det.length} regra(s)`, det)) render(); };
    v.querySelector('#exp').onclick = () => { log('BACKUP_EXPORTADO', 'Cópia de segurança'); save(); SPAP.download(`backup_${cfg.key}_${today()}.json`, JSON.stringify(db, null, 1)); };
    v.querySelector('#imp').onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader();
      r.onload = async () => { try { const d = JSON.parse(r.result); if (!d.meta || !d.pedidos || !d.users) throw new Error('Ficheiro inválido');
        if (!await ui.confirm('Restaurar cópia', `Substituir todos os dados atuais pela cópia de ${dt(d.audit?.slice(-1)[0]?.ts)}? O restauro segue a regra das duas pessoas.`, { okLabel: 'Propor restauro', danger: true })) return;
        const ref = uid(); try { localStorage.setItem(RKEY(ref), r.result); } catch (e2) { throw new Error('Sem espaço para guardar a cópia até à aprovação. Exporte e limpe anexos antigos.'); }
        const a = await app.proporAlteracao('RESTAURAR_COPIA', { ref, hash: sha256(r.result), origem: f.name }, `${f.name} · ${d.pedidos.length} pedidos · ${d.audit?.length || 0} registos de auditoria`, [['Dados', 'atuais', `cópia de ${dt(d.audit?.slice(-1)[0]?.ts)}`]]);
        if (!a) localStorage.removeItem(RKEY(ref)); else render(); } catch (err) { ui.toast('Erro: ' + esc(err.message), 'bad'); } };
      r.readAsText(f); };
    v.querySelector('#rst').onclick = () => ui.modal({ title: 'Repor sistema', body: `<form><div class="fld"><label>Escreva <b>APAGAR</b> para confirmar</label><input class="inp" name="c"></div></form>`,
      actions: [{ label: 'Cancelar', kind: 'ghost' }, { label: 'Repor', kind: 'bad', onClick: async el => { if (ui.formData(el).c !== 'APAGAR') { ui.toast('Confirmação incorreta', 'warn'); return false; }
        await app.proporAlteracao('REPOR_SISTEMA', {}, 'Apagar todos os dados e repor os dados iniciais', [['Dados', 'atuais', 'apagados']]); render(); } }] });
  } });

  /* =========================================================
     CONTROLO DE ALTERAÇÕES — regra das duas pessoas (maker-checker)
     Alterações a regras, orçamentos, utilizadores, PIN e parâmetros
     financeiros são propostas por um utilizador e só são aplicadas
     depois de aprovadas (e assinadas) por OUTRO aprovador.
     Enquanto não existirem 2 aprovadores com PIN ativo, o sistema
     está em "modo de arranque" e aplica de imediato (fica registado).
     ========================================================= */
  const TIPOS_ALT = {};
  app.registarAlteracao = (tipo, def) => { TIPOS_ALT[tipo] = def; };
  const elegiveisAlt = () => db.users.filter(u => u.ativo !== false && u.pinHash && can('aprovar', u));
  app.modoArranque = () => elegiveisAlt().length < 2;
  const altPendentes = () => (db.alteracoes || []).filter(a => a.estado === 'PENDENTE');
  const altTexto = a => JSON.stringify([a.id, a.tipo, a.payload, a.descricao, a.criadoPor, a.criadoEm]);
  app.podeDecidirAlteracao = (a, u = app.user) => {
    if (!can('aprovar', u)) return [false, 'O seu perfil não aprova alterações'];
    if (a.estado !== 'PENDENTE') return [false, 'Esta alteração já foi decidida'];
    if (a.criadoPor === u.id) return [false, 'Quem propõe não pode aprovar a própria alteração'];
    const def = TIPOS_ALT[a.tipo]; const alvo = def && def.alvo ? def.alvo(a.payload) : null;
    if (alvo && alvo === u.id) return [false, 'Não pode aprovar uma alteração que lhe diz respeito'];
    return [true, ''];
  };
  app.alteracoesParaMim = () => altPendentes().filter(a => app.podeDecidirAlteracao(a)[0]);
  const diffHtml = det => det.length ? `<table class="tbl" style="margin-top:8px"><thead><tr><th>Campo</th><th>Atual</th><th>Proposto</th></tr></thead><tbody>${det.map(([c, a, b]) => `<tr><td>${esc(c)}</td><td class="muted">${esc(a)}</td><td><b>${esc(b)}</b></td></tr>`).join('')}</tbody></table>` : '';
  function aplicarAlteracao(a, decisor, semDuplo) {
    const def = TIPOS_ALT[a.tipo];
    a.estado = 'APLICADA'; a.aplicadaEm = new Date().toISOString(); a.decisor = decisor || null; a.semDuplo = !!semDuplo;
    log(semDuplo ? 'ALTERACAO_SEM_DUPLO_CONTROLO' : 'ALTERACAO_APLICADA', `${def.titulo} · ${a.descricao}`);
    def.aplicar(a.payload);
  }
  // detalhes: [[campo, antes, depois], …]
  app.proporAlteracao = async (tipo, payload, descricao, detalhes = []) => {
    const def = TIPOS_ALT[tipo]; if (!def) throw new Error('Tipo de alteração desconhecido: ' + tipo);
    const direto = app.modoArranque() || !!(def.direto && def.direto(payload));
    const s = await app.assinar(direto ? 'Assinar e aplicar alteração' : 'Assinar proposta de alteração',
      `<b>${esc(def.titulo)}</b> · ${esc(descricao)}${diffHtml(detalhes)}<div style="font-size:12px;margin-top:8px">${direto ? (app.modoArranque() ? 'Modo de arranque: ainda não existem 2 aprovadores, por isso a alteração é aplicada de imediato e fica registada.' : 'Não existe outro aprovador disponível para esta alteração: é aplicada de imediato e o visado é avisado.') : 'A alteração só é aplicada depois de aprovada por outro aprovador.'}</div>`);
    if (!s) return null;
    const a = { id: uid(), tipo, payload, descricao, detalhes, base: def.snapshot ? sha256(def.snapshot(payload)) : '', criadoPor: app.user.id, criadoEm: new Date().toISOString(), estado: 'PENDENTE', assinaturas: [] };
    a.assinaturas.push(await s.signer.texto('PROPOR', altTexto(a)));
    (db.alteracoes = db.alteracoes || []).push(a);
    log('ALTERACAO_PROPOSTA', `${def.titulo} · ${descricao}`);
    if (direto) aplicarAlteracao(a, null, true);
    save();
    ui.toast(direto ? `<b>Alteração aplicada.</b> ${esc(def.titulo)}` : `<b>Proposta enviada.</b> Aguarda aprovação de outro aprovador em <a href="#/alteracoes">Alterações pendentes</a>.`, direto ? 'ok' : 'warn');
    return a;
  };
  app.decidirAlteracao = async (a, aprovar) => {
    const [ok, why] = app.podeDecidirAlteracao(a); if (!ok) throw new Error(why);
    const def = TIPOS_ALT[a.tipo];
    if (aprovar && def.snapshot && sha256(def.snapshot(a.payload)) !== a.base) {
      a.estado = 'OBSOLETA'; log('ALTERACAO_OBSOLETA', `${def.titulo} · ${a.descricao}`); save();
      throw new Error('A configuração mudou desde que a alteração foi proposta. Ficou obsoleta — proponha-a de novo.');
    }
    const s = await app.assinar(aprovar ? 'Aprovar alteração' : 'Rejeitar alteração', `<b>${esc(def.titulo)}</b> · ${esc(a.descricao)}${diffHtml(a.detalhes || [])}`);
    if (!s) return false;
    a.assinaturas.push(await s.signer.texto(aprovar ? 'APROVAR' : 'REJEITAR', altTexto(a)));
    if (aprovar) aplicarAlteracao(a, app.user.id);
    else { if (def.descartar) def.descartar(a.payload); a.estado = 'REJEITADA'; a.decisor = app.user.id; a.decididaEm = new Date().toISOString(); a.nota = s.nota; log('ALTERACAO_REJEITADA', `${def.titulo} · ${a.descricao}${s.nota ? ' · ' + s.nota : ''}`); }
    save(); return true;
  };

  // tipos do núcleo
  app.registarAlteracao('DEFINICOES', { titulo: 'Regras de autorização', snapshot: () => JSON.stringify([db.settings, db.categorias, db.metodos]),
    aplicar: p => { Object.assign(db.settings, p.settings); db.categorias = p.categorias; db.metodos = p.metodos; } });
  app.registarAlteracao('ORCAMENTOS', { titulo: 'Orçamentos mensais', snapshot: () => JSON.stringify(db.orcamentos), aplicar: p => { db.orcamentos = p.orcamentos; } });
  app.registarAlteracao('UTILIZADOR_NOVO', { titulo: 'Novo utilizador', aplicar: p => { if (!userById(p.user.id)) db.users.push({ ...p.user, pinHash: null }); } });
  app.registarAlteracao('UTILIZADOR_ALTERAR', { titulo: 'Alteração de utilizador', alvo: p => p.userId,
    snapshot: p => { const u = userById(p.userId); return JSON.stringify(u ? [u.nome, u.username, u.role, u.limite, u.ativo] : null); },
    aplicar: p => { const u = userById(p.userId); if (u) Object.assign(u, p.campos); } });
  app.registarAlteracao('PIN_REDEFINIR', { titulo: 'Redefinição de PIN', alvo: p => p.userId, snapshot: p => (userById(p.userId) || {}).pinHash || '',
    direto: p => elegiveisAlt().filter(u => u.id !== app.user.id && u.id !== p.userId).length === 0,
    aplicar: p => { const u = userById(p.userId); if (!u) return; u.salt = p.salt; u.pinHash = p.pinHash; u.mustChange = true; u.avisoPin = { por: p.por, em: new Date().toISOString() }; } });
  app.registarAlteracao('REPOR_SISTEMA', { titulo: 'Reposição total do sistema',
    aplicar: () => { setTimeout(() => { localStorage.removeItem(KEY); load(); logout(); }, 60); } });

  route('alteracoes', { id: 'alteracoes', title: 'Alterações pendentes', perm: 'aprovar', render(v) {
    const todas = (db.alteracoes || []).slice().reverse();
    const pend = todas.filter(a => a.estado === 'PENDENTE'), hist = todas.filter(a => a.estado !== 'PENDENTE').slice(0, 100);
    const estadoB = e => ({ PENDENTE: '<span class="badge warn">Pendente</span>', APLICADA: '<span class="badge ok">Aplicada</span>', REJEITADA: '<span class="badge bad">Rejeitada</span>', CANCELADA: '<span class="badge">Cancelada</span>', OBSOLETA: '<span class="badge">Obsoleta</span>' }[e]);
    v.innerHTML = `${app.modoArranque() ? `<div class="alert warn" style="margin-bottom:16px">${icon('alert')}<div><b>Modo de arranque.</b> Ainda não existem 2 aprovadores com PIN ativo, por isso as alterações são aplicadas de imediato (ficam registadas como “sem duplo controlo”). Defina o PIN de um segundo aprovador para ativar a regra das duas pessoas.</div></div>`
      : `<div class="alert ok" style="margin-bottom:16px">${icon('shield')}<div><b>Regra das duas pessoas ativa.</b> Alterações a regras, orçamentos, utilizadores, PIN e parâmetros financeiros só são aplicadas depois de aprovadas por outro aprovador.</div></div>`}
      <div class="card flush"><div class="card-h"><h3>Pendentes <span class="badge warn plain">${pend.length}</span></h3></div>
      ${pend.length ? pend.map(a => { const def = TIPOS_ALT[a.tipo] || { titulo: a.tipo }; const [ok, why] = app.podeDecidirAlteracao(a);
        return `<div style="padding:14px 18px;border-top:1px solid var(--line)"><div class="row between"><div><b>${esc(def.titulo)}</b> · ${esc(a.descricao)}<div class="faint" style="font-size:12px">Proposta por ${esc(userName(a.criadoPor))} · ${dt(a.criadoEm)}</div></div>
          <div class="row">${ok ? `<button class="btn ok sm" data-ap="${a.id}">${icon('check')} Aprovar</button><button class="btn bad sm" data-rj="${a.id}">${icon('x')} Rejeitar</button>` : `<span class="faint" style="font-size:12px">${esc(why)}</span>`}
          ${a.criadoPor === app.user.id ? `<button class="btn ghost sm" data-cc="${a.id}">Cancelar</button>` : ''}</div></div>${diffHtml(a.detalhes || [])}</div>`; }).join('') : '<div class="empty">Sem alterações pendentes.</div>'}</div>
      <div class="card flush" style="margin-top:16px"><div class="card-h"><h3>Histórico</h3></div>${hist.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Data</th><th>Alteração</th><th>Proposta por</th><th>Decidida por</th><th>Assinaturas</th><th>Estado</th></tr></thead><tbody>
        ${hist.map(a => `<tr><td>${dt(a.aplicadaEm || a.decididaEm || a.criadoEm)}</td><td><b>${esc((TIPOS_ALT[a.tipo] || { titulo: a.tipo }).titulo)}</b><div class="faint" style="font-size:12px">${esc(a.descricao)}</div></td><td>${esc(userName(a.criadoPor))}</td>
          <td>${a.semDuplo ? '<span class="badge warn">Sem duplo controlo</span>' : esc(a.decisor ? userName(a.decisor) : '—')}</td><td class="num">${(a.assinaturas || []).length}</td><td>${estadoB(a.estado)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Sem histórico.</div>'}</div>`;
    const find = id => (db.alteracoes || []).find(a => a.id === id);
    v.querySelectorAll('[data-ap]').forEach(b => b.onclick = async () => { try { if (await app.decidirAlteracao(find(b.dataset.ap), true)) { ui.toast('Alteração aprovada e aplicada', 'ok'); render(); } } catch (e) { ui.toast(esc(e.message), 'bad'); render(); } });
    v.querySelectorAll('[data-rj]').forEach(b => b.onclick = async () => { try { if (await app.decidirAlteracao(find(b.dataset.rj), false)) { ui.toast('Alteração rejeitada', 'warn'); render(); } } catch (e) { ui.toast(esc(e.message), 'bad'); } });
    v.querySelectorAll('[data-cc]').forEach(b => b.onclick = () => { const a = find(b.dataset.cc); const df = TIPOS_ALT[a.tipo]; if (df && df.descartar) df.descartar(a.payload); a.estado = 'CANCELADA'; a.decididaEm = new Date().toISOString(); log('ALTERACAO_CANCELADA', a.descricao); save(); render(); });
  } });

  /* =========================================================
     PROVA DE SALDOS E FECHO DIÁRIO
     - Prova: cada pagamento executado tem exatamente os movimentos
       certos; transferências internas somam zero; não há movimentos
       sem justificação.
     - Fecho: fotografia assinada dos saldos e de todos os movimentos
       até à data, encadeada com o fecho anterior. Depois do fecho o
       período fica bloqueado a lançamentos retroativos.
     ========================================================= */
  app.provaSaldos = () => {
    const erros = [], avisos = [];
    const porPedido = {};
    db.movimentos.forEach(m => { if (m.pedido) (porPedido[m.pedido] = porPedido[m.pedido] || []).push(m); });
    let entradas = 0, saidas = 0, internos = 0;
    db.pedidos.forEach(p => {
      const ms = porPedido[p.id] || [];
      if (p.estado !== 'EXECUTADO') { if (ms.length) erros.push(`${p.numero}: tem movimentos mas não está executado`); return; }
      if (!(p.valor > 0)) return;
      const deb = ms.filter(m => m.valor < 0), cre = ms.filter(m => m.valor > 0);
      const espDeb = p.contaOrigem ? 1 : 0, espCre = p.contaDestino && conta(p.contaDestino) ? 1 : 0;
      if (deb.length !== espDeb || cre.length !== espCre) erros.push(`${p.numero}: movimentos em falta ou em duplicado`);
      deb.forEach(m => { if (m.conta !== p.contaOrigem || r2(-m.valor) !== r2(p.valor)) erros.push(`${p.numero}: débito não corresponde ao pedido`); });
      cre.forEach(m => { if (m.conta !== p.contaDestino || r2(m.valor) !== r2(p.valor)) erros.push(`${p.numero}: crédito não corresponde ao pedido`); });
      ms.forEach(m => { if (espDeb && espCre) internos += m.valor; else if (m.valor > 0) entradas += m.valor; else saidas += m.valor; });
    });
    db.movimentos.forEach(m => {
      if (!conta(m.conta)) erros.push(`Movimento numa conta inexistente (${m.conta})`);
      if (m.pedido) { if (!app.pedido(m.pedido)) erros.push(`Movimento refere um pedido inexistente: ${m.descricao}`); return; }
      if (cfg.movimentoValido && cfg.movimentoValido(m, app)) { if (m.valor > 0) entradas += m.valor; else saidas += m.valor; }
      else erros.push(`Movimento sem pedido autorizado: ${m.descricao} (${eur(m.valor)})`);
    });
    if (cfg.provaExtra) cfg.provaExtra(app, erros, avisos);
    db.contas.forEach(c => { const s = saldo(c.id); if (s < 0) avisos.push(`${c.nome} tem saldo negativo (${eur(s)})`); if (cativo(c.id) > s + 0.004) avisos.push(`${c.nome}: saldo cativo (${eur(cativo(c.id))}) superior ao saldo`); });
    internos = r2(internos); if (Math.abs(internos) > 0.004) erros.push(`As transferências internas não somam zero (${eur(internos)})`);
    const iniciais = r2(db.contas.reduce((s, c) => s + (+c.saldoInicial || 0), 0));
    const total = r2(db.contas.reduce((s, c) => s + saldo(c.id), 0));
    const calculado = r2(iniciais + entradas + saidas + internos);
    if (Math.abs(calculado - total) > 0.004) erros.push(`Total das contas (${eur(total)}) difere do total calculado (${eur(calculado)})`);
    return { ok: !erros.length, erros: [...new Set(erros)], avisos, iniciais, entradas: r2(entradas), saidas: r2(saidas), internos, total };
  };
  const movHash = ate => sha256(JSON.stringify(db.movimentos.filter(m => m.data <= ate).map(m => [m.id, m.data, m.conta, r2(m.valor), m.pedido || m.ref || '']).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)));
  const saldosAte = ate => { const o = {}; db.contas.forEach(c => { o[c.id] = r2((+c.saldoInicial || 0) + db.movimentos.reduce((s, m) => m.conta === c.id && m.data <= ate ? s + m.valor : s, 0)); }); return o; };
  const fechoTexto = f => JSON.stringify([f.data, f.saldos, f.total, f.nMov, f.hashMov, f.hashAnterior, f.ts, f.user]);
  app.ultimoFecho = () => (db.fechos || []).slice(-1)[0] || null;
  app.dataFechada = d => { const f = app.ultimoFecho(); return !!f && String(d) <= f.data; };
  app.fecharDia = async data => {
    if (!can('executar') && !can('admin')) throw new Error('Sem permissão para fechar o dia');
    const ult = app.ultimoFecho();
    if (ult && data <= ult.data) throw new Error(`Já existe um fecho até ${date(ult.data)}`);
    if (data > today()) throw new Error('Não é possível fechar dias futuros');
    const prova = app.provaSaldos(); if (!prova.ok) throw new Error('A prova de saldos tem erros — corrija-os antes de fechar');
    const f = { id: uid(), data, ts: new Date().toISOString(), user: app.user.id, saldos: saldosAte(data), nMov: db.movimentos.filter(m => m.data <= data).length, hashMov: movHash(data), hashAnterior: ult ? ult.hash : 'GENESIS' };
    f.total = r2(Object.values(f.saldos).reduce((a, b) => a + b, 0));
    f.hash = sha256(fechoTexto(f));
    const s = await app.assinar('Fecho do dia ' + date(data), `Total de fundos: <b>${eur(f.total)}</b> · ${f.nMov} movimentos<br><span style="font-size:12px">Depois do fecho não são aceites movimentos com data igual ou anterior a ${date(data)}.</span>`);
    if (!s) return null;
    f.assinatura = await s.signer.texto('FECHO', fechoTexto(f));
    (db.fechos = db.fechos || []).push(f);
    log('FECHO_DIARIO', `${data} · total ${eur(f.total)} · ${f.nMov} movimentos · selo ${f.hash.slice(0, 16)}`); save();
    return f;
  };
  app.verificarFechos = async () => {
    const res = []; let prev = 'GENESIS';
    for (const f of (db.fechos || [])) {
      const motivos = [];
      if (f.hashAnterior !== prev) motivos.push('cadeia de fechos quebrada');
      if (sha256(fechoTexto(f)) !== f.hash) motivos.push('o próprio fecho foi alterado');
      if (movHash(f.data) !== f.hashMov) motivos.push('movimentos do período alterados depois do fecho');
      const s = saldosAte(f.data); if (Object.keys(f.saldos).some(k => r2(s[k] || 0) !== r2(f.saldos[k]))) motivos.push('saldos diferentes dos fechados');
      const sv = await app.verificarTexto(fechoTexto(f), f.assinatura); if (!sv.ok) motivos.push('assinatura: ' + sv.motivo);
      res.push({ f, ok: !motivos.length, motivos }); prev = f.hash;
    }
    return res;
  };

  route('fechos', { id: 'fechos', title: 'Prova de saldos e fechos', render(v) {
    const pr = app.provaSaldos(); const ult = app.ultimoFecho();
    const linha = (l, val, strong) => `<tr><td>${l}</td><td class="r num" style="${strong ? 'font-weight:800' : ''}">${eur(val)}</td></tr>`;
    v.innerHTML = `<div class="grid g2">
      <div class="card"><div class="card-h"><h3>Prova de saldos</h3>${pr.ok ? `<span class="badge ok">${icon('check')} Saldos provados</span>` : '<span class="badge bad">Com erros</span>'}</div>
        <table class="tbl"><tbody>${linha('Saldos iniciais das contas', pr.iniciais)}${linha('Entradas de fundos e receitas', pr.entradas)}${linha('Saídas sem conta de destino (registos antigos)', pr.saidas)}${linha('Transferências entre contas internas (têm de somar zero)', pr.internos)}</tbody>
        <tfoot><tr><td>Total de fundos nas contas</td><td class="r num">${eur(pr.total)}</td></tr></tfoot></table>
        <div class="stack" style="gap:6px;margin-top:12px;font-size:13px">
          ${pr.erros.map(e => `<div class="row" style="gap:8px;align-items:flex-start"><span class="neg">${icon('alert')}</span>${esc(e)}</div>`).join('')}
          ${pr.avisos.map(e => `<div class="row" style="gap:8px;align-items:flex-start"><span style="color:var(--warn)">${icon('alert')}</span>${esc(e)}</div>`).join('')}
          ${pr.ok && !pr.avisos.length ? `<div class="row" style="gap:8px"><span class="pos">${icon('check')}</span>Todos os pagamentos executados têm os movimentos corretos e não há movimentos sem autorização.</div>` : ''}</div></div>
      <div class="card"><div class="card-h"><h3>Fecho diário</h3>${ult ? `<span class="sub">Fechado até ${date(ult.data)}</span>` : '<span class="sub">Sem fechos</span>'}</div>
        <p class="muted" style="margin-top:0">O fecho guarda uma fotografia assinada dos saldos e de todos os movimentos até à data. A partir daí, esse período fica bloqueado: qualquer alteração retroativa é recusada ou detetada.</p>
        ${can('executar') || can('admin') ? `<div class="row"><input class="inp inp-sm" type="date" id="dfe" value="${today()}" max="${today()}"><button class="btn primary" id="fe" ${pr.ok ? '' : 'disabled'}>${icon('lock')} Fechar dia</button></div>${pr.ok ? '' : '<div class="faint" style="font-size:12px;margin-top:6px">Corrija os erros da prova de saldos antes de fechar.</div>'}` : ''}
        <div id="fv" style="margin-top:12px"></div></div></div>
      <div class="card flush" style="margin-top:16px"><div class="card-h"><h3>Fechos realizados</h3><button class="btn sm" id="ver">${icon('shield')} Verificar todos</button></div>
        ${(db.fechos || []).length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Data</th><th class="r">Total de fundos</th><th class="r">Movimentos</th><th>Fechado por</th><th>Selo</th><th>Estado</th></tr></thead><tbody>
        ${(db.fechos || []).slice().reverse().map(f => `<tr><td><b>${date(f.data)}</b></td><td class="r num">${eur(f.total)}</td><td class="r num">${f.nMov}</td><td>${esc(userName(f.user))} · ${dt(f.ts)}</td><td class="hash">${f.hash.slice(0, 20)}…</td><td data-fv="${f.id}"><span class="badge plain">A verificar…</span></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Ainda não foi feito nenhum fecho.</div>'}</div>`;
    const verificar = async () => { const res = await app.verificarFechos();
      res.forEach(r => { const el = v.querySelector(`[data-fv="${r.f.id}"]`); if (el) el.innerHTML = r.ok ? '<span class="badge ok">Íntegro</span>' : `<span class="badge bad">Violado · ${esc(r.motivos.join('; '))}</span>`; });
      const bad = res.filter(r => !r.ok); v.querySelector('#fv').innerHTML = !res.length ? '' : bad.length ? `<div class="alert bad">${icon('alert')}<div><b>${bad.length} fecho(s) violado(s).</b> Os dados de períodos fechados foram alterados fora do sistema.</div></div>` : `<div class="alert ok">${icon('check')}<div>${res.length} fecho(s) verificados — nenhum período fechado foi alterado.</div></div>`; };
    v.querySelector('#ver').onclick = verificar; verificar();
    const fe = v.querySelector('#fe');
    if (fe) fe.onclick = async () => { try { const f = await app.fecharDia(v.querySelector('#dfe').value); if (f) { ui.toast(`<b>Dia ${date(f.data)} fechado.</b> Total ${eur(f.total)}`, 'ok'); render(); } } catch (e) { ui.toast(esc(e.message), 'bad'); } };
  } });

  /* =========================================================
     INTERCOMPANY E GRUPO (Elite Sound ↔ BXB Investimentos)
     Lê o livro do sistema parceiro (mesmo navegador, só leitura),
     mostra os fluxos entre as duas empresas, o que falta reconhecer
     de cada lado e a posição consolidada do grupo.
     ========================================================= */
  if (cfg.intercompany) route('intercompany', { id: 'intercompany', title: 'Intercompany e grupo', render(vv) {
    const lista = typeof cfg.intercompany === 'function' ? cfg.intercompany() : [cfg.intercompany];
    if (!lista.length) { vv.innerHTML = `<div class="empty">Sem empresas do grupo ligadas a este sistema.</div>`; return; }
    const ic = lista.find(x => x.parceiro === sessionStorage.getItem(KEY + ':ic')) || lista[0];
    vv.innerHTML = (lista.length > 1 ? `<div class="tabs" style="margin-bottom:16px">${lista.map(x => `<button data-icp="${esc(x.parceiro)}" class="${x === ic ? 'on' : ''}">${esc(x.nome)}</button>`).join('')}</div>` : '') + '<div id="icv"></div>';
    vv.querySelectorAll('[data-icp]').forEach(bt => bt.onclick = () => { sessionStorage.setItem(KEY + ':ic', bt.dataset.icp); render(); });
    const v = vv.querySelector('#icv');
    let par = null; try { par = JSON.parse(localStorage.getItem('spap:' + ic.parceiro)); } catch (e) { }
    if (!par || !par.pedidos) { v.innerHTML = `<div class="alert info">${icon('swap')}<div>Abra o sistema <b>${esc(ic.nome)}</b> neste navegador pelo menos uma vez para ligar os dois livros. <a href="${ic.href}">Abrir ${esc(ic.nome)}</a></div></div>`; return; }
    const parSaldo = c => r2((+c.saldoInicial || 0) + par.movimentos.reduce((s, m) => m.conta === c.id ? s + m.valor : s, 0));
    const vivo = p => !['REJEITADO', 'CANCELADO'].includes(p.estado);
    const avaliar = (x, ps) => { const exec = r2(ps.filter(p => p.estado === 'EXECUTADO').reduce((s, p) => s + p.valor, 0)); const pedido = r2(ps.reduce((s, p) => s + p.valor, 0));
      return { ...x, ps, exec, falta: r2(x.valor - pedido), estado: exec >= x.valor - 0.004 ? 'RECONCILIADO' : ps.length ? (pedido > x.valor + 0.004 ? 'DIFERENCA' : 'EM_CURSO') : 'POR_RECONHECER' }; };
    const recebidas = ic.recebidas(par).map(x => avaliar(x, db.pedidos.filter(p => p.origem && p.origem.key === x.key && vivo(p))));
    const enviadas = ic.enviadas(db).map(x => avaliar(x, par.pedidos.filter(p => p.origem && p.origem.key === x.key && vivo(p))));
    const meu = r2(db.contas.reduce((s, c) => s + saldo(c.id), 0)), dele = r2(par.contas.reduce((s, c) => s + parSaldo(c), 0));
    const elim = r2([...recebidas, ...enviadas].reduce((s, x) => s + x.exec, 0));
    const transito = r2([...recebidas, ...enviadas].reduce((s, x) => s + Math.max(0, x.valor - x.exec), 0));
    const badge = e => ({ RECONCILIADO: '<span class="badge ok">Reconciliado</span>', EM_CURSO: '<span class="badge info">Em autorização</span>', POR_RECONHECER: '<span class="badge warn">Por reconhecer</span>', DIFERENCA: '<span class="badge bad">Diferença</span>' }[e]);
    const tabela = (list, lado) => list.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Data</th><th>N.º origem</th><th>Descrição</th><th class="r">Valor</th><th class="r">Reconhecido</th><th>Pedido de reconhecimento</th><th>Estado</th><th></th></tr></thead><tbody>
      ${list.map((x, i) => `<tr><td>${date(x.data)}</td><td class="mono">${esc(x.numero)}</td><td style="font-size:12.5px">${esc(x.categoria)}<div class="faint" style="max-width:300px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(x.descricao)}</div></td>
        <td class="r num"><b>${eur(x.valor)}</b></td><td class="r num">${eur(x.exec)}</td><td>${x.ps.map(p => lado === 'rec' ? `<a class="mono" href="#/pedidos/${p.id}">${esc(p.numero)}</a>` : `<span class="mono">${esc(p.numero)}</span>`).join(' ') || '<span class="faint">—</span>'}</td><td>${badge(x.estado)}</td>
        <td class="r">${lado === 'rec' && x.falta > 0.004 && can('criar') ? `<button class="btn sm" data-r="${i}">Reconhecer ${eur(x.falta)}</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Sem movimentos intercompany.</div>';
    // só a holding (cfg.verGrupo) vê saldos de outras empresas e o consolidado; as subsidiárias veem apenas as transferências em que participam
    v.innerHTML = (cfg.verGrupo ? `<div class="grid g4">
      <div class="card kpi"><div class="lbl">Fundos ${esc(cfg.nome)}</div><div class="val num">${eur(meu)}</div></div>
      <div class="card kpi"><div class="lbl">Fundos ${esc(ic.nome)}</div><div class="val num">${eur(dele)}</div><div class="foot">lido do livro da subsidiária</div></div>
      <div class="card kpi"><div class="lbl">Eliminações intercompany</div><div class="val num">−${eur(elim)}</div><div class="foot">${eur(transito)} em trânsito</div></div>
      <div class="card kpi hero"><div class="lbl">${icon('layers')} Total consolidado</div><div class="val num">${eur(meu + dele - elim)}</div><div class="foot">${esc(cfg.nome)} + ${esc(ic.nome)}, sem dupla contagem</div></div></div>`
      : `<div class="grid g3">
      <div class="card kpi hero"><div class="lbl">${icon('download')} Recebido de ${esc(ic.nome)}</div><div class="val num">${eur(recebidas.reduce((s, x) => s + x.valor, 0))}</div><div class="foot">${eur(recebidas.reduce((s, x) => s + x.exec, 0))} já reconhecido</div></div>
      <div class="card kpi"><div class="lbl">${icon('upload')} Enviado para ${esc(ic.nome)}</div><div class="val num">${eur(enviadas.reduce((s, x) => s + x.valor, 0))}</div><div class="foot">${eur(enviadas.reduce((s, x) => s + x.exec, 0))} reconhecido pela holding</div></div>
      <div class="card kpi"><div class="lbl">${icon('clock')} Em trânsito</div><div class="val num">${eur(transito)}</div><div class="foot">por reconhecer de um dos lados</div></div></div>`) + `
      <div class="alert info" style="margin:16px 0">${icon('swap')}<div>Cada transferência entre as empresas é executada no livro de quem envia e <b>reconhecida</b> no livro de quem recebe, com pedido próprio, autorização e assinatura. Os valores reconhecidos dos dois lados são eliminados na consolidação para não serem contados duas vezes.</div></div>
      <div class="card flush"><div class="card-h"><h3>Recebidas de ${esc(ic.nome)}</h3><span class="sub">a reconhecer em ${esc(app.nomeConta(ic.contaDestino))}</span></div>${tabela(recebidas, 'rec')}</div>
      <div class="card flush" style="margin-top:16px"><div class="card-h"><h3>Enviadas para ${esc(ic.nome)}</h3><span class="sub">reconhecimento feito no sistema ${esc(ic.nome)}</span></div>${tabela(enviadas, 'env')}</div>`;
    v.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { const x = recebidas[+b.dataset.r];
      app.novoPedido({ categoria: ENTRADA, contaDestino: ic.contaDestino, valor: x.falta, metodo: 'TRANSFERÊNCIA INTERNA', associado: `${ic.sigla}:${x.numero}`, dataPrevista: today(),
        descricao: `Intercompany · ${ic.nome} · ${x.numero}${x.autorizacao ? ' (aut. ' + x.autorizacao + ')' : ''} · ${x.descricao}`, origem: { mod: 'intercompany', key: x.key } }); });
  } });

  /* =========================================================
     LIMITES POR CONTA
     saldo mínimo de reserva, limite de saída diária e mensal e
     bloqueio. Alterar limites segue a regra das duas pessoas;
     BLOQUEAR uma conta é imediato (é uma medida de proteção).
     ========================================================= */
  const limitesDe = c => (c && c.limites) || {};
  const saidasPeriodo = (cid, prefixo) => r2(-db.movimentos.reduce((s, m) => m.conta === cid && m.valor < 0 && m.data.startsWith(prefixo) ? s + m.valor : s, 0));
  app.saidasPeriodo = saidasPeriodo;
  app.contaBloqueada = cid => !!limitesDe(conta(cid)).bloqueada;
  // devolve a lista de limites que um pagamento de `valor` a partir de `cid` na data `data` violaria
  app.avisosLimites = (cid, valor, data) => {
    const c = conta(cid); if (!c) return [];
    const L = limitesDe(c), out = [], d = data || today();
    if (L.bloqueada) out.push(`Conta ${c.nome} bloqueada${L.motivo ? ' — ' + L.motivo : ''}`);
    if (+L.saldoMinimo > 0 && r2(saldo(cid) - valor) < +L.saldoMinimo) out.push(`${c.nome} ficaria abaixo do saldo mínimo de reserva (${eur(L.saldoMinimo)})`);
    if (+L.saidaDiaria > 0 && saidasPeriodo(cid, d) + valor > +L.saidaDiaria) out.push(`Excede o limite de saída diária de ${c.nome}: ${eur(saidasPeriodo(cid, d))} já saídos de ${eur(L.saidaDiaria)} em ${date(d)}`);
    if (+L.saidaMensal > 0 && saidasPeriodo(cid, d.slice(0, 7)) + valor > +L.saidaMensal) out.push(`Excede o limite de saída mensal de ${c.nome}: ${eur(saidasPeriodo(cid, d.slice(0, 7)))} já saídos de ${eur(L.saidaMensal)} em ${MESES[+d.slice(5, 7) - 1]}`);
    return out;
  };
  app.registarAlteracao('LIMITES_CONTA', { titulo: 'Limites de conta', snapshot: p => JSON.stringify(limitesDe(conta(p.conta))),
    direto: p => { const a = limitesDe(conta(p.conta)); return !!p.limites.bloqueada && !a.bloqueada && ['saldoMinimo', 'saidaDiaria', 'saidaMensal'].every(k => +(a[k] || 0) === +(p.limites[k] || 0)); },
    aplicar: p => { const c = conta(p.conta); if (c) c.limites = p.limites; } });
  app.cartaoLimites = c => {
    const L = limitesDe(c), hoje = today(), mes = hoje.slice(0, 7);
    const sd = saidasPeriodo(c.id, hoje), sm = saidasPeriodo(c.id, mes);
    const barra = (u, l) => { const f = l ? u / l : 0; return l ? `<div class="progress ${f > 1 ? 'bad' : f > .8 ? 'warn' : ''}" style="margin-top:4px"><i style="width:${Math.min(100, f * 100)}%"></i></div>` : ''; };
    return `<div class="card" style="margin-top:16px"><div class="card-h"><h3>Limites e controlo</h3><div class="row">${L.bloqueada ? `<span class="badge bad">${icon('lock')} Bloqueada</span>` : '<span class="badge ok">Ativa</span>'}
      ${can('admin') || can('contas') ? `<button class="btn sm" id="lim-ed">${icon('settings')} Propor limites</button>${L.bloqueada ? '' : `<button class="btn sm bad" id="lim-bl">${icon('lock')} Bloquear</button>`}` : ''}</div></div>
      ${L.bloqueada ? `<div class="alert bad" style="margin-bottom:12px">${icon('lock')}<div><b>Conta bloqueada</b>${L.motivo ? ' — ' + esc(L.motivo) : ''}. Não pode enviar nem receber pagamentos. Desbloquear exige a aprovação de outro aprovador.</div></div>` : ''}
      <div class="grid g3">
        <div><div class="muted" style="font-size:12px">Saldo mínimo de reserva</div><b class="num">${+L.saldoMinimo > 0 ? eur(L.saldoMinimo) : '—'}</b>${+L.saldoMinimo > 0 ? `<div class="faint" style="font-size:12px">Margem ${eur(saldo(c.id) - L.saldoMinimo)}</div>` : ''}</div>
        <div><div class="muted" style="font-size:12px">Saídas hoje</div><b class="num">${eur(sd)}${+L.saidaDiaria > 0 ? ` <span class="faint">/ ${eur(L.saidaDiaria)}</span>` : ''}</b>${barra(sd, +L.saidaDiaria)}</div>
        <div><div class="muted" style="font-size:12px">Saídas em ${MESES[+mes.slice(5) - 1]}</div><b class="num">${eur(sm)}${+L.saidaMensal > 0 ? ` <span class="faint">/ ${eur(L.saidaMensal)}</span>` : ''}</b>${barra(sm, +L.saidaMensal)}</div></div></div>`;
  };
  app.bindLimites = (v, c) => {
    const L = limitesDe(c);
    const propor = (bloquear) => ui.modal({ title: (bloquear ? 'Bloquear ' : 'Limites · ') + c.nome, sub: bloquear ? 'O bloqueio é aplicado de imediato. O desbloqueio exigirá a aprovação de outro aprovador.' : 'A alteração segue a regra das duas pessoas.',
      body: `<form class="form">${bloquear ? '' : `
        <div class="fld"><label>Saldo mínimo de reserva (€)</label><input class="inp num" type="number" step="0.01" min="0" name="saldoMinimo" value="${L.saldoMinimo || ''}" placeholder="sem mínimo"></div>
        <div class="fld"><label>Limite de saída diária (€)</label><input class="inp num" type="number" step="0.01" min="0" name="saidaDiaria" value="${L.saidaDiaria || ''}" placeholder="sem limite"></div>
        <div class="fld"><label>Limite de saída mensal (€)</label><input class="inp num" type="number" step="0.01" min="0" name="saidaMensal" value="${L.saidaMensal || ''}" placeholder="sem limite"></div>
        <div class="fld"><label>&nbsp;</label><label class="check"><input type="checkbox" name="bloqueada" ${L.bloqueada ? 'checked' : ''}> Conta bloqueada</label></div>`}
        <div class="fld full"><label>Motivo</label><input class="inp" name="motivo" value="${esc(bloquear ? '' : L.motivo || '')}" placeholder="${bloquear ? 'Obrigatório' : 'Opcional'}"></div></form>`,
      actions: [{ label: 'Cancelar', kind: 'ghost' }, { label: bloquear ? icon('lock') + 'Bloquear conta' : 'Propor alteração', kind: bloquear ? 'bad' : 'primary', onClick: async el => {
        const f = ui.formData(el);
        if (bloquear && !f.motivo) { ui.toast('Indique o motivo do bloqueio', 'warn'); return false; }
        const nl = bloquear ? { ...L, bloqueada: true, motivo: f.motivo } : { saldoMinimo: r2(f.saldoMinimo) || 0, saidaDiaria: r2(f.saidaDiaria) || 0, saidaMensal: r2(f.saidaMensal) || 0, bloqueada: !!f.bloqueada, motivo: f.motivo };
        const fmt = (k, x) => k === 'bloqueada' ? (x ? 'Bloqueada' : 'Ativa') : k === 'motivo' ? (x || '—') : (+x > 0 ? eur(x) : '—');
        const nomes = { saldoMinimo: 'Saldo mínimo', saidaDiaria: 'Saída diária', saidaMensal: 'Saída mensal', bloqueada: 'Estado', motivo: 'Motivo' };
        const det = Object.keys(nomes).filter(k => fmt(k, L[k]) !== fmt(k, nl[k])).map(k => [nomes[k], fmt(k, L[k]), fmt(k, nl[k])]);
        if (!det.length) { ui.toast('Sem alterações', 'warn'); return false; }
        if (!await app.proporAlteracao('LIMITES_CONTA', { conta: c.id, limites: nl }, c.nome, det)) return false;
        render();
      } }] });
    const ed = v.querySelector('#lim-ed'); if (ed) ed.onclick = () => propor(false);
    const bl = v.querySelector('#lim-bl'); if (bl) bl.onclick = () => propor(true);
  };

  /* =========================================================
     PEDIDOS RECORRENTES
     Modelos (mensalidades, rendas, comissões fixas…) que geram os
     pedidos com a antecedência definida. Cada pedido gerado é
     assinado pelo requerente e segue o circuito normal.
     ========================================================= */
  const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const FREQ = { SEMANAL: { label: 'Semanal', add: d => addDays(d, 7) }, MENSAL: { label: 'Mensal', add: d => addMonths(d, 1) }, TRIMESTRAL: { label: 'Trimestral', add: d => addMonths(d, 3) }, ANUAL: { label: 'Anual', add: d => addMonths(d, 12) } };
  app.ocorrencias = (r, ate) => { const out = []; let d = r.proxima, k = 0; while (d && d <= ate && (!r.fim || d <= r.fim) && k < 300) { out.push(d); d = FREQ[r.frequencia].add(d); k++; } return out; };
  const recKey = (r, d) => `rec:${r.id}:${d}`;
  app.recorrentesDevidos = () => (db.recorrentes || []).filter(r => r.ativo !== false)
    .flatMap(r => app.ocorrencias(r, addDays(today(), +r.antecedencia || 0)).map(d => ({ r, d }))).filter(x => !app.pedidosPorOrigem(recKey(x.r, x.d)).length);
  app.gerarRecorrentes = async lista => {
    const dados = lista.map(({ r, d }) => ({ categoria: r.categoria, contaOrigem: r.categoria === ENTRADA ? null : r.contaOrigem, contaDestino: r.contaDestino, requerente: r.contaOrigem || r.contaDestino,
      valor: r.valor, metodo: r.metodo, dataPrevista: d, associado: r.ref, descricao: `${r.descricao} · ${FREQ[r.frequencia].label.toLowerCase()} · ${date(d)}`, origem: { mod: 'recorrente', key: recKey(r, d) } }));
    const criados = await app.criarAssinado(dados, 'Assinar pedidos recorrentes', `${dados.length} pedido(s) · total <b>${eur(dados.reduce((s, x) => s + x.valor, 0))}</b>`);
    if (!criados) return null;
    lista.forEach(({ r, d }) => { const nx = FREQ[r.frequencia].add(d); if (nx > r.proxima) r.proxima = nx; });
    log('RECORRENTES_GERADOS', `${criados.length} pedido(s)`); save(); return criados;
  };
  route('recorrentes', { id: 'recorrentes', title: 'Pedidos recorrentes', render(v) {
    const devidos = app.recorrentesDevidos();
    const lista = db.recorrentes || [];
    v.innerHTML = `${devidos.length ? `<div class="alert warn" style="margin-bottom:16px">${icon('clock')}<div style="flex:1"><b>${devidos.length} pedido(s) recorrente(s) por gerar</b> · ${eur(devidos.reduce((s, x) => s + x.r.valor, 0))}
        <div class="faint" style="font-size:12px">${devidos.slice(0, 6).map(x => `${esc(x.r.descricao)} — ${date(x.d)}`).join(' · ')}${devidos.length > 6 ? ' …' : ''}</div></div>${can('criar') ? `<button class="btn primary sm" id="ger">${icon('pen')} Gerar e assinar</button>` : ''}</div>` : ''}
      <div class="card flush"><div class="card-h"><h3>Modelos recorrentes</h3>${can('criar') ? `<button class="btn sm" id="nr">${icon('plus')} Novo modelo</button>` : ''}</div>
      ${lista.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Ref.</th><th>Descrição</th><th>Origem → destino</th><th>Frequência</th><th class="r">Valor</th><th>Próxima</th><th>Fim</th><th>Estado</th><th></th></tr></thead><tbody>
        ${lista.map(r => `<tr><td class="mono">${esc(r.ref)}</td><td><b>${esc(r.descricao)}</b><div class="faint" style="font-size:12px">${esc(r.categoria)} · ${r.antecedencia || 0} dias de antecedência</div></td>
          <td style="font-size:12.5px">${esc(r.contaOrigem ? nomeConta(r.contaOrigem) : 'Entrada')} → ${esc(nomeConta(r.contaDestino))}</td><td>${FREQ[r.frequencia].label}</td><td class="r num"><b>${eur(r.valor)}</b></td>
          <td>${r.fim && r.proxima > r.fim ? '—' : date(r.proxima)}</td><td>${r.fim ? date(r.fim) : '<span class="faint">sem fim</span>'}</td>
          <td>${r.ativo === false ? '<span class="badge">Suspenso</span>' : r.fim && r.proxima > r.fim ? '<span class="badge plain">Concluído</span>' : '<span class="badge ok">Ativo</span>'}</td>
          <td class="r">${can('criar') ? `<button class="btn sm" data-ed="${r.id}">${icon('edit')}</button> <button class="btn sm ghost" data-tg="${r.id}">${r.ativo === false ? 'Retomar' : 'Suspender'}</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`
        : `<div class="empty">${icon('clock')}<p>Sem modelos recorrentes. Crie um para mensalidades, rendas, avenças ou prestações fixas.</p></div>`}</div>`;
    const editar = r0 => { const novo = !r0; const r = r0 || { frequencia: 'MENSAL', antecedencia: 7, proxima: addMonths(today(), 1).slice(0, 8) + '01', metodo: db.metodos[0], categoria: db.categorias[0] };
      const opt = sel => app.contasInternas().map(c => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.nome)}</option>`).join('');
      ui.modal({ title: novo ? 'Novo pedido recorrente' : 'Editar ' + r.ref, wide: true, body: `<form class="form">
        <div class="fld full"><label>Descrição</label><input class="inp" name="descricao" value="${esc(r.descricao || '')}" placeholder="ex.: Mensalidade do crédito Santander BK"></div>
        <div class="fld"><label>Categoria</label><select class="inp" name="categoria">${db.categorias.map(c => `<option ${c === r.categoria ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
        <div class="fld"><label>Método</label><select class="inp" name="metodo">${db.metodos.map(c => `<option ${c === r.metodo ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
        <div class="fld"><label>Conta ordenante</label><select class="inp" name="contaOrigem"><option value="">— (entrada de fundos)</option>${opt(r.contaOrigem)}</select></div>
        <div class="fld"><label>Conta de destino</label><select class="inp" name="contaDestino"><option value="">—</option>${opt(r.contaDestino)}</select></div>
        <div class="fld"><label>Valor (€)</label><input class="inp num" type="number" step="0.01" min="0" name="valor" value="${r.valor || ''}"></div>
        <div class="fld"><label>Frequência</label><select class="inp" name="frequencia">${Object.entries(FREQ).map(([k, x]) => `<option value="${k}" ${k === r.frequencia ? 'selected' : ''}>${x.label}</option>`).join('')}</select></div>
        <div class="fld"><label>Próxima data</label><input class="inp" type="date" name="proxima" value="${r.proxima}"></div>
        <div class="fld"><label>Data de fim (opcional)</label><input class="inp" type="date" name="fim" value="${r.fim || ''}"></div>
        <div class="fld"><label>Gerar com antecedência de (dias)</label><input class="inp num" type="number" min="0" max="90" name="antecedencia" value="${r.antecedencia}"></div></form>`,
        actions: [{ label: 'Cancelar', kind: 'ghost' }, { label: icon('pen') + 'Assinar e guardar', kind: 'primary', onClick: async el => {
          const f = ui.formData(el);
          if (!f.descricao || !(+f.valor > 0) || !f.contaDestino || !f.proxima) { ui.toast('Preencha descrição, valor, destino e próxima data', 'warn'); return false; }
          if (f.categoria !== ENTRADA && !f.contaOrigem) { ui.toast('Indique a conta ordenante', 'warn'); return false; }
          if (f.contaOrigem === f.contaDestino) { ui.toast('Origem e destino não podem ser iguais', 'warn'); return false; }
          const s = await app.assinar(novo ? 'Criar pedido recorrente' : 'Alterar pedido recorrente', `${esc(f.descricao)} · <b>${eur(f.valor)}</b> · ${FREQ[f.frequencia].label}`); if (!s) return false;
          const dados = { descricao: f.descricao, categoria: f.categoria, metodo: f.metodo, contaOrigem: f.contaOrigem || null, contaDestino: f.contaDestino, valor: r2(f.valor), frequencia: f.frequencia, proxima: f.proxima, fim: f.fim || null, antecedencia: +f.antecedencia || 0 };
          if (novo) { db.meta.seqRec = (db.meta.seqRec || 0) + 1; const nr = { id: uid(), ref: 'REC-' + String(db.meta.seqRec).padStart(3, '0'), ativo: true, criadoPor: app.user.id, criadoEm: new Date().toISOString(), ...dados };
            nr.assinatura = await s.signer.texto('RECORRENTE', JSON.stringify(dados)); (db.recorrentes = db.recorrentes || []).push(nr); log('RECORRENTE_CRIADO', `${nr.ref} · ${nr.descricao} · ${eur(nr.valor)} ${nr.frequencia}`); }
          else { Object.assign(r, dados); r.assinatura = await s.signer.texto('RECORRENTE', JSON.stringify(dados)); log('RECORRENTE_ALTERADO', `${r.ref} · ${eur(r.valor)} ${r.frequencia}`); }
          save(); render(); } }] }); };
    const nr = v.querySelector('#nr'); if (nr) nr.onclick = () => editar();
    v.querySelectorAll('[data-ed]').forEach(b => b.onclick = () => editar(lista.find(r => r.id === b.dataset.ed)));
    v.querySelectorAll('[data-tg]').forEach(b => b.onclick = () => { const r = lista.find(x => x.id === b.dataset.tg); r.ativo = r.ativo === false; log(r.ativo ? 'RECORRENTE_RETOMADO' : 'RECORRENTE_SUSPENSO', r.ref); save(); render(); });
    const g = v.querySelector('#ger'); if (g) g.onclick = async () => { try { const c = await app.gerarRecorrentes(devidos); if (c) { ui.toast(`${c.length} pedido(s) gerado(s) e assinado(s)`, 'ok'); render(); } } catch (e) { ui.toast(esc(e.message), 'bad'); } };
  } });

  /* =========================================================
     PREVISÃO DE LIQUIDEZ — 13 SEMANAS
     Saldo atual + pedidos aprovados + (opcional) pedidos em
     aprovação + recorrentes futuros + planos do módulo (PIA).
     ========================================================= */
  const inicioSemana = iso => { const d = new Date(iso + 'T12:00:00'); return addDays(iso, -((d.getDay() + 6) % 7)); };
  app.previsao = ({ semanas = 13, pendentes = true } = {}) => {
    const ini = inicioSemana(today()), fim = addDays(ini, semanas * 7 - 1), ev = [];
    const push = (contaId, data, valor, tipo, descricao) => { if (!contaId || !conta(contaId)) return; ev.push({ conta: contaId, data: data < ini ? ini : data, valor: r2(valor), tipo, descricao }); };
    db.pedidos.forEach(p => {
      const ok = p.estado === 'APROVADO' || (pendentes && ['PENDENTE', 'EM_APROVACAO'].includes(p.estado)); if (!ok || p.dataPrevista > fim) return;
      const tipo = p.estado === 'APROVADO' ? 'Aprovado' : 'Em aprovação', d = `${p.numero} · ${p.categoria}`;
      if (p.contaOrigem) push(p.contaOrigem, p.dataPrevista, -p.valor, tipo, d);
      if (p.contaDestino) push(p.contaDestino, p.dataPrevista, p.valor, tipo, d);
    });
    (db.recorrentes || []).filter(r => r.ativo !== false).forEach(r => app.ocorrencias(r, fim).forEach(d => {
      if (app.pedidosPorOrigem(recKey(r, d)).length) return;
      if (r.contaOrigem && r.categoria !== ENTRADA) push(r.contaOrigem, d, -r.valor, 'Recorrente', `${r.ref} · ${r.descricao}`);
      push(r.contaDestino, d, r.valor, 'Recorrente', `${r.ref} · ${r.descricao}`);
    }));
    if (cfg.previsao) cfg.previsao(app, ini, fim).forEach(e => push(e.conta, e.data, e.valor, e.tipo || 'Planeado', e.descricao));
    const semanasArr = Array.from({ length: semanas }, (_, i) => ({ ini: addDays(ini, i * 7), fim: addDays(ini, i * 7 + 6) }));
    return { ini, fim, eventos: ev.sort((a, b) => a.data.localeCompare(b.data)), semanas: semanasArr };
  };
  // projeção para uma conta (ou todas, se cid vazio)
  app.projetar = (prev, cid) => {
    const filtro = e => !cid || e.conta === cid;
    let s = r2(cid ? saldo(cid) : db.contas.reduce((a, c) => a + saldo(c.id), 0));
    return prev.semanas.map(w => { const es = prev.eventos.filter(e => filtro(e) && e.data >= w.ini && e.data <= w.fim);
      const ent = r2(es.filter(e => e.valor > 0).reduce((a, e) => a + e.valor, 0)), sai = r2(es.filter(e => e.valor < 0).reduce((a, e) => a + e.valor, 0));
      const ini = s; s = r2(s + ent + sai); return { ...w, inicial: ini, ent, sai, final: s, eventos: es }; });
  };
  app.alertasLiquidez = () => {
    const prev = app.previsao(); const out = [];
    app.contasInternas().forEach(c => { const min = +limitesDe(c).saldoMinimo || 0;
      const w = app.projetar(prev, c.id).find(x => x.final < min - 0.004);
      if (w) out.push({ conta: c, semana: w, min }); });
    return out;
  };
  route('liquidez', { id: 'liquidez', title: 'Previsão de liquidez · 13 semanas', render(v) {
    let cid = sessionStorage.getItem(KEY + ':liq') || '', pend = sessionStorage.getItem(KEY + ':liqp') !== '0';
    if (cid && !conta(cid)) cid = '';
    const prev = app.previsao({ pendentes: pend }), proj = app.projetar(prev, cid);
    const c = cid ? conta(cid) : null, min = c ? +limitesDe(c).saldoMinimo || 0 : 0;
    const menor = proj.reduce((a, w) => w.final < a.final ? w : a, proj[0]);
    const alertas = app.alertasLiquidez();
    v.innerHTML = `<div class="row between" style="margin-bottom:16px"><div class="row"><select class="inp inp-sm" id="lc"><option value="">Todas as contas (consolidado)</option>${app.contasInternas().map(x => `<option value="${x.id}" ${x.id === cid ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}</select>
      <label class="check"><input type="checkbox" id="lp" ${pend ? 'checked' : ''}> Incluir pedidos ainda em aprovação</label></div><span class="muted" style="font-size:12px">${date(prev.ini)} a ${date(prev.fim)}</span></div>
      ${alertas.length ? `<div class="alert bad" style="margin-bottom:16px">${icon('alert')}<div>${alertas.slice(0, 5).map(a => `<b>${esc(a.conta.nome)}</b> fica ${a.min ? 'abaixo do mínimo de ' + eur(a.min) : 'negativa'} na semana de ${date(a.semana.ini)} (${eur(a.semana.final)})`).join('<br>')}</div></div>` : ''}
      ${!cid ? `<div class="alert info" style="margin-bottom:16px">${icon('swap')}<div>Na vista consolidada as transferências entre contas internas anulam-se: só contam entradas de fundos e saídas para fora do livro. Escolha uma conta para ver a sua liquidez própria.</div></div>` : ''}
      <div class="grid g4">
        <div class="card kpi hero"><div class="lbl">Saldo atual</div><div class="val num">${eur(proj[0] ? proj[0].inicial : 0)}</div><div class="foot">${c ? esc(c.nome) : 'todas as contas'}</div></div>
        <div class="card kpi"><div class="lbl">Entradas previstas</div><div class="val num pos">+${eur(proj.reduce((a, w) => a + w.ent, 0))}</div></div>
        <div class="card kpi"><div class="lbl">Saídas previstas</div><div class="val num neg">${eur(proj.reduce((a, w) => a + w.sai, 0))}</div></div>
        <div class="card kpi"><div class="lbl">Saldo mais baixo</div><div class="val num ${menor && menor.final < min ? 'neg' : ''}">${eur(menor ? menor.final : 0)}</div><div class="foot">semana de ${menor ? date(menor.ini) : '—'}${min ? ' · mínimo ' + eur(min) : ''}</div></div></div>
      <div class="card" style="margin-top:16px"><div class="card-h"><h3>Saldo projetado no fim de cada semana</h3></div><div id="ch"></div></div>
      <div class="card flush" style="margin-top:16px"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Semana</th><th class="r">Saldo inicial</th><th class="r">Entradas</th><th class="r">Saídas</th><th class="r">Saldo final</th><th>Movimentos previstos</th></tr></thead><tbody>
      ${proj.map(w => `<tr><td><b>${date(w.ini)}</b> <span class="faint">a ${date(w.fim)}</span></td><td class="r num">${eur(w.inicial)}</td><td class="r num pos">${w.ent ? '+' + eur(w.ent) : '–'}</td><td class="r num neg">${w.sai ? eur(w.sai) : '–'}</td>
        <td class="r num" style="font-weight:700">${w.final < min - 0.004 ? `<span class="neg">${eur(w.final)}</span>` : eur(w.final)}</td>
        <td style="font-size:12px">${w.eventos.slice(0, 3).map(e => `<div><span class="badge plain" style="font-size:10.5px">${esc(e.tipo)}</span> ${esc(e.descricao)} <b class="${e.valor < 0 ? 'neg' : 'pos'}">${eur(e.valor)}</b>${cid ? '' : ' <span class="faint">' + esc(nomeConta(e.conta)) + '</span>'}</div>`).join('')}${w.eventos.length > 3 ? `<div class="faint">+ ${w.eventos.length - 3} outros</div>` : ''}</td></tr>`).join('')}</tbody></table></div></div>`;
    SPAP.chart.bars(v.querySelector('#ch'), { labels: proj.map(w => w.ini.slice(8, 10) + '/' + w.ini.slice(5, 7)), height: 220,
      series: [{ name: 'Saldo projetado', values: proj.map(w => w.final), color: 'var(--accent)' }, { name: 'Fluxo líquido da semana', values: proj.map(w => r2(w.ent + w.sai)), color: 'var(--info)' }] });
    v.querySelector('#lc').onchange = e => { sessionStorage.setItem(KEY + ':liq', e.target.value); render(); };
    v.querySelector('#lp').onchange = e => { sessionStorage.setItem(KEY + ':liqp', e.target.checked ? '1' : '0'); render(); };
  } });

  /* =========================================================
     DELEGAÇÃO TEMPORÁRIA DE ALÇADAS
     Um aprovador delega (por período limitado, até 60 dias) a sua
     alçada noutro utilizador — p.ex. durante férias. A delegação é
     assinada pelo delegante, fica visível a todos e pode ser
     revogada pelo delegante ou por um administrador. As aprovações
     feitas ao abrigo da delegação ficam identificadas.
     ========================================================= */
  const alcadaPropria = u => can('aprovar', u) ? (u.role === 'ADMIN' ? Infinity : (+u.limite || 0)) : null;
  app.delegacoesAtivas = (d = today()) => (db.delegacoes || []).filter(x => x.estado === 'ATIVA' && x.inicio <= d && x.fim >= d);
  app.alcadaEfetiva = (u, d = today()) => {
    const propria = alcadaPropria(u);
    let delegada = { limite: 0, de: null };
    app.delegacoesAtivas(d).filter(x => x.para === u.id).forEach(x => {
      const de = userById(x.de); if (!de || de.ativo === false || alcadaPropria(de) === null) return;
      const lim = Math.min(+x.limite || 0, alcadaPropria(de));
      if (lim > delegada.limite) delegada = { limite: lim, de: de.id };
    });
    return { pode: propria !== null || !!delegada.de, limite: Math.max(propria || 0, delegada.limite), propria, delegada };
  };
  // devolve o id do delegante se a aprovação de `valor` só for possível ao abrigo de uma delegação
  app.delegacaoUsada = (u, valor) => { const ef = app.alcadaEfetiva(u); return ef.propria !== null && valor <= ef.propria ? null : ef.delegada.de; };
  const estadoDeleg = x => x.estado === 'REVOGADA' ? 'REVOGADA' : x.fim < today() ? 'EXPIRADA' : x.inicio > today() ? 'AGENDADA' : 'ATIVA';
  route('delegacoes', { id: 'delegacoes', title: 'Delegação de alçadas', render(v) {
    const lista = (db.delegacoes || []).slice().reverse();
    const minha = app.alcadaEfetiva(app.user);
    const badge = e => ({ ATIVA: '<span class="badge ok">Ativa</span>', AGENDADA: '<span class="badge info">Agendada</span>', EXPIRADA: '<span class="badge">Expirada</span>', REVOGADA: '<span class="badge bad">Revogada</span>' }[e]);
    v.innerHTML = `<div class="alert info" style="margin-bottom:16px">${icon('users')}<div>Um aprovador pode delegar a sua alçada noutro utilizador por um período limitado (máx. 60 dias), por exemplo durante férias.
      A alçada delegada nunca excede a do delegante. As aprovações feitas por delegação ficam identificadas no pedido e no requerimento.
      ${minha.delegada.de ? `<br><b>Tem neste momento uma delegação de ${esc(userName(minha.delegada.de))} até ${eur(minha.delegada.limite)}.</b>` : ''}</div></div>
      <div class="card flush"><div class="card-h"><h3>Delegações</h3>${alcadaPropria(app.user) !== null ? `<button class="btn sm" id="nd">${icon('plus')} Delegar a minha alçada</button>` : ''}</div>
      ${lista.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Delegante</th><th>Delegado</th><th>Período</th><th class="r">Alçada delegada</th><th>Motivo</th><th>Estado</th><th></th></tr></thead><tbody>
        ${lista.map(x => `<tr><td><b>${esc(userName(x.de))}</b></td><td>${esc(userName(x.para))}</td><td>${date(x.inicio)} → ${date(x.fim)}</td><td class="r num">${x.limite === Infinity || x.limite == null ? 'Igual à do delegante' : eur(x.limite)}</td>
          <td style="font-size:12.5px">${esc(x.motivo || '')}</td><td>${badge(estadoDeleg(x))}</td>
          <td class="r">${['ATIVA', 'AGENDADA'].includes(estadoDeleg(x)) && (x.de === app.user.id || can('admin')) ? `<button class="btn sm bad" data-rv="${x.id}">Revogar</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Sem delegações.</div>'}</div>`;
    const nd = v.querySelector('#nd');
    if (nd) nd.onclick = () => { const prop = alcadaPropria(app.user);
      ui.modal({ title: 'Delegar a minha alçada', sub: `A sua alçada: ${prop === Infinity ? 'ilimitada' : eur(prop)}`, body: `<form class="form">
        <div class="fld full"><label>Delegar em</label><select class="inp" name="para">${db.users.filter(u => u.ativo !== false && u.id !== app.user.id).map(u => `<option value="${u.id}">${esc(u.nome)} · ${ROLES[u.role].label}</option>`).join('')}</select></div>
        <div class="fld"><label>Início</label><input class="inp" type="date" name="inicio" value="${today()}"></div>
        <div class="fld"><label>Fim</label><input class="inp" type="date" name="fim" value="${addDays(today(), 14)}"></div>
        <div class="fld"><label>Alçada delegada (€)</label><input class="inp num" type="number" step="0.01" min="0" name="limite" placeholder="${prop === Infinity ? 'ex.: 10000' : 'até ' + eur(prop)}"></div>
        <div class="fld"><label>Motivo</label><input class="inp" name="motivo" placeholder="ex.: Férias"></div></form>`,
        actions: [{ label: 'Cancelar', kind: 'ghost' }, { label: icon('pen') + 'Assinar delegação', kind: 'primary', onClick: async el => {
          const f = ui.formData(el), lim = r2(f.limite);
          if (!f.para || !f.inicio || !f.fim || f.fim < f.inicio) { ui.toast('Indique o delegado e um período válido', 'warn'); return false; }
          if ((new Date(f.fim) - new Date(f.inicio)) / 864e5 > 60) { ui.toast('A delegação não pode exceder 60 dias', 'warn'); return false; }
          if (!(lim > 0)) { ui.toast('Indique a alçada a delegar', 'warn'); return false; }
          if (lim > prop) { ui.toast(`Não pode delegar mais do que a sua alçada (${eur(prop)})`, 'bad'); return false; }
          if (!f.motivo) { ui.toast('Indique o motivo', 'warn'); return false; }
          const s = await app.assinar('Assinar delegação', `${esc(userName(f.para))} poderá aprovar até <b>${eur(lim)}</b> de ${date(f.inicio)} a ${date(f.fim)}`); if (!s) return false;
          const x = { id: uid(), de: app.user.id, para: f.para, inicio: f.inicio, fim: f.fim, limite: lim, motivo: f.motivo, estado: 'ATIVA', criadoEm: new Date().toISOString() };
          x.assinatura = await s.signer.texto('DELEGACAO', JSON.stringify([x.id, x.de, x.para, x.inicio, x.fim, x.limite, x.motivo]));
          (db.delegacoes = db.delegacoes || []).push(x); log('DELEGACAO_CRIADA', `${userName(x.de)} → ${userName(x.para)} · ${eur(lim)} · ${x.inicio} a ${x.fim} · ${x.motivo}`); save(); render(); } }] }); };
    v.querySelectorAll('[data-rv]').forEach(b => b.onclick = async () => { const x = (db.delegacoes || []).find(d => d.id === b.dataset.rv);
      const s = await app.assinar('Revogar delegação', `${esc(userName(x.de))} → ${esc(userName(x.para))}`); if (!s) return;
      x.estado = 'REVOGADA'; x.revogadaEm = new Date().toISOString(); x.revogadaPor = app.user.id; log('DELEGACAO_REVOGADA', `${userName(x.de)} → ${userName(x.para)}`); save(); render(); });
  } });

  /* =========================================================
     CENTROS DE CUSTO E RELATÓRIOS (orçamento anual vs real)
     ========================================================= */
  const ccDe = id => (db.centrosCusto || []).find(c => c.id === id);
  app.ccDe = ccDe;
  app.ccNome = id => { const c = ccDe(id); return c ? `${c.codigo} · ${c.nome}` : 'Sem centro de custo'; };
  const ehSaida = p => p.categoria !== ENTRADA && !!p.contaOrigem;
  app.ccExecutado = (id, ano, mes) => r2(db.pedidos.filter(p => p.estado === 'EXECUTADO' && (p.centroCusto || '') === (id || '') && ehSaida(p) && (p.dataExecucao || '').startsWith(mes ? `${ano}-${mes}` : ano)).reduce((s, p) => s + p.valor, 0));
  app.ccComprometido = (id, ano, excl) => r2(db.pedidos.filter(p => ['PENDENTE', 'EM_APROVACAO', 'APROVADO'].includes(p.estado) && (p.centroCusto || '') === (id || '') && ehSaida(p) && (p.dataPrevista || '').startsWith(ano) && p.id !== excl).reduce((s, p) => s + p.valor, 0));
  app.registarAlteracao('CENTROS_CUSTO', { titulo: 'Centros de custo', snapshot: () => JSON.stringify(db.centrosCusto || []), aplicar: p => { db.centrosCusto = p.centros; } });
  route('relatorios', { id: 'relatorios', title: 'Centros de custo e relatórios', render(v) {
    let tab = sessionStorage.getItem(KEY + ':rel') || 'orc';
    const anos = [...new Set([today().slice(0, 4), ...db.pedidos.map(p => (p.dataExecucao || p.dataPrevista || '').slice(0, 4)).filter(Boolean)])].sort();
    let ano = sessionStorage.getItem(KEY + ':relano'); if (!anos.includes(ano)) ano = today().slice(0, 4);
    const ccs = db.centrosCusto || [];
    v.innerHTML = `<div class="row between" style="margin-bottom:16px"><div class="tabs">${[['orc', 'Orçamento vs real'], ['mes', 'Execução mensal'], ['cat', 'Por categoria'], ['cc', 'Centros de custo']].map(([k, l]) => `<button data-t="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="row">${tab !== 'cc' ? `<select class="inp inp-sm" id="ano">${anos.map(y => `<option ${y === ano ? 'selected' : ''}>${y}</option>`).join('')}</select><button class="btn sm" id="csv">${icon('download')} CSV</button>` : ''}</div></div><div id="c"></div>`;
    v.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { sessionStorage.setItem(KEY + ':rel', b.dataset.t); render(); });
    const sa = v.querySelector('#ano'); if (sa) sa.onchange = () => { sessionStorage.setItem(KEY + ':relano', sa.value); render(); };
    const c = v.querySelector('#c');
    const linhas = [...ccs.map(cc => ({ id: cc.id, nome: `${cc.codigo} · ${cc.nome}`, resp: cc.responsavel ? userName(cc.responsavel) : '—', orc: +cc.orcamentoAnual || 0, ativo: cc.ativo !== false })), { id: '', nome: 'Sem centro de custo', resp: '—', orc: 0, ativo: true }]
      .map(l => ({ ...l, exec: app.ccExecutado(l.id, ano), comp: app.ccComprometido(l.id, ano) })).filter(l => l.id || l.exec || l.comp);
    let csvRows = [];
    if (tab === 'orc') {
      const tot = k => r2(linhas.reduce((s, l) => s + l[k], 0));
      c.innerHTML = `${!ccs.length ? `<div class="alert info" style="margin-bottom:16px">${icon('target')}<div>Ainda não existem centros de custo. Crie-os no separador <a href="#/relatorios" data-aba="rel=cc">Centros de custo</a> e associe-os aos pedidos.</div></div>` : ''}
        <div class="grid g4" style="margin-bottom:16px"><div class="card kpi hero"><div class="lbl">Orçamento anual ${ano}</div><div class="val num">${eur(tot('orc'))}</div></div>
          <div class="card kpi"><div class="lbl">Executado</div><div class="val num">${eur(tot('exec'))}</div><div class="foot">${tot('orc') ? pct(tot('exec') / tot('orc')) + ' do orçamento' : ''}</div></div>
          <div class="card kpi"><div class="lbl">Comprometido</div><div class="val num">${eur(tot('comp'))}</div><div class="foot">pedidos em curso</div></div>
          <div class="card kpi"><div class="lbl">Disponível</div><div class="val num">${eur(tot('orc') - tot('exec') - tot('comp'))}</div></div></div>
        <div class="card" style="margin-bottom:16px"><div class="card-h"><h3>Orçamento, executado e comprometido</h3></div><div id="ch"></div></div>
        <div class="card flush"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Centro de custo</th><th>Responsável</th><th class="r">Orçamento</th><th class="r">Executado</th><th class="r">Comprometido</th><th class="r">Disponível</th><th style="width:22%">Execução</th></tr></thead><tbody>
        ${linhas.map(l => { const f = l.orc ? (l.exec + l.comp) / l.orc : 0; return `<tr><td><b>${esc(l.nome)}</b>${l.ativo ? '' : ' <span class="badge">Inativo</span>'}</td><td>${esc(l.resp)}</td><td class="r num">${l.orc ? eur(l.orc) : '—'}</td><td class="r num">${eur(l.exec)}</td><td class="r num">${eur(l.comp)}</td>
          <td class="r num ${l.orc && l.orc - l.exec - l.comp < 0 ? 'neg' : ''}">${l.orc ? eur(l.orc - l.exec - l.comp) : '—'}</td><td>${l.orc ? `<div class="progress ${f > 1 ? 'bad' : f > .85 ? 'warn' : ''}"><i style="width:${Math.min(100, f * 100)}%"></i></div><span class="faint" style="font-size:11.5px">${pct(f)}</span>` : '<span class="faint">sem orçamento</span>'}</td></tr>`; }).join('') || '<tr><td colspan="7" class="empty">Sem dados.</td></tr>'}</tbody>
        <tfoot><tr><td colspan="2">TOTAL</td><td class="r num">${eur(tot('orc'))}</td><td class="r num">${eur(tot('exec'))}</td><td class="r num">${eur(tot('comp'))}</td><td class="r num">${eur(tot('orc') - tot('exec') - tot('comp'))}</td><td></td></tr></tfoot></table></div></div>`;
      if (linhas.length) SPAP.chart.bars(c.querySelector('#ch'), { labels: linhas.map(l => l.nome.split(' · ')[0].slice(0, 10)), height: 220,
        series: [{ name: 'Orçamento', values: linhas.map(l => l.orc), color: 'var(--faint)' }, { name: 'Executado', values: linhas.map(l => l.exec), color: 'var(--accent)' }, { name: 'Comprometido', values: linhas.map(l => l.comp), color: 'var(--warn)' }] });
      csvRows = [['Centro de custo', 'Responsável', 'Orçamento', 'Executado', 'Comprometido', 'Disponível'], ...linhas.map(l => [l.nome, l.resp, l.orc, l.exec, l.comp, r2(l.orc - l.exec - l.comp)])];
    }
    if (tab === 'mes') {
      const mm = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
      const dados = linhas.map(l => ({ ...l, meses: mm.map(m => app.ccExecutado(l.id, ano, m)) }));
      c.innerHTML = `<div class="card" style="margin-bottom:16px"><div class="card-h"><h3>Execução mensal por centro de custo · ${ano}</h3></div><div id="ch"></div></div>
        <div class="card flush"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Centro de custo</th>${MES3.map(m => `<th class="r">${m}</th>`).join('')}<th class="r">Total</th></tr></thead><tbody>
        ${dados.map(l => `<tr><td><b>${esc(l.nome)}</b></td>${l.meses.map(x => `<td class="r num ${x ? '' : 'faint'}">${x ? eur(x) : '–'}</td>`).join('')}<td class="r num"><b>${eur(l.meses.reduce((a, b) => a + b, 0))}</b></td></tr>`).join('') || '<tr><td colspan="14" class="empty">Sem dados.</td></tr>'}</tbody></table></div></div>`;
      if (dados.length) SPAP.chart.bars(c.querySelector('#ch'), { labels: MES3, stacked: true, height: 220, series: dados.map(l => ({ name: l.nome, values: l.meses })) });
      csvRows = [['Centro de custo', ...MES3, 'Total'], ...dados.map(l => [l.nome, ...l.meses, r2(l.meses.reduce((a, b) => a + b, 0))])];
    }
    if (tab === 'cat') {
      const cats = db.categorias.filter(x => x !== ENTRADA).map(cat => { const ps = db.pedidos.filter(p => p.categoria === cat && ehSaida(p));
        return { cat, exec: r2(ps.filter(p => p.estado === 'EXECUTADO' && (p.dataExecucao || '').startsWith(ano)).reduce((s, p) => s + p.valor, 0)), comp: r2(ps.filter(p => ['PENDENTE', 'EM_APROVACAO', 'APROVADO'].includes(p.estado) && (p.dataPrevista || '').startsWith(ano)).reduce((s, p) => s + p.valor, 0)), orc: app.orcamento(cat) * 12 }; }).filter(x => x.exec || x.comp || x.orc);
      c.innerHTML = `<div class="grid g3"><div class="card"><div class="card-h"><h3>Executado por categoria</h3></div><div id="dn"></div></div>
        <div class="card flush span2"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Categoria</th><th class="r">Orçamento anual*</th><th class="r">Executado</th><th class="r">Comprometido</th></tr></thead><tbody>
        ${cats.map(x => `<tr><td><b>${esc(x.cat)}</b></td><td class="r num">${x.orc ? eur(x.orc) : '—'}</td><td class="r num">${eur(x.exec)}</td><td class="r num">${eur(x.comp)}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">Sem dados.</td></tr>'}</tbody></table></div>
        <div class="faint" style="font-size:11.5px;padding:8px 14px">* orçamento mensal da categoria × 12</div></div></div>`;
      SPAP.chart.donut(c.querySelector('#dn'), { center: eur(cats.reduce((s, x) => s + x.exec, 0)).replace(/,\d+/, ''), sub: 'executado', items: cats.filter(x => x.exec).sort((a, b) => b.exec - a.exec).slice(0, 6).map(x => ({ label: x.cat, value: x.exec })) });
      csvRows = [['Categoria', 'Orçamento anual', 'Executado', 'Comprometido'], ...cats.map(x => [x.cat, x.orc, x.exec, x.comp])];
    }
    if (tab === 'cc') {
      c.innerHTML = `<div class="alert info" style="margin-bottom:16px">${icon('target')}<div>Cada pedido pode ser imputado a um centro de custo. Se o centro tiver orçamento anual e o pedido o fizer ultrapassar (executado + comprometido), o pedido passa a exigir <b>2 aprovações</b>. Criar ou alterar centros de custo segue a regra das duas pessoas.</div></div>
        <div class="card flush"><div class="card-h"><h3>Centros de custo</h3>${can('admin') ? `<button class="btn sm" id="ncc">${icon('plus')} Novo centro de custo</button>` : ''}</div>
        ${ccs.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Código</th><th>Nome</th><th>Responsável</th><th class="r">Orçamento anual</th><th>Estado</th><th></th></tr></thead><tbody>
          ${ccs.map(x => `<tr><td class="mono">${esc(x.codigo)}</td><td><b>${esc(x.nome)}</b></td><td>${esc(x.responsavel ? userName(x.responsavel) : '—')}</td><td class="r num">${+x.orcamentoAnual ? eur(x.orcamentoAnual) : '—'}</td><td>${x.ativo === false ? '<span class="badge">Inativo</span>' : '<span class="badge ok">Ativo</span>'}</td>
            <td class="r">${can('admin') ? `<button class="btn sm" data-ec="${x.id}">${icon('edit')}</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Sem centros de custo.</div>'}</div>`;
      const editar = x0 => { const novo = !x0, x = x0 || { ativo: true };
        ui.modal({ title: novo ? 'Novo centro de custo' : 'Editar ' + x.codigo, body: `<form class="form">
          <div class="fld"><label>Código</label><input class="inp mono" name="codigo" value="${esc(x.codigo || '')}" placeholder="ex.: CC-01"></div>
          <div class="fld"><label>Nome</label><input class="inp" name="nome" value="${esc(x.nome || '')}" placeholder="ex.: Operações"></div>
          <div class="fld"><label>Responsável</label><select class="inp" name="responsavel"><option value="">—</option>${db.users.filter(u => u.ativo !== false).map(u => `<option value="${u.id}" ${u.id === x.responsavel ? 'selected' : ''}>${esc(u.nome)}</option>`).join('')}</select></div>
          <div class="fld"><label>Orçamento anual (€)</label><input class="inp num" type="number" step="0.01" min="0" name="orcamentoAnual" value="${x.orcamentoAnual || ''}" placeholder="sem orçamento"></div>
          <div class="fld"><label>&nbsp;</label><label class="check"><input type="checkbox" name="ativo" ${x.ativo !== false ? 'checked' : ''}> Ativo</label></div></form>`,
          actions: [{ label: 'Cancelar', kind: 'ghost' }, { label: 'Propor', kind: 'primary', onClick: async el => {
            const f = ui.formData(el); if (!f.codigo || !f.nome) { ui.toast('Código e nome são obrigatórios', 'warn'); return false; }
            if (ccs.some(y => y.codigo === f.codigo && y.id !== x.id)) { ui.toast('Esse código já existe', 'bad'); return false; }
            const nx = { ...x, id: x.id || uid(), codigo: f.codigo, nome: f.nome, responsavel: f.responsavel || null, orcamentoAnual: r2(f.orcamentoAnual) || 0, ativo: f.ativo };
            const nova = novo ? [...ccs.map(y => ({ ...y })), nx] : ccs.map(y => y.id === x.id ? nx : { ...y });
            const fm = (k, val) => k === 'orcamentoAnual' ? (+val ? eur(val) : '—') : k === 'responsavel' ? (val ? userName(val) : '—') : k === 'ativo' ? (val !== false ? 'Ativo' : 'Inativo') : (val || '—');
            const nomes = { codigo: 'Código', nome: 'Nome', responsavel: 'Responsável', orcamentoAnual: 'Orçamento anual', ativo: 'Estado' };
            const det = Object.keys(nomes).filter(k => novo || fm(k, x[k]) !== fm(k, nx[k])).map(k => [nomes[k], novo ? '—' : fm(k, x[k]), fm(k, nx[k])]);
            if (!det.length) { ui.toast('Sem alterações', 'warn'); return false; }
            if (!await app.proporAlteracao('CENTROS_CUSTO', { centros: nova }, `${novo ? 'Novo' : 'Alteração'} · ${f.codigo} ${f.nome}`, det)) return false; render(); } }] }); };
      const ncc = c.querySelector('#ncc'); if (ncc) ncc.onclick = () => editar();
      c.querySelectorAll('[data-ec]').forEach(b => b.onclick = () => editar(ccs.find(x => x.id === b.dataset.ec)));
    }
    const csv = v.querySelector('#csv'); if (csv) csv.onclick = () => SPAP.csv(`relatorio_${tab}_${cfg.key}_${ano}.csv`, csvRows);
  } });

  /* ---------- Restauro de cópia com duplo controlo ---------- */
  const RKEY = id => `${KEY}:restauro:${id}`;
  app.registarAlteracao('RESTAURAR_COPIA', { titulo: 'Restauro de cópia de segurança',
    descartar: p => { try { localStorage.removeItem(RKEY(p.ref)); } catch (e) { } },
    aplicar: p => {
      const txt = localStorage.getItem(RKEY(p.ref));
      if (!txt || sha256(txt) !== p.hash) { ui.toast('A cópia guardada para restauro não foi encontrada ou foi alterada — restauro cancelado.', 'bad'); return; }
      const d = JSON.parse(txt); const quem = app.user ? app.user.username : 'sistema';
      localStorage.removeItem(RKEY(p.ref));
      app.db = db = d; log('BACKUP_RESTAURADO', `${p.origem} · aprovado no circuito de alterações (${quem})`); save();
      setTimeout(() => logout(), 80);
    } });

  /* =========================================================
     ANÁLISE FINANCEIRA
     Indicadores de negócio, relatórios financeiros e planeamento
     de investimentos. Cada indicador tem um (i) com a definição.
     Base: pedidos executados classificados por natureza (receita,
     custo variável, custo fixo, CAPEX…) + dados do módulo (vendas).
     ========================================================= */
  const GLOSS = {
    revenue: { n: 'Revenue', pt: 'Receita / volume de negócios', d: 'Total faturado no período com a venda de produtos ou serviços, antes de qualquer custo.', f: 'Σ vendas (sem IVA)' },
    cv: { n: 'Variable costs', pt: 'Custos variáveis', d: 'Custos que sobem ou descem com o volume de vendas, como comissões, matérias-primas ou portes.', f: 'Σ custos que dependem das vendas' },
    contribution: { n: 'Contribution margin', pt: 'Margem de contribuição', d: 'O que sobra das vendas depois dos custos variáveis, para pagar os custos fixos e gerar lucro.', f: 'Receita − custos variáveis' },
    cmr: { n: 'Contribution margin ratio', pt: 'Margem de contribuição %', d: 'Percentagem de cada euro vendido que fica para cobrir custos fixos e lucro.', f: 'Margem de contribuição ÷ receita' },
    opex: { n: 'OPEX', pt: 'Custos fixos operacionais', d: 'Operating expenses: custos do dia a dia que não dependem das vendas, como rendas, salários, seguros e marketing.', f: 'Σ custos fixos do período' },
    ebitda: { n: 'EBITDA', pt: 'Resultado antes de juros, impostos, depreciações e amortizações', d: 'Mede o lucro gerado pela operação, sem o efeito do financiamento, dos impostos e do desgaste dos ativos. É dos indicadores mais usados para comparar empresas.', f: 'Margem de contribuição − OPEX' },
    ebitdaMargin: { n: 'EBITDA margin', pt: 'Margem EBITDA', d: 'Que parte da receita se transforma em resultado operacional. Acima de 15–20% é normalmente considerada saudável, mas varia por setor.', f: 'EBITDA ÷ receita' },
    da: { n: 'D&A', pt: 'Depreciações e amortizações', d: 'Depreciation & Amortization: o custo do desgaste dos equipamentos e outros ativos, repartido pelos anos de vida útil.', f: 'CAPEX ÷ (vida útil × 12) por mês' },
    ebit: { n: 'EBIT', pt: 'Resultado operacional', d: 'Earnings Before Interest and Taxes: resultado da operação depois das depreciações e antes de juros e impostos.', f: 'EBITDA − D&A' },
    tax: { n: 'Income tax (IRC)', pt: 'Imposto sobre o rendimento (estimado)', d: 'Estimativa do IRC sobre o resultado positivo do ano, à taxa definida na Classificação.', f: 'max(EBIT, 0) × taxa de IRC' },
    net: { n: 'Net income', pt: 'Resultado líquido', d: 'O lucro (ou prejuízo) final, depois de todos os custos, depreciações e impostos.', f: 'EBIT − imposto' },
    netMargin: { n: 'Net margin', pt: 'Margem líquida', d: 'Percentagem da receita que acaba como lucro final.', f: 'Resultado líquido ÷ receita' },
    bep: { n: 'Break-even point', pt: 'Ponto de equilíbrio', d: 'Receita mínima para cobrir todos os custos fixos e variáveis: abaixo dela há prejuízo, acima há lucro.', f: 'OPEX ÷ margem de contribuição %' },
    bepUnits: { n: 'Break-even units', pt: 'Unidades de equilíbrio', d: 'Quantas unidades (horas, serviços, produtos) é preciso vender por mês para não ter prejuízo.', f: 'OPEX mensal ÷ margem de contribuição por unidade' },
    mos: { n: 'Margin of safety', pt: 'Margem de segurança', d: 'Quanto as vendas podem cair antes de a empresa entrar em prejuízo.', f: '(Receita − break-even) ÷ receita' },
    dol: { n: 'DOL', pt: 'Grau de alavancagem operacional', d: 'Degree of Operating Leverage: quanto o EBIT varia quando as vendas variam 1%. Um DOL de 3 significa que +10% de vendas dá +30% de EBIT (e o mesmo nas descidas).', f: 'Margem de contribuição ÷ EBIT' },
    ticket: { n: 'Average ticket (AOV)', pt: 'Ticket médio', d: 'Average Order Value: valor médio de cada venda.', f: 'Receita ÷ número de vendas' },
    vcr: { n: 'Variable cost ratio', pt: 'Peso dos custos variáveis', d: 'Percentagem da receita consumida pelos custos variáveis (ex.: comissões).', f: 'Custos variáveis ÷ receita' },
    burn: { n: 'Burn rate', pt: 'Taxa de consumo de caixa', d: 'Quanto dinheiro a empresa perde por mês, em média (últimos 3 meses). Zero quando o fluxo de caixa é positivo.', f: '− média mensal do fluxo de caixa líquido (se negativo)' },
    runway: { n: 'Cash runway', pt: 'Autonomia de tesouraria', d: 'Quantos meses a empresa aguenta com o dinheiro atual, ao ritmo de consumo do burn rate.', f: 'Caixa ÷ burn rate' },
    cash: { n: 'Cash position', pt: 'Disponibilidades', d: 'Dinheiro nas contas próprias da empresa (tesouraria) no fim do período.', f: 'Σ saldos das contas próprias' },
    ocf: { n: 'Operating cash flow (OCF)', pt: 'Fluxo de caixa operacional', d: 'Dinheiro que entrou e saiu pela atividade normal (vendas, custos), sem investimentos nem financiamento.', f: 'Recebimentos − pagamentos operacionais' },
    capex: { n: 'CAPEX', pt: 'Investimento em ativos', d: 'Capital Expenditure: dinheiro gasto em equipamentos e outros ativos que duram vários anos.', f: 'Σ aquisições de equipamento/ativos' },
    fcf: { n: 'Free cash flow (FCF)', pt: 'Fluxo de caixa livre', d: 'Dinheiro que sobra depois da operação e dos investimentos em ativos: o que fica disponível para os sócios ou para pagar dívida.', f: 'OCF − CAPEX' },
    cashconv: { n: 'Cash conversion', pt: 'Conversão de EBITDA em caixa', d: 'Que parte do EBITDA se transformou realmente em dinheiro. Valores baixos indicam dinheiro preso (ex.: comissões por pagar ao contrário, vendas por receber).', f: 'OCF ÷ EBITDA' },
    roi: { n: 'ROI', pt: 'Retorno do investimento', d: 'Return On Investment: lucro gerado por cada euro investido em ativos.', f: 'Resultado líquido ÷ CAPEX acumulado' },
    roe: { n: 'ROE', pt: 'Rentabilidade do capital próprio', d: 'Return On Equity: lucro gerado por cada euro que os sócios meteram na empresa.', f: 'Resultado líquido ÷ capital próprio' },
    roa: { n: 'ROA', pt: 'Rentabilidade do ativo', d: 'Return On Assets: lucro gerado por cada euro de ativos (aqui, disponibilidades e ativos fixos).', f: 'Resultado líquido ÷ ativo total' },
    yoy: { n: 'YoY growth', pt: 'Crescimento homólogo', d: 'Year over Year: variação da receita face ao mesmo período do ano anterior.', f: '(Receita ano − receita ano anterior) ÷ receita ano anterior' },
    mom: { n: 'MoM growth', pt: 'Crescimento mensal', d: 'Month over Month: variação da receita do último mês face ao mês anterior.', f: '(Mês atual − mês anterior) ÷ mês anterior' },
    cagr: { n: 'CAGR', pt: 'Taxa de crescimento anual composta', d: 'Compound Annual Growth Rate: crescimento médio por ano entre o primeiro ano com receita e o ano selecionado, como se tivesse sido constante.', f: '(Receita final ÷ receita inicial)^(1 ÷ anos) − 1' },
    runrate: { n: 'Revenue run-rate', pt: 'Receita anualizada', d: 'Receita que a empresa faria num ano se mantivesse o ritmo dos últimos 3 meses.', f: 'Média dos últimos 3 meses × 12' },
    equity: { n: 'Equity', pt: 'Capital próprio', d: 'O valor que pertence aos sócios: capital investido mais resultados acumulados, menos o que já foi distribuído.', f: 'Capital realizado + resultados acumulados − distribuições' },
    payable: { n: 'Accounts payable', pt: 'Contas a pagar', d: 'Valores já devidos a terceiros mas ainda não pagos (ex.: comissões de vendedores por pagar).', f: 'Custos reconhecidos − custos pagos' },
    pl: { n: 'Income statement (P&L)', pt: 'Demonstração de resultados', d: 'Profit & Loss: mostra como a receita se transforma em resultado, mês a mês. Usa o regime de acréscimo (quando o custo/receita acontece, não quando é pago).' },
    cfs: { n: 'Cash flow statement', pt: 'Demonstração de fluxos de caixa', d: 'Mostra de onde veio e para onde foi o dinheiro: operação, investimento e financiamento.' },
    bs: { n: 'Balance sheet', pt: 'Balanço', d: 'Fotografia no fim do ano do que a empresa tem (ativo) e de quem é (capital próprio e passivo). Versão simplificada, a partir do livro interno.' },
    recon: { n: 'Reconciliation difference', pt: 'Diferença de conciliação', d: 'Diferença entre o ativo e o capital próprio + passivo calculados. Surge quando há movimentos que o modelo simplificado não classifica (ex.: transferências entre entidades do grupo). Idealmente é zero.' },
    npv: { n: 'NPV', pt: 'VAL — Valor Atual Líquido', d: 'Net Present Value: quanto o projeto vale hoje, descontando os fluxos futuros à taxa exigida. Positivo = o projeto cria valor; negativo = destrói valor.', f: '−investimento + Σ fluxo_t ÷ (1 + taxa)^t' },
    irr: { n: 'IRR', pt: 'TIR — Taxa Interna de Rentabilidade', d: 'Internal Rate of Return: a taxa de rentabilidade anual do projeto. Se for maior do que a taxa de desconto exigida, o projeto compensa.', f: 'Taxa que torna o NPV = 0' },
    payback: { n: 'Payback period', pt: 'Período de recuperação', d: 'Quanto tempo demora a recuperar o dinheiro investido, somando os fluxos de caixa.', f: 'Ano em que os fluxos acumulados ≥ investimento' },
    dpayback: { n: 'Discounted payback', pt: 'Período de recuperação atualizado', d: 'Igual ao payback, mas com os fluxos descontados à taxa exigida — mais exigente e realista.', f: 'Ano em que os fluxos descontados acumulados ≥ investimento' },
    pi: { n: 'Profitability Index (PI)', pt: 'Índice de rendibilidade', d: 'Quanto valor atual cada euro investido gera. Acima de 1 o projeto compensa.', f: 'Valor atual dos fluxos ÷ investimento' },
    projroi: { n: 'ROI', pt: 'Retorno total do projeto', d: 'Ganho total do projeto face ao investimento, sem descontar o tempo.', f: '(Σ fluxos + valor residual − investimento) ÷ investimento' },
    wacc: { n: 'Discount rate (WACC)', pt: 'Taxa de desconto', d: 'Rentabilidade mínima exigida ao projeto. Em empresas usa-se o WACC (Weighted Average Cost of Capital): custo médio do dinheiro dos sócios e dos bancos.', f: 'Ex.: 8–12% ao ano' },
    residual: { n: 'Terminal / residual value', pt: 'Valor residual', d: 'Quanto o investimento ainda vale no fim do horizonte (ex.: revenda do equipamento).' },
    sens: { n: 'Sensitivity analysis', pt: 'Análise de sensibilidade', d: 'Mostra como o NPV muda se a taxa de desconto ou os fluxos forem diferentes do previsto. Ajuda a perceber o risco.' },
    scen: { n: 'Scenario analysis', pt: 'Análise de cenários', d: 'Compara o projeto num cenário pessimista, base e otimista (fluxos mais baixos ou mais altos).' },
    capexPlan: { n: 'Initial investment (CAPEX)', pt: 'Investimento inicial', d: 'Dinheiro a investir no início do projeto (ano 0).' },
    cfPlan: { n: 'Annual cash flows', pt: 'Fluxos de caixa anuais', d: 'Dinheiro líquido que o projeto gera em cada ano (receitas − custos do projeto, depois de impostos).' },
  };
  const info = k => { const g = GLOSS[k]; if (!g) return '';
    const tip = `<b>${esc(g.n)}</b>${g.pt ? ` · ${esc(g.pt)}` : ''}<br>${esc(g.d)}${g.f ? `<br><span class="tipf">${esc(g.f)}</span>` : ''}`;
    return `<span class="info-tip" tabindex="0" role="note" aria-label="${esc(g.n + ': ' + g.d)}" data-tip="${esc(tip)}">i</span>`; };
  const kn = (k, rot) => `${esc(rot || GLOSS[k].n)}${info(k)}`;
  app.info = info; app.kn = kn; app.GLOSS = GLOSS;

  const CLASSES = { receita: 'Receita', custo_variavel: 'Custo variável', custo_fixo: 'Custo fixo (OPEX)', capex: 'Investimento em ativos (CAPEX)', investimento: 'Investimento financeiro',
    financiamento_entrada: 'Entrada de capital / financiamento', financiamento_saida: 'Reembolso de financiamento', distribuicao: 'Distribuição aos sócios', imposto: 'Impostos pagos', interno: 'Movimento interno (ignorado)' };
  const CLASSE_PADRAO = cat => ({ 'ENTRADA DE FUNDOS': 'financiamento_entrada', 'PAGAMENTO DE COMISSÕES': 'custo_variavel', 'DISTRIBUIÇÃO DE RESULTADOS': 'distribuicao', 'AQUISIÇÃO DE EQUIPAMENTO': 'capex',
    'APLICAÇÃO / INVESTIMENTO': 'investimento', 'RESGATE DE APLICAÇÃO': 'investimento', 'CONCESSÃO DE CRÉDITO': 'investimento', 'LIQUIDAÇÃO DE CRÉDITO': 'financiamento_saida',
    'MENSALIDADE / PRESTAÇÃO': 'financiamento_saida', 'TRANSFERÊNCIA INTERNA': 'interno' }[cat] || 'custo_fixo');
  const finCfg = () => { const f = db.settings.fin = db.settings.fin || {}; if (f.irc == null) f.irc = 0.21; if (!f.vidaUtil) f.vidaUtil = 5; f.classes = f.classes || {}; return f; };
  const classeDe = p => p.origem && p.origem.mod === 'intercompany' ? 'receita' : (finCfg().classes[p.categoria] || CLASSE_PADRAO(p.categoria));
  const propriasAuto = () => db.contas.filter(c => cfg.contaPropria ? cfg.contaPropria(c) : ['TESOURARIA', 'FUNDO'].includes(c.categoria)).map(c => c.id);
  const proprias = () => { const f = finCfg(); return new Set(Array.isArray(f.contas) && f.contas.length ? f.contas : propriasAuto()); };
  const S_ = a => r2(a.reduce((x, y) => x + y, 0));
  const z12 = () => Array(12).fill(0);
  const anoAtualN = () => +today().slice(0, 4);
  app.finAnos = () => { const s = new Set([String(anoAtualN())]); db.movimentos.forEach(m => s.add(String(m.data).slice(0, 4))); db.pedidos.forEach(p => p.estado === 'EXECUTADO' && s.add(String(p.dataExecucao || p.dataPrevista).slice(0, 4))); return [...s].filter(Boolean).sort(); };
  const cacheFin = {};
  app.finAno = ano => {
    ano = String(ano); const ck = ano + '|' + db.movimentos.length + '|' + db.pedidos.length + '|' + JSON.stringify(finCfg()); if (cacheFin[ano] && cacheFin[ano].ck === ck) return cacheFin[ano].R;
    const f = finCfg(), R = { receita: z12(), cv: z12(), cf: z12(), capex: z12(), dep: z12(), invest: z12(), finIn: z12(), finOut: z12(), dist: z12(), impPago: z12(), unidades: z12(), nVendas: z12(), op: z12(), inv: z12(), fin: z12(), caixaFim: z12(), cfCat: {}, temModulo: false };
    const an = cfg.analise ? cfg.analise(app, ano) : null;
    db.pedidos.filter(p => p.estado === 'EXECUTADO' && p.valor > 0).forEach(p => {
      const d = String(p.dataExecucao || p.dataPrevista), cl = classeDe(p);
      if (cl === 'capex') { const n = f.vidaUtil * 12, m0 = new Date(d + 'T12:00:00'); for (let k = 0; k < n; k++) { const dd = new Date(m0.getFullYear(), m0.getMonth() + k, 15); if (dd.getFullYear() === +ano) R.dep[dd.getMonth()] += p.valor / n; } }
      if (!d.startsWith(ano)) return; const m = +d.slice(5, 7) - 1;
      if (cl === 'receita') R.receita[m] += p.valor;
      else if (cl === 'custo_variavel') { if (!an) R.cv[m] += p.valor; }
      else if (cl === 'custo_fixo') { R.cf[m] += p.valor; (R.cfCat[p.categoria] = R.cfCat[p.categoria] || z12())[m] += p.valor; }
      else if (cl === 'capex') R.capex[m] += p.valor;
      else if (cl === 'investimento') R.invest[m] += p.categoria === 'RESGATE DE APLICAÇÃO' ? -p.valor : p.valor;
      else if (cl === 'financiamento_entrada') R.finIn[m] += p.valor;
      else if (cl === 'financiamento_saida') R.finOut[m] += p.valor;
      else if (cl === 'distribuicao') R.dist[m] += p.valor;
      else if (cl === 'imposto') R.impPago[m] += p.valor;
    });
    if (an) { R.temModulo = true; for (let m = 0; m < 12; m++) { R.receita[m] += an.receitas[m] || 0; R.cv[m] += an.custosVar[m] || 0; R.unidades[m] = (an.unidades || [])[m] || 0; R.nVendas[m] = (an.n || [])[m] || 0; } R.passivo = an.passivo || 0; R.rotUnidade = an.rotUnidade || 'unidades'; }
    const own = proprias(), ped = {}; db.pedidos.forEach(p => { ped[p.id] = p; });
    db.movimentos.forEach(mv => { if (!own.has(mv.conta) || !String(mv.data).startsWith(ano)) return; const m = +String(mv.data).slice(5, 7) - 1, p = mv.pedido && ped[mv.pedido];
      if (!p) { R.op[m] += mv.valor; return; }
      const outro = mv.valor < 0 ? p.contaDestino : p.contaOrigem; if (outro && own.has(outro)) return;
      const cl = classeDe(p);
      if (cl === 'capex' || cl === 'investimento') R.inv[m] += mv.valor; else if (['financiamento_entrada', 'financiamento_saida', 'distribuicao'].includes(cl)) R.fin[m] += mv.valor; else if (cl !== 'interno') R.op[m] += mv.valor; });
    for (let m = 0; m < 12; m++) { const fim = `${ano}-${String(m + 1).padStart(2, '0')}-31`;
      R.caixaFim[m] = r2([...own].reduce((s, id) => { const c = conta(id); return s + (c ? +c.saldoInicial || 0 : 0) + db.movimentos.reduce((a, mv) => mv.conta === id && mv.data <= fim ? a + mv.valor : a, 0); }, 0)); }
    R.mc = R.receita.map((v, m) => v - R.cv[m]); R.ebitda = R.mc.map((v, m) => v - R.cf[m]); R.ebit = R.ebitda.map((v, m) => v - R.dep[m]);
    const ebitAno = S_(R.ebit), impAno = Math.max(0, ebitAno) * f.irc;
    R.imp = R.ebit.map(v => ebitAno > 0 ? impAno * v / ebitAno : 0); R.rl = R.ebit.map((v, m) => v - R.imp[m]);
    R.fcf = R.op.map((v, m) => v - R.capex[m]); R.variacao = R.op.map((v, m) => v + R.inv[m] + R.fin[m]);
    Object.keys(R).forEach(k => { if (Array.isArray(R[k])) R[k] = R[k].map(r2); });
    cacheFin[ano] = { ck, R }; return R;
  };
  app.finKpis = ano => {
    ano = String(ano); const R = app.finAno(ano), P = app.finAno(String(+ano - 1));
    const mesesN = +ano === anoAtualN() ? +today().slice(5, 7) : 12;
    const rev = S_(R.receita), cv = S_(R.cv), mc = r2(rev - cv), opex = S_(R.cf), ebitda = S_(R.ebitda), da = S_(R.dep), ebit = S_(R.ebit), imp = S_(R.imp), rl = S_(R.rl);
    const cmr = rev ? mc / rev : null, bep = cmr > 0 ? opex / cmr : (opex === 0 && rev > 0 ? 0 : null);
    const units = S_(R.unidades), cmUnit = units ? mc / units : null, bepUnits = cmUnit > 0 ? (opex / mesesN) / cmUnit : null, nV = S_(R.nVendas);
    const k0 = Math.max(0, mesesN - 3), net3 = [0, 1, 2].map(i => R.variacao[k0 + i] || 0).slice(0, mesesN - k0), netM = net3.length ? net3.reduce((a, b) => a + b, 0) / net3.length : 0;
    const caixa = R.caixaFim[mesesN - 1] || 0, burn = netM < 0 ? -netM : 0, runway = burn > 0 ? caixa / burn : null;
    const ocf = S_(R.op), capex = S_(R.capex), fcf = r2(ocf - capex);
    const anos = app.finAnos().filter(y => +y <= +ano), todos = anos.map(y => app.finAno(y));
    const own = proprias(), capitalInicial = [...own].reduce((s, id) => s + (+(conta(id) || {}).saldoInicial || 0), 0);
    const capital = r2(capitalInicial + todos.reduce((s, x) => s + S_(x.finIn), 0)), resAcum = r2(todos.reduce((s, x) => s + S_(x.rl), 0)), distAcum = r2(todos.reduce((s, x) => s + S_(x.dist), 0));
    const capexAcum = r2(todos.reduce((s, x) => s + S_(x.capex), 0)), depAcum = r2(todos.reduce((s, x) => s + S_(x.dep), 0)), investAcum = r2(todos.reduce((s, x) => s + S_(x.invest), 0));
    const impPagar = r2(Math.max(0, todos.reduce((s, x) => s + S_(x.imp) - S_(x.impPago), 0))), equity = r2(capital + resAcum - distAcum), ativoFixo = r2(capexAcum - depAcum), ativo = r2(caixa + ativoFixo + investAcum);
    const prevRev = S_(P.receita), mU = mesesN - 1, mom = mU > 0 && R.receita[mU - 1] ? (R.receita[mU] - R.receita[mU - 1]) / R.receita[mU - 1] : null;
    const prim = anos.find(y => S_(app.finAno(y).receita) > 0), cagr = prim && +prim < +ano && rev > 0 ? Math.pow(rev / S_(app.finAno(prim).receita), 1 / (+ano - +prim)) - 1 : null;
    const ult3 = R.receita.slice(Math.max(0, mesesN - 3), mesesN), runrate = ult3.length ? ult3.reduce((a, b) => a + b, 0) / ult3.length * 12 : 0;
    return { ano, mesesN, R, rev, cv, mc, cmr, opex, ebitda, ebitdaM: rev ? ebitda / rev : null, da, ebit, imp, rl, netM: rev ? rl / rev : null,
      bep, mos: bep != null && rev > 0 ? (rev - bep) / rev : null, dol: ebit ? mc / ebit : null, units, cmUnit, bepUnits, ticket: nV ? rev / nV : null, nV, vcr: rev ? cv / rev : null,
      caixa, burn, runway, ocf, capex, fcf, cashconv: ebitda ? ocf / ebitda : null, roi: capexAcum ? rl / capexAcum : null, roe: equity > 0 ? rl / equity : null, roa: ativo > 0 ? rl / ativo : null,
      yoy: prevRev ? (rev - prevRev) / prevRev : null, mom, cagr, cagrDesde: prim, runrate, prevRev, capital, resAcum, distAcum, equity, capexAcum, depAcum, ativoFixo, investAcum, ativo,
      passivo: R.passivo || 0, impPagar };
  };

  /* ---------- formatação de indicadores ---------- */
  const nd = '<span class="faint" title="Dados insuficientes para calcular">n.d.</span>';
  const fE = v => v == null || !isFinite(v) ? nd : eur(v), fP = v => v == null || !isFinite(v) ? nd : pct(v), fX = (v, s = '×') => v == null || !isFinite(v) ? nd : (Math.round(v * 100) / 100).toLocaleString('pt-PT') + s;
  const kpiC = (k, val, foot = '', hero = false, rot) => `<div class="card kpi ${hero ? 'hero' : ''}"><div class="lbl">${kn(k, rot)}</div><div class="val num">${val}</div>${foot ? `<div class="foot">${foot}</div>` : ''}</div>`;
  const seletorAno = (id, ano) => `<select class="inp inp-sm" id="${id}">${app.finAnos().map(y => `<option ${y === String(ano) ? 'selected' : ''}>${y}</option>`).join('')}</select>`;
  const anoFin = () => { const a = sessionStorage.getItem(KEY + ':fano'); return app.finAnos().includes(a) ? a : String(anoAtualN()); };

  /* ---------- Indicadores de negócio ---------- */
  route('indicadores', { id: 'indicadores', title: 'Indicadores de negócio', render(v) {
    const ano = anoFin(), K = app.finKpis(ano), R = K.R;
    const sec = (t, sub, html) => `<div class="sec-fin"><div class="sec-fin-h"><h3>${t}</h3><span class="sub">${sub}</span></div><div class="grid g4">${html}</div></div>`;
    v.innerHTML = `<div class="row between" style="margin-bottom:16px"><div class="row"><span class="muted">Exercício</span>${seletorAno('fa', ano)}${K.mesesN < 12 ? `<span class="badge plain">até ${MESES[K.mesesN - 1].toLowerCase()} (YTD)</span>` : ''}</div>
      <a class="btn sm" href="#/financeiro">${icon('file')} Relatórios financeiros</a></div>
      ${!K.rev && !K.opex ? `<div class="alert info" style="margin-bottom:16px">${icon('chart')}<div>Ainda há poucos dados neste exercício. Os indicadores são calculados a partir dos pagamentos executados${cfg.analise ? ' e das vendas registadas' : ''}; a natureza de cada categoria define-se em <a href="#/financeiro" data-aba="ftab=cls">Relatórios financeiros → Classificação</a>.</div></div>` : ''}
      ${sec('Rentabilidade', 'Profitability', kpiC('revenue', eur(K.rev), K.yoy != null ? `${K.yoy >= 0 ? '▲' : '▼'} ${pct(Math.abs(K.yoy))} vs ${+ano - 1}` : '', true) + kpiC('contribution', eur(K.mc), fP(K.cmr) + ' da receita') + kpiC('ebitda', eur(K.ebitda), 'margem ' + fP(K.ebitdaM)) + kpiC('net', eur(K.rl), 'margem ' + fP(K.netM)))}
      ${sec('Ponto de equilíbrio', 'Break-even analysis', kpiC('bep', fE(K.bep), K.bep != null ? `${fE(K.bep / 12)} por mês` : '') + kpiC('mos', fP(K.mos), K.mos != null ? (K.mos >= 0 ? 'acima do break-even' : 'abaixo do break-even') : '') + kpiC('dol', fX(K.dol), 'sensibilidade do EBIT às vendas') + kpiC('bepUnits', K.bepUnits != null ? fX(Math.ceil(K.bepUnits), ' ' + (R.rotUnidade || 'un.') + '/mês') : nd, K.cmUnit ? `margem ${eur(K.cmUnit)} por unidade` : ''))}
      ${sec('Tesouraria e liquidez', 'Cash & liquidity', kpiC('cash', eur(K.caixa), 'contas próprias') + kpiC('burn', K.burn ? eur(K.burn) + '/mês' : eur(0), K.burn ? 'consumo médio dos últimos 3 meses' : 'fluxo de caixa positivo') + kpiC('runway', K.runway == null ? '∞' : fX(K.runway, ' meses'), K.runway == null ? 'sem consumo de caixa' : '') + kpiC('fcf', eur(K.fcf), `OCF ${eur(K.ocf)} · CAPEX ${eur(K.capex)}`))}
      ${sec('Retorno e eficiência', 'Returns & efficiency', kpiC('roe', fP(K.roe), 'capital próprio ' + eur(K.equity)) + kpiC('roa', fP(K.roa), 'ativo ' + eur(K.ativo)) + kpiC('roi', fP(K.roi), 'CAPEX acumulado ' + eur(K.capexAcum)) + kpiC('cashconv', fP(K.cashconv), 'OCF ÷ EBITDA'))}
      ${sec('Crescimento e operação', 'Growth & unit economics', kpiC('yoy', fP(K.yoy), `${+ano - 1}: ${eur(K.prevRev)}`) + kpiC('cagr', fP(K.cagr), K.cagrDesde && K.cagr != null ? 'desde ' + K.cagrDesde : '') + kpiC('runrate', eur(K.runrate), 'ritmo dos últimos 3 meses') + kpiC('ticket', fE(K.ticket), K.nV ? K.nV + ' vendas' : '') + kpiC('vcr', fP(K.vcr)) + kpiC('opex', eur(K.opex), 'custos fixos do período') + kpiC('mom', fP(K.mom), 'último mês vs anterior') + kpiC('da', eur(K.da), 'vida útil ' + finCfg().vidaUtil + ' anos'))}
      <div class="grid g2" style="margin-top:6px">
        <div class="card"><div class="card-h"><h3>Receita, custos e ${kn('bep', 'break-even')}</h3><span class="sub">${ano}</span></div><div id="ch1"></div></div>
        <div class="card"><div class="card-h"><h3>${kn('cash', 'Caixa')} e ${kn('ocf', 'fluxo operacional')}</h3><span class="sub">fim de cada mês</span></div><div id="ch2"></div></div></div>
      <div class="card" style="margin-top:16px"><div class="card-h"><h3>Simulador de ${kn('bep', 'break-even')}</h3><span class="sub">altera os valores e vê o ponto de equilíbrio</span></div>
        <form class="form" id="sim" style="grid-template-columns:repeat(4,minmax(0,1fr))">
          <div class="fld"><label>Preço médio por unidade (€)</label><input class="inp num" type="number" step="0.01" name="p" value="${r2(K.units ? K.rev / K.units : 100)}"></div>
          <div class="fld"><label>Custo variável por unidade (€)</label><input class="inp num" type="number" step="0.01" name="cvu" value="${r2(K.units ? K.cv / K.units : 30)}"></div>
          <div class="fld"><label>Custos fixos por mês (€)</label><input class="inp num" type="number" step="0.01" name="cf" value="${K.rev || K.opex ? r2(K.opex / K.mesesN) : 1000}"></div>
          <div class="fld"><label>Vendas previstas por mês (un.)</label><input class="inp num" type="number" step="1" name="q" value="${K.units ? Math.max(1, Math.round(K.units / K.mesesN)) : 20}"></div></form>
        <div class="calc" id="simr" style="margin-top:12px"></div></div>`;
    v.querySelector('#fa').onchange = e => { sessionStorage.setItem(KEY + ':fano', e.target.value); render(); };
    const bepM = K.bep != null ? K.bep / 12 : null;
    SPAP.chart.linha(v.querySelector('#ch1'), { labels: MES3, series: [{ name: 'Receita', values: R.receita, color: 'var(--accent)' }, { name: 'Custos totais', values: R.receita.map((x, m) => r2(R.cv[m] + R.cf[m] + R.dep[m])), color: 'var(--bad)' }].concat(bepM != null ? [{ name: 'Break-even mensal', values: MES3.map(() => r2(bepM)), color: 'var(--warn)', dash: true }] : []) });
    SPAP.chart.linha(v.querySelector('#ch2'), { labels: MES3, series: [{ name: 'Caixa', values: R.caixaFim, color: 'var(--accent2)' }, { name: 'Fluxo operacional', values: R.op, color: 'var(--ok)' }] });
    const sim = v.querySelector('#sim'), simr = v.querySelector('#simr');
    const calc = () => { const f = ui.formData(sim), p = +f.p || 0, cvu = +f.cvu || 0, cf = +f.cf || 0, q = +f.q || 0, mcu = p - cvu;
      const beq = mcu > 0 ? cf / mcu : null, ber = beq != null ? beq * p : null, lucro = q * mcu - cf, mos = q && beq != null ? (q - beq) / q : null, dol = lucro ? (q * mcu) / lucro : null;
      simr.innerHTML = `<div><span>${kn('contribution', 'Margem por unidade')}</span><b class="num">${eur(mcu)}</b></div><div><span>${kn('bepUnits', 'Break-even (un./mês)')}</span><b class="num">${beq == null ? 'impossível' : Math.ceil(beq)}</b></div>
        <div><span>${kn('bep', 'Break-even (€/mês)')}</span><b class="num">${ber == null ? '—' : eur(ber)}</b></div><div><span>Resultado previsto/mês</span><b class="num ${lucro >= 0 ? 'pos' : 'neg'}">${eur(lucro)}</b></div>
        <div><span>${kn('mos', 'Margem de segurança')}</span><b class="num">${mos == null ? '—' : pct(mos)}</b></div><div><span>${kn('dol', 'DOL')}</span><b class="num">${dol == null ? '—' : fX(dol)}</b></div>`; };
    sim.querySelectorAll('input').forEach(i => i.addEventListener('input', calc)); calc();
  } });

  /* ---------- Relatórios financeiros ---------- */
  route('financeiro', { id: 'financeiro', title: 'Relatórios financeiros', render(v) {
    const ano = anoFin(), tab = sessionStorage.getItem(KEY + ':ftab') || 'dr';
    const K = app.finKpis(ano), R = K.R, P = app.finAno(String(+ano - 1));
    v.innerHTML = `<div class="row between" style="margin-bottom:16px"><div class="tabs">${[['dr', 'Demonstração de resultados'], ['dfc', 'Fluxos de caixa'], ['bal', 'Balanço'], ['cls', 'Classificação']].map(([k, l]) => `<button data-t="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="row">${tab !== 'cls' ? `<span class="muted">Exercício</span>${seletorAno('fa', ano)}<button class="btn sm" id="csv">${icon('download')} CSV</button>` : ''}</div></div><div id="c"></div>`;
    v.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { sessionStorage.setItem(KEY + ':ftab', b.dataset.t); render(); });
    const fa = v.querySelector('#fa'); if (fa) fa.onchange = e => { sessionStorage.setItem(KEY + ':fano', e.target.value); render(); };
    const c = v.querySelector('#c'); let csv = [];
    const dlt = (a, b) => b ? `<span class="${a >= b ? 'pos' : 'neg'}">${a >= b ? '▲' : '▼'} ${pct(Math.abs((a - b) / b))}</span>` : '<span class="faint">—</span>';
    const tabela = (titulo, gk, linhas) => {
      csv = [['Rubrica', ...MES3, 'Total ' + ano, 'Total ' + (+ano - 1)], ...linhas.filter(l => !l.pct && !l.sep).map(l => [l.rot, ...l.v, S_(l.v), l.p ? S_(l.p) : ''])];
      return `<div class="card flush"><div class="card-h"><h3>${kn(gk, titulo)}</h3><span class="sub">${ano} · valores em euros</span></div><div class="tbl-wrap"><table class="tbl fin"><thead><tr><th>Rubrica</th>${MES3.map(m => `<th class="r">${m}</th>`).join('')}<th class="r">Total ${ano}</th><th class="r">${+ano - 1}</th><th class="r">Δ</th></tr></thead><tbody>
        ${linhas.map(l => l.sep ? `<tr class="sep"><td colspan="16"></td></tr>` : `<tr class="${l.cls || ''}"><td>${l.k ? kn(l.k, l.rot) : esc(l.rot)}</td>${l.v.map(x => `<td class="r num">${l.pct ? (x == null ? '–' : pct(x)) : x ? eur(x) : '<span class="faint">–</span>'}</td>`).join('')}
          <td class="r num"><b>${l.pct ? fP(l.tot) : eur(S_(l.v))}</b></td><td class="r num faint">${l.pct ? fP(l.totP) : l.p ? eur(S_(l.p)) : '–'}</td><td class="r num">${l.pct || !l.p ? '' : dlt(S_(l.v), S_(l.p))}</td></tr>`).join('')}</tbody></table></div></div>`; };
    if (tab === 'dr') {
      const neg = a => a.map(x => -x), pm = (a, b) => a.map((x, m) => b[m] ? x / b[m] : null);
      const cats = Object.keys(R.cfCat).sort();
      c.innerHTML = tabela('Demonstração de resultados', 'pl', [
        { rot: 'Receita', k: 'revenue', v: R.receita, p: P.receita, cls: 'strong' },
        { rot: 'Custos variáveis', k: 'cv', v: neg(R.cv), p: neg(P.cv) },
        { rot: 'Margem de contribuição', k: 'contribution', v: R.mc, p: P.mc, cls: 'strong' },
        { rot: 'Margem de contribuição %', k: 'cmr', v: pm(R.mc, R.receita), pct: true, tot: K.cmr, totP: S_(P.receita) ? S_(P.mc) / S_(P.receita) : null },
        { sep: true },
        ...cats.map(ct => ({ rot: '  ' + ct.charAt(0) + ct.slice(1).toLowerCase(), v: neg(R.cfCat[ct]), p: P.cfCat[ct] ? neg(P.cfCat[ct]) : null, cls: 'sub' })),
        { rot: 'Custos fixos (OPEX)', k: 'opex', v: neg(R.cf), p: neg(P.cf) },
        { rot: 'EBITDA', k: 'ebitda', v: R.ebitda, p: P.ebitda, cls: 'strong' },
        { rot: 'Margem EBITDA', k: 'ebitdaMargin', v: pm(R.ebitda, R.receita), pct: true, tot: K.ebitdaM, totP: S_(P.receita) ? S_(P.ebitda) / S_(P.receita) : null },
        { rot: 'Depreciações e amortizações', k: 'da', v: neg(R.dep), p: neg(P.dep) },
        { rot: 'EBIT (resultado operacional)', k: 'ebit', v: R.ebit, p: P.ebit, cls: 'strong' },
        { rot: `Imposto estimado (IRC ${pct(finCfg().irc)})`, k: 'tax', v: neg(R.imp), p: neg(P.imp) },
        { rot: 'Resultado líquido', k: 'net', v: R.rl, p: P.rl, cls: 'total' },
        { rot: 'Margem líquida', k: 'netMargin', v: pm(R.rl, R.receita), pct: true, tot: K.netM, totP: S_(P.receita) ? S_(P.rl) / S_(P.receita) : null }]);
    }
    if (tab === 'dfc') {
      c.innerHTML = tabela('Demonstração de fluxos de caixa', 'cfs', [
        { rot: 'Fluxo de caixa operacional', k: 'ocf', v: R.op, p: P.op, cls: 'strong' },
        { rot: 'Fluxo de investimento (CAPEX e aplicações)', k: 'capex', v: R.inv, p: P.inv },
        { rot: 'Fluxo de financiamento (capital, dívida e distribuições)', v: R.fin, p: P.fin },
        { rot: 'Variação de caixa', v: R.variacao, p: P.variacao, cls: 'strong' },
        { sep: true },
        { rot: 'Fluxo de caixa livre', k: 'fcf', v: R.fcf, p: P.fcf, cls: 'total' },
        { rot: 'Caixa no fim do mês', k: 'cash', v: R.caixaFim, p: P.caixaFim, cls: 'sub' }]);
      c.insertAdjacentHTML('beforeend', `<p class="muted" style="font-size:12.5px;margin-top:10px">A «caixa no fim do mês» é um saldo e não se soma: a coluna Total mostra a soma apenas por coerência da tabela. Contas próprias consideradas: ${[...proprias()].map(id => esc(nomeConta(id))).join(', ') || 'nenhuma'}.</p>`);
    }
    if (tab === 'bal') {
      const dif = r2(K.ativo - K.equity - K.passivo - K.impPagar);
      const linha = (k, rot, val, cls = '') => `<tr class="${cls}"><td>${k ? kn(k, rot) : esc(rot)}</td><td class="r num">${eur(val)}</td></tr>`;
      c.innerHTML = `<div class="grid g2"><div class="card flush"><div class="card-h"><h3>${kn('bs', 'Ativo')}</h3><span class="sub">31/12/${ano}${K.mesesN < 12 ? ' (até hoje)' : ''}</span></div><table class="tbl fin">
          ${linha('cash', 'Disponibilidades', K.caixa)}${linha('capex', 'Ativos fixos (CAPEX acumulado)', K.capexAcum)}${linha('da', 'Depreciações acumuladas', -K.depAcum)}${linha('', 'Investimentos financeiros', K.investAcum)}
          ${linha('', 'Total do ativo', K.ativo, 'total')}</table></div>
        <div class="card flush"><div class="card-h"><h3>${kn('equity', 'Capital próprio e passivo')}</h3></div><table class="tbl fin">
          ${linha('', 'Capital realizado (saldos iniciais + entradas de capital)', K.capital)}${linha('net', 'Resultados acumulados', K.resAcum)}${linha('', 'Distribuições aos sócios', -K.distAcum)}
          ${linha('equity', 'Total do capital próprio', K.equity, 'strong')}${linha('payable', 'Contas a pagar', K.passivo)}${linha('tax', 'Imposto estimado a pagar', K.impPagar)}${linha('recon', 'Diferença de conciliação', dif, Math.abs(dif) > 0.01 ? 'warnrow' : '')}
          ${linha('', 'Total do capital próprio e passivo', r2(K.equity + K.passivo + K.impPagar + dif), 'total')}</table></div></div>
        <p class="muted" style="font-size:12.5px;margin-top:10px">Balanço simplificado, construído a partir do livro interno. Não substitui as demonstrações financeiras oficiais preparadas pelo contabilista certificado.</p>`;
      csv = [['Rubrica', 'Valor'], ['Disponibilidades', K.caixa], ['Ativos fixos', K.capexAcum], ['Depreciações acumuladas', -K.depAcum], ['Investimentos financeiros', K.investAcum], ['Total do ativo', K.ativo],
        ['Capital realizado', K.capital], ['Resultados acumulados', K.resAcum], ['Distribuições', -K.distAcum], ['Capital próprio', K.equity], ['Contas a pagar', K.passivo], ['Imposto estimado a pagar', K.impPagar], ['Diferença de conciliação', dif]];
    }
    if (tab === 'cls') {
      const f = finCfg(), own = proprias();
      c.innerHTML = `<div class="alert info" style="margin-bottom:16px">${icon('settings')}<div>A natureza de cada categoria de pagamento define onde ele entra nos indicadores e relatórios. Pagamentos vindos do intercompany contam como receita. ${cfg.analise ? 'As vendas e as comissões vêm diretamente do módulo de vendas.' : ''}</div></div>
        <div class="grid g2"><div class="card flush"><div class="card-h"><h3>Natureza das categorias</h3></div><div class="tbl-wrap"><table class="tbl"><tbody>
          ${db.categorias.map(ct => `<tr><td><b style="font-size:13px">${esc(ct)}</b></td><td><select class="inp inp-sm" data-cls="${esc(ct)}" ${can('admin') ? '' : 'disabled'}>${Object.entries(CLASSES).map(([k, l]) => `<option value="${k}" ${classeDe({ categoria: ct }) === k ? 'selected' : ''}>${l}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div></div>
        <div class="stack"><div class="card"><div class="card-h"><h3>Parâmetros</h3></div><div class="form">
            <div class="fld"><label>${kn('tax', 'Taxa de IRC (%)')}</label><input class="inp num" type="number" step="0.01" id="irc" value="${r2(f.irc * 100)}" ${can('admin') ? '' : 'disabled'}></div>
            <div class="fld"><label>${kn('da', 'Vida útil dos ativos (anos)')}</label><input class="inp num" type="number" min="1" max="50" id="vu" value="${f.vidaUtil}" ${can('admin') ? '' : 'disabled'}></div></div></div>
          <div class="card"><div class="card-h"><h3>${kn('cash', 'Contas próprias')}</h3><span class="sub">a tesouraria da empresa</span></div><div class="stack" style="gap:6px">
            ${app.contasInternas(false).map(ct => `<label class="check"><input type="checkbox" data-own="${esc(ct.id)}" ${own.has(ct.id) ? 'checked' : ''} ${can('admin') ? '' : 'disabled'}> ${esc(ct.nome)} <span class="faint mono" style="font-size:11.5px">${esc(ct.categoria || '')}</span></label>`).join('')}</div></div>
          ${can('admin') ? `<div class="row" style="justify-content:flex-end"><button class="btn ghost" id="auto">Repor automático</button><button class="btn primary" id="gc">Guardar classificação</button></div>` : ''}</div></div>`;
      const gc = c.querySelector('#gc');
      if (gc) gc.onclick = () => { const cls = {}; c.querySelectorAll('[data-cls]').forEach(s => { if (s.value !== CLASSE_PADRAO(s.dataset.cls)) cls[s.dataset.cls] = s.value; });
        f.classes = cls; f.irc = Math.max(0, (+c.querySelector('#irc').value || 0) / 100); f.vidaUtil = Math.max(1, +c.querySelector('#vu').value || 5);
        f.contas = [...c.querySelectorAll('[data-own]:checked')].map(x => x.dataset.own);
        log('CLASSIFICACAO_FINANCEIRA', `IRC ${pct(f.irc)} · vida útil ${f.vidaUtil} anos · ${Object.keys(cls).length} categoria(s) personalizadas · ${f.contas.length} contas próprias`); save(); ui.toast('Classificação guardada', 'ok'); render(); };
      const au = c.querySelector('#auto'); if (au) au.onclick = () => { f.classes = {}; f.contas = null; log('CLASSIFICACAO_FINANCEIRA', 'Reposta a classificação automática'); save(); render(); };
    }
    const cb = v.querySelector('#csv'); if (cb) cb.onclick = () => SPAP.csv(`${tab}_${cfg.key}_${ano}.csv`, csv);
  } });

  /* ---------- Planeamento de investimentos ---------- */
  const npv = (taxa, inv, fl, res = 0) => -inv + fl.reduce((s, f, t) => s + f / Math.pow(1 + taxa, t + 1), 0) + res / Math.pow(1 + taxa, fl.length);
  const irr = (inv, fl, res = 0) => { let lo = -0.99, hi = 10; const fv = r => npv(r, inv, fl, res); if (fv(lo) * fv(hi) > 0) return null; for (let k = 0; k < 200; k++) { const mid = (lo + hi) / 2; if (fv(lo) * fv(mid) <= 0) hi = mid; else lo = mid; } return (lo + hi) / 2; };
  const payback = (inv, fl, taxa = null) => { let acc = 0; for (let t = 0; t < fl.length; t++) { const f = taxa == null ? fl[t] : fl[t] / Math.pow(1 + taxa, t + 1); if (acc + f >= inv) return t + (f ? (inv - acc) / f : 0); acc += f; } return null; };
  app.avaliarProjeto = (p, mult = 1, taxa = p.taxa) => { const fl = p.fluxos.map(x => x * mult), pv = fl.reduce((s, f, t) => s + f / Math.pow(1 + taxa, t + 1), 0) + p.residual / Math.pow(1 + taxa, fl.length);
    return { npv: npv(taxa, p.investimento, fl, p.residual), irr: irr(p.investimento, fl, p.residual), payback: payback(p.investimento, fl), dpayback: payback(p.investimento, fl, taxa),
      pi: p.investimento ? pv / p.investimento : null, roi: p.investimento ? (fl.reduce((a, b) => a + b, 0) + p.residual - p.investimento) / p.investimento : null }; };
  const anosTxt = v => v == null ? '<span class="neg">não recupera</span>' : `${(Math.round(v * 10) / 10).toLocaleString('pt-PT')} anos`;
  route('investimentos', { id: 'investimentos', title: 'Planeamento de investimentos', render(v, _a, params) {
    const lista = db.investimentos = db.investimentos || [];
    if (params[0]) return projeto(v, params[0] === 'novo' ? null : lista.find(x => x.id === params[0]));
    v.innerHTML = `<div class="row between" style="margin-bottom:16px"><div class="muted">Avalia projetos antes de investir: ${kn('npv', 'NPV')}, ${kn('irr', 'IRR')}, ${kn('payback', 'payback')} e cenários.</div>
      ${can('criar') ? `<a class="btn primary" href="#/investimentos/novo">${icon('plus')} Novo projeto</a>` : ''}</div>
      ${lista.length ? `<div class="grid g3">${lista.map(p => { const a = app.avaliarProjeto(p); return `<a class="card" href="#/investimentos/${p.id}" style="text-decoration:none;display:block">
        <div class="row between"><b style="font-size:16px">${esc(p.nome)}</b>${a.npv >= 0 ? '<span class="badge ok">Cria valor</span>' : '<span class="badge bad">Destrói valor</span>'}</div>
        <div class="muted" style="font-size:13px;margin:4px 0 12px">${eur(p.investimento)} · ${p.fluxos.length} anos · taxa ${pct(p.taxa)}${p.pedidoId ? ' · pedido submetido' : ''}</div>
        <div class="kv"><div><span>NPV</span><b class="num ${a.npv >= 0 ? 'pos' : 'neg'}">${eur(a.npv)}</b></div><div><span>IRR</span><b class="num">${fP(a.irr)}</b></div><div><span>Payback</span><b>${anosTxt(a.payback)}</b></div><div><span>PI</span><b class="num">${fX(a.pi)}</b></div></div></a>`; }).join('')}</div>`
      : `<div class="card empty">${icon('target')}<p>Ainda não há projetos de investimento.</p>${can('criar') ? '<a class="btn primary" href="#/investimentos/novo">Criar o primeiro projeto</a>' : ''}</div>`}`;
  } });
  function projeto(v, p0) {
    const novo = !p0, p = p0 ? JSON.parse(JSON.stringify(p0)) : { id: uid(), nome: 'Novo equipamento de som', descricao: '', investimento: 10000, taxa: 0.1, fluxos: [3000, 3500, 4000, 4000, 4000], residual: 1000, cenP: -0.2, cenO: 0.2 };
    app.setTitle(novo ? 'Novo projeto de investimento' : p.nome);
    v.innerHTML = `<div class="row" style="margin-bottom:14px"><a class="btn ghost sm" href="#/investimentos">← Projetos</a></div>
      <div class="grid g3"><div class="card"><div class="card-h"><h3>Pressupostos</h3></div><form class="stack" id="pf">
        <div class="fld"><label>Nome do projeto</label><input class="inp" name="nome" value="${esc(p.nome)}"></div>
        <div class="fld"><label>${kn('capexPlan', 'Investimento inicial (€)')}</label><input class="inp num" type="number" step="0.01" name="investimento" value="${p.investimento}"></div>
        <div class="fld"><label>${kn('wacc', 'Taxa de desconto (%)')}</label><input class="inp num" type="number" step="0.1" name="taxa" value="${r2(p.taxa * 100)}"></div>
        <div class="fld"><label>${kn('residual', 'Valor residual no fim (€)')}</label><input class="inp num" type="number" step="0.01" name="residual" value="${p.residual}"></div>
        <div class="fld"><label>${kn('cfPlan', 'Fluxos de caixa por ano (€)')}</label><div id="fl" class="stack" style="gap:6px"></div>
          <div class="row"><button type="button" class="btn sm" id="maisAno">${icon('plus')} Ano</button><button type="button" class="btn ghost sm" id="menosAno">Remover último</button></div></div>
        <details><summary class="muted" style="cursor:pointer;font-size:13.5px">Gerar fluxos automaticamente</summary><div class="form" style="margin-top:10px">
          <div class="fld"><label>Fluxo do ano 1 (€)</label><input class="inp num" type="number" id="g1" value="${p.fluxos[0] || 0}"></div><div class="fld"><label>Crescimento anual (%)</label><input class="inp num" type="number" step="0.1" id="gc" value="5"></div>
          <div class="fld"><label>Anos</label><input class="inp num" type="number" min="1" max="30" id="gn" value="${p.fluxos.length}"></div><div class="fld"><label>&nbsp;</label><button type="button" class="btn sm" id="gerar">Gerar</button></div></div></details>
        <div class="form"><div class="fld"><label>${kn('scen', 'Pessimista (%)')}</label><input class="inp num" type="number" step="1" name="cenP" value="${Math.round(p.cenP * 100)}"></div><div class="fld"><label>Otimista (%)</label><input class="inp num" type="number" step="1" name="cenO" value="${Math.round(p.cenO * 100)}"></div></div>
        <div class="fld"><label>Notas</label><textarea class="inp" name="descricao">${esc(p.descricao || '')}</textarea></div></form></div>
        <div class="span2 stack"><div class="grid g3" id="res"></div>
          <div class="card"><div class="card-h"><h3>Fluxo acumulado</h3><span class="sub">simples e descontado</span></div><div id="ch"></div></div>
          <div class="grid g2"><div class="card flush"><div class="card-h"><h3>${kn('scen', 'Cenários')}</h3></div><div id="cen"></div></div><div class="card flush"><div class="card-h"><h3>${kn('sens', 'Sensibilidade do NPV')}</h3><span class="sub">taxa × variação dos fluxos</span></div><div class="tbl-wrap" id="sens"></div></div></div>
          <div class="row" style="justify-content:flex-end">${!novo && can('admin') ? `<button class="btn bad" id="apagar">${icon('trash')} Eliminar</button>` : ''}${can('criar') ? `<button class="btn" id="pedido">${icon('shield')} Submeter pedido de investimento</button><button class="btn primary" id="guardar">Guardar projeto</button>` : ''}</div></div></div>`;
    const pf = v.querySelector('#pf');
    const desenharFluxos = () => { v.querySelector('#fl').innerHTML = p.fluxos.map((f, t) => `<div class="row" style="flex-wrap:nowrap"><span class="mono muted" style="width:52px;font-size:12.5px">Ano ${t + 1}</span><input class="inp num" type="number" step="0.01" data-f="${t}" value="${f}"></div>`).join('');
      v.querySelectorAll('[data-f]').forEach(i => i.addEventListener('input', () => { p.fluxos[+i.dataset.f] = +i.value || 0; calc(); })); };
    const ler = () => { const f = ui.formData(pf); p.nome = f.nome; p.investimento = +f.investimento || 0; p.taxa = (+f.taxa || 0) / 100; p.residual = +f.residual || 0; p.cenP = (+f.cenP || 0) / 100; p.cenO = (+f.cenO || 0) / 100; p.descricao = f.descricao; };
    const calc = () => { ler(); const a = app.avaliarProjeto(p);
      v.querySelector('#res').innerHTML = kpiC('npv', `<span class="${a.npv >= 0 ? 'pos' : 'neg'}">${eur(a.npv)}</span>`, a.npv >= 0 ? 'o projeto cria valor' : 'o projeto destrói valor', true) + kpiC('irr', fP(a.irr), a.irr != null ? (a.irr > p.taxa ? 'acima da taxa exigida' : 'abaixo da taxa exigida') : '')
        + kpiC('pi', fX(a.pi), a.pi != null ? (a.pi >= 1 ? 'cada € gera ' + eur(a.pi) : 'menos de 1 € por € investido') : '') + kpiC('payback', anosTxt(a.payback)) + kpiC('dpayback', anosTxt(a.dpayback)) + kpiC('projroi', fP(a.roi));
      let acc = -p.investimento, accD = -p.investimento; const s1 = [acc], s2 = [accD];
      p.fluxos.forEach((f, t) => { acc += f + (t === p.fluxos.length - 1 ? p.residual : 0); accD += (f + (t === p.fluxos.length - 1 ? p.residual : 0)) / Math.pow(1 + p.taxa, t + 1); s1.push(r2(acc)); s2.push(r2(accD)); });
      SPAP.chart.linha(v.querySelector('#ch'), { labels: ['Ano 0', ...p.fluxos.map((_, t) => 'Ano ' + (t + 1))], series: [{ name: 'Acumulado simples', values: s1, color: 'var(--accent)' }, { name: 'Acumulado descontado', values: s2, color: 'var(--accent2)' }, { name: 'Zero', values: s1.map(() => 0), color: 'var(--faint)', dash: true }] });
      const cen = [['Pessimista', 1 + p.cenP], ['Base', 1], ['Otimista', 1 + p.cenO]].map(([n, m]) => ({ n, m, a: app.avaliarProjeto(p, m) }));
      v.querySelector('#cen').innerHTML = `<table class="tbl"><thead><tr><th>Cenário</th><th class="r">Fluxos</th><th class="r">NPV</th><th class="r">IRR</th><th class="r">Payback</th></tr></thead><tbody>${cen.map(x => `<tr><td><b>${x.n}</b></td><td class="r">${x.m === 1 ? '—' : (x.m > 1 ? '+' : '') + Math.round((x.m - 1) * 100) + '%'}</td><td class="r num ${x.a.npv >= 0 ? 'pos' : 'neg'}">${eur(x.a.npv)}</td><td class="r num">${fP(x.a.irr)}</td><td class="r">${anosTxt(x.a.payback)}</td></tr>`).join('')}</tbody></table>`;
      const taxas = [-0.04, -0.02, 0, 0.02, 0.04].map(d => Math.max(0, p.taxa + d)), vars = [-0.2, -0.1, 0, 0.1, 0.2];
      v.querySelector('#sens').innerHTML = `<table class="tbl sens"><thead><tr><th>Taxa \\ fluxos</th>${vars.map(x => `<th class="r">${x > 0 ? '+' : ''}${Math.round(x * 100)}%</th>`).join('')}</tr></thead><tbody>${taxas.map(t => `<tr><td class="mono">${pct(t)}</td>${vars.map(x => { const n = app.avaliarProjeto(p, 1 + x, t).npv; return `<td class="r num ${n >= 0 ? 'pos' : 'neg'}" style="${t === p.taxa && x === 0 ? 'font-weight:800;outline:1px solid var(--line2)' : ''}">${eur(n)}</td>`; }).join('')}</tr>`).join('')}</tbody></table>`; };
    pf.querySelectorAll('input,textarea').forEach(i => i.addEventListener('input', calc));
    v.querySelector('#maisAno').onclick = () => { p.fluxos.push(p.fluxos[p.fluxos.length - 1] || 0); desenharFluxos(); calc(); };
    v.querySelector('#menosAno').onclick = () => { if (p.fluxos.length > 1) { p.fluxos.pop(); desenharFluxos(); calc(); } };
    v.querySelector('#gerar').onclick = () => { const f1 = +v.querySelector('#g1').value || 0, g = (+v.querySelector('#gc').value || 0) / 100, n = Math.max(1, Math.min(30, +v.querySelector('#gn').value || 1)); p.fluxos = Array.from({ length: n }, (_, t) => r2(f1 * Math.pow(1 + g, t))); desenharFluxos(); calc(); };
    const guardar = () => { ler(); if (!p.nome) { ui.toast('Indica o nome do projeto', 'warn'); return false; }
      const l = db.investimentos = db.investimentos || []; const i = l.findIndex(x => x.id === p.id); const a = app.avaliarProjeto(p);
      const reg = { ...p, atualizadoEm: new Date().toISOString(), atualizadoPor: app.user.id }; if (i >= 0) l[i] = reg; else l.push({ ...reg, criadoEm: reg.atualizadoEm, criadoPor: app.user.id });
      log('PROJETO_INVESTIMENTO', `${p.nome} · ${eur(p.investimento)} · NPV ${eur(a.npv)} · IRR ${a.irr == null ? 'n.d.' : pct(a.irr)}`); save(); return true; };
    const g = v.querySelector('#guardar'); if (g) g.onclick = () => { if (guardar()) { ui.toast('Projeto guardado', 'ok'); app.go('investimentos/' + p.id); } };
    const pd = v.querySelector('#pedido'); if (pd) pd.onclick = () => { if (!guardar()) return; const a = app.avaliarProjeto(p);
      const cat = ['AQUISIÇÃO DE EQUIPAMENTO', 'APLICAÇÃO / INVESTIMENTO', 'AQUISIÇÃO DE BENS E SERVIÇOS'].find(x => db.categorias.includes(x)) || db.categorias[0];
      app.novoPedido({ categoria: cat, valor: p.investimento, descricao: `Investimento «${p.nome}» · NPV ${eur(a.npv)} · IRR ${a.irr == null ? 'n.d.' : pct(a.irr)} · payback ${a.payback == null ? 'n.d.' : (Math.round(a.payback * 10) / 10) + ' anos'}`,
        onCreate: cr => { const x = (db.investimentos || []).find(y => y.id === p.id); if (x) { x.pedidoId = cr[0].id; save(); } } }); };
    const ap = v.querySelector('#apagar'); if (ap) ap.onclick = async () => { if (!await ui.confirm('Eliminar projeto', `Eliminar o projeto «${esc(p.nome)}»?`, { danger: true, okLabel: 'Eliminar' })) return;
      db.investimentos = db.investimentos.filter(x => x.id !== p.id); log('PROJETO_INVESTIMENTO_ELIMINADO', p.nome); save(); app.go('investimentos'); };
    desenharFluxos(); calc();
  }

  /* links com data-aba="chave=valor" abrem o separador indicado */
  document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a[data-aba]'); if (!a) return;
    const [k, val] = a.dataset.aba.split('='); try { sessionStorage.setItem(KEY + ':' + k, val); } catch (er) { }
    if (location.hash === a.getAttribute('href')) { e.preventDefault(); render(); } });

  /* ---------- Arranque ---------- */
  app.start = () => {
    applyTheme(); load();
    document.title = cfg.nome + ' · Gestão';
    let sid = null; try { sid = sessionStorage.getItem(SESSION); } catch (e) { }
    const u = sid && userById(sid);
    if (u && u.ativo !== false && u.pinHash) app.user = u;
    window.addEventListener('hashchange', render);
    ['mousemove', 'keydown', 'click', 'touchstart'].forEach(ev => document.addEventListener(ev, () => lastActive = Date.now(), { passive: true }));
    setInterval(() => { if (app.user && Date.now() - lastActive > (db.settings.autoLockMin || 10) * 60000) logout('inatividade'); }, 20000);
    window.addEventListener('storage', e => { if (e.key === KEY) { load(); if (app.user) app.user = userById(app.user.id); render(); } });
    render();
  };
  return app;
};
})(window);
