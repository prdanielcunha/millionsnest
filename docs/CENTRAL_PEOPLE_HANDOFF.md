# Continuidade — Cadastro central de pessoas

Atualizado em 19/10/2026. Este é o checkpoint atual: código publicado, mas a
sincronização inicial NÃO foi concluída. Não confundir merge, deploy, plano e apply.

## Bloqueio que exige decisão do administrador

A ativação PR430 foi merged em production:
1efb6939e7ed5525d9eed7378811df6928a3c752.
O workflow Central People Directory Reconciliation run39325845934,
job118311360040, terminou com PERMISSION_DENIED na primeira escrita Firestore
(WriteBatch.commit). No script, a primeira escrita é o journal privado de recuperação,
ANTES do laço que sincroniza organizações e cria marcadores. Não há marcador
PEOPLE_DIRECTORY_PRODUCTION_RECONCILED. Não afirmar que as36 fontes foram migradas.

A autenticação WIF e as consultas somente leitura funcionaram. A identidade usada
é mn-web-deployer@millionsnest.iam.gserviceaccount.com. Nenhum privilégio foi ampliado,
nenhuma nova credencial foi extraída, nenhum serviço/plano pago foi criado.
É necessário um administrador resolver a autorização de escrita do processo de
migração, com privilégio mínimo, ou executá-lo por um fluxo autorizado já existente.
Não contornar este bloqueio usando credenciais de outra identidade sem autorização.

O manifesto foi devolvido a mode=plan para não manter uma ativação de escrita armada.
Essa alteração apenas desarma futuras execuções; não é uma migração nem um rollback.
Não reexecutar apply cegamente. Antes de nova tentativa, conferir o journal privado
people_directory_releases/1efb6939e7ed5525d9eed7378811df6928a3c752 e a autoridade,
sem publicar seu conteúdo ou dados pessoais.

## Evidência de produção

- Hub runtime: 5fb11db71f57550e9c32617a5da13ecf2bcfd45a.
  Cloud Run run39324830017/job118307819051 SUCCESS:
  HUB_EXACT_SERVING_IMAGE_SHA_OK, revisão millionsnest-api-r39324830017,
  MUSICSCALE_AGGREGATE_INTEGRITY_UNCHANGED e MILLIONSNEST_PRODUCTION_RELEASE_OK.
- Rules: run39324830021/job118307818773 SUCCESS, hash publicado
  5372febb59a285e40a567d6caaf5b35ac9ed97f23646e0ffe93959a6bf55f8cd.
  Criação direta de People via SDK negada em todas as organizações, inclusive futuras;
  atualizações autorizadas continuam. O gateway Admin SDK não depende dessas Rules.
- Journey publicado: ab7954efc4eb6d8d568c5e7a0d2122bbe069ad3e.
  Hosting run39323130988/job118302012751 SUCCESS; release exato comprovado.
  Esse cliente já cria membros, visitantes e importações exclusivamente pelo gateway.
- Interface central comprovada nos bundles públicos do Hub e Journey; API central
  sem autenticação devolveu401. Não foi realizado login sintético em produção.
- Menu Hub: Organização → Membros & Convites → cadastro central.
- Funcionalidade integrada à main: Hub PR427/429, Journey PR134/136/137.
  Main Journey inclui o aviso dentro do modal (PR137 merge7624f3f2216c907ad82af022c37474520e880eec).
- Journey PR135 permanece ABERTA com CI Quality verde, head
  b0a02bedc199ce50084cec21e40fc8e9d378e99c.
  Ela atualiza o pin de build para as Rules5372 e mostra erro de duplicidade dentro
  do modal. Foi mantida sem merge para preservar o release exato exigido no apply.
  Depois de resolver a migração, publicar135 e verificar o novo Hosting.

## Inventário real — não são36 pessoas globais distintas

O plano ampliado run39323685681 e o apply bloqueado concordaram:
26 organizações elegíveis,18 ignoradas e36 fontes de contas/vínculos por organização.
ZERO fontes Journey em TODAS44 organizações, inclusive as ignoradas.
Não foram encontrados perfis históricos de Lucas para unir nessa base.
Não houve fusão automática nem exclusão de registros originais.

Preflight do apply:15542 leituras/1890 escritas nas24h;94158199 bytes;
freeQuotaHeadroom=true. Isso é evidência observada, não garantia de cobrança zero.

## Modelo implementado e limites

Uma pessoa canônica por organização, separada da conta de login; igrejas e aplicativos
mantêm participações/permissões próprias. Cadastro manual não exige e-mail fictício,
CPF ou conta. Nomes/telefones são pistas, nunca prova para mesclar. Vínculos e
desvínculos exigem revisão, são auditados/reversíveis e não movem histórico ou acesso.
Duas contas de login distintas não são fundidas por esta funcionalidade.

Concorrência usa transações, locks e recibos idempotentes. Fontes são revalidadas
na transação final. O cliente reutiliza participação existente sem resetar visitas,
consentimento ou tarefas. Diretório privado, papéis locais e escopo de igreja são
verificados pelo servidor; papel global sozinho não autoriza acesso.

A versão atual faz leitura linear por fonte para compatibilidade com writers legados:
até6000 registros/tipo/organização; importação de até75 membros. Limites e recuperação
em docs/CENTRAL_PEOPLE_DIRECTORY.md. Não adicionar cron/trigger pago como atalho.
Próxima otimização técnica: índices incrementais transacionais em todos os writers.

Testes: Hub44 Rules + testes centrais (concorrência/replay/alteração de fonte),
114 adulterações de autoridade negadas; Journey183 testes e78 Rules;
main preserva diferenças preexistentes. Builds/types/CI verdes e revisão
independente de segurança aprovada. Nenhum dado pessoal foi incluído neste documento.

## Passos restantes, em ordem

1. Resolver a autorização Firestore com o administrador. Não ampliar IAM/plano ou
   buscar outra credencial sem nova autorização explícita.
2. Revalidar plano completo, journal e métricas de franquia; conferir Hub, Journey
   e Rules realmente servidos. Se mudou qualquer release, atualizar os SHAs.
3. PR pequena muda mode de plan para apply com os valores publicados exatos.
   O push em production dispara o workflow WIF existente. Não solicitar OAuth CLI.
4. Exigir SUCCESS e PEOPLE_DIRECTORY_PRODUCTION_RECONCILED; registrar contagens reais
   e journal completed. Falha parcial exige diagnóstico, não apagar diretório/fontes.
5. Publicar Journey135, verificar release nos domínios custom e web.app.
6. Desarmar manifesto para plan, atualizar este documento com resultados e remover
   o status de pendência apenas quando comprovado. Não declarar sincronização antes.

## Continuidade em um chat comum

Repositórios: https://github.com/prdanielcunha/millionsnest e
https://github.com/prdanielcunha/nestjourney.
Ler este arquivo, docs/CENTRAL_PEOPLE_DIRECTORY.md, PR430 e seu workflow de apply.
Tudo necessário de código está no GitHub, não depende do workspace temporário.
Um chat conectado ao GitHub pode inspecionar PRs/workflows e continuar pelo fluxo
autorizado. Sem ferramentas de escrita/execução, deve dizer que não pode publicar.
Nunca solicitar tokens, códigos OAuth, chaves de service account ou senhas no chat.
