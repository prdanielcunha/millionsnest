# MillionsNest

**MillionsNest** é o hub central do ecossistema e atua como o sistema operacional da plataforma (Auth Central, Tenant Central, Billing Central, RBAC e App Launcher) para os aplicativos parceiros (ex: MusicScale).

## Visão Geral

Este repositório contém a implementação técnica da plataforma MillionsNest, oferecendo:
- Multi-tenancy obrigatório por organização (`organizationId`).
- Gestão centralizada de usuários, assinaturas, organizações e membros de equipe.
- Integração de cobrança via Stripe com webhooks locais.
- Servidor proxy Express para lidar com lógica sensível e APIs internas.
- Interface front-end escalável desenvolvida em React.

**Nota Importante:** Existe um **kit externo de sucessão** deste projeto que contém o contexto estratégico, histórico de decisões de negócio e o roadmap da plataforma. Este repositório foca puramente na autossuficiência técnica e no ambiente de desenvolvimento da plataforma base. O conhecimento de negócios e estratégia que transcende este repositório deverá ser consultado separadamente no kit externo.

## Stack Técnica

- **Framework Front-end:** React 19, React Router DOM, Vite
- **Estilização:** Tailwind CSS v4, Framer Motion, Lucide React
- **Back-end / APIs:** Express (Node.js 20.x), esbuild
- **Linguagem:** TypeScript
- **Integrações de Serviço:** Firebase (Authentication, Firestore), Stripe

## Estrutura do Repositório

- `src/` - Código-fonte do front-end e integrações do lado cliente.
  - `src/components/` - Componentes visuais.
  - `src/contexts/` - Contextos globais (ex: AuthContext, OrganizationContext).
  - `src/lib/` - Helpers e utilitários compartilhados.
  - `src/pages/` - Páginas e telas da aplicação.
  - `src/server/services/` - Serviços back-end e resolvers (ex: `EcosystemAccessResolver.ts`).
- `server.ts` - Ponto de entrada do servidor back-end Express (onde residem Webhooks do Stripe, validações e APIs seguras).
- `scripts/` - Scripts de teste e validação rigorosos da arquitetura e integrações (P0, RC, Contratos).
- `docs/` e `*.md` (Raiz) - Documentação estendida do projeto, incluindo `AGENTS.md` e `DOCUMENTACAO_COMPLETA_MILLIONSNEST_ESTADO_ATUAL.md`.

## Pré-requisitos

- Node.js (Recomendado v20.x, conforme configurado em `package.json`).

## Instalação

```bash
npm install
```

## Comandos Operacionais

### Desenvolvimento

Para iniciar o ambiente de desenvolvimento local (cliente e servidor):
```bash
npm run dev
```

### Build

Para criar o pacote de produção completo (Gera o build estático do Vite e um bundle do servidor no `dist/server.cjs` via esbuild):
```bash
npm run build
```

### Execução de Produção Local

Após o build concluído:
```bash
npm run start
```

### Typecheck e Lint

Para validação estática de tipos e detecção de erros via TypeScript:
```bash
npm run lint
```

### Testes

Este projeto baseia-se pesadamente em validações em nível de scripts para garantir regras de negócios e segurança rigorosas (P0). Os scripts estão em `scripts/`.
Exemplo de execução de testes manuais disponíveis:
```bash
npx tsx scripts/test_millionsnest_security_governance_p0.ts
```
*(Consulte a pasta `scripts/` para os módulos individuais de validação).*

## Variáveis de Ambiente

As variáveis necessárias para rodar este projeto estão mapeadas sem seus valores secretos em `.env.example`.
As variáveis dividem-se logicamente em:

**Firebase (Client-side):**
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
...

**Stripe e Firebase Admin (Server-side & Secrets):**
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_SERVICE_ACCOUNT_BASE64`
...

**Precificação & Planos Musicais:**
- `STRIPE_PRODUCT_MUSICSCALE_STARTER`
... (e demais identificadores relacionados a preços e produtos).

*Lembre-se: Nunca faça commit de segredos reais, de chaves de API restritas ou de certificados. Nunca altere valores de .env para bypass sem instrução explícita.*

## Segurança e Regras Adicionais

- **Segurança e Isolamento Multi-tenant:** Todo e qualquer acesso ou modificação aos dados deve respeitar a chave hierárquica por `organizationId`. A manipulação das `capabilities` e validação do JWT são estritas; falhas aqui comprometem todo o modelo de segurança.
- Para uma análise aprofundada da estrutura atual, regras de firebase, e arquitetura de banco de dados, consulte o documento `DOCUMENTACAO_COMPLETA_MILLIONSNEST_ESTADO_ATUAL.md` disponibilizado neste repositório.

---
*Gerado por processo de auditoria técnica para continuidade, segurança e manutenção fluida do ecossistema.*
