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

**Violation of these constraints will result in breaking the current ecosystem architecture.**
