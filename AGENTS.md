# Regras para agentes (Codex e Claude)

Este repositório é trabalhado por dois agentes ao mesmo tempo. Cada um tem a sua parte e **nunca mexe na parte do outro**.
Escreve sempre em português de Portugal (código, comentários, textos e mensagens de commit).

## Quem faz o quê

| Parte | Responsável | Pastas e ficheiros |
|---|---|---|
| **Back-office**: BXB Gestor (.exe) e painel de gestão, com servidor e base de dados próprios | **Codex** | `backoffice/**`, `gestor/**` |
| **Sistema do cliente**: site público, sistema dos clientes, servidor do site, API de consulta | **Claude** | tudo o resto: `servidor.js`, `SISTEMAS/**`, `backend/**`, `index.html`, `ABRIR SISTEMA.bat`, `.gitignore`, `AGENTS.md`, `CLAUDE.md`, `CONTRATO-CONSULTA.md` |

O Codex está **expressamente proibido** de alterar, criar ou apagar ficheiros fora de `backoffice/` e `gestor/`.
O Claude está proibido de alterar `backoffice/` e `gestor/`.

## Regra de ouro do back-office: só consulta

O back-office **só lê** o sistema do cliente e nunca escreve nem altera os dados dele.

- A única forma de ler o sistema do cliente é a **API de consulta** do servidor do site: `http://127.0.0.1:8097/v1/...`. O contrato está em [CONTRATO-CONSULTA.md](CONTRATO-CONSULTA.md).
- O back-office **nunca** abre a base de dados do cliente (`DADOS-SERVIDOR\bxb.db`). Também **nunca** escreve na pasta `DADOS-SERVIDOR`.
  - Lê apenas um ficheiro dessa pasta: a chave `DADOS-SERVIDOR\consulta.chave`.
- **Única exceção**: o BXB Gestor .exe pode ligar, desligar e reiniciar o processo do servidor do site.
  - Liga com `node servidor.js` e desliga com `POST /v1/desligar` da API de consulta.
  - Isto controla o processo e não mexe em dados.
- O back-office tem a **sua própria** base de dados, guardada em `BXB INVESTIMENTOS\DADOS-BACKOFFICE\` (fora do repositório; variável `BXB_DADOS_BACKOFFICE`).
  - Lá ficam os utilizadores e perfis do back-office, as sessões, o registo de auditoria do back-office e as estatísticas agregadas.
  - **Não guarda cópias de dados pessoais dos clientes**: consulta-os quando precisa.
- Se o back-office precisar de dados que a API ainda não dá, escreve o pedido em `backoffice/PEDIDOS-API.md`. Não altera o `servidor.js`.
  - O Claude acrescenta o que for preciso à API e atualiza o contrato.
- O que altera o sistema do cliente vai para a página **Administração** do sistema do cliente, que é do Claude:
  - servidor de email, modelos de email e verificação de email no registo;
  - nome e endereço do projeto;
  - ativar e desativar contas, repor palavras-passe e terminar sessões.

## Portas

| Serviço | Produção | Testes do Claude | Testes do Codex |
|---|---|---|---|
| Site | 80 (reserva 8080) | 8791 | 8891 |
| Rede de casa (https) | 8443 | 8792 | 8892 |
| API de consulta (só leitura) | 8097 | 8797 | 8897 |
| Servidor do back-office (Codex) | 8100 | — | 8890 |
| Consola antiga (a retirar) | 8099 | 8798 | 8898 |

Todas as portas, exceto o site e a rede de casa, só aceitam ligações deste computador (`127.0.0.1`).

## Consola antiga (congelada, vai ser retirada)

A consola de gestão antiga foi feita antes desta divisão e está **congelada**. Ninguém a altera nem lhe acrescenta nada:
- a porta 8099;
- a pasta `SISTEMAS/gestao/`;
- as rotas `/api/gestao/*` em `servidor.js`;
- a chave `DADOS-SERVIDOR\gestao.chave`.

O novo back-office não a usa. O Claude retira-a quando:
- o back-office novo estiver pronto;
- as funções que alteram dados tiverem passado para a Administração do sistema do cliente.

## Testes

- **Nunca** corras `servidor.js`, o servidor do back-office ou o `.exe` com os dados reais.
  - Usa sempre pastas de teste: `BXB_DADOS` para o site e `BXB_DADOS_BACKOFFICE` para o back-office.
  - Usa também as portas de teste da tabela.
- Sem `BXB_DADOS`, o `servidor.js` usa os dados reais (`..\..\DADOS-SERVIDOR`). Também é assim se for corrido a partir da cópia do Codex.
- As pastas de teste do Codex ficam em `BXB INVESTIMENTOS\TESTES-CODEX\`, fora do repositório.

## Git

- O Claude trabalha em `GIT\ELITE-SOUND`. É também a pasta onde o sistema corre a sério.
- O Codex trabalha na sua própria cópia, `GIT\BXB-BACKOFFICE`. É um clone do mesmo repositório GitHub.
- Os dois trabalham no ramo `master`. Antes de cada commit, faz `git pull --rebase origin master`.
- Junta ao commit **só os teus ficheiros**, por exemplo `git add backoffice gestor`. Nunca uses `git add -A`, `git add .` nem `git commit -a`.
- Depois de cada alteração terminada, faz commit e `git push origin master`.
- Nunca uses `push --force`, `reset --hard`, `stash` nem reescrevas o histórico.
- Se um pull trouxer um conflito, para e avisa o utilizador. Isso só pode acontecer se alguém mexeu fora da sua parte.

## Segurança (as duas partes)

- O repositório é **público**. Palavras-passe, chaves, dados pessoais e dados de clientes nunca vão para o git.
- Nunca escrevas nem peças a palavra-passe do email ou outras credenciais: é o utilizador que as introduz.
- Não alteres a firewall nem as definições de segurança do Windows. Dá os comandos ao utilizador.
