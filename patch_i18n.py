import re

def update_locale(file_path, locale):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    keys = {
        'pt': {
            'email_hint': 'Use o e-mail que a pessoa usará para entrar. O convite ficará protegido para essa conta.',
            'email_required': 'Informe o e-mail da pessoa.',
            'role_admin': 'Administrador',
            'role_member': 'Membro',
            'role_explanation': 'Esta função define o acesso à organização. Funções ministeriais, como líder, músico ou vocal, são configuradas dentro do MusicScale.',
            'creating': 'Criando convite...',
            'created_securely': 'Convite criado com segurança.',
            'whatsapp_opened': 'WhatsApp aberto com o convite.',
            'popup_blocked': 'O convite foi criado. Copie o link abaixo ou permita pop-ups para abrir o WhatsApp.',
            'clipboard_blocked': 'O convite foi criado, mas o navegador não permitiu copiar automaticamente.',
            'manual_link_label': 'Link do convite',
            'close': 'Fechar',
            'errors': {
                'session_expired': 'Sua sessão expirou. Atualize a página e tente novamente.',
                'invalid_email': 'Informe um e-mail válido.',
                'invalid_role': 'Escolha uma função válida.',
                'permission_denied': 'Você não possui permissão para convidar pessoas nesta organização.',
                'organization_not_found': 'A organização selecionada não foi encontrada.',
                'organization_inactive': 'Esta organização não está ativa.',
                'already_pending': 'Já existe um convite pendente para este e-mail. Revogue o convite anterior antes de criar outro.',
                'member_limit': 'O limite de pessoas do plano foi atingido.',
                'limit_unavailable': 'Não foi possível confirmar o limite do plano agora. Tente novamente.',
                'timeout': 'A criação do convite demorou mais que o esperado. Verifique sua conexão antes de tentar novamente.',
                'generic': 'Não foi possível criar o convite. Tente novamente.',
                'organizations_load': 'Não foi possível carregar a lista de organizações.'
            }
        },
        'en': {
            'email_hint': 'Use the email the person will log in with. The invite will be secured for this account.',
            'email_required': "Enter the person's email.",
            'role_admin': 'Administrator',
            'role_member': 'Member',
            'role_explanation': 'This role defines access to the organization. Ministerial roles, such as leader, musician, or vocalist, are configured inside MusicScale.',
            'creating': 'Creating invite...',
            'created_securely': 'Invite created securely.',
            'whatsapp_opened': 'WhatsApp opened with the invite.',
            'popup_blocked': 'Invite created. Copy the link below or allow pop-ups to open WhatsApp.',
            'clipboard_blocked': 'Invite created, but the browser blocked automatic copying.',
            'manual_link_label': 'Invite link',
            'close': 'Close',
            'errors': {
                'session_expired': 'Your session has expired. Refresh the page and try again.',
                'invalid_email': 'Enter a valid email.',
                'invalid_role': 'Choose a valid role.',
                'permission_denied': 'You do not have permission to invite people to this organization.',
                'organization_not_found': 'The selected organization was not found.',
                'organization_inactive': 'This organization is not active.',
                'already_pending': 'A pending invite already exists for this email. Revoke the previous invite before creating another one.',
                'member_limit': "The plan's member limit has been reached.",
                'limit_unavailable': 'Could not confirm the plan limit right now. Try again.',
                'timeout': 'Creating the invite took longer than expected. Check your connection before trying again.',
                'generic': 'Could not create the invite. Try again.',
                'organizations_load': 'Could not load the organizations list.'
            }
        },
        'es': {
            'email_hint': 'Usa el correo con el que la persona iniciará sesión. La invitación estará protegida para esta cuenta.',
            'email_required': 'Ingresa el correo de la persona.',
            'role_admin': 'Administrador',
            'role_member': 'Miembro',
            'role_explanation': 'Este rol define el acceso a la organización. Los roles ministeriales, como líder, músico o vocalista, se configuran dentro de MusicScale.',
            'creating': 'Creando invitación...',
            'created_securely': 'Invitación creada de forma segura.',
            'whatsapp_opened': 'WhatsApp abierto con la invitación.',
            'popup_blocked': 'Invitación creada. Copia el enlace a continuación o permite ventanas emergentes para abrir WhatsApp.',
            'clipboard_blocked': 'Invitación creada, pero el navegador no permitió copiar automáticamente.',
            'manual_link_label': 'Enlace de la invitación',
            'close': 'Cerrar',
            'errors': {
                'session_expired': 'Tu sesión ha expirado. Actualiza la página e inténtalo de nuevo.',
                'invalid_email': 'Ingresa un correo válido.',
                'invalid_role': 'Elige un rol válido.',
                'permission_denied': 'No tienes permiso para invitar personas a esta organización.',
                'organization_not_found': 'La organización seleccionada no fue encontrada.',
                'organization_inactive': 'Esta organización no está activa.',
                'already_pending': 'Ya existe una invitación pendiente para este correo. Revoca la invitación anterior antes de crear otra.',
                'member_limit': 'Se ha alcanzado el límite de miembros del plan.',
                'limit_unavailable': 'No se pudo confirmar el límite del plan en este momento. Inténtalo de nuevo.',
                'timeout': 'La creación de la invitación tomó más tiempo del esperado. Verifica tu conexión antes de intentarlo de nuevo.',
                'generic': 'No se pudo crear la invitación. Inténtalo de nuevo.',
                'organizations_load': 'No se pudo cargar la lista de organizaciones.'
            }
        }
    }
    
    inject_str = ""
    for k, v in keys[locale].items():
        if k == 'errors':
            inject_str += f"      errors: {{\n"
            for ek, ev in v.items():
                inject_str += f"        {ek}: \"{ev}\",\n"
            inject_str += f"      }},\n"
        else:
            inject_str += f"      {k}: \"{v}\",\n"
            
    # Find the "invite: {" block
    pattern = r'(invite:\s*\{)'
    replacement = r'\1\n' + inject_str
    
    new_content = re.sub(pattern, replacement, content, count=1)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)

update_locale('src/packages/i18n/locales/pt.ts', 'pt')
update_locale('src/packages/i18n/locales/en.ts', 'en')
update_locale('src/packages/i18n/locales/es.ts', 'es')
print("Locales updated.")
