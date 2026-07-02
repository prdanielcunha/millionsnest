# AI Change Protocol

Este protocolo é obrigatório para qualquer Inteligência Artificial (Google AI Studio, ChatGPT, Codex, etc.) que for analisar, sugerir, revisar ou modificar este repositório. O objetivo é evitar regressões silenciosas, quebras arquiteturais, violações de escopo e desconfigurações multi-tenant.

---

## PARTE A — ANTES DE ALTERAR

- Ler `AGENTS.md`.
- Ler `/docs/ARCHITECTURE_CURRENT.md`.
- Identificar o pedido exato.
- Definir o que está dentro e fora do escopo.
- Localizar os arquivos relacionados.
- Localizar dependências diretas e indiretas.
- Verificar riscos de multi-tenant.
- Verificar riscos de RBAC.
- Verificar riscos de backend e Firestore Rules.
- Registrar o comportamento atual.
- Definir critérios de aceite.
- Definir testes necessários.

---

## PARTE B — DURANTE A ALTERAÇÃO

- Fazer mudanças mínimas.
- Não alterar arquivos sem necessidade.
- Não modificar contratos públicos sem necessidade.
- Não duplicar lógica existente.
- Não confiar apenas no frontend.
- Preservar organização ativa e isolamento.
- Preservar RBAC.
- Preservar internacionalização.
- Preservar responsividade.
- Implementar tratamento de loading, sucesso, erro e estado vazio quando aplicável.
- Considerar idempotência e concorrência em operações críticas.
- Não adicionar logs temporários ou mocks de produção.

---

## PARTE C — APÓS A ALTERAÇÃO

- Revisar o diff completo.
- Verificar arquivos alterados fora do escopo.
- Executar lint.
- Executar typecheck, quando existir.
- Executar build.
- Executar testes relacionados.
- Verificar erros preexistentes separadamente de erros introduzidos.
- Verificar segurança.
- Verificar multi-tenant.
- Verificar RBAC.
- Verificar internacionalização.
- Verificar mobile, tablet e desktop.
- Informar configurações manuais.
- Produzir relatório final verificável.

---

## PARTE D — CRITÉRIOS DE BLOQUEIO

A tarefa não pode ser declarada concluída quando houver:

- erro de build introduzido pela mudança;
- erro TypeScript introduzido pela mudança;
- lint impeditivo introduzido pela mudança;
- teste relacionado falhando;
- alteração fora do escopo;
- risco de mistura entre organizações;
- autorização crítica somente no frontend;
- bypass hardcoded;
- segredo ou credencial exposta;
- billing duplicado;
- texto novo fora da internacionalização;
- ausência de tratamento de erro em fluxo crítico;
- ausência de validação backend;
- ausência de evidência dos testes declarados;
- configuração manual necessária omitida.
