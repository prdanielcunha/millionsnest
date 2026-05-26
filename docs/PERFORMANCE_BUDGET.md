# MillionsNest :: Performance Budget & Hardware Constraints

O ecossistema MillionsNest adota uma filosofia de alto desempenho. Líderes e voluntários usarão a interface em aparelhos antigos, conectados em redes limitadas e no formato PWA. 

Cada milissegundo gasto com processamento de thread bloqueia o tempo que o usuário tem para organizar a equipe ministerial.

## 1. Budget de Render e CPU

- **Initial Render:** O dashboard principal deve atingir Time-to-Interactive (TTI) em `< 1.2s` em redes 4G normais.
- **Bundle JS:** A base operacional e os frameworks (React + Firebase Auth + Tailwind + App Core) não devem exceder `~250KB` gzipped. Evitar incluir bibliotecas gigantes como Moment.js ou Lodash. Utilizar capacidades nativas de ECMAScript.
- **Hydration:** Evitar grandes volumes de dados que não contribuem para o `LCP` (Largest Contentful Paint). Componentes modais ou blocos pesados (Dashboards Analíticos) devem sofrer Lazy Loading.

## 2. Orçamento Visual (Visual Tax)

O custo da sofisticação estética não pode derreter a bateria dos dispositivos móveis ou congelar scroll de páginas web.

- **Limites de Blur (`backdrop-filter`):** Extremo cuidado com `backdrop-blur`. Placas de vídeo em Macbooks rodam a 120 FPS. Processadores mobile cortam o render frame base para 30 FPS só por causa de camadas de blur compostas.
  - **Uso Máximo Simultâneo:** NUNCA empilhar mais de 2 camadas que possuem `backdrop-blur-xl` na mesma viewport.
  - Listas longas iterárias NUNCA usam Blur. O item da lista deve usar simples `rgba`.

- **Animações (Motion Limite):**
  - **Apenas Transform/Opacity:** Somente e absolutamente propriedades que provocam GPU Acceleration podem ser animadas: `transform` (scale, translate) e `opacity`.
  - **Zero Layout Thrashing:** Propriedades proibidas no engine de motion: animar `width`, `height`, `margin`, `padding`, `top`, `bottom`. 

## 3. Gestão e Orçamento Mobile

- **Long Tasks Constraint:** Qualquer query algorítmica pesada no Internal SDK deve ser sub-fracionada num WebWorker ou cedida via Promises ao Call Stack, impedindo **Long Tasks (> 50ms)** que travam frames durante toques de tela.
- **Optimistic Updates:** Em redes de igrejas onde o sinal varia, todas as operações (Aceitar escala, confirmar membro) devem ocorrer otimisticamente na memória síncrona. O Engine manda para servidor em background (`OfflineEngine`). A velocidade para o usuário é sempre **imediata `~10ms`**.
- O telemetry engine observa e alerta se os orçamentos descritos acima sofrem violação por mais de 5% das sessões base de usuários.
