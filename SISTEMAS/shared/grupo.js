/* =========================================================
   GRUPO — registo das subsidiárias da holding BXB Investimentos.
   A BXB é a fonte de verdade (db.mod.subsidiarias) e publica aqui
   o registo para os sistemas das subsidiárias e o portal o lerem.
   ========================================================= */
(function (global) {
'use strict';
const CHAVE = 'spap:grupo';
// A Elite Sound é a primeira subsidiária (os seus dados vivem em 'spap:elite')
const ELITE = {
  key: 'elite', nome: 'Elite Sound', sigla: 'ES', setor: 'Som · Aluguer · Eventos', modelo: 'servicos', nif: '',
  cor1: '#8b5cf6', cor2: '#ec4899', participacao: 0.8, ativa: true, criadaEm: '2024-07-01',
  contaCaixa: 'ES_CAIXA', contaOperacional: 'ES_BANCO', contaHolding: 'BXB_INV', contaNaHolding: '0021_BXB_SOUND', dadosIniciais: 'elite',
};
const MODELOS = {
  servicos: { nome: 'Comércio e serviços', desc: 'Vendas, catálogo, comissões de vendedores e distribuição de resultados pelos sócios (como a Elite Sound).' },
  base: { nome: 'Base', desc: 'Contas, pedidos de pagamento, autorizações, orçamentos e relatórios — sem módulo de vendas.' },
};
const r2 = v => Math.round((+v || 0) * 100) / 100;
const Grupo = global.Grupo = {
  ELITE, MODELOS,
  lista() { try { const l = JSON.parse(localStorage.getItem(CHAVE)); if (Array.isArray(l) && l.length) return l; } catch (e) { } return [Object.assign({}, ELITE)]; },
  guardar(l) { try { localStorage.setItem(CHAVE, JSON.stringify(l)); } catch (e) { } },
  get(key) { return this.lista().find(s => s.key === key) || null; },
  href(sub, base = '../') { return `${base}subsidiaria/index.html?s=${encodeURIComponent(sub.key)}`; },
  ler(key) { try { return JSON.parse(localStorage.getItem('spap:' + key)); } catch (e) { return null; } },
  // indicadores lidos do livro da subsidiária (só leitura)
  resumo(sub) {
    const d = this.ler(sub.key); if (!d || !d.contas) return null;
    const saldo = id => { const c = d.contas.find(x => x.id === id); return r2((c ? +c.saldoInicial || 0 : 0) + d.movimentos.reduce((s, m) => m.conta === id ? s + m.valor : s, 0)); };
    const fundos = r2(d.contas.reduce((s, c) => s + saldo(c.id), 0));
    const ano = new Date().toISOString().slice(0, 4); const vs = (d.mod && d.mod.vendas) || [];
    const anoRef = vs.some(v => v.data.startsWith(ano)) ? ano : (vs.map(v => v.data.slice(0, 4)).sort().pop() || ano);
    const doAno = vs.filter(v => v.data.startsWith(anoRef));
    const socio = ((d.mod && d.mod.socios) || []).find(s => s.conta === sub.contaHolding) || { quota: 0, id: '' };
    // bónus de metas das comissões (por mês) também reduzem o lucro
    const bonus = Object.entries((d.mod && d.mod.bonus) || {}).filter(([mk]) => mk.startsWith(anoRef)).reduce((s, [, o]) => s + Object.values(o).reduce((t, x) => t + (+x || 0), 0), 0);
    const lucro = r2(doAno.reduce((s, v) => s + (v.lucro || 0), 0) - bonus);
    return {
      ativo: (d.users || []).some(u => u.pinHash), fundos, caixa: saldo(sub.contaCaixa), temVendas: !!(d.mod && d.mod.vendas), ano: anoRef,
      fat: r2(doAno.reduce((s, v) => s + (v.base || 0), 0)), lucro, quota: socio.quota || 0, atrib: r2(lucro * (socio.quota || 0)),
      distrib: r2(d.pedidos.filter(p => p.estado === 'EXECUTADO' && p.contaDestino === sub.contaHolding).reduce((s, p) => s + p.valor, 0)),
      pend: d.pedidos.filter(p => ['PENDENTE', 'EM_APROVACAO', 'APROVADO'].includes(p.estado)).length, contas: d.contas.length,
    };
  },
};
})(window);
