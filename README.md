# Elite Sound

Sistema de aluguer de equipamentos de som: catálogo, reservas, contratos, pagamentos,
comissões dos colaboradores com conversão em participação nos lucros, e gestão interna
(tarefas, fornecedores, compras, documentos, obrigações fiscais…).

- `backend/`: servidor Node.js (Express + Sequelize). Serve também o site.
- `public_html/`: páginas do site.

## Instalar no Windows (primeira vez)

1. Instale o **Node.js LTS**: https://nodejs.org (aceite as opções por defeito).
2. Instale o **GitHub Desktop**: https://desktop.github.com e entre com a sua conta.
3. No GitHub Desktop: **File → Clone repository → `bmj15/ELITE-SOUND`**.
   Em *Local path* escolha, por exemplo,
   `C:\Users\Bruno\Desktop\AMBIENTE GASTRO\BXB INVESTIMENTOS\sistemas`
   (o GitHub Desktop cria lá dentro a pasta `ELITE-SOUND`).
4. Abra a **Linha de Comandos** (tecla Windows → escreva `cmd`) e execute:

   ```
   cd "C:\Users\Bruno\Desktop\AMBIENTE GASTRO\BXB INVESTIMENTOS\sistemas\ELITE-SOUND\backend"
   npm install
   copy .env.example .env
   npm start
   ```

5. Abra **http://localhost:5000** no browser.

Na primeira vez é criado o administrador **admin@elitesound.local / admin123**.
Mude-o no ficheiro `backend\.env` (`ADMIN_EMAIL` / `ADMIN_PASSWORD`) antes do primeiro arranque,
e troque também o `JWT_SECRET` por um texto longo e aleatório.

## Atualizar (sem fazer downloads)

1. GitHub Desktop → **Fetch origin** → **Pull origin**.
2. Na Linha de Comandos, dentro de `backend`: `npm install` e depois `npm start`.

Os dados ficam em `backend\data\elitesound.sqlite` e os documentos carregados em `backend\uploads`.
Estas pastas não vão para o GitHub. Faça cópias de segurança delas.

## Papéis

- **Cliente**: quem se regista no site. Faz reservas, assina contratos, paga e fala com a equipa.
- **Colaborador**: área da equipa (pagamentos pendentes, tarefas, fornecedores, documentos…),
  recebe comissões e pode convertê-las em participação nos lucros.
- **Admin**: tudo, incluindo utilizadores, equipamentos, regras de comissão, distribuição do lucro,
  configurações e auditoria.

Para tornar alguém colaborador ou admin: Dashboard → Administração → **Utilizadores e papéis**.

## Base de dados MySQL (opcional)

Por defeito é usado SQLite (um ficheiro, sem instalar nada). Para MySQL, preencha as variáveis
`DB_*` em `backend\.env` (ver `.env.example`). As tabelas são criadas automaticamente no arranque.

## Testes

```
cd backend
npm test
```
