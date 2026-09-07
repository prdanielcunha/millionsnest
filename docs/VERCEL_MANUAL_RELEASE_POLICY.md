# Vercel Manual Release Policy

## Objetivo

Preservar a cota do plano Vercel Hobby e impedir que commits, pushes, pull requests ou merges gerem deployments automaticamente.

## Regra obrigatória

- Todos os projetos ativos do ecossistema MillionsNest devem manter `git.deploymentEnabled: false` no `vercel.json`.
- Commits e pull requests são validados por CI/GitHub Actions, sem usar Vercel como ambiente de validação.
- Não criar commits artificiais para "forçar deploy".
- Não usar Preview Deployments automáticos como etapa padrão de QA.
- Alterações devem ser acumuladas em lotes coerentes e testadas antes da publicação.
- O deploy para Vercel é uma ação explícita e manual do operador do ecossistema.
- O usuário não precisa executar comandos, abrir a Vercel ou promover versões manualmente.

## Fluxo de release

1. Consolidar as mudanças no branch de release.
2. Rodar lint, typecheck, testes, Firebase Emulator e build aplicáveis.
3. Confirmar que o lote está aprovado e que não há regressões conhecidas.
4. Verificar a disponibilidade/cota da Vercel.
5. Criar exatamente um deployment explícito para o lote aprovado.
6. Promover/publicar em produção somente após o deployment ficar READY.
7. Executar smoke test pós-deploy.
8. Em falha de release, não repetir deployments em sequência; diagnosticar primeiro.
9. Em rate limit, aguardar a janela de reset antes de uma nova tentativa.

## Projetos ativos cobertos

- MillionsNest Hub
- MusicScale
- NestFinance
- NestJourney
- MillionsNest Connect

## Contrato de segurança operacional

A configuração manual-only não altera regras de autenticação, RBAC, Firestore, Stripe, handoff ou dados de clientes. Ela controla somente quando a Vercel pode criar um novo deployment.

Se algum arquivo ou agente tentar reativar `git.deploymentEnabled`, a alteração deve ser tratada como regressão operacional e bloqueada antes do merge.
