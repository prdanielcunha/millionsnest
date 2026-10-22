# MillionsNest — avaliação padrão de sete dias (2026-10-15)

## Regra comercial

Todo aplicativo com assinatura usa sete dias corridos (168 horas) de avaliação interna sem cartão. O relógio começa na ativação autorizada pelo Hub. O Stripe recebe contratações pagas explícitas, sem nova avaliação. Não há cobrança automática pelo simples fim da avaliação.

A constante `src/lib/ecosystemTrialPolicy.ts` é o padrão para produtos atuais e futuros. O catálogo recorrente atualmente implementado no Hub contém MusicScale e NestLocal. NestFinance, NestJourney e Connect não ganham checkout ou liberação comercial fictícia: devem adotar esta política ao integrar sua venda central. Nenhuma flag comercial é ativada implicitamente por uma constante.

## Compatibilidade e impacto

- Novos grants MusicScale: versão 3, sete dias, sem criar cliente ou assinatura Stripe.
- Grants MusicScale versão 2 de 14 dias: preservam `beginsAt`, `expiresAt` e eventual extensão. Não executar migração, encurtamento nem reiniciar o relógio.
- NestLocal mantém sete dias, versão 2 e o outbox de créditos existente. Não recriar créditos nem alterar planos.
- Assinaturas ativas, trials Stripe antigos, inadimplência, cancelamentos e histórico continuam no fluxo canônico existente. Nenhuma atualização em massa de contas, membros, funções, músicas, escalas, preços ou contratos.
- A assinatura paga prevalece sobre um grant vencido. Não converter o assinante para avaliação nem excluir documentos ao vencer.
- O período residual de uma contratação anterior já paga é preservado pelo mecanismo existente `trial_end` do Stripe. Não é uma nova avaliação gratuita.
- Os dois checkouts usam idempotência versão 3 para não reutilizar respostas de sessões criadas com a política anterior. Sessões já abertas no Stripe não são canceladas ou alteradas automaticamente.
- Avaliação e extensão continuam limitadas por titular/organização, com autorização no servidor. Uma única extensão administrativa de até sete dias continua disponível e auditada.
- Após vencer, manter os comportamentos existentes de cada produto. Não ampliar acesso, permissões ou limites de IA.

## Ordem de publicação

1. Certificar leitores/Rules do MusicScale e Hub aceitando sete dias e legados de 14 dias.
2. Publicar MusicScale compatível e regras compartilhadas pelo pipeline canônico do Hub.
3. Publicar emissor Hub de sete dias e checkout sem novo trial Stripe após os leitores estarem prontos.
4. Conferir QA, deploy e inventário agregado somente leitura. Preservar as flags já configuradas; ativar oferta pública apenas com leitores/Rules certificados.

O deploy Hub cria a revisão sem tráfego. Quando o commit altera Rules, o tráfego só é promovido após o workflow canônico de Rules do mesmo SHA concluir com sucesso; falha ou timeout preserva a revisão anterior. Isso impede emitir grants novos antes da publicação das regras compatíveis.

## Verificação

`test_ecosystem_seven_day_trial.ts` cobre duração, criação/repetição/vencimento, extensão, prevenção de avaliação no Stripe em todos os apps, idempotência dos checkouts e zero writes em contas pagas/legadas. Os testes existentes verificam resolução de assinatura, handoff, RBAC, contas inativas e isolamento por organização. As suítes Firestore de ambos os repositórios verificam sete dias, compatibilidade de 14 dias, prazo adulterado, cliente pago e tentativa de outro tenant.

O relato de que não existem trials internos ainda não substitui uma consulta ao banco de produção. A implementação é compatível com eles mesmo se o inventário encontrar algum.

## Entrada pública corrigida em 2026-10-22

A oferta MusicScale abre `/trial`, independente do plano de preço consultado. Cadastro retorna a esse destino interno fixo, sem Checkout. Ativação expressa usa a API canônica existente, confirma titular/histórico, concede Pro por 168h e lança o produto via handoff autorizado. A projeção inclui plano e features Pro para os leitores de IA, sem criar assinatura Stripe. Descoberta informa grant ativo e considera histórico do titular; retries não reiniciam o prazo. Clientes pagos/legados não recebem writes.

Importações da Biblioteca Viva mantêm o limite já existente de 20 por avaliação no backend MusicScale. Consultas assistidas do gateway Live AI têm 10 execuções por avaliação, em bucket transacional independente do mês; cache não cobra nova execução e os orçamentos pagos permanecem intactos. Outros recursos de IA mantêm suas cotas/controles existentes. Não prometer IA ilimitada.

URLs antigas de Checkout levam novos clientes elegíveis à avaliação. `intent=paid` identifica contratação paga expressa; a conversão continua sem segundo trial. Falha da oferta/ativação mostra retry sem iniciar pagamento. A publicação usa os workflows atuais Firebase Hosting/Cloud Run, preservando Cloudflare/DNS. O workflow Cloud Run habilita somente as duas flags públicas MusicScale; NestLocal permanece com seu rollout existente.

Validação adicional: `test_trial_first_acquisition.ts` e `test_musicscale_live_ai_gateway.ts` (limite durante virada de mês e conversão para orçamento pago).

As dez consultas IA da avaliação usam o mesmo contador transacional `organizations/{orgId}/musicscaleLiveAiUsage/trial` no gateway Hub e no proxy MusicScale, depois da autorização canônica. As Rules impedem reset de `trial_usage` e `musicscaleLiveAiUsage` pelo SDK do navegador. O contador de biblioteca continua separado; esgotar IA não bloqueia o restante do teste. Solicitações reservadas contam mesmo se o provedor falhar, protegendo o custo.
