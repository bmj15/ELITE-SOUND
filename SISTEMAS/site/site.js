/* site.js — cabeçalho, menus, pesquisa e rodapé do site público.
   Estrutura: barra de segmentos (Particulares / Empresas) · menu por temas com "Leituras úteis" · Entrar · pesquisa. */
(function () {
'use strict';
var SPRITE = "<svg width=\"0\" height=\"0\" style=\"position:absolute\" aria-hidden=\"true\">\n  <symbol id=\"i-ok\" viewBox=\"0 0 24 24\"><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M20 6 9 17l-5-5\"/></symbol>\n  <symbol id=\"i-escudo\" viewBox=\"0 0 24 24\"><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z\"/><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" d=\"m9 12 2 2 4-4\"/></symbol>\n  <symbol id=\"i-chave\" viewBox=\"0 0 24 24\"><g fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"7.5\" cy=\"15.5\" r=\"5.5\"/><path d=\"m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3\"/></g></symbol>\n  <symbol id=\"i-cad\" viewBox=\"0 0 24 24\"><g fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"11\" width=\"18\" height=\"11\" rx=\"2\"/><path d=\"M7 11V7a5 5 0 0 1 10 0v4\"/></g></symbol>\n  <symbol id=\"i-copia\" viewBox=\"0 0 24 24\"><g fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M21 12a9 9 0 1 1-3-6.7L21 8\"/><path d=\"M21 3v5h-5\"/></g></symbol>\n  <symbol id=\"i-graf\" viewBox=\"0 0 24 24\"><g fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 3v18h18\"/><path d=\"m7 15 4-4 3 3 5-6\"/></g></symbol>\n  <symbol id=\"i-cartao\" viewBox=\"0 0 24 24\"><g fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"2\" y=\"5\" width=\"20\" height=\"14\" rx=\"2\"/><path d=\"M2 10h20M6 15h4\"/></g></symbol>\n  <symbol id=\"i-alvo\" viewBox=\"0 0 24 24\"><g fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><circle cx=\"12\" cy=\"12\" r=\"5\"/><circle cx=\"12\" cy=\"12\" r=\"1.5\" fill=\"currentColor\"/></g></symbol>\n  <symbol id=\"i-pessoas\" viewBox=\"0 0 24 24\"><g fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2\"/><circle cx=\"9\" cy=\"7\" r=\"4\"/><path d=\"M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75\"/></g></symbol>\n  <symbol id=\"i-doc\" viewBox=\"0 0 24 24\"><g fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"/><path d=\"M14 2v6h6M8 13h8M8 17h5\"/></g></symbol>\n  <symbol id=\"i-recibo\" viewBox=\"0 0 24 24\"><g fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 2v20l3-2 3 2 2-2 2 2 3-2 3 2V2l-3 2-3-2-2 2-2-2-3 2z\"/><path d=\"M8 9h8M8 13h6\"/></g></symbol>\n  <symbol id=\"i-carteira\" viewBox=\"0 0 24 24\"><g fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20 12V8H6a2 2 0 0 1 0-4h12v4\"/><path d=\"M4 6v12a2 2 0 0 0 2 2h14v-4\"/><path d=\"M18 12a2 2 0 0 0 0 4h4v-4z\"/></g></symbol>\n  <symbol id=\"i-carrinho\" viewBox=\"0 0 24 24\"><g fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"9\" cy=\"21\" r=\"1\"/><circle cx=\"20\" cy=\"21\" r=\"1\"/><path d=\"M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6\"/></g></symbol>\n  <symbol id=\"i-lista\" viewBox=\"0 0 24 24\"><g fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"><path d=\"M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01\"/></g></symbol>\n  <symbol id=\"i-olho\" viewBox=\"0 0 24 24\"><g fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M17.9 17.9A10 10 0 0 1 12 20C5 20 1 12 1 12a18 18 0 0 1 5.1-5.9M9.9 4.2A9 9 0 0 1 12 4c7 0 11 8 11 8a18 18 0 0 1-2.2 3.2M1 1l22 22\"/></g></symbol>\n  <symbol id=\"i-seta\" viewBox=\"0 0 24 24\"><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M5 12h14M13 6l6 6-6 6\"/></symbol>\n  <symbol id=\"i-casa\" viewBox=\"0 0 24 24\"><g fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\"/><path d=\"M9 22V12h6v10\"/></g></symbol>\n  <symbol id=\"i-livro\" viewBox=\"0 0 24 24\"><g fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M2 4h7a3 3 0 0 1 3 3v14a2 2 0 0 0-2-2H2zM22 4h-7a3 3 0 0 0-3 3v14a2 2 0 0 1 2-2h8z\"/></g></symbol>\n  <symbol id=\"i-euro\" viewBox=\"0 0 24 24\"><g fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 6a7 7 0 1 0 0 12\"/><path d=\"M4 10h10M4 14h10\"/></g></symbol>\n  <symbol id=\"i-lupa\" viewBox=\"0 0 24 24\"><g fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"11\" cy=\"11\" r=\"7\"/><path d=\"m20 20-4-4\"/></g></symbol>\n  <symbol id=\"i-ajuda\" viewBox=\"0 0 24 24\"><g fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3\"/><path d=\"M12 17h.01\"/></g></symbol>\n  <symbol id=\"i-calc\" viewBox=\"0 0 24 24\"><g fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"4\" y=\"2\" width=\"16\" height=\"20\" rx=\"2\"/><path d=\"M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h4\"/></g></symbol>\n  <symbol id=\"i-user\" viewBox=\"0 0 24 24\"><g fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"8\" r=\"4\"/><path d=\"M4 21a8 8 0 0 1 16 0\"/></g></symbol>\n</svg>";
var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (x) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x]; }); };
var ic = function (id, t) { return '<svg width="' + (t || 18) + '" height="' + (t || 18) + '"><use href="#' + id + '"/></svg>'; };
var pagina = document.body.dataset.pagina || '';
var pais = window.BXB_PAIS || 'pt', T = window.BXB_T || function (a) { return a; };
var ss = function (k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { return null; } };
// segmento: pela página (/empresas) ou pelo último visitado
var cam = window.BXB_CAMINHO || location.pathname;
var seg = document.body.dataset.seg || (/^\/empresas/.test(cam) ? 'empresa' : /^\/(particulares)?$/.test(cam) ? 'particular' : ss('bxb:seg') || 'particular');
ss('bxb:seg', seg); document.body.classList.toggle('emp', seg === 'empresa');
var casa = seg === 'empresa' ? '/empresas' : '/';

