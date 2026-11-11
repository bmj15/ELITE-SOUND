# Contrato da API de consulta (versão 1)

Esta API é o **único** caminho pelo qual o back-office (BXB Gestor .exe e painel de gestão) lê o sistema do cliente.
É servida pelo `servidor.js` (parte do Claude). Para pedir mudanças, o Codex escreve em `backoffice/PEDIDOS-API.md`.
Regras gerais em [AGENTS.md](AGENTS.md).

## Ligação

- Endereço: `http://127.0.0.1:8097` em produção; muda com a variável `PORT_CONSULTA` (testes do Codex: 8897).
  - Só aceita ligações deste computador e o cabeçalho `Host` tem de ser `127.0.0.1`, `localhost` ou `[::1]`.
- Autenticação: `Authorization: Bearer <chave>`.
  - A chave está no ficheiro `consulta.chave`, na pasta de dados do site (`BXB_DADOS`; em produção `BXB INVESTIMENTOS\DADOS-SERVIDOR\consulta.chave`).
  - São 64 caracteres hexadecimais. O servidor do site cria-a no primeiro arranque.
  - O back-office lê a chave sempre que receber `401`, porque ela pode ter sido renovada.
- Pedidos com o cabeçalho `Origin` são recusados (`403`): a API é só de servidor para servidor e nunca é chamada pelo browser.
  - O painel do back-office pede ao servidor do back-office, e é esse servidor que pede à API.
- Tudo é `GET`, exceto `POST /v1/desligar`. Qualquer outro método dá `405`.
- As respostas são JSON (`application/json; charset=utf-8`). Em erro, a resposta é `{ "erro": "texto" }`.
- Datas em texto ISO 8601 (UTC). `arranque` e `expira` são milissegundos desde 1970.
- O servidor do site pode estar desligado. Nesse caso a ligação falha e o back-office mostra "servidor do site desligado".

## O que a API nunca devolve

Palavras-passe, hashes, tokens de sessão, a palavra-passe do email, chaves e segredos.
Também nunca devolve o **conteúdo financeiro dos clientes** (orçamentos, movimentos, objetivos…), apenas metadados.

## Rotas

### `GET /v1/saude` (sem chave)
Indica se o servidor do site está ligado e com que processo.
```json
{ "ok": true, "servidor": "grupo-bxb-servidor", "contrato": 1, "pid": 1234, "arranque": 1762900000000, "versao": "2f11328",
  "portas": { "site": 80, "rede": 8443, "gestao": 8099, "consulta": 8097 },
  "enderecos": [{ "nome": "Site neste computador", "url": "http://localhost/" }] }
```
`portas.x = 0` quer dizer que essa porta não abriu. `contrato` é a versão deste contrato.

### `POST /v1/desligar`
Desliga o servidor do site com ordem: fecha as portas, fecha a base de dados e o processo sai. Responde `{ "ok": true }`.
É a única rota que não é consulta e serve só para o BXB Gestor ligar, desligar e reiniciar o site.

### `GET /v1/painel`
Resumo para o painel.
```json
{ "servidor": { "pid": 0, "arranque": 0, "node": "v22…", "memoria": 0, "versao": "abc1234", "versaoDisco": "abc1234",
                "portas": {}, "enderecos": [], "dados": "C:\\…\\DADOS-SERVIDOR", "bd": 0, "copias": 0, "ultimaCopia": "2026-11-11" },
  "contas":   { "total": 0, "ativas": 0, "admins": 0, "novas30": 0, "sessoes": 0, "comSessao": 0 },
  "areas":    { "particular": 0, "empresa": 0 },
  "entradas": { "d7": 0, "falhadas7": 0, "recusados7": 0 },
  "email":    { "pronto": true, "conta": "remetente@…", "enviados7": 0, "falhados7": 0 },
  "geral":    { "marca": "BXB", "descricao": "", "urlPublico": "", "emailSuporte": "" },
  "atividade": [ /* 8 linhas como em /v1/registo */ ] }
```
- `versaoDisco` diferente de `versao` quer dizer que há código novo e o site precisa de reiniciar.
- `bd` é o tamanho da base de dados em bytes e `memoria` é o RSS do processo, também em bytes.

