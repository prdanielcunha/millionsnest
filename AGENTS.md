# MillionsNest - Agent Operational Manual

## Project Purpose
MillionsNest atua como o sistema operacional e hub central do ecossistema, incluindo Auth Central, Billing Central, Organization Central e App Launcher para aplicativos parceiros (como MusicScale e NestFinance).

## Mandatory Reading
Antes de modificar qualquer código, o agente deve:
1. Ler este `AGENTS.md`.
2. Ler o `README.md`.
3. Ler a documentação expandida (ex: `DOCUMENTACAO_COMPLETA_MILLIONSNEST_ESTADO_ATUAL.md`).
4. Localizar a implementação atual a ser alterada.
5. Localizar os testes relacionados (na pasta `scripts/`).
6. Identificar as dependências daquele código.
7. Avaliar o impacto das mudanças, considerando o multi-tenancy rigoroso.
8. Somente depois alterar, validando a alteração no escopo estrito.

**Nota:** Existe um kit externo de sucessão com contexto adicional de negócio e planejamento que NÃO está disponível neste repositório. Confie exclusivamente na evidência técnica contida nos arquivos físicos do repositório para suas implementações. 

## Source of Truth
1. O código implementado (`src/`, `server.ts`).
2. Os scripts de testes em `scripts/` (representando contratos operacionais P0, RC e integração).
3. `firestore.rules` (Garantia máxima de isolamento).
4. `DOCUMENTACAO_COMPLETA_MILLIONSNEST_ESTADO_ATUAL.md`.
5. Este arquivo `AGENTS.md`.

Se houver conflito entre a documentação e o código em produção consolidado pelos testes (scripts/), avise e priorize a implementação estrita verificada pelos testes P0. NÃO presuma ou remova código sem investigar rigorosamente o histórico no código.

## Architecture Overview
- **Front-end:** React, Vite, TailwindCSS.
- **Servidor:** Proxy Express em `server.ts` servindo as rotas, APIs (ex: contexto, integrações, faturamento) e Webhooks do Stripe. 
- **Persistência:** Firebase Auth (JWT) e Firestore (isolado via rules).
- **Acesso:** Handoff resolvido via `EcosystemAccessResolver` validando status de assinatura (Stripe > Firestore), plano, permissões e associações.

## Repository Structure
- `src/`: Lógica front-end, serviços (ex: `src/server/services/`), bibliotecas, contextos, componentes.
- `server.ts`: Entrypoint do Node.js, Webhooks Stripe.
- `scripts/`: Suítes de testes P0/RC manuais executadas via `tsx`.
- `docs/` e arquivos na raiz: Documentação principal e específica.
- `firebase.rules`, `firebase-blueprint.json`: Configurações Firebase de extrema importância.

## Critical Areas
As seguintes áreas são consideradas Críticas (Risco Altíssimo) e requerem profundo cuidado e revisão antes de qualquer modificação:
- **Autenticação, Sessão e Contextos:** `AuthContext.tsx`, `OrganizationContext.tsx`
- **Isolamento de Dados (Rules):** `firestore.rules`
- **RBAC, Autorização e Resolução de Acesso:** `EcosystemAccessResolver.ts`, lógica global/tenant.
- **Integração Financeira (Billing, Webhooks):** Stripe Webhooks em `server.ts` e handoffs.
- **Invitations / Entitlements:** Planejadores, transações de aceite/criação, manipulação do plano organizacional.

## Development Rules
- Investigue os testes existentes (`scripts/`) antes de modificar áreas centrais.
- Preserve a compatibilidade e modularidade do código.
- Nenhuma alteração incidental: modifique apenas o que foi solicitado.
- Não introduza fontes secundárias de verdade (mantenha os fluxos de auth, org, billing já existentes).
- Consulte e reaproveite componentes, helper functions (em `src/lib/`) e contratos.

## Commands
*Sempre utilize os comandos existentes no repositório:*
- **Instalação:** `npm install`
- **Desenvolvimento:** `npm run dev`
- **Lint & Typecheck:** `npm run lint` (Usa `tsc --noEmit`)
- **Build:** `npm run build`
- **Testes Manuais:** Use o tsx para rodar os testes críticos de segurança, performance e infra: `npx tsx scripts/[nome_do_script].ts`