// submenus: só o que abre uma ferramenta ou um guia (nada de links que apenas fazem scroll na página inicial)
// fer: simuladores · grupos: guias por tema · dest: artigo em destaque (com fotografia)
var A_ = '/artigos/';
var SUB = {
  particular: {
    fer: [['/simuladores#emergencia', 'i-escudo', T('Fundo de emergência', 'Reserva de emergência'), T('Quanto ter de parte', 'Quanto ter guardado')],
      ['/simuladores#divida', 'i-cartao', 'Prazo de uma dívida', T('Quando fica paga e quanto custa', 'Quando fica quitada e quanto custa')],
      ['/simuladores#objetivo', 'i-alvo', T('Objetivo de poupança', 'Objetivo de economia'), T('Quanto poupar por mês', 'Quanto guardar por mês')]],
    grupos: [['Dívidas e crédito', T([['por-qual-divida-comecar', 'Por qual dívida começar'], ['tan-taeg-mtic', 'TAN, TAEG e MTIC'], ['cartao-de-credito-pagamento-minimo', 'Cartão: o custo do mínimo']],
        [['varias-dividas-por-onde-comecar', 'Por qual dívida começar'], ['juros-e-cet', 'Juros e CET'], ['rotativo-do-cartao', 'O custo do rotativo']])],
      ['Impostos', T([['deducoes-irs-e-fatura', 'Deduções no IRS'], ['recibos-verdes-sem-surpresas', 'Recibos verdes']], [['imposto-de-renda-deducoes', 'Deduções no Imposto de Renda'], ['mei-ou-autonomo', 'MEI ou autônomo']])],
      ['Casa e família', T([['despesas-partilhadas-a-dois', 'Despesas a dois'], ['proteger-a-sua-conta', 'Proteger as suas contas']], [['despesas-compartilhadas-a-dois', 'Despesas a dois'], ['proteger-suas-contas', 'Proteger suas contas']])]],
    dest: T('fundo-de-emergencia', 'reserva-de-emergencia')
  },
  empresa: {
    fer: [['/simuladores#pmr', 'i-carteira', T('Prazo médio de recebimentos', 'Prazo médio de recebimento'), T('Quanta tesouraria fica presa', 'Quanto caixa fica preso')],
      ['/simuladores#margem', 'i-carrinho', 'Preço e margem', T('O preço para a margem que pretende', 'O preço para a margem que você quer')]],
    grupos: [['Pagamentos', T([['dupla-aprovacao-pagamentos', 'Dupla aprovação de pagamentos'], ['proteger-a-sua-conta', 'Burlas e fraudes online']], [['dupla-aprovacao-pix-e-boleto', 'Dupla aprovação: Pix e boleto'], ['proteger-suas-contas', 'Golpes online']])],
      [T('Tesouraria', 'Fluxo de caixa'), T([['tesouraria-pme-13-semanas', 'Previsão a 13 semanas']], [['fluxo-de-caixa-13-semanas', 'Previsão de 13 semanas']])]],
    dest: T('tesouraria-pme-13-semanas', 'fluxo-de-caixa-13-semanas')
  }
};
var artigosDe = function (cats) { var A = window.ARTIGOS || []; return A.filter(function (a) { return cats.indexOf(a.cat) >= 0; }).sort(function (a, b) { return b.data.localeCompare(a.data); }).slice(0, 3); };
var ENT = '/SISTEMAS/entrar.html', abrir = ENT + '?criar=1&tipo=' + seg;

