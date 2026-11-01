/* =========================================================
   CONTA CORRENTE DA CASA PARTILHADA
   Calcula o que cada membro deve a outro a partir do livro
   da Casa (despesas comuns, membros, dívidas pontuais) e de
   um registo comum só de acrescentar (spap:<casa>:conta)
   onde os planos pessoais registam pagamentos e confirmam
   recebimentos, com assinatura de cada um.
   ========================================================= */
(function () {
'use strict';
const r2 = v => Math.round((+v || 0) * 100) / 100;
const PASSOS = { mensal: 1, pontual: 1, trimestral: 3, semestral: 6, anual: 12 };
const mensal = e => (+e.valor || 0) / (PASSOS[e.periodicidade] || 1);
const vigente = (e, ym) => (!e.inicio || ym >= e.inicio) && (!e.fim || ym <= e.fim);
// despesas de valor variável: valor real registado em cada mês (e.valores[AAAA-MM]); sem registo usa-se a média dos últimos 6 valores reais
const reais = e => Object.entries(e.valores || {}).filter(([, v]) => v !== '' && v != null && isFinite(+v)).sort((a, b) => a[0].localeCompare(b[0]));
const media = e => { const r = reais(e).slice(-6); return r.length ? r2(r.reduce((t, [, v]) => t + +v, 0) / r.length) : r2(mensal(e)); };
// despesa paga a prestações pelo cartão de crédito: em cada mês, prestação = opção de pagamento (% do saldo, com mínimo)
// sobre o saldo + juros (TAN/12) + imposto do selo (4% dos juros e 0,141%/mês do saldo); o 1.º mês não tem juros (período sem juros)
const cachePlano = new Map();
function planoCartao(e) {
  const k = JSON.stringify([e.capital, e.inicio, e.tan, e.pct, e.minimo, e.isJuros, e.isUtil, e.semJuros1, e.liquidadoEm]); if (cachePlano.has(k)) return cachePlano.get(k);
  const out = []; let saldo = +e.capital || 0, ym = e.inicio, i = 0; const tan = +e.tan || 0, pct = +e.pct || 0.05, min = e.minimo == null ? 25 : +e.minimo;
  const isJ = e.isJuros == null ? 0.04 : +e.isJuros, isU = e.isUtil == null ? 0.00141 : +e.isUtil;
  while (saldo > 0.005 && i < 480 && ym) {
    const semJuros = i === 0 && e.semJuros1 !== false, juros = semJuros ? 0 : r2(saldo * tan / 12), imp = semJuros ? 0 : r2(juros * isJ + saldo * isU);
    const total = r2(saldo + juros + imp); let prest = r2(Math.max(total * pct, Math.min(min, total))); if (e.liquidadoEm && ym >= e.liquidadoEm) prest = total;
    prest = Math.min(prest, total); const capital = r2(prest - juros - imp); saldo = r2(total - prest);
    out.push({ ym, juros, impostos: imp, capital, prestacao: prest, saldo }); ym = mesSeguinte(ym); i++;
  }
  cachePlano.set(k, out); return out;
}
const linhaPlano = (e, ym) => planoCartao(e).find(l => l.ym === ym) || null;
const ativaNoMes = (e, ym) => e.periodicidade === 'cartao' ? !!linhaPlano(e, ym) : vigente(e, ym);
const valorMes = (e, ym) => { if (e.periodicidade === 'cartao') { const l = linhaPlano(e, ym); return { valor: l ? l.prestacao : 0, real: true, plano: l }; }
  const v = (e.valores || {})[ym]; if (v !== '' && v != null && isFinite(+v)) return { valor: r2(+v), real: true };
  return e.variavel ? { valor: media(e), real: false } : { valor: r2(mensal(e)), real: true }; };
const ymHoje = () => new Date().toISOString().slice(0, 7);
const mesSeguinte = ym => { let [a, m] = ym.split('-').map(Number); m++; if (m > 12) { m = 1; a++; } return `${a}-${String(m).padStart(2, '0')}`; };
const fimMes = ym => { const [a, m] = ym.split('-').map(Number); return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10); };
const ler = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };

// parte de cada membro e quanto adianta num mês; e as transferências que acertam a diferença
function resumoMes(d, ym) {
  const ms = d.mod.membros || [], out = Object.fromEntries(ms.map(x => [x.id, { parte: 0, paga: 0 }]));
  (d.mod.despesas || []).filter(e => e.ativo !== false && ativaNoMes(e, ym)).forEach(e => { const v = valorMes(e, ym).valor;
    Object.entries(e.partes || {}).forEach(([id, q]) => { if (out[id]) out[id].parte += v * (+q || 0); });
    if (out[e.pagaPor]) out[e.pagaPor].paga += v; });
  ms.forEach(x => { const o = out[x.id]; o.parte = r2(o.parte); o.paga = r2(o.paga); o.saldo = r2(o.paga - o.parte); });
  return out;
}
function transferencias(saldos) {
  const dev = Object.entries(saldos).filter(([, v]) => v < -0.004).map(([id, v]) => ({ id, v: -v })).sort((a, b) => b.v - a.v);
  const cre = Object.entries(saldos).filter(([, v]) => v > 0.004).map(([id, v]) => ({ id, v })).sort((a, b) => b.v - a.v);
  const t = [];
  for (const dv of dev) for (const c of cre) { if (dv.v < 0.005) break; const x = r2(Math.min(dv.v, c.v)); if (x < 0.005) continue; t.push({ de: dv.id, para: c.id, valor: x }); dv.v -= x; c.v -= x; }
  return t;
}

