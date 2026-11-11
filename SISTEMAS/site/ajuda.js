/* ajuda.js — perguntas do centro de ajuda (também usadas na pesquisa e nas "Dúvidas frequentes" da página inicial).
   seg: 'p' particulares, 'e' empresas, 'pe' ambos · topo: aparece na página inicial desse segmento. */
window.TEMAS_AJUDA = {
  acesso: { nome: 'Conta e acesso', d: 'Abrir conta, entrar e palavra-passe', ico: 'i-user' },
  pessoal: { nome: 'Plano pessoal', d: 'Painel, dívidas, poupança e IRS', ico: 'i-graf' },
  partilhas: { nome: 'Partilhas', d: 'Despesas e objetivos a dois', ico: 'i-pessoas' },
  empresas: { nome: 'Empresas e equipa', d: 'Áreas de empresa e colaboradores', ico: 'i-carteira' },
  pagamentos: { nome: 'Pagamentos e assinatura', d: 'PIN, aprovações e comprovativos', ico: 'i-chave' },
  seguranca: { nome: 'Segurança', d: 'Boas práticas e alertas de fraude', ico: 'i-escudo' }
};
window.AJUDA = [
  { id: 'abrir-conta', t: 'acesso', seg: 'pe', topo: 1, q: 'Como abro uma conta?',
    r: 'Em <a href="/SISTEMAS/entrar.html?criar=1">Abrir conta</a> escolha Particulares ou Empresas e indique o nome, o email e uma palavra-passe com pelo menos 8 caracteres. No caso de uma empresa, indique também o nome e, se quiser, o NIF. Entra na sua área logo a seguir.' },
  { id: 'pessoal-e-empresa', t: 'acesso', seg: 'pe', topo: 1, q: 'Posso ter a área pessoal e a da empresa com o mesmo email?',
    r: 'Sim. Com o mesmo email pode ter a sua área pessoal e uma ou mais empresas. Depois de entrar, escolha a área em "Trocar de área".' },
  { id: 'esqueci-palavra-passe', t: 'acesso', seg: 'pe', topo: 1, q: 'Esqueci-me da palavra-passe. O que faço?',
    r: 'Peça a reposição ao apoio BXB. Recebe uma palavra-passe temporária, que deve alterar no primeiro acesso em "A minha conta" › Palavra-passe.' },
  { id: 'mudar-palavra-passe', t: 'acesso', seg: 'pe', q: 'Como altero a palavra-passe?',
    r: 'Depois de entrar, abra "A minha conta" e use a secção Palavra-passe. Indique a atual e a nova.' },
  { id: 'terminar-sessao', t: 'acesso', seg: 'pe', q: 'Como termino a sessão?',
    r: 'No menu da sua área escolha "Sair". Por precaução, a sessão também termina automaticamente após um período sem atividade.' },
  { id: 'o-que-e-plano', t: 'pessoal', seg: 'p', topo: 1, q: 'O que inclui o plano pessoal?',
    r: 'Painel com a projeção do ano, despesas fixas e rendimentos, dívidas e cartões com plano de pagamento, objetivos de poupança, recibos e IRS, importação de extratos e despesas partilhadas.' },
  { id: 'plano-dividas', t: 'pessoal', seg: 'p', topo: 1, q: 'Como funciona o plano para sair das dívidas?',
    r: 'Indica os créditos e cartões com saldo, taxa e prestação, e o valor extra que consegue pagar por mês. O plano compara várias estratégias de pagamento e mostra, para cada uma, a data em que fica sem dívidas e o total de juros. Veja também o artigo <a href="/artigos/por-qual-divida-comecar">sobre como escolher a ordem de pagamento</a>.' },
  { id: 'extratos', t: 'pessoal', seg: 'p', q: 'Posso importar o extrato do meu banco?',
    r: 'Sim. Exporte o extrato no site do seu banco e carregue-o na área Extratos. Os movimentos são associados às despesas fixas e aos créditos correspondentes, e pode corrigir qualquer associação.' },
  { id: 'irs', t: 'pessoal', seg: 'p', q: 'O plano calcula o meu IRS?',
    r: 'Faz uma estimativa a partir dos recibos e das deduções que regista, para saber com antecedência se deverá receber ou pagar. O valor final é sempre o da liquidação feita pela Autoridade Tributária.' },
  { id: 'partilhar-despesas', t: 'partilhas', seg: 'p', topo: 1, q: 'Como funcionam as despesas partilhadas?',
    r: 'Indique o email da outra pessoa e proponha a despesa ou o objetivo. Depois de ela aceitar, passam a ter uma folha comum com o acerto do mês. A partilha abrange apenas essa folha.' },
  { id: 'convidar-sem-conta', t: 'partilhas', seg: 'p', q: 'A outra pessoa precisa de ter conta?',
    r: 'Sim. Cada pessoa entra com a sua própria conta. Se ainda não tiver, pode abrir uma conta particular com o email que indicou.' },
  { id: 'colaboradores', t: 'empresas', seg: 'e', topo: 1, q: 'Como entram os colaboradores da empresa?',
    r: 'O responsável convida-os pelo email em "A minha conta". Cada colaborador entra com o seu email e palavra-passe; o responsável define o papel e a alçada de cada um.' },
  { id: 'varias-empresas', t: 'empresas', seg: 'e', q: 'Posso gerir mais do que uma empresa?',
    r: 'Sim. Cada empresa é uma área própria, com a sua equipa e as suas regras. Abra uma nova em "Trocar de área" › Criar empresa.' },
  { id: 'remover-colaborador', t: 'empresas', seg: 'e', q: 'Como retiro o acesso a um colaborador?',
    r: 'Em "A minha conta", na lista de colaboradores da empresa, remova a pessoa. O acesso termina de imediato.' },
  { id: 'palavra-passe-e-pin', t: 'pagamentos', seg: 'pe', topo: 1, q: 'Qual é a diferença entre a palavra-passe e o PIN?',
    r: 'A palavra-passe serve para entrar. O PIN serve para assinar: aprovar um pagamento, aceitar uma partilha ou alterar uma regra. Define-o na primeira assinatura e pode alterá-lo quando quiser.' },
  { id: 'dupla-aprovacao', t: 'pagamentos', seg: 'e', topo: 1, q: 'O que é a dupla aprovação?',
    r: 'Acima do limite definido pela empresa, um pagamento precisa da aprovação de duas pessoas diferentes antes de ser executado. Cada aprovação é assinada com o PIN e a rubrica de quem aprova.' },
  { id: 'duas-pessoas', t: 'pagamentos', seg: 'e', q: 'O que é a regra das duas pessoas?',
    r: 'Alterações sensíveis, como mudar alçadas, utilizadores ou orçamentos, só entram em vigor depois de uma segunda pessoa as aprovar.' },
  { id: 'comprovativos', t: 'pagamentos', seg: 'e', q: 'Como se confirma um comprovativo?',
    r: 'Os comprovativos e documentos assinados incluem um código QR que permite confirmar a assinatura e a data de cada aprovação.' },
  { id: 'nunca-pedimos', t: 'seguranca', seg: 'pe', topo: 1, q: 'A BXB pede dados por email, SMS ou telefone?',
    r: 'Não. A BXB nunca pede a palavra-passe, o PIN ou códigos por email, SMS ou telefone. Se receber um pedido assim, não responda e entre sempre escrevendo o endereço do site.' },
  { id: 'boas-praticas', t: 'seguranca', seg: 'pe', q: 'Como protejo a minha conta?',
    r: 'Use uma palavra-passe que não utilize noutros serviços, não partilhe o PIN e termine a sessão em computadores partilhados. Veja <a href="/artigos/proteger-a-sua-conta">cinco hábitos para proteger as suas contas online</a>.' },
  { id: 'onde-ficam-dados', t: 'seguranca', seg: 'pe', q: 'Como são guardados os dados?',
    r: 'Numa base de dados com cópias de segurança diárias, com 60 dias de histórico. As ligações ao site são cifradas.' }
];

