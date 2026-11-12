# Back-office dinmeta

Painel local com servidor, autenticação e base de dados próprios. O sistema dos clientes é consultado exclusivamente pela API definida em `CONTRATO-CONSULTA.md`.

Desenvolvido pela BXB. Os nomes técnicos de ficheiros, variáveis e dados mantêm-se por compatibilidade.

## Requisitos

- Windows e Node.js 22.5 ou superior, com `node:sqlite`.
- O Gestor inclui `--experimental-sqlite` no arranque, necessário nas versões Node 22.5 a 22.12.
- Sem dependências npm.
- .NET Framework 4 para o dinmeta Gestor.

## Serviços e dados

| Serviço | Endereço de instalação | Endereço de teste do Codex |
| --- | --- | --- |
| Site | `http://127.0.0.1/` | `http://127.0.0.1:8891/` |
| API de consulta | `http://127.0.0.1:8097/v1/` | `http://127.0.0.1:8897/v1/` |
| Back-office | `http://127.0.0.1:8100/` | `http://127.0.0.1:8890/` |

O servidor do back-office só escuta em `127.0.0.1`. O browser nunca chama a API de consulta diretamente.

Variáveis de ambiente:

| Variável | Valor por omissão | Utilização |
| --- | --- | --- |
| `PORT_BACKOFFICE` | `8100` | Porta do painel local. |
| `BXB_DADOS_BACKOFFICE` | `..\..\DADOS-BACKOFFICE`, a partir da raiz do repositório | Base de dados, chave e ficheiros próprios. |
| `BXB_DADOS` | `..\..\DADOS-SERVIDOR`, a partir da raiz do repositório | Apenas a leitura de `consulta.chave`. |
| `PORT_CONSULTA` | `8097` | API de consulta do site. |

Os utilizadores do back-office são independentes das contas dos clientes. As permissões vêm exclusivamente do perfil atribuído. O perfil do sistema «Administrador» é imutável e tem de existir sempre pelo menos um utilizador ativo com esse perfil.

O primeiro acesso faz-se pelo botão de gestão do dinmeta Gestor, que entrega um bilhete de utilização única. O painel pede então o nome, email e palavra-passe do primeiro Administrador. As credenciais são introduzidas pelo utilizador e não são fornecidas pelo código. Depois pode usar o login próprio do painel ou abri-lo pelo Gestor.

Os dados pessoais dos clientes são consultados quando se abre uma página e não são copiados para a base de dados do back-office. As estatísticas diárias guardam apenas números agregados. As funções que alteram o sistema dos clientes ficam na Administração desse sistema.

## Testes isolados

Na raiz da cópia do Codex:

```powershell
node --experimental-sqlite backoffice/testes/iniciar-testes.js --verificar
```