var fora = pagina === 'artigos' || pagina === 'ajuda' || pagina === 'simuladores';
var chev = '<svg width="12" height="12" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" d="m6 9 6 6 6-6"/></svg>';
var lsg = function (href, txt, on) { return '<a href="' + href + '"' + (on ? ' class="on"' : '') + '>' + txt + '</a>'; };
var lsd = function (href, txt, on, k) { return '<a href="' + href + '" data-sd="' + k + '" aria-haspopup="true"' + (on ? ' class="on"' : '') + '>' + txt + chev + '</a>'; };
var segs = lsd('/', 'Particulares', seg === 'particular' && !fora, 'particular') + lsd('/empresas', 'Empresas', seg === 'empresa' && !fora, 'empresa') + lsg('/artigos', 'Artigos', pagina === 'artigos') + lsg('/simuladores', 'Simuladores', pagina === 'simuladores') + lsg('/ajuda', 'Ajuda', pagina === 'ajuda');
var BAND = {
  br: '<svg viewBox="0 0 28 20" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="28" height="20" fill="#009c3b"/><path d="M14 2.4 25.6 10 14 17.6 2.4 10z" fill="#ffdf00"/><circle cx="14" cy="10" r="4.7" fill="#002776"/><path d="M9.5 9.2c3-.7 6.2-.2 9 1.3" stroke="#fff" stroke-width="1" fill="none"/></svg>',
  pt: '<svg viewBox="0 0 30 20" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="30" height="20" fill="#da291c"/><rect width="12" height="20" fill="#046a38"/><circle cx="12" cy="10" r="4.4" fill="none" stroke="#ffe900" stroke-width="1.5"/><path d="M10.3 7.7h3.4v3.3a1.7 1.7 0 0 1-3.4 0z" fill="#fff" stroke="#da291c" stroke-width=".7"/></svg>'
};
var NOME_P = { br: 'Brasil', pt: 'Portugal' };
var paisB = '<div class="pais-w" id="paisW"><button type="button" class="pais-b" id="bPais" aria-label="País: ' + NOME_P[pais] + '. Mudar de país" aria-haspopup="true">' + BAND[pais] + '</button>' +
  '<div class="pais-m" id="mPais" role="menu"><h6>' + T('Escolha o país', 'Escolha o país') + '</h6>' + ['br', 'pt'].map(function (k) { return '<button type="button" role="menuitemradio" aria-checked="' + (k === pais) + '" data-pais="' + k + '"' + (k === pais ? ' class="on"' : '') + '><i>' + BAND[k] + '</i><span><b>' + NOME_P[k] + '</b><small>' + (k === 'br' ? 'Real · R$' : 'Euro · €') + '</small></span>' + (k === pais ? '<svg class="ok" width="16" height="16" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" d="m5 12 5 5 9-10"/></svg>' : '') + '</button>'; }).join('') + '</div></div>';
