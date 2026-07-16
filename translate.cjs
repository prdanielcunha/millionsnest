const fs = require('fs');

const ptContent = fs.readFileSync('src/packages/i18n/locales/pt.ts', 'utf8');
const enContent = fs.readFileSync('src/packages/i18n/locales/en.ts', 'utf8');
const esContent = fs.readFileSync('src/packages/i18n/locales/es.ts', 'utf8');

// The English translation for the center object
const enCenter = `
      center: {
            "common": {
                  "can_do": "You can",
                  "where_to_find": "Where to find",
                  "in_practice": "In practice",
                  "what_is": "What it is",
                  "why_important": "Why it's important",
                  "how_to": "How to do it",
                  "expected_result": "Expected result",
                  "important": "Important",
                  "global_collection": "Global collection",
                  "optional": "Optional"
            },
            "paths": {
                  "repertoire_songs": "Repertoire → Songs",
                  "repertoire_chords": "Repertoire → Chords",
                  "repertoire_lyrics": "Repertoire → Lyrics",
                  "live_library": "Live Library",
                  "ai_import": "Repertoire → Songs → Import with AI",
                  "members": "Members",
                  "scales_band": "Scales → Band Scales",
                  "scales_songs": "Scales → Song Scales"
            },
            "tabs": {
                  "overview": "Overview",
                  "resources": "Resources",
                  "getting_started": "Getting Started"
            },
            "badges": {
                  "recommended": "Recommended",
                  "guide": "Guide"
            },
            "overview": {
                  "start_here": "START HERE",
                  "no_team_title": "Prepare your team to use MusicScale",
                  "no_team_desc": "Invite the people who will participate in the organization and then continue the configuration inside MusicScale.",
                  "team_title": "Continue your first steps",
                  "team_desc": "Learn how to add songs to the Repertoire, consult chords and lyrics, and set up your first scales.",
                  "btn_continue": "Continue getting started",
                  "btn_invite": "Invite someone",
                  "ask_admin_invite": "Ask an organization administrator to invite the team.",
                  "resolve_payment": "Settle subscription",
                  "ask_admin_payment": "Ask the subscription manager to settle access.",
                  "summary_org": "Organization ready",                  
                  "summary_ms": "MusicScale active",
                  "summary_team": "Team started"
            },
            "resources": {
                  "title": "Get to know MusicScale inside",
                  "groups": {
                        "music_content": "Music and content",
                        "team_scales": "Team and scales"
                  },
                  "description": "Understand where songs, chords, lyrics, scales, and members are located, and how each area connects in team preparation.",
                  "flow": {
                        "live_library": "Live Library",
                        "repertoire": "Song Repertoire",
                        "chords": "Chords",
                        "lyrics": "Lyrics",
                        "music_scale": "Song Scale",
                        "members": "Members",
                        "band_scale": "Band Scale",
                        "imports_to": "imports to",
                        "supplies_songs_to": "supplies songs to",
                        "forms": "forms",
                        "can_link_to": "can link to",
                        "optional_link": "optional",
                        "notice_title": "How the Repertoire works",
                        "notice_text": "In MusicScale, Repertoire is your organization's song collection. You don't create a separate repertoire for each service. For a date or event, create a Song Scale and choose songs from the Repertoire."
                  },
                  "repertoire": {
                        "title": "Song Repertoire",
                        "desc": "It's your organization's song collection. It contains all songs registered or imported for the team.",
                        "practice": "Open a song to check its details, lyrics or chords. Then, choose this song when creating a service scale."
                  },
                  "library": {
                        "title": "Live Library",
                        "desc": "A global and updated collection of songs ready to import into your organization's Repertoire.",
                        "practice": "Find a ready song, check its content and import it into your organization's Repertoire."
                  },
                  "chords": {
                        "title": "Chords",
                        "desc": "Consult the chords of the songs that are part of your organization's Repertoire.",
                        "practice": "Quickly find the chord and key the band needs to prepare."
                  },
                  "lyrics": {
                        "title": "Lyrics",
                        "desc": "Consult the lyrics of the songs registered in the Repertoire.",
                        "practice": "Open the full lyrics to review the order and parts of the song."
                  },
                  "ai_import": {
                        "title": "Smart Import",
                        "desc": "Transform disorganized chords or lyrics into structured content for MusicScale.",
                        "notice": "Availability depends on the features included in the plan."
                  },
                  "music_scales": {
                        "title": "Song Scales",
                        "desc": "Organize the songs that will be sung and played on a date and event type.",
                        "practice": "Create the scale for Sunday service, choose the songs and link the participating band."
                  },
                  "members": {
                        "title": "Members",
                        "desc": "View the people who participate in the ministry and their specialties.",
                        "practice": "Find who plays drums, keyboard or guitar and who participates in vocals."
                  },
                  "band_scales": {
                        "title": "Band Scales",
                        "desc": "Organize the musicians, vocals, ministers and roles that will perform on a date or event.",
                        "practice": "Define lead vocal, backing vocals, keyboard, guitar, bass and drums for the service."
                  },
                  "preparation_result": {
                        "title": "Everything connected to prepare the team",
                        "text": "The Repertoire gathers the songs. Chords and Lyrics help in studying. Members form the Band Scale. The Song Scale organizes what will be presented on each date and can receive the band that will perform in that event."
                  },
                  "open_ms": "Open MusicScale"
            },
            "getting_started": {
                  "title": "First steps in MusicScale",
                  "description": "Let's prepare your organization, your team and the first workflow. You can complete each step at your own pace.",
                  "operational_notice": "The Repertoire, chords, lyrics, members and scales steps take place inside MusicScale. Open the app and follow the guidelines below.",
                  "statuses": {
                        "completed": "Completed",
                        "continue_in_ms": "Continue in MusicScale",
                        "pending": "Pending"
                  },
                  "steps": {
                        "organization": {
                              "title": "Check your organization",
                              "what": "The organization represents your church, ministry or team inside MillionsNest.",
                              "why": "That's where the people, apps and subscription are.",
                              "how": "Check if the organization's name and details are correct.",
                              "result": "Your team will easily recognize the environment upon entering.",
                              "action": "Review organization",
                              "admin_notice": "An administrator can change these details."
                        },
                        "team": {
                              "title": "Invite your team",
                              "what": "Add the people who will use MusicScale with you.",
                              "why": "Leaders, musicians and vocals will be able to access the same organization.",
                              "how": "Enter the person's email, choose access to the organization and share the invite.",
                              "result": "The person will appear in the team after accepting the invite.",
                              "action_invite": "Invite someone",
                              "action_manage": "View team and invites",
                              "admin_notice": "Ask an administrator to send the invite.",
                              "important": "The Administrator or Member role defines access to MillionsNest. Ministry roles, like musician, vocal or leader, are configured inside MusicScale."
                        },
                        "songs": {
                              "title": "Add songs to Repertoire",
                              "what": "The Repertoire gathers all your organization's songs.",
                              "why": "Repertoire songs can be chosen in Song Scales.",
                              "how": "In MusicScale, open Repertoire → Songs. Add manually, use smart import or import via Live Library.",
                              "result": "The songs used by the organization will be available in a single collection.",
                              "action": "Open MusicScale"
                        },
                        "content": {
                              "title": "Check chords and lyrics",
                              "what": "Chords and Lyrics are views of the content of the songs already in the Repertoire.",
                              "why": "The team quickly finds the necessary material to study.",
                              "how": "Open Repertoire → Chords or Repertoire → Lyrics.",
                              "result": "Musicians and vocals will have access to the necessary content for preparation.",
                              "action": "Open MusicScale"
                        },
                        "members": {
                              "title": "Organize the members",
                              "what": "The Members area gathers musicians, vocals, ministers, roles and specialties.",
                              "why": "This information helps build Band Scales more clearly.",
                              "how": "Open Members and check if roles and specialties are correct.",
                              "result": "MusicScale will know who can play each instrument or role.",
                              "action": "Open MusicScale"
                        },
                        "band_scale": {
                              "title": "Build a Band Scale",
                              "what": "The Band Scale defines who will perform and what each person's role will be.",
                              "why": "The team understands who will participate and how it will be formed.",
                              "how": "Open Scales → Band Scales, choose the members and define the roles.",
                              "result": "The band and vocals for the occasion will be organized.",
                              "action": "Open MusicScale"
                        },
                        "music_scale": {
                              "title": "Create a Song Scale",
                              "what": "The Song Scale gathers the songs for a date and event type.",
                              "why": "The team knows what will be sung and played.",
                              "how": "Open Scales → Song Scales, choose the date, event type, location and songs from Repertoire. You can also link the Band Scale.",
                              "result": "The songs and team for that event will be organized.",
                              "action": "Open MusicScale"
                        },
                        "review": {
                              "title": "Review the preparation",
                              "what": "Before the service, check if songs, lyrics, chords and members are correct.",
                              "why": "A well-informed team can prepare better.",
                              "how": "Review the Song Scale and the linked Band Scale.",
                              "result": "Everyone will have clarity on what to prepare and when to participate.",
                              "action": "Open MusicScale"
                        }
                  }
            }
      }`;

