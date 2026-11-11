/* pais.js — país do visitante: Brasil por omissão; Portugal quando o fuso horário do navegador é o de Portugal.
   A escolha feita na bandeira fica guardada neste navegador (bxb:pais). Também aceita ?pais=br ou ?pais=pt no endereço.
   Carregar no <head>, antes de artigos.js, ajuda.js e site.js. */
(function () {
  'use strict';
  var q = (location.search.match(/[?&]pais=(br|pt)(?:&|$)/) || [])[1], p = null;
  try { if (q) localStorage.setItem('bxb:pais', q); p = localStorage.getItem('bxb:pais'); } catch (e) { p = q || null; }
  if (p !== 'br' && p !== 'pt') {
    var tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { }
    p = /^(Europe\/Lisbon|Atlantic\/Madeira|Atlantic\/Azores)$/.test(tz) ? 'pt' : 'br';
  }
  var br = p === 'br';
  document.documentElement.dataset.pais = p;
  document.documentElement.lang = br ? 'pt-BR' : 'pt-PT';
  window.BXB_PAIS = p;
  // texto conforme o país: T('telemóvel', 'celular')
  window.BXB_T = function (pt, b) { return br ? b : pt; };
  // dinheiro: 1 234,56 € (Portugal) ou R$ 1.234,56 (Brasil)
  window.BXB_DIN = function (v, casas) {
    casas = casas == null ? 2 : casas;
    var n = Number(v || 0).toLocaleString(br ? 'pt-BR' : 'pt-PT', { minimumFractionDigits: casas, maximumFractionDigits: casas });
    return br ? 'R$ ' + n : n + ' €';
  };
  window.BXB_MOEDA = br ? 'R$' : '€';
  window.BXB_MUDAR_PAIS = function (novo) {
    try { localStorage.setItem('bxb:pais', novo); } catch (e) { }
    var u = new URL(location.href); if (!u.searchParams.has('pais')) return location.reload();
    u.searchParams.delete('pais'); location.replace(u.pathname + u.search + u.hash);
  };
})();
