const intelligence = {
  lenses: {
    selector_label: 'Visão',
    selector_aria: 'Alternar visão do MillionsNest',
    my_today: 'Meu dia',
    pastoral: 'Pastoral',
    journey: 'Journey',
    worship: 'Louvor',
    finance: 'Financeiro',
    administration: 'Administração',
    descriptions: {
      my_today: 'O que você precisa saber ou resolver agora.',
      pastoral: 'Cuidado, acompanhamento e decisões pastorais autorizadas.',
      journey: 'Visitantes, jornadas, acompanhamentos e compromissos de cuidado.',
      worship: 'Escalas, confirmações, pendências e preparação do ministério.',
      finance: 'Operação financeira conforme suas permissões.',
      follow_up: 'O que está pendente no acompanhamento?',
      administration: 'Organizações, pessoas, acessos e operação do ecossistema.'
    }
  },
  onboarding: {
    kicker: 'Comece por aqui',
    single_title: 'Seu {{app}} está pronto para usar',
    single_description: 'Você não precisa procurar onde entrar. Abra o aplicativo por aqui e o MillionsNest continuará mostrando o próximo passo para sua equipe.',
    multiple_title: 'Seus aplicativos estão prontos',
    multiple_description: 'Escolha o aplicativo que você precisa usar agora. O Hub organiza os acessos e mostra o próximo passo sem você precisar decorar caminhos.',
    open_app: 'Abrir {{app}}',
    view_start: 'Ver como começar',
    access_note: 'Sempre que precisar voltar, abra o Hub e use Meus aplicativos. Seu acesso fica disponível por aqui.'
  },
  evidence: {
    source_label: 'Fonte',
    verified_fact: 'Fato verificado',
    unavailable: 'Fonte indisponível',
    no_source_no_claim: 'Sem fonte, sem afirmação.'
  },
  ask: {
    eyebrow: 'Ask MillionsNest',
    title: 'Pergunte ao seu ecossistema',
    subtitle: 'Faça uma pergunta em linguagem natural. O Hub responde apenas com dados autorizados e fontes que consegue sustentar.',
    evidence_promise: 'Sem fonte, sem afirmação',
    input_label: 'Pergunta para o MillionsNest',
    placeholder: 'Ex.: Como está domingo?',
    ask_action: 'Perguntar',
    answer_label: 'Resposta',
    why_action: 'Por que estou vendo isso?',
    open_source: 'Abrir no sistema de origem',
    sources_title: 'Fontes que sustentam esta resposta',
    status: {
      evidence_backed: 'Com evidências',
      insufficient: 'Dados insuficientes',
      not_available: 'Fora do seu contexto',
      unsupported: 'Pergunta não suportada'
    },
    suggestions: {
      attention: 'O que precisa da minha atenção?',
      sunday: 'Como está domingo?',
      confirmations: 'Quem ainda não respondeu à escala?',
      workload: 'Quem está acima da carga de serviço?',
      personal_schedule: 'Qual é minha próxima escala?',
      follow_up: 'O que está pendente no acompanhamento?',
      administration: 'Há algo pendente na equipe?'
    },
    why: {
      answered: 'Esta resposta foi montada somente a partir de projeções autorizadas no seu contexto atual. As fontes abaixo sustentam os fatos exibidos; o MillionsNest não completou lacunas com suposições.',
      insufficient: 'Existe contexto relacionado à pergunta, mas a fonte autorizada atual não contém detalhe suficiente para sustentar a conclusão pedida.',
      aggregate_only: 'O MusicScale possui uma visão agregada da distribuição das escalas. Ela ajuda a enxergar desequilíbrios por função, mas não é evidência suficiente para rotular uma pessoa como sobrecarregada.',
      not_available: 'Esse domínio não está disponível no seu contexto autorizado atual. O Hub não usa acesso administrativo genérico para revelar dados ministeriais, pastorais ou financeiros.',
      unsupported: 'A pergunta ficou fora do conjunto de consultas que o Hub consegue responder com evidência suficiente neste momento.'
    },
    sources: {
      hub: 'MillionsNest Hub',
      scale: 'Escala',
      worship_team: 'Equipe de louvor',
      worship_schedule: 'Agenda de louvor',
      organization: 'Organização',
      workspace: 'Central adaptativa',
      followup_queue: 'Fila de acompanhamento',
      verified_record: 'Registro verificado',
      observed_at: 'Observado em {{date}}',
      authorized_projection: 'Projeção autorizada do contexto atual'
    },
    facts: {
      personal_pending: '{{count}} resposta(s) pendente(s) na sua próxima escala.',
      pending_confirmations: '{{count}} confirmação(ões) ainda pendente(s).',
      declined_confirmations: '{{count}} recusa(s) registrada(s).',
      repertoire_gaps: '{{count}} lacuna(s) de conteúdo no repertório.',
      distribution_window: '{{schedules}} escala(s) concluída(s), {{assignments}} atribuição(ões) e {{people}} pessoa(s) no recorte de 30 dias.',
      distribution_function: 'Em {{function}}, o maior registro individual foi {{max}} escala(s), com média de {{average}}.',
      next_scale_is_not_sunday: 'A próxima escala disponível no recorte atual não é de domingo.',
      journey_assigned: '{{count}} primeiro(s) contato(s) atribuído(s) a você aguardando conclusão.',
      journey_unassigned: '{{count}} primeiro(s) contato(s) sem responsável no seu escopo autorizado.',
      journey_overdue: '{{count}} compromisso(s) de primeiro contato acima do prazo combinado.',
      journey_total_open: '{{count}} acompanhamento(s) de primeiro contato aberto(s) no seu recorte autorizado.',
      journey_due_soon: '{{count}} compromisso(s) de primeiro contato com prazo nas próximas 24 horas.',
      action_item: 'Ação autorizada'
    },
    answers: {
      attention: {
        title: 'O que merece atenção agora',
        summary: 'Há {{count}} ação(ões) sustentada(s) por dados no recorte autorizado desta visão.',
        summary_clear: 'Não há ações abertas no recorte autorizado desta visão agora. Isso não significa ausência de atividade em domínios que ainda não estão conectados ou autorizados.'
      },
      personal_schedule: {
        title: 'Sua próxima escala',
        summary: 'Encontrei sua próxima participação no MusicScale. Há {{pending}} resposta(s) pendente(s) associada(s) ao contexto disponível.',
        summary_without_responses: 'Encontrei sua próxima participação no MusicScale. O resumo de respostas ainda não está disponível para esta escala.',
        insufficient: 'Não encontrei uma próxima escala pessoal em uma fonte autorizada e pronta para consulta agora.'
      },
      worship_service: {
        title: 'Próxima escala de louvor',
        summary: 'A próxima escala autorizada tem {{pending}} confirmação(ões) pendente(s), {{declined}} recusa(s) e {{gaps}} lacuna(s) de conteúdo no repertório.',
        summary_responses_only: 'A próxima escala autorizada tem {{pending}} confirmação(ões) pendente(s) e {{declined}} recusa(s). A projeção do repertório ainda não está pronta.',
        summary_repertoire_only: 'A próxima escala autorizada possui {{gaps}} lacuna(s) verificável(is) no repertório. O resumo de respostas ainda não está pronto.',
        insufficient: 'O recorte autorizado atual não contém informação suficiente para afirmar como está o domingo pedido.'
      },
      worship_confirmations: {
        title: 'Confirmações da próxima escala',
        summary: 'Na próxima escala há {{pending}} resposta(s) pendente(s) e {{declined}} recusa(s) registrada(s).',
        insufficient: 'A próxima escala existe, mas o resumo de respostas ainda não está disponível com qualidade suficiente para responder.'
      },
      worship_repertoire: {
        title: 'Preparação do repertório',
        summary: 'A próxima escala possui {{gaps}} lacuna(s) verificável(is) de conteúdo no repertório.',
        insufficient: 'Não há uma próxima escala com projeção de repertório suficiente para responder com segurança.'
      },
      worship_distribution: {
        title: 'Distribuição de serviço',
        insufficient: 'Consigo mostrar a distribuição agregada, mas os dados atuais não sustentam apontar quem está “acima da carga” como uma conclusão individual.'
      },
      journey_follow_up: {
        title: 'Acompanhamentos do Journey',
        summary: 'No seu recorte autorizado há {{total}} acompanhamento(s) aberto(s), {{overdue}} acima do prazo e {{dueSoon}} com prazo nas próximas 24 horas.',
        summary_clear: 'No recorte autorizado e observado agora, não há acompanhamentos de primeiro contato abertos.',
        insufficient: 'A Journey Lens está disponível, mas a projeção autorizada de acompanhamento ainda não está pronta para sustentar essa resposta.'
      },
      finance: {
        insufficient: 'O Hub ainda não possui uma fonte financeira autorizada e estruturada neste contexto que sustente responder essa pergunta.'
      },
      administration: {
        title: 'Situação administrativa',
        summary_attention: 'Há {{count}} ação(ões) administrativa(s) aberta(s) sustentada(s) pelo Hub.',
        summary_clear: 'Não há ações administrativas abertas no recorte autorizado atual.'
      },
      not_available: {
        title: 'Esse contexto não está disponível aqui',
        summary: 'O MillionsNest não vai ampliar permissões nem inferir dados de outro domínio só para responder à pergunta.'
      },
      insufficient: {
        title: 'Ainda não há evidência suficiente'
      },
      unsupported: {
        title: 'Ainda não consigo responder isso com segurança',
        summary: 'Tente perguntar sobre atenção atual, sua próxima escala, confirmações, repertório, distribuição do louvor ou situação administrativa.'
      }
    }
  },
  sections: {
    needs_attention: 'Precisa da sua atenção',
    today: 'Hoje',
    this_week: 'Esta semana',
    status: 'Status',
    insights: 'Insights e tendências'
  }
} as const;

export default intelligence;
