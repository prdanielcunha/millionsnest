import re
import os

locales = ['pt.ts', 'en.ts', 'es.ts']
dir_path = 'src/packages/i18n/locales/'

dashboard_translations = {
    'pt': """
  dashboard: {
    navigation: {
      home: "Início",
      my_apps: "Meus aplicativos",
      overview: "Início"
    },
    workspace: {
      intro: "Seus aplicativos, organização e equipe em um só lugar",
      open_main_app: "Abrir aplicativo principal"
    },
    musicscale: {
      hero: {
        title: "Seu ministério organizado em um só lugar",
        open: "Abrir MusicScale",
        learn_more: "Conhecer recursos",
        unavailable: "Indisponível"
      },
      status: {
        active: "Ativo",
        trialing: "Teste",
        payment_issue: "Problema no pagamento",
        unavailable: "Indisponível"
      },
      checklist: {
        title: "Comece por aqui",
        org_active: "Organização ativa",
        ms_active: "MusicScale ativado",
        team_started: "Equipe iniciada",
        roles_defined: "Funções definidas",
        action_invite: "Convide sua equipe",
        action_open: "Abra o MusicScale e comece a organizar seu ministério",
        completed: "{{count}} concluído"
      },
      actions: {
        title: "Ações rápidas",
        open: "Abrir MusicScale",
        invite: "Convidar pessoas",
        manage_team: "Gerenciar equipe",
        view_sub: "Ver assinatura",
        learn_more: "Conhecer recursos",
        need_help: "Preciso de ajuda"
      },
      team: {
        title: "Equipe",
        desc: "Convide líderes, músicos e vocais para trabalharem na mesma organização.",
        members: "{{count}} membros",
        invites: "{{count}} convites",
        slots: "{{used}}/{{total}} vagas",
        slots_unlimited: "{{used}} vagas (ilimitado)",
        go_to_invites: "Ir para convites",
        manage_team: "Gerenciar equipe"
      },
      features: {
        title: "Recursos do MusicScale",
        repertoire: "Repertórios",
        repertoire_desc: "Gerencie o acervo da igreja",
        scales: "Escalas",
        scales_desc: "Organize as ministrações",
        musicians: "Músicos",
        musicians_desc: "Gerencie perfis e funções",
        preparation: "Preparação",
        preparation_desc: "Arquivos e ensaios",
        open: "Abrir MusicScale"
      },
      help: {
        title: "Não sabe por onde começar?",
        desc: "Conheça os recursos do MusicScale ou fale com nossa equipe.",
        how_it_works: "Ver como funciona",
        contact_support: "Falar com suporte"
      }
    },
    genericApp: {
      open: "Abrir App"
    }
  }
""",
    'en': """
  dashboard: {
    navigation: {
      home: "Home",
      my_apps: "My apps",
      overview: "Home"
    },
    workspace: {
      intro: "Your apps, organization, and team in one place",
      open_main_app: "Open main app"
    },
    musicscale: {
      hero: {
        title: "Your ministry organized in one place",
        open: "Open MusicScale",
        learn_more: "Learn features",
        unavailable: "Unavailable"
      },
      status: {
        active: "Active",
        trialing: "Trial",
        payment_issue: "Payment issue",
        unavailable: "Unavailable"
      },
      checklist: {
        title: "Start here",
        org_active: "Active organization",
        ms_active: "MusicScale activated",
        team_started: "Team started",
        roles_defined: "Roles defined",
        action_invite: "Invite your team",
        action_open: "Open MusicScale and start organizing your ministry",
        completed: "{{count}} completed"
      },
      actions: {
        title: "Quick actions",
        open: "Open MusicScale",
        invite: "Invite people",
        manage_team: "Manage team",
        view_sub: "View subscription",
        learn_more: "Learn features",
        need_help: "I need help"
      },
      team: {
        title: "Team",
        desc: "Invite leaders, musicians, and vocalists to work in the same organization.",
        members: "{{count}} members",
        invites: "{{count}} invites",
        slots: "{{used}}/{{total}} slots",
        slots_unlimited: "{{used}} slots (unlimited)",
        go_to_invites: "Go to invites",
        manage_team: "Manage team"
      },
      features: {
        title: "MusicScale Features",
        repertoire: "Repertoires",
        repertoire_desc: "Manage church's catalog",
        scales: "Scales",
        scales_desc: "Organize ministrations",
        musicians: "Musicians",
        musicians_desc: "Manage profiles and roles",
        preparation: "Preparation",
        preparation_desc: "Files and rehearsals",
        open: "Open MusicScale"
      },
      help: {
        title: "Don't know where to start?",
        desc: "Learn about MusicScale features or talk to our team.",
        how_it_works: "See how it works",
        contact_support: "Contact support"
      }
    },
    genericApp: {
      open: "Open App"
    }
  }
""",
    'es': """
  dashboard: {
    navigation: {
      home: "Inicio",
      my_apps: "Mis aplicaciones",
      overview: "Inicio"
    },
    workspace: {
      intro: "Tus aplicaciones, organización y equipo en un solo lugar",
      open_main_app: "Abrir aplicación principal"
    },
    musicscale: {
      hero: {
        title: "Tu ministerio organizado en un solo lugar",
        open: "Abrir MusicScale",
        learn_more: "Conocer características",
        unavailable: "No disponible"
      },
      status: {
        active: "Activo",
        trialing: "Prueba",
        payment_issue: "Problema de pago",
        unavailable: "No disponible"
      },
      checklist: {
        title: "Empieza por aquí",
        org_active: "Organización activa",
        ms_active: "MusicScale activado",
        team_started: "Equipo iniciado",
        roles_defined: "Funciones definidas",
        action_invite: "Invita a tu equipo",
        action_open: "Abre MusicScale y comienza a organizar tu ministerio",
        completed: "{{count}} completado"
      },
      actions: {
        title: "Acciones rápidas",
        open: "Abrir MusicScale",
        invite: "Invitar personas",
        manage_team: "Gestionar equipo",
        view_sub: "Ver suscripción",
        learn_more: "Conocer características",
        need_help: "Necesito ayuda"
      },
      team: {
        title: "Equipo",
        desc: "Invita a líderes, músicos y vocalistas a trabajar en la misma organización.",
        members: "{{count}} miembros",
        invites: "{{count}} invitaciones",
        slots: "{{used}}/{{total}} cupos",
        slots_unlimited: "{{used}} cupos (ilimitado)",
        go_to_invites: "Ir a invitaciones",
        manage_team: "Gestionar equipo"
      },
      features: {
        title: "Características de MusicScale",
        repertoire: "Repertorios",
        repertoire_desc: "Gestiona el catálogo de la iglesia",
        scales: "Escalas",
        scales_desc: "Organiza las ministraciones",
        musicians: "Músicos",
        musicians_desc: "Gestiona perfiles y roles",
        preparation: "Preparación",
        preparation_desc: "Archivos y ensayos",
        open: "Abrir MusicScale"
      },
      help: {
        title: "¿No sabes por dónde empezar?",
        desc: "Conoce las características de MusicScale o habla con nuestro equipo.",
        how_it_works: "Ver cómo funciona",
        contact_support: "Contactar soporte"
      }
    },
    genericApp: {
      open: "Abrir App"
    }
  }
"""
}

for lang in locales:
    lang_code = lang.split('.')[0]
    file_path = os.path.join(dir_path, lang)
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # insert before the last closing brace
    # find the last occurrence of '}'
    last_brace_idx = content.rfind('}')
    
    if last_brace_idx != -1:
        new_content = content[:last_brace_idx] + "," + dashboard_translations[lang_code] + content[last_brace_idx:]
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
    else:
        print(f"Could not find closing brace in {lang}")
