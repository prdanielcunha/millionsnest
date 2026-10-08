# MillionsNest — lançamento coordenado dos trials sem cartão (2026-10-08)

## Regra funcional aprovada
- MusicScale: 14 dias corridos, sem cartão, para novas organizações elegíveis.
- NestLocal: 7 dias corridos, sem cartão, para novas organizações elegíveis.
- Apenas `ceo`, `global_admin`, `ecosystem_owner`, `founder`, `admin` legado e `ecosystem_support` podem conceder **uma única extensão de 1–7 dias** por organização e aplicativo, no painel `/admin/trials`. O suporte não recebe poderes sobre Stripe ou governança.
- O prazo inicial começa na ativação; a extensão acrescenta dias ao prazo original. A operação registra ator, razão, prazo anterior e novo, impedindo segunda extensão e autofornecimento.
- Ao encerrar o prazo efetivo, bloquear criação/edição/IA e solicitar contratação explícita de um plano pago. O usuário não é debitado automaticamente sem cartão.
- Nunca excluir dados por expiração. Assinantes existentes e suas assinaturas Stripe não entram na migração.
- NestAI não ganha novo crédito com extensão; proteção contra novo trial Stripe após avaliação Hub.

## Estados e autoridades
- Hub é a autoridade comercial: `musicscale_internal_trials/{org}`, `nestlocal_internal_trials/{org}`, `*_trial_owners/{uid}`, `hub_trial_extension_events/{app}_{org}`.
- Checkouts Stripe só são criados após escolha explícita do plano. O Hub revalida histórico canônico e de Stripe antes de conceder o trial.
- MusicScale valida o grant no backend `/api/v1/organizations/:orgId/limits`, com plano Pro de demonstração sujeito aos limites de importação; a interface não usa projeção de cache para ressuscitar acesso vencido.
- NestLocal valida grant e extensão server-side; após expiração preserva consultas e direitos de privacidade.
- Acesso global de staff não se converte em acesso comercial indevido ao cliente; as rotas administrativas exigem papel sistêmico verificado no servidor.

## Dependências para ligar em produção
1. Conferir CI completo pós-merge em Hub, MusicScale e NestLocal, inclusive E2E de navegador e Firestore com organizações pagantes.
2. Fazer inventário cruzado read-only de `subscriptions`, `organizations` e clientes/contratos Stripe existentes; guardar resultado antes da promoção.
3. Confirmar checkout **modo teste** desde usuário sem assinatura até pagamento, replay webhook, ativação na mesma organização, histórico sem segundo trial, cancelamento, estorno e reconciliação de cobranças; bloquear rollout se não houver preço test-mode adequado.
4. Promover Hub, MusicScale 0.10.9-beta.12 e NestLocal de `main` para `production`, **com flags OFF**, preservando o hotfix de marketplace NestAffiliate do Hub (produção SHA df59fcd… incorporado em main SHA cf520434…).
5. Após smoke pós-deploy, configurar em MusicScale `MUSICSCALE_HUB_TRIAL_V2_ENABLED=true` e no NestLocal `NESTLOCAL_HUB_ENTITLEMENT_V3_ENABLED=true`, mantendo Hub sem auto-oferta.
6. Fazer canário com IDs REAIS de organização de teste: `MUSICSCALE_INTERNAL_TRIAL_ENABLED=true` + `MUSICSCALE_INTERNAL_TRIAL_PILOT_ORGS=<ids>`; `NESTLOCAL_INTERNAL_TRIAL_ENABLED=true` + `NESTLOCAL_INTERNAL_TRIAL_PILOT_ORGS=<ids>`; `HUB_TRIAL_EXTENSION_ADMIN_ENABLED=true`. Deixar `*_INTERNAL_TRIAL_PUBLIC_ENABLED` desligado até a confirmação.
7. Verificar pessoalmente dashboard de CEO/admin/suporte, membro comum, teste inicial, extensão autorizada, expiração, checkout e restauração imediata após `invoice.paid`. Somente então habilitar `MUSICSCALE_INTERNAL_TRIAL_PUBLIC_ENABLED=true` e `NESTLOCAL_INTERNAL_TRIAL_PUBLIC_ENABLED=true`.
8. Observar erros, pagamentos e Funil primeira escala/orçamento → assinante; plano de rollback é desligar flags de novos trials sem remover grants ativos nem dados.

**Regra fundamental: não ativar Hub público antes de os dois aplicativos reconhecerem grants e expirarem corretamente em produção. Não converter automaticamente trials antigos.**
