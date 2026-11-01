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
const PASSOS = { mensal: 1, trimestral: 3, semestral: 6, anual: 12 };
const mensal = e => (+e.valor || 0) / (PASSOS[e.periodicidade] || 1);
const vigente = (e, ym) => (!e.inicio || ym >= e.inicio) && (!e.fim || ym <= e.fim);
const ymHoje = () => new Date().toISOString().slice(0, 7);
const mesSeguinte = ym => { let [a, m] = ym.split('-').map(Number); m++; if (m > 12) { m = 1; a++; } return `${a}-${String(m).padStart(2, '0')}`; };
const fimMes = ym => { const [a, m] = ym.split('-').map(Number); return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10); };
const ler = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };

// parte de cada membro e quanto adianta num mês; e as transferências que acertam a diferença
function resumoMes(d, ym) {
  const ms = d.mod.membros || [], out = Object.fromEntries(ms.map(x => [x.id, { parte: 0, paga: 0 }]));
  (d.mod.despesas || []).filter(e => e.ativo !== false && vigente(e, ym)).forEach(e => { const v = mensal(e);
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

const Conta = SPAP.contaCasa = {
  resumoMes, transferencias, fimMes, ymHoje,
  livro: casa => ler('spap:' + casa),
  registo: casa => Object.assign({ pagamentos: [], dividas: [] }, ler('spap:' + casa + ':conta') || {}),
  // lê, altera e grava logo a seguir (registo pequeno e só de acrescentar: não apaga o que outro sistema escreveu)
  alterar(casa, fn) { const r = Conta.registo(casa); const out = fn(r); localStorage.setItem('spap:' + casa + ':conta', JSON.stringify(r)); return out; },
  membros: casa => ((Conta.livro(casa) || {}).mod || {}).membros || [],
  // extrato da conta corrente: obrigações (acertos mensais e dívidas pontuais) e pagamentos
  extrato(casa, ate = ymHoje()) {
    const d = Conta.livro(casa); if (!d || !d.mod) return null;
    const ms = d.mod.membros || [], nome = id => (ms.find(x => x.id === id) || { nome: id }).nome, R = Conta.registo(casa), linhas = [];
    const ini = (d.mod.despesas || []).map(e => e.inicio).filter(Boolean).sort()[0];
    if (ini) for (let ym = ini; ym <= ate; ym = mesSeguinte(ym)) {
      const R0 = resumoMes(d, ym);
      transferencias(Object.fromEntries(Object.entries(R0).map(([id, o]) => [id, o.saldo]))).forEach(t =>
        linhas.push({ tipo: 'acerto', id: `mensal:${ym}:${t.de}>${t.para}`, mes: ym, data: fimMes(ym), de: t.de, para: t.para, valor: t.valor, descricao: `Acerto das despesas comuns · ${ym}` }));
    }
    // dívidas pontuais: as do livro da casa (importadas) e as criadas nos planos pessoais
    (d.mod.acertos || []).filter(a => !String(a.origem || '').startsWith('mensal:') && !(a.mes) && !['concluido', 'pago'].includes(a.estado)).forEach(a =>
      linhas.push({ tipo: 'divida', id: a.id, data: a.data, de: a.de, para: a.para, valor: r2(a.valor), descricao: a.descricao, notas: a.notas }));
    R.dividas.forEach(a => linhas.push(Object.assign({ tipo: 'divida' }, a)));
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