/* Brasil: as mesmas perguntas, em português do Brasil e com os termos e artigos brasileiros */
if (window.BXB_PAIS === 'br') (function () {
  var T = window.TEMAS_AJUDA;
  T.acesso.d = 'Abrir conta, entrar e senha';
  T.pessoal.d = 'Painel, dívidas, economia e Imposto de Renda';
  T.partilhas.nome = 'Compartilhamento'; T.partilhas.d = 'Despesas e objetivos a dois';
  T.empresas.nome = 'Empresas e equipe'; T.empresas.d = 'Áreas de empresa e colaboradores';
  T.pagamentos.d = 'PIN, aprovações e comprovantes';
  T.seguranca.d = 'Boas práticas e alertas de golpe';
  var BR = {
    'abrir-conta': ['Como abro uma conta?', 'Em <a href="/SISTEMAS/entrar.html?criar=1">Abrir conta</a>, escolha Pessoa física ou Empresas e informe o nome, o e-mail e uma senha com pelo menos 8 caracteres. No caso de uma empresa, informe também o nome e, se quiser, o CNPJ. Você entra na sua área logo em seguida.'],
    'pessoal-e-empresa': ['Posso ter a área pessoal e a da empresa com o mesmo e-mail?', 'Sim. Com o mesmo e-mail você pode ter sua área pessoal e uma ou mais empresas. Depois de entrar, escolha a área em "Trocar de área".'],
    'esqueci-palavra-passe': ['Esqueci minha senha. O que faço?', 'Peça a redefinição ao suporte BXB. Você recebe uma senha temporária, que deve trocar no primeiro acesso em "Minha conta" › Senha.'],
    'mudar-palavra-passe': ['Como troco a senha?', 'Depois de entrar, abra "Minha conta" e use a seção Senha. Informe a atual e a nova.'],
    'terminar-sessao': ['Como saio da conta?', 'No menu da sua área, escolha "Sair". Por precaução, a sessão também é encerrada automaticamente depois de um período sem atividade.'],
    'o-que-e-plano': ['O que inclui o plano pessoal?', 'Painel com a projeção do ano, despesas fixas e renda, dívidas e cartões com plano de quitação, objetivos de economia, comprovantes e Imposto de Renda, importação de extratos e despesas compartilhadas.'],
    'plano-dividas': ['Como funciona o plano para sair das dívidas?', 'Você informa os empréstimos e cartões com saldo, taxa e parcela, e o valor extra que consegue pagar por mês. O plano compara várias estratégias de pagamento e mostra, para cada uma, a data em que você fica sem dívidas e o total de juros. Veja também o artigo <a href="/artigos/varias-dividas-por-onde-comecar">sobre como escolher a ordem de pagamento</a>.'],
    'extratos': ['Posso importar o extrato do meu banco?', 'Sim. Exporte o extrato no site ou no aplicativo do seu banco e carregue-o na área Extratos. As movimentações são associadas às despesas fixas e aos créditos correspondentes, e você pode corrigir qualquer associação.'],
    'irs': ['O plano calcula meu Imposto de Renda?', 'Faz uma estimativa a partir dos rendimentos e das despesas dedutíveis que você registra, para saber com antecedência se deve receber restituição ou pagar imposto. O valor final é sempre o da declaração processada pela Receita Federal.'],
    'partilhar-despesas': ['Como funcionam as despesas compartilhadas?', 'Informe o e-mail da outra pessoa e proponha a despesa ou o objetivo. Depois que ela aceitar, vocês passam a ter uma planilha comum com o acerto do mês. O compartilhamento vale apenas para essa planilha.'],
    'convidar-sem-conta': ['A outra pessoa precisa ter conta?', 'Sim. Cada pessoa entra com a própria conta. Se ainda não tiver, pode abrir uma conta pessoal com o e-mail que você informou.'],
    'colaboradores': ['Como os colaboradores da empresa entram?', 'O responsável os convida pelo e-mail em "Minha conta". Cada colaborador entra com seu e-mail e senha; o responsável define o papel e a alçada de cada um.'],
    'varias-empresas': ['Posso gerenciar mais de uma empresa?', 'Sim. Cada empresa é uma área própria, com sua equipe e suas regras. Crie uma nova em "Trocar de área" › Criar empresa.'],
    'remover-colaborador': ['Como removo o acesso de um colaborador?', 'Em "Minha conta", na lista de colaboradores da empresa, remova a pessoa. O acesso é encerrado na hora.'],
    'palavra-passe-e-pin': ['Qual é a diferença entre a senha e o PIN?', 'A senha serve para entrar. O PIN serve para assinar: aprovar um pagamento, aceitar um compartilhamento ou alterar uma regra. Você o define na primeira assinatura e pode trocá-lo quando quiser.'],
    'dupla-aprovacao': ['O que é a dupla aprovação?', 'Acima do limite definido pela empresa, um pagamento precisa da aprovação de duas pessoas diferentes antes de ser realizado. Cada aprovação é assinada com o PIN e a rubrica de quem aprova. Veja o artigo <a href="/artigos/dupla-aprovacao-pix-e-boleto">sobre Pix, boleto e dupla aprovação</a>.'],
    'duas-pessoas': ['O que é a regra das duas pessoas?', 'Alterações sensíveis, como mudar alçadas, usuários ou orçamentos, só entram em vigor depois que uma segunda pessoa as aprova.'],
    'comprovativos': ['Como se confere um comprovante?', 'Os comprovantes e documentos assinados incluem um QR code que permite conferir a assinatura e a data de cada aprovação.'],
    'nunca-pedimos': ['A BXB pede dados por e-mail, SMS, WhatsApp ou telefone?', 'Não. A BXB nunca pede a senha, o PIN ou códigos por e-mail, SMS, WhatsApp ou telefone. Se receber um pedido assim, não responda e entre sempre digitando o endereço do site.'],
    'boas-praticas': ['Como protejo minha conta?', 'Use uma senha que você não usa em outros serviços, não compartilhe o PIN e saia da conta em computadores compartilhados. Veja <a href="/artigos/proteger-suas-contas">cinco hábitos para proteger suas contas online</a>.'],
    'onde-ficam-dados': ['Como os dados são guardados?', 'Num banco de dados com backups diários e 60 dias de histórico. As conexões com o site são criptografadas.']
  };
  window.AJUDA.forEach(function (a) { var b = BR[a.id]; if (b) { a.q = b[0]; a.r = b[1]; } });
})();