var dropEnt = '<div class="drop-ent" id="dropEnt"><h6>Entrar na sua área</h6>' +
  '<a class="op" href="' + ENT + '?tipo=particular"><i>' + ic('i-casa', 18) + '</i><div><b>Particulares</b><span>Plano pessoal e partilhas</span></div></a>' +
  '<a class="op" href="' + ENT + '?tipo=empresa"><i>' + ic('i-carteira', 18) + '</i><div><b>Empresas</b><span>' + T('Pagamentos, tesouraria e equipa', 'Pagamentos, fluxo de caixa e equipe') + '</span></div></a>' +
  '<div class="rod-d">Ainda não é cliente? <a href="' + abrir + '">Abrir conta</a></div></div>';
var acoes = '<div class="acoes" id="acoes"><button class="btn btn-o" type="button" id="bEnt">' + ic('i-cad', 16) + 'Entrar' + chev + '</button><a class="btn btn-p" href="' + abrir + '" data-abr>Abrir conta</a>' + dropEnt + '</div>';
var subM = ['particular', 'empresa'].map(function (k) {
  var L = SUB[k], d = (window.ARTIGOS || []).filter(function (x) { return x.id === L.dest; })[0];
  var col = function (tit, itens) { return '<div class="sub-col"><b>' + tit + '</b>' + itens.join('') + '</div>'; };
  return '<div class="sub-m" data-sm="' + k + '"><div class="wrap"><a class="sub-ir" href="' + (k === 'empresa' ? '/empresas' : '/') + '">' + (k === 'empresa' ? 'Página de Empresas' : 'Página de Particulares') + ' ›</a><div class="sub-cols">' +
    col('Simuladores', L.fer.map(function (x) { return '<a href="' + x[0] + '">' + x[2] + '</a>'; }).concat('<a class="ver" href="/simuladores">Todos os simuladores ›</a>')) +
    L.grupos.map(function (g, i) { var it = g[1].map(function (x) { return '<a href="' + A_ + x[0] + '">' + x[1] + '</a>'; });
      if (i === L.grupos.length - 1) it.push('<a class="ver" href="/artigos' + (k === 'empresa' ? '?c=empresas' : '') + '">Todos os artigos ›</a>');
      return col(g[0], it); }).join('') + '</div>' +
    (d ? '<a class="sub-d" href="' + A_ + d.id + '">' + (window.capaArtigo ? capaArtigo(d, '280px') : '') + '<span class="tg">Em destaque · ' + d.min + ' min</span><b>' + esc(d.titulo) + '</b></a>' : '') +
    '</div></div>';
}).join('');
var menuM = '<div class="menu-m" id="menuM"><div class="sg">' + lsg('/', 'Particulares', seg === 'particular') + lsg('/empresas', 'Empresas', seg === 'empresa') + '</div>' +
  '<details open><summary>Simuladores</summary>' + SUB[seg].fer.map(function (x) { return '<a href="' + x[0] + '">' + x[2] + '</a>'; }).join('') + '</details>' +
  '<details><summary>Guias</summary>' + SUB[seg].grupos.map(function (g) { return g[1].map(function (x) { return '<a href="' + A_ + x[0] + '">' + x[1] + '</a>'; }).join(''); }).join('') + '</details>' +
  '<a class="lk" href="/artigos">Artigos</a><a class="lk" href="/simuladores">Simuladores</a><a class="lk" href="/ajuda">Ajuda</a>' +
  '<div class="bts" id="btsM"><a class="btn btn-s" href="' + ENT + '?tipo=' + seg + '" data-ent>Entrar</a><a class="btn btn-p" href="' + abrir + '" data-abr>Abrir conta</a></div></div>';
