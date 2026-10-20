# Cadastro Central de Pessoas — checkpoint de produção

**Atualizado em 20/10/2026 (horário UTC dos workflows). Status: migração inicial executada e comprovada; manifesto desarmado.**

## Provas concretas

- **Hub**: runtime de base `5fb11db71f57550e9c32617a5da13ecf2bcfd45a`, comprovado servindo no Cloud Run no run [39324830017](https://github.com/prdanielcunha/millionsnest/actions/runs/39324830017).
- **Firestore Rules**: hash SHA-256 publicado `5372febb59a285e40a567d6caaf5b35ac9ed97f23646e0ffe93959a6bf55f8cd` (run [39324830021](https://github.com/prdanielcunha/millionsnest/actions/runs/39324830021)); criação direta de pessoas Journey via SDK negada, gateway autorizado continua disponível.
- **Pré-verificação IAM/journal**: PR [#433](https://github.com/prdanielcunha/millionsnest/pull/433), run [39351854371](https://github.com/prdanielcunha/millionsnest/actions/runs/39351854371) **SUCCESS**: 5/5 permissões necessárias na identidade WIF; nenhum journal ou registro de recuperação da tentativa falha anterior; `freeQuotaHeadroom=true`.
- **Migração inicial**: PR [#434](https://github.com/prdanielcunha/millionsnest/pull/434), commit `88365d3941ba7cb4b0ca4f16a334ffb82ad10f2b`, workflow [39352400920](https://github.com/prdanielcunha/millionsnest/actions/runs/39352400920) **SUCCESS**, marcador `PEOPLE_DIRECTORY_PRODUCTION_RECONCILED`. 26 organizações elegíveis processadas, 18 ignoradas pelos critérios, 36 fontes de contas/vínculos projetadas como 36 identidades, nenhuma fonte histórica Journey presente, 0 fusões automáticas, 0 fontes originais excluídas e 0 grupos de nomes potenciais duplicados reportados.
- **Journal de conclusão**: PR [#435](https://github.com/prdanielcunha/millionsnest/pull/435), commit `f79fe28e91549660cfca6ff0effc16f5e79a90eb`, workflow [39353315373](https://github.com/prdanielcunha/millionsnest/actions/runs/39353315373) **SUCCESS**: `completionJournalStatus=completed`, `sourcesAtApply=36`, `identitiesAtApply=36`, `organizationRecoveries=26`, `completedRecoveries=26`. Check privado por WIF; nenhum dado pessoal exibido.
- **Manifesto de produção** `ops/people-directory-activation.json`: voltou a `mode=plan`, `planRevision=5`; nenhuma nova execução automática da migração escreve dados.
- **NestJourney**: PR [#135](https://github.com/prdanielcunha/nestjourney/pull/135) integrada, commit `f77b4e8a3e4b39f5490de7a3cad610f7b3c2b1c8`. QA, WIF e Firebase Hosting run [39352580691](https://github.com/prdanielcunha/nestjourney/actions/runs/39352580691) **SUCCESS**. O deploy validou SHA exato no domínio custom `nestjourney.millionsnest.com` e em `mn-nestjourney-555464791734.web.app`.

## Modelo preservado

Identidades são por organização, independentes do login. Cada app/igreja preserva participações e permissões próprias. Cadastro manual não exige e-mail fictício, documento nem criação de conta. Homônimos e telefones são apenas pistas de possível duplicidade: sem merges automáticos. Links são auditáveis e reversíveis. Histórico, consentimentos, acessos, funções e dados originais não são movidos nem excluídos na reconciliação. O backend valida autorização local e escopo antes de mutações; nenhuma função global de SaaS, isoladamente, autoriza leitura do diretório.

No Hub: **Organização → Membros & Convites → cadastro central**. Novo Journey usa exclusivamente o gateway central ao cadastrar membros, visitantes ou importar fichas; fluxo antigo de criação direta do SDK é negado.

Limites conservadores: até 6.000 fontes de cada tipo por organização no scanner legado, importação atômica de até 75 membros, limites de preflight de 200 organizações / 2.000 fontes iniciais. A melhoria futura sugerida é índice transacional incremental nos writers legados; não ativar triggers ou cron pagos.

## Ação operacional remanescente: revogar papel temporário

O administrador concedeu temporariamente à conta `mn-web-deployer@millionsnest.iam.gserviceaccount.com` um papel personalizado para permitir a sincronização aditiva. **Agora que a migração e o journal foram certificados, é preciso REMOVER APENAS esse papel de migração da conta de serviço no IAM do projeto MillionsNest.** Não apagar a conta, não excluir o papel personalizado caso esteja em uso por outros principais e não remover seus quatro papéis operacionais existentes (Cloud Run, índice, Firestore Rules, Hosting).

Após revogação, a conta ficará sem a autorização de escrita de migração; a verificação `mode=plan` aceita esse estado por design. Não é necessário repetir o apply.

## Limites da certificação

O build, o smoke sintético de API sem login, as Rules e os testes de fluxos locais passaram nos respectivos runs. **Não houve navegação autenticada com uma conta de usuário real no Hub/Journey em diferentes aparelhos** nesta execução; não confundir isso com o sucesso comprovado do apply. A remoção do papel IAM temporário também depende do administrador e ainda precisa de confirmação. Essas duas ações são as únicas pendências de fechamento operacional não comprovadas por esta trilha.

Os branches `main` e `production` do Hub têm histórico de divergência legítima de outros recursos; não forçar merge total/reset para “sincronizar”. Mudanças de cadastro central necessárias para main devem ser reconciliadas por PR separada com revisão de diferenças e QA.

## Referências históricas

- Tentativa anterior falha [39325845934](https://github.com/prdanielcunha/millionsnest/actions/runs/39325845934): primeiro write do journal recusado por `PERMISSION_DENIED`; não houve migração nessa tentativa. Corrigido pela concessão IAM explícita do administrador.
- [docs/CENTRAL_PEOPLE_DIRECTORY.md](CENTRAL_PEOPLE_DIRECTORY.md): arquitetura, autorização, concorrência, privacidade, custo e recuperação.
- [Issue #432](https://github.com/prdanielcunha/millionsnest/issues/432): registro da autorização e migração.
