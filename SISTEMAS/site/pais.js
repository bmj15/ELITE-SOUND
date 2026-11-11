/* pais.js — país do visitante. O endereço público leva sempre o país: /pt-br/... (Brasil) ou /pt-pt/... (Portugal).
   Ordem: prefixo no endereço → ?pais=br|pt → escolha guardada neste navegador (bxb:pais) → fuso horário (Portugal) → Brasil por omissão.
   Carregar no <head>, antes de artigos.js, ajuda.js e site.js. */
(function () {
  'use strict';
  var PAGS = /^\/(particulares|empresas|artigos|ajuda|simuladores)?(\/|$)/; // páginas do site público (servidas também com prefixo)
  var m = location.pathname.match(/^\/pt-(br|pt)(?=\/|$)/);
  var caminho = m ? (location.pathname.slice(m[0].length) || '/') : location.pathname;
  var publica = PAGS.test(caminho);
  var q = (location.search.match(/[?&]pais=(br|pt)(?:&|$)/) || [])[1], p = m ? m[1] : q;
  try { if (p) localStorage.setItem('bxb:pais', p); else p = localStorage.getItem('bxb:pais'); } catch (e) { }
  if (p !== 'br' && p !== 'pt') {
    var tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { }
    p = /^(Europe\/Lisbon|Atlantic\/Madeira|Atlantic\/Azores)$/.test(tz) ? 'pt' : 'br';
  }
  var br = p === 'br', pref = '/pt-' + p;
  var com = function (c) { return pref + (c === '/' ? '' : c); }; // caminho sem prefixo → com o prefixo do país
  // mostrar o país no endereço (sem recarregar)
  if (publica) {
    var s = location.search.replace(/([?&])pais=(br|pt)(&|$)/, function (x, a, b, d) { return d ? a : ''; }).replace(/^&/, '?');
    var novo = com(caminho) + s + location.hash;
    if (novo !== location.pathname + location.search + location.hash) try { history.replaceState(history.state, '', novo); } catch (e) { }
  }
  document.documentElement.dataset.pais = p;
  document.documentElement.lang = br ? 'pt-BR' : 'pt-PT';
  window.BXB_PAIS = p;
  window.BXB_CAMINHO = caminho; // caminho da página sem o prefixo do país (ex.: /artigos/x)
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
    if (!publica) return location.reload();
    location.href = '/pt-' + novo + (caminho === '/' ? '' : caminho) + location.search + location.hash;
  };
  // links internos do site público passam a levar o prefixo do país (antes de o navegador os seguir)
  var prefixar = function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[href]'); if (!a) return;
    var h = a.getAttribute('href'); if (!h || h.charAt(0) !== '/' || h.charAt(1) === '/' || /^\/pt-(br|pt)(\/|$|[?#])/.test(h)) return;
    var c = h.split(/[?#]/)[0]; if (!PAGS.test(c)) return;
    a.setAttribute('href', com(c) + h.slice(c.length));
  };
  ['pointerdown', 'focusin', 'click', 'auxclick', 'contextmenu'].forEach(function (t) { document.addEventListener(t, prefixar, true); });
})();