var avisoFechado = false; try { avisoFechado = localStorage.getItem('bxb:aviso') === 'simuladores-1'; } catch (e) { }
var aviso = avisoFechado ? '' : '<div class="aviso" id="aviso"><div class="wrap"><span class="et">Novidade</span><p>' + T('Já pode simular o prazo de uma dívida, o fundo de emergência e a tesouraria da empresa, sem registo.', 'Agora você pode simular o prazo de uma dívida, a reserva de emergência e o fluxo de caixa da empresa, sem cadastro.') + ' <a href="/simuladores">Experimentar</a></p><button type="button" id="avisoF" aria-label="Fechar aviso">×</button></div></div>';
var cab = aviso + '<header class="nav" id="nav"><div class="wrap barra"><a class="marca" href="' + casa + '"><b>BXB</b>BXB</a><nav class="segs">' + segs + '</nav>' +
  '<button type="button" class="eu-quero" id="bPesq" aria-label="Pesquisar">' + ic('i-lupa', 17) + '<span>Eu quero…</span></button>' + acoes +
  '<a class="ent-m" id="entM" href="' + ENT + '?tipo=' + seg + '" data-ent>' + ic('i-cad', 15) + '<span>Entrar</span></a>' + paisB + '<button class="ic-m pq" id="bPesqM" aria-label="Pesquisar">' + ic('i-lupa', 19) + '</button><button class="ic-m" id="hamb" aria-label="Menu"><svg width="20" height="20" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M3 6h18M3 12h18M3 18h18"/></svg></button></div>' +
  subM + menuM + '</header>';

var col = function (t, l) { return '<div><h4>' + t + '</h4><ul>' + l.map(function (x) { return '<li><a href="' + x[0] + '">' + x[1] + '</a></li>'; }).join('') + '</ul></div>'; };
var rod = '<footer><div class="wrap">' +
  '<div class="rod-topo"><a class="marca" href="' + casa + '"><b>BXB</b>BXB</a></div>' +
  '<div class="g">' +
  col('Particulares', [['/#plano', 'Plano pessoal'], ['/#dividas', 'Sair das dívidas'], ['/#objetivos', 'Objetivos de poupança'], ['/artigos?c=impostos', T('Recibos e IRS', 'Imposto de Renda')], ['/#partilhar', T('Despesas partilhadas', 'Despesas compartilhadas')]]) +
  col('Empresas', [['/empresas#pagamentos', 'Autorização de pagamentos'], ['/empresas#tesouraria', T('Tesouraria', 'Fluxo de caixa')], ['/empresas#resultados', 'Vendas e resultados'], ['/empresas#equipa', T('Equipa', 'Equipe')]]) +
  col('Ferramentas', [['/simuladores', 'Simuladores'], ['/artigos', 'Artigos'], ['/ajuda', 'Centro de ajuda'], [T('/artigos/proteger-a-sua-conta', '/artigos/proteger-suas-contas'), 'Segurança online']]) +
  col('Área de cliente', [[ENT + '?tipo=particular', 'Particulares'], [ENT + '?tipo=empresa', 'Empresas'], [abrir, 'Abrir conta'], ['/SISTEMAS/conta.html', T('A minha conta', 'Minha conta')]]) +
  '</div><div class="base"><span>© ' + new Date().getFullYear() + ' BXB · ' + T('Planeamento financeiro e tesouraria', 'Planejamento financeiro e fluxo de caixa') + ' · ' + NOME_P[pais] + '</span><span>' + T('A BXB nunca pede a palavra-passe ou o PIN por email, SMS ou telefone.', 'A BXB nunca pede a senha ou o PIN por e-mail, SMS, WhatsApp ou telefone.') + '</span></div></div></footer>';
var pesq = '<div class="pesq" id="pesq" role="dialog" aria-label="Pesquisar"><div class="cx"><div class="lin">' + ic('i-lupa', 20) + '<input id="pesqI" placeholder="O que procura?" autocomplete="off"><button class="fechar" type="button" id="pesqF">Esc</button></div><div class="res" id="pesqR"></div></div></div>';

document.body.insertAdjacentHTML('afterbegin', SPRITE + cab);
document.body.insertAdjacentHTML('beforeend', rod + pesq);

