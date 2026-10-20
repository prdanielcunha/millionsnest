# Organização: revisão e exclusão seletiva

Status: **publicado em produção**. PR #442 integrada em `main`; PR #445 reforçou a prova de titularidade; PR #444 integrada em `production`, commit `e5cdcf54df6394c57a309ad7a65867740d235d48`. Cloud Run e Firebase Hosting publicados e testados no [workflow #39361868823](https://github.com/prdanielcunha/millionsnest/actions/runs/39361868823), com SHA servido confirmado, smoke de produção e auditoria do MusicScale antes/depois do deploy. Nenhuma exclusão real foi executada no release. Navegação autenticada em aparelho e execução destrutiva real com dados de cliente não foram simuladas.

## Tela administrativa

MillionsNest → Administração do Ecossistema → Organizações → Limpeza segura do banco.

A análise retorna todas as organizações elegíveis ao escopo do administrador, com estado:
- Protegida: nome reservado ou ID protegido (não permitir seleção).
- Com assinatura/histórico de billing: não permitir seleção, inclusive assinaturas canceladas.
- Em uso: membros adicionais, convite pendente, documentos de apps, journal, uso, auditoria ou fonte incerta (não permitir seleção).
- Possível teste: nome técnico ou flag/proveniência explícita (`isTest`, `testOrganization`, `metadata.isTest`, `origin=test|seed|fixture|synthetic`). **É apenas um aviso, nunca autorização automática de exclusão.**
- Sem atividade, maior que 14 dias, até um vínculo, sem faturamento, sem histórico ou incertezas: elegível à escolha manual; revalidar no servidor.

Selecionar uma ou até 20 por operação; marcar opcionalmente **Excluir também a conta do dono** para cada organização; digitar `EXCLUIR` e confirmar no modal. O padrão é manter a conta do dono.

## Segurança e consequências

- Nunca executar exclusão automática em lote com nomes pessoais; `--apply` legado desativado.
- API aceita apenas IDs selecionados; não aceitar seleção vazia, duplicada, não elegível, protegida ou paga.
- Reanalisar a organização e a assinatura imediatamente antes de excluir; mudança de status impede remoção.
- Excluir conta do dono somente se autenticação Firebase, dados globais e vínculos no ecossistema estiverem comprovadamente isolados; recusar conta privilegiada, operador atual, assinatura histórica, custom claims, subcoleções desconhecidas, fontes do diretório central em outras organizações ou dados de apps. O processo apaga Auth e documento `users` somente após a organização ser excluída.
- Journal privado em `maintenance_runs` escrito antes de qualquer mutação destrutiva; registro por organização acompanha andamento e falha, sem expor PII. Falhas parciais exigem inspeção e recuperação, não retry cego.
- Nenhum cron ou serviço novo é criado; Firestore atual está sujeito a quotas normais, sem garantia de gasto zero além das franquias.

## Critérios adicionais para implantação

1. Teste de concorrência (novo pagamento, novo membro, nova associação de conta durante a exclusão) e tratamento de falha parcial.
2. Verificar retenção de comprovantes financeiros e obrigações legais/Stripe em todos os apps; qualquer dúvida deve bloquear exclusão definitiva. Não apagar registros fiscais, pagamentos ou históricos sob obrigação de retenção.
3. Executar teste autenticado com organização sintética autorizada, sem dados de clientes, no desktop e no celular.
4. Provar proteção entre organizações, preservação de usuários compartilhados e comportamento de exclusão com e sem dono, assim como nenhum regresso no Hub, MusicScale, NestFinance, NestJourney e Connect.
5. **Concluído:** merge seletivo e deploy exato da versão `e5cdcf54` em Cloud Run/Hosting, com testes automatizados aprovados. O release não excluiu organizações reais. Para qualquer exclusão irreversível, a escolha e confirmação cabem ao administrador autenticado; casos com vínculos ou obrigações de retenção devem ser bloqueados.

