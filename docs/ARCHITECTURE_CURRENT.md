# Architecture Current State

## 1. Nome e Responsabilidade do Aplicativo
- **Nome:** MillionsNest (Dashboard / Landing Page)
- **Responsabilidade:** Premium SaaS Landing Page e Painel de Controle (Dashboard) para o ecossistema MillionsNest.
- **Responsabilidade no Ecossistema (MillionsNest):** Atua como **Auth Central, Billing Central e Organization Central**. Gerencia organizações (multi-tenant), membros, perfis de usuário, permissões globais e organizacionais, provisionamento de assinaturas (via Stripe) e logs de auditoria.

## 2. Stack Real Encontrada
- **Frontend:** React 19, React Router v7, Vite 6, Tailwind CSS v4, Framer Motion (motion), Lucide React, i18next / react-i18next.
- **Backend:** Node.js, Express v4.21, Firebase Admin SDK v13.9, Stripe SDK v22, @google/genai.
- **Linguagem:** TypeScript (tsx / tsc).
- **Ferramentas de Build/Dev:** Vite, esbuild, tsx.

## 3. Versões Principais (package.json)
- `react`: ^19.0.1
- `react-router-dom`: ^7.15.0
- `vite`: ^6.2.3
- `tailwindcss`: ^4.1.14 (usado com @tailwindcss/vite)
- `firebase`: ^12.13.0
- `firebase-admin`: ^13.9.0
- `express`: ^4.21.2
- `stripe`: ^22.1.1
- `@google/genai`: ^1.29.0

## 4. Estrutura Principal de Diretórios
- `src/`: Código fonte frontend (React)
  - `components/`: Componentes UI reutilizáveis
  - `contexts/`: React Contexts (AuthContext, OrganizationContext)
  - `lib/`: Helpers e lógicas utilitárias globais (rbac, billing, roles)
  - `pages/`: Páginas da aplicação (Dashboard, Admin, Checkout, Home, etc.)
- `server.ts`: Backend Express
- `public/`: Arquivos estáticos
- `docs/`: Documentações técnicas e do ecossistema

## 5. Entrypoints Frontend
- `index.html` e `src/App.tsx` (configuração de rotas).

## 6. Entrypoints Backend
- `server.ts` (API e Webhooks, utilizando Express e sendo consumido no ambiente de build).

## 7. Rotas Frontend
- `/` (Home)
- `/login` (Login)
- `/join/:orgId` (Join / Aceitar Convites)
- `/dashboard` e `/dashboard/:tab` e `/dashboard/:tab/:subTab` (Dashboard de organizações e usuário)
- `/dashboard/billing/success` (Sucesso de Pagamento)
- `/admin/ecosystem`, `/admin/database`, `/admin/debug/organization` (Painéis Administrativos / Globais)
- `/upgrade`, `/checkout` (Checkout de Planos)
- `/:slug` (Página pública da organização)
- Rotas institucionais (`/termos-de-uso`, `/politica-de-privacidade`, etc.)

## 8. Endpoints Backend
*(Extraídos do Express Router no `server.ts`)*
- Webhooks e Sincronização: `/api/stripe/webhook`, `/api/v1/billing/*`, `/api/internal/sync-stripe-products`
- Organizações (Públicas e Membros): `/api/public/organizations/*`
- Gestão Administrativa e Reparação (Admin): `/api/admin/*` (criação de estrutura, migração, mudança de org ativa, correções)
- Ações do Ecossistema e Handoff: `/api/ecosystem/*`
- APIs V1 e Autenticação/Status: `/api/v1/organizations/*`, `/api/user/organization-context`, `/api/valid`
*(Nota: Não foram listados todos por extenso, mas estes são os grupos principais de endpoints configurados em server.ts).*

## 9. Contexts, Providers, Hooks e Serviços
- `AuthContext`: Gerencia dados do usuário logado, `canonicalContext`, `switchOrganization` e sessão do Firebase Auth.
- `OrganizationContext`: Resolve dados da organização ativa, `MemberRole`, limites de apps (`resolveMusicScalePlan`) e permissões (`isGlobalPrivilegedUser`).

## 10. Fluxo de Autenticação
- Baseado em `firebase/auth`. `onAuthStateChanged` popula o contexto.
- O sistema valida JWT tokens (via `firebase-admin`) no backend em rotas `/api/*`.

