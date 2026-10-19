# Continuidade — Cadastro central de pessoas

Atualizado em 19/10/2026. Leia este arquivo e as alterações mais recentes no GitHub
antes de executar. Não confundir merge com publicação ou plano com migração aplicada.

## Objetivo e autorização

Daniel autorizou implementação reversível até produção, sem serviços/planos pagos,
preservando cadastros e permissões dos demais aplicativos. Uma pessoa por organização,
participações por igreja e aplicativo, sem e-mail fictício ou fusão pelo nome/telefone.
O diretório admite pessoas sem login. Duplicidades históricas precisam de verificação
explícita; links/desvínculos são auditados e reversíveis.

## Implementação já aprovada

- Hub PR425: https://github.com/prdanielcunha/millionsnest/pull/425
  Merge em production: 218cb84c271a49f7ba3569438b843ae3068aad2b.
  Quinze workflows da PR passaram; revisão independente de segurança aprovada.
- Journey PR133: https://github.com/prdanielcunha/nestjourney/pull/133
  Head aprovado: a8ad696e4b7e51d96817963db263c7a9fd63acc4.
  Quality aprovada; aguarda Hub e Rules efetivamente publicados antes de merge.
- Hash das Rules canônicas que Journey exige:
  cdf3bffa148811de97600fd646ea4fd2331b08c9b7da594d03c680f542c5bf05.
- Testes locais: Journey183 testes +78 Rules; Hub44 Rules Journey; testes centrais
  de concorrência, replay, homônimos, aliases, consentimento e mudança concorrente
  da fonte;114 tentativas de adulteração de autoridade negadas; types/build.

## Publicação em andamento no momento deste checkpoint

Hub Cloud Run: run39322376256. Rules: run39322376345.
Não afirmar conclusão sem ler jobs/logs atuais e comprovar o SHA atendendo tráfego.
O pipeline Hub espera as Rules e preserva uma revisão de recuperação.
O pipeline Journey verifica hash canônico, release exato nos dois domínios e rollback.

Primeiro plano somente leitura: run39322376790, job118299410967.
Resultado:26 organizações elegíveis,18 ignoradas,36 fontes de contas e0 Journey
nas elegíveis. Uso observado:14144 leituras/1773 escritas nas24h,94158199 bytes;
freeQuotaHeadroom=true. Isso não é teto nem promessa sobre cobrança futura.

IMPORTANTE: revisar o plano ampliado antes de ativar. Ele conta Journey em TODAS as
organizações antes de descartar, relata fontes ignoradas e usa somente administrador
LOCAL preexistente/ativo quando o proprietário original não é utilizável. Nunca cria
permissão nem usa papel global. Se houver fonte Journey em organização ativa sem ator
local válido, apply para. O delta recebeu revisão independente.

## Sequência restante

1. Verificar Hub production218cb84: Cloud Run image SHA, revisão pronta100% tráfego,
   Hosting e Rules publicadas com hash acima. Jobs com falha exigem diagnóstico;
   não burlar os gates. Não solicitar novo login CLI: WIF existente já funciona.
2. Publicar PR133 somente após o passo1. Ler workflow Hosting e comprobar releaseSha
   em https://nestjourney.millionsnest.com/connect-release.json e no domínio web.app.
3. Executar/revisar plano ampliado de scripts/reconcile_people_directory.ts usando
   workflow people-directory-reconcile.yml. Confirmar contagens completas e margem.
4. Somente então editar ops/people-directory-activation.json via PR para mode=apply,
   schemaVersion=1, hubReleaseSha e journeyReleaseSha dos MERGES realmente publicados,
   rulesSha256 exato acima. O push desse arquivo em production dispara reconciliação.
5. Inspecionar logs agregados: PEOPLE_DIRECTORY_PRODUCTION_RECONCILED, contagens de
   identidades/políticas/candidatos. O script verifica deployments e cria journal
   privado ANTES da política. Nenhum registro original ou fato é apagado/mesclado.
6. Comprovar produção; conferir fontes ignoradas antes de declarar cobertura completa.
   Não unir os vários Lucas por nome; permitir revisão pela tela do diretório.
7. Sincronizar a funcionalidade com main em ambos repositórios por PRs pequenas,
   sem mesclar/reescrever mudanças divergentes de outras funcionalidades. Existem
   patches preparados nos worktrees hub-main e journey-main; testar antes de publicar.
8. Atualizar este handoff com resultados finais e SHAs. Relatar somente o que foi
   comprovado ao usuário, com caminho da tela Hub Organização → Membros & Convites.

## Operação, custo e recuperação

- Infra existente: Firebase millionsnest, DB Standard/default nam5; Hub Cloud Run
  millionsnest-api/us-central1; Hosting Journey mn-nestjourney-555464791734.
- Autenticação de deploy: workflows existentes usam Google WIF. Não copiar tokens,
  códigos OAuth do chat, service-account keys ou credenciais para código/logs.
- Apply exige margem conservadora na franquia em métricas existentes. Ausência de
  dados/permissão ou margem insuficiente bloqueia; não ampliar IAM ou plano pago.
- Sem trigger pago/cron/novo banco. Reconciliação é aditiva; registro verifica fontes
  transacionalmente até6000 por tipo/tenant. Limite e custo linear documentados em
  docs/CENTRAL_PEOPLE_DIRECTORY.md; não prometer consumo zero acima das franquias.
- Policies de rollout: people_directory_policies/{orgId}, servidor apenas. Não ativar
  antes do novo cliente Journey. Journal: people_directory_releases/{releaseCommit}.
- Em regressão: recuperar releases anteriores e SOMENTE policies introduzidas pelo
  release usando o journal. Preservar diretório/auditoria e todas as fontes/históricos.

## Para um chat comum

O código e esta continuidade estão no GitHub, não dependem do workspace temporário.
Um chat com acesso conectado ao GitHub pode conferir PRs/workflows e prosseguir pelos
pipelines já autenticados. Se não dispuser de ferramentas de escrita/execução, deve
informar essa limitação; não fingir deploy ou solicitar compartilhamento de segredos.