const esCenter = `
      center: {
            "common": {
                  "can_do": "Puedes",
                  "where_to_find": "Dónde encontrar",
                  "in_practice": "En la práctica",
                  "what_is": "Qué es",
                  "why_important": "Por qué es importante",
                  "how_to": "Cómo hacerlo",
                  "expected_result": "Resultado esperado",
                  "important": "Importante",
                  "global_collection": "Colección global",
                  "optional": "Opcional"
            },
            "paths": {
                  "repertoire_songs": "Repertorio → Canciones",
                  "repertoire_chords": "Repertorio → Acordes",
                  "repertoire_lyrics": "Repertorio → Letras",
                  "live_library": "Biblioteca Viva",
                  "ai_import": "Repertorio → Canciones → Importar con IA",
                  "members": "Integrantes",
                  "scales_band": "Escalas → Escalas de Banda",
                  "scales_songs": "Escalas → Escalas de Canciones"
            },
            "tabs": {
                  "overview": "Resumen",
                  "resources": "Recursos",
                  "getting_started": "Primeros pasos"
            },
            "badges": {
                  "recommended": "Recomendado",
                  "guide": "Guía"
            },
            "overview": {
                  "start_here": "EMPIEZA AQUÍ",
                  "no_team_title": "Prepara a tu equipo para usar MusicScale",
                  "no_team_desc": "Invita a las personas que participarán en la organización y luego continúa la configuración dentro de MusicScale.",
                  "team_title": "Continúa tus primeros pasos",
                  "team_desc": "Aprende a añadir canciones al Repertorio, consultar acordes y letras, y configurar tus primeras escalas.",
                  "btn_continue": "Continuar primeros pasos",
                  "btn_invite": "Invitar a alguien",
                  "ask_admin_invite": "Pide a un administrador de la organización que invite al equipo.",
                  "resolve_payment": "Regularizar suscripción",
                  "ask_admin_payment": "Pide al responsable de la suscripción que regularice el acceso.",
                  "summary_org": "Organización lista",                  
                  "summary_ms": "MusicScale activo",
                  "summary_team": "Equipo iniciado"
            },
            "resources": {
                  "title": "Conoce MusicScale por dentro",
                  "groups": {
                        "music_content": "Música y contenido",
                        "team_scales": "Equipo y escalas"
                  },
                  "description": "Entiende dónde se encuentran las canciones, acordes, letras, escalas e integrantes, y cómo cada área se conecta en la preparación del equipo.",
                  "flow": {
                        "live_library": "Biblioteca Viva",
                        "repertoire": "Repertorio de canciones",
                        "chords": "Acordes",
                        "lyrics": "Letras",
                        "music_scale": "Escala de Canciones",
                        "members": "Integrantes",
                        "band_scale": "Escala de Banda",
                        "imports_to": "importa a",
                        "supplies_songs_to": "provee canciones a",
                        "forms": "forman",
                        "can_link_to": "puede vincularse a",
                        "optional_link": "opcional",
                        "notice_title": "Cómo funciona el Repertorio",
                        "notice_text": "En MusicScale, Repertorio es la colección de canciones de tu organización. No creas un repertorio separado para cada servicio. Para una fecha o evento, crea una Escala de Canciones y elige canciones del Repertorio."
                  },
                  "repertoire": {
                        "title": "Repertorio de canciones",
                        "desc": "Es la colección de canciones de tu organización. Contiene todas las canciones registradas o importadas para el equipo.",
                        "practice": "Abre una canción para revisar sus detalles, letras o acordes. Luego, elige esta canción al crear una escala de servicio."
                  },
                  "library": {
                        "title": "Biblioteca Viva",
                        "desc": "Una colección global y actualizada de canciones listas para importar al Repertorio de tu organización.",
                        "practice": "Encuentra una canción lista, revisa su contenido e impórtala al Repertorio de tu organización."
                  },
                  "chords": {
                        "title": "Acordes",
                        "desc": "Consulta los acordes de las canciones que forman parte del Repertorio de tu organización.",
                        "practice": "Encuentra rápidamente el acorde y tono que la banda necesita preparar."
                  },
                  "lyrics": {
                        "title": "Letras",
                        "desc": "Consulta las letras de las canciones registradas en el Repertorio.",
                        "practice": "Abre la letra completa para revisar el orden y las partes de la canción."
                  },
                  "ai_import": {
                        "title": "Importación Inteligente",
                        "desc": "Transforma acordes o letras desorganizadas en contenido estructurado para MusicScale.",
                        "notice": "La disponibilidad depende de las características incluidas en el plan."
                  },
                  "music_scales": {
                        "title": "Escalas de Canciones",
                        "desc": "Organiza las canciones que se cantarán y tocarán en una fecha y tipo de evento.",
                        "practice": "Crea la escala para el servicio dominical, elige las canciones y vincula la banda que participará."
                  },
                  "members": {
                        "title": "Integrantes",
                        "desc": "Visualiza a las personas que participan en el ministerio y sus especialidades.",
                        "practice": "Encuentra quién toca la batería, teclado o guitarra y quién participa en las voces."
                  },
                  "band_scales": {
                        "title": "Escalas de Banda",
                        "desc": "Organiza a los músicos, voces, ministros y roles que participarán en una fecha o evento.",
                        "practice": "Define voz principal, coros, teclado, guitarra, bajo y batería para el servicio."
                  },
                  "preparation_result": {
                        "title": "Todo conectado para preparar al equipo",
                        "text": "El Repertorio reúne las canciones. Los Acordes y Letras ayudan en el estudio. Los Integrantes forman la Escala de Banda. La Escala de Canciones organiza lo que se presentará en cada fecha y puede recibir a la banda que participará en ese evento."
                  },
                  "open_ms": "Abrir MusicScale"
            },
            "getting_started": {
                  "title": "Primeros pasos en MusicScale",
                  "description": "Vamos a preparar tu organización, tu equipo y el primer flujo de trabajo. Puedes completar cada paso a tu ritmo.",
                  "operational_notice": "Los pasos de Repertorio, acordes, letras, integrantes y escalas ocurren dentro de MusicScale. Abre la aplicación y sigue las pautas a continuación.",
                  "statuses": {
                        "completed": "Completado",
                        "continue_in_ms": "Continuar en MusicScale",
                        "pending": "Pendiente"
                  },
                  "steps": {
                        "organization": {
                              "title": "Revisa tu organización",
                              "what": "La organización representa a tu iglesia, ministerio o equipo dentro de MillionsNest.",
                              "why": "Ahí es donde están las personas, aplicaciones y suscripción.",
                              "how": "Comprueba si el nombre y los datos de la organización son correctos.",
                              "result": "Tu equipo reconocerá fácilmente el entorno al ingresar.",
                              "action": "Revisar organización",
                              "admin_notice": "Un administrador puede cambiar estos detalles."
                        },
                        "team": {
                              "title": "Invita a tu equipo",
                              "what": "Añade a las personas que usarán MusicScale contigo.",
                              "why": "Líderes, músicos y voces podrán acceder a la misma organización.",
                              "how": "Ingresa el correo de la persona, elige el acceso a la organización y comparte la invitación.",
                              "result": "La persona aparecerá en el equipo después de aceptar la invitación.",
                              "action_invite": "Invitar a alguien",
                              "action_manage": "Ver equipo e invitaciones",
                              "admin_notice": "Pide a un administrador que envíe la invitación.",
                              "important": "El rol de Administrador o Miembro define el acceso a MillionsNest. Los roles ministeriales, como músico, voz o líder, se configuran dentro de MusicScale."
                        },
                        "songs": {
                              "title": "Añadir canciones al Repertorio",
                              "what": "El Repertorio reúne todas las canciones de tu organización.",
                              "why": "Las canciones del Repertorio se pueden elegir en las Escalas de Canciones.",
                              "how": "En MusicScale, abre Repertorio → Canciones. Añade manualmente, usa importación inteligente o importa vía Biblioteca Viva.",
                              "result": "Las canciones usadas por la organización estarán disponibles en una única colección.",
                              "action": "Abrir MusicScale"
                        },
                        "content": {
                              "title": "Revisar acordes y letras",
                              "what": "Los Acordes y Letras son vistas del contenido de las canciones que ya están en el Repertorio.",
                              "why": "El equipo encuentra rápidamente el material necesario para estudiar.",
                              "how": "Abre Repertorio → Acordes o Repertorio → Letras.",
                              "result": "Los músicos y voces tendrán acceso al contenido necesario para la preparación.",
                              "action": "Abrir MusicScale"
                        },
                        "members": {
                              "title": "Organizar los integrantes",
                              "what": "El área de Integrantes reúne a músicos, voces, ministros, roles y especialidades.",
                              "why": "Esta información ayuda a construir Escalas de Banda más claramente.",
                              "how": "Abre Integrantes y comprueba si los roles y especialidades son correctos.",
                              "result": "MusicScale sabrá quién puede tocar cada instrumento o rol.",
                              "action": "Abrir MusicScale"
                        },
                        "band_scale": {
                              "title": "Construir una Escala de Banda",
                              "what": "La Escala de Banda define quién participará y cuál será el rol de cada persona.",
                              "why": "El equipo entiende quién participará y cómo se formará.",
                              "how": "Abre Escalas → Escalas de Banda, elige los integrantes y define los roles.",
                              "result": "La banda y voces para la ocasión estarán organizadas.",
                              "action": "Abrir MusicScale"
                        },
                        "music_scale": {
                              "title": "Crear una Escala de Canciones",
                              "what": "La Escala de Canciones reúne las canciones para una fecha y tipo de evento.",
                              "why": "El equipo sabe lo que se cantará y tocará.",
                              "how": "Abre Escalas → Escalas de Canciones, elige la fecha, tipo de evento, ubicación y canciones del Repertorio. También puedes vincular la Escala de Banda.",
                              "result": "Las canciones y el equipo para ese evento estarán organizados.",
                              "action": "Abrir MusicScale"
                        },
                        "review": {
                              "title": "Revisar la preparación",
                              "what": "Antes del servicio, comprueba si las canciones, letras, acordes e integrantes son correctos.",
                              "why": "Un equipo bien informado puede prepararse mejor.",
                              "how": "Revisa la Escala de Canciones y la Escala de Banda vinculada.",
                              "result": "Todos tendrán claridad sobre qué preparar y cuándo participar.",
                              "action": "Abrir MusicScale"
                        }
                  }
            }
      }`;

// Regex to replace the center object
function replaceCenter(content, newCenter) {
    const startIdx = content.indexOf('center: {');
    if (startIdx === -1) return content;
    
    // Find the matching closing brace for center
    let braceCount = 0;
    let endIdx = -1;
    for (let i = startIdx + 8; i < content.length; i++) {
        if (content[i] === '{') braceCount++;
        else if (content[i] === '}') {
            braceCount--;
            if (braceCount === 0) {
                endIdx = i;
                break;
            }
        }
    }
    
    if (endIdx !== -1) {
        return content.substring(0, startIdx) + newCenter + content.substring(endIdx + 1);
    }
    return content;
}

const finalEn = replaceCenter(enContent, enCenter);
const finalEs = replaceCenter(esContent, esCenter);

fs.writeFileSync('src/packages/i18n/locales/en.ts', finalEn);
fs.writeFileSync('src/packages/i18n/locales/es.ts', finalEs);

console.log('en.ts and es.ts updated.');

