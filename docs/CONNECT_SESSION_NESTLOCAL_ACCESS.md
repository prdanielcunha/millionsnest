# Connect Session Context — NestLocal App Access

## Objetivo

Expor ao MillionsNest Connect a decisão canônica de acesso ao NestLocal para a organização ativa.

O Hub continua sendo a autoridade de:

- identidade;
- organização ativa;
- membership;
- privilégios globais;
- entitlement/acesso de cada app.

## Contrato aditivo

O protocolo existente mantém:

`appAccess.musicscale`

e passa a poder incluir:

`appAccess.nestlocal`

A mudança é aditiva e mantém `protocolVersion = 1.0.0`.

## Fonte da decisão

O Hub não aceita uma flag enviada pelo cliente.

Para NestLocal ele usa exclusivamente:

`resolveEcosystemAppAccess({ uid, organizationId, appId: 'nestlocal' })`

Esse resolver já valida, entre outros gates:

- usuário ativo;
- organização ativa;
- membership canônica;
- assinatura NestLocal ativa/trialing;
- status do app na organização;
- owner ou membro com `appAccess.nestlocal.enabled`;
- permissão `nestlocal.manage`.

Papéis globais canônicos seguem a política já existente do ecossistema.

## Isolamento de tenant

O `organizationId` publicado em `appAccess.nestlocal` é sempre o mesmo `activeOrganizationId` resolvido pelo Hub.

O organizationId solicitado no handoff continua sendo apenas um routing hint até ser revalidado pelo Hub.

## Compatibilidade

`nestlocal` permanece opcional no tipo consumidor durante a transição.

Consumidores antigos que só conhecem `musicscale` continuam válidos.

Depois que o Connect estiver atualizado para consumir a nova decisão, a boundary outbound poderá exigir:

- contexto Hub resolvido;
- `appAccess.nestlocal.accessible = true`;
- organizationId coincidente;
- capability/política adicional do canal.

Isso elimina a necessidade de confiar em app/tenant declarados pelo navegador.
