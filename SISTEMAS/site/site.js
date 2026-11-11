/* site.js — cabeçalho, menus, pesquisa e rodapé do site público.
   Estrutura: barra de segmentos (Particulares / Empresas) · menu por temas com "Leituras úteis" · Entrar · pesquisa. */
(function () {
'use strict';
var SPRITE = "<svg width=\"0\" height=\"0\" style=\"position:absolute\" aria-hidden=\"true\">\n  <symbol id=\"i-ok\" viewBox=\"0 0 24 24\"><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M20 6 9 17l-5-5\"/></symbol>\n  <symbol id=\"i-escudo\" viewBox=\"0 0 24 24\"><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z\"/><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" d=\"m9 12 2 2 4-4\"/></symbol>\n  <symbol id=\"i-chave\" viewBox=\"0 0 24 24\"><g fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"7.5\" cy=\"15.5\" r=\"5.5\"/><path d=\"m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3\"/></g></symbol>\n  <symbol id=\"i-cad\" viewBox=\"0 0 24 24\"><g fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"11\" width=\"18\" height=\"11\" rx=\"2\"/><path d=\"M7 11V7a5 5 0 0 1 10 0v4\"/></g></symbol>\n  <symbol id=\"i-copia\" viewBox=\"0 0 24 24\"><g fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M21 12a9 9 0 1 1-3-6.7L21 8\"/><path d=\"M21 3v5h-5\"/></g></symbol>\n  <symbol id=\"i-graf\" viewBox=\"0 0 24 24\"><g fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 3v18h18\"/><path d=\"m7 15 4-4 3 3 5-6\"/></g></symbol>\n  <symbol id=\"i-cartao\" viewBox=\"0 0 24 24\"><g fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"2\" y=\"5\" width=\"20\" height=\"14\" rx=\"2\"/><path d=\"M2 10h20M6 15h4\"/></g></symbol>\n  <symbol id=\"i-alvo\" viewBox=\"0 0 24 24\"><g fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><circle cx=\"12\" cy=\"12\" r=\"5\"/><circle cx=\"12\" cy=\"12\" r=\"1.5\" fill=\"currentColor\"/></g></symbol>\n  <symbol id=\"i-pessoas\" viewBox=\"0 0 24 24\"><g fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2\"/><circle cx=\"9\" cy=\"7\" r=\"4\"/><path d=\"M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75\"/></g></symbol>\n  <symbol id=\"i-doc\" viewBox=\"0 0 24 24\"><g fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"/><path d=\"M14 2v6h6M8 13h8M8 17h5\"/></g></symbol>\n  <symbol id=\"i-recibo\" viewBox=\"0 0 24 24\"><g fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 2v20l3-2 3 2 2-2 2 2 3-2 3 2V2l-3 2-3-2-2 2-2-2-3 2z\"/><path d=\"M8 9h8M8 13h6\"/></g></symbol>\n  <symbol id=\"i-carteira\" viewBox=\"0 0 24 24\"><g fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20 12V8H6a2 2 0 0 1 0-4h12v4\"/><path d=\"M4 6v12a2 2 0 0 0 2 2h14v-4\"/><path d=\"M18 12a2 2 0 0 0 0 4h4v-4z\"/></g></symbol>\n  <symbol id=\"i-carrinho\" viewBox=\"0 0 24 24\"><g fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"9\" cy=\"21\" r=\"1\"/><circle cx=\"20\" cy=\"21\" r=\"1\"/><path d=\"M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6\"/></g></symbol>\n  <symbol id=\"i-lista\" viewBox=\"0 0 24 24\"><g fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"><path d=\"M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01\"/></g></symbol>\n  <symbol id=\"i-olho\" viewBox=\"0 0 24 24\"><g fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M17.9 17.9A10 10 0 0 1 12 20C5 20 1 12 1 12a18 18 0 0 1 5.1-5.9M9.9 4.2A9 9 0 0 1 12 4c7 0 11 8 11 8a18 18 0 0 1-2.2 3.2M1 1l22 22\"/></g></symbol>\n  <symbol id=\"i-seta\" viewBox=\"0 0 24 24\"><path fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M5 12h14M13 6l6 6-6 6\"/></symbol>\n  <symbol id=\"i-casa\" viewBox=\"0 0 24 24\"><g fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\"/><path d=\"M9 22V12h6v10\"/></g></symbol>\n  <symbol id=\"i-livro\" viewBox=\"0 0 24 24\"><g fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M2 4h7a3 3 0 0 1 3 3v14a2 2 0 0 0-2-2H2zM22 4h-7a3 3 0 0 0-3 3v14a2 2 0 0 1 2-2h8z\"/></g></symbol>\n  <symbol id=\"i-euro\" viewBox=\"0 0 24 24\"><g fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 6a7 7 0 1 0 0 12\"/><path d=\"M4 10h10M4 14h10\"/></g></symbol>\n  <symbol id=\"i-lupa\" viewBox=\"0 0 24 24\"><g fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"11\" cy=\"11\" r=\"7\"/><path d=\"m20 20-4-4\"/></g></symbol>\n  <symbol id=\"i-ajuda\" viewBox=\"0 0 24 24\"><g fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3\"/><path d=\"M12 17h.01\"/></g></symbol>\n  <symbol id=\"i-calc\" viewBox=\"0 0 24 24\"><g fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"4\" y=\"2\" width=\"16\" height=\"20\" rx=\"2\"/><path d=\"M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h4\"/></g></symbol>\n  <symbol id=\"i-user\" viewBox=\"0 0 24 24\"><g fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"8\" r=\"4\"/><path d=\"M4 21a8 8 0 0 1 16 0\"/></g></symbol>\n</svg>";
var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (x) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x]; }); };
var ic = function (id, t) { return '<svg width="' + (t || 18) + '" height="' + (t || 18) + '"><use href="#' + id + '"/></svg>'; };
var pagina = document.body.dataset.pagina || '';
var ss = function (k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { return null; } };
// segmento: pela página (/empresas) ou pelo último visitado
var seg = document.body.dataset.seg || (/^\/empresas/.test(location.pathname) ? 'empresa' : /^\/(particulares)?$/.test(location.pathname) ? 'particular' : ss('bxb:seg') || 'particular');
ss('bxb:seg', seg); document.body.classList.toggle('emp', seg === 'empresa');
var casa = seg === 'empresa' ? '/empresas' : '/';

