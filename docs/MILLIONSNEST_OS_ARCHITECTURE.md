# MillionsNest OS: Sistema Operacional Ministerial Inteligente

## 1. Princípios Arquiteturais (O "Cérebro" Vivo)

MillionsNest não é apenas um portal de aplicativos, mas o **Operating System (OS)** nativo para ministérios. A plataforma orquestra toda a infraestrutura através de uma camada unificada de identidade, inteligência transversal e eventos comportamentais em tempo real.

O ecossistema é baseado em três pilares:
1. **Unificação (Single Source of Truth):** Auth, Billing, Permissões e Organografia centralizados.
2. **Reatividade Automática:** Event Architecture padronizada. Cada ação emite um sinal no grafo do ecossistema.
3. **Observabilidade Ativa:** Entendimento comportamental, detecção de fricção, saúde organizacional e engine de telemetria sem invasão de privacidade.

---

## 2. Organization Graph (Grafo Relacional Vivo)

Em vez de listas isoladas, MillionsNest armazena as relações físicas no Firestore e processa links semânticos.

**Entidades Core:**
- `User Node`: O indivíduo, autenticado via MillionsNest Auth.
- `Organization Node`: A igreja ou ministério central.
- `Ministry Node`: Sub-agrupamentos (ex: Louvor, Recepção, Células).
- `Activity Node`: Arestas temporais (Cultos, Ensaios, Reuniões).

**Modelagem Firebase do Grafo:**
```text
/organizations/{orgId}/graph_nodes/{nodeId}
/organizations/{orgId}/graph_edges/{edgeId}
```
*Isto permite queries unificadas: "Mostre todos os nós impactados pelo Ensaio de Sábado".*

---

## 3. Event Architecture & Cross-App Intelligence

Cada interação relevante produz um domínio de evento, propagado via EventBus (Internal SDK) para a Timeline Unificada e Analytics.

**Nomenclatura (Domain.Action):**
- `scale.created`, `scale.published`, `scale.confirmed`
- `rehearsal.scheduled`, `rehearsal.attended`
- `worship.started`, `worship.ended`
- `member.onboarded`, `member.overloaded`
- `billing.upgraded`

**Inteligência Transversal (Engine Analítico):**
- **Overload Detection (Burnout do Voluntário):** Disparado se `scale.assigned` excede a capacidade mensal configurada.
- **Engagement Score:** Função ponderada de `login.frequent` + `scale.confirmed.fast` + `timeline.interaction`.
- **Friction Score:** Detecta tempo demorado entre `scale.created` e `scale.published`, ou altas taxas de `ai.processing_failed`.

---

## 4. Internal SDK (Fundação de Escala)

Todo aplicativo novo (CultoFlow, CellSync, etc.) ou refatoração usa o SDK Interno.

**Módulos do SDK:**
- `@millionsnest/auth` -> Wrapped em AuthContext (Sessões unificadas, JWT via Firebase)
- `@millionsnest/rbac` -> Capabilities e regras de acesso strict.
- `@millionsnest/telemetry` -> Event tracking, Timeline push, Error boundaries.
- `@millionsnest/ui` -> Primitivas premium (Skeletons, Cards, Modais, Typography). Baseado em Tailwind e Lucide.
- `@millionsnest/ai` -> Context-aware GenAI endpoints (resumo de timeline, geração de escala, detecção de padrão).
- `@millionsnest/sync` -> Engine Offline-first via localStorage e Firebase Offline Persistence persistidas na fundação do React.

---

## 5. Timeline Ministerial 

Uma timeline unificada de atividades recentes e futuras. Não um mero "log de auditoria", mas uma interface premium que conecta a organização visualmente e semanticamente.

**Data Flow:**
1. Ação disparada em um App filho (ex: App MusicScale cria uma escala).
2. O Internal SDK emite um `MNEvent`.
3. Uma Cloud Function agrupa, aplica heurística contextual e grava no nó `organization_timeline`.
4. Os dashboards de usuários consumem esta timeline viva.

---

## 6. Estratégia de Expansão (O Efeito "Moat")

O OS estabelece um *moat* (vantagem competitiva impenetrável):
- Nenhum App parceiro precisa se preocupar com Auth, Vendas ou Permissões.
- A igreja ganha um único painel e apenas uma cobrança, simplificando radicalmente o caixa do ministério.
- A experiência de cada App parceiro se torna idêntica aos padrões de qualidade originais (Stripe, Vercel, Apple), porque todos herdam o Internal SDK unificado.
