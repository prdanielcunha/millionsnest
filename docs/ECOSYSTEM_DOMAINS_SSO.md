# MillionsNest — Domínios oficiais e SSO entre aplicativos

Este é o playbook operacional canônico para entrada direta por domínio oficial no ecossistema MillionsNest. O registro executável fica em `src/lib/apps.ts`; este documento explica provisionamento, DNS, Firebase Authentication, handoff, validação e rollback.

## Contrato obrigatório de experiência

Todo produto deve seguir o mesmo comportamento:

1. O usuário abre `https://<app>.millionsnest.com`.
2. Se o app já tem uma sessão Firebase local válida, continua normalmente.
3. Sem sessão local, o app envia o navegador para `https://www.millionsnest.com/apps/<appId>/launch` (Connect mantém o alias compatível `/connect/launch`).
4. O Hub reutiliza a sessão MillionsNest/Google existente. Se ela não existir, pede login e retoma a rota de launch.
5. O Hub revalida identidade, organização ativa, membership e entitlement e emite um handoff de curta duração.
6. O app consome o handoff, autentica com Firebase custom token e remove `ecosystem_ctx` da URL antes de qualquer outra navegação.
7. O app nunca trata `localStorage`, query string ou cache como fonte de autorização.
8. Handoff inválido/expirado pode recuperar pelo Hub uma vez; uma segunda falha deve encerrar o loop e mostrar erro.
9. Acesso negado por entitlement/permissão deve falhar fechado; nunca virar redirecionamento infinito.

Nunca implementar SSO compartilhando refresh token, service-account JSON, senha ou cookie de longa duração entre subdomínios.

## Registro canônico

| App | Domínio oficial | Firebase Hosting | Estado de domínio no código | Entrada segura |
| --- | --- | --- | --- | --- |
| Hub | `www.millionsnest.com` | `mn-hub-555464791734` | operacional | autoridade de sessão/handoff |
| MusicScale | `musicscale.millionsnest.com` | `mn-musicscale-555464791734` | `configured` | `/apps/musicscale/launch` → `/start` |
| Connect | `connect.millionsnest.com` | `mn-connect-555464791734` | `configured` | `/connect/launch` |
| NestFinance | `nestfinance.millionsnest.com` | `mn-nestfinance-555464791734` | `setup_required` até smoke DNS/SSL | `/apps/nestfinance/launch` → `/auth/handoff` |
| NestJourney | `nestjourney.millionsnest.com` | `mn-nestjourney-555464791734` | `setup_required` até smoke DNS/SSL | `/apps/nestjourney/launch` → gate global |
| NestLocal | `nestlocal.millionsnest.com` | ainda sem site/repositório canônico | `reserved` | habilitar somente quando houver app/site reais |

`configured` significa que o produto está ligado no código. A única prova de domínio operacional é DNS + SSL ativos e smoke HTTPS depois do deploy.

## Provisionamento de domínio no Firebase

O repositório do Hub já possui `.github/workflows/firebase-custom-domain-prepare.yml`, que conhece Hub, MusicScale, NestFinance, Connect e NestJourney. Ele cria/consulta recursos CustomDomain no Firebase **sem inventar registros DNS** e imprime os valores exigidos pelo Firebase.

Para um domínio novo ou ainda pendente:

1. **Confirmar o site Firebase Hosting.** No projeto `millionsnest`, cada produto deve ter seu próprio site e target em `.firebaserc`/`firebase.json`. Não reutilizar o Hosting de outro app.
2. **Criar/consultar o CustomDomain.** Use o workflow de preparação existente ou Firebase Console → Hosting → site correto → Add custom domain. Para NestFinance use `nestfinance.millionsnest.com`; para NestJourney use `nestjourney.millionsnest.com`.
3. **Copiar somente os registros retornados pelo Firebase.** O Firebase pode pedir TXT e depois A/AAAA/CNAME. Nunca hardcode IP/CNAME antigo neste documento ou no código.
4. **Aplicar no DNS de `millionsnest.com`.** Durante provisionamento do certificado, evitar proxy/CDN intermediário salvo configuração já validada.
5. **Esperar ownership, host e SSL ficarem saudáveis.** Não mudar `domainStatus` para `configured` antes disso.
6. **Firebase Authentication → Settings → Authorized domains.** Adicionar o hostname oficial do produto. Não usar wildcard.
7. **Trocar o fallback `*.web.app` pelo domínio oficial no Hub** somente depois do HTTPS real passar.
8. **Deployar Hub e app** e executar os smokes abaixo.

## Implementação obrigatória dentro de cada app

- consumir somente `ecosystem_ctx` protocolo 1.x emitido pelo Hub;
- validar `appId`, `userId`, `orgId`, `customToken` e validade temporal;
- remover `ecosystem_ctx` da URL imediatamente;
- chamar `signInWithCustomToken` no mesmo projeto Firebase `millionsnest`;
- confirmar que o UID autenticado é o UID do handoff;
- restaurar/revalidar a organização pelo backend canônico;
- em entrada direta sem sessão, voltar para a launch route do Hub;
- preservar somente deep links permitidos pelo `appExperienceRegistry` do Hub;
- jamais registrar custom token, ID token ou handoff completo em log/telemetria.

O NestFinance mantém temporariamente o fluxo legado `code` em `/auth/handoff` para compatibilidade; o protocolo novo `ecosystem_ctx` deve coexistir até a migração estar comprovada. O NestJourney ainda tem partes do produto em evolução, mas sua camada de entrada deve permanecer atrás da identidade/organização do Hub.

## Smoke obrigatório antes de chamar de concluído

1. Hub já logado + app sem sessão local → domínio oficial abre sem novo login Google.
2. Hub deslogado + app sem sessão → domínio oficial → Hub pede login → retorna ao app.
3. App já autenticado → domínio oficial não faz handoff desnecessário.
4. Organização ativa selecionada no Hub chega ao app; cache antigo não vence a autoridade do Hub.
5. Deep link permitido é preservado.
6. Handoff expirado/inválido recupera uma vez, sem loop.
7. Usuário sem acesso recebe bloqueio útil e fail-closed.
8. iPhone/Safari e desktop Chromium.
9. HTTPS do domínio oficial sem aviso de certificado.
10. Rotas SPA profundas e `/api/**` continuam apontando para o backend correto.

## Rollback seguro

Se domínio ou SSO apresentar regressão:

- mantenha identidade, organizações e memberships intactos;
- aponte temporariamente `url/operationalUrl` para o `*.web.app` certificado do mesmo Hosting;
- preserve `canonicalOrigin` como endereço desejado;
- desabilite somente o launcher/entrada do app afetado se necessário;
- nunca delete organização, usuário, entitlement ou site Firebase para fazer rollback de DNS.

## Segurança e credenciais

Deploy deve continuar usando Workload Identity Federation/credenciais curtas do CI. Não criar token Firebase “permanente” para ChatGPT, desenvolvedor ou automação. Se uma permissão de infraestrutura faltar, conceda somente o papel mínimo à service account/WIF já usada pelos workflows.

Segredos nunca entram no Git, Firestore público, documentação ou variáveis `VITE_*`.

## Definição de pronto

Um app só está **domínio oficial + SSO concluídos** quando existem, simultaneamente: registro canônico no Hub; recuperação de entrada direta no app; handoff server-side com autorização real; Firebase Authorized Domain; DNS/SSL ativo; deploy do Hub e do app; e smoke real pelo domínio oficial.
