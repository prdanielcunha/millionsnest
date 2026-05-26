# MillionsNest :: Design Language System

A fundação visual do ecossistema MillionsNest. O objetivo de nossa interface é ser uma "**sofisticação invisível**". A forma não deve distrair da função, e o design não deve gritar por atenção. Transmitimos calma, clareza e autoridade institucional através do contraste, ritmo e silêncio visual (espaço em branco).

Nunca devemos parecer um "ERP de retaguarda" pesado, nem um "aplicativo gospel amador". Somos uma ferramenta profissional de elite.

---

## 1. Filosofia de Densidade e Hierarquia (Visual Density)

A interface deve respirar. A hierarquia não é estabelecida por dezenas de cores, mas sim pelo uso disciplinado de tamanho, contraste de texto e espaço vazio.

- **Baixa Densidade Padrão:** Layouts amplos com padding generoso `p-6` a `p-8` em cards principais em desktop.
- **Alta Densidade (Data-Heavy):** Para tabelas ou listas de escalas (`p-2` a `p-4`), o espaço deve ser contido para evitar fadiga visual de rolagem excessiva, priorizando bordas mínimas.

## 2. Dark Mode Philosophy (Modo Escuro Oficial)

MillionsNest não usa preto absoluto (`#000000`) nem cinzas neutros chapados. Usamos o "Cosmic Slate", um azul-petróleo extremamente escuro que confere profundidade sem cansar a vista.

- **Background Principal:** `#0B0F19` (Void/Cosmic Slate)
- **Surfaces (Cards, Sidebars):** `#111827`
- **Textos Secundários:** `#A0A7B5` (Contraste adequado WCAG AA)

*Nota: Não implementaremos light theme nesta fase da arquitetura; o ecossistema respira a identidade escura.*

## 3. Typography Scale (Inter + JetBrains Mono)

A tipografia deve ser objetiva e editorial.
- **Display/Headings:** Fontes como *Space Grotesk* ou *Inter* com `tracking-tight` (letras mais próximas) e `font-semibold`.
- **UI Base:** *Inter* para legibilidade máxima em tamanhos pequenos (`text-sm`, `text-xs`).
- **Data/Technical:** *JetBrains Mono* (`text-[10px] uppercase tracking-widest`) para tags, badges, datas de faturamento e roles (ex: `ADMIN`, `PRÓXIMA ESCALA`).

## 4. Spacing System (Ritmo Modular)

O espaçamento é estritamente baseado no sistema Tailwind (múltiplos de 4px).
- **Micro-Gap:** `gap-1`, `gap-2` (elementos altamente relacionados, ícones e labels).
- **Macro-Gap:** `gap-6`, `mb-8` (separações de seções).
- **Nunca use espaçamento arbitrário (ex: `px-[17px]`).**

## 5. Radius (Arredondamento)

Bordas arredondadas humanizam a interface, mas em excesso causam aparência infantil ("app blocky").
- **Containers Principais:** `rounded-[2rem]` (32px) para dar o aspecto de "soft card" de navegação principal.
- **Cards Internos:** `rounded-2xl` (16px).
- **Botões e Inputs:** `rounded-xl` (12px).
- **Tags e Badges:** `rounded-md` (6px) ou `rounded-full` (pílulas completas para status).

## 6. Elevation, Shadows e Blur Rules

Profundidade não é alcançada com sombras cinzas que flutuam, mas com luzes intrusivas e sombras profundas.
- **Elevation (Elevated Surface):** `shadow-2xl` com cores de base muito fracas `shadow-[0_0_40px_rgba(43,133,235,0.05)]`.
- **Inner Depth:** Ocasionalmente usamos `shadow-inner` e `border-white/5` para criar a sensação de um "sulco" em painéis de métricas (`bg-[#050505]`).
- **Blur Rules (Restrição de Glassmorphism):** Blur (`backdrop-blur-xl`) é altamente custoso para renderização.
  - **Permitido:** Em topbars e backgrounds fixos de containers principais translúcidos.
  - **Proibido:** Dentro de listas de renderização repedida (ex: 50 itens numa lista de membros, NUNCA devem ter backdrop blur individualmente).

## 7. Overlays e Modais

- Modais devem centralizar a atenção em fundos escuros.
- O overlay de fundo (*backdrop*) deve ter `bg-black/80` (quase opaco), preferido em relação a blur pesado (`backdrop-blur`). O usuário deve focar no modal, não se esforçar para enxergar o que sobrou atrás do vidro arranhado.
