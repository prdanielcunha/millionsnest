# MillionsNest — Domínios oficiais e SSO entre aplicativos

Este documento é o playbook operacional do ecossistema para entrada direta por domínio oficial.

A fonte canônica dos endereços e metadados de runtime fica em `src/lib/apps.ts`. Este documento explica como provisionar e validar a infraestrutura sem compartilhar cookies ou credenciais de longa duração entre subdomínios.

## Contrato de experiência

Todo produto MillionsNest deve seguir o mesmo comportamento:

1. O usuário abre o domínio oficial do produto.
2. Se o produto já possui uma sessão Firebase local válida, ele continua normalmente.
3. Se não possui sessão local, o produto redireciona para o Hub em `https://www.millionsnest.com/apps/<appId>/launch` (o Connect mantém também o alias compatível `/connect/launch`).
4. O Hub reutiliza a sessão MillionsNest existente. Se não houver sessão, pede login e retorna para a rota de launch.
5. O Hub confirma identidade, organização ativa e acesso e gera um handoff curto para o app de destino.
6. O app consome o handoff, cria a sessão Firebase local e remove o segredo/hand-off da URL assim que possível.
7. O app revalida organização e permissões no backend; dados de `localStorage` nunca são fonte de autorização.

Nunca implementar SSO compartilhando um refresh token, service-account JSON, senha ou cookie de longa duração entre subdomínios.

## Registro canônico atual

| App | Domínio oficial | Firebase Hosting | Estado no código | Entrada segura |
| --- | --- | --- | --- | --- |
| Hub | `www.millionsnest.com` | `mn-hub-555464791734` | operacional | origem da sessão/handoff |
| MusicScale | `musicscale.millionsnest.com` | `mn-musicscale-555464791734` | `configured` | `/apps/musicscale/launch` → `/start` |
| Connect | `connect.millionsnest.com` | `mn-connect-555464791734` | `configured` | `/connect/launch` |
| NestFinance | `nestfinance.millionsnest.com` | `mn-nestfinance-555464791734` | `setup_required` | `/apps/nestfinance/launch` → `/auth/handoff`; enquanto o domínio não estiver pronto o Hub usa o `web.app` certificado |
| NestJourney | `nestjourney.millionsnest.com` | a definir quando o Hosting existir | `reserved` | padrão reservado `/apps/nestjourney/launch` |
| NestLocal | `nestlocal.millionsnest.com` | a definir quando o Hosting existir | `reserved` | padrão reservado `/apps/nestlocal/launch` |

`configured` é um estado de configuração do produto em código. Não deve ser interpretado sozinho como prova de DNS/SSL saudável. A comprovação operacional é o smoke HTTPS após o deploy.

## Como criar um domínio oficial novo no Firebase Hosting

Execute esta sequência para qualquer app cujo `domainStatus` esteja `setup_required` ou `reserved`.

### 1. Confirmar/criar o site Firebase Hosting

No Firebase Console, projeto `millionsnest`, abra **Hosting** e confirme o site do app. O repositório precisa ter um target em `.firebaserc` e `firebase.json` deve publicar naquele target.

Exemplo já existente do NestFinance:

- target: `nestfinance`
- site: `mn-nestfinance-555464791734`
- domínio desejado: `nestfinance.millionsnest.com`

Não reutilize o site de outro produto.

### 2. Adicionar o domínio personalizado

Firebase Console → Hosting → site correto → **Add custom domain / Adicionar domínio personalizado**.

Informe somente o hostname reservado no registro canônico, por exemplo:

`nestfinance.millionsnest.com`

### 3. Copiar os registros que o Firebase fornecer

O Firebase pode solicitar um TXT para comprovação de propriedade e depois A/AAAA ou CNAME para roteamento. Use **exatamente** os valores apresentados pelo Firebase naquele momento; não copie valores antigos deste documento ou de outro app.

No provedor DNS de `millionsnest.com`, crie os registros solicitados. Não habilite proxy/CDN intermediário enquanto o certificado Firebase estiver em provisionamento, salvo se houver uma configuração explicitamente validada para isso.

