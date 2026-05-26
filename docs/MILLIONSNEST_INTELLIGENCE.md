# MillionsNest Ecosystem Intelligence Architecture

## 1. Visão Geral (O Sistema Vivo)
MillionsNest opera como um **cérebro operacional unificado** para igrejas. A infraestrutura de inteligência permite cruzar dados de múltiplos aplicativos (MusicScale, CultoFlow, CellSync) para gerar insights sobre engajamento, sobrecarga de voluntários e saúde organizacional.

## 2. Organization Graph (Grafo Relacional)
O modelo de dados é desenhado para responder rapidamente a hierarquias e dependências:
- **`nodes`**: Representam entidades físicas ou lógicas (Usuário, Equipe, Ministério, Culto).
- **`edges`**: Representam relações temporais ou estruturais (`leads`, `member_of`, `scheduled_for`).

### Firestore Schema:
```text
/organizations/{orgId}/graph_nodes/{nodeId}
  - type: 'user' | 'team' | 'ministry' | 'activity'
  - label: string
  - metadata: map

/organizations/{orgId}/graph_edges/{edgeId}
  - sourceId: string
  - targetId: string
  - relationType: 'leads' | 'member_of' | 'scheduled_for'
  - weight: number (intensidade da relação)
  - timestamp: timestamp
```

## 3. Unified Timeline & Event Model
Todos os apps emitem eventos estruturados para o barramento central (Event Bus).

### Event Registry (Padrão de Domínio):
- **Identity:** `user.login`, `user.signup`, `org.member_joined`
- **Ministry (CultoFlow/MusicScale):** `scale.created`, `scale.confirmed`, `rehearsal.attended`, `worship.started`
- **Engagement:** `volunteer.assigned`, `volunteer.declined`

O Event Bus propaga isso para a coleção `/organizations/{orgId}/timeline`, formando a fita cronológica da instituição.

## 4. Cross-App Intelligence & Health Engine
Monitora a vitalidade do ecossistema:
- **Ministry Overload Detection:** Se um voluntário (`node:user`) acumula muitas arestas `scheduled_for` em um intervalo curto, um alerta de *overload* é emitido.
- **Organizational Health Score:** Média ponderada do engajamento (aceitação de escalas, presença em células) menos o atrito estrutural (declínios, falhas sistêmicas).

## 5. Universal Search Foundation
Um motor visual rápido e indexado para buscar qualquer entidade em qualquer app.
- **Search Indices:** O backend mantem tokens para cada `label` de nó.
- Busca unificada via SDK que mapeia os resultados para as views de "MusicScale", "CultoFlow", etc.

## 6. AI Operational Layer
A IA atua transversalmente, observando o *Event Model* e o *Graph* para:
- **Sugestões:** "Notamos que a escala de bateria tem conflito histórico nestes domingos. Sugerir fulano."
- **Previsões:** "O engajamento do ministério jovem caiu 15% nas últimas 4 semanas."

## 7. Implementation Plan
1. Gravação Central: Implementar pacotes `search`, `graph`, `health`, e `registry` no SDK interno (`/src/packages/intelligence/*`).
2. Webhooks: Cloud functions escutarão os nós do Timeline para computar o Health Score offline usando batch writes.
3. Exposição Frontend: Dashboard de Ecossistema exibirá Graph Views e Health Scores por ministério.