var MENU = {
  particular: [
    { id: 'planear', nome: 'Planear', sol: [['/#plano', 'Painel e projeção do ano', 'Quanto entra, sai e sobra, mês a mês'], ['/#plano', 'Despesas fixas e rendimentos', 'Salário, renda, contas e subscrições'], ['/#extratos', 'Extratos do banco', 'Importe e associe os movimentos']],
      fer: [['/simuladores#emergencia', 'Simulador de fundo de emergência'], ['/simuladores#objetivo', 'Simulador de objetivo de poupança']], cats: ['poupanca', 'casa'] },
    { id: 'dividas', nome: 'Dívidas e crédito', sol: [['/#dividas', 'Plano para sair das dívidas', 'Compare várias estratégias'], ['/#dividas', 'Cartões e créditos', 'Prestações, taxas e data de fim']],
      fer: [['/simuladores#divida', 'Simular o prazo de uma dívida'], ['/artigos/tan-taeg-mtic', 'Guia: TAN, TAEG e MTIC']], cats: ['credito'] },
    { id: 'poupanca', nome: 'Poupança', sol: [['/#objetivos', 'Objetivos de poupança', 'Férias, carro ou a entrada da casa'], ['/#objetivos', 'Fundo de emergência', 'O primeiro objetivo de qualquer plano']],
      fer: [['/simuladores#objetivo', 'Quanto poupar por mês'], ['/simuladores#emergencia', 'De quanto precisa o seu fundo']], cats: ['poupanca'] },
    { id: 'impostos', nome: 'Impostos', sol: [['/artigos?c=impostos', 'Recibos e IRS', 'Recibos de vencimento e recibos verdes'], ['/artigos/deducoes-irs-e-fatura', 'Deduções do e-Fatura', 'Saúde, educação, habitação e gerais']],
      fer: [['/artigos/deducoes-irs-e-fatura', 'Guia: deduções no IRS'], ['/artigos/recibos-verdes-sem-surpresas', 'Guia: recibos verdes']], cats: ['impostos'] },
    { id: 'partilhar', nome: 'Partilhar', sol: [['/#partilhar', 'Despesas partilhadas', 'Renda, compras e objetivos a dois'], ['/#partilhar', 'Acerto do mês', 'Quem paga o quê, sem contas de cabeça']],
      fer: [['/artigos/despesas-partilhadas-a-dois', 'Guia: despesas a dois'], ['/ajuda?t=partilhas', 'Ajuda sobre partilhas']], cats: ['casa'] }
  ],
  empresa: [
    { id: 'pagamentos', nome: 'Pagamentos', sol: [['/empresas#pagamentos', 'Pedidos de pagamento', 'Com fatura e rubrica do orçamento'], ['/empresas#pagamentos', 'Alçadas e dupla aprovação', 'Quem aprova cada valor'], ['/empresas#pagamentos', 'Regra das duas pessoas', 'Alterações sensíveis com segunda aprovação']],
      fer: [['/artigos/dupla-aprovacao-pagamentos', 'Guia: dupla aprovação'], ['/ajuda?t=pagamentos', 'Ajuda sobre pagamentos']], cats: ['empresas'] },
    { id: 'tesouraria', nome: 'Tesouraria', sol: [['/empresas#tesouraria', 'Saldos e extratos', 'Saldo disponível e saldo cativo'], ['/empresas#tesouraria', 'Reconciliação bancária', 'Movimentos ligados aos pedidos']],
      fer: [['/simuladores#pmr', 'Simulador de prazo médio de recebimentos'], ['/artigos/tesouraria-pme-13-semanas', 'Guia: previsão a 13 semanas']], cats: ['empresas'] },
    { id: 'resultados', nome: 'Vendas e resultados', sol: [['/empresas#resultados', 'Vendas e comissões', 'Comissões de vendedores e resultados por sócio'], ['/empresas#resultados', 'Orçamentos e relatórios', 'Demonstração de resultados e relatórios anuais']],
      fer: [['/simuladores#margem', 'Simulador de preço e margem']], cats: ['empresas'] },
    { id: 'equipa', nome: 'Equipa', sol: [['/empresas#equipa', 'Colaboradores por convite', 'Cada um entra com o seu email'], ['/empresas#equipa', 'Papéis e alçadas', 'Definidos pelo responsável'], ['/empresas#equipa', 'Registo de operações', 'Quem fez o quê e quando']],
      fer: [['/ajuda?t=empresas', 'Ajuda para empresas']], cats: ['empresas', 'seguranca'] }
  ]
};
var M = MENU[seg];
var artigosDe = function (cats) { var A = window.ARTIGOS || []; return A.filter(function (a) { return cats.indexOf(a.cat) >= 0; }).sort(function (a, b) { return b.data.localeCompare(a.data); }).slice(0, 3); };
var ENT = '/SISTEMAS/entrar.html', abrir = ENT + '?criar=1&tipo=' + seg;

