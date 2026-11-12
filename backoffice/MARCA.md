# Marca dinmeta

O produto chama-se **dinmeta**. A **BXB** é a desenvolvedora e surge com o crédito «Desenvolvido pela BXB».

Esta alteração inclui a autorização expressa e pontual do utilizador, de 12/11/2026, para aplicar o logótipo e atualizar referências à marca no site e no sistema do cliente. Não altera a divisão de responsabilidades para trabalhos futuros.

Foi também autorizada expressamente a alteração de uma única linha em `ABRIR SISTEMA.bat`: o título da janela passa a «dinmeta - Gestao Financeira», preservando o arranque e os caminhos.

## Identidade

- Símbolo aprovado: d minúsculo atravessado por uma faixa roxa que forma o M maiúsculo.
- A palavra dinmeta é texto, na fonte atual Inter, peso 800. Não é uma imagem.
- Roxo do símbolo: `#8b5cf6`; o d acompanha a cor do texto no tema claro ou escuro.
- Geometria canónica: `SISTEMAS/icones/dinmeta.svg`. O helper `SISTEMAS/shared/marca.js` inclui os mesmos caminhos inline, também para compatibilidade com ficheiros locais.
- Os ícones PWA/Win32 derivam dessa geometria. O Gestor desenha os mesmos caminhos em GDI+.
- O back-office tem a sua própria cópia em `backoffice/public/dinmeta.svg`; não depende de ficheiros do cliente.

## Compatibilidade

Os nomes de empresas e holdings BXB são entidades e não foram renomeados. Também foram preservados caminhos, bases de dados, identificadores, cabeçalhos, cookies, variáveis de ambiente e chaves de arranque existentes. O executável conserva o nome técnico `BXB Gestor.exe`, com título visível «dinmeta Gestor».

Os emails usam dinmeta para a antiga marca padrão BXB sem reescrever configurações guardadas. Nomes personalizados e o nome de remetente explicitamente configurado são preservados. As consultas e as Definições continuam a mostrar os valores reais.

## Validação e entrega

A alteração foi verificada numa instância isolada em `TESTES-CODEX`, com dados fictícios e portas 8891/8892/8898/8897. Foram revistos a página pública, o acesso, a área do cliente e o comportamento em ecrã pequeno; o Gestor compila em C# 5/.NET Framework 4.

O trabalho anterior do novo back-office continua incompleto e separado desta entrega. Não se deve apresentar esse painel como pronto nem substituir a consola antiga por ele nesta alteração de marca. Os pedidos em `backoffice/PEDIDOS-API.md` continuam os mesmos; não foram acrescentadas rotas.

Para instalar a versão no sistema em utilização: fechar o Gestor, atualizar o código com `git pull --ff-only`, executar `gestor\compilar.bat` e voltar a abrir. Os testes nunca usam os dados reais.