### `GET /v1/contas`
```json
{ "contas": [{ "id": "c…", "nome": "", "email": "", "admin": false, "ativo": true, "criada_em": "ISO",
               "ultima": "ISO ou null", "sessoes": 0,
               "areas": [{ "id": "a…", "tipo": "particular|empresa", "nome": "", "papel": "dono|colaborador" }] }] }
```
`ultima` é a última entrada da conta e `sessoes` são as sessões abertas nesse momento.

### `GET /v1/contas/{id}?limite=40`
```json
{ "conta": { /* como uma linha de /v1/contas */ },
  "perfil": { "pendente": false, "tipo": "particular|empresa", "pais": "pt|br", "verificado": true, "em": "ISO",
              "telefone": "", "documento": "", "nascimento": "", "situacao": "", "objetivo": "",
              "empresa": "", "setor": "", "dimensao": "", "cargo": "" },
  "sessoes": [{ "criada": "ISO", "visto": "ISO", "ip": "", "agente": "", "expira": 0 }],
  "registo": [ /* até `limite` (máx. 500) linhas desta conta, como em /v1/registo */ ] }
```
- `perfil` traz só os campos preenchidos.
- Num particular aparecem `nascimento`, `situacao` e `objetivo`; numa empresa aparecem `empresa`, `setor`, `dimensao` e `cargo`.
- `pendente: true` quer dizer que a pessoa ainda não completou o perfil.
- Se a conta não existir, a resposta é `404`.

### `GET /v1/areas`
```json
{ "areas": [{ "id": "a…", "tipo": "particular|empresa|arquivo", "nome": "", "criada_em": "ISO", "membros": 1, "dono": "id da conta ou null" }] }
```

### `GET /v1/registo?acao=&conta=&texto=&leituras=0&antes=&limite=200`
Registo de atividade do sistema do cliente, do mais recente para o mais antigo.
```json
{ "registo": [{ "em": "ISO", "acao": "ENTRADA", "alvo": "texto ou null", "ip": "", "conta": "id ou null", "nome": "ou null", "email": "ou null" }] }
```
- `acao` filtra pelo início do nome, por exemplo `ENTRADA` também apanha `ENTRADA_FALHADA`.
- `texto` procura no nome, email, alvo e IP.
- `leituras=1` inclui as leituras de dados (`LEITURA`).
- `antes` é uma data ISO e serve para paginar.
- `limite` vai de 1 a 500.

### `GET /v1/emails?limite=150`
Emails enviados pelo sistema, do mais recente para o mais antigo (máx. 1000).
```json
{ "emails": [{ "id": 1, "em": "ISO", "para": "", "modelo": "boas-vindas", "assunto": "", "estado": "enviado|falhou", "erro": "ou null" }] }
```

### `GET /v1/email`
Configuração do email, só para ver.
```json
{ "smtp": { "servidor": "smtp.gmail.com", "porta": 465, "seguranca": "ssl|starttls", "utilizador": "", "remetente": "", "nomeRemetente": "", "temPalavra": true },
  "pronto": true, "registo": { "verificarEmail": false }, "verificacaoAtiva": false,
  "modelos": [{ "id": "boas-vindas", "nome": "", "quando": "", "vars": ["nome"], "assunto": "", "html": "", "ativo": true, "alterado": false, "em": "ISO ou null" }] }
```
- `verificacaoAtiva` só é `true` quando a verificação está ligada **e** o email está pronto.

### `GET /v1/definicoes`
```json
{ "geral": { "marca": "", "descricao": "", "urlPublico": "", "emailSuporte": "" }, "versao": "", "versaoDisco": "", "portas": {} }
```

### `GET /v1/consola?desde=ISO`
Últimas linhas (até 600) que o servidor do site escreveu na consola. Com `desde`, devolve só as linhas mais recentes do que essa data.
```json
{ "linhas": [{ "em": "ISO", "nivel": "info|warn|error", "t": "texto" }] }
```

### `GET /v1/rede?linhas=300`
Últimas linhas (até 1000) do registo da rede de casa (`rede.log`).
```json
{ "linhas": ["2026-11-11T21:00:00.000Z texto…"] }
```

## Mudanças a este contrato

- Acrescentar rotas ou campos não muda a versão. O back-office deve ignorar os campos que não conhece.
- Remover ou mudar o significado de um campo sobe a versão (`/v2/...`, `contrato: 2`). A versão anterior fica enquanto o back-office precisar dela.