### 4. Esperar DNS e SSL ficarem ativos

No Firebase Hosting o domínio deve chegar a estado conectado e o certificado SSL deve estar provisionado. Não marque `domainStatus: 'configured'` antes disso.

Valide:

- `https://<dominio>` responde por HTTPS sem aviso de certificado;
- o HTML vem do site Firebase Hosting correto;
- rotas SPA profundas também carregam, por exemplo `/start` ou `/auth/handoff`;
- `/api/**` continua sendo reescrito para o backend correto quando o app depende dessa regra.

### 5. Firebase Authentication → Authorized domains

Se o app inicia ou conclui autenticação Firebase no domínio personalizado, adicione o hostname em **Authentication → Settings → Authorized domains**.

Adicionar apenas hostnames oficiais do ecossistema. Nunca adicionar curingas ou domínios temporários sem necessidade.

### 6. Atualizar `src/lib/apps.ts`

No Hub:

- mantenha `canonicalOrigin` no domínio oficial;
- defina `hostingTarget` e `firebaseHostingSite`;
- defina `handoffEntryPath` da aplicação;
- troque `domainStatus` para `configured` somente depois do DNS/SSL validado;
- troque `url`/`operationalUrl` do fallback `web.app` para o domínio oficial quando aplicável.

O domínio é configuração de infraestrutura; não coloque chaves, tokens ou service-account JSON nesse registro.

### 7. Implementar recuperação de entrada direta no app

Quando o app chegar a `unauthenticated` e não estiver no meio do consumo de um handoff válido, ele deve redirecionar para:

`https://www.millionsnest.com/apps/<appId>/launch`

Regras:

- preservar rotas públicas reais (termos, convite público, login explícito quando houver razão de produto);
- não criar loop entre app e Hub em erros de autorização;
- handoff inválido/expirado pode voltar ao Hub uma vez;
- acesso negado por permissão/entitlement deve mostrar bloqueio, não redirecionar infinitamente.

### 8. Teste de aceitação obrigatório

Antes de publicar:

1. Hub logado + app sem sessão local → abrir domínio oficial → entrar sem novo login.
2. Hub deslogado + app sem sessão → domínio oficial → Hub pede login → retorna ao app.
3. App já autenticado → domínio oficial → não faz handoff desnecessário.
4. Organização ativa diferente → app recebe a organização escolhida no Hub, sem confiar em cache antigo.
5. Handoff expirado/inválido → recuperação controlada, sem loop.
6. Usuário sem acesso → fail closed com mensagem útil.
7. iPhone/Safari e desktop Chromium.
8. Smoke HTTPS pelo domínio oficial, incluindo uma rota SPA profunda.

## Alteração de domínio sem interromper produção

Para um app que hoje usa `*.web.app`:

1. mantenha o `web.app` em `url/operationalUrl` durante a configuração;
2. configure domínio customizado e SSL;
3. valide o domínio customizado;
4. altere o Hub para o domínio oficial;
5. publique Hub;
6. rode smoke de entrada direta;
7. mantenha o `web.app` apenas como fallback técnico, não como link exibido ao usuário.

Isso evita transformar uma alteração de DNS em indisponibilidade do SSO.

## Segurança e credenciais

Deploy deve continuar usando Workload Identity Federation / credenciais curtas do CI quando disponível. Não criar token Firebase "permanente" para ChatGPT, desenvolvedor ou automação.

Se uma permissão de deploy faltar, conceder somente o papel mínimo à service account/WIF já usada pelo workflow. Segredos nunca entram no Git, no Firestore público ou em variáveis `VITE_*`.

## Critério para considerar um app concluído

Um app só pode ser chamado de "domínio oficial + SSO concluídos" quando os quatro pontos abaixo estiverem verdadeiros:

- registro canônico no Hub;
- recuperação de entrada direta no app;
- DNS/SSL do domínio oficial ativo;
- smoke real pelo domínio oficial depois do deploy.

Ter apenas o código ou apenas o DNS não é conclusão.
