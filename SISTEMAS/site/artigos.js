/* artigos.js — artigos do site (conteúdo editorial).
   Para acrescentar um artigo: copie um objeto, mude o "id" (fica no endereço /artigos/<id>) e a data. Os mais recentes aparecem primeiro.
   paises: ['pt'] ou ['br'] — só aparece nesse país (sem o campo, aparece nos dois). par: o artigo equivalente no outro país. */
window.CATEGORIAS = {
  poupanca: { nome: 'Poupança', ico: 'i-alvo' },
  credito: { nome: 'Crédito e dívidas', ico: 'i-cartao' },
  impostos: { nome: 'Impostos', ico: 'i-recibo' },
  casa: { nome: 'Casa e família', ico: 'i-casa' },
  empresas: { nome: 'Empresas', ico: 'i-carteira' },
  seguranca: { nome: 'Segurança', ico: 'i-escudo' },
};
window.ARTIGOS = [
{
  id: 'fundo-de-emergencia', paises: ['pt'], par: 'reserva-de-emergencia', foto: '1619718082268-5a1b74988497', cat: 'poupanca', data: '2026-11-10', min: 6, destaque: true,
  titulo: 'Fundo de emergência: quanto juntar e onde o guardar',
  resumo: 'É a primeira poupança a fazer, antes de qualquer investimento. Saiba como calcular o valor certo para si e como lá chegar sem sacrifícios.',
  corpo: `
<p>Um carro que avaria, uma baixa médica, um mês sem trabalho. Sem uma reserva, qualquer imprevisto acaba no cartão de crédito ou num crédito rápido, com juros que tornam o problema maior. O <strong>fundo de emergência</strong> existe para isso: dinheiro parado, disponível de imediato, que só se usa quando algo corre mal.</p>
<h2>Quanto deve ter</h2>
<p>A regra mais usada é juntar entre <strong>3 e 6 meses de despesas essenciais</strong>. Repare: despesas, não salário. Conte apenas o que teria de pagar mesmo num mês difícil.</p>
<ul><li>Renda ou prestação da casa, condomínio e seguros;</li><li>Água, luz, gás, comunicações;</li><li>Alimentação e transportes;</li><li>Prestações de créditos e outras despesas fixas obrigatórias.</li></ul>
<div class="tbl"><table><thead><tr><th>Situação</th><th class="n">Meses recomendados</th></tr></thead><tbody>
<tr><td>Contrato sem termo, dois rendimentos em casa</td><td class="n">3</td></tr>
<tr><td>Um só rendimento, ou filhos a cargo</td><td class="n">4 a 6</td></tr>
<tr><td>Trabalho independente ou rendimento variável</td><td class="n">6 ou mais</td></tr></tbody></table></div>
<div class="caixa"><b>Exemplo</b>Se as despesas essenciais da casa somam 1 200 € por mês, um fundo de 4 meses são 4 800 €. Pondo de lado 200 € por mês, chega lá em 2 anos; com 300 €, em 16 meses.</div>
<h2>Onde guardar</h2>
<p>O fundo de emergência tem de estar <strong>disponível em poucos dias e sem risco de perder valor</strong>. Por isso, não é dinheiro para ações, fundos de investimento ou criptomoedas.</p>
<ul><li><strong>Conta separada da conta do dia a dia</strong>: se estiver misturado com o ordenado, acaba gasto sem dar por isso.</li><li><strong>Depósito a prazo com mobilização antecipada</strong>: rende alguma coisa e pode levantar quando precisar (confirme se perde os juros e em que condições).</li><li><strong>Certificados de Aforro</strong>: podem ser uma opção para a parte que dificilmente vai usar, mas confirme as regras de resgate em vigor antes de subscrever.</li></ul>
<h2>Como chegar lá sem sofrer</h2>
<ol><li><strong>Automatize.</strong> Uma transferência no dia em que recebe o ordenado vale mais do que boas intenções no fim do mês.</li><li><strong>Comece pequeno.</strong> Um primeiro objetivo de 1 000 € já evita a maior parte dos créditos rápidos.</li><li><strong>Use o dinheiro extra.</strong> Subsídios de férias e de Natal, reembolso do IRS ou um prémio são a forma mais rápida de acelerar.</li><li><strong>Reponha depois de usar.</strong> Se teve de recorrer ao fundo, volte a pô-lo como prioridade até estar completo.</li></ol>
<h2>E as dívidas?</h2>
<p>Se tem dívidas caras (cartões de crédito, créditos pessoais), faça primeiro um fundo pequeno, de um mês, e depois concentre-se em pagar as dívidas. Quando estiverem pagas, complete o fundo. Ter dinheiro parado a render pouco enquanto paga juros altos sai caro.</p>
<div class="caixa"><b>No BXB</b>O objetivo "Fundo de emergência" calcula o valor a partir das suas despesas fixas e mostra quanto falta e em que mês o completa, com a parte do que sobra que lhe dedica.</div>`
},
{
  id: 'por-qual-divida-comecar', paises: ['pt'], par: 'varias-dividas-por-onde-comecar', foto: '1625980344922-a4df108b2bd0', cat: 'credito', data: '2026-11-06', min: 7,
  titulo: 'Várias dívidas ao mesmo tempo: por qual começar a pagar',
  resumo: 'Com vários créditos e algum dinheiro extra por mês, a ordem de pagamento conta. Compare várias estratégias e veja qual faz sentido para si.',
  corpo: `
<p>Quem tem vários créditos ao mesmo tempo (um cartão, um crédito pessoal, o carro) e algum dinheiro extra por mês enfrenta sempre a mesma pergunta: <strong>qual pago primeiro?</strong> Seja qual for a escolha, a regra de base é igual: paga-se a prestação mínima de todos e o dinheiro extra vai todo para um só. Quando esse fica pago, a prestação que se libertou junta-se ao extra e passa para o seguinte.</p>
<h2>Começar pela taxa de juro mais alta</h2>
<p>O dinheiro extra vai para a dívida mais cara, a que tem a <strong>taxa de juro mais alta</strong>. É a ordem que, matematicamente, <strong>paga menos juros</strong> e termina mais cedo.</p>
<p>O ponto fraco: se a dívida mais cara também for a maior, pode passar muitos meses sem ver nenhum crédito desaparecer, e é aí que muitos planos se abandonam.</p>
<h2>Começar pelo saldo mais pequeno</h2>
<p>O dinheiro extra vai para a dívida com o <strong>saldo mais baixo</strong>, independentemente da taxa. As primeiras dívidas desaparecem depressa e cada uma que termina liberta mais dinheiro para a seguinte.</p>
<p>Paga um pouco mais de juros, mas muita gente cumpre melhor o plano por ver resultados cedo. Um plano que se cumpre vale mais do que um plano perfeito que se abandona.</p>
<h2>Repartir por todas</h2>
<p>Uma terceira via é dividir o dinheiro extra por todas as dívidas, em proporção ao custo de cada uma. Termina mais tarde, mas reduz todas ao mesmo tempo, o que pode ajudar se precisa de baixar várias prestações em simultâneo.</p>
<h2>Um exemplo</h2>
<div class="tbl"><table><thead><tr><th>Dívida</th><th class="n">Saldo</th><th class="n">Taxa (TAN)</th><th class="n">Mínimo</th></tr></thead><tbody>
<tr><td>Cartão de crédito</td><td class="n">1 800 €</td><td class="n">16%</td><td class="n">60 €</td></tr>
<tr><td>Crédito pessoal</td><td class="n">4 300 €</td><td class="n">9%</td><td class="n">140 €</td></tr>
<tr><td>Crédito automóvel</td><td class="n">9 900 €</td><td class="n">7%</td><td class="n">210 €</td></tr></tbody></table></div>
<p>Com 150 € extra por mês, tanto a ordem pela taxa como a ordem pelo saldo começam pelo cartão, que é ao mesmo tempo o mais caro e o mais pequeno. Os caminhos só se separam quando a dívida mais cara não é a mais pequena: por exemplo, um crédito pessoal de 6 000 € a 12% e um cartão de 900 € a 10%.</p>
<div class="caixa"><b>Antes de amortizar</b>Confirme no contrato a comissão de reembolso antecipado. Nos créditos aos consumidores ela tem limites legais e, em muitos casos, compensa na mesma, mas é um custo a pôr na conta.</div>
<h2>O que escolher</h2>
<ul><li>Se é disciplinado e quer pagar o mínimo de juros: comece pela <strong>taxa mais alta</strong>.</li><li>Se já tentou antes e desistiu: comece pelo <strong>saldo mais pequeno</strong>.</li><li>Em qualquer dos casos: não volte a usar o cartão que está a pagar.</li></ul>
<div class="caixa"><b>No BXB</b>O plano para sair das dívidas compara várias estratégias com as suas dívidas reais e mostra, para cada uma, a data em que fica sem dívidas e os juros que paga.</div>`
},
{
  id: 'tan-taeg-mtic', paises: ['pt'], par: 'juros-e-cet', foto: '1709880945165-d2208c6ad2ec', cat: 'credito', data: '2026-10-30', min: 5,
  titulo: 'TAN, TAEG e MTIC: o que cada sigla diz sobre um crédito',
  resumo: 'Antes de assinar um crédito, há três números que importam. Perceba a diferença e compare propostas como deve ser.',
  corpo: `
<p>Nas propostas de crédito ao consumo aparecem sempre três siglas. Olhar só para a prestação mensal é a forma mais comum de escolher mal: duas propostas com a mesma prestação podem ter custos totais muito diferentes.</p>
<h2>TAN: o preço do dinheiro</h2>
<p>A <strong>Taxa Anual Nominal</strong> é a taxa de juro aplicada ao capital em dívida. Diz quanto custa o dinheiro emprestado, mas <strong>não inclui</strong> comissões, seguros ou impostos.</p>
<h2>TAEG: o custo total, em percentagem</h2>
<p>A <strong>Taxa Anual de Encargos Efetiva Global</strong> junta à TAN os outros encargos obrigatórios do crédito: comissões de abertura e de processamento, seguros exigidos, impostos. Como está calculada da mesma forma em todas as instituições, é <strong>o número certo para comparar propostas</strong>.</p>
<h2>MTIC: quanto vai pagar no fim</h2>
<p>O <strong>Montante Total Imputado ao Consumidor</strong> é a soma de tudo o que vai pagar até ao fim do contrato: capital, juros, comissões e impostos. É o número que mostra, em euros, o verdadeiro preço do crédito.</p>
<div class="caixa"><b>Exemplo</b>Pedir 10 000 € e pagar um MTIC de 12 600 € significa que o crédito lhe custa 2 600 €. Se outra proposta tiver uma prestação ligeiramente mais alta mas um prazo mais curto, o MTIC pode ser bem menor.</div>
<h2>Como comparar</h2>
<ol><li>Peça a <strong>Ficha de Informação Normalizada (FIN)</strong> a cada instituição: é obrigatória e traz todos estes valores no mesmo formato.</li><li>Compare a <strong>TAEG</strong> para o mesmo montante e o mesmo prazo.</li><li>Veja o <strong>MTIC</strong> para perceber o custo total em euros.</li><li>Confirme se há <strong>produtos associados</strong> (seguros, cartões) e se são obrigatórios.</li></ol>
<h2>Prazos mais longos não são mais baratos</h2>
<p>Alargar o prazo baixa a prestação, mas quase sempre aumenta o MTIC, porque paga juros durante mais tempo. Se o objetivo é aliviar o orçamento por uns meses, prefira uma prestação um pouco mais alta e um prazo mais curto, e amortize quando puder.</p>
<p>Para mais informação, o <strong>Portal do Cliente Bancário</strong> do Banco de Portugal explica estes conceitos e os seus direitos enquanto consumidor.</p>`
},
{
  id: 'cartao-de-credito-pagamento-minimo', paises: ['pt'], par: 'rotativo-do-cartao', foto: '1640545232493-9a9b5c88ede4', cat: 'credito', data: '2026-10-22', min: 5,
  titulo: 'Cartão de crédito: o custo escondido de pagar só o mínimo',
  resumo: 'A modalidade de pagamento por percentagem parece confortável, mas pode transformar uma compra pequena numa dívida de anos.',
  corpo: `
<p>Os cartões de crédito permitem escolher como pagar o saldo: a totalidade, um valor fixo ou uma <strong>percentagem do saldo</strong>, com um mínimo. A última é a mais confortável no mês e a mais cara a prazo.</p>
<h2>Porque é que a dívida nunca acaba</h2>
<p>Quando paga uma percentagem do saldo, a prestação vai baixando à medida que a dívida desce. Parece bom, mas significa que cada vez amortiza menos capital, enquanto os juros continuam a correr sobre o que falta.</p>
<div class="caixa"><b>O que entra na conta todos os meses</b>Juros sobre o saldo (à TAN do cartão), imposto do selo sobre os juros e sobre a utilização do crédito, e eventuais comissões. Só o que sobra abate à dívida.</div>
<h2>Três regras para usar bem o cartão</h2>
<ol><li><strong>Escolha o pagamento da totalidade</strong> sempre que puder: assim usa o período sem juros e o cartão não lhe custa nada além da anuidade.</li><li><strong>Se já tem saldo em dívida, pare de usar o cartão</strong> até o liquidar: novas compras somam-se ao saldo e prolongam tudo.</li><li><strong>Fixe um valor de pagamento acima do mínimo</strong>: mesmo 30 ou 50 € a mais por mês encurtam o prazo de forma visível.</li></ol>
<h2>Compras a prestações com o cartão</h2>
<p>Dividir uma compra em prestações "sem juros" pode ter comissões ou exigir a modalidade de pagamento parcial. Leia as condições: o que importa é a TAEG dessa operação.</p>
<div class="caixa"><b>No BXB</b>Ao registar uma despesa paga a prestações pelo cartão, o plano calcula mês a mês a prestação, os juros e o imposto do selo, e mostra quando fica liquidada.</div>`
},
{
  id: 'deducoes-irs-e-fatura', paises: ['pt'], par: 'imposto-de-renda-deducoes', foto: '1762265591492-1454ae17f31a', cat: 'impostos', data: '2026-10-15', min: 6,
  titulo: 'Deduções no IRS: o que confirmar no e-Fatura antes do prazo',
  resumo: 'Uma parte do reembolso decide-se muito antes da entrega da declaração. Veja o que deve verificar e porque é que as faturas pendentes importam.',
  corpo: `
<p>As despesas que pede com o seu NIF são comunicadas à Autoridade Tributária e entram no cálculo do IRS como <strong>deduções à coleta</strong>: um valor que é abatido diretamente ao imposto a pagar. Mas só contam se estiverem bem classificadas.</p>
<h2>As principais categorias</h2>
<div class="tbl"><table><thead><tr><th>Categoria</th><th>Como funciona</th></tr></thead><tbody>
<tr><td>Despesas gerais familiares</td><td>Uma percentagem de quase todas as despesas, com limite por sujeito passivo</td></tr>
<tr><td>Saúde</td><td>Consultas, medicamentos com receita, exames, seguros de saúde</td></tr>
<tr><td>Educação</td><td>Propinas, manuais, explicações e outras despesas de formação</td></tr>
<tr><td>Habitação</td><td>Rendas de habitação permanente e, em certos casos, juros de crédito à habitação antigo</td></tr>
<tr><td>Lares</td><td>Despesas com lares e apoio a idosos</td></tr>
<tr><td>Exigência de fatura</td><td>Parte do IVA de setores como restauração, cabeleireiros, oficinas e veterinários</td></tr></tbody></table></div>
<p>As percentagens e os limites de cada categoria estão no Código do IRS e são alterados com alguma frequência. Confirme os valores do ano em causa no <strong>Portal das Finanças</strong>.</p>
<h2>O que verificar no e-Fatura</h2>
<ol><li><strong>Faturas pendentes</strong>: quando um comerciante tem várias atividades, a fatura fica por classificar e, se não a classificar, pode ir apenas para despesas gerais.</li><li><strong>Despesas de saúde</strong>: confirme que as da farmácia com receita estão em saúde e não em despesas gerais.</li><li><strong>Dependentes</strong>: as faturas com o NIF dos filhos também contam e também precisam de ser verificadas.</li><li><strong>Faturas em falta</strong>: se pediu fatura com NIF e ela não aparece, pode registá-la manualmente.</li></ol>
<div class="caixa"><b>Prazos</b>A validação das faturas pendentes faz-se no início do ano seguinte, normalmente até ao fim de fevereiro, e a declaração de IRS entrega-se entre 1 de abril e 30 de junho. Confirme as datas exatas de cada ano no Portal das Finanças.</div>
<h2>Reembolso não é um prémio</h2>
<p>Um reembolso grande significa que reteve imposto a mais durante o ano: emprestou dinheiro ao Estado sem juros. Pode ser útil como poupança forçada, mas convém saber de onde vem.</p>
<div class="caixa"><b>No BXB</b>A página do IRS junta os seus rendimentos e retenções, os valores do e-Fatura que indicar e os escalões do ano, e estima se vai receber ou pagar.</div>`
},
{
  id: 'recibos-verdes-sem-surpresas', paises: ['pt'], par: 'mei-ou-autonomo', foto: '1682669328101-3a0f8a12d06d', cat: 'impostos', data: '2026-10-08', min: 7,
  titulo: 'Recibos verdes sem surpresas: IRS e Segurança Social',
  resumo: 'Trabalhar por conta própria traz obrigações que não existem num contrato. Organize-se para não ter um susto em junho ou na fatura da Segurança Social.',
  corpo: `
<p>Quem passa recibos verdes recebe o valor bruto do trabalho e fica responsável por uma parte das contas que, num contrato de trabalho, a empresa faz por si. As duas grandes são o <strong>IRS</strong> e a <strong>Segurança Social</strong>.</p>
<h2>Retenção na fonte de IRS</h2>
<p>Quando presta serviços a empresas ou a outros profissionais com contabilidade organizada, estes podem ter de <strong>reter IRS</strong> no pagamento, à taxa que a lei fixa para a sua atividade. Esse valor é um adiantamento do imposto e é acertado na declaração anual.</p>
<p>Quem prevê ter rendimentos anuais abaixo de um limite fixado na lei pode pedir <strong>dispensa de retenção</strong>, indicando-o no recibo. Atenção: se depois ultrapassar o limite, tem de passar a reter e o imposto acerta-se na mesma em junho.</p>
<h2>Segurança Social</h2>
<p>Os trabalhadores independentes entregam uma <strong>declaração trimestral</strong> com os rendimentos do trimestre anterior, e a contribuição mensal é calculada a partir dela. Nos serviços, conta-se apenas uma parte do rendimento (o chamado rendimento relevante) e aplica-se a taxa contributiva dos independentes.</p>
<div class="caixa"><b>Primeiro ano</b>No início de atividade há, em regra, um período de isenção de contribuições. Confirme na Segurança Social Direta a data em que começa a pagar, para não ser apanhado de surpresa.</div>
<h2>Um método simples</h2>
<ol><li>Por cada recibo recebido, ponha de lado uma <strong>percentagem fixa</strong> numa conta à parte (por exemplo, 25 a 30%, ajustada ao seu caso).</li><li>Dessa conta saem as contribuições mensais e o eventual acerto do IRS.</li><li>No fim do ano, o que sobrar é seu: pode ir para o fundo de emergência.</li></ol>
<h2>Não duplique recibos</h2>
<p>Ao registar recibos à mão e importá-los do Portal das Finanças, é fácil contar o mesmo duas vezes e achar que ganhou mais do que ganhou. Use o número do recibo (FR, por exemplo) como referência única.</p>
<div class="caixa"><b>No BXB</b>Os recibos verdes são reconhecidos pelo número do documento: se tentar inserir um que já existe, o sistema avisa e ignora-o.</div>`
},
{
  id: 'despesas-partilhadas-a-dois', paises: ['pt'], par: 'despesas-compartilhadas-a-dois', foto: '1758523417936-fa871f4a840d', cat: 'casa', data: '2026-09-30', min: 5,
  titulo: 'Despesas partilhadas a dois sem discussões',
  resumo: '50/50, proporcional ao rendimento ou conta comum? Três formas de dividir as despesas da casa e como fazer o acerto todos os meses.',
  corpo: `
<p>Dinheiro é um dos temas que mais discussões gera numa casa partilhada, seja com um companheiro, família ou amigos. Quase sempre o problema não é o valor, é a falta de regras claras.</p>
<h2>Três formas de dividir</h2>
<h3>1. Metade para cada um</h3><p>Simples e fácil de acertar. Funciona bem quando os rendimentos são parecidos.</p>
<h3>2. Proporcional ao rendimento</h3><p>Cada um paga uma percentagem igual à sua parte no rendimento total da casa. Se um ganha 1 800 € e o outro 1 200 €, a divisão fica 60/40. Com rendimentos diferentes, é a forma mais justa de ambos ficarem com folga parecida.</p>
<h3>3. Conta comum</h3><p>Cada um transfere uma quantia fixa para uma conta conjunta, de onde saem as despesas da casa. Dá menos trabalho no dia a dia, mas exige combinar bem o valor e o que é despesa comum.</p>
<h2>O que conta como despesa comum</h2>
<ul><li>Renda ou prestação, condomínio e seguros da casa;</li><li>Água, luz, gás e internet;</li><li>Compras de supermercado;</li><li>Despesas combinadas caso a caso (um eletrodoméstico, as férias).</li></ul>
<h2>O acerto do mês</h2>
<p>Na prática, cada um vai pagando coisas: um paga a renda, outro as compras. No fim do mês soma-se o que cada um pagou, compara-se com a parte de cada um, e quem pagou menos transfere a diferença. Uma transferência por mês, sem contas de cabeça.</p>
<div class="caixa"><b>Combinem por escrito</b>Que despesas são comuns, em que proporção, e quem paga o quê. Evita mal-entendidos e facilita quando a situação muda (um aumento, um filho, uma mudança de casa).</div>
<div class="caixa"><b>No BXB</b>As despesas partilhadas funcionam por convite: cada pessoa aceita a partilha com a sua conta, vê só a folha comum e o acerto do mês, e o resto do plano continua privado.</div>`
},
{
  id: 'dupla-aprovacao-pagamentos', paises: ['pt'], par: 'dupla-aprovacao-pix-e-boleto', foto: '1556740714-a8395b3bf30f', cat: 'empresas', data: '2026-11-03', min: 6,
  titulo: 'Porque é que a dupla aprovação protege a tesouraria da sua empresa',
  resumo: 'A fraude da mudança de IBAN, o pagamento duplicado e o erro de digitação têm a mesma defesa: ninguém paga sozinho acima de um certo valor.',
  corpo: `
<p>Em muitas pequenas empresas, quem prepara um pagamento é a mesma pessoa que o aprova e o executa. É rápido, mas deixa a tesouraria exposta a erros e a fraudes que uma segunda pessoa apanharia em segundos.</p>
<h2>Os riscos mais comuns</h2>
<ul><li><strong>Fraude da mudança de IBAN</strong>: chega um email, aparentemente de um fornecedor habitual, a informar que mudou de banco. O pagamento seguinte vai para a conta de um burlão.</li><li><strong>Fraude do "diretor"</strong>: alguém se faz passar por um responsável e pede uma transferência urgente e confidencial.</li><li><strong>Pagamentos duplicados</strong>: a mesma fatura é paga duas vezes porque chegou por dois canais.</li><li><strong>Erros de valor</strong>: um zero a mais.</li></ul>
<h2>Segregação de funções</h2>
<p>O princípio é simples: <strong>quem pede não aprova, e quem aprova não executa</strong>. Para isso, cada pessoa tem um papel e, quem aprova, uma <strong>alçada</strong>: o valor máximo que pode autorizar sozinho.</p>
<div class="tbl"><table><thead><tr><th>Valor do pagamento</th><th>Quem autoriza</th></tr></thead><tbody>
<tr><td>Até ao limite da alçada</td><td>Um aprovador</td></tr>
<tr><td>Acima do limite de dupla aprovação</td><td>Dois aprovadores diferentes</td></tr>
<tr><td>Alteração de regras, IBAN ou alçadas</td><td>Duas pessoas (regra das duas pessoas)</td></tr></tbody></table></div>
<h2>Boas práticas para mudanças de IBAN</h2>
<ol><li>Confirme sempre por <strong>telefone, para um número que já tinha</strong>, nunca para o que vem no email.</li><li>Exija comprovativo do novo IBAN em nome do fornecedor.</li><li>Trate a alteração como uma mudança de regra: com segunda aprovação.</li></ol>
<h2>E isto não atrasa tudo?</h2>
<p>Com as alçadas bem definidas, a maioria dos pagamentos do dia a dia é aprovada por uma pessoa. A dupla aprovação só entra nos valores que justificam o cuidado extra. E com assinatura eletrónica, a aprovação faz-se no telemóvel, em segundos.</p>
<div class="caixa"><b>No BXB</b>Cada pedido de pagamento passa por pedido, aprovação e execução, com alçadas por pessoa, dupla aprovação acima do valor que definir e assinatura com PIN e rubrica em cada passo. Tudo fica no registo de auditoria.</div>`
},
{
  id: 'tesouraria-pme-13-semanas', paises: ['pt'], par: 'fluxo-de-caixa-13-semanas', foto: '1460925895917-afdab827c52f', cat: 'empresas', data: '2026-10-27', min: 6,
  titulo: 'Tesouraria de uma PME: a previsão a 13 semanas',
  resumo: 'Lucro não é dinheiro no banco. Uma previsão simples, semana a semana, mostra com antecedência quando vai faltar liquidez.',
  corpo: `
<p>Muitas empresas lucrativas passam por apertos de tesouraria: os clientes pagam a 60 dias, os fornecedores querem receber a 30, e os salários e impostos não esperam. A <strong>previsão de tesouraria a 13 semanas</strong> é a ferramenta mais simples para ver o problema antes de ele chegar.</p>
<h2>Porquê 13 semanas</h2>
<p>São três meses: tempo suficiente para reagir (negociar prazos, antecipar cobranças, adiar um investimento) e curto o bastante para as previsões serem fiáveis.</p>
<h2>Como montar</h2>
<ol><li><strong>Saldo inicial</strong>: o dinheiro disponível hoje em todas as contas.</li><li><strong>Recebimentos</strong>: faturas emitidas e a data provável de pagamento de cada cliente (não a data de vencimento: a data em que costuma pagar).</li><li><strong>Pagamentos certos</strong>: salários, rendas, prestações, impostos e contribuições, fornecedores com fatura.</li><li><strong>Pagamentos prováveis</strong>: compras previstas, manutenção, despesas variáveis.</li><li><strong>Saldo final de cada semana</strong>, que passa a ser o inicial da seguinte.</li></ol>
<div class="caixa"><b>O saldo que importa</b>Ao saldo do banco subtraia os pagamentos já aprovados mas ainda não executados: é o saldo cativo. O que sobra é o que pode realmente comprometer.</div>
<h2>Atualize todas as semanas</h2>
<p>A previsão só vale se for atualizada: compare o previsto com o real, corrija as datas dos clientes que se atrasam e acrescente mais uma semana no fim. Em pouco tempo percebe quais os clientes que pagam a horas e onde estão as folgas.</p>
<h2>Quando a previsão fica negativa</h2>
<ul><li>Antecipe cobranças (descontos de pronto pagamento, faturação mais cedo);</li><li>Negocie prazos com fornecedores antes do vencimento, não depois;</li><li>Adie investimentos que não são urgentes;</li><li>Só depois pense em financiamento de curto prazo, e compare a TAEG.</li></ul>
<div class="caixa"><b>No BXB</b>A tesouraria mostra o saldo de cada conta, o saldo cativo dos pedidos aprovados e a previsão dos pagamentos recorrentes, para ver o disponível real a cada dia.</div>`
},
{
  id: 'proteger-a-sua-conta', paises: ['pt'], par: 'proteger-suas-contas', foto: '1584433144859-1fc3ab64a957', cat: 'seguranca', data: '2026-09-22', min: 4,
  titulo: 'Cinco hábitos para proteger as suas contas online',
  resumo: 'A maior parte dos ataques não quebra sistemas: engana pessoas. Pequenos hábitos que evitam a maioria dos problemas.',
  corpo: `
<p>Os ataques mais comuns a contas pessoais e de empresas não exigem grandes conhecimentos técnicos: aproveitam palavras-passe repetidas e mensagens bem feitas. Estes cinco hábitos resolvem a maioria dos casos.</p>
<h2>1. Uma palavra-passe diferente para cada serviço</h2><p>Quando um site é atacado, as palavras-passe roubadas são testadas noutros sites. Use um gestor de palavras-passe para ter uma diferente e longa em cada serviço.</p>
<h2>2. Desconfie da urgência</h2><p>"A sua conta vai ser bloqueada", "pagamento urgente e confidencial": a pressa é a principal ferramenta da fraude. Pare e confirme por outro canal.</p>
<h2>3. Escreva o endereço, não clique no link</h2><p>Para entrar numa conta, escreva o endereço do site ou use um marcador. Os links em SMS e emails podem levar a cópias perfeitas da página verdadeira.</p>
<h2>4. Nunca partilhe códigos</h2><p>Nenhum serviço legítimo lhe pede, por telefone ou mensagem, o código que recebeu por SMS, a palavra-passe ou o PIN.</p>
<h2>5. Termine a sessão em computadores partilhados</h2><p>E bloqueie o ecrã quando se afasta do seu.</p>
<div class="caixa"><b>No BXB</b>A palavra-passe serve para entrar e o PIN só para assinar operações: mesmo que alguém descubra a palavra-passe, não consegue aprovar pagamentos sem o PIN e a rubrica. Cada entrada e acesso fica registado.</div>`
},
/* ---------- Brasil ---------- */
{
  id: 'reserva-de-emergencia', paises: ['br'], par: 'fundo-de-emergencia', foto: '1740592910117-8af52c77005b', cat: 'poupanca', data: '2026-11-10', min: 6, destaque: true,
  titulo: 'Reserva de emergência: quanto juntar e onde guardar',
  resumo: 'É o primeiro passo antes de qualquer investimento. Veja como calcular o valor certo para você e onde deixar o dinheiro rendendo com segurança.',
  corpo: `
<p>O carro que quebra, um problema de saúde, um mês sem trabalho. Sem uma reserva, qualquer imprevisto acaba no rotativo do cartão ou no cheque especial, com juros que transformam um susto em dívida. A <strong>reserva de emergência</strong> serve para isso: dinheiro guardado, disponível na hora, que só se usa quando algo dá errado.</p>
<h2>Quanto juntar</h2>
<p>A referência mais usada é ter entre <strong>3 e 6 meses do seu custo de vida essencial</strong>. Atenção: custo de vida, não salário. Conte apenas o que você teria de pagar mesmo num mês difícil.</p>
<ul><li>Aluguel ou parcela do imóvel, condomínio e IPTU;</li><li>Água, luz, gás, internet e celular;</li><li>Mercado, transporte e plano de saúde;</li><li>Parcelas de empréstimos e outras contas fixas.</li></ul>
<div class="tbl"><table><thead><tr><th>Situação</th><th class="n">Meses recomendados</th></tr></thead><tbody>
<tr><td>CLT, duas rendas em casa</td><td class="n">3</td></tr>
<tr><td>Uma só renda, ou filhos dependentes</td><td class="n">4 a 6</td></tr>
<tr><td>Autônomo, MEI ou renda variável</td><td class="n">6 a 12</td></tr></tbody></table></div>
<div class="caixa"><b>Exemplo</b>Se o custo de vida essencial da casa é de R$ 4.000 por mês, uma reserva de 6 meses são R$ 24.000. Guardando R$ 800 por mês, você chega lá em 30 meses; com R$ 1.200, em 20 meses.</div>
<h2>Onde guardar</h2>
<p>A reserva precisa de <strong>liquidez diária e baixo risco</strong>: tem de poder ser resgatada no mesmo dia ou no dia seguinte, sem perder valor. Por isso, não é dinheiro para ações, criptomoedas ou fundos com resgate demorado.</p>
<ul><li><strong>Tesouro Selic</strong>: título público, acompanha a taxa básica de juros e pode ser resgatado a qualquer dia útil.</li><li><strong>CDB com liquidez diária</strong> de uma instituição sólida, dentro do limite de garantia do FGC.</li><li><strong>Conta remunerada separada</strong> da conta do dia a dia: se ficar misturada com o salário, acaba sendo gasta sem você perceber.</li></ul>
<p>A poupança também tem liquidez, mas costuma render menos do que as opções acima.</p>
<h2>Como chegar lá sem sofrer</h2>
<ol><li><strong>Automatize.</strong> Uma transferência no dia em que o salário cai vale mais do que boas intenções no fim do mês.</li><li><strong>Comece pequeno.</strong> Uma primeira meta de R$ 2.000 já evita a maior parte do cheque especial.</li><li><strong>Use o dinheiro extra.</strong> 13º salário, restituição do Imposto de Renda e bônus são a forma mais rápida de acelerar.</li><li><strong>Reponha depois de usar.</strong> Se precisou da reserva, volte a priorizá-la até ela estar completa.</li></ol>
<h2>E as dívidas?</h2>
<p>Se você tem dívidas caras (rotativo, cheque especial, empréstimo pessoal), monte primeiro uma reserva pequena, de um mês, e depois concentre-se em quitar as dívidas. Quando estiverem pagas, complete a reserva. Deixar dinheiro rendendo pouco enquanto paga juros altos sai caro.</p>
<div class="caixa"><b>No BXB</b>O objetivo "Reserva de emergência" calcula o valor a partir das suas despesas fixas e mostra quanto falta e em que mês você completa a reserva, com a parte do que sobra que você dedica a ela.</div>`
},
{
  id: 'varias-dividas-por-onde-comecar', paises: ['br'], par: 'por-qual-divida-comecar', foto: '1625980344922-a4df108b2bd0', cat: 'credito', data: '2026-11-06', min: 7,
  titulo: 'Várias dívidas ao mesmo tempo: por qual começar a pagar',
  resumo: 'Cartão, cheque especial, empréstimo e financiamento juntos? A ordem de pagamento muda o total de juros. Compare várias estratégias e veja qual faz sentido para você.',
  corpo: `
<p>Quem tem várias dívidas ao mesmo tempo (um cartão parcelado, o cheque especial, um empréstimo pessoal, o financiamento do carro) e consegue guardar algum valor extra por mês sempre esbarra na mesma pergunta: <strong>qual quitar primeiro?</strong> Seja qual for a escolha, a base é a mesma: você paga a parcela mínima de todas e coloca o dinheiro extra numa só. Quando ela for quitada, a parcela que sobrou se junta ao extra e vai para a próxima.</p>
<h2>Começar pela taxa de juros mais alta</h2>
<p>Você ordena as dívidas pela <strong>taxa de juros ao mês</strong>, da maior para a menor. No Brasil, o rotativo do cartão e o cheque especial costumam estar no topo, seguidos do empréstimo pessoal; consignado e financiamento de veículo costumam ter juros bem menores.</p>
<p>É a forma que <strong>paga menos juros no total</strong>. A desvantagem: se a dívida mais cara também for a maior, pode levar meses até você ver a primeira quitada.</p>
<h2>Começar pelo saldo menor</h2>
<p>Aqui a ordem é pelo <strong>valor que falta pagar</strong>, do menor para o maior. As primeiras dívidas somem rápido, e cada uma quitada libera uma parcela inteira para a seguinte.</p>
<p>Normalmente paga um pouco mais de juros, mas muita gente se mantém firme no plano justamente por ver resultados cedo.</p>
<h2>Dividir entre todas</h2>
<p>Outra opção é repartir o extra por todas as dívidas, proporcionalmente ao saldo. Todas diminuem ao mesmo tempo, mas nenhuma acaba cedo, e o total de juros fica entre as duas opções anteriores.</p>
<h2>Antes de escolher, reduza os juros</h2>
<ul><li><strong>Troque dívida cara por barata.</strong> Um empréstimo consignado ou com garantia, com juros menores, pode quitar o rotativo ou o cheque especial de uma vez. Compare sempre o CET.</li><li><strong>Portabilidade de crédito.</strong> Você pode levar um empréstimo para outra instituição que ofereça juros menores, sem custo de transferência.</li><li><strong>Negocie.</strong> Bancos e lojas costumam ter campanhas de renegociação com desconto para pagamento à vista ou parcelado.</li></ul>
<h2>O que escolher</h2>
<p>Se você é disciplinado e o objetivo é pagar o mínimo possível, comece pela taxa mais alta. Se precisa de vitórias rápidas para não desistir, comece pelo saldo menor. Mais importante do que a ordem é <strong>não criar dívida nova</strong> enquanto quita as antigas.</p>
<div class="caixa"><b>No BXB</b>O plano de dívidas compara as estratégias com os seus valores reais e mostra, para cada uma, o total de juros e o mês em que fica sem dívidas.</div>`
},
{
  id: 'juros-e-cet', paises: ['br'], par: 'tan-taeg-mtic', foto: '1709880945165-d2208c6ad2ec', cat: 'credito', data: '2026-10-30', min: 5,
  titulo: 'Taxa de juros e CET: o que olhar antes de contratar um crédito',
  resumo: 'A taxa de juros anunciada não é o custo real de um empréstimo. Entenda o CET, a diferença entre juros ao mês e ao ano, e como comparar propostas.',
  corpo: `
<p>Na hora de contratar um empréstimo ou financiamento, a propaganda destaca a <strong>taxa de juros</strong>. Mas o que você realmente paga inclui mais coisas. Para comparar propostas, o número que importa é o <strong>CET</strong>.</p>
<h2>Juros ao mês e ao ano</h2>
<p>No Brasil, as taxas costumam ser informadas <strong>ao mês</strong>. Como os juros são compostos, a taxa anual é maior do que 12 vezes a mensal.</p>
<div class="tbl"><table><thead><tr><th>Juros ao mês</th><th class="n">Equivale a, ao ano</th></tr></thead><tbody>
<tr><td>1%</td><td class="n">12,7%</td></tr>
<tr><td>2%</td><td class="n">26,8%</td></tr>
<tr><td>4%</td><td class="n">60,1%</td></tr>
<tr><td>8%</td><td class="n">151,8%</td></tr></tbody></table></div>
<h2>CET: o custo efetivo total</h2>
<p>O CET soma tudo o que você paga pelo crédito: <strong>juros, IOF, tarifas e seguros</strong> incluídos no contrato. As instituições financeiras são obrigadas a informar o CET antes da contratação, ao mês e ao ano.</p>
<div class="caixa"><b>Exemplo</b>Duas propostas de R$ 10.000 com a mesma taxa de juros podem ter CET bem diferentes se uma delas incluir um seguro prestamista e uma tarifa de cadastro. Compare sempre o CET anual e o valor total a pagar.</div>
<h2>Seguros e serviços embutidos</h2>
<p>Seguro prestamista, título de capitalização ou pacote de serviços não podem ser condição para liberar o crédito: a venda casada é proibida pelo Código de Defesa do Consumidor. Se não quiser, peça para retirar e confira o CET de novo.</p>
<h2>Antes de assinar</h2>
<ol><li>Peça a simulação com o <strong>CET anual</strong> e o <strong>valor total a pagar</strong>.</li><li>Compare pelo menos três propostas, inclusive de bancos digitais e cooperativas.</li><li>Confira se a parcela cabe no orçamento com folga: o ideal é que todas as parcelas somadas fiquem bem abaixo de 30% da renda.</li></ol>
<div class="caixa"><b>No BXB</b>Ao registrar um crédito, você informa a parcela e a taxa, e o plano mostra a data de quitação e quanto ainda vai pagar de juros.</div>`
},
{
  id: 'rotativo-do-cartao', paises: ['br'], par: 'cartao-de-credito-pagamento-minimo', foto: '1640545232493-9a9b5c88ede4', cat: 'credito', data: '2026-10-22', min: 5,
  titulo: 'Cartão de crédito: o custo do rotativo e do pagamento mínimo',
  resumo: 'Pagar só o mínimo da fatura parece um alívio, mas joga o restante no rotativo, uma das dívidas mais caras do país. Veja como funciona e como sair dele.',
  corpo: `
<p>Quando você paga menos do que o total da fatura, a diferença vira <strong>crédito rotativo</strong>. É prático, não exige nenhum contrato novo, e é exatamente por isso que é perigoso: os juros do rotativo estão entre os mais altos do mercado.</p>
<h2>Como funciona hoje</h2>
<ul><li>O saldo que ficou em aberto entra no rotativo e é cobrado na fatura seguinte, com juros e IOF.</li><li>Pelas regras atuais, o rotativo só pode ser usado até o vencimento da fatura seguinte. Depois disso, a instituição tem de oferecer um <strong>parcelamento da fatura</strong>, normalmente com juros menores.</li><li>Os juros e encargos do rotativo e do parcelamento da fatura não podem ultrapassar o valor original da dívida.</li></ul>
<div class="caixa"><b>Exemplo</b>Numa fatura de R$ 2.000, pagar o mínimo deixa a maior parte do valor no rotativo. No mês seguinte, além das compras novas, você paga juros sobre esse saldo, e a dívida cresce mesmo sem você usar mais o cartão.</div>
<h2>Como sair</h2>
<ol><li><strong>Pare de usar o cartão</strong> enquanto houver saldo no rotativo ou parcelamento em aberto.</li><li><strong>Compare o parcelamento da fatura</strong> com um empréstimo pessoal ou consignado. Se o CET do empréstimo for menor, vale quitar o cartão com ele.</li><li><strong>Negocie.</strong> Muitos emissores oferecem condições melhores para quem pede a renegociação antes de atrasar.</li><li><strong>Reorganize o vencimento</strong> da fatura para alguns dias depois do salário cair.</li></ol>
<h2>Para não voltar</h2>
<p>Use o cartão só para gastos que já cabem no orçamento do mês e acompanhe a fatura parcial ao longo do mês, não apenas no fechamento. Compras parceladas "sem juros" também comprometem a renda dos próximos meses: some todas as parcelas futuras antes de fazer uma nova.</p>
<div class="caixa"><b>No BXB</b>Registre o cartão como um crédito: o plano mostra o saldo, o custo dos juros e a data em que fica quitado com o valor que você consegue pagar.</div>`
},
{
  id: 'imposto-de-renda-deducoes', paises: ['br'], par: 'deducoes-irs-e-fatura', foto: '1740592910131-b604d790061a', cat: 'impostos', data: '2026-10-15', min: 6,
  titulo: 'Imposto de Renda: o que pode deduzir e como guardar comprovantes',
  resumo: 'Saúde, educação, dependentes e previdência podem reduzir o imposto ou aumentar a restituição. Veja o que entra, os cuidados com comprovantes e quando vale o modelo completo.',
  corpo: `
<p>Na declaração do Imposto de Renda, algumas despesas podem ser <strong>deduzidas da renda tributável</strong>, o que reduz o imposto a pagar ou aumenta a restituição. Para isso, você precisa escolher o modelo certo e ter os comprovantes em ordem.</p>
<h2>Modelo completo ou simplificado</h2>
<p>No <strong>simplificado</strong>, a Receita Federal aplica um desconto padrão de 20% sobre os rendimentos tributáveis, até um limite anual. No <strong>completo</strong>, você informa as deduções reais. O próprio programa da declaração indica qual opção é mais vantajosa para você.</p>
<h2>O que pode deduzir no modelo completo</h2>
<ul><li><strong>Saúde</strong>: consultas, exames, internações, plano de saúde, dentista, psicólogo e fisioterapeuta, sem limite de valor, desde que comprovados.</li><li><strong>Educação</strong>: ensino infantil, fundamental, médio, técnico e superior, até um limite anual por pessoa. Cursos livres, idiomas e material escolar não entram.</li><li><strong>Dependentes</strong>: um valor fixo por dependente, além das despesas de saúde e educação de cada um.</li><li><strong>Previdência</strong>: a contribuição ao INSS e as contribuições a planos PGBL, estas até 12% da renda tributável.</li><li><strong>Pensão alimentícia</strong> paga por decisão judicial ou escritura pública.</li></ul>
<h2>Comprovantes</h2>
<p>Recibos e notas precisam ter <strong>nome, CPF ou CNPJ do prestador</strong>, o serviço e o valor. Guarde tudo por pelo menos <strong>5 anos</strong>: é o prazo em que a Receita pode pedir explicações sobre a declaração.</p>
<div class="caixa"><b>Dica</b>A declaração pré-preenchida já traz muitas despesas informadas por médicos, hospitais, escolas e planos de saúde. Confira cada item: o que estiver errado ou faltando é responsabilidade de quem declara.</div>
<h2>Prazos</h2>
<p>A entrega costuma acontecer entre março e o fim de maio. Confirme as datas do ano no site da Receita Federal. Quem entrega cedo e sem pendências tende a receber a restituição nos primeiros lotes.</p>
<div class="caixa"><b>No BXB</b>Registre as despesas dedutíveis ao longo do ano e veja uma estimativa da restituição muito antes do prazo de entrega.</div>`
},
{
  id: 'mei-ou-autonomo', paises: ['br'], par: 'recibos-verdes-sem-surpresas', foto: '1682669328101-3a0f8a12d06d', cat: 'impostos', data: '2026-10-08', min: 7,
  titulo: 'MEI ou autônomo: como organizar impostos e contribuições',
  resumo: 'Quem trabalha por conta própria tem de separar o dinheiro do imposto e do INSS. Entenda as diferenças entre MEI e autônomo e como não ser pego de surpresa.',
  corpo: `
<p>Trabalhar por conta própria dá liberdade, mas traz uma responsabilidade que o salário CLT esconde: <strong>ninguém desconta o imposto e o INSS por você</strong>. Organizar isso desde o primeiro recebimento evita multas e sustos.</p>
<h2>MEI</h2>
<ul><li>Você tem um <strong>CNPJ</strong> e pode emitir nota fiscal.</li><li>Paga um valor fixo por mês, o <strong>DAS</strong>, que já inclui a contribuição ao INSS e o ISS ou ICMS, conforme a atividade.</li><li>Há um <strong>limite anual de faturamento</strong> e uma lista de atividades permitidas. Ultrapassar o limite obriga a mudar de enquadramento.</li><li>Todo ano, entrega a declaração anual do MEI (DASN-SIMEI), informando o faturamento.</li></ul>
<h2>Autônomo pessoa física</h2>
<ul><li>Quando recebe de <strong>pessoas físicas</strong>, deve recolher o imposto mensalmente pelo <strong>carnê-leão</strong>.</li><li>Quando presta serviço para <strong>empresas</strong>, normalmente recebe por RPA, com retenção de imposto e INSS na fonte.</li><li>Contribui para o INSS como contribuinte individual, para ter direito a aposentadoria, auxílio-doença e outros benefícios.</li></ul>
<div class="caixa"><b>Regra prática</b>Separe uma porcentagem de cada recebimento numa conta à parte, só para impostos e contribuições. Assim, quando a guia vence, o dinheiro já está lá.</div>
<h2>Erros comuns</h2>
<ol><li>Misturar as contas da atividade com as pessoais.</li><li>Esquecer do DAS em meses fracos: ele é devido mesmo sem faturamento.</li><li>Não guardar as notas e os recibos emitidos.</li><li>Deixar a declaração anual para a última hora.</li></ol>
<div class="caixa"><b>No BXB</b>Registre cada recebimento e o plano reserva automaticamente a parte dos impostos, mostrando quanto é seu de verdade em cada mês.</div>`
},
{
  id: 'despesas-compartilhadas-a-dois', paises: ['br'], par: 'despesas-partilhadas-a-dois', foto: '1758523417936-fa871f4a840d', cat: 'casa', data: '2026-09-30', min: 5,
  titulo: 'Despesas compartilhadas a dois sem brigas',
  resumo: 'Dividir meio a meio nem sempre é justo. Veja as formas mais comuns de dividir as contas da casa e como fazer o acerto do mês sem planilhas complicadas.',
  corpo: `
<p>Dinheiro é um dos motivos mais comuns de discussão entre casais. Na maioria das vezes, o problema não é falta de dinheiro: é a <strong>falta de uma regra clara</strong> para dividir as contas.</p>
<h2>Três formas de dividir</h2>
<ul><li><strong>Meio a meio</strong>: simples e funciona bem quando as rendas são parecidas.</li><li><strong>Proporcional à renda</strong>: cada um paga uma porcentagem igual à sua parte na renda da casa. Se um ganha R$ 6.000 e o outro R$ 4.000, a divisão fica 60% e 40%.</li><li><strong>Tudo junto</strong>: as duas rendas entram numa conta comum e cada um fica com um valor fixo para gastos pessoais.</li></ul>
<h2>O que entra na conta comum</h2>
<p>Aluguel ou financiamento, condomínio, luz, internet, mercado e objetivos do casal, como uma viagem ou a entrada do apartamento. Gastos pessoais ficam de fora.</p>
<div class="caixa"><b>Exemplo</b>As contas da casa somam R$ 5.000. Na divisão proporcional, quem ganha R$ 6.000 paga R$ 3.000 e quem ganha R$ 4.000 paga R$ 2.000. Os dois ficam com a mesma proporção da renda livre.</div>
<h2>O acerto do mês</h2>
<p>Na prática, cada um paga algumas contas no seu cartão ou por Pix. No fim do mês, basta somar o que cada um pagou, comparar com a parte que lhe cabia e fazer <strong>um único Pix</strong> de acerto.</p>
<h2>Combinados que ajudam</h2>
<ol><li>Uma conversa por mês, com os números na mesa.</li><li>Um valor a partir do qual compras grandes são decididas a dois.</li><li>Autonomia total sobre o dinheiro pessoal de cada um.</li></ol>
<div class="caixa"><b>No BXB</b>Convide a outra pessoa para uma planilha comum: cada um registra o que pagou e o BXB calcula o acerto do mês, com a regra de divisão que vocês escolherem.</div>`
},
{
  id: 'dupla-aprovacao-pix-e-boleto', paises: ['br'], par: 'dupla-aprovacao-pagamentos', foto: '1556740714-a8395b3bf30f', cat: 'empresas', data: '2026-11-03', min: 6,
  titulo: 'Pix, boleto e TED: por que a dupla aprovação protege o caixa da empresa',
  resumo: 'Boleto adulterado, troca de chave Pix do fornecedor e erros de digitação têm a mesma defesa: ninguém paga sozinho acima de um certo valor.',
  corpo: `
<p>A maior parte das perdas em pagamentos de empresas não vem de invasões sofisticadas. Vem de situações simples: <strong>um e-mail que parece do fornecedor, um boleto com outro beneficiário, um número digitado errado</strong>. A dupla aprovação existe para que um único erro, ou uma única pessoa enganada, não saia caro.</p>
<h2>Os golpes mais comuns</h2>
<ul><li><strong>Boleto adulterado</strong>: o código de barras é alterado e o dinheiro vai para outra conta. O valor e o vencimento parecem corretos.</li><li><strong>Troca de dados bancários</strong>: um e-mail "do fornecedor" avisa que a chave Pix ou a conta mudou.</li><li><strong>Falso diretor</strong>: alguém se passa por um sócio e pede um pagamento urgente e confidencial.</li></ul>
<h2>Como funciona a dupla aprovação</h2>
<ol><li>Quem pede o pagamento anexa a nota fiscal ou o boleto e indica a rubrica do orçamento.</li><li>Uma primeira pessoa aprova, dentro da sua alçada.</li><li>Acima de um limite definido, é preciso uma <strong>segunda aprovação, de outra pessoa</strong>.</li><li>Só depois o financeiro executa o pagamento.</li></ol>
<div class="caixa"><b>Regra de ouro</b>Mudança de dados bancários de um fornecedor nunca é confirmada pelo mesmo canal em que chegou. Ligue para um telefone que você já tinha cadastrado.</div>
<h2>Cuidados no Pix e no boleto</h2>
<ul><li>Antes de confirmar um Pix, confira o <strong>nome e o CNPJ do recebedor</strong> exibidos na tela.</li><li>No boleto, compare o beneficiário e o CNPJ com os dados do fornecedor.</li><li>Desconfie de urgência e de pedidos de sigilo.</li></ul>
<div class="caixa"><b>No BXB</b>Cada pedido passa por alçadas e, acima do limite, por duas aprovações de pessoas diferentes, com assinatura e registro de quem aprovou e quando.</div>`
},
{
  id: 'fluxo-de-caixa-13-semanas', paises: ['br'], par: 'tesouraria-pme-13-semanas', foto: '1460925895917-afdab827c52f', cat: 'empresas', data: '2026-10-27', min: 6,
  titulo: 'Fluxo de caixa da empresa: a previsão de 13 semanas',
  resumo: 'Lucro no papel não paga a folha. Uma previsão semanal de entradas e saídas mostra com antecedência quando o caixa aperta e dá tempo de agir.',
  corpo: `
<p>Muitas empresas lucrativas passam aperto porque o dinheiro entra depois de sair. A <strong>previsão de 13 semanas</strong> (cerca de um trimestre) é a ferramenta mais simples para enxergar isso com antecedência.</p>
<h2>Como montar</h2>
<ol><li><strong>Saldo inicial</strong>: o que está hoje nas contas, sem contar valores bloqueados.</li><li><strong>Entradas por semana</strong>: vendas à vista, boletos a receber, recebíveis de cartão e Pix programados.</li><li><strong>Saídas por semana</strong>: folha e encargos, impostos (DAS, DARF, guias estaduais e municipais), fornecedores, aluguel e parcelas de empréstimos.</li><li><strong>Saldo final</strong> de cada semana, que vira o saldo inicial da seguinte.</li></ol>
<div class="caixa"><b>Saldo mínimo</b>Defina um valor abaixo do qual o caixa não deve cair, por exemplo uma folha de pagamento. Toda semana prevista abaixo desse valor é um alerta.</div>
<h2>Quando a previsão mostra um buraco</h2>
<ul><li><strong>Negocie prazos</strong> com fornecedores antes do vencimento, não depois.</li><li><strong>Cobre os atrasados</strong> e ofereça desconto para pagamento antecipado.</li><li><strong>Antecipação de recebíveis</strong>: resolve no curto prazo, mas tem custo. Compare com uma linha de capital de giro pelo CET.</li><li><strong>Reprograme pagamentos</strong> que não são críticos.</li></ul>
<h2>Atualize toda semana</h2>
<p>A previsão só funciona se for atualizada: substitua o previsto pelo realizado, acrescente uma semana nova no fim e veja o que mudou.</p>
<div class="caixa"><b>No BXB</b>A área de fluxo de caixa junta saldos, pedidos de pagamento aprovados e recebimentos previstos, mostrando o saldo projetado semana a semana.</div>`
},
{
  id: 'proteger-suas-contas', paises: ['br'], par: 'proteger-a-sua-conta', foto: '1584433144859-1fc3ab64a957', cat: 'seguranca', data: '2026-09-22', min: 4,
  titulo: 'Cinco hábitos para proteger suas contas online',
  resumo: 'Golpe da falsa central, WhatsApp clonado e links falsos por SMS: a maior parte dos golpes depende de você entregar uma informação. Veja como evitar.',
  corpo: `
<p>A maior parte dos golpes financeiros não quebra nenhum sistema: <strong>convence a vítima a entregar uma senha, um código ou a fazer um Pix</strong>. Cinco hábitos simples bloqueiam quase todos.</p>
<h2>1. Uma senha diferente para cada serviço</h2><p>Se uma senha vazar num site, ela não abre as outras contas. Um gerenciador de senhas ajuda a criar e lembrar todas.</p>
<h2>2. Ative a verificação em duas etapas</h2><p>No e-mail, no WhatsApp e nas redes sociais. É o que impede a clonagem do WhatsApp mesmo que alguém consiga o código de ativação.</p>
<h2>3. Desconfie de contato que chega até você</h2><p>No golpe da falsa central, alguém liga dizendo ser do banco e pede para "confirmar dados" ou fazer um Pix para uma "conta segura". Desligue e ligue você mesmo para o número oficial.</p>
<h2>4. Nunca compartilhe códigos</h2><p>Nenhum serviço legítimo pede, por telefone ou mensagem, o código que você recebeu por SMS, a senha ou o PIN.</p>
<h2>5. Cuidado com links</h2><p>Mensagens sobre entregas, multas ou pontos a vencer são iscas comuns. Acesse sempre digitando o endereço ou pelo aplicativo oficial.</p>
<div class="caixa"><b>No BXB</b>A senha serve para entrar e o PIN só para assinar operações: mesmo que alguém descubra a senha, não consegue aprovar pagamentos sem o PIN.</div>`
},
];

