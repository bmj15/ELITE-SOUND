# Sistemas de Gestão — Elite Sound e BXB Investimentos

Dê **duplo clique em `ABRIR SISTEMA.bat`**, na pasta do repositório. O sistema abre no Chrome em **http://localhost:8080** (servidor local). Não feche a janela preta enquanto usa o sistema; para parar, feche-a.

## Servidor local e código no repositório (fonte única)
O código vem do repositório **github.com/bmj15/ELITE-SOUND** (ramo `master`). O `ABRIR SISTEMA.bat`:
1. vai buscar ao GitHub a versão mais recente do código (sem internet, usa a que já está no computador);
2. arranca o **servidor local** (`servidor.js`, precisa do **Node.js**; se faltar, o ficheiro abre a página de download);
3. abre **http://localhost:8080** no Chrome.

- O servidor só aceita ligações deste computador. Se o abrir outra vez com o servidor já ligado, apenas abre o browser.
- Os dados **não** vão para o repositório: ficam no Chrome deste computador, associados ao endereço `localhost:8080`. Atualizar o código não apaga nem altera dados.
- **Mudança do arranque antigo (uma única vez):** os dados de quando o sistema era aberto diretamente como ficheiro (`index.html`) não aparecem em `localhost:8080`. Abra a versão antiga (duplo clique em `SISTEMAS\index.html`), faça **Definições → Exportar cópia (.json)** na BXB Investimentos e na Elite Sound, e restaure cada cópia no sistema correspondente em http://localhost:8080.

| Pasta | Conteúdo |
|---|---|
| `bxb-investimentos/` | **Holding do grupo**: subsidiárias, entidades, crédito e PIA (Processamento Integrado de Autorizações), aplicações em fundos |
| `subsidiaria/` | Sistema próprio de cada subsidiária criada pela BXB (abre com `?s=<chave>`). A **Elite Sound** é a primeira |
| `elite-sound/` | Atalho antigo: redireciona para o sistema da Elite Sound em `subsidiaria/` (mesmos dados) |
| `shared/` | **SPAP**: o motor de autorização de pagamentos, comum aos dois sistemas |

> **Livro de contas interno:** todas as contas são internas — empresas, fundos, particulares, credores, vendedores e sócios têm uma conta com saldo próprio. O sistema não trabalha com contas bancárias; os fundos só se movem entre contas internas, sempre por pedido autorizado.

## Grupo e subsidiárias
- A **BXB Investimentos é a holding**. Em **Grupo e subsidiárias** cria-se uma subsidiária nova (nome, sigla, NIF, setor, cores e participação da BXB) e escolhe-se o modelo de sistema:
  - **Comércio e serviços** — vendas, catálogo, comissões e distribuição de resultados (o modelo da Elite Sound);
  - **Planeamento financeiro** — o Planeador Financeiro dentro do grupo (`shared/modelo-planeamento.js`):
    - **Rendimentos:** recibos de vencimento e projeção anual, com os subsídios de férias e de Natal estimados.
    - **Despesas fixas:** convertidas em valor mensal.
    - **Dívidas e créditos:** taxas TAN/TAEG e comissão legal de amortização antecipada.
    - **Simulador:** compara as estratégias avalanche, snowball e equilibrada, com fundo de emergência e poupança.
    - **Objetivos e saúde financeira.**
    - **Pagamentos:** as prestações, as despesas, as amortizações e a entrada dos vencimentos na tesouraria são pedidos SPAP. A conta do credor ou fornecedor é criada automaticamente. O que ainda não foi pedido entra na previsão de liquidez;
  - **Base** — só contas, pagamentos, autorizações e relatórios.
- Criar ou alterar uma subsidiária segue a regra das duas pessoas. A subsidiária recebe um **sistema próprio** (livro de contas, utilizadores, PIN, autorizações e auditoria independentes), uma conta na holding e aparece no portal.
- No primeiro acesso ao sistema da subsidiária, o administrador define o PIN. Ao criar a subsidiária escolhe-se que utilizadores da holding têm acesso e com que papel (pelo menos um administrador). Os outros não são copiados. Entram sem PIN.
- A holding vê os indicadores de cada subsidiária e reconcilia as transferências no **Intercompany e grupo** (um separador por empresa).

## Comissões dos vendedores
Configuram-se em **Catálogo e cadastro → Regras de comissão** (alteração com a regra das duas pessoas). Aplicam-se às vendas registadas depois da alteração; as vendas já registadas mantêm as regras com que foram feitas.
- **Quem recebe:** só o vendedor, ou **todos os incluídos na venda** (equipa). Com equipa, a comissão é dividida em partes iguais, por **pesos de cada papel** (vendedor, técnico, montagem, apoio) ou pela **% indicada em cada venda**. A equipa escolhe-se no formulário da venda.
- **Calcular sobre:** o preço s/IVA, ou a **margem** (preço s/IVA − custo do serviço, definido em Serviços e preços).
- **Tipo:** percentagem (a % de cada vendedor, ou a dos escalões) ou **valor fixo por venda**.
- **Escalões e metas:** a % sobe com o volume do mês de cada pessoa (ex.: desde 0 € → 10%, desde 1000 € → 15%) e aplica-se a todas as vendas desse mês. Cada escalão pode ter um **bónus**, pago uma vez no mês em que a meta é atingida. Os bónus entram na comissão do mês e reduzem o lucro a distribuir.
- As comissões continuam a ser pagas por pedido SPAP, por vendedor e por mês (página **Comissões**).