O script cria uma execução nova dentro de `BXB INVESTIMENTOS\TESTES-CODEX\dados-site\` e `dados-backoffice\`, define todas as variáveis e arranca os dois servidores nas portas de teste. Recusa iniciar se uma dessas portas estiver ocupada. As credenciais fictícias são geradas em memória.

A primeira configuração do site de teste usa `/api/configurar`; os clientes fictícios seguintes usam `/api/registar`, como visitantes. A base de dados dos clientes nunca é aberta pelo script. A base própria do back-office é inspecionada para confirmar que não contém os dados pessoais dos clientes fictícios.

Sem `--verificar`, as instâncias ficam abertas para uma verificação manual. Com `--verificar --manter`, os testes automáticos correm e os servidores continuam disponíveis. `Ctrl+C` termina exclusivamente os processos criados pelo script. Nunca se ativa o arranque com o Windows nos testes.

## Instalar a versão nova

Só depois dos testes e da revisão:

1. Fechar o dinmeta Gestor pelo comando Sair da bandeja.
2. Na pasta da instalação `GIT\SISTEMA-GESTAO-FINANCEIRA`, atualizar o código com `git pull --ff-only`.
3. Correr `gestor\compilar.bat`.
4. Abrir `BXB Gestor.exe` na raiz da instalação. O compilador mantém esse caminho para os atalhos existentes.
5. Abrir a gestão pelo botão do Gestor e criar o primeiro Administrador do back-office.

A instalação mantém o nome técnico do executável e os atalhos. O Gestor liga e vigia o site e o back-office em separado, lê apenas a API de consulta e a sua chave, e guarda os seus ficheiros em DADOS-BACKOFFICE. As saídas dos processos são mostradas sem serem copiadas para o log persistente do Gestor. Os pedidos de coordenação com a parte do cliente estão em `backoffice/PEDIDOS-API.md`.

## Cloudflare gratuito e gestão pela Internet

O separador Cloudflare utiliza apenas Tunnel, DNS com proxy, Universal SSL e Access com códigos por email e uma lista de emails autorizados. O limite Free é de 50 utilizadores no total da conta Zero Trust. Não contrata planos, não cria encomendas de certificados e não usa funcionalidades pagas. A zona deve estar ativa na Cloudflare e a organização Zero Trust Free já deve estar configurada. O certificado Universal SSL é gerido automaticamente pela Cloudflare; ter as definições HTTPS aplicadas não significa que o certificado já esteja emitido.

O primeiro Administrador do back-office é criado localmente pelo Gestor. Depois, no separador Cloudflare, o utilizador introduz o token de API, escolhe a zona, o nome público do site, um subdomínio de gestão distinto e os emails autorizados. Ambos os nomes ficam no domínio principal ou no primeiro nível de subdomínios. A gestão exige um subdomínio próprio. O plano mostra todas as alterações antes de aplicar. Alterações de Full (strict) e Always Use HTTPS afetam toda a zona e exigem uma confirmação separada, porque outras origens da zona também precisam de HTTPS válido.

O token deve ficar restrito à conta e zona necessárias, com estas permissões:

- Zona: Zone Read, DNS Edit e Zone Settings Edit.
- Conta: Cloudflare Tunnel Edit, Access: Apps and Policies Edit e Access: Organizations, Identity Providers, and Groups Edit.
- SSL and Certificates Read é opcional para consultar o estado do Universal SSL. A falta desta leitura deixa o estado como desconhecido e não ativa serviços adicionais.

O token é enviado apenas ao servidor local do back-office, nunca é devolvido pela API e não fica em armazenamento do browser. As credenciais API/Tunnel ficam em `DADOS-BACKOFFICE/cloudflare.json`, cifradas com AES-256-GCM e uma chave HKDF derivada da `backoffice.chave`. Os ficheiros permanecem fora do repositório. A perda ou substituição dessa chave impede a leitura das credenciais; não existe recuperação em texto simples. Os registos de auditoria guardam a ação e o operador, sem tokens ou respostas brutas do fornecedor.

A aplicação Access e a política exclusiva de emails são criadas e verificadas antes de publicar DNS ou uma regra de gestão no túnel. A origem verifica criptograficamente o JWT Access, incluindo emissor, audiência, validade e email autorizado, antes de servir qualquer rota ou ficheiro no endereço público. O login próprio e as permissões do back-office continuam obrigatórios. Cabeçalhos de proxy ou tokens falsos não permitem simular um pedido local. Os bilhetes, a criação do primeiro Administrador e o desligar por chave do Gestor continuam exclusivos do acesso local.

O túnel usa um identificador dedicado gerido por este back-office e publica apenas o site e o subdomínio protegido de gestão; os restantes nomes recebem 404. A porta do site é confirmada pela API de consulta. A consulta local e a consola antiga nunca são publicadas. Registos DNS diferentes, aplicações Access alheias e regras de túnel adicionais são recusados em vez de apagados ou substituídos. Uma aplicação Access já criada mantém a sua lista de emails; alterações externas que não correspondam ao plano exigem revisão explícita na Cloudflare.

Instalar o conector só descarrega o binário oficial quando o utilizador escolhe Instalar. Ligar inicia exclusivamente esse processo com a credencial no ambiente do filho, sem a colocar em argumentos ou ficheiros de texto. Não instala serviços do Windows, não altera a firewall e não abre portas no router. O autoarranque depois de reiniciar o back-office só ocorre quando o utilizador já tinha escolhido Ligar; Desligar retira essa preferência. Configurar domínio e Access não liga o conector automaticamente.

As operações remotas não são uma transação única. Uma interrupção pode deixar recursos dedicados já criados; o back-office conserva os identificadores para preparar um novo plano e continuar sem substituir recursos de terceiros. O endereço público configurado no sistema do cliente continua a ser alterado exclusivamente na Administração desse sistema.

Verificações sem Cloudflare real:

```powershell
node --experimental-sqlite --test backoffice/testes/cloudflare.test.js backoffice/testes/access-cloudflare.test.js backoffice/testes/conector-cloudflare.test.js
```

O primeiro teste usa fornecedor, disco e conector simulados. Os testes de JWT usam chaves fictícias; os testes do conector não instalam nem ligam um túnel real.

### Gestor em modo de teste

Para compilar sem substituir o executável da instalação, use `gestor\compilar.bat --teste`. O resultado fica em `gestor\BXB Gestor.exe` e é ignorado pelo Git. Depois execute:

```powershell
node --experimental-sqlite backoffice/testes/iniciar-testes.js --verificar --gestor --manter
```

O script passa todas as pastas e portas fictícias ao executável, mantém um mutex de teste separado e deixa os serviços disponíveis até Ctrl+C. O Gestor de teste aparece identificado como TESTE e não lê nem altera o arranque com o Windows. Sem `--manter`, os processos do script terminam após as verificações.

O modo de teste recusa arrancar se faltarem pastas TESTES-CODEX ou alguma das portas reservadas. Nunca abra um executável de teste sem esse ambiente. Os testes de proteção HTTP podem executar-se com `node --experimental-sqlite --test backoffice/testes/access-http.test.js`; precisam da porta 8890 livre e não iniciam o sistema dos clientes nem contactam Cloudflare.