/* cada visitante só vê os artigos do seu país (pais.js); a lista completa fica em ARTIGOS_TODOS */
window.ARTIGOS_TODOS = window.ARTIGOS;
window.ARTIGOS = window.ARTIGOS.filter(function (a) { return !a.paises || a.paises.indexOf(window.BXB_PAIS || 'pt') >= 0; });

/* Capa de um artigo: fotografia (Unsplash, licença gratuita) com várias resoluções; sem fotografia, usa o gradiente da categoria. */
window.capaArtigo = function (a, sizes, ja) {
  var c = window.CATEGORIAS[a.cat] || {}, ico = '<svg viewBox="0 0 24 24"><use href="#' + (c.ico || 'i-livro') + '"/></svg>';
  if (!a.foto) return '<div class="capa cat-' + a.cat + '">' + ico + '</div>';
  var u = function (w) { return 'https://images.unsplash.com/photo-' + a.foto + '?auto=format&fit=crop&crop=entropy&q=82&w=' + w + '&h=' + Math.round(w * 9 / 16); };
  return '<div class="capa foto-a cat-' + a.cat + '"><img src="' + u(960) + '" srcset="' + [480, 640, 960, 1280, 1600, 2000].map(function (w) { return u(w) + ' ' + w + 'w'; }).join(', ') +
    '" sizes="' + (sizes || '(max-width:640px) 92vw, (max-width:1100px) 46vw, 30vw') + '" alt="" decoding="async"' + (ja ? '' : ' loading="lazy"') + '><span class="chip">' + ico + '</span></div>';
};