// menus
var nav = document.getElementById('nav'), mm = document.getElementById('menuM'), dEnt = document.getElementById('dropEnt');
function fechar() { document.querySelectorAll('.painel.on,[data-m].on,.pais-m.on').forEach(function (e) { e.classList.remove('on'); }); dEnt.classList.remove('on'); abrirSub(null); }
var tSub = null;
function abrirSub(k) { clearTimeout(tSub);
  document.querySelectorAll('.sub-m').forEach(function (p) { p.classList.toggle('on', p.dataset.sm === k); });
  document.querySelectorAll('[data-sd]').forEach(function (a) { var on = a.dataset.sd === k; a.classList.toggle('ab', on); a.setAttribute('aria-expanded', on); }); }
function fecharSub(ms) { clearTimeout(tSub); tSub = setTimeout(function () { abrirSub(null); }, ms || 0); }
document.querySelectorAll('[data-sd]').forEach(function (a) {
  a.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'mouse') return; if (!matchMedia('(hover:hover) and (pointer:fine)').matches) return; if (!a.classList.contains('ab')) { document.querySelectorAll('.pais-m.on').forEach(function (e) { e.classList.remove('on'); }); dEnt.classList.remove('on'); } abrirSub(a.dataset.sd); });
  a.addEventListener('mouseleave', function () { if (matchMedia('(hover:hover) and (pointer:fine)').matches) fecharSub(220); });
  // ecrã tátil: tocar abre ou fecha o menu (nunca salta para a página; o menu tem a ligação para ela)
  a.addEventListener('click', function (e) { if (e.pointerType === 'touch' || e.pointerType === 'pen' || !matchMedia('(hover:hover) and (pointer:fine)').matches) { e.preventDefault(); e.stopPropagation();
    if (a.classList.contains('ab')) { abrirSub(null); return; } document.querySelectorAll('.pais-m.on').forEach(function (x) { x.classList.remove('on'); }); dEnt.classList.remove('on'); abrirSub(a.dataset.sd); } });
  a.addEventListener('keydown', function (e) { if (e.key === 'ArrowDown') { e.preventDefault(); abrirSub(a.dataset.sd); var l = document.querySelector('.sub-m.on a'); if (l) l.focus(); } });
});
document.querySelectorAll('.sub-m').forEach(function (p) {
  p.addEventListener('mouseenter', function () { clearTimeout(tSub); });
  p.addEventListener('mouseleave', function () { fecharSub(220); });
  p.addEventListener('focusout', function (e) { var r = e.relatedTarget; if (!r || (!p.contains(r) && !(r.dataset && r.dataset.sd))) fecharSub(0); });
});
addEventListener('wheel', function () { if (document.querySelector('.sub-m.on')) fecharSub(0); }, { passive: true });
document.querySelectorAll('[data-m]').forEach(function (b) {
  b.onclick = function (e) { e.stopPropagation(); var on = b.classList.contains('on'); fechar(); if (!on) { b.classList.add('on'); document.querySelector('[data-p-m="' + b.dataset.m + '"]').classList.add('on'); } };
});
var mP = document.getElementById('mPais');
document.getElementById('bPais').onclick = function (e) { e.stopPropagation(); var on = mP.classList.contains('on'); fechar(); if (!on) mP.classList.add('on'); };
mP.onclick = function (e) { var b = e.target.closest('[data-pais]'); if (!b) return; if (b.dataset.pais === pais) return fechar(); if (window.BXB_MUDAR_PAIS) BXB_MUDAR_PAIS(b.dataset.pais); };
document.getElementById('bEnt').onclick = function (e) { e.stopPropagation(); var on = dEnt.classList.contains('on'); fechar(); if (!on) dEnt.classList.add('on'); };
nav.addEventListener('click', function (e) { if (e.target.closest('.painel a,.sub-m a,.drop-ent a,.menu-m a')) { fechar(); mm.classList.remove('on'); } });
document.addEventListener('click', function (e) { if (!e.target.closest('.painel,.drop-ent,.pais-m')) fechar(); });
document.getElementById('hamb').onclick = function () { mm.classList.toggle('on'); };
addEventListener('keydown', function (e) { if (e.key === 'Escape') { fechar(); fecharPesq(); } });