## Testing Requirements
Antes de concluir qualquer mudança que impacte lógica, estado ou persistência:
1. Identifique e execute os testes relacionados em `scripts/`.
2. Rode o Typecheck/Lint: `npm run lint`.
3. Garanta que o Build ocorra com sucesso: `npm run build`.

## Definition of Done
Uma tarefa só está completa quando:
- O escopo exato foi implementado, e APENAS ele.
- Nenhuma alteração não intencional de design ou arquitetura ocorreu.
- O lint, o typecheck e os testes relevantes passaram (`exit code 0`).
- Nenhuma informação secreta foi exposta ou commitada (nem mesmo no arquivo de instruções/docs).
- O build de produção é possível.

## Security Rules
- NUNCA grave, escreva, armazene ou faça commit de chaves do Stripe, arquivos `.env` ou chaves de serviço do Firebase.
- NÃO exponha tokens ou segredos reais nos logs, chats ou sumários.
- A autoridade de acesso e permissões DEVE ser tratada no backend / Cloud Functions / Rules, e não delegada primariamente ao client.
- Reduzir níveis de segurança no `firestore.rules` sem extrema necessidade é proibido.

## Environment Variables
Variáveis estão referenciadas de forma abstrata em `.env.example`. Acesse variáveis de server no backend, e as de frontend usando o prefixo exigido pelo Vite (`VITE_`).

## Database / Persistence Rules
Multi-tenancy é vitalício e compulsório. O `organizationId` é a raiz para qualquer dado transacional da aplicação.

## Authentication / Authorization Rules
Consulte as seções sobre "RBAC Contract & Sistema de Permissões" no material original abaixo. O papel primário flui através da associação (membership) organizacional ou papéis de sistema definidos globalmente.

## Cross-Project Integrations
O MillionsNest centraliza Auth e Billing e repassa contextos para aplicativos satélites via JWT/Handoff (ex: MusicScale). Não modifique a lógica de handoff sem comprovar sua eficiência nos testes (`test_mn_access_02_musicscale_handoff.ts`, etc).

## UI / UX Rules
- Aplique "Mobile First" e "Desktop Excellent".
- Adira estritamente ao design system da plataforma, aproveitando TailwindCSS e componentes ShadCN/Radix presentes.
- Promova copy clara focada em um nível de software premium (Apple, Notion, Linear).
- Não modifique arquivos de tradução (`en`, `pt`, `es`) fora do contexto ou quebrando compatibilidade de fallback (i18n).

## High-Risk Files / Modules
- `server.ts`
- `src/server/services/EcosystemAccessResolver.ts`
- `src/server/services/MusicScaleHandoffService.ts`
- `src/contexts/AuthContext.tsx`
- `src/contexts/OrganizationContext.tsx`
- `firestore.rules`

## Known Technical Risks
- O controle de acesso a organizações depende da latência do Firestore e dos hooks locais. Hooks otimizados com `AbortController` (como demonstrado nos testes RC2) evitam loop infinito ou sobrescrita em logins.
- Alterações nos papéis globais/administrativos no front-end podem comprometer toda a gestão central.

## Change Discipline
- Não delete código apenas por não entendê-lo inicialmente (ex: funções legadas, proxies). Mapeie usos.
- Modifique com precisão cirúrgica para proteger o ecossistema multi-tenant.

## Documentation Discipline
Se você alterar infraestrutura, comandos, deploy, ou lógica crítica consolidada na documentação (`README.md`, ou nos testes da pasta `scripts/`), as respectivas referências textuais DEVEM ser mantidas síncronas.

## When Uncertain
Investigue `scripts/`, `src/lib/`, e `firestore.rules` antes de arriscar. Registre em caso de dúvida e A VALIDE. 

---

### MENSAGEM AOS AGENTES (Preservação das Diretrizes de Negócio Originais)

O texto abaixo preserva estritamente as regras de negócio e de fundação do ecossistema originalmente presentes no arquivo de direcionamento de agentes:

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
