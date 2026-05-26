# MillionsNest :: Product Language System

Como o ecossistema MillionsNest (e seus aplicativos MusicScale, CultoFlow, CellSync) fala com os líderes e voluntários das igrejas. 

A nossa voz representa **Inteligência Silenciosa, Confiabilidade Profissional e Acolhimento Sóbrio**. Nunca somos corporativos ou frios ("Erro: 504 no servidor") e nunca soamos empolgados como aplicativos voltados o consumidor ("Iaaae, vamos escalar a galera?! 🎉").

---

## 1. O Tom Oficial

- **Claro e Conciso:** Diga exatamente o que aconteceu. 
- **Autoridade Silenciosa:** Transmitimos segurança institucional. É um ambiente de administração e liturgia.
- **Humo Sóbrio, Zero Hype:** Sem retórica inflada. Palavras que devem ser evitadas: "Incrivel", "Fabuloso", "Uau", "Sua igreja nunca mais será a mesma".
- **Ação Focada:** Em cada texto explicativo há um *Call-To-Action* natural. 

## 2. Padrões de Comunicação

### Mensagens de Conclusão / Sucesso
O sucesso é a regra, não a exceção. 
- ❌ Emocional: "Que incrível! A escala do final de semana foi publicada e confirmada por todos os membros maravilhosos do ministério! Parabéns! 🎊"
- ✅ Profissional: "Escala publicada. Todos os voluntários foram notificados."
- ✅ Status silencioso: Um sutil toast verde escrito "Alterações salvas" na margem inferior.

### Mensagens de Erro
Nenhum usuário deve ser culpabilizado por uma falha, e detalhes sistêmicos são escondidos, deixando o contexto claro para ação.
- ❌ Técnico: "Failed fetching document /organizations/123/songs/23 -> Insufficient Permissions"
- ❌ Condenador: "Você errou a senha e bloqueou sua conta. Faça suporte."
- ✅ Construtivo: "Você não possui permissão para editar o repertório. Solicite acesso ao administrador da organização."

### Modais e Confirmações Destrutivas
Sempre reafirme as consequências, nunca use "Sim / Não".
- **Título:** Remover 'Mateus Silva' do grupo Louvor?
- **Corpo:** Ele perderá acesso às escalas e arquivos vinculados. Esta ação precisa ser reavaliada se ele possuir escalas ativas.
- **Botões:** `[Cancelar]` `[Remover Voluntário]`  (Nunca `[Não]` e `[Sim]`)

### Empty States (Vazios)
Ao invés de exibir tabelas quebradas ou desoladas, um espaço vazio deve introduzir valor.
- Título conciso: "Nenhuma escala programada"
- Descrição da utilidade e Call-to-Action: "Você tem 15 voluntários disponíveis este mês. Crie uma escala para notificá-los automaticamente."

## 3. Recovery States (Estados de Recuperação)
Assumimos que conexões podem cair, que a PWA fica offline e líderes estão em redes limitadas (templo com paredes grossas).
- Em falha de internet, o design language diz: *"Funcionando offline. As alterações serão sincronizadas quando você reconectar."* Nunca diga *"Sem Internet. Ação falhou"*.