// pesquisa (artigos, ajuda e páginas)
var P = document.getElementById('pesq'), PI = document.getElementById('pesqI'), PR = document.getElementById('pesqR');
var PAGS = [['/simuladores', 'Simuladores', T('Fundo de emergência, dívidas, poupança, margem e recebimentos', 'Reserva de emergência, dívidas, poupança, margem e recebimentos')], ['/ajuda', 'Centro de ajuda', 'Perguntas frequentes por tema'], ['/artigos', 'Artigos', 'Poupança, crédito, impostos e empresas'],
  [ENT + '?criar=1&tipo=particular', 'Abrir conta particular', 'Plano pessoal'], [ENT + '?criar=1&tipo=empresa', 'Abrir conta de empresa', T('Pagamentos, tesouraria e equipa', 'Pagamentos, fluxo de caixa e equipe')], [ENT, 'Entrar', T('Aceder à sua área', 'Acessar a sua área')]];
var norm = function (s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };
function carregarAjuda(cb) { if (window.AJUDA) return cb(); var s = document.createElement('script'); s.src = '/SISTEMAS/site/ajuda.js?v=4'; s.onload = cb; s.onerror = cb; document.head.appendChild(s); }
function pesquisar() {
  var q = norm(PI.value.trim());
  if (!q) { PR.innerHTML = '<h6>Pesquisas frequentes</h6><div class="chips">' + T(['IRS', 'Fundo de emergência', 'Cartão de crédito', 'Dupla aprovação', 'Palavra-passe', 'Tesouraria'], ['Imposto de Renda', 'Reserva de emergência', 'Cartão de crédito', 'Dupla aprovação', 'Senha', 'Fluxo de caixa']).map(function (c) { return '<button type="button">' + c + '</button>'; }).join('') + '</div>';
    PR.querySelectorAll('.chips button').forEach(function (b) { b.onclick = function () { PI.value = b.textContent; pesquisar(); PI.focus(); }; }); return; }
  var t = q.split(/\s+/), bate = function (s) { s = norm(s); return t.every(function (w) { return s.indexOf(w) >= 0; }); };
  var pg = PAGS.filter(function (p) { return bate(p[1] + ' ' + p[2]); }).slice(0, 4);
  var ar = (window.ARTIGOS || []).filter(function (a) { return bate(a.titulo + ' ' + a.resumo + ' ' + a.corpo.replace(/<[^>]+>/g, ' ')); }).slice(0, 6);
  var aj = (window.AJUDA || []).filter(function (x) { return bate(x.q + ' ' + x.r); }).slice(0, 6);
  var h = '';
  if (pg.length) h += '<h6>Páginas</h6>' + pg.map(function (p) { return '<a href="' + p[0] + '"><b>' + p[1] + '</b><span>' + p[2] + '</span></a>'; }).join('');
  if (aj.length) h += '<h6>Ajuda</h6>' + aj.map(function (x) { return '<a href="/ajuda?p=' + x.id + '"><b>' + esc(x.q) + '</b><span>' + esc(x.r.replace(/<[^>]+>/g, '').slice(0, 110)) + '…</span></a>'; }).join('');
  if (ar.length) h += '<h6>Artigos</h6>' + ar.map(function (a) { return '<a href="/artigos/' + a.id + '"><b>' + esc(a.titulo) + '</b><span>' + esc(a.resumo) + '</span></a>'; }).join('');
  PR.innerHTML = h || '<div class="vazio">Sem resultados para "' + esc(PI.value) + '". Experimente outras palavras ou veja o <a href="/ajuda" style="color:var(--roxo2)">centro de ajuda</a>.</div>';
}
function abrirPesq() { fechar(); mm.classList.remove('on'); P.classList.add('on'); carregarAjuda(pesquisar); setTimeout(function () { PI.focus(); }, 30); }
function fecharPesq() { P.classList.remove('on'); }
document.getElementById('bPesq').onclick = abrirPesq; document.getElementById('bPesqM').onclick = abrirPesq;
var avF = document.getElementById('avisoF'); if (avF) avF.onclick = function () { document.getElementById('aviso').remove(); try { localStorage.setItem('bxb:aviso', 'simuladores-1'); } catch (e) { } };
// botão Topo: aparece quando se chega ao fim da página (o rodapé fica à vista)
(function () {
  var b = document.createElement('button'); b.type = 'button'; b.className = 'ir-topo'; b.id = 'subir'; b.setAttribute('aria-label', 'Voltar ao topo da página');
  b.innerHTML = '<i><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M6 11l6-6 6 6"/></svg></i><span>Topo</span>';
  b.onclick = function () { scrollTo({ top: 0, behavior: 'smooth' }); };
  document.body.appendChild(b);
  var rodape = document.querySelector('footer'); if (!rodape) return;
  var ver = function () { b.classList.toggle('on', rodape.getBoundingClientRect().top < innerHeight - 40 && scrollY > 200); };
  addEventListener('scroll', ver, { passive: true }); addEventListener('resize', ver); ver();
  // barra do navegador por cima do fundo da página (tablets e telemóveis): o botão sobe o mesmo tanto
  var vv = window.visualViewport;
  if (vv) { var barra = function () { var t = vv.scale > 1.01 ? 0 : Math.max(0, Math.round(innerHeight - vv.height - vv.offsetTop)); b.style.setProperty('--barra-nav', Math.min(t, 140) + 'px'); };
    vv.addEventListener('resize', barra); vv.addEventListener('scroll', barra); barra(); }
})();
// rodapé no telemóvel: cada grupo de ligações abre e fecha
document.querySelectorAll('footer .g h4').forEach(function (h) { h.setAttribute('role', 'button'); h.tabIndex = 0; h.setAttribute('aria-expanded', 'false');
  var t = function () { var ab = h.parentElement.classList.toggle('ab'); h.setAttribute('aria-expanded', ab ? 'true' : 'false'); };
  h.onclick = t; h.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); t(); } }; });