var fora = pagina === 'artigos' || pagina === 'ajuda' || pagina === 'simuladores';
var lsg = function (href, txt, on) { return '<a href="' + href + '"' + (on ? ' class="on"' : '') + '>' + txt + '</a>'; };
var segs = lsg('/', 'Particulares', seg === 'particular' && !fora) + lsg('/empresas', 'Empresas', seg === 'empresa' && !fora) + lsg('/artigos', 'Artigos', pagina === 'artigos') + lsg('/simuladores', 'Simuladores', pagina === 'simuladores') + lsg('/ajuda', 'Ajuda', pagina === 'ajuda');
var chev = '<svg width="12" height="12" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" d="m6 9 6 6 6-6"/></svg>';
var mega = M.map(function (m) { return '<button type="button" data-m="' + m.id + '">' + m.nome + chev + '</button>'; }).join('');
var dropEnt = '<div class="drop-ent" id="dropEnt"><h6>Entrar na sua área</h6>' +
  '<a class="op" href="' + ENT + '?tipo=particular"><i>' + ic('i-casa', 18) + '</i><div><b>Particulares</b><span>Plano pessoal e partilhas</span></div></a>' +
  '<a class="op" href="' + ENT + '?tipo=empresa"><i>' + ic('i-carteira', 18) + '</i><div><b>Empresas</b><span>Pagamentos, tesouraria e equipa</span></div></a>' +
  '<div class="rod-d">Ainda não é cliente? <a href="' + abrir + '">Abrir conta</a></div></div>';