## Participação nos lucros
Ativa-se em **Catálogo e cadastro → Participação nos lucros** (regra das duas pessoas).
- Em vez de receber a comissão em dinheiro, o vendedor pode **convertê-la em unidades de participação** (botão **Converter** na página Comissões), a um preço fixo por unidade (ex.: 10 €).
- **Limite:** no máximo uma % de cada comissão mensal e/ou um valor em € por mês e por vendedor; aplica-se o mais restritivo. O resto continua a poder ser pedido em dinheiro.
- A conversão é um pedido SPAP (caixa → *Fundo de participação dos colaboradores*), com aprovação e assinatura. As unidades só contam depois de o pedido ser **executado**.
- Em cada mês, uma **% do lucro** (configurável, válida a partir do mês em que é alterada) vai para os titulares de unidades, repartida pelas unidades de cada um no fim do mês. O resto é distribuído pelos sócios conforme as quotas. Os pagamentos aos titulares aparecem na **Distribuição de resultados**.
- A participação de colaboradores nos lucros pode ter implicações fiscais e laborais: valide com o contabilista certificado.

## Análise financeira
Disponível na holding e em todas as subsidiárias (menu **Análise financeira**). Cada indicador tem um **(i)**: ao passar o cursor (ou ao tocar/navegar com o teclado) mostra o significado e a fórmula.
- **Indicadores de negócio:** Revenue, Contribution margin, EBITDA e EBITDA margin, Net income e Net margin, **Break-even point**, Break-even units, Margin of safety, DOL, Cash position, Burn rate, Cash runway, OCF, CAPEX, FCF, Cash conversion, ROI, ROE, ROA, YoY, MoM, CAGR, Revenue run-rate, Average ticket, Variable cost ratio, OPEX, D&A — com gráficos e um **simulador de break-even**.
- **Relatórios financeiros:** Demonstração de resultados (P&L), Demonstração de fluxos de caixa e Balanço simplificado, mensais, com comparação com o ano anterior e exportação CSV. Em **Classificação** define-se a natureza de cada categoria (receita, custo variável, custo fixo, CAPEX…), a taxa de IRC, a vida útil dos ativos e as contas próprias.
- **Planeamento de investimentos:** NPV (VAL), IRR (TIR), Payback, Discounted payback, Profitability Index e ROI, com cenários pessimista/base/otimista e análise de sensibilidade. Um projeto pode ser submetido diretamente como pedido de investimento.
- Os relatórios são de gestão, construídos a partir do livro interno: **não substituem** as demonstrações oficiais do contabilista certificado.

## Privacidade entre empresas
- O sistema de cada subsidiária mostra **apenas os seus próprios saldos**. No Intercompany vê só as transferências em que participa.
- Os saldos das subsidiárias e o consolidado do grupo só aparecem na holding.

## Primeiro acesso
1. Cada sistema pede para definir o PIN do administrador (Bruno).
2. Em **Utilizadores e alçadas**, defina um PIN temporário para a Beatriz (aprovadora).
3. Quando houver dois aprovadores, ative a **segregação de funções** em **Definições**.

## Circuito de um pagamento (SPAP)
`Pedido → Aprovação (1 ou 2, assinada com PIN) → N.º de autorização → Execução (assinada com PIN) → Movimentos no extrato`

- Acima do limite de dupla aprovação (Elite: 500 €, BXB: 2500 €), quando o pedido excede o orçamento do mês ou quando há indícios de **fracionamento** (vários pedidos do mesmo dia para o mesmo destino que somados passam o limite), são necessárias **2 aprovações de pessoas diferentes**.
- A **alçada** de cada aprovador é o valor máximo que pode aprovar (Beatriz: 5 000 € na Elite, 50 000 € na BXB; o administrador não tem limite). Em pagamentos parcelados conta o **valor total**.
- Os pedidos aprovados ficam como **saldo cativo**. Não é possível executar um pagamento sem saldo.
- Todas as ações ficam num **registo de auditoria encadeado por SHA-256**. Em Auditoria → *Verificar integridade* é detetada qualquer alteração feita fora do sistema.
- O requerimento pode ser **visualizado** no formato do Departamento Financeiro (e impresso ou guardado em PDF a partir daí).

