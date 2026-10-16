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

## Outbox durável e revalidação pós-fila implementados em 16 de outubro
A limitação de callback oportunístico é substituída por descoberta independente dos followups canônicos pendentes em cada organização aprovada. Cursor persistente avança além de prazos futuros/itens bloqueados; um novo processo retoma a página e há wrap limitado. `stageNestJourneyDue` verifica consentimento, cuidador, organização, congregação e solicitação na mesma transação que cria o marcador em `products/raiz_e_mesa/connectDueOutbox/{eventHash}`. Esse namespace é privado por deny-by-default já existente no Hub e é coberto pelo gate de Rules (sem mudança de Rules).

O worker adquire lease transacional, revalida toda a autoridade imediatamente antes da assinatura e cancela o marcador se o consentimento, prazo ou responsável mudar. Mantém event ID estável após interrupções/ACK ambíguo, backoff e três tentativas até revisão. Nenhum telefone/nome/nota pastoral vai ao Connect. Só a coleção privada de outbox e seus cursores são escritos; nenhum followup, pessoa, solicitação ou auditoria de domínio é modificado.

A rota machine-only `POST /api/ecosystem/connect/nestjourney/event-authority` exige HMAC específico de origem, domínio separado `nestjourney-authority`, timestamp de cinco minutos e corpo máximo de 4 KB. Um evento já enfileirado só recebe `{authorized:true}` se corresponder ao marcador, destino atualmente aprovado e verificação atual de todas as fontes. Nenhum dado pastoral é devolvido. Ausência de configuração, fonte desligada, erro, revogação, encerramento ou reassignment negam a entrega. O consumidor Connect deve consultar essa prova na execução e imediatamente antes do transporte; esse é um PR separado, obrigatório antes da ativação.

O contêiner inclui `dist/journey-recovery.mjs`. Cron main solicita workflow production-only WIF; somente a configuração de origem instalada na revisão Ready com 100% de tráfego pode ser usada no job IAM autenticado e fixado pelo digest. HMAC precisa estar no Secret Manager. OFF termina sem criar/executar job; não há alteração de IAM, secrets, Rules, billing ou Meta. GitHub cron é best effort. Testes sintéticos e default-OFF não certificam recuperação live nem entrega Meta/iPhone. Continuam pendentes configuração aprovada, publicação protegida e provas reais da #226.
