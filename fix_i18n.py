import re

def fix_locale(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Remove all occurrences of `email_hint: "...",` EXCEPT the first one.
    # Actually wait, I probably inserted it twice. Let's just find the exact line and remove the old one.
    # The old one might be `email_hint: 'Opcional. O convite pode ser vinculado a este e-mail.',`
    content = re.sub(r'email_hint: "Opcional. La invitación se puede vincular a este correo.",?\n?', '', content)
    content = re.sub(r'email_hint: "Optional. The invite can be linked to this email.",?\n?', '', content)
    content = re.sub(r'email_hint: "Opcional. O convite pode ser vinculado a este e-mail.",?\n?', '', content)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

fix_locale('src/packages/i18n/locales/pt.ts')
fix_locale('src/packages/i18n/locales/en.ts')
fix_locale('src/packages/i18n/locales/es.ts')
print("Locales fixed.")
