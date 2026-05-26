# MillionsNest :: Haptic Philosophy

O design de interface transcende as telas; em aplicações PWAs vitais e acessadas por dispositivos móveis (ex: smartphones confirmando escalas vitais antes do culto), os motores de vibração (`navigator.vibrate`) atuam como o material háptico que dá confiançã ao clique da interface.

## 1. Princípios Básicos 

1. **Vibração não é Alerta Sonoro:** Nunca confunda feedback tátil com alerta de notificação irritante. 
2. **Confirmação Silenciosa Positiva:** O click num botão salvar é como encaixar uma peça num quebra-cabeça na vida real. Uma vibração microscópica afirma fisicamente a ação na memória motora.

## 2. Tipos de Vibração Háptica e Intensidade

Caso o dispositivo possua os padrões nativos ou `navigator.vibrate`, mapear a taxonomia SDK abaixo:

- **Heavy / Rigid (Ação Destrutiva)**
  - Evento: Recusar a escala, deletar o arquivo do grupo, desativar um voluntário.
  - Implementação Web Padrão: `navigator.vibrate([50])` - Um "Thud" denso e curto. Adverte subconscientemente que algo crítico ocorreu.

- **Light / Crisp (Sucesso/Confirmação)**
  - Evento: Botão "Salvar", confirmar subida da música para repertório, abrir card.
  - Implementação Básica: `navigator.vibrate([15])` ou o Haptic do UIKit nativo (PWA instalada). Somente um minúsculo "peck" confirmador.

- **Warning / Double Strike (Fricção e Erro)**
  - Evento: Campos inválidos no cadastro, internet caiu durante um checkout. 
  - Padrão: `navigator.vibrate([20, 40, 20])` - Como um ligeiro tremor rápido de negação, para despertar a atenção do olho à linha de erro (que deve ser contornada por vermelho semântico e shake animation, por exemplo).

## 3. Quando NUNCA utilizar feedback háptico:

A fadiga vibratória destrói a utilidade e o luxo dessa funcionalidade tátil. Não use em: 
- Navegação de barra principal de links do Menu ou Tabs.
- Clicar sobre textos para expandir descrições simples/FAQs.
- No fechar de diálogos irrelevantes de tooltips informcionais.
- E imperativamente: Permita o `Opt-out` via "Configurações de Acessibilidade" se o usuário não quiser as respostas vibro-táteis.
