# Pedidos à parte do sistema do cliente

## Integração com o novo back-office

O contrato v1 já fornece as consultas necessárias às seis secções do painel. O back-office não precisa de novas rotas de alteração e não as deve receber.

### Encaminhamento para Administração

Confirmar o endereço da página Administração do sistema do cliente. Até existir um endereço estável no contrato, o painel mostra «Altera-se na Administração do sistema», sem inventar uma ligação.

As alterações de contas dos clientes, palavras-passe, sessões, servidor e modelos de email, verificação de email, nome e endereço do projeto continuam exclusivamente nessa Administração.

### Abertura do Gestor na instalação

O compilador mantém o executável de instalação `BXB Gestor.exe` na raiz, por compatibilidade com os atalhos existentes. A opção `gestor\compilar.bat --teste` compila apenas em `gestor/`. Não é necessária uma alteração dos caminhos de arranque do cliente nesta etapa. O Gestor atualizado abre o back-office na porta 8100; deixou de depender da consola antiga.

### Retirada da consola antiga

Depois de o novo back-office estar instalado e as alterações do cliente estarem na Administração, a parte do cliente pode retirar a porta antiga e os respetivos ficheiros. O novo painel e o novo Gestor não dependem dessa consola.

### Domínio público através de Cloudflare

O separador Cloudflare usa a API de consulta apenas para confirmar a assinatura do servidor e a porta atual do site. A integração escreve exclusivamente na conta Cloudflare autorizada e nos dados próprios do back-office; não altera `urlPublico` nem outros dados do cliente. Depois de confirmar o domínio público e a emissão automática do certificado, o utilizador deve indicar esse endereço na Administração do sistema do cliente. Não é necessária uma rota nova de escrita na API de consulta.