document.getElementById('pesqF').onclick = fecharPesq;
P.onclick = function (e) { if (e.target === P) fecharPesq(); };
PI.oninput = pesquisar;
PI.onkeydown = function (e) { if (e.key === 'Enter') { var a = PR.querySelector('a'); if (a) location.href = a.href; } };
addEventListener('keydown', function (e) { if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); abrirPesq(); } });

// aparecer ao rolar (também para conteúdo acrescentado depois: Site.revelar())
var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('vis'); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -6% 0px' }) : null;
function revelar(raiz) { (raiz || document).querySelectorAll('.rv:not(.vis)').forEach(function (el) { if (io) io.observe(el); else el.classList.add('vis'); }); }
revelar();
document.querySelectorAll('[data-abr]').forEach(function (a) { if (!/tipo=/.test(a.getAttribute('href'))) a.href = abrir; });
document.querySelectorAll('[data-ent]').forEach(function (a) { if (!/tipo=/.test(a.getAttribute('href'))) a.href = ENT + '?tipo=' + seg; });

// com sessão iniciada: "A minha área"
fetch('/api/estado', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
  if (!j || !j.sessao) return; var nome = esc(String(j.sessao.nome || '').split(' ')[0]);
  document.getElementById('acoes').innerHTML = '<a class="btn btn-g" href="/SISTEMAS/conta.html">' + ic('i-user', 16) + nome + '</a><a class="btn btn-p" href="/SISTEMAS/index.html">A minha área</a>';
  var em = document.getElementById('entM'); if (em) { em.href = '/SISTEMAS/index.html'; em.innerHTML = ic('i-user', 15) + '<span>' + nome + '</span>'; em.removeAttribute('data-ent'); }
  document.getElementById('btsM').innerHTML = '<a class="btn btn-s" href="/SISTEMAS/conta.html">' + nome + '</a><a class="btn btn-p" href="/SISTEMAS/index.html">A minha área</a>';
  document.querySelectorAll('main [data-ent]').forEach(function (a) { a.href = '/SISTEMAS/index.html'; a.textContent = 'A minha área'; });
}).catch(function () { });
window.Site = { revelar: revelar, seg: seg, esc: esc, ic: ic, pais: pais, T: T, band: BAND };
})();

;(() => { const s=document.createElement('script');s.src='/SISTEMAS/site/acesso.js?v=3';document.body.appendChild(s); })();
