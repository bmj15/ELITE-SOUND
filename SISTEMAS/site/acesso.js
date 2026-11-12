/* Entrar e abrir conta numa faixa sob o cabeçalho, sem sair da página (como os bancos).
   Abrir conta em passos: 1) nome, email e palavra-passe; 2) código enviado por email (só se a verificação estiver ligada); 3) perfil completo. */
(() => {
  'use strict';
  const T = window.BXB_T || (pt => pt);
  const PAIS = window.BXB_PAIS === 'br' ? 'br' : 'pt', BR = PAIS === 'br';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nav = document.getElementById('nav'); if (!nav) return;
  const svg = (d, w) => '<svg viewBox="0 0 24 24" width="' + (w || 18) + '" height="' + (w || 18) + '" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
  const OLHO = svg('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>');
  const OLHO_X = svg('<path d="M3 3l18 18M10.6 5.1A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6A17.6 17.6 0 0 0 2 12s3.6 7 10 7a10 10 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/>');
  const SETA = svg('<path d="M5 12h14M13 6l6 6-6 6"/>');
  const FECHAR = svg('<path d="M6 6l12 12M18 6L6 18"/>', 20);
  const VISTO = svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 14);

  const d = document.createElement('section');
  d.className = 'acesso'; d.id = 'acessoPainel'; d.hidden = true; d.setAttribute('aria-labelledby', 'acT');
  d.innerHTML = '<div class="ac-in"><button type="button" class="ac-x" aria-label="Fechar">' + FECHAR + '</button><div class="ac-corpo"></div></div>';
  nav.appendChild(d);
  const corpo = d.querySelector('.ac-corpo');
  const gatilhos = document.querySelectorAll('#bEnt,#entM');
  gatilhos.forEach(b => { b.setAttribute('aria-expanded', 'false'); b.setAttribute('aria-controls', d.id); });

  const params = new URLSearchParams(location.search);
  let destino = params.get('voltar') || '/SISTEMAS/index.html';
  if (!/^\/(?!\/)/.test(destino) || /[\\\r\n]/.test(destino)) destino = '/SISTEMAS/index.html';
  // vista: entrar | criar | codigo | perfil
  let vista = 'entrar', tipo = 'particular', anterior = null, geracao = 0, verifica = false, emRegisto = false, pedido = null, emailPedido = '', depois = destino;

  function posicao() { d.style.setProperty('--ac-topo', Math.max(0, nav.getBoundingClientRect().bottom) + 'px'); }
  addEventListener('resize', posicao); addEventListener('scroll', posicao, { passive: true });

  async function post(url, dados) {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-BXB': '1' }, body: JSON.stringify(dados || {}) });
    let j = {}; try { j = await r.json(); } catch (e) { }
    if (!r.ok) throw Error(j.erro || T('Não foi possível continuar.', 'Não foi possível continuar.'));
    return j;
  }


  /* ---------- telefone: funções puras ---------- */
  const digitosTelefone = valor => String(valor || '').replace(/\D/g, '');
  function lerTelefone(valor, indicativo, aceitarSemSinal = false) {
    const texto = String(valor || '');
    let numero = digitosTelefone(texto), codigo = indicativo === '351' ? '351' : '55', retirados = 0;
    const explicito = /^\s*(\+|00)\s*(55|351)/.exec(texto);
    if (explicito) {
      codigo = explicito[2]; retirados = codigo.length + (explicito[1] === '00' ? 2 : 0);
    } else if (/^\s*(?:\+|00)/.test(texto)) {
      return { indicativo: codigo, numero, retirados: 0, internacionalInvalido: true };
    } else if (aceitarSemSinal) {
      // Só uma colagem internacional completa permite retirar um indicativo sem +.
      // Um número nacional de 10/11 dígitos com DDD 55 nunca perde o DDD.
      if (/^55\d{11}$/.test(numero)) { codigo = '55'; retirados = 2; }
      else if (/^351\d{9}$/.test(numero)) { codigo = '351'; retirados = 3; }
    }
    return { indicativo: codigo, numero: numero.slice(retirados), retirados, internacionalInvalido: false };
  }
  function formatarTelefone(numero, indicativo) {
    const n = digitosTelefone(numero); if (!n) return '';
    if (indicativo === '351') return [n.slice(0, 3), n.slice(3, 6), n.slice(6)].filter(Boolean).join(' ');
    if (n.length < 2) return '(' + n;
    const resto = n.slice(2), grupo = n.length > 10 ? 5 : 4;
    return '(' + n.slice(0, 2) + ')' + (resto ? ' ' + resto.slice(0, grupo) + (resto.length > grupo ? '-' + resto.slice(grupo) : '') : '');
  }
  function posicaoTelefone(texto, quantidade) {
    if (quantidade <= 0) { const primeiro = texto.search(/\d/); return primeiro < 0 ? 0 : primeiro; }
    let vistos = 0, p = 0;
    while (p < texto.length && vistos < quantidade) { if (/\d/.test(texto[p])) vistos++; p++; }
    while (p < texto.length && /\D/.test(texto[p])) p++;
    return p;
  }
  function prepararEdicaoTelefone(valor, inicio, fim, indicativo, aceitarSemSinal = false) {
    const lido = lerTelefone(valor, indicativo, aceitarSemSinal);
    if (lido.internacionalInvalido) return { ...lido, texto: String(valor), inicio, fim };
    const texto = formatarTelefone(lido.numero, lido.indicativo);
    const contar = p => Math.max(0, digitosTelefone(String(valor).slice(0, p)).length - lido.retirados);
    return { ...lido, texto, inicio: posicaoTelefone(texto, contar(inicio)), fim: posicaoTelefone(texto, contar(fim)) };
  }
  function apagarSeparadorTelefone(valor, inicio, fim, tipo, indicativo) {
    if (inicio !== fim || !['deleteContentBackward', 'deleteContentForward'].includes(tipo) || lerTelefone(valor, indicativo).internacionalInvalido) return null;
    const recuar = tipo === 'deleteContentBackward';
    let p = recuar ? inicio - 1 : inicio;
    if (p < 0 || p >= valor.length || /\d/.test(valor[p])) return null;
    while (p >= 0 && p < valor.length && /\D/.test(valor[p])) p += recuar ? -1 : 1;
    if (p < 0 || p >= valor.length) return null;
    const novo = valor.slice(0, p) + valor.slice(p + 1), cursor = recuar ? p : inicio;
    return prepararEdicaoTelefone(novo, cursor, cursor, indicativo);
  }
  function erroTelefone(lido) {
    if (lido.internacionalInvalido) return 'indicativo';
    const n = lido.numero;
    if (lido.indicativo === '351') return n.length === 9 ? '' : 'pt';
    return (n.length === 11 && n[2] === '9') || (n.length === 10 && n[2] !== '9') ? '' : 'br';
  }
  function telefoneCompleto(lido) {
    return erroTelefone(lido) ? null : '+' + lido.indicativo + ' ' + formatarTelefone(lido.numero, lido.indicativo);
  }
  /* ---------- fim das funções puras de telefone ---------- */

  /* ---------- peças ---------- */
  const campo = (nome, rotulo, tipoInp, auto, extra, opc) =>
    '<div class="ac-c"><input id="ac-' + nome + '" name="' + nome + '" type="' + tipoInp + '" autocomplete="' + auto + '" placeholder=" "' + (opc ? '' : ' required') + ' ' + (extra || '') + '><label for="ac-' + nome + '">' + rotulo + (opc ? ' <i>' + T('(opcional)', '(opcional)') + '</i>' : '') + '</label></div>';
  const escolha = (nome, rotulo, opcoes, opc) =>
    '<div class="ac-c ac-sel"><select id="ac-' + nome + '" name="' + nome + '"' + (opc ? '' : ' required') + '><option value="">' + T('Escolha…', 'Escolha…') + '</option>' + opcoes.map(o => '<option>' + esc(o) + '</option>').join('') + '</select><label for="ac-' + nome + '">' + rotulo + (opc ? ' <i>' + T('(opcional)', '(opcional)') + '</i>' : '') + '</label></div>';

  function campoTelefone(rotulo) {
    return '<div class="ac-telefone"><div class="ac-telefone-campo"><label class="ac-telefone-rotulo" for="ac-telefone">' + rotulo + '</label><div class="ac-telefone-linha">' +
      '<div class="ac-telefone-prefixo"><span id="ac-indicativo-texto" aria-hidden="true">' + (BR ? '+55' : '+351') + '</span><svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true" focusable="false"><path d="m3 4.5 3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '<select id="ac-indicativo" autocomplete="tel-country-code" aria-label="Indicativo internacional" required><option value="55"' + (BR ? ' selected' : '') + '>Brasil (+55)</option><option value="351"' + (!BR ? ' selected' : '') + '>Portugal (+351)</option></select></div>' +
      '<input id="ac-telefone" name="telefone" type="tel" autocomplete="tel-national" inputmode="tel" maxlength="30" required aria-describedby="ac-telefone-ajuda"></div></div>' +
      '<small class="ac-telefone-ajuda" id="ac-telefone-ajuda"></small></div>';
  }
  function ligarTelefone(f) {
    const i = f.elements.telefone, codigo = f.querySelector('#ac-indicativo'), codigoTexto = f.querySelector('#ac-indicativo-texto'), ajuda = f.querySelector('#ac-telefone-ajuda');
    let comErro = false;
    function atualizar(r) {
      codigo.value = r.indicativo; codigoTexto.textContent = '+' + r.indicativo; i.value = r.texto;
      i.setSelectionRange(r.inicio, r.fim);
      ajuda.textContent = codigo.value === '55' ? T('Com DDD. Ex.: (11) 91234-5678.', 'Com DDD. Ex.: (11) 91234-5678.') : 'Ex.: 912 345 678.';
      i.removeAttribute('aria-invalid');
      if (comErro) { erroEm().textContent = ''; comErro = false; }
    }
    function formatar() { atualizar(prepararEdicaoTelefone(i.value, i.selectionStart || 0, i.selectionEnd || 0, codigo.value)); }
    i.addEventListener('input', e => { if (!e.isComposing) formatar(); });
    i.addEventListener('compositionend', formatar);
    i.addEventListener('change', formatar);
    i.addEventListener('beforeinput', e => {
      if (!e.cancelable) return;
      const r = apagarSeparadorTelefone(i.value, i.selectionStart, i.selectionEnd, e.inputType, codigo.value);
      if (r) { e.preventDefault(); atualizar(r); }
    });
    i.addEventListener('paste', e => {
      if (!e.clipboardData) return;
      const colado = e.clipboardData.getData('text'), lido = lerTelefone(colado, codigo.value, true);
      e.preventDefault();
      if (lido.retirados || lido.internacionalInvalido) {
        // Um telefone internacional completo substitui o campo, sem duplicar o DDI.
        atualizar(prepararEdicaoTelefone(colado, colado.length, colado.length, codigo.value, true));
      } else {
        const inicio = i.selectionStart || 0, fim = i.selectionEnd || 0;
        const novo = i.value.slice(0, inicio) + colado + i.value.slice(fim), cursor = inicio + colado.length;
        atualizar(prepararEdicaoTelefone(novo, cursor, cursor, codigo.value));
      }
    });
    codigo.addEventListener('change', formatar);
    formatar();
    return { validar() {
      formatar();
      const lido = lerTelefone(i.value, codigo.value), erro = erroTelefone(lido);
      if (!erro) return telefoneCompleto(lido);
      erroEm().textContent = erro === 'pt' ? T('O número de Portugal tem 9 dígitos, sem o indicativo.', 'O número de Portugal tem 9 dígitos, sem o indicativo.')
        : erro === 'br' ? T('Indique o DDD e o número: 11 dígitos para telemóvel ou 10 para telefone fixo.', 'Informe o DDD e o número: 11 dígitos para celular ou 10 para telefone fixo.')
        : T('Escolha Brasil (+55) ou Portugal (+351) para este telefone.', 'Escolha Brasil (+55) ou Portugal (+351) para este telefone.');
      comErro = true; i.setAttribute('aria-invalid', 'true'); i.focus(); return null;
    } };
  }

  const senha = criar =>
    '<div class="ac-c ac-senha"><input id="ac-palavra" name="palavra" type="password" autocomplete="' + (criar ? 'new-password' : 'current-password') + '" placeholder=" " required' + (criar ? ' minlength="8"' : '') + '><label for="ac-palavra">' + (criar ? T('Palavra-passe (mín. 8)', 'Senha (mín. 8)') : T('Palavra-passe', 'Senha')) + '</label><button type="button" class="ac-olho" aria-label="' + T('Mostrar a palavra-passe', 'Mostrar a senha') + '">' + OLHO + '</button></div>';
  const botao = texto => '<button class="btn btn-p ac-ok" type="submit"><span>' + texto + '</span>' + SETA + '</button>';
  const seg = () => '<div class="ac-seg" role="radiogroup" aria-label="' + T('Área', 'Área') + '" data-on="' + tipo + '"><i></i>' +
    '<button type="button" role="radio" data-t="particular" aria-checked="' + (tipo !== 'empresa') + '">' + T('Particulares', 'Pessoa física') + '</button>' +
    '<button type="button" role="radio" data-t="empresa" aria-checked="' + (tipo === 'empresa') + '">' + T('Empresas', 'Empresas') + '</button></div>';
  // indicador dos passos ao abrir conta
  function passos() {
    if (!emRegisto) return '';
    const lista = verifica ? [T('Conta', 'Conta'), T('Email', 'E-mail'), T('Perfil', 'Perfil')] : [T('Conta', 'Conta'), T('Perfil', 'Perfil')];
    const atual = vista === 'criar' ? 0 : vista === 'codigo' ? 1 : lista.length - 1;
    return '<ol class="ac-passos" aria-label="' + T('Passo', 'Passo') + ' ' + (atual + 1) + ' ' + T('de', 'de') + ' ' + lista.length + '">' + lista.map((n, i) =>
      '<li class="' + (i < atual ? 'feito' : i === atual ? 'agora' : '') + '"><b>' + (i < atual ? VISTO : i + 1) + '</b><span>' + n + '</span></li>').join('') + '</ol>';
  }
  const pe = extra => '<div class="ac-pe"><p class="ac-erro" role="alert" aria-live="polite"></p>' + (extra ? '<p class="ac-troca">' + extra + '</p>' : '') + '</div>';
  const erroEm = () => corpo.querySelector('.ac-erro');
  function aEnviar(f, on) { const b = f.querySelector('.ac-ok'); if (b) { b.disabled = on; b.classList.toggle('a-ir', on); } }
  function ligarOlho() {
    const o = corpo.querySelector('.ac-olho'); if (!o) return;
    o.onclick = () => { const i = corpo.querySelector('#ac-palavra'), ver = i.type === 'password'; i.type = ver ? 'text' : 'password'; o.innerHTML = ver ? OLHO_X : OLHO;
      o.setAttribute('aria-label', ver ? T('Ocultar a palavra-passe', 'Ocultar a senha') : T('Mostrar a palavra-passe', 'Mostrar a senha')); };
  }
  // valida no navegador antes de enviar: foca o primeiro campo em falta
  function valido(f) {
    const mau = [...f.querySelectorAll('input,select')].find(i => !i.checkValidity()); if (!mau) return true;
    mau.focus(); erroEm().textContent = mau.name === 'email' && mau.value ? T('Indique um email válido.', 'Informe um e-mail válido.')
      : mau.name === 'palavra' && mau.value ? T('A palavra-passe tem de ter pelo menos 8 caracteres.', 'A senha precisa ter pelo menos 8 caracteres.')
      : T('Preencha os campos assinalados.', 'Preencha os campos indicados.');
    return false;
  }
  function seguir(j) {
    try { sessionStorage.setItem('bxb:tipo', tipo); } catch (x) { }
    const s = j && j.sessao;
    if (s && s.completar) { tipo = s.completar === 'empresa' ? 'empresa' : 'particular'; depois = j.destino || destino; vista = 'perfil'; pintar(); return; }
    location.assign((j && j.destino) || destino);
  }

  /* ---------- vistas ---------- */
  function pintar() {
    d.classList.toggle('criar', vista !== 'entrar');
    d.dataset.vista = vista;
    if (vista === 'codigo') return pintarCodigo();
    if (vista === 'perfil') return pintarPerfil();
    const criar = vista === 'criar';
    corpo.innerHTML =
      '<div class="ac-topo"><h2 id="acT">' + (criar ? T('Abrir conta', 'Abrir conta') : T('Entrar', 'Entrar')) + '</h2>' + seg() + passos() + '</div>' +
      '<form class="ac-form" novalidate>' +
      (criar ? campo('nome', T('O seu nome', 'Seu nome'), 'text', 'name', 'maxlength="80"') : '') +
      campo('email', T('Email', 'E-mail'), 'email', 'username', 'maxlength="120" inputmode="email"') + senha(criar) +
      botao(criar ? T('Continuar', 'Continuar') : T('Entrar', 'Entrar')) + '</form>' +
      pe(criar ? T('Já tem conta?', 'Já tem conta?') + ' <button type="button" data-v="entrar">' + T('Entrar', 'Entrar') + '</button>' : '');

    const f = corpo.querySelector('form');
    corpo.querySelectorAll('.ac-seg button').forEach(b => b.onclick = () => {
      if (b.dataset.t === tipo) return;
      const antes = Object.fromEntries(new FormData(f)); tipo = b.dataset.t; pintar();
      const nf = corpo.querySelector('form'); Object.keys(antes).forEach(k => { if (nf.elements[k] && antes[k]) nf.elements[k].value = antes[k]; });
      corpo.querySelector('.ac-seg [aria-checked=true]').focus();
    });
    const troca = corpo.querySelector('[data-v]');
    if (troca) troca.onclick = () => { const em = f.elements.email.value; vista = 'entrar'; emRegisto = false; pintar(); const nf = corpo.querySelector('form'); if (em) nf.elements.email.value = em; nf.querySelector('input').focus(); };
    ligarOlho();
    f.onsubmit = async e => {
      e.preventDefault(); erroEm().textContent = ''; if (!valido(f)) return;
      aEnviar(f, true);
      const dados = Object.assign(Object.fromEntries(new FormData(f)), { tipo });
      try {
        const j = await post(criar ? '/api/registar' : '/api/entrar', dados);
        if (j.verificar) { pedido = j.pedido; emailPedido = j.email; verifica = true; vista = 'codigo'; pintar(); return; }
        seguir(j);
      } catch (x) { erroEm().textContent = x.message || T('Verifique a ligação e tente novamente.', 'Verifique a conexão e tente novamente.'); aEnviar(f, false); }
    };
  }

  function pintarCodigo() {
    corpo.innerHTML =
      '<div class="ac-topo"><h2 id="acT">' + T('Confirme o seu email', 'Confirme seu e-mail') + '</h2>' + passos() + '</div>' +
      '<p class="ac-sub">' + T('Enviámos um código de 6 dígitos para', 'Enviamos um código de 6 dígitos para') + ' <b>' + esc(emailPedido) + '</b>.</p>' +
      '<form class="ac-form ac-cod" novalidate><div class="ac-c"><input id="ac-codigo" name="codigo" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="7" placeholder=" " required pattern="\\d{3} ?\\d{3}"><label for="ac-codigo">' + T('Código', 'Código') + '</label></div>' +
      botao(T('Confirmar', 'Confirmar')) + '</form>' +
      pe('<button type="button" data-reenviar>' + T('Reenviar código', 'Reenviar código') + '</button><span class="ac-ponto">·</span><button type="button" data-voltar>' + T('Alterar email', 'Alterar e-mail') + '</button>');
    const f = corpo.querySelector('form'), i = f.elements.codigo;
    i.addEventListener('input', () => { const v = i.value.replace(/\D/g, '').slice(0, 6); i.value = v.length > 3 ? v.slice(0, 3) + ' ' + v.slice(3) : v; if (v.length === 6) f.requestSubmit(); });
    setTimeout(() => i.focus({ preventScroll: true }), 50);
    f.onsubmit = async e => {
      e.preventDefault(); erroEm().textContent = '';
      if (i.value.replace(/\D/g, '').length !== 6) { erroEm().textContent = T('O código tem 6 dígitos.', 'O código tem 6 dígitos.'); i.focus(); return; }
      aEnviar(f, true);
      try { seguir(await post('/api/registar/codigo', { pedido, codigo: i.value })); }
      catch (x) { erroEm().textContent = x.message; aEnviar(f, false); i.select(); }
    };
    corpo.querySelector('[data-reenviar]').onclick = async e => {
      const b = e.currentTarget; b.disabled = true; erroEm().textContent = '';
      try { await post('/api/registar/reenviar', { pedido }); erroEm().textContent = ''; b.textContent = T('Código reenviado', 'Código reenviado'); setTimeout(() => { b.textContent = T('Reenviar código', 'Reenviar código'); b.disabled = false; }, 30000); }
      catch (x) { erroEm().textContent = x.message; b.disabled = false; }
    };
    corpo.querySelector('[data-voltar]').onclick = () => { vista = 'criar'; pintar(); const nf = corpo.querySelector('form'); if (nf.elements.email) { nf.elements.email.value = emailPedido; nf.elements.email.focus(); } };
  }

  function pintarPerfil() {
    const emp = tipo === 'empresa';
    const campos = emp
      ? campo('empresa', T('Nome da empresa', 'Nome da empresa'), 'text', 'organization', 'maxlength="80"') +
        campo('documento', BR ? 'CNPJ' : T('NIF da empresa', 'NIF da empresa'), 'text', 'off', 'inputmode="numeric" maxlength="18"', true) +
        escolha('setor', T('Setor de atividade', 'Setor de atividade'), BR ? ['Comércio', 'Serviços', 'Alimentação', 'Construção', 'Indústria', 'Tecnologia', 'Saúde', 'Outro'] : ['Comércio', 'Serviços', 'Restauração', 'Construção', 'Indústria', 'Tecnologia', 'Saúde', 'Outro']) +
        escolha('dimensao', T('Pessoas na empresa', 'Pessoas na empresa'), [T('Só eu', 'Só eu'), '2 a 9', '10 a 49', T('50 ou mais', '50 ou mais')]) +
        campoTelefone(T('Telefone', 'Telefone'))
      : campoTelefone(BR ? 'Celular' : T('Telemóvel', 'Celular')) +
        campo('documento', BR ? 'CPF' : 'NIF', 'text', 'off', 'inputmode="numeric" maxlength="14"', true) +
        '<div class="ac-c ac-sel"><input id="ac-nascimento" name="nascimento" type="date" max="' + new Date().toISOString().slice(0, 10) + '"><label for="ac-nascimento">' + T('Data de nascimento', 'Data de nascimento') + ' <i>' + T('(opcional)', '(opcional)') + '</i></label></div>' +
        escolha('situacao', T('Situação profissional', 'Situação profissional'), BR ? ['CLT', 'Autônomo', 'Empresário', 'Servidor público', 'Estudante', 'Aposentado', 'Outra'] : ['Por conta de outrem', 'Independente', 'Empresário', 'Função pública', 'Estudante', 'Reformado', 'Outra'], true) +
        escolha('objetivo', T('O que quer conseguir primeiro?', 'O que quer conseguir primeiro?'), [T('Poupar todos os meses', 'Poupar todo mês'), T('Pagar dívidas', 'Pagar dívidas'), T('Comprar casa', 'Comprar imóvel'), T('Fundo de emergência', 'Reserva de emergência'), T('Investir', 'Investir'), BR ? 'Organizar o IR' : 'Organizar o IRS'], true);
    corpo.innerHTML =
      '<div class="ac-topo"><h2 id="acT">' + (emp ? T('Dados da empresa', 'Dados da empresa') : T('Complete o seu perfil', 'Complete seu perfil')) + '</h2>' + passos() + '</div>' +
      '<p class="ac-sub">' + (emRegisto ? T('A conta está criada.', 'A conta está criada.') + ' ' : '') + (emp ? T('Com estes dados preparamos a área da empresa.', 'Com esses dados preparamos a área da empresa.') : T('Com isto adaptamos o seu plano a si.', 'Com isso adaptamos o plano a você.')) + '</p>' +
      '<form class="ac-form ac-grade" novalidate>' + campos + botao(T('Concluir', 'Concluir')) + '</form>' +
      pe(emp ? '' : '<button type="button" data-depois>' + T('Fazer isto depois', 'Fazer isso depois') + '</button>');
    const f = corpo.querySelector('form'), controloTelefone = ligarTelefone(f);
    if (matchMedia('(pointer:fine)').matches) setTimeout(() => f.querySelector('input').focus({ preventScroll: true }), 50);
    const dp = corpo.querySelector('[data-depois]'); if (dp) dp.onclick = () => location.assign(depois);
    f.onsubmit = async e => {
      e.preventDefault(); erroEm().textContent = ''; if (!valido(f)) return;
      const telefone = controloTelefone.validar(); if (telefone === null) return;
      aEnviar(f, true);
      try { const j = await post('/api/perfil', Object.assign(Object.fromEntries(new FormData(f)), { tipo, pais: PAIS, telefone })); location.assign(j.destino || depois); }
      catch (x) { erroEm().textContent = x.message; aEnviar(f, false); }
    };
  }

  function mensagem(html) { d.classList.remove('criar', 'emp'); corpo.innerHTML = '<div class="ac-msg">' + html + '</div>'; }

  function fechar(foco) {
    if (d.hidden) return;
    d.hidden = true; geracao++; document.body.classList.remove('ac-aberto');
    gatilhos.forEach(b => b.setAttribute('aria-expanded', 'false'));
    if (foco !== false && anterior && anterior.isConnected) anterior.focus();
    if (params.has('acesso')) { const u = new URL(location.href); u.searchParams.delete('acesso'); u.searchParams.delete('voltar'); u.searchParams.delete('tipo'); history.replaceState(null, '', u.pathname + u.search + u.hash); }
  }

  async function abrir(criar, t) {
    anterior = document.activeElement; vista = criar ? 'criar' : 'entrar'; emRegisto = !!criar;
    tipo = t === 'empresa' || (!t && document.body.classList.contains('emp')) ? 'empresa' : 'particular';
    document.querySelectorAll('.sub-m.on,.menu-m.on,.pesq.on,.pais-m.on,.drop-ent.on').forEach(x => x.classList.remove('on'));
    pintar(); posicao(); d.hidden = false; document.body.classList.add('ac-aberto');
    gatilhos.forEach(b => b.setAttribute('aria-expanded', 'true'));
    if (matchMedia('(pointer:fine)').matches) { const i = corpo.querySelector('input'); if (i) i.focus({ preventScroll: true }); }
    const n = ++geracao;
    try {
      const r = await fetch('/api/estado', { cache: 'no-store' }); if (!r.ok) throw Error();
      const estado = await r.json(); if (n !== geracao || d.hidden) return;
      verifica = !!estado.verificarEmail;
      const ps = corpo.querySelector('.ac-passos'); if (ps) ps.outerHTML = passos();
      if (estado.sessao && estado.sessao.completar) { seguir({ sessao: estado.sessao }); }
      else if (estado.sessao) {
        mensagem('<h2 id="acT">' + T('Olá', 'Olá') + ', ' + esc(String(estado.sessao.nome || '').split(' ')[0]) + '</h2><p>' + T('Já tem sessão iniciada neste dispositivo.', 'Você já está conectado neste dispositivo.') + '</p>' +
          '<div class="ac-bts"><a class="btn btn-p" href="' + esc(destino) + '">' + T('A minha área', 'Minha área') + SETA + '</a><button type="button" class="btn btn-s">' + T('Usar outra conta', 'Usar outra conta') + '</button></div>');
        corpo.querySelector('.btn-s').onclick = async () => { try { await post('/api/sair', {}); } catch (e) { } pintar(); };
      } else if (!estado.configurado) {
        mensagem('<h2 id="acT">' + T('Quase pronto', 'Quase pronto') + '</h2><p>' + T('O serviço está a ser preparado. Tente novamente daqui a pouco.', 'O serviço está sendo preparado. Tente novamente em instantes.') + '</p>');
      }
    } catch (e) {
      if (n === geracao && !d.hidden) { const er = erroEm(); if (er) er.textContent = T('Sem ligação ao servidor. Tente novamente.', 'Sem conexão com o servidor. Tente novamente.'); }
    }
  }

  d.querySelector('.ac-x').onclick = () => fechar();
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !d.hidden) { e.preventDefault(); fechar(); } });
  document.addEventListener('click', e => {
    const b = e.target.closest('#bEnt'), a = e.target.closest('a[href]');
    if (b) { e.preventDefault(); e.stopImmediatePropagation(); if (!d.hidden && vista === 'entrar') return fechar(); return abrir(false); }
    if (a && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
      const u = new URL(a.href, location.href);
      if (u.origin === location.origin && u.pathname === '/SISTEMAS/entrar.html') {
        e.preventDefault(); e.stopImmediatePropagation();
        const criar = u.searchParams.has('criar');
        if (!d.hidden && (vista === 'criar') === criar) return fechar();
        return abrir(criar, u.searchParams.get('tipo'));
      }
    }
    // a meio de abrir conta (código ou perfil) um toque fora não fecha: só o X ou Esc
    if (!d.hidden && !e.composedPath().includes(d) && (vista === 'entrar' || vista === 'criar')) fechar(false);
  }, true);
  if (params.has('acesso')) abrir(params.get('acesso') === 'criar', params.get('tipo'));
})();
