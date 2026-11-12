# Marca do Gestor

O produto visível chama-se **dinmeta Gestor**. Crédito: **Desenvolvido pela BXB**.

`dinmeta-simbolo.svg` contém a geometria aprovada do símbolo dM. O cabeçalho desenha os mesmos caminhos com GDI+, sem converter o nome em imagem. O nome usa Inter quando instalada e Segoe UI como alternativa do Windows.

`gerar-icone.py` gera o ícone Win32 com Pillow a partir desse SVG (16 a 256 px), com imagens BMP internas para compatibilidade com o .NET Framework. Executar `python gestor/gerar-icone.py` apenas ao atualizar o símbolo. O nome técnico `bxb.ico` mantém-se para compatibilidade com a compilação.

O executável mantém o nome técnico `BXB Gestor.exe`, assim como os identificadores internos, chaves de arranque, variáveis de ambiente e protocolo. Estas escolhas mantêm os atalhos e as integrações existentes. `compilar.bat` mantém o seu destino habitual na pasta do repositório; testes de compilação devem indicar um destino dentro de `gestor/` e não executar a aplicação com dados reais.