// despesas variáveis de um mês ainda sem valor real registado
const estimadas = (d, ym) => (d.mod.despesas || []).filter(e => e.ativo !== false && e.variavel && vigente(e, ym) && !valorMes(e, ym).real);
const Conta = SPAP.contaCasa = {
  resumoMes, transferencias, fimMes, ymHoje, valorMes, media, estimadas, mesSeguinte, planoCartao, ativaNoMes,
  livro: casa => ler('spap:' + casa),
  registo: casa => Object.assign({ pagamentos: [], dividas: [], despesas: [] }, ler('spap:' + casa + ':conta') || {}),
  // lê, altera e grava logo a seguir (registo pequeno e só de acrescentar: não apaga o que outro sistema escreveu)
  alterar(casa, fn) { const r = Conta.registo(casa); const out = fn(r); localStorage.setItem('spap:' + casa + ':conta', JSON.stringify(r)); return out; },
  membros: casa => ((Conta.livro(casa) || {}).mod || {}).membros || [],
  // despesas da casa: as do livro da casa e as acrescentadas pelos planos pessoais (ex.: uma compra no cartão que é toda da casa)
  despesasRegisto: casa => (Conta.registo(casa).despesas || []).filter(e => !e.anulada),
  todasDespesas: (casa, d = Conta.livro(casa)) => [...(((d || {}).mod || {}).despesas || []), ...Conta.despesasRegisto(casa)],
  // extrato da conta corrente: obrigações (acertos mensais e dívidas pontuais) e pagamentos
  extrato(casa, ate = ymHoje()) {
    const d0 = Conta.livro(casa); if (!d0 || !d0.mod) return null;
    const d = { mod: Object.assign({}, d0.mod, { despesas: Conta.todasDespesas(casa, d0) }) };
    const ms = d.mod.membros || [], nome = id => (ms.find(x => x.id === id) || { nome: id }).nome, R = Conta.registo(casa), linhas = [];
    const ini = (d.mod.despesas || []).map(e => e.inicio).filter(Boolean).sort()[0];
    if (ini) for (let ym = ini; ym <= ate; ym = mesSeguinte(ym)) {
      const R0 = resumoMes(d, ym);
      transferencias(Object.fromEntries(Object.entries(R0).map(([id, o]) => [id, o.saldo]))).forEach(t =>
        linhas.push({ tipo: 'acerto', id: `mensal:${ym}:${t.de}>${t.para}`, mes: ym, data: fimMes(ym), de: t.de, para: t.para, valor: t.valor, descricao: `Acerto das despesas comuns · ${ym}`,
          estimado: estimadas(d, ym).map(e => e.nome) }));
    }
    // dívidas pontuais: as do livro da casa (importadas) e as criadas nos planos pessoais
    // uma dívida do registo comum pode substituir uma dívida antiga do livro da casa (ex.: ligada depois à compra no cartão)
    const subst = new Set([...R.dividas, ...(R.despesas || [])].filter(x => !x.anulada).flatMap(x => x.substitui || []));
    (d.mod.acertos || []).filter(a => !String(a.origem || '').startsWith('mensal:') && !(a.mes) && !['concluido', 'pago'].includes(a.estado) && !subst.has(a.id) && !subst.has(a.origem)).forEach(a =>
      linhas.push({ tipo: 'divida', id: a.id, data: a.data, de: a.de, para: a.para, valor: r2(a.valor), descricao: a.descricao, notas: a.notas }));
    R.dividas.filter(a => !a.anulada).forEach(a => linhas.push(Object.assign({ tipo: 'divida' }, a)));
    R.pagamentos.forEach(p => linhas.push(Object.assign({ tipo: 'pagamento' }, p)));
    linhas.sort((a, b) => String(a.data).localeCompare(String(b.data)) || (a.tipo === 'pagamento') - (b.tipo === 'pagamento'));
    // saldo de cada par: obrigações menos pagamentos concluídos (positivo = "de" deve a "para")
    const par = (a, b) => a < b ? `${a}|${b}` : `${b}|${a}`, sinal = (a, b) => a < b ? 1 : -1, saldos = {}, pend = {};
    linhas.forEach(l => { if (!l.de || !l.para) return; const k = par(l.de, l.para), s = sinal(l.de, l.para);
      if (l.tipo === 'pagamento') { if (l.estado === 'concluido') saldos[k] = r2((saldos[k] || 0) - s * l.valor); else if (l.estado === 'registado') pend[k] = r2((pend[k] || 0) + s * l.valor); }
      else saldos[k] = r2((saldos[k] || 0) + s * l.valor); });
    // por membro: quanto deve a cada outro (só valores positivos)
    const deve = []; Object.entries(saldos).forEach(([k, v]) => { const [a, b] = k.split('|'); if (v > 0.004) deve.push({ de: a, para: b, valor: r2(v) }); else if (v < -0.004) deve.push({ de: b, para: a, valor: r2(-v) }); });
    return { casa, nome: (window.Grupo && Grupo.get(casa) || {}).nome || casa, membros: ms, nomeM: nome, linhas, deve, pendentes: pend };
  },
  // saldo de A para B até ao fim de um mês (para liquidar até uma data)
  saldoAte(casa, de, para, ym) {
    const e = Conta.extrato(casa, ym); if (!e) return 0; let v = 0;
    e.linhas.filter(l => String(l.data) <= fimMes(ym) || l.tipo === 'pagamento').forEach(l => {
      if (l.tipo === 'pagamento') { if (l.estado !== 'concluido') return; if (l.de === de && l.para === para) v -= l.valor; else if (l.de === para && l.para === de) v += l.valor; }
      else if (l.de === de && l.para === para) v += l.valor; else if (l.de === para && l.para === de) v -= l.valor; });
    return r2(v);
  },
};
})();
