# Claude neste repositório

Lê primeiro [AGENTS.md](AGENTS.md): este repositório é trabalhado pelo Claude e pelo Codex ao mesmo tempo.

- **O Claude é responsável pelo sistema do cliente**: site público, sistema dos clientes, `servidor.js` e a API de consulta (porta 8097).
- **Nunca** alteres `backoffice/` nem `gestor/`. São do Codex: o BXB Gestor .exe e o painel de gestão.
- A API de consulta é o contrato com o back-office. Quem pede alterações é o Codex, em `backoffice/PEDIDOS-API.md`.
  - Se mudares a API em `servidor.js`, atualiza [CONTRATO-CONSULTA.md](CONTRATO-CONSULTA.md) no mesmo commit.
  - Nunca removas nem mudes um campo sem subir a versão do contrato.
- Tudo o que altera o sistema do cliente vive no sistema do cliente, na página Administração, e nunca no back-office.
- Git:
  - commit só dos teus ficheiros, indicados pelo nome;
  - `git pull --rebase origin master` antes de cada `git push origin master`;
  - nunca `git add -A`, `stash`, `reset --hard` nem `--force`.
