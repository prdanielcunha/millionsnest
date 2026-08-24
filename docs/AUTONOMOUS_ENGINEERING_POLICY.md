# Autonomous Engineering Policy

Esta política governa o fluxo técnico autônomo do ecossistema MillionsNest.

## Papéis
- OpenClaw: operador/orquestrador.
- Codex ou agente de código: executor de implementação.
- OpenAI Reviewer: autoridade final de engenharia independente de quem executou.
- Usuário: direção de produto e direito de pedir rollback/desfazer; não é gate rotineiro de aprovação técnica.

## Fluxo obrigatório
1. Revalidar repositório, branch, SHA, código, testes e documentação antes de escrever.
2. Fazer mudança pequena, auditável e reversível.
3. Executar lint/typecheck/build/testes e gates de segurança aplicáveis.
4. Se Firebase for afetado, manter Rules, índices, Functions e configurações relevantes versionados no repositório e testar em Emulator ou gate equivalente antes de produção.
5. Entregar ao OpenAI Reviewer o problema original, diff, arquivos alterados, testes, riscos, impactos em Firebase/GitHub/Vercel e plano de rollback.
6. Se REJECTED, devolver ao executor com os motivos e repetir automaticamente até solução aprovada ou blocker real.
7. Se APPROVED, merge/promoção/deploy podem ocorrer automaticamente conforme a política de branches do repositório, sem exigir aprovação humana rotineira.
8. Depois do deploy, executar smoke tests e verificações de saúde.
9. Se houver regressão atribuível à mudança, fazer rollback seguro para o último estado certificado e registrar o incidente.
10. Ao final, informar ao usuário o que foi feito, evidências principais, estado final e referência de rollback.

## Firebase sob operação autônoma
O OpenClaw pode operar, quando necessário e compatível com a arquitetura existente: Firestore Rules, Storage Rules, Functions, índices, Emulator, logs, deploy seletivo e configuração não destrutiva de Firebase/Auth. Mudanças devem primeiro existir como código/configuração versionada. Evitar alterações somente pelo Console que criem drift.

O MillionsNest Hub continua sendo a autoridade canônica de identidade, organizações, memberships, RBAC global, billing, assinaturas e entitlements.

## Ações proibidas automaticamente
Mesmo com aprovação do Reviewer, o fluxo autônomo não deve:
- excluir projeto Firebase/Google Cloud ou banco de produção;
- executar exclusão em massa irreversível de dados/tenants;
- alterar billing, IAM, owners ou escopo de service accounts;
- remover proprietários/administradores do ecossistema;
- expor, commitar ou imprimir secrets/tokens/chaves privadas;
- desabilitar backups, retenção ou trilhas de auditoria;
- reescrever histórico Git de forma destrutiva;
- criar bypass de Auth, RBAC, membership ou isolamento multi-tenant;
- executar migração destrutiva irreversível sem estratégia comprovada de preservação/rollback.

Se a única solução aparente exigir uma dessas ações, pare essa ação específica, preserve o estado e reporte o blocker. Procure primeiro uma alternativa segura.

## Engenharia versus decisões de negócio
A autonomia de engenharia não autoriza IA a aprovar silenciosamente dados financeiros, lançamentos, conciliações, documentos, conteúdo crítico ou decisões humanas de negócio que o próprio produto exige que uma pessoa confirme.

O OpenAI Reviewer pode aprovar software e deploys que implementam essas proteções; ele não substitui confirmações humanas de negócio previstas no produto.
