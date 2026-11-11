// Consola de gestão (http://127.0.0.1:8099): Painel, Utilizadores, Email, Registos e Definições.
// Fala só com /api/gestao/* do servidor deste computador.
'use strict';
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x]));
  const E = { quem: null, rota: 'painel', timers: [], filtroContas: 'todas', pqContas: '', subEmail: 'servidor', modelo: null, subReg: 'atividade', fReg: { acao: '', texto: '', leituras: false } };

  /* ---------- pedidos ---------- */
  async function api(metodo, url, corpo) {
    let r; try { r = await fetch(url, { method: metodo, cache: 'no-store', headers: Object.assign({ 'X-BXB': '1' }, corpo ? { 'Content-Type': 'application/json' } : {}), body: corpo ? JSON.stringify(corpo) : undefined }); }
    catch (e) { throw new Error('O servidor não responde. Ligue-o no BXB Gestor.'); }
    let j = {}; try { j = await r.json(); } catch (e) { }
    if (r.status === 401 && !url.endsWith('/entrar')) { mostrarEntrar(E.quem ? 'A sessão na consola terminou. Entre de novo.' : ''); throw new Error(j.erro || 'Sem sessão'); }
    if (!r.ok) throw new Error(j.erro || 'Erro ' + r.status);
    return j;
  }
  function toast(t, tipo = 'ok') { const d = document.createElement('div'); d.className = 'toast ' + tipo; d.textContent = t; $('#toasts').appendChild(d); setTimeout(() => d.remove(), 4200); }

  /* ---------- ícones e formatos ---------- */
  const IC = {
    painel: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
    lista: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    def: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    sair: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    atualizar: '<path d="M21 12a9 9 0 1 1-2.64-6.36L21 8"/><path d="M21 3v5h-5"/>',
    enviar: '<path d="m22 2-7 20-4-9-9-4 20-7z"/>',
    chave: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>',
    tema: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
  };
  const ic = (n, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n]}</svg>`;
  const pad = n => String(n).padStart(2, '0');
  const dataHora = iso => { if (!iso) return '—'; const d = new Date(iso); if (isNaN(d)) return String(iso); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const dataCurta = iso => dataHora(iso).slice(0, 10);
  const hora = iso => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
  const relativo = iso => { if (!iso) return 'nunca'; const s = (Date.now() - new Date(iso)) / 1000;
    if (s < 60) return 'agora mesmo'; if (s < 3600) return `há ${Math.floor(s / 60)} min`; if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
    if (s < 7 * 86400) { const d = Math.floor(s / 86400); return d === 1 ? 'ontem' : `há ${d} dias`; } return dataCurta(iso); };
  const duracao = ms => { const m = Math.floor(ms / 60000); if (m < 1) return 'menos de 1 min'; if (m < 60) return m + ' min';
    const h = Math.floor(m / 60); if (h < 24) return `${h} h ${m % 60} min`; const d = Math.floor(h / 24); return `${d} ${d === 1 ? 'dia' : 'dias'} ${h % 24} h`; };
  const tamanho = b => b < 1024 ? b + ' B' : b < 1048576 ? Math.round(b / 1024) + ' KB' : (b / 1048576).toFixed(1).replace('.', ',') + ' MB';
  const nInt = n => Number(n || 0).toLocaleString('pt-PT');
  const plural = (n, um, varios) => `${nInt(n)} ${n === 1 ? um : varios}`;
  const ipCurto = ip => String(ip || '').replace(/^::ffff:/, '');
  const aparelho = ua => { ua = ua || '';
    const so = /iPhone|iPad/.test(ua) ? 'iPhone/iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Aparelho desconhecido';
    const nav = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : '';
    return nav ? `${nav} · ${so}` : so; };

  // nomes das ações do registo
  const ACOES = { CONTA_CRIADA_VERIFICADA: 'Criou conta (email confirmado)', PERFIL_COMPLETO: 'Completou o perfil', GESTAO_VERIFICACAO_LIGADA: 'Ligou a confirmação do email', GESTAO_VERIFICACAO_DESLIGADA: 'Desligou a confirmação do email', GESTAO_PERFIL_GUARDADO: 'Perfil guardado', GESTAO_OPERADOR_ALTERADO: 'Acessos do operador alterados', ENTRADA: 'Entrou', ENTRADA_FALHADA: 'Entrada falhada', SAIDA: 'Saiu', CONTA_CRIADA: 'Conta criada', AREA_CRIADA: 'Área criada', LEITURA: 'Leu os dados',
    GRAVACAO: 'Gravou', APAGADO: 'Apagou', ACESSO_RECUSADO: 'Acesso recusado', CONTACTO_ADICIONADO: 'Juntou um contacto', COLABORADOR_CONVIDADO: 'Convidou colaborador',
    COLABORADOR_RETIRADO: 'Retirou colaborador', CONVITE_ACEITE: 'Aceitou convite', PALAVRA_ALTERADA: 'Mudou a palavra-passe', ADMIN_CONTA_ALTERADA: 'Conta alterada (admin)',
    ADMIN_SESSOES_TERMINADAS: 'Sessões terminadas (admin)', CONFIGURADO: 'Servidor configurado', SERVIDOR_LIGADO: 'Servidor ligado', SERVIDOR_DESLIGADO: 'Servidor desligado',
    GESTAO_ENTRADA: 'Entrou na consola', GESTAO_ENTRADA_FALHADA: 'Entrada na consola falhada', GESTAO_EMAIL_CONFIGURADO: 'Email configurado', GESTAO_EMAIL_TESTE: 'Email de teste',
    GESTAO_MODELO_ALTERADO: 'Modelo de email alterado', GESTAO_MODELO_REPOSTO: 'Modelo de email reposto', GESTAO_DEFINICOES: 'Definições alteradas', GESTAO_CHAVE_NOVA: 'Chave da consola renovada' };
  const nomeAcao = a => ACOES[a] || String(a).toLowerCase().replace(/_/g, ' ');
  const tomAcao = a => /FALHADA|RECUSADO/.test(a) ? 'bad' : /^(ADMIN|GESTAO)/.test(a) ? 'acc' : /^SERVIDOR|^CONFIGURADO/.test(a) ? 'info' : /CRIADA|ENTRADA$/.test(a) ? 'ok' : 'plain';
  const GRUPOS = [['', 'Todas as ações'], ['ENTRADA', 'Entradas e tentativas'], ['ENTRADA_FALHADA', 'Entradas falhadas'], ['CONTA_CRIADA', 'Contas criadas'], ['GRAVACAO', 'Gravações'],
    ['ACESSO_RECUSADO', 'Acessos recusados'], ['COLABORADOR', 'Colaboradores'], ['ADMIN', 'Administração'], ['GESTAO', 'Consola de gestão'], ['SERVIDOR', 'Servidor']];
  const tabelaRegisto = (l, vazio = 'Sem atividade') => !l.length ? `<div class="empty">${vazio}</div>` :
    `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Quando</th><th>Quem</th><th>O quê</th><th>Detalhe</th><th>Origem</th></tr></thead><tbody>${l.map(r => `<tr>
      <td class="g-nw" title="${dataHora(r.em)}">${relativo(r.em)}</td>
      <td>${r.nome ? `<div class="g-quem-cel"><b>${esc(r.nome)}</b><span>${esc(r.email || '')}</span></div>` : '<span class="faint">sistema</span>'}</td>
      <td><span class="badge ${tomAcao(r.acao)}">${esc(nomeAcao(r.acao))}</span></td>
      <td class="muted">${esc(r.alvo || '')}</td><td class="mono faint g-nw">${esc(ipCurto(r.ip))}</td></tr>`).join('')}</tbody></table></div>`;

  /* ---------- janelas ---------- */
  function modal(html, larga) {
    const ov = document.createElement('div'); ov.className = 'overlay'; ov.innerHTML = `<div class="modal${larga ? ' wide' : ''}" role="dialog" aria-modal="true">${html}</div>`;
    const fechar = () => { ov.remove(); document.removeEventListener('keydown', tecla); }, tecla = e => { if (e.key === 'Escape') fechar(); };
    ov.addEventListener('mousedown', e => { if (e.target === ov) fechar(); }); $$('[data-x]', ov).forEach(b => b.onclick = fechar);
    document.addEventListener('keydown', tecla); document.body.appendChild(ov); ov.fechar = fechar; return ov;
  }
  const msg = (el, t, tipo) => { el.innerHTML = t ? `<div class="alert ${tipo || 'ok'}" style="margin-top:12px"><div>${esc(t)}</div></div>` : ''; };

  /* ---------- entrar ---------- */
  function mostrarEntrar(aviso) {
    pararTimers(); E.quem = null;
    $('#app').innerHTML = `<div class="g-entrar"><div class="card">
      <div class="brand"><div class="brand-logo">BXB</div><div><div class="brand-name">BXB</div><div class="brand-sub">Consola de gestão</div></div></div>
      <h1>Entrar na consola</h1><p>Use a sua conta de operador ou abra pelo BXB Gestor.</p>
      ${aviso ? `<div class="alert warn" style="margin-bottom:16px"><div>${esc(aviso)}</div></div>` : ''}
      <form class="form" id="fe">
        <div class="fld"><label for="fe-em">Email</label><input class="inp" id="fe-em" name="email" type="email" autocomplete="username" required></div>
        <div class="fld"><label for="fe-pp">Palavra-passe</label><input class="inp" id="fe-pp" name="palavra" type="password" autocomplete="current-password" required></div>
        <div class="fld"><button class="btn primary" type="submit" style="justify-content:center">Entrar</button></div><div id="fe-e"></div>
      </form></div></div>`;
    $('#fe').onsubmit = async e => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
      try { await api('POST', '/api/gestao/entrar', f); await entrou(); } catch (x) { msg($('#fe-e'), x.message, 'bad'); } };
  }
  async function entrou() {
    E.quem = await api('GET', '/api/gestao/quem'); montar();
    if (!location.hash || location.hash.length < 2) history.replaceState(null, '', '#painel'); ir();
  }

  /* ---------- estrutura ---------- */
  const ROTAS = { painel: ['Painel', 'painel', 'Estado do servidor e do sistema'], utilizadores: ['Utilizadores', 'users', 'Contas, acessos e sessões'],
    email: ['Email', 'mail', 'Servidor de envio, modelos e emails enviados'], registos: ['Registos', 'lista', 'Atividade, servidor e rede'], definicoes: ['Definições', 'def', 'Projeto, servidor e acesso à consola'], operadores: ['Perfis e operadores', 'users', 'Acessos dos funcionários à consola'] };
  const pode = k => k === 'painel' || (E.quem.acessos || []).includes(k);
  function montar() {
    const marca = E.quem.marca || 'BXB', sigla = marca.length <= 4 ? marca.toUpperCase() : marca.split(/\s+/).map(p => p[0]).join('').slice(0, 3).toUpperCase();
    $('#app').innerHTML = `<div class="shell g-shell"><aside class="side">
        <div class="brand"><div class="brand-logo">${esc(sigla)}</div><div><div class="brand-name">${esc(marca)}</div><div class="brand-sub">Consola de gestão</div></div></div>
        <nav class="nav">${Object.entries(ROTAS).filter(([k]) => pode(k)).map(([k, [t, i]]) => `<a href="#${k}" data-r="${k}">${ic(i)}<span>${t}</span></a>`).join('')}</nav>
        <div class="side-foot"><div class="g-quem">Entrou como <b>${esc(E.quem.nome)}</b></div>
          <div class="row" style="gap:6px"><button class="btn sm ghost" id="bt-tema">${ic('tema', 15)} Tema</button><button class="btn sm ghost" id="bt-sair">${ic('sair', 15)} Sair</button></div></div>
      </aside><main>
        <div class="top"><div><h1 id="t-h"></h1><div class="crumb" id="t-c"></div></div><div class="spacer"></div><div class="g-estado" id="t-e"></div>
          <button class="btn sm" id="bt-at" title="Atualizar">${ic('atualizar', 15)} Atualizar</button></div>
        <div id="view"></div></main></div>`;
    $('#bt-at').onclick = () => ir();
    $('#bt-tema').onclick = () => { const t = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light'; document.documentElement.setAttribute('data-theme', t); try { localStorage.setItem('gestao:tema', t); } catch (e) { } };
    $('#bt-sair').onclick = async () => { try { await api('POST', '/api/gestao/sair', {}); } catch (e) { } mostrarEntrar(); };
    verSaude();
  }
  const pararTimers = () => { E.timers.forEach(clearInterval); E.timers = []; };
  const repetir = (fn, ms) => E.timers.push(setInterval(() => { if (!document.hidden) fn(); }, ms));
  async function ir() {
    if (!E.quem) return; pararTimers();
    try { const quem=await api('GET','/api/gestao/quem');const mudou=JSON.stringify(quem.acessos)!==JSON.stringify(E.quem.acessos);E.quem=quem;if(mudou)montar(); }
    catch(e){if(E.quem)toast(e.message,'bad');return;}
    if (!E.quem) return;
    const r = location.hash.slice(1).split('/')[0]; E.rota = ROTAS[r] && pode(r) ? r : 'painel';
    $$('.nav a').forEach(a => a.classList.toggle('active', a.dataset.r === E.rota));
    const [t, , c] = ROTAS[E.rota]; $('#t-h').textContent = t; $('#t-c').textContent = c; document.title = t + ' · Consola de gestão';
    $('#view').innerHTML = '<div class="empty">A carregar…</div>';
    VISTAS[E.rota]().catch(e => { if (E.quem) $('#view').innerHTML = `<div class="alert bad"><div>${esc(e.message)}</div></div>`; });
  }
  async function verSaude() {
    const el = $('#t-e'); if (!el) return;
    try { const r = await fetch('/api/gestao/saude', { cache: 'no-store' }), s = await r.json();
      el.innerHTML = `<span class="badge ok" title="Processo ${s.pid}">Servidor ligado · há ${duracao(Date.now() - s.arranque)}</span>`; }
    catch (e) { el.innerHTML = '<span class="badge bad">O servidor não responde</span>'; }
  }

  const VISTAS = {};

  /* ---------- Painel ---------- */
  VISTAS.painel = async (refresco) => {
    if (!E.quem.administrador) {
      const {resumo} = await api('GET','/api/gestao/dashboard');
      if(E.rota !== 'painel') return;
      $('#view').innerHTML = `<div class="card"><h2>Olá, ${esc(E.quem.nome)}</h2><p class="muted">Escolha uma ferramenta para começar.</p>${resumo.painel?`<p><b>Servidor: ${esc(resumo.painel.valor)}</b> · ${esc(resumo.painel.detalhe)}</p>`:''}</div><div class="g-duas" style="margin-top:16px">${Object.entries(ROTAS).filter(([k]) => k !== 'painel' && pode(k)).map(([k,[t,i,desc]]) => `<a class="card" style="text-decoration:none;color:inherit" href="#${k}">${ic(i,24)}<h3>${t}</h3><p class="muted">${desc}</p>${resumo[k]?`<p><b>${esc(resumo[k].rotulo)}: ${esc(resumo[k].valor)}</b></p>`:''}</a>`).join('')}</div>`;
      return;
    }
    const p = await api('GET', '/api/gestao/painel'), s = p.servidor, c = p.contas;
    if (E.rota !== 'painel') return;
    // regra do sistema: no máximo 2 quadros de números; o resto vai ao lado, no mesmo quadro
    const kpi = (rot, val, foot, lado) => `<div class="card kpi tem-lado"><div class="kpi-lado"><div class="lbl">${lado[0]}</div><div class="val num">${lado[1]}</div>${lado[2] ? `<div class="foot">${lado[2]}</div>` : ''}</div>
      <div class="lbl">${rot}</div><div class="val num">${val}</div><div class="foot">${foot}</div></div>`;
    const lin = (a, b, cls = '') => `<div class="g-lin"><span>${a}</span><b class="${cls}">${b}</b></div>`;
    $('#view').innerHTML = `${s.versaoDisco && s.versao && s.versaoDisco !== s.versao ? `<div class="alert warn" style="margin-bottom:16px"><div>Há uma versão nova do código (${esc(s.versao)} → ${esc(s.versaoDisco)}). Reinicie o servidor no BXB Gestor para a usar.</div></div>` : ''}
      <div class="grid g2">
        ${kpi('Contas ativas', nInt(c.ativas), `${nInt(c.novas30)} ${c.novas30 === 1 ? 'nova' : 'novas'} nos últimos 30 dias · ${plural(p.areas.particular, 'particular', 'particulares')}, ${plural(p.areas.empresa, 'empresa', 'empresas')}`, ['Com sessão aberta', nInt(c.comSessao), `${nInt(c.sessoes)} ${c.sessoes === 1 ? 'sessão' : 'sessões'}`])}
        ${kpi('Servidor ligado há', duracao(Date.now() - s.arranque), `Versão ${esc(s.versao || '—')} · Node ${esc(s.node)} · ${tamanho(s.memoria)} de memória`, ['Entradas (7 dias)', nInt(p.entradas.d7), `${nInt(p.entradas.falhadas7)} falhadas`])}
      </div>
      <div class="grid g2" style="margin-top:16px">
        <div class="card"><div class="card-h"><h3>Endereços</h3></div><div class="g-lista">${s.enderecos.map(e => `<div class="g-lin"><span>${esc(e.nome)}</span><a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.url.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</a></div>`).join('')}</div></div>
        <div class="card"><div class="card-h"><h3>Email</h3>${p.email.pronto ? '<span class="badge ok">Configurado</span>' : '<span class="badge warn">Por configurar</span>'}</div>
          <div class="g-lista">${lin('Conta de envio', esc(p.email.conta || '—'))}${lin('Enviados (7 dias)', nInt(p.email.enviados7))}${lin('Falhados (7 dias)', nInt(p.email.falhados7), p.email.falhados7 ? 'neg' : '')}</div>
          ${p.email.pronto ? '' : '<a class="btn sm" href="#email" style="margin-top:12px">Configurar o envio</a>'}</div>
        <div class="card"><div class="card-h"><h3>Base de dados</h3></div><div class="g-lista">${lin('Tamanho', tamanho(s.bd))}${lin('Cópias diárias', nInt(s.copias) + (s.ultimaCopia ? ' · última a ' + dataCurta(s.ultimaCopia) : ''))}
          <div class="g-lin"><span>Pasta</span><span class="mono" title="${esc(s.dados)}">${esc(s.dados)}</span></div></div></div>
        <div class="card"><div class="card-h"><h3>Segurança (7 dias)</h3></div><div class="g-lista">${lin('Entradas falhadas', nInt(p.entradas.falhadas7), p.entradas.falhadas7 >= 10 ? 'neg' : '')}${lin('Acessos recusados', nInt(p.entradas.recusados7), p.entradas.recusados7 ? 'neg' : '')}${lin('Administradores ativos', nInt(c.admins))}</div></div>
      </div>
      <div class="card flush" style="margin-top:16px"><div class="card-h"><h3>Atividade recente</h3><a class="btn sm ghost" href="#registos">Ver tudo</a></div>${tabelaRegisto(p.atividade)}</div>`;
    if (!refresco) repetir(() => VISTAS.painel(true).catch(() => { }), 20000);
  };

  /* ---------- Utilizadores ---------- */
  const FILTROS = { todas: ['Todas', () => true], ativas: ['Ativas', x => x.ativo], inativas: ['Desativadas', x => !x.ativo], admins: ['Administradores', x => x.admin] };
  VISTAS.utilizadores = async () => {
    const lista = await api('GET', '/api/gestao/contas'); if (E.rota !== 'utilizadores') return;
    $('#view').innerHTML = `<div class="g-barra"><div class="tabs" id="tb">${Object.entries(FILTROS).map(([k, [t, f]]) => `<button data-f="${k}" class="${k === E.filtroContas ? 'on' : ''}">${t}<span class="n">${lista.filter(f).length}</span></button>`).join('')}</div>
      <input class="inp" id="pq" type="search" placeholder="Procurar por nome ou email" value="${esc(E.pqContas)}"></div><div class="card flush" id="tc"></div>`;
    const pintar = () => {
      const t = E.pqContas.trim().toLowerCase(), l = lista.filter(FILTROS[E.filtroContas][1]).filter(x => !t || (x.nome + ' ' + (x.email || '')).toLowerCase().includes(t));
      $('#tc').innerHTML = !l.length ? '<div class="empty">Nenhuma conta</div>' : `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Conta</th><th>Áreas</th><th>Criada</th><th>Última entrada</th><th class="r">Sessões</th><th>Estado</th></tr></thead><tbody>
        ${l.map(x => `<tr class="click" data-id="${esc(x.id)}"><td><div class="g-quem-cel"><b>${esc(x.nome)}${x.admin ? ' <span class="badge acc plain">admin</span>' : ''}</b><span>${esc(x.email || '—')}</span></div></td>
          <td>${x.areas.map(a => `<span class="badge plain" title="${esc(a.nome)}">${a.tipo === 'empresa' ? 'Empresa' : 'Particular'}${a.papel === 'colaborador' ? ' · colaborador' : ''}</span>`).join('') || '<span class="faint">—</span>'}</td>
          <td class="g-nw">${dataCurta(x.criada_em)}</td><td class="g-nw" title="${x.ultima ? dataHora(x.ultima) : ''}">${relativo(x.ultima)}</td>
          <td class="r num">${x.sessoes ? x.sessoes : '<span class="faint">0</span>'}</td><td>${x.ativo ? '<span class="badge ok">Ativa</span>' : '<span class="badge bad">Desativada</span>'}</td></tr>`).join('')}</tbody></table></div>`;
      $$('#tc tr[data-id]').forEach(tr => tr.onclick = () => gerirConta(tr.dataset.id));
    };
    $$('#tb button').forEach(b => b.onclick = () => { E.filtroContas = b.dataset.f; $$('#tb button').forEach(x => x.classList.toggle('on', x === b)); pintar(); });
    $('#pq').oninput = e => { E.pqContas = e.target.value; pintar(); };
    pintar();
  };
  const gerarPalavra = () => { const a = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789', v = crypto.getRandomValues(new Uint32Array(12)); return [...v].map(n => a[n % a.length]).join(''); };
  async function gerirConta(id) {
    const d = await api('GET', '/api/gestao/conta?id=' + encodeURIComponent(id)), x = d.conta;
    const ov = modal(`<div class="modal-h"><div><h2>${esc(x.nome)}</h2><p>${esc(x.email || '')} · conta criada a ${dataCurta(x.criada_em)}</p></div><button class="btn ghost icon" data-x aria-label="Fechar">${ic('x', 16)}</button></div>
      <div class="modal-b">
        <form class="form" id="fc">
          <div class="fld"><label>Nome</label><input class="inp" name="nome" value="${esc(x.nome)}" required maxlength="80"></div>
          <div class="fld"><label>Email</label><input class="inp" name="email" type="email" value="${esc(x.email || '')}" required></div>
          <label class="check"><input type="checkbox" name="ativo" ${x.ativo ? 'checked' : ''}> Conta ativa (pode entrar)</label>
          <label class="check"><input type="checkbox" name="admin" ${x.admin ? 'checked' : ''}> Administrador</label>
          <div class="fld full"><div class="row"><button class="btn primary" type="submit">Guardar</button></div><div id="fc-m"></div></div>
        </form>
        <div class="g-modal-sec"><h4>Repor a palavra-passe</h4>
          <form class="form" id="fp">
            <div class="fld"><label>Nova palavra-passe (mín. 8)</label><div class="row" style="flex-wrap:nowrap"><input class="inp mono" name="palavra" minlength="8" required autocomplete="new-password"><button class="btn sm" type="button" id="gerar">Gerar</button></div></div>
            <div class="fld"><label>&nbsp;</label><label class="check"><input type="checkbox" name="avisar" checked> Avisar a pessoa por email</label></div>
            <div class="fld full"><div class="hint">Diga a nova palavra-passe à pessoa por telefone ou pessoalmente. As sessões abertas desta conta terminam.</div>
              <div class="row" style="margin-top:8px"><button class="btn" type="submit">${ic('chave', 15)} Repor palavra-passe</button></div><div id="fp-m"></div></div>
          </form></div>
        <div class="g-modal-sec"><div class="row between"><h4>Sessões abertas (${d.sessoes.length})</h4>${d.sessoes.length ? '<button class="btn sm bad" id="ts">Terminar todas</button>' : ''}</div>
          ${d.sessoes.map(s => `<div class="g-sess"><div><b>${esc(aparelho(s.agente))}</b><br><span>desde ${dataHora(s.criada)} · última atividade ${relativo(s.visto)} · ${esc(ipCurto(s.ip))}</span></div><button class="btn sm ghost" data-s="${s.id}">Terminar</button></div>`).join('') || '<div class="faint" style="font-size:13px">Nenhuma sessão aberta.</div>'}</div>
        <div class="g-modal-sec"><h4>Atividade</h4><div class="card flush">${tabelaRegisto(d.registo)}</div></div>
      </div>`, true);
    const reabrir = t => { toast(t); ov.fechar(); gerirConta(id); if (E.rota === 'utilizadores') VISTAS.utilizadores(); };
    $('#fc', ov).onsubmit = async e => { e.preventDefault(); const f = e.target;
      try { await api('POST', '/api/gestao/conta', { id, nome: f.nome.value, email: f.email.value, ativo: f.ativo.checked, admin: f.admin.checked }); reabrir('Conta guardada'); }
      catch (x2) { msg($('#fc-m', ov), x2.message, 'bad'); } };
    $('#gerar', ov).onclick = () => { $('#fp', ov).palavra.value = gerarPalavra(); };
    $('#fp', ov).onsubmit = async e => { e.preventDefault(); const f = e.target;
      if (!confirm('Repor a palavra-passe de ' + x.nome + '? As sessões abertas desta conta terminam.')) return;
      try { await api('POST', '/api/gestao/conta', { id, palavra: f.palavra.value, avisar: f.avisar.checked }); reabrir('Palavra-passe reposta'); }
      catch (x2) { msg($('#fp-m', ov), x2.message, 'bad'); } };
    const ts = $('#ts', ov); if (ts) ts.onclick = async () => { if (!confirm('Terminar todas as sessões de ' + x.nome + '? Tem de voltar a entrar em todos os aparelhos.')) return;
      try { await api('POST', '/api/gestao/conta/sessoes', { id }); reabrir('Sessões terminadas'); } catch (x2) { toast(x2.message, 'bad'); } };
    $$('[data-s]', ov).forEach(b => b.onclick = async () => { try { await api('POST', '/api/gestao/conta/sessoes', { id, sessao: +b.dataset.s }); reabrir('Sessão terminada'); } catch (x2) { toast(x2.message, 'bad'); } });
  }

  /* ---------- Email ---------- */
  VISTAS.email = async () => {
    const d = await api('GET', '/api/gestao/email'); if (E.rota !== 'email') return;
    const falhados = d.enviados.filter(x => x.estado === 'falhou').length;
    $('#view').innerHTML = `<div class="g-barra"><div class="tabs" id="te">${[['servidor', 'Servidor de envio'], ['modelos', 'Modelos'], ['enviados', 'Enviados']].map(([k, t]) =>
      `<button data-t="${k}" class="${k === E.subEmail ? 'on' : ''}">${t}${k === 'enviados' ? `<span class="n">${d.enviados.length}${falhados ? ' · ' + falhados + ' falhados' : ''}</span>` : k === 'modelos' ? `<span class="n">${d.modelos.length}</span>` : ''}</button>`).join('')}</div>
      ${d.smtp.temPalavra || (d.smtp.servidor && !d.smtp.utilizador && d.smtp.remetente) ? '<span class="badge ok">Envio configurado</span>' : '<span class="badge warn">Envio por configurar</span>'}</div><div id="ce"></div>`;
    $$('#te button').forEach(b => b.onclick = () => { E.subEmail = b.dataset.t; VISTAS.email().catch(e => toast(e.message, 'bad')); });
    ({ servidor: emailServidor, modelos: emailModelos, enviados: emailEnviados })[E.subEmail](d);
  };
  function emailServidor(d) {
    const s = d.smtp;
    $('#ce').innerHTML = `<div class="grid g2" style="align-items:start">
      <div class="card"><div class="card-h"><h3>Servidor de envio (SMTP)</h3></div>
        <form class="form" id="fs" autocomplete="off">
          <div class="fld"><label>Servidor</label><input class="inp" name="servidor" value="${esc(s.servidor)}" required placeholder="smtp.gmail.com"></div>
          <div class="fld"><label>Ligação</label><select class="inp" name="seguranca"><option value="ssl"${s.seguranca === 'ssl' ? ' selected' : ''}>SSL (porta 465)</option><option value="starttls"${s.seguranca === 'starttls' ? ' selected' : ''}>STARTTLS (porta 587)</option></select></div>
          <div class="fld"><label>Porta</label><input class="inp" name="porta" type="number" min="1" max="65535" value="${esc(s.porta)}" required></div>
          <div class="fld"><label>Utilizador</label><input class="inp" name="utilizador" value="${esc(s.utilizador)}" placeholder="conta@gmail.com"></div>
          <div class="fld full"><label>Palavra-passe de aplicação</label><input class="inp" name="palavra" type="password" autocomplete="new-password" placeholder="${s.temPalavra ? 'Guardada. Deixe vazio para manter.' : 'As 16 letras que o Google gera'}">
            <div class="hint">Fica guardada cifrada neste computador. Não é a palavra-passe normal da conta Google.</div></div>
          <div class="fld"><label>Email do remetente</label><input class="inp" name="remetente" type="email" value="${esc(s.remetente)}" placeholder="Igual ao utilizador"></div>
          <div class="fld"><label>Nome do remetente</label><input class="inp" name="nomeRemetente" value="${esc(s.nomeRemetente)}" placeholder="${esc(d.geral.marca)}" maxlength="60"></div>
          <div class="fld full"><div class="row"><button class="btn primary" type="submit">Guardar</button>${s.temPalavra ? '<button class="btn ghost" type="button" id="apagar">Esquecer a palavra-passe guardada</button>' : ''}</div><div id="fs-m"></div></div>
        </form></div>
      <div class="stack">
        <div class="card"><div class="card-h"><h3>Criar conta no site</h3></div>
          <label class="check"><input type="checkbox" id="vr"${d.registo && d.registo.verificarEmail ? ' checked' : ''}> Confirmar o email com um código antes de criar a conta</label>
          <div class="hint" style="margin-top:8px">${s.temPalavra || s.utilizador ? 'Quem abre conta recebe um código de 6 dígitos (modelo «Confirmação do email») e só depois preenche o perfil.' : 'Só funciona depois de configurar o servidor de envio.'}</div></div>
        <div class="card"><div class="card-h"><h3>Enviar um email de teste</h3></div>
          <form class="row" id="ft" style="flex-wrap:nowrap"><input class="inp" name="para" type="email" required placeholder="para@exemplo.pt"><button class="btn" type="submit">${ic('enviar', 15)} Enviar</button></form><div id="ft-m"></div></div>
        <div class="card"><div class="card-h"><h3>Gmail: palavra-passe de aplicação</h3></div>
          <ol class="muted" style="margin:0;padding-left:18px;line-height:1.85">
            <li>Na conta Google da app, ative a <b>Verificação em dois passos</b>.</li>
            <li>Abra <b>myaccount.google.com/apppasswords</b>.</li>
            <li>Crie uma palavra-passe com o nome «${esc(d.geral.marca)}» e copie as 16 letras.</li>
            <li>Cole-as aqui, guarde e envie um teste.</li></ol></div>
        ${d.geral.urlPublico ? '' : '<div class="alert warn"><div>Os botões dos emails apontam para este computador. Indique o endereço público em <a href="#definicoes">Definições</a>.</div></div>'}
      </div></div>`;
    const f = $('#fs');
    f.seguranca.onchange = () => { f.porta.value = f.seguranca.value === 'ssl' ? 465 : 587; };
    const gravar = async extra => { try { await api('POST', '/api/gestao/email/smtp', Object.assign(Object.fromEntries(new FormData(f)), extra || {})); toast('Servidor de envio guardado'); VISTAS.email(); } catch (x) { msg($('#fs-m'), x.message, 'bad'); } };
    f.onsubmit = e => { e.preventDefault(); gravar(); };
    $('#vr').onchange = async e => { const on = e.target.checked; try { const r = await api('POST', '/api/gestao/email/registo', { verificarEmail: on }); toast(on ? (r.ativa ? 'Verificação do email ligada' : 'Ligada, mas só funciona com o servidor de envio configurado') : 'Verificação do email desligada'); } catch (x) { e.target.checked = !on; toast(x.message); } };
    const ap = $('#apagar'); if (ap) ap.onclick = () => { if (confirm('Esquecer a palavra-passe guardada? O envio de emails deixa de funcionar até indicar outra.')) gravar({ palavra: '', apagarPalavra: true }); };
    $('#ft').onsubmit = async e => { e.preventDefault(); const para = e.target.para.value, b = e.target.querySelector('button'); b.disabled = true; msg($('#ft-m'), 'A enviar…', 'info');
      try { await api('POST', '/api/gestao/email/teste', { para }); msg($('#ft-m'), `Enviado para ${para}. Veja a caixa de entrada (e o spam).`, 'ok'); }
      catch (x) { msg($('#ft-m'), x.message, 'bad'); } b.disabled = false; };
  }
  function emailModelos(d) {
    const m = d.modelos.find(x => x.id === E.modelo) || d.modelos[0]; E.modelo = m.id;
    const vars = [...new Set(['marca', ...m.vars, 'data'])];
    $('#ce').innerHTML = `<div class="g-modelos"><div>${d.modelos.map(x => `<button class="g-mod${x.id === m.id ? ' on' : ''}" data-m="${x.id}"><b>${esc(x.nome)}</b><span class="g-mod-q">${esc(x.quando)}</span>${x.ativo ? '<span class="badge ok">Ativo</span>' : '<span class="badge">Desligado</span>'}${x.alterado ? ' <span class="badge info plain">alterado</span>' : ''}</button>`).join('')}</div>
      <div class="card"><div class="card-h"><h3>${esc(m.nome)}</h3><label class="check"><input type="checkbox" id="m-at"${m.ativo ? ' checked' : ''}> Enviar este email</label></div>
        <div class="form" style="grid-template-columns:1fr">
          <div class="fld"><label for="m-as">Assunto</label><input class="inp" id="m-as" value="${esc(m.assunto)}" maxlength="200"></div>
          <div class="fld"><label for="m-ht">Texto</label><textarea class="inp g-html" id="m-ht" spellcheck="false">${esc(m.html)}</textarea>
            <div class="hint">HTML simples: &lt;p&gt; parágrafo, &lt;b&gt; negrito, &lt;a class="botao" href="{{link}}"&gt; botão. O cabeçalho com o nome e o rodapé são acrescentados no envio.</div></div>
          <div class="fld"><label>Campos (clique para inserir)</label><div class="g-vars">${vars.map(v => `<button type="button" data-v="${v}">{{${v}}}</button>`).join('')}</div></div>
          <div class="row"><button class="btn primary" id="m-gu">Guardar</button>${m.alterado ? '<button class="btn ghost" id="m-re">Repor o texto original</button>' : ''}
            <span style="flex:1"></span><input class="inp inp-sm" id="m-pa" type="email" placeholder="Enviar teste para…" style="width:220px"><button class="btn" id="m-te">${ic('enviar', 15)} Testar</button></div>
          <div id="m-msg"></div>
        </div>
        <div class="g-pre"><div class="g-pre-h">Assunto: <b id="pv-as"></b> <span class="faint">· pré-visualização com dados de exemplo</span></div><iframe id="pv" sandbox title="Pré-visualização do email"></iframe></div>
      </div></div>`;
    $$('[data-m]').forEach(b => b.onclick = () => { E.modelo = b.dataset.m; emailModelos(d); });
    const as = $('#m-as'), ht = $('#m-ht'); let ultimo = ht, t = 0;
    const ver = async () => { try { const r = await api('POST', '/api/gestao/email/pre-visualizar', { id: m.id, assunto: as.value, html: ht.value }); $('#pv-as').textContent = r.assunto; $('#pv').srcdoc = r.html; } catch (e) { } };
    [as, ht].forEach(el => { el.addEventListener('focus', () => { ultimo = el; }); el.addEventListener('input', () => { clearTimeout(t); t = setTimeout(ver, 350); }); });
    $$('[data-v]').forEach(b => b.onclick = () => { const el = ultimo, v = '{{' + b.dataset.v + '}}', i = el.selectionStart ?? el.value.length, j = el.selectionEnd ?? i;
      el.value = el.value.slice(0, i) + v + el.value.slice(j); el.focus(); el.selectionStart = el.selectionEnd = i + v.length; ver(); });
    $('#m-gu').onclick = async () => { try { await api('POST', '/api/gestao/email/modelo', { id: m.id, assunto: as.value, html: ht.value, ativo: $('#m-at').checked }); toast('Modelo guardado'); VISTAS.email(); } catch (e) { msg($('#m-msg'), e.message, 'bad'); } };
    const re = $('#m-re'); if (re) re.onclick = async () => { if (!confirm('Repor o texto original deste modelo? Perde as alterações.')) return; try { await api('POST', '/api/gestao/email/modelo', { id: m.id, repor: true }); toast('Texto original reposto'); VISTAS.email(); } catch (e) { msg($('#m-msg'), e.message, 'bad'); } };
    $('#m-te').onclick = async () => { const para = $('#m-pa').value.trim(); if (!para) { $('#m-pa').focus(); return; } const b = $('#m-te'); b.disabled = true; msg($('#m-msg'), 'A enviar…', 'info');
      try { await api('POST', '/api/gestao/email/teste', { para, id: m.id, assunto: as.value, html: ht.value }); msg($('#m-msg'), `Teste enviado para ${para}.`, 'ok'); } catch (e) { msg($('#m-msg'), e.message, 'bad'); } b.disabled = false; };
    ver();
  }
  function emailEnviados(d) {
    const nomes = Object.fromEntries(d.modelos.map(m => [m.id, m.nome])); nomes.teste = 'Teste';
    $('#ce').innerHTML = `<div class="card flush">${!d.enviados.length ? '<div class="empty">Ainda não foi enviado nenhum email.</div>' : `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Quando</th><th>Para</th><th>Modelo</th><th>Assunto</th><th>Estado</th></tr></thead><tbody>
      ${d.enviados.map(x => `<tr><td class="g-nw" title="${dataHora(x.em)}">${relativo(x.em)}</td><td>${esc(x.para)}</td><td class="muted">${esc(nomes[x.modelo] || x.modelo || '')}</td><td>${esc(x.assunto || '')}</td>
        <td>${x.estado === 'enviado' ? '<span class="badge ok">Enviado</span>' : `<span class="badge bad">Falhou</span><div class="faint" style="font-size:12px;margin-top:4px;max-width:340px">${esc(x.erro || '')}</div>`}</td></tr>`).join('')}</tbody></table></div>`}</div>`;
  }

  /* ---------- Registos ---------- */
  VISTAS.registos = async () => {
    $('#view').innerHTML = `<div class="g-barra"><div class="tabs" id="tr">${[['atividade', 'Atividade'], ['servidor', 'Servidor'], ['rede', 'Rede']].map(([k, t]) => `<button data-t="${k}" class="${k === E.subReg ? 'on' : ''}">${t}</button>`).join('')}</div><div class="row" id="rf"></div></div><div id="cr"><div class="empty">A carregar…</div></div>`;
    $$('#tr button').forEach(b => b.onclick = () => { E.subReg = b.dataset.t; pararTimers(); VISTAS.registos().catch(e => toast(e.message, 'bad')); });
    await REG[E.subReg]();
  };
  const linhasLog = (l, fmt) => l.length ? l.map(fmt).join('\n') : '<span class="t">Sem linhas.</span>';
  const pintarLog = html => { const pre = $('#cr pre'); if (!pre) return; const fundo = pre.scrollHeight - pre.scrollTop - pre.clientHeight < 40; pre.innerHTML = html; if (fundo) pre.scrollTop = pre.scrollHeight; };
  const REG = {
    async atividade() {
      const f = E.fReg;
      $('#rf').innerHTML = `<select class="inp inp-sm" id="fa">${GRUPOS.map(([v, t]) => `<option value="${v}"${v === f.acao ? ' selected' : ''}>${t}</option>`).join('')}</select>
        <input class="inp inp-sm" id="fq" type="search" placeholder="Procurar quem, email ou IP" value="${esc(f.texto)}" style="width:220px">
        <label class="check"><input type="checkbox" id="fl"${f.leituras ? ' checked' : ''}> Mostrar leituras</label>`;
      let lista = [], t = 0;
      const carregar = async mais => {
        const p = new URLSearchParams({ acao: f.acao, texto: f.texto, leituras: f.leituras ? '1' : '', limite: 200 }); if (mais && lista.length) p.set('antes', lista[lista.length - 1].em);
        const l = await api('GET', '/api/gestao/registo?' + p); lista = mais ? lista.concat(l) : l;
        $('#cr').innerHTML = `<div class="card flush">${tabelaRegisto(lista, 'Nada no registo com estes filtros')}</div>${l.length === 200 ? '<div class="g-mais"><button class="btn sm" id="mais">Carregar mais</button></div>' : ''}`;
        const b = $('#mais'); if (b) b.onclick = () => carregar(true).catch(e => toast(e.message, 'bad'));
      };
      $('#fa').onchange = e => { f.acao = e.target.value; carregar(); };
      $('#fq').oninput = e => { f.texto = e.target.value; clearTimeout(t); t = setTimeout(carregar, 300); };
      $('#fl').onchange = e => { f.leituras = e.target.checked; carregar(); };
      await carregar();
    },
    async servidor() {
      $('#rf').innerHTML = '<span class="faint" style="font-size:12.5px">O que o servidor escreveu desde que ligou · atualiza sozinho</span>';
      $('#cr').innerHTML = '<pre class="g-log"></pre>';
      const ver = async () => { const l = await api('GET', '/api/gestao/consola'); pintarLog(linhasLog(l, x => `<span class="t">${hora(x.em)}</span> <span class="${x.nivel}">${esc(x.t)}</span>`)); };
      await ver(); const pre = $('#cr pre'); pre.scrollTop = pre.scrollHeight; repetir(() => ver().catch(() => { }), 3000);
    },
    async rede() {
      $('#cr').innerHTML = '<pre class="g-log"></pre>';
      const ver = async () => { const r = await api('GET', '/api/gestao/rede?linhas=400');
        $('#rf').innerHTML = `<span class="faint mono" style="font-size:12px">${esc(r.ficheiro)}</span>`;
        pintarLog(linhasLog(r.linhas, l => { const m = /^(\S+)\s(.*)$/.exec(l); return m ? `<span class="t">${esc(dataHora(m[1]))}</span> <span class="${/erro/i.test(m[2]) ? 'warn' : 'info'}">${esc(m[2])}</span>` : esc(l); })); };
      await ver(); const pre = $('#cr pre'); pre.scrollTop = pre.scrollHeight; repetir(() => ver().catch(() => { }), 5000);
    },
  };

  /* ---------- Definições ---------- */
  VISTAS.definicoes = async () => {
    const d = await api('GET', '/api/gestao/definicoes'), g = d.geral; if (E.rota !== 'definicoes') return;
    $('#view').innerHTML = `<div class="grid g2" style="align-items:start">
      <div class="card"><div class="card-h"><h3>Projeto</h3></div>
        <form class="form" id="fg">
          <div class="fld"><label>Nome do projeto</label><input class="inp" name="marca" value="${esc(g.marca)}" maxlength="40" required><div class="hint">Aparece nos emails e nesta consola.</div></div>
          <div class="fld"><label>Email de apoio</label><input class="inp" name="emailSuporte" type="email" value="${esc(g.emailSuporte)}" placeholder="apoio@…"><div class="hint">Vai no rodapé dos emails.</div></div>
          <div class="fld full"><label>Descrição</label><input class="inp" name="descricao" value="${esc(g.descricao)}" maxlength="120"></div>
          <div class="fld full"><label>Endereço público</label><input class="inp" name="urlPublico" value="${esc(g.urlPublico)}" placeholder="https://…"><div class="hint">O endereço com que os clientes abrem o site na internet. Os botões dos emails apontam para aqui.</div></div>
          <div class="fld full"><div class="row"><button class="btn primary" type="submit">Guardar</button></div><div id="fg-m"></div></div>
        </form></div>
      <div class="stack">
        <div class="card"><div class="card-h"><h3>Servidor</h3></div><div class="g-lista">
          <div class="g-lin"><span>Pasta dos dados</span><span class="mono" title="${esc(d.dados)}">${esc(d.dados)}</span></div>
          <div class="g-lin"><span>Portas</span><b>site ${d.portas.site || '—'} · rede ${d.portas.rede || 'fechada'} · consola ${d.portas.gestao || '—'}</b></div>
          <div class="g-lin"><span>Versão do código</span><b class="mono">${esc(d.versao || '—')}</b></div></div></div>
        <div class="card"><div class="card-h"><h3>Acesso à consola</h3></div>
          <p class="muted" style="margin:0 0 12px">O BXB Gestor abre a consola com a chave guardada em <span class="mono" style="font-size:12px;word-break:break-all">${esc(d.chave)}</span>. Uma chave nova fecha todas as sessões abertas na consola, incluindo esta.</p>
          <button class="btn bad" id="kn">${ic('chave', 15)} Gerar chave nova</button></div>
      </div></div>`;
    $('#fg').onsubmit = async e => { e.preventDefault();
      try { const r = await api('POST', '/api/gestao/definicoes', Object.fromEntries(new FormData(e.target))); toast('Definições guardadas');
        if (r.geral.marca !== E.quem.marca) { E.quem.marca = r.geral.marca; montar(); ir(); } }
      catch (x) { msg($('#fg-m'), x.message, 'bad'); } };
    $('#kn').onclick = async () => { if (!confirm('Gerar uma chave nova? Todas as sessões da consola terminam, incluindo esta. Volte a abrir a consola pelo BXB Gestor.')) return;
      try { await api('POST', '/api/gestao/chave-nova', {}); mostrarEntrar('Chave nova gerada. Abra a consola de novo pelo BXB Gestor.'); } catch (x) { toast(x.message, 'bad'); } };
  };


  VISTAS.operadores = async () => {
    const p=await api('GET','/api/gestao/operadores');if(E.rota!=='operadores')return;
    const admin=E.quem.administrador;
    $('#view').innerHTML=`<div class="g-duas"><div class="card"><div class="card-h"><h3>Perfis</h3>${admin?'<button class="btn sm" id="novo-perfil">Novo perfil</button>':''}</div>${p.perfis.map(x=>`<div class="g-lin"><div><b>${esc(x.nome)}</b><p class="muted">${x.acessos.map(k=>ROTAS[k]?.[0]||k).join(' · ')||'Sem acessos'}</p></div>${admin?`<button class="btn sm" data-perfil="${esc(x.id)}">Editar</button>`:''}</div>`).join('')||'<p class="muted">Crie um perfil para atribuir os acessos da equipa.</p>'}</div>
    <div class="card"><div class="card-h"><h3>Operadores</h3>${admin?'<button class="btn sm" id="novo-op">Novo operador</button>':''}</div>${p.operadores.map(x=>`<div class="g-lin"><div><b>${esc(x.nome)}</b><p class="muted">${esc(x.email)}${!x.ativo?' · Desativado':''}</p></div>${x.admin?'<span class="badge acc">Administrador</span>':`<select class="inp" style="max-width:180px" data-operador="${esc(x.id)}" ${!admin?'disabled':''}><option value="">Sem acesso à consola</option>${p.perfis.map(f=>`<option value="${esc(f.id)}" ${x.perfil===f.id?'selected':''}>${esc(f.nome)}</option>`).join('')}</select>`}</div>`).join('')}</div></div>`;
    async function editar(id) {
      const x=p.perfis.find(f=>f.id===id)||{nome:'',acessos:[]};
      const ov=modal(`<div class="modal-h"><h2>${id?'Editar':'Novo'} perfil</h2><button class="btn" data-x>Fechar</button></div><form class="modal-b" id="fp"><label>Nome<input class="inp" name="nome" required maxlength="80" value="${esc(x.nome)}"></label><div style="display:grid;gap:14px;margin:20px 0">${Object.entries(ROTAS).map(([k,[t]])=>`<label><input type="checkbox" name="acessos" value="${k}" ${x.acessos.includes(k)?'checked':''}> ${t}</label>`).join('')}</div><button class="btn primary">Guardar perfil</button><div role="alert"></div></form>`);
      $('#fp',ov).onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{await api('POST','/api/gestao/perfis',{id,nome:f.get('nome'),acessos:f.getAll('acessos')});ov.fechar();await VISTAS.operadores();}catch(x){$('[role=alert]',ov).textContent=x.message;}};
    }
    if(admin){$('#novo-perfil').onclick=()=>editar();$$('[data-perfil]').forEach(b=>b.onclick=()=>editar(b.dataset.perfil));
      $$('[data-operador]').forEach(s=>s.onchange=async()=>{s.disabled=true;try{await api('POST','/api/gestao/operadores',{id:s.dataset.operador,perfil:s.value});toast('Acessos atualizados');}catch(e){toast(e.message,'bad');}finally{await VISTAS.operadores();}});
      $('#novo-op').onclick=()=>{
        const ov=modal(`<div class="modal-h"><h2>Novo operador</h2><button class="btn" data-x>Fechar</button></div><form class="modal-b form" id="fo"><label>Nome<input class="inp" name="nome" required maxlength="80" autocomplete="name"></label><label>Email<input class="inp" name="email" type="email" required autocomplete="email"></label><label>Palavra-passe inicial<input class="inp" name="palavra" type="password" required minlength="8" autocomplete="new-password"></label><label>Perfil<select class="inp" name="perfil" required><option value="">Escolha o perfil</option>${p.perfis.map(f=>`<option value="${esc(f.id)}">${esc(f.nome)}</option>`).join('')}</select></label><button class="btn primary">Criar operador</button><div role="alert"></div></form>`);
        $('#fo',ov).onsubmit=async e=>{e.preventDefault();try{await api('POST','/api/gestao/operadores',Object.fromEntries(new FormData(e.target)));ov.fechar();await VISTAS.operadores();}catch(x){$('[role=alert]',ov).textContent=x.message;}};
      };
    }
  };
  /* ---------- arranque ---------- */
  async function iniciar() {
    try { const t = localStorage.getItem('gestao:tema'); if (t) document.documentElement.setAttribute('data-theme', t); } catch (e) { }
    window.addEventListener('hashchange', () => { if (/^#b=/.test(location.hash)) comBilhete(); else ir(); });
    setInterval(() => { if (!document.hidden) verSaude(); }, 15000);
    await comBilhete();
  }
  // aberta pelo BXB Gestor: o bilhete (uso único, 60 s) vem no endereço e sai logo dele
  async function comBilhete() {
    const b = /^#b=([a-f0-9]{16,})$/.exec(location.hash);
    if (b) { history.replaceState(null, '', location.pathname + '#painel');
      try { await api('POST', '/api/gestao/entrar', { bilhete: b[1] }); } catch (e) { return mostrarEntrar(e.message); } }
    try { await entrou(); } catch (e) { if (!$('.g-entrar')) $('#app').innerHTML = `<div class="g-entrar"><div class="alert bad"><div>${esc(e.message)}</div></div></div>`; }
  }
  iniciar();
})();
