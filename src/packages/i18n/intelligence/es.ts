const intelligence = {
  lenses: {
    selector_label: 'Vista',
    selector_aria: 'Cambiar la vista de MillionsNest',
    my_today: 'Mi día',
    pastoral: 'Pastoral',
    journey: 'Journey',
    worship: 'Alabanza',
    finance: 'Finanzas',
    administration: 'Administración',
    descriptions: {
      my_today: 'Lo que necesitas saber o resolver ahora.',
      pastoral: 'Cuidado, seguimiento y decisiones pastorales autorizadas.',
      journey: 'Visitantes, procesos, seguimientos y compromisos de cuidado.',
      worship: 'Programaciones, confirmaciones, pendientes y preparación del ministerio.',
      finance: 'Operación financiera de acuerdo con tus permisos.',
      follow_up: '¿Qué está pendiente en el seguimiento?',
      administration: 'Organizaciones, personas, accesos y operación del ecosistema.'
    }
  },
  onboarding: {
    kicker: 'Empieza aquí',
    single_title: 'Tu {{app}} está listo para usar',
    single_description: 'No necesitas averiguar dónde entrar. Abre la aplicación desde aquí y MillionsNest seguirá mostrando el siguiente paso para tu equipo.',
    multiple_title: 'Tus aplicaciones están listas',
    multiple_description: 'Elige la aplicación que necesitas usar ahora. El Hub organiza los accesos y muestra el siguiente paso sin que tengas que memorizar rutas.',
    open_app: 'Abrir {{app}}',
    view_start: 'Ver cómo empezar',
    access_note: 'Siempre que necesites volver, abre el Hub y usa Mis aplicaciones. Tu acceso queda disponible aquí.'
  },
  evidence: {
    source_label: 'Fuente',
    verified_fact: 'Hecho verificado',
    unavailable: 'Fuente no disponible',
    no_source_no_claim: 'Sin fuente, no hay afirmación.'
  },
  ask: {
    eyebrow: 'Ask MillionsNest',
    title: 'Pregunta a tu ecosistema',
    subtitle: 'Pregunta en lenguaje natural. El Hub responde solo con datos autorizados y fuentes que puede sustentar.',
    evidence_promise: 'Sin fuente, no hay afirmación',
    input_label: 'Pregunta para MillionsNest',
    placeholder: 'Ej.: ¿Cómo está el domingo?',
    ask_action: 'Preguntar',
    answer_label: 'Respuesta',
    why_action: '¿Por qué estoy viendo esto?',
    open_source: 'Abrir en el sistema de origen',
    sources_title: 'Fuentes que sustentan esta respuesta',
    status: {
      evidence_backed: 'Con evidencias',
      insufficient: 'Datos insuficientes',
      not_available: 'Fuera de tu contexto',
      unsupported: 'Pregunta no compatible'
    },
    suggestions: {
      attention: '¿Qué necesita mi atención?',
      sunday: '¿Cómo está el domingo?',
      confirmations: '¿Quién todavía no respondió a la escala?',
      workload: '¿Quién está por encima de la carga de servicio?',
      personal_schedule: '¿Cuál es mi próxima escala?',
      follow_up: '¿Qué está pendiente en el seguimiento?',
      administration: '¿Hay algo pendiente en el equipo?'
    },
    why: {
      answered: 'Esta respuesta se construyó solo a partir de proyecciones autorizadas en tu contexto actual. Las fuentes de abajo sustentan los hechos mostrados; MillionsNest no completó vacíos con suposiciones.',
      insufficient: 'Existe contexto relacionado con la pregunta, pero la fuente autorizada actual no contiene suficiente detalle para sustentar la conclusión solicitada.',
      aggregate_only: 'MusicScale posee una visión agregada de la distribución de escalas. Puede mostrar desequilibrios por función, pero no es evidencia suficiente para etiquetar a una persona como sobrecargada.',
      not_available: 'Este dominio no está disponible en tu contexto autorizado actual. El Hub no usa acceso administrativo genérico para revelar datos ministeriales, pastorales o financieros.',
      unsupported: 'La pregunta está fuera del conjunto de consultas que el Hub puede responder actualmente con evidencia suficiente.'
    },
    sources: {
      hub: 'MillionsNest Hub',
      scale: 'Escala',
      worship_team: 'Equipo de alabanza',
      worship_schedule: 'Agenda de alabanza',
      organization: 'Organización',
      workspace: 'Centro adaptativo',
      followup_queue: 'Cola de seguimiento',
      verified_record: 'Registro verificado',
      observed_at: 'Observado el {{date}}',
      authorized_projection: 'Proyección autorizada del contexto actual'
    },
    facts: {
      personal_pending: '{{count}} respuesta(s) pendiente(s) en tu próxima escala.',
      pending_confirmations: '{{count}} confirmación(es) aún pendiente(s).',
      declined_confirmations: '{{count}} rechazo(s) registrado(s).',
      repertoire_gaps: '{{count}} brecha(s) de contenido en el repertorio.',
      distribution_window: '{{schedules}} escala(s) completada(s), {{assignments}} asignación(es) y {{people}} persona(s) en la ventana de 30 días.',
      distribution_function: 'En {{function}}, el mayor registro individual fue de {{max}} escala(s), con un promedio de {{average}}.',
      next_scale_is_not_sunday: 'La próxima escala disponible en la proyección actual no es del domingo.',
      journey_assigned: '{{count}} seguimiento(s) de primer contacto asignado(s) a ti y pendiente(s) de conclusión.',
      journey_unassigned: '{{count}} seguimiento(s) de primer contacto sin responsable en tu alcance autorizado.',
      journey_overdue: '{{count}} compromiso(s) de primer contacto por encima del plazo acordado.',
      journey_total_open: '{{count}} seguimiento(s) de primer contacto abierto(s) en tu alcance autorizado.',
      journey_due_soon: '{{count}} compromiso(s) de primer contacto con plazo en las próximas 24 horas.',
      journey_total_open_lower_bound: 'Se observaron al menos {{count}} seguimiento(s) de primer contacto abierto(s) en tu alcance autorizado.',
      journey_assigned_lower_bound: 'Se observaron al menos {{count}} seguimiento(s) de primer contacto asignado(s) a ti y pendiente(s) de conclusión.',
      journey_unassigned_lower_bound: 'Se observaron al menos {{count}} seguimiento(s) de primer contacto sin responsable en tu alcance autorizado.',
      journey_overdue_lower_bound: 'Se observaron al menos {{count}} compromiso(s) de primer contacto fuera de plazo.',
      journey_due_soon_lower_bound: 'Se observaron al menos {{count}} compromiso(s) de primer contacto con vencimiento en las próximas 24 horas.',
      action_item: 'Acción autorizada'
    },
    answers: {
      attention: {
        title: 'Lo que merece atención ahora',
        summary: 'Hay {{count}} acción(es) sustentada(s) por evidencia en el alcance autorizado de esta vista.',
        summary_clear: 'No hay acciones abiertas en el alcance autorizado de esta vista ahora. Esto no implica ausencia de actividad en dominios que aún no están conectados o autorizados.'
      },
      personal_schedule: {
        title: 'Tu próxima escala',
        summary: 'Encontré tu próxima participación en MusicScale. Hay {{pending}} respuesta(s) pendiente(s) asociada(s) al contexto disponible.',
        summary_without_responses: 'Encontré tu próxima participación en MusicScale. El resumen de respuestas aún no está disponible para esta escala.',
        insufficient: 'No encontré una próxima escala personal en una fuente autorizada y lista para consulta en este momento.'
      },
      worship_service: {
        title: 'Próxima escala de alabanza',
        summary: 'La próxima escala autorizada tiene {{pending}} confirmación(es) pendiente(s), {{declined}} rechazo(s) y {{gaps}} brecha(s) de contenido en el repertorio.',
        summary_responses_only: 'La próxima escala autorizada tiene {{pending}} confirmación(es) pendiente(s) y {{declined}} rechazo(s). La proyección del repertorio aún no está lista.',
        summary_repertoire_only: 'La próxima escala autorizada posee {{gaps}} brecha(s) verificable(s) en el repertorio. El resumen de respuestas aún no está listo.',
        insufficient: 'El alcance autorizado actual no contiene información suficiente para afirmar cómo está el domingo solicitado.'
      },
      worship_confirmations: {
        title: 'Confirmaciones de la próxima escala',
        summary: 'En la próxima escala hay {{pending}} respuesta(s) pendiente(s) y {{declined}} rechazo(s) registrado(s).',
        insufficient: 'La próxima escala existe, pero su resumen de respuestas todavía no está disponible con suficiente calidad para responder.'
      },
      worship_repertoire: {
        title: 'Preparación del repertorio',
        summary: 'La próxima escala posee {{gaps}} brecha(s) verificable(s) de contenido en el repertorio.',
        insufficient: 'No hay una próxima escala con suficiente proyección de repertorio para responder de forma segura.'
      },
      worship_distribution: {
        title: 'Distribución de servicio',
        insufficient: 'Puedo mostrar la distribución agregada, pero los datos actuales no sustentan identificar quién está “por encima de la carga” como una conclusión individual.'
      },
      journey_follow_up: {
        title: 'Seguimientos de Journey',
        summary: 'En tu alcance autorizado hay {{total}} seguimiento(s) abierto(s), {{overdue}} fuera de plazo y {{dueSoon}} con vencimiento en las próximas 24 horas.',
        summary_lower_bound: 'La lectura alcanzó el límite seguro. Se observaron al menos {{total}} seguimiento(s) abierto(s), {{overdue}} fuera de plazo y {{dueSoon}} con vencimiento en las próximas 24 horas.',
        summary_clear: 'En el alcance autorizado observado ahora, no hay seguimientos de primer contacto abiertos.',
        insufficient: 'La Journey Lens está disponible, pero la proyección autorizada de seguimiento todavía no está lista para sustentar esa respuesta.'
      },
      finance: {
        insufficient: 'El Hub todavía no tiene una fuente financiera autorizada y estructurada en este contexto que sustente responder esa pregunta.'
      },
      administration: {
        title: 'Situación administrativa',
        summary_attention: 'Hay {{count}} acción(es) administrativa(s) abierta(s) sustentada(s) por el Hub.',
        summary_clear: 'No hay acciones administrativas abiertas en el alcance autorizado actual.'
      },
      not_available: {
        title: 'Ese contexto no está disponible aquí',
        summary: 'MillionsNest no ampliará permisos ni inferirá datos de otro dominio solo para responder la pregunta.'
      },
      insufficient: {
        title: 'Aún no hay evidencia suficiente'
      },
      unsupported: {
        title: 'Todavía no puedo responder eso con seguridad',
        summary: 'Intenta preguntar sobre atención actual, tu próxima escala, confirmaciones, repertorio, distribución de alabanza o situación administrativa.'
      }
    }
  },
  sections: {
    needs_attention: 'Necesita tu atención',
    today: 'Hoy',
    this_week: 'Esta semana',
    status: 'Estado',
    insights: 'Insights y tendencias'
  }
} as const;

export default intelligence;