## Regra das duas pessoas (alterações)
- Mudar **regras, orçamentos, utilizadores, alçadas, PIN de outra pessoa, limites de conta, centros de custo, parâmetros de cálculo, vendedores/comissões, sócios/quotas**, **restaurar uma cópia** ou **repor o sistema** cria uma *proposta* assinada que só é aplicada depois de aprovada por **outro aprovador**, em **Alterações pendentes**.
- Ninguém aprova as próprias propostas, nem alterações que lhe digam respeito (ex.: a própria alçada).
- **Modo de arranque:** enquanto não houver 2 aprovadores com PIN ativo, as alterações aplicam-se logo e ficam marcadas "sem duplo controlo".
- Quando o PIN de alguém é redefinido, essa pessoa é avisada no acesso seguinte.

## Prova de saldos e fecho diário
- **Prova de saldos:** confirma que cada pagamento executado tem exatamente os movimentos certos, que as transferências internas somam zero e que não há movimentos sem autorização.
- **Fecho diário:** fotografia assinada dos saldos e movimentos até à data, encadeada com o fecho anterior. Depois do fecho, o período fica **bloqueado**: não se podem lançar, alterar ou executar operações com essa data. Qualquer alteração por fora é detetada ("Violado").

## Intercompany e grupo
- Distribuições da Elite Sound para a BXB (conta *BXB Investimentos (sócio)*) e transferências da BXB para a Elite (conta *0021_BXB_SOUND*) aparecem no outro sistema como **"por reconhecer"**. Cada lado reconhece com o seu próprio pedido autorizado e assinado.
- O ecrã mostra o **total consolidado do grupo** sem dupla contagem e o valor **em trânsito**. Os dois sistemas têm de ser usados no mesmo navegador.

## Limites por conta
- Em cada conta (Contas e saldos → conta) pode definir **saldo mínimo de reserva**, **limite de saída diária** e **mensal**, e **bloquear** a conta.
- Os limites são **obrigatórios na execução**: um pagamento que os viole não é executado. Na criação, o pedido já mostra o aviso.
- Alterar limites segue a regra das duas pessoas. **Bloquear é imediato**, mas desbloquear exige outro aprovador.

## Previsão de liquidez (13 semanas)
- Saldo projetado semana a semana, por conta ou consolidado, com base nos pedidos aprovados (e, se quiser, nos que ainda estão em aprovação), nos recorrentes, nas prestações do PIA ainda por autorizar (BXB) e nas comissões por pedir (Elite Sound).
- Alerta no painel quando uma conta vai ficar abaixo do saldo mínimo ou negativa.

## Pedidos recorrentes
- Modelos semanais, mensais, trimestrais ou anuais (mensalidades, avenças, rendas internas…). Quando chega a altura (com a antecedência definida), aparecem como "por gerar". Um clique e uma assinatura geram todos os pedidos, que seguem o circuito normal de aprovação.

## Delegação de alçadas
- Um aprovador pode delegar a sua alçada noutro utilizador por um período até 60 dias (ex.: férias), em **Delegação de alçadas**. A alçada delegada nunca excede a do delegante; a delegação é assinada e pode ser revogada. As aprovações feitas por delegação ficam identificadas no pedido.

## Centros de custo e relatórios
- Crie centros de custo (com responsável e orçamento anual) e impute-lhes os pedidos. Pedidos que façam ultrapassar o orçamento anual do centro exigem **2 aprovações**.
- Relatórios: **orçamento vs real** (executado, comprometido, disponível), **execução mensal** e **por categoria**, com exportação CSV.

## Assinatura eletrónica
- Cada utilizador recebe um **certificado próprio** (par de chaves ECDSA P-256) na primeira entrada. A chave privada fica cifrada com o PIN e só o titular a pode usar.
- **Submeter, aprovar, executar, rejeitar e cancelar** ficam assinados com PIN + **rubrica desenhada**. A rubrica é registada na primeira assinatura e pode ser mudada no botão da caneta, na barra lateral.
- Se o pedido for alterado depois de assinado, a assinatura aparece como **inválida**.
- Esta é uma assinatura eletrónica interna. Não é uma assinatura qualificada (Cartão de Cidadão / Chave Móvel Digital).

## Código QR
- Cada requerimento traz um **código QR de verificação** com a impressão digital do documento.
- No menu **Verificar documento**, leia o QR pela câmara, por fotografia ou colando o texto. O sistema confirma se o documento é autêntico, se está atualizado e se as assinaturas são válidas.

## Dados
- Os dados ficam guardados **no próprio navegador** (Chrome, neste computador).
- Faça cópias com regularidade em **Definições → Exportar cópia (.json)**. Se limpar os dados do Chrome, o sistema é apagado.
- Os dados iniciais foram migrados de `ELITE SOUND.xlsx`, `GESTÃO BXB INVESTIMENTOS.xlsx` e `GESTÃO DE ENTIDADES (Respostas).xlsx`.
