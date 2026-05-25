# MillionsNest Ecosystem Architecture Rules

## 1. Single Source of Truth & Central Collections
Criar e padronizar as seguintes coleções principais no Firestore:
- `/users`
- `/organizations`
- `/subscriptions`
- `/apps`
- `/audit_logs`
- `/system_settings`

## 2. Padrões de Estrutura de Documentos

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

## 3. Multi-tenant Obrigatório (Regra Crítica)
- **Nenhum dado de aplicativo pode existir fora de um `organizationId`.**
- Todos os dados dos aplicativos devem obrigatoriamente pertencer a uma organization, utilizando a hierarquia aninhada:
  - Exemplo correto: `/organizations/{orgId}/musicscale/songs`
  - Exemplo correto: `/organizations/{orgId}/musicscale/scales`

## 4. RBAC Contract
- Always use `permissions` (capabilities object) to check access via the frontend, NEVER the `role` directly.
- Ensure all permissions are NAMESPACED: e.g. `organization.manageMembers` or `musicScale.manageSongs`
- Always bump `CURRENT_PERMISSIONS_VERSION` in `src/lib/constants.ts` when adding a new permission property.

## 5. Stripe & Webhook Integration (INTOCÁVEL)
- **Regra Absoluta:** NÃO altere configurações do Stripe, rotinas de checkout, fluxos de login atual ou webhooks (`server.ts`). O comportamento atual do faturamento deve ser totalmente preservado.
- Webhooks are handled in `server.ts`. 
- Stripe manages the billing. Webhook handles the infrastructure provisioning into Firebase.
- Do NOT build parallel billing logic. Use the existing API endpoints and webhooks.
- Prohibited from checking `subscription.status` inside `/users/{uid}`, it must be loaded from `/subscriptions/{orgId}`.

**Violation of these constraints will result in breaking the current ecosystem architecture.**
