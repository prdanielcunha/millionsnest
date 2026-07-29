# Especificação geométrica — Connect V2

## Grid mestre

- ViewBox: 1000 × 1000 unidades.
- Centro óptico: 500 × 500.
- Arco externo: raio 342, espessura 122, terminações arredondadas e assimétricas.
- Arco interno: raio 184, espessura 82.
- Núcleo: raio 62.
- Rota de ação: espessura 72, do núcleo ao terminal inferior interno.
- Microversão: arco externo + núcleo de raio 68 + rota de espessura 92.

## Área de proteção

Use no mínimo 124 unidades de respiro em cada lado, equivalentes ao diâmetro
do núcleo. Em aplicações com wordmark, mantenha ao menos 90 unidades entre o
símbolo e a primeira letra.

## Escala responsiva

- 24 px ou maior: símbolo principal completo.
- 16 a 23 px: microversão.
- Abaixo de 16 px: evitar; use fallback textual ou ícone do sistema.

## Construção conceitual

A assimetria é intencional: o terminal inferior externo avança em relação ao
superior, enquanto a rota interna converge no núcleo. Não centralizar, espelhar
ou “corrigir” automaticamente esses pontos.
