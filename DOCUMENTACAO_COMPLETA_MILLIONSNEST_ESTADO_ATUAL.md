# Documentação Completa da MillionsNest (Estado Atual - Enriquecida)

**Última atualização:** Junho de 2026
**Status:** MVP SaaS Premium Avançado / Beta funcional em refinamento

---

## Sumário

1. [Visão Geral da MillionsNest](#1-visão-geral-da-millionsnest)
2. [Estado Atual Real do Projeto](#2-estado-atual-real-do-projeto)
3. [Relação entre MillionsNest e MusicScale](#3-relação-entre-millionsnest-e-musicscale)
4. [Arquitetura Geral da MillionsNest](#4-arquitetura-geral-da-millionsnest)
5. [Stack Técnica da MillionsNest](#5-stack-técnica-da-millionsnest)
6. [Estrutura de Arquivos da MillionsNest](#6-estrutura-de-arquivos-da-millionsnest)
7. [Landing Page da MillionsNest](#7-landing-page-da-millionsnest)
8. [Planos, Vendas, Carrinho e Checkout](#8-planos-vendas-carrinho-e-checkout)
9. [Stripe e Webhooks](#9-stripe-e-webhooks)
10. [Auth Central, Login e Sessão](#10-auth-central-login-e-sessão)
11. [Papéis Globais e Organizacionais](#11-papéis-globais-e-organizacionais)
12. [Multi-Tenancy e Organizações](#12-multi-tenancy-e-organizações)
13. [Painel Administrativo Global](#13-painel-administrativo-global)
14. [Integração com MusicScale e Futuros Apps](#14-integração-com-musicscale-e-futuros-apps)
15. [Segurança](#15-segurança)
16. [Observabilidade, Logs e Diagnóstico](#16-observabilidade-logs-e-diagnóstico)
17. [Apps Futuros](#17-apps-futuros)
18. [Roadmap](#18-roadmap)
19. [Bugs e Decisões Importantes](#19-bugs-e-decisões-importantes)
20. [Inventário de Arquivos Críticos](#20-inventário-de-arquivos-críticos)
21. [Mapa de Fluxos Críticos](#21-mapa-de-fluxos-críticos)
22. [Trechos Estratégicos de Código e Pseudocódigo](#22-trechos-estratégicos-de-código-e-pseudocódigo)
23. [Mapa Firestore Detalhado](#23-mapa-firestore-detalhado)
24. [Endpoints e APIs](#24-endpoints-e-apis)
25. [Contexts, Hooks e Services](#25-contexts-hooks-e-services)
26. [Regras de Negócio Consolidadas](#26-regras-de-negócio-consolidadas)
27. [Matriz de Riscos Técnicos](#27-matriz-de-riscos-técnicos)
28. [Checklist para Programador](#28-checklist-para-programador-antes-de-alterar-o-projeto)
29. [Checklist para Agentes de IA](#29-checklist-para-agentes-de-ia)
30. [Resumo Consolidado](#30-resumo-consolidado)

---

## 1. Visão Geral da MillionsNest

A MillionsNest **NÃO é apenas uma landing page**. Ela é o **hub central do ecossistema** e atua como o sistema operacional da plataforma (Auth, Tenants, Billing, RBAC, App Launcher).

### Arquivos Relacionados
- `src/App.tsx` (Roteamento primário)
- `src/pages/Dashboard.tsx` (App Launcher)

### Pontos de Atenção
- Manter design e arquitetura Premium Ministerial (estética Stripe/Linear).
- Qualquer novo módulo obrigatoriamente deve nascer abaixo das diretrizes do Hub.

---

## 2. Estado Atual Real do Projeto

**MVP SaaS Premium Avançado / Beta funcional em refinamento**

### Arquivos Relacionados
- `package.json` (Dependências: React 19, Tailwind Vite plugin, Stripe, Firebase, Framer Motion)
- `vite.config.ts` [Pendente confirmação explícita no código]

### Como Validar
- Testar cadastro pleno do usuário e provisão automática do tenant com success page.

---

## 3. Relação entre MillionsNest e MusicScale

O modelo Hub-and-Spoke determina que o Hub (MillionsNest) decide "O QUE" e "QUEM" acessa, e o MusicScale atende "COMO" opera musicalmente.

### Arquivos Relacionados
- `src/contexts/OrganizationContext.tsx`
- `src/lib/permissionService.ts`

### Fluxo Técnico
1. O usuário abre o MusicScale.
2. A view é protegida pelo `OrganizationContext` que carrega `capabilities`.
3. Se o plano dita `musicscale.access = false`, a view centraliza um paywall (originário da MillionsNest).

### Riscos ao Alterar
- Se o MusicScale consultar Stripe ou criar cobrança isolada, a base de dados ficará irrecuperavelmente corrompida.

---

## 4. Arquitetura Geral da MillionsNest

Base Client-Server Serverless:
- Frontend: Vite SPA React.
- Backend Core: `server.ts` (Express proxy e Webhook Handler).
- Data: `Firestore`.

### Pontos de Atenção
- Nenhuma query cruzada de organizações pode ser feita. `where("organizationId", "==", orgId)` é compulsório em todo CRUD.

---

## 5. Stack Técnica da MillionsNest

### Arquivos Relacionados
- `server.ts`
- `package.json`
- `firestore.rules`

### Fluxo Técnico
Frontend -> Autentica (Firebase) -> Consome via RPC/REST (Express) ou assina via SDK Firestore. 

### Riscos
- Mudar regras de Vite no `package.json` e quebrar o build do container proxy reverso AI Studio (que escuta fortemente na porta 3000 amarrada ao nginx).

---

## 6. Estrutura de Arquivos da MillionsNest
Estrutura limpa: `server.ts` é a inteligência Backend; `/src/` é a casca SPA Frontend.
*(Inspecione a raiz sempre que precisar de contexto: utils em `/src/lib`, contexts em `/src/contexts`)*.

---

## 7. Landing Page da MillionsNest
A vitrine de conversão. Não deve sofrer despejo de lógica transacional pesada.

---

## 8. Planos, Vendas, Carrinho e Checkout

**O faturamento é estritamente centralizado na MillionsNest.**

### Arquivos Relacionados
- `server.ts` (Routes `/api/v1/billing/unified-checkout`)
- `src/lib/pricingCatalog.ts`
- Páginas: `Checkout.tsx` [Pendente confirmação visual]

### Fluxo Técnico
1. Front chama `/api/v1/billing/unified-checkout`.
2. Servidor express gera uma *Stripe Session*.
3. Redirecionamento PCI seguro.
4. Ao final, a url redireciona e o Backend assume via Webhooks.

### Pontos de Atenção
- O frontend nunca resolve ou decreta uma assinatura como paga na base do "acredite em mim". O Webhook processado no servidor cria o documento em `/subscriptions`.

---

## 9. Stripe e Webhooks

Coração do faturamento. Totalmente desacoplado do client-side.

### Arquivos Relacionados
- `server.ts` (`app.post('/api/stripe/webhook', ... )`)
- `src/lib/subscriptionHelpers.ts`

### Fluxo Técnico
1. Evento `checkout.session.completed` chega ao Express.
2. Assinatura do Payload validada via `stripe.webhooks.constructEvent`.
3. Extrai-se `client_reference_id` (uid) e metadados (`organizationId`).
4. Servidor usa `admin.firestore()` bypassando Regras.
5. Provisiona Org + Subscription.

### Matriz de Erros Locais
- **Erro:** Se o evento do stripe for recebido duas vezes, podemos duplicar a igreja. 
- **Solução (Idempotência):** Checar existencia prévia antes de instanciar novo documento.

---

## 10. Auth Central, Login e Sessão

### Arquivos Relacionados
- `src/contexts/AuthContext.tsx`
- `src/lib/firebase.ts`

### Fluxo Técnico
Firebase emite um AuthState listener. Quando detecta user, `AuthContext` hidrata `currentUser`. Se necessário chamar a API segura (`/api/admin/*`), pega o JWT gerado pelo firebase `await user.getIdToken()`.

### Riscos
- Manipular o state de Auth para simular um User fará com que o Server rejeite e as Security Rules entrem em colapso, resultando em "Error: Missing permissions".

---

## 11. Papéis Globais e Organizacionais

Camadas: `systemRole` (no `/users`) vs `organizationRole` (no `/organizations/{orgId}/members`).

### Arquivos Relacionados
- `src/lib/rbac.ts`
- `src/lib/roleResolver.ts`

### Como Validar
- Logar com owner: checar se acessa configuração de cobrança. Logar com member: deve ser repelido no frontend e bloqueado via Backend (rules).

---

## 12. Multi-Tenancy e Organizações

A separação lógica de dados absoluta. "1 Igreja = 1 organizationId".

### Arquivos Relacionados
- `firestore.rules` (Funções: `hasOrgContext(data)` e `checkOrgAccess(orgId)`)

### Pontos de Atenção (Gatilho Mortal)
- Cross-tenant Data Leak é falha inaceitável. Sempre garantir validação.

---

## 13 a 19 (Ver sub-documentos originais)
Paineis de Admin, roadmap e bugs seguem sua fundação já estabilizada. O "App Launcher" em `Dashboard.tsx` decide como distribuir fluxos restritos. Integrações futuras sempre buscarão o modelo `features.ts`.

---

## 20. Inventário de Arquivos Críticos

| Arquivo | Responsabilidade | Área do sistema | Risco se alterar errado | Observações |
| :- | :- | :- | :- | :- |
| `server.ts` | Backend Central (APIs, Strip, Webhooks) | Backend / Infra | Queda total do backend, vazamento de Billing, orfandade de Organização. | Modifique apenas com extrema convicção. |
| `firestore.rules` | Muralha de Segurança NoSQL | DBA / Cloud | Liberação indesejada de reads, quebra (permission denied) na leitura global. | Rigidez requer `organizationId` matching. |
| `src/contexts/AuthContext.tsx` | Estado de Sessão React | Frontend (Core) | Loops infinitos de re-render (se não memoizado), desconexão aleatória. | Usa Firebase Auth observer. |
| `src/contexts/OrganizationContext.tsx` | Sessão Instanciada do Tenant e Capabilities | Frontend (Tenant) | O UI fica cego para a assinatura, trancando legítimos usuários e donos de fora dos apps. | Depende da API admin ou do load paralelo local. |
| `src/lib/rbac.ts` | Definição de permissões estáticas | Core Logic | Membros comuns deletando músicas, ceos sem acesso. | Usa dicionários de grants. |
| `src/lib/firebase.ts` | Client App Initialization | Infra | App morre no arranque "FirebaseAppNotInitialized". | Nao exponha Admin keys aqui. |

*Diversos utilitários em `src/lib/` compõem a cola do ecossistema, incluindo limits e audits.*

---

## 21. Mapa de Fluxos Críticos

### Fluxo 1: Webhook Idempotente (Stripe -> DB)
**Objetivo:** Consolidar faturamento de forma segura e autônoma.
**Arquivos envolvidos:** `server.ts` (rota `/api/stripe/webhook`).
**Permissões necessárias:** Nenhuma (é um listener autenticado por assinatura Stripe).
**Passo a passo técnico:**
1. Stripe atira POST `checkout.session.completed`.
2. O servidor valida a criptografia `stripe.webhooks.constructEvent()`.
3. Express extrai o `client_reference_id` (userId) e metadata (ex: `selected_plan`).
4. `server.ts` usa o Firebase Admin para buscar se a Org do UserId já existe.
5. Se existe, efetua update da Subscription. 
6. Se NÂO, cria o `organizations/` doc com `ownerUid: userId` -> e lança na sub-colection de `/subscriptions`.
**Erros comuns:** Falha de idempotência. Executar 2 vezes gera dupla igreja e uma sem owner definido se mal escrito.
**Como testar:** Via Stripe CLI local enviando evento trigger.

### Fluxo 2: Hydrate e Redirecionamento Pós-Login
**Objetivo:** Guiar o Pr/Usuário validado à sua visualização legítima.
**Arquivos envolvidos:** `AuthContext.tsx`, `App.tsx` (Route guards).
**Passo a passo técnico:** Usuário loga -> token gerado -> Context atualiza -> Rota repassa pra Dashboard -> Dashboard lê `/users/{uid}` para ver primary_org.

---

## 22. Trechos Estratégicos de Código e Pseudocódigo

### A. Proteção Obrigatória em Regras do Firestore
Local: `firestore.rules`.
Por que? Nenhuma query pode vazar (Data Sampa / Cross-Tenant).
```javascript
// Exemplo canônico de leitura em coleções da MusicScale (Repertório)
match /songs/{songId} {
  allow read: if isAuthenticated() && 
                 checkOrgAccess(resource.data.get('organizationId', '')) && 
                 isOrgActive(resource.data.get('organizationId', ''));
}
```
**Regra Exata:** Se a UI tentar uma ref genérica `collection(db, 'songs')` sem `where('organizationId', '==', orgId)`, o Firebase aborta e joga falha, mesmo que você seja o dono.

### B. O Webhook Escudo em server.ts (Pseudocódigo Estrutural)
Local: `server.ts`.
```typescript
app.post('/api/stripe/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
  
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.client_reference_id;
    // Opcional: Bloqueio Transacional via Admin SDK para evitar duplicados
    await createOrUpdateOrgInAdminDatabase(userId, session);
  }
  return res.json({received: true}); // Reconhecimento rápido vital!
});
```
**Importância:** Express.raw e status code de imediato garantem que stripe não fique estrangulando o servidor.

---

## 23. Mapa Firestore Detalhado

| Collection | Escopo | Finalidade | Quem lê | Quem escreve | Riscos / Regras |
| :- | :- | :- | :- | :- | :- |
| `users` | Global | Identidade, Role Global (CEO), vínculo primário | AuthContext, Owner | Auth (Registro), Admin SDK | Mudar payload `systemRole` corrompe privilégios admin. |
| `organizations` | Root Tenant | Nome da org, `ownerUid`, Status local básico | OrgContext, DB Rules | Admin SDK, Owner da Org | Omissão bloqueia acesso em cascata (Isolamento). |
| `organizations/{orgId}/members` | Sub (Tenant) | Hierarquia Local (admin, leader, member) | Rules (checkMemberExists) | Admin SDK, Org Admin | Fundamental para RBAC. |
| `subscriptions/{orgId}` | P/ Tenant | Espelha contrato Stripe Exatamente (trial, currentPeriodEnd) | DB Rules, UI Capability | Admin SDK (somente) | Se a UI escrever, é fraude! Proibido escritas pela Web UI. |
| `audit_logs` | Global/Audit | Historico imutável forense (EcosystemAdmin) | CEO / Global Admin | Servidor Express / Audit helper | Perder o rastro significa operar sem compliance. |
| `analytics_events` | Global/Track | Dispara events raw do front para saúde de uso | CEO | Funções locais Firebase | Ruído excessivo (escrita liberada global), mas útil. |
| `songs` | P/ Tenant | Músicas isoladas do MusicScale de uma Org. | Member+ da OrgX | Admins/Leaders (MusicScale) | Cross-Tenant leakage perigoso se query não tipada. |

---

## 24. Endpoints e APIs

*Inventário dinâmico rastreado de `server.ts`:*

| Método | Endpoint | Responsabilidade | Auth / Risco |
| :- | :- | :- | :- |
| **POST** | `/api/stripe/webhook` | Receber notificações raw do Stripe. | Validação via `stripe-signature`. Falha de paridade quebra o sistema. |
| **POST** | `/api/v1/billing/unified-checkout` | Gerar Link PCI-Checkout paramétrico. | Requer JWT válido e OrgContext. |
| **POST** | `/api/admin/organizations/:orgId/create-musicscale-structure` | Operação reparativa via Ecosystem Console. | Acesso estrito a `systemRole=ceo`. |
| **GET** | `/api/admin/users/:uid/diagnostics` | Levantar árvore de status para Debugging do painel Backoffice. | `systemRole=ceo` |
| **POST** | `/api/repair/sync` | Ferramenta curativa manual quando o Webhook sofre timeout no Firebase. | Requer `systemRole=ceo` ou originário de token verificado explícito. |
| **GET** | `/api/v1/organizations/:orgId/limits` | Verificador de quotas e monthly_usage via interface server (ex: IA limits). | Somente Org autenticada. |

---

## 25. Contexts, Hooks e Services

### Contexts
- **AuthContext (`src/contexts/AuthContext.tsx`)**: Guarda o Firebase User (Raw Auth). Quem consome toda a aplicação. Cuida de logout e de listeners puros.
- **OrganizationContext (`src/contexts/OrganizationContext.tsx`)**: O Contexto mestre que engole o Auth e responde: "Para o Inquilino X deste usuário, quais as `capabilities` ativas?". Exibe loading full-screen em travamentos. Fundamental ao MusicScale.

### Hooks
- Em refinamento / modularização (ex: Uso de wrappers em volta de `useContext` padrão tipo `useOrganization()` ou `useAuth()`).  

### Services
- **`src/lib/firebase.ts`**: Inicializa Client app.
- **`src/lib/analytics.ts`**: Faz tracking de `checkout_started`, envia JSONs crus para `analytics_events`. Falência se não respeitar Regra de Write.
- **`src/lib/audit.ts`**: Helper padronizado para gravação em `/audit_logs`.

---

## 26. Regras de Negócio Consolidadas

1. O comprador da assinatura (Paymaster) DEVE ser o proprietário absoluto (owner) da organização.
2. Nenhum Módulo/Spoke (MusicScale) tem permissão de abrir gateways locais ou cobrar add-ons desamparando do Hub MillionsNest central.
3. Não criar duplicação cega. Havendo colisão de email de compra com Org já gerada, deve haver um Sync, e não um Override burro.
4. Operações de CRUD só progridem se o Backend (`server.ts` Stripe hook) conferir ao documento `/subscriptions/{orgId}` os status de validade `trialing` ou `active`.
5. Se uma conta está com acesso bloqueado (status `past_due` etc), a interface em `OrganizationContext` interceptará e devolverá paywall ou banners de bloqueio instintivamente.
6. A segurança da regra é resolvida em Banco (Firestore Rules) – O Frontend mentirá com Javascript se o atacante quiser; logo Frontend é pura Estética e UX (Zero Trust).

---

## 27. Matriz de Riscos Técnicos

| Risco | Área afetada | Gravidade | Causa provável | Como Prevenir / Como Detectar |
| :- | :- | :- | :- | :- |
| **Duplicação de Tenant** | Organizações / Billing | Crítica / Alta | Retentativa ansiosa do cliente pós-checkout lente (Webhook assíncrono). | Usar lock ou idempotência estrita via transaction / Sync Tooling CEO. |
| **Cross-Tenant Leaking** | Firestore Rules | Fatal / Letal | Query no front com `where clause` malfeito + Rules liberais genéricas. | A regra do Firestore precisa forçar `where("organizationId", "==", orgId_auth)`. Detectado por auditoria e linter manual de code review. |
| **Mismatch Comercial** | Dash/Stripe | Alta | Interface assumindo plano antigo baseado em LocalStorage/Cache longo de `AuthContext`. | Obrigação de forçar reload de Token/Context na volta do Success Url. Painel Ecosystem Console ajuda ver diferenças. |
| **Permissão (False Positive)** | Apps (Ex: MusicScale) | Média | Firestore Rule enxergando dados legados na coleção `organization_members` em descompasso com `/members/`. | Normalização de dados ou Regra com fallback (`checkMemberExists()` já adaptado para 3 cenarios em firestore.rules). |

---

## 28. Checklist para Programador Antes de Alterar o Projeto

**Antes de mexer no Billing (server.ts):**
- [ ] Confirme a tipagem do objeto gerado do webhook (ex: `Stripe.Checkout.Session`).
- [ ] O código prevê re-tentativa e idempotência para evento atrasado?
- [ ] A Subscription foi inserida em uma sub-coleção ligada fisicamente a uma Organização verdadeira e blindada (Firestore Admin Mode)?

**Antes de mexer em Organizações e Contextos Front-end:**
- [ ] Mudanças disparam Re-renders gigantes não-memoizados em `App.tsx`? (Use `useMemo`).
- [ ] A alteração afeta a resolução do Status que exibe o paywall?
- [ ] Eu garanto que qualquer query Nova no Firebase injeta `where('organizationId', ...)`? Se não for injetado, vai bater no paredão do "Missing Permissions".

**Antes de Alterar/Adicionar UI e Estética (CSS):**
- [ ] Respeitou as variáveis definidas no Tailwind config? Não insira css-in-js se não for necessário.
- [ ] É simples e limpo como "Stripe/Vercel/Linear"? Apague caixas desnecessárias. Modere as sombras.
- [ ] Foi adotada total responsividade Mobile (`max-w`, `w-full`, pads relativos)?

---

## 29. Checklist para Agentes de IA

Qualquer IA (Gemini/Cursor/Copilot) operando este repositório **DEVE LER E ACATAR** as seguintes restrições peremptórias antes de agir sobre solicitações de código:

1. **Leia e preserve a Arquitetura Multi-Tenant:** `1 Igreja = 1 OrganizationId`. Consultas isoladas mandatórias.
2. **Priorize o Design System Nativo:** Se as diretivas não listam frameworks extras, use puro `Tailwind CSS`.
3. **Não mude o modelo de preçário (Planos e Statuses):** Estes são ditados por negócios, se uma feature "Starter" não tiver acesso à IA, faça conditional render no frontend, não mude lógicas do Stripe.
4. **Respeite o Hub (MillionsNest) x Spoke (MusicScale):** A MillionsNest dita as Permissions, a MusicScale consome. Faturamento e perfis não são criados redundantemente dentro do escopo Musical e vice-versa.
5. **Indique Incerteza onde adequado:** Caso faltem evidências no ambiente do AI Studio de um endpoint específico exato (ex: API de IA complexa), marque como Pendente e peça contexto limitante em vez de alucinar blocos autônomos falhos.
6. **Billing NÃO MENTE (Server Authored):** Nunca invente componentes front-end que mudam localmente a conta para Pro. 

---

## 30. Resumo Consolidado

A MillionsNest é uma peça formidável Server-Client focada em segurança, pagamentos em background assíncrono e controle estrito de Multi-Tenant. 

Sua fundação determina que **o servidor** guarda as garantias contratuais baseadas nos Webhooks Stripe, enquanto o **Firestore Rules e a Modelagem baseada em `organizationId`** repousam como muralha instransponível protegendo os aplicativos satélites do ecossistema, os mantendo livres e focados na excelência UX/UI final para o líder Eclesiástico. 

*Fim da Documentação.*
