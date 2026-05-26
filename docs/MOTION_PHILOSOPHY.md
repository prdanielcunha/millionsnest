# MillionsNest :: Motion Philosophy

A filosofia de animação do MillionsNest prioriza **velocidade percebida e fluidez orgânica** sobre espetáculo e acrobacias visuais. Quando a interface se move, ela deve parecer uma extensão da intenção física do usuário.

"Cinematic UX" atrapalha produtos frequentes. O usuário de SaaS quer terminar seu trabalho rápido, e as animações não podem custar tempo a ele.

---

## 1. Regras de Transição

1. **Velocidade Percebida:** Animações duram apenas o suficiente para ajudar o cérebro a rastrear o que aconteceu. 
   - A entrada pode ser fluida (até `300ms`).
   - A saída deve ser rápida e seca (até `150ms`). Se o usuário quer fechar, não o faça esperar por uma animação dramática.
2. **Anti-Layout Thrashing:** Animações estruturais não devem empurrar o resto da interface. Em vez de animar a altura do documento (o que causa reflows altíssimos do navegador), preferir animar *opacity* (Alpha) e *transform* (Scale/Y).
3. **Limite de Animação Simultânea:** Nunca anime mais de duas propriedades de mudança de estrutura da tela simultaneamente. (Stagger list entries se houver no máximo 10. Listas de 100 itens entram instantaneamente ou geram queda de FPS).

## 2. Easing Oficial (Tokens)

Nunca utilizar `linear` ou `ease-in-out` padrão do navegador. O Motion System utiliza curvas que imitam forças físicas.

- **Snappy Spring:** Ideal para Modais e Drawers. É rápido, tem uma minúscula energia residual (damping), mas freia forte.
  - Framer Motion: `type: "spring", damping: 25, stiffness: 350`
- **Premium Ease (Deceleration):** Para fade ins ou expansões de blocos grandes. Desacelera rapidamente para mostrar agilidade.
  - Cubic-Bezier: `[0.32, 0.72, 0, 1]`

## 3. Transition Hierarchy

- **Nível 1 (Immediate State):** Hover em botões. Ocorre quase instantaneamente (CSS `duration-150`, correndo `scale: 0.98` em clique ativo para sensação tátil sem animação longa).
- **Nível 2 (Component Shift):** Modais abrindo, Tabs trocando conteúdo. Tem duração de `~250ms`, usando `opacity` e um leve `y: 10` ou `scale: 0.95`.
- **Nível 3 (Layout Routing):** Mudança inteira de página. Duração `~400ms`. Esmaecimento elegante, com elementos escalonados (staggering) e entradas em cascata para evitar saltos brutos da tela.

## 4. Gesture Inertia & Interaction Acceleration

- Se um gesto de Swipe ou Drag acontecer no futuro (mobile view das PWA), a interface não obedece cegamente a curva de bezier, ela absorve a **velocidade tátil do dedo do usuário** e arremessa o componente proporcionalmente.
- **Aceleração da Intenção:** Quando um hover passa rápido, não anime a entrada. Quando o mouse paira intencionalmente, permita brilhos e *glow/blur* interativos sob o card.