## 11. Resolução de Usuário e Organização Ativa
- **Usuário:** Carregado da coleção `/users/{uid}`.
- **Organização Ativa:** Determinada preferencialmente pelo `activeOrganizationId` no `canonicalContext` / backend response, suportada localmente e chaveada via `switchOrganization`.

## 12. Modelo Multi-Tenant
- Isolamento por **Organização**.
- Os dados são centralizados nas coleções raiz (`/organizations`, `/users`), mas os dados operacionais ou propriedades dependentes (ex: membros) devem estar hierarquizados. Padrão estipulado: `/organizations/{orgId}/*`.

## 13. Papéis, Permissões e RBAC
- **Papéis Globais (`systemRole`):** `ceo`, `admin`, `global_admin`, `user`.
- **Papéis Organizacionais:** `owner`, `admin`, `member` (e outros definidos via constants/RBAC).
- **Permissões (Capabilities):** Contratos em `src/lib/rbac.ts` e `roleResolver.ts` no formato `app.action` (ex: `organization.settings.update`, `musicscale.songs.manage`).
- **Diferença:** Papéis globais permitem ações cross-tenant / manutenção (verificados em endpoints `/api/admin/*`). Papéis organizacionais e permissões controlam acesso dentro de um locatário (ex: gerenciar membros da organização logada).

## 14. Coleções e Subcoleções Firestore Referenciadas
- `/users`
- `/organizations`
- `/organizations/{orgId}/members`
- `/organization_members` (coleção legada suportada via webhook/sincronização)
- `/subscriptions`
- `/apps`
- `/audit_logs`
- `/system_settings`
*(Dados operacionais como `/organizations/{orgId}/musicscale/songs` são manipulados através das validações centralizadas).*

## 15. Firestore Rules Encontradas
- O arquivo de regras principal referenciado localmente é `firestore.rules` (27.602 bytes). Não foi feita auditoria completa nas regras em si nesta documentação, mas elas isolam inquilinos e verificam JWT/membership.

## 16. Cloud Functions / Jobs
- **NÃO VERIFICADO** (Nenhum código explícito de Cloud Functions foi encontrado dentro de um subdiretório local de funções. Rotas de webhook no `server.ts` suprem muitas das necessidades de eventos).

## 17. Integrações e Ecossistema (MillionsNest)
- O código base integra chamadas e validações para aplicativos satélites (como NestFinance via `/api/ecosystem/nestfinance/handoff/issue` e Handoffs de autenticação, além de lógicas específicas para pacotes do "MusicScale").

## 18. Billing, Assinaturas e Entitlements
- Gerenciado via **Stripe**.
- Webhooks atualizam o estado da assinatura da organização (ex: `/organizations/{orgId}` -> `subscriptionStatus`, `subscriptionPlan`).
- O faturamento não deve ser alterado (Regra Absoluta listada em `AGENTS.md`).

