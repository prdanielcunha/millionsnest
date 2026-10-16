# NestJourney → MillionsNest Connect: publicação segura de followup.due

## Autoridade
O backend **Hub** continua sendo a fonte de identidade e autorização: a rota autenticada `GET /api/ecosystem/connect/nestjourney/followup-context` já verifica Firebase token, acesso canônico ao NestJourney, igreja e congregação, capacidade de cuidado, responsável designado (não basta ser CEO/pastor), solicitação ativa, consentimento explícito para WhatsApp não revogado e contato válido. Esta mudança adiciona um **callback opcional depois de todas as verificações**, sem expor nome, número, notas, ID de pessoa ou care request à ponte de eventos.

O callback só dispara se `dueAt` já venceu e está dentro da janela de sete dias suportada pela API do Connect. Não é chamada de marketing, template Meta ou mensagem para visitante. É um evento interno opaco de operador `followup.due` com `schemaVersion:1`, origem `nestjourney`, organização, ID SHA256 determinístico, thread canônica, timestamp de vencimento e destinatário operador autorizado em configuração server-side. O hub assina HMAC-SHA256 da origem + milissegundos + corpo exato. O Connect verifica novamente tenant, assinatura, thread e operador e deduplica pelo ID estável.

## Ativação fail-closed
Servidor Hub **desligado por padrão**. Requer `NESTJOURNEY_CONNECT_FOLLOWUP_EVENTS_ENABLED=true`, `NESTJOURNEY_CONNECT_SOURCE_EVENT_SECRET` (32+ caracteres, específico para origem nestjourney) e `NESTJOURNEY_CONNECT_OPERATOR_TARGETS_JSON` (mapa aprovado de organização para `{conversationId,recipientUid}` da Inbox Connect). Nunca derivar o destinatário de headers, usuário do browser, contato pastoral ou número do WhatsApp. Sem configuração completa, não há POST.

O contexto manual continua retornando mesmo se a fila/evento estiver indisponível. Ambiguidades não provocam retentativas em loop; no máximo um POST no evento de leitura autorizado. O mesmo ID permite posterior replay idempotente, sujeito aos gates de consentimento, antes de qualquer envio externo.

## Revalidação imediatamente antes da assinatura (2026-10-16)
O publisher passou a **exigir** uma função de revalidação do Hub antes de criar o corpo HMAC; sem função, com erro ou com negação, retorna `not_authorized` e **não executa HTTP**. `verifyCurrentNestJourneyDueAuthority` reconsulta o Firestore canônico para confirmar organização e produto ativos, membership e capacidade de cuidado, congregação, responsável ainda designado, data de vencimento original, solicitação de cuidado aberta, pessoa vinculada, consentimento explícito não revogado e WhatsApp como canal preferido. Também nega um cuidado encerrado, reatribuído ou reagendado desde o GET. Isso reduz a janela de consentimento obsoleto sem alterar o contexto manual ou introduzir novos dados pessoais na mensagem.

**Limite**: é uma checagem de origem *antes de enfileirar o evento interno*, não prova de revalidação quando uma fila demorada eventualmente tentar notificar um dispositivo; essa última verificação e uma trilha durável continuam pendentes na #226.

## Limitações e pendências até a certificação #226
- Este incremento é **publisher backend protegido, oportunístico**; não há ainda outbox transacional de `followup.due`, scanner periódico sobre fatos oficiais, worker de recovery, entrega real via Meta ou aceitação de iPhone físico. Uma requisição GET não é garantia de recuperação autônoma.
- Qualquer automação baseada em prazos precisa de recuperação independente, validação de consentimento **no momento do envio** e rechecagem de proprietário/atividade em caso de adiamento/revogação. Não ativar este produtor até o desenho e testes operacionais serem finalizados.
- Não colocar HMAC no Vite/NestJourney PWA, não executar varreduras globais de notas privadas e não alterar Rules, IAM, contatos, billing ou RBAC. A responsabilidade do ato de contatar alguém continua humana.

## Teste
`npx tsx scripts/test_connect_nestjourney_followup.ts`, `npm run lint`, `npm run build` e workflow completo do Hub. Os testes cobrem negação por consentimento revogado, dono errado, prazo futuro/expirado, assinatura, redaction, idempotência e falha de rede. Não equivalem a aceitação de Meta ou dispositivo.