var acoes = '<div class="acoes" id="acoes"><button class="btn btn-o" type="button" id="bEnt">' + ic('i-cad', 16) + 'Entrar' + chev + '</button><a class="btn btn-p" href="' + abrir + '" data-abr>Abrir conta</a>' + dropEnt + '</div>';
var paineis = M.map(function (m) {
  var ler = artigosDe(m.cats);
  return '<div class="painel" data-p-m="' + m.id + '"><div class="wrap">' +
    '<div><h5>' + m.nome + '</h5><ul>' + m.sol.map(function (x) { return '<li><a href="' + x[0] + '">' + x[1] + '<small>' + x[2] + '</small></a></li>'; }).join('') + '</ul></div>' +
    '<div><h5>Ferramentas e guias</h5><ul>' + m.fer.map(function (x) { return '<li><a href="' + x[0] + '">' + x[1] + '</a></li>'; }).join('') + '</ul></div>' +
    '<div class="ler"><h5>Leituras úteis</h5><ul>' + ler.map(function (a) { return '<li><a href="/artigos/' + a.id + '">' + esc(a.titulo) + '</a></li>'; }).join('') + '</ul><a class="ver" href="/artigos?c=' + m.cats[0] + '">Ver artigos ›</a></div>' +
    '<div class="promo"><b>' + (seg === 'empresa' ? 'Controlo sobre cada pagamento' : 'O seu plano em 1 minuto') + '</b><p>' + (seg === 'empresa' ? 'Abra a área da empresa e convide a equipa.' : 'Crie a conta e veja já o seu mês.') + '</p><a class="btn btn-p" href="' + abrir + '" data-abr>Abrir conta</a></div>' +
    '</div></div>';
}).join('');
var menuM = '<div class="menu-m" id="menuM"><div class="sg">' + lsg('/', 'Particulares', seg === 'particular') + lsg('/empresas', 'Empresas', seg === 'empresa') + '</div>' +
  M.map(function (m) { return '<details><summary>' + m.nome + '</summary>' + m.sol.concat(m.fer).map(function (x) { return '<a href="' + x[0] + '">' + x[1] + '</a>'; }).join('') + '</details>'; }).join('') +
  '<a class="lk" href="/artigos">Artigos</a><a class="lk" href="/simuladores">Simuladores</a><a class="lk" href="/ajuda">Ajuda</a>' +
  '<div class="bts" id="btsM"><a class="btn btn-s" href="' + ENT + '?tipo=' + seg + '" data-ent>Entrar</a><a class="btn btn-p" href="' + abrir + '" data-abr>Abrir conta</a></div></div>';
var avisoFechado = false; try { avisoFechado = localStorage.getItem('bxb:aviso') === 'simuladores-1'; } catch (e) { }
var aviso = avisoFechado ? '' : '<div class="aviso" id="aviso"><div class="wrap"><span class="et">Novidade</span><p>Já pode simular o prazo de uma dívida, o fundo de emergência e a tesouraria da empresa, sem registo. <a href="/simuladores">Experimentar</a></p><button type="button" id="avisoF" aria-label="Fechar aviso">×</button></div></div>';
var cab = aviso + '<header class="nav" id="nav"><div class="wrap barra"><a class="marca" href="' + casa + '"><b>BXB</b>BXB</a><nav class="segs">' + segs + '</nav>' +
  '<button type="button" class="eu-quero" id="bPesq" aria-label="Pesquisar">' + ic('i-lupa', 17) + '<span>Eu quero…</span></button>' + acoes +
  '<button class="ic-m pq" id="bPesqM" aria-label="Pesquisar">' + ic('i-lupa', 19) + '</button><button class="ic-m" id="hamb" aria-label="Menu"><svg width="20" height="20" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M3 6h18M3 12h18M3 18h18"/></svg></button></div>' +
  '<div class="temas-b"><div class="wrap"><nav class="mega" id="mega">' + mega + '</nav></div></div>' +
  paineis + menuM + '</header>';

var col = function (t, l) { return '<div><h4>' + t + '</h4><ul>' + l.map(function (x) { return '<li><a href="' + x[0] + '">' + x[1] + '</a></li>'; }).join('') + '</ul></div>'; };
var rod = '<footer><div class="wrap">' +
  '<div class="rod-topo"><a class="marca" href="' + casa + '"><b>BXB</b>BXB</a><button type="button" class="subir" id="subir">Voltar ao início ↑</button></div>' +
  '<div class="g">' +
  col('Particulares', [['/#plano', 'Plano pessoal'], ['/#dividas', 'Sair das dívidas'], ['/#objetivos', 'Objetivos de poupança'], ['/artigos?c=impostos', 'Recibos e IRS'], ['/#partilhar', 'Despesas partilhadas']]) +
  col('Empresas', [['/empresas#pagamentos', 'Autorização de pagamentos'], ['/empresas#tesouraria', 'Tesouraria'], ['/empresas#resultados', 'Vendas e resultados'], ['/empresas#equipa', 'Equipa']]) +
  col('Ferramentas', [['/simuladores', 'Simuladores'], ['/artigos', 'Artigos'], ['/ajuda', 'Centro de ajuda'], ['/artigos/proteger-a-sua-conta', 'Segurança online']]) +
  col('Área de cliente', [[ENT + '?tipo=particular', 'Entrar · Particulares'], [ENT + '?tipo=empresa', 'Entrar · Empresas'], [abrir, 'Abrir conta'], ['/SISTEMAS/conta.html', 'A minha conta']]) +
  '</div><div class="base"><span>© ' + new Date().getFullYear() + ' BXB · Planeamento financeiro e tesouraria</span><span>A BXB nunca pede a palavra-passe ou o PIN por email, SMS ou telefone.</span></div></div></footer>';
