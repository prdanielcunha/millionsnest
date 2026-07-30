# Brand Integration

1. **Identidade Aprovada**: NestFinance - Nest Flow Signature
2. **Pasta-fonte**: `NestFinance_Nest_Flow_Signature_Kit_Completo_v1`
3. **Pasta pública de destino**: `/brand/nestfinance/nest-flow-signature/v1`
4. **Tabela de cada asset**: (ver `brand-assets.json`)
5. **Dimensão**: Preservado as originais conforme kit.
6. **Transparente ou opaco**: Logos e símbolos são transparentes; ícones app e og image são opacos (com fundos corretos integrados no próprio asset).
7. **Fundo recomendado**: Especificado nas variantes (`dark-ui` para fundos escuros, `light-ui` para fundos claros).
8. **Uso atual**: Header, Drawer/Sidebar, Favicon, Open Graph.
9. **Uso futuro**: Telas institucionais, telas vazias, ícones de avatar no ecossistema, redes sociais (X, LinkedIn, Instagram).
10. **Telas em que foi aplicado**: Header, Drawer, index.html.
11. **Arquivos legados substituídos**: `MillionsNest_Black.png`, favicon antigo.
12. **Regras proibidas**: Não usar `Logo_transp.png`, não usar logos deformadas, não aplicar border-radius ao wordmark, não usar texto para formar a logo.
13. **Instruções para redes sociais futuras**: Usar assets prontos na pasta `social/` e não criar contas/links se não existirem.
14. **Instruções para PWA**: Manifest atualizado com ícones 192 e 512, incluindo `maskable`.
15. **Instruções para Open Graph**: Usar imagem exata de `1200x630` sem crop ou efeitos na tag `og:image`.
16. **Checklist de validação**: `npm run check:brand-assets` deve passar.
