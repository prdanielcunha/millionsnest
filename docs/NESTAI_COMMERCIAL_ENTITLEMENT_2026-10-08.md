# Hub → NestAI Commercial Entitlement (2026-10-08)

**Estado:** código em branch de revisão, default desligado. NÃO alterou checkout, produtos, usuários, Stripe ou Firestore produção.

## Flags independentes
- `NESTAI_COMMERCIAL_CREDITS_ENABLED=true`: Hub pode incluir claim comercial **somente para NestLocal**, após autorizar usuário+organização e ler Firestore servidor.
- `NESTLOCAL_INTERNAL_TRIAL_ENABLED=true`: access resolver pode aceitar trial interno sem assinatura Stripe, desde que haja documento **server-issued** e projeção `organizations/{orgId}.apps.nestlocal.status='trialing'`. Sem essa flag, fluxo de assinatura legado permanece obrigatório.

**NUNCA ativar essas flags isoladamente.** NestAI exige também schema D1 + grants e flag própria, e a jornada de trial deve estar 100% certificada.

## Autoridade canônica de um trial
Documento privado: `nestlocal_internal_trials/{organizationId}`

Campos esperados:
```json
{
  "appId": "nestlocal",
  "source": "hub_internal_trial",
  "status": "active",
  "grantVersion": 2,
  "beginsAt": "<Firestore Timestamp>",
  "expiresAt": "<Firestore Timestamp, até 7 dias depois>",
  "revoked": false
}
```
Apenas backend autorizado deve criar de forma **transacional, uma vez por organização** e vincular owner/histórico. Não permitir writes por frontend; validar regras Firestore primeiro. A implementação atual **somente lê** esse documento; criação/onboarding ainda está pendente.

## Entitlement emitido
Hub emite claim ES256 de 300 segundos `aiEntitlement` com `appId=nestlocal`, `accessState`, `canUseAI`, `billingSource`, `grantVersion` e `trialEndsAt` ou `activeUntil` e `plan`.
Nunca assinar os campos fornecidos pelo cliente. Nunca enviar claim de NestLocal em token de MusicScale.

Para clientes pagos, exige projeção `subscriptions/{orgId}.apps.nestlocal.status='active'`, plano conhecido e `currentPeriodEnd` futuro. Stripe `trialing` NÃO é equivalente a cliente pago no novo modelo. A decisão de concessão dos créditos permanece no Hub e exige trabalho adicional.

## Pendências de implementação (bloqueios de produção)
1. Criar on-boarding transacional server-side, anti repetição trial por org/owner, sem cartão e com política de reativação; projetar `apps.nestlocal.status`.
2. Migrar checkout NestLocal do trial Stripe para checkout sem novo trial, mantendo planos legados e MusicScale intactos, com testes de assinaturas ativas/canceladas.
3. Implementar serviço Hub de concessão para `POST /v1/credits/grants` usando token de **serviço interno** com scopes específicos; `sourceRef` persistente por período lógico, não event ID do Stripe.
4. Reconciliar webhook duplicado, upgrade/downgrade, atraso, estorno, chargeback, cancelamento e repagamento sem créditos duplicados.
5. Provar exclusividade de write no documento `nestlocal_internal_trials` nas Firestore Rules/Emulator.
6. Testar E2E Hub → NestAI (JWT, expiry, cross-tenant, role) antes de flags.
7. Resolver divergência comercial: `pricingCatalog.ts` atual Essencial R$79,00, nova proposta Essencial R$59,90 (Founders R$49,90), sem mudar preços existentes unilateralmente.
8. Sem alteração para MusicScale, NestFinance e demais apps.

O NestAI não concede trial nem altera Stripe. O Hub continua a autoridade.
