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
    view_start: 'Ver cómo empezar'
  },
  evidence: {
    source_label: 'Fuente',
    verified_fact: 'Hecho verificado',
    unavailable: 'Fuente no disponible',
    no_source_no_claim: 'Sin fuente, no hay afirmación.'
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