var pesq = '<div class="pesq" id="pesq" role="dialog" aria-label="Pesquisar"><div class="cx"><div class="lin">' + ic('i-lupa', 20) + '<input id="pesqI" placeholder="O que procura?" autocomplete="off"><button class="fechar" type="button" id="pesqF">Esc</button></div><div class="res" id="pesqR"></div></div></div>';

document.body.insertAdjacentHTML('afterbegin', SPRITE + cab);
document.body.insertAdjacentHTML('beforeend', rod + pesq);

// menus
var nav = document.getElementById('nav'), mm = document.getElementById('menuM'), dEnt = document.getElementById('dropEnt');
function fechar() { document.querySelectorAll('.painel.on,[data-m].on').forEach(function (e) { e.classList.remove('on'); }); dEnt.classList.remove('on'); }
document.querySelectorAll('[data-m]').forEach(function (b) {
  b.onclick = function (e) { e.stopPropagation(); var on = b.classList.contains('on'); fechar(); if (!on) { b.classList.add('on'); document.querySelector('[data-p-m="' + b.dataset.m + '"]').classList.add('on'); } };
});
document.getElementById('bEnt').onclick = function (e) { e.stopPropagation(); var on = dEnt.classList.contains('on'); fechar(); if (!on) dEnt.classList.add('on'); };
nav.addEventListener('click', function (e) { if (e.target.closest('.painel a,.drop-ent a,.menu-m a')) { fechar(); mm.classList.remove('on'); } });
document.addEventListener('click', function (e) { if (!e.target.closest('.painel,.drop-ent')) fechar(); });
document.getElementById('hamb').onclick = function () { mm.classList.toggle('on'); };
addEventListener('keydown', function (e) { if (e.key === 'Escape') { fechar(); fecharPesq(); } });

// pesquisa (artigos, ajuda e páginas)
var P = document.getElementById('pesq'), PI = document.getElementById('pesqI'), PR = document.getElementById('pesqR');
var PAGS = [['/simuladores', 'Simuladores', 'Fundo de emergência, dívidas, poupança, margem e recebimentos'], ['/ajuda', 'Centro de ajuda', 'Perguntas frequentes por tema'], ['/artigos', 'Artigos', 'Poupança, crédito, impostos e empresas'],
  [ENT + '?criar=1&tipo=particular', 'Abrir conta particular', 'Plano pessoal'], [ENT + '?criar=1&tipo=empresa', 'Abrir conta de empresa', 'Pagamentos, tesouraria e equipa'], [ENT, 'Entrar', 'Aceder à sua área']];
var norm = function (s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };
function carregarAjuda(cb) { if (window.AJUDA) return cb(); var s = document.createElement('script'); s.src = '/SISTEMAS/site/ajuda.js?v=2'; s.onload = cb; s.onerror = cb; document.head.appendChild(s); }
function pesquisar() {
  var q = norm(PI.value.trim());
  if (!q) { PR.innerHTML = '<h6>Pesquisas frequentes</h6><div class="chips">' + ['IRS', 'Fundo de emergência', 'Cartão de crédito', 'Dupla aprovação', 'Palavra-passe', 'Tesouraria'].map(function (c) { return '<button type="button">' + c + '</button>'; }).join('') + '</div>';
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
document.getElementById('subir').onclick = function () { scrollTo({ top: 0, behavior: 'smooth' }); };
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
  document.getElementById('btsM').innerHTML = '<a class="btn btn-s" href="/SISTEMAS/conta.html">' + nome + '</a><a class="btn btn-p" href="/SISTEMAS/index.html">A minha área</a>';
  document.querySelectorAll('main [data-ent]').forEach(function (a) { a.href = '/SISTEMAS/index.html'; a.textContent = 'A minha área'; });
}).catch(function () { });
window.Site = { revelar: revelar, seg: seg, esc: esc, ic: ic };
})();
