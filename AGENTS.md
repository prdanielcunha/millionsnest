# MillionsNest Ecosystem Architecture Rules

## 1. Operating System do Ecossistema
- MillionsNest atua como **Auth Central, Billing Central e Organization Central** para os aplicativos parceiros.
- Todos os apps devem obrigatoriamente usar: o mesmo Firebase Auth, o mesmo Firestore, a mesma sessão e o mesmo token JWT.

## 2. Central Collections
Criar e padronizar as seguintes coleções principais no Firestore:
- `/users`
- `/organizations`
- `/subscriptions`
- `/apps`
- `/audit_logs`
- `/system_settings`

## 3. Padrões de Estrutura de Documentos

**Users (`/users/{uid}`)**
- `uid` (string)
- `email` (string)
- `displayName` (string)
- `photoURL` (string)
- `systemRole` (string)
- `organizations` (array)
- `subscriptionStatus` (string)
- `createdAt`
- `updatedAt`

**Organizations (`/organizations/{orgId}`)**
- `id` (string)
- `name` (string)
- `slug` (string)
- `ownerUid` (string)
- `enabledApps` (array)
- `subscriptionPlan` (string)
- `subscriptionStatus` (string)
- `createdAt`

**Members**
- Novo Padrão: `/organizations/{orgId}/members/{uid}`
- *(Nota: Onde o sistema legado utiliza `/organization_members/{uid}_{orgId}`, ele deve continuar sendo suportado por webhooks).*

## 4. Multi-tenant Obrigatório (Regra Crítica)
- **Nenhum dado de aplicativo pode existir fora de um `organizationId`.**
- Todos os dados dos aplicativos devem obrigatoriamente pertencer a uma organization, utilizando a hierarquia aninhada:
  - Exemplo correto: `/organizations/{orgId}/musicscale/songs`
  - Exemplo correto: `/organizations/{orgId}/musicscale/scales`

## 5. Stripe & Webhook Integration (INTOCÁVEL)
- **Regra Absoluta:** NÃO altere configurações do Stripe, rotinas de checkout, fluxos de login atual ou webhooks (`server.ts`). O comportamento atual do faturamento deve ser totalmente preservado.
- Webhooks are handled in `server.ts`. 
- Stripe manages the billing. Webhook handles the infrastructure provisioning into Firebase.
- Do NOT build parallel billing logic. Use the existing API endpoints and webhooks.
- Prohibited from checking `subscription.status` inside `/users/{uid}`, it must be loaded from `/subscriptions/{orgId}`.

## 6. RBAC Contract & Sistema de Permissões
- Separar regras: `systemRole` (ceo, global_admin, user), `organizationRole` (owner, admin, member).
- Sempre usar `permissions` (capabilities object) via Frontend e Backend para validar acesso. (Formato: `app.action` ex: `musicscale.manageSongs`).
- NUNCA valide acesso final usando `role === "admin"`.
- Assegurar compatibilidade contínua de helpers centralizados (como `hasPermission`).

## 7. Performance & Shared Helpers
- Utilize **Cache Local (localStorage)** e **Memoization (useMemo)** em contextos (`AuthContext`, `OrganizationContext`) para evitar re-renders repetitivos e leituras supérfluas do Firestore.
- Helpers globais devem ser modularizados em `/src/lib/` (ex: `audit.ts`, `features.ts`, `organization.ts`).

## 8. Frontend Security & Firebase Rules
- Frontend **NÃO** é a autoridade final. Toda validação crítica (leitura/escrita de domínios restritos) baseia-se em Firebase Rules e Cloud Functions (via validação de JWT, `organizationId`, e `membership`).
- O isolamento entre organizações é compulsório em Rules (Data Sampa / Cross-tenant access is STRICTLY FORBIDDEN).

## 9. Feature Flags & Extensibilidade
- Controlar addons/ferramentas limitadas integradas à arquitetura base através de roles e planos na organização.
- Não reescrever retro-compatibilidade base do Firebase.

## 10. Product Direction Lock (INTOCÁVEL)
- **Proibido criar funcionalidades fictícias:** Não invente módulos (ex: Gestão Financeira, Checkin Kids) ou recursos (ex: Chat corporativo, RH, colaboração real-time inexistente) que não existam ou não tenham sido aprovados. É EXTREMAMENTE proibida a inferência automática de roadmap ou geração de features comerciais sem instrução do Chief Product Officer.
- **Brand & Pricing Lock System:** É ESTRITAMENTE PROIBIDO alterar copy (textos da interface, landing pages), reposicionamento da marca ou estruturas de pricing/planos sem autorização explícita. Não prometa o que não foi implementado.
- **Linguagem Focada:** O sistema deve obrigatoriamente comunicar "excelência ministerial", "preparação fluida", "menos caos", "organização do louvor". Nunca use jargões como "ERP genérico de igreja", "gestão corporativa" ou "hub técnico". A comunicação deve permanecer humana, ministerial, elegante, limpa e premium (estilo Apple, Linear, Notion).

**Violation of these constraints will result in breaking the current ecosystem architecture.**

---

# Regras Obrigatórias para IAs Trabalhando Neste Repositório

As regras a seguir são mandatórias para qualquer IA que for modificar, analisar ou sugerir alterações neste repositório:

1. Ler o código e os documentos técnicos antes de alterar qualquer arquivo.
2. Entender o comportamento atual antes de propor mudança.
3. Fazer somente alterações dentro do escopo solicitado.
4. Não realizar refatorações oportunistas.
5. Não alterar textos, layout, rotas, contratos, permissões, banco ou arquitetura fora do escopo.
6. Preservar funcionalidades já existentes.
7. Preservar multi-tenant e isolamento por organização.
8. Nunca aceitar cegamente organizationId, userId, role, permissões ou contexto enviados pelo frontend.
9. Autorizações críticas devem ser verificadas no backend.
10. Firestore Rules devem permanecer compatíveis e seguras quando aplicável.
11. Nunca criar bypass por e-mail, UID, nome ou valor hardcoded.
12. Não criar fontes paralelas de identidade, organizações, memberships, RBAC, billing, assinatura ou entitlements.
13. Respeitar a MillionsNest como plataforma central do ecossistema quando essa integração existir no código.
14. Diferenciar owner, membro, papel organizacional, papel global e função operacional ou musical.
15. Preservar a arquitetura de internacionalização.
16. Todo novo texto visível deve suportar Português, English e Español.
17. Aplicar Mobile First e Desktop Excellent.
18. Preservar o design system existente.
19. Não alterar coleções, documentos, índices, regras, contratos de API ou variáveis de ambiente sem necessidade comprovada.
20. Não expor segredos, tokens ou credenciais.
21. Utilizar somente comandos que realmente existam no repositório.
22. Executar, quando disponíveis:
   - lint;
   - typecheck;
   - build;
   - testes relacionados.
23. Revisar o diff completo antes de concluir.
24. Informar claramente:
   - arquivos criados;
   - arquivos modificados;
   - comportamento anterior;
   - comportamento novo;
   - comandos executados;
   - resultados;
   - riscos restantes;
   - configurações manuais;
   - confirmação de ausência de mudanças fora do escopo.
25. Nunca afirmar que um teste passou sem evidência da execução.