## 19. Variáveis de Ambiente Utilizadas
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `MUSICSCALE_DEFAULT_CURRENCY`
- `MUSICSCALE_PRO_ACTIVE_PRICE`
- `STRIPE_PRODUCT_MUSICSCALE_STARTER`
- `STRIPE_PRICE_MUSICSCALE_STARTER_MONTHLY`
- `STRIPE_PRICE_MUSICSCALE_STARTER_YEARLY`
- `STRIPE_PRICE_MUSICSCALE_STARTER_MONTHLY_USD`
- `STRIPE_PRICE_MUSICSCALE_STARTER_YEARLY_USD`
- `STRIPE_PRODUCT_MUSICSCALE_ADVANCED`
- `STRIPE_PRICE_MUSICSCALE_ADVANCED_MONTHLY`
- `STRIPE_PRICE_MUSICSCALE_ADVANCED_YEARLY`
- `STRIPE_PRICE_MUSICSCALE_ADVANCED_MONTHLY_USD`
- `STRIPE_PRICE_MUSICSCALE_ADVANCED_YEARLY_USD`
- `STRIPE_PRODUCT_MUSICSCALE_PRO`
- `STRIPE_PRICE_MUSICSCALE_PRO_LAUNCH_MONTHLY`
- `STRIPE_PRICE_MUSICSCALE_PRO_LAUNCH_YEARLY`
- `STRIPE_PRICE_MUSICSCALE_PRO_STANDARD_MONTHLY`
- `STRIPE_PRICE_MUSICSCALE_PRO_STANDARD_YEARLY`
- `STRIPE_PRICE_MUSICSCALE_PRO_LAUNCH_MONTHLY_USD`
- `STRIPE_PRICE_MUSICSCALE_PRO_LAUNCH_YEARLY_USD`
- `STRIPE_PRICE_MUSICSCALE_PRO_STANDARD_MONTHLY_USD`
- `STRIPE_PRICE_MUSICSCALE_PRO_STANDARD_YEARLY_USD`
- `STRIPE_PRODUCT_MUSICSCALE_SETUP_PREMIUM`
- `STRIPE_PRICE_MUSICSCALE_SETUP_PREMIUM`
- `STRIPE_PRODUCT_MUSICSCALE_TRAINING_EXPRESS`
- `STRIPE_PRICE_MUSICSCALE_TRAINING_EXPRESS`
- `STRIPE_PRODUCT_MUSICSCALE_WORSHIP_100`
- `STRIPE_PRICE_MUSICSCALE_WORSHIP_100`
- `STRIPE_PRODUCT_MUSICSCALE_PACK_10`
- `STRIPE_PRICE_MUSICSCALE_PACK_10`
- `VITE_MUSICSCALE_APP_URL`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_SERVICE_ACCOUNT_BASE64`
- `NESTFINANCE_HANDOFF_ENABLED`
- `NESTFINANCE_APP_URL`
- `VITE_NESTFINANCE_LAUNCH_ENABLED`
*(Nenhum valor foi registrado, conforme restrição).*

## 20. Comandos Reais Encontrados (package.json)
- **Desenvolvimento:** `npm run dev` (`tsx server.ts`)
- **Lint / Typecheck:** `npm run lint` (`tsc --noEmit`)
- **Build:** `npm run build` (`vite build && esbuild server.ts --bundle --platform=node --outfile=dist/server.cjs --external:express --external:stripe --external:firebase-admin`)
- **Testes:** **NÃO VERIFICADO** (Nenhum script `test` real encontrado no `package.json`).
- **Deploy:** A plataforma Vercel faz o deploy (configurado em `vercel.json` usando `package.json` build process).

## 21. GitHub Actions Existentes
- **NÃO VERIFICADO** (Nenhum diretório `.github/workflows` presente).

## 22. Configurações Vercel Existentes
- `vercel.json` configura `server.ts` como serverless function (`@vercel/node`) roteando `source: "/api/(.*)"` e o restante para `index.html` (com headers para CORS).

## 23. Fluxos Críticos de Dados
- **Login e Carregamento de Organizações:** Requisita credenciais no Firebase, carrega o `/users/{uid}`, localiza e seleciona a primeira/prioritária `/organizations/{orgId}` (via frontend e validação backend opcional nos contexts).
- **Assinaturas (Stripe Webhooks):** Endpoint `/api/stripe/webhook` que provisiona acessos nas subcoleções do Firebase. Extrema criticidade.

## 24. Áreas de Alto Risco para Regressão
- Alteração nos payloads enviados para o backend nas rotas da API em `server.ts` (especialmente gerenciaamento de membros, roles e assinaturas).
- Multi-tenancy leaks: Ignorar o `organizationId` ativo nas views e referenciar a raiz do Firestore acidentalmente.
- O loop de render do `OrganizationContext` e `AuthContext` (onde o caching local e memoization são requeridos para não criar estouro de leituras no Firebase).

## 25. Dívidas Técnicas / Legado (Comprovadas)
- O suporte persistente para `/organization_members/{uid}_{orgId}` em paralelo ao novo modelo de `/organizations/{orgId}/members/{uid}` (descrito no código do webhook e nas regras/AGENTS).

## 26. Informações que não puderam ser verificadas (NÃO VERIFICADO)
- Estrutura completa de todos os apps legados que não sejam o "MusicScale".
- Scripts locais de teste (`jest`, `vitest`, etc. não instalados explicitamente como script).
- Repositório real do Github/Branch de onde esse projeto foi deployado localmente.
