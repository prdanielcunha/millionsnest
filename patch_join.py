import re

with open('src/pages/Join.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace validateAndAcceptInvite
new_func = """  const validateAndAcceptInvite = async () => {
    if (!user) {
      setStatus('error');
      setErrorMessage(t('feedback.error'));
      return;
    }

    try {
      const idToken = await user.getIdToken();
      
      const res = await fetch('/api/v1/invitations/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ token })
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        setInviteData({ organizationName: data.organizationName });
        if (data.alreadyMember) {
           setStatus('already_member');
        } else {
           setStatus('success');
        }
        sessionStorage.removeItem('mn_invite_redirect');
        
        setTimeout(() => {
          // Tell context to refresh or just reload to get new profile 
          // For now window.location.href forces full bootstrap check with new member
          window.location.href = '/dashboard';
        }, 3000);
      } else {
        setStatus('error');
        if (data.reasonCode === 'INVITE_EXPIRED') setErrorMessage('Este convite expirou.');
        else if (data.reasonCode === 'INVITE_REVOKED') setErrorMessage('Este convite foi revogado.');
        else if (data.reasonCode === 'INVITE_ALREADY_CONSUMED') setErrorMessage('Este convite já foi utilizado.');
        else if (data.reasonCode === 'INVITE_IDENTITY_MISMATCH') setErrorMessage('Este convite não pertence a este email.');
        else if (data.reasonCode === 'MEMBER_LIMIT_REACHED') setErrorMessage('Esta organização atingiu o limite de membros do plano.');
        else if (data.reasonCode === 'INVITE_NOT_FOUND') setErrorMessage('Convite não encontrado ou inválido.');
        else if (data.reasonCode === 'ORGANIZATION_INACTIVE') setErrorMessage('A organização está inativa.');
        else setErrorMessage('Ocorreu um erro ao processar o convite.');
      }
    } catch (e: any) {
      console.error(e);
      setStatus('error');
      setErrorMessage('Erro de comunicação. Tente novamente.');
    }
  };"""

content = re.sub(r"  const validateAndAcceptInvite = async \(\) => \{[\s\S]*?    \} catch \(e: any\) \{\n      console.error\(e\);\n      setStatus\('error'\);\n      setErrorMessage\(e.message \|\| 'Ocorreu um erro ao processar o convite.'\);\n    \}\n  \};", new_func, content)

with open('src/pages/Join.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
