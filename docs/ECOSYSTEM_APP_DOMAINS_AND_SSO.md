# MillionsNest — domínios oficiais e SSO do ecossistema

Este documento é o runbook canônico para publicar qualquer app MillionsNest com domínio próprio e acesso direto usando a sessão central do Hub.

A fonte de verdade de estado desejado fica em `src/lib/ecosystemAppDomains.ts`. Não usar endereços `*.web.app` como URL comercial/oficial do produto. Eles continuam úteis como origem técnica e para diagnóstico, mas o usuário deve entrar por `https://<app>.millionsnest.com`.

## Padrão obrigatório de autenticação

O navegador não compartilha sessão privada de forma insegura entre subdomínios. O padrão MillionsNest é:

1. O usuário abre o domínio oficial do app.
2. Se o app já tem sessão local válida, continua normalmente.
3. Se não tem sessão local/handoff válido, o app redireciona para o `hubLaunchPath` em `https://www.millionsnest.com`.
4. O Hub reaproveita a sessão Firebase/Google já existente. Se não houver sessão, mostra o login e retorna ao mesmo launch path depois de autenticar.
5. O Hub revalida identidade, organização ativa, membership/RBAC/entitlement no servidor.
6. O Hub emite somente um handoff curto e específico para o app.
7. O app consome o handoff, estabelece sua sessão Firebase local e remove o segredo da URL/histórico assim que possível.
8. Negativas de autorização falham fechadas. Não criar loop de redirect e não confiar em `localStorage`, parâmetros ou role enviados pelo browser como autoridade.

## Como criar o domínio oficial de um app no Firebase Hosting

Use esta sequência para qualquer entrada marcada `planned` ou `repo_missing` no manifesto:

1. Confirme o repositório canônico e a branch de produção do app. Se o manifesto estiver com `repository: null`, crie/defina o repositório antes de continuar.
2. Confirme que o app possui `firebase.json` e `.firebaserc` apontando para o projeto/site corretos. Não reutilize por engano o site de outro produto.
3. Faça um deploy técnico inicial para o site Firebase Hosting e valide a origem `*.web.app` apenas como infraestrutura.
4. No Firebase Console, abra **Hosting → Add custom domain** no site correto.
5. Informe exatamente o domínio definido no manifesto, por exemplo `nestfinance.millionsnest.com`.
6. O Firebase mostrará os registros DNS necessários. Copie os valores que o Firebase gerar. Não copie registros de outro app e não hard-code IP/CNAME neste repositório, porque o valor pode mudar por site/configuração.
7. No provedor DNS de `millionsnest.com`, crie os registros TXT/A/AAAA/CNAME exatamente como o Firebase solicitar. Se houver registro conflitante para o mesmo host, revise antes de remover.
8. Volte ao Firebase e aguarde **ownership verified**, domínio conectado e certificado SSL provisionado.
9. Teste `https://<app>.millionsnest.com` em navegação privada e em mobile. Deve responder com HTTPS válido sem redirecionar para `web.app` como endereço final.
10. Em **Firebase Authentication → Settings → Authorized domains**, confirme o domínio oficial quando o fluxo de autenticação desse app exigir autorização direta de origem.
11. Atualize o manifesto: `domainStatus: 'live'` somente depois de DNS + TLS + Hosting estarem realmente funcionais.
12. Implemente/certifique o bridge SSO descrito abaixo antes de mudar `ssoStatus` para `live`.

## Como habilitar o SSO direto

1. Reserve um `hubLaunchPath` único, por exemplo `/nestfinance/launch`.
2. O login do Hub deve allowlistar esse caminho exato. Nunca aceitar um `next` arbitrário ou URL externa.
3. O launch page usa a sessão central e resolve a organização ativa canônica.
4. O backend do Hub revalida autorização e emite handoff específico para o app.
5. O app precisa ter uma rota/bootloader capaz de consumir esse handoff.
6. A entrada direta sem sessão no app redireciona para `https://www.millionsnest.com/<app>/launch`.
7. O app deve detectar handoff inválido/expirado sem entrar em redirect infinito.
8. Testes mínimos: usuário já logado no Hub; usuário deslogado que faz login Google e retorna; organização sem acesso; handoff expirado; usuário global permitido; usuário comum sem entitlement; mobile Safari; refresh depois da sessão local criada.
9. Somente depois de CI + smoke de produção + teste autenticado real, marque `ssoStatus: 'live'` e libere o app no catálogo.

## Estado desejado atual

| App | Domínio oficial | Domínio | SSO | Ação |
| --- | --- | --- | --- | --- |
| Hub | `www.millionsnest.com` | live | live | autoridade central |
| MusicScale | `musicscale.millionsnest.com` | live | live | manter bridge direto + handoff canônico |
| Connect | `connect.millionsnest.com` | live | live | certificado |
| NestFinance | `nestfinance.millionsnest.com` | planned | consumer_ready | conectar domínio e criar issuer/launch no Hub; consumidor `/auth/handoff` já existe |
| NestJourney | `nestjourney.millionsnest.com` | planned | planned | revisar integração pausada, certificar Hosting e SSO antes de ativar |
| NestLocal | `nestlocal.millionsnest.com` | repo_missing | planned | criar/definir repo canônico, depois Hosting + domínio + SSO |

## Critério de conclusão

Um app só é considerado “igual ao padrão Connect” quando: domínio oficial HTTPS está live; catálogo aponta para domínio oficial; entrada direta reaproveita a sessão do Hub; autorização é revalidada server-side; handoff é curto/específico; fluxo deslogado volta ao app após login; testes e smoke de produção estão verdes; nenhum endereço técnico `web.app` aparece como URL oficial do produto.
