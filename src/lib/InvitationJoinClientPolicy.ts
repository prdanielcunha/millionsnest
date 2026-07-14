export type InvitationJoinLanguage = 'pt' | 'en' | 'es';

export type InvitationJoinFailureReason =
  | 'UNAUTHENTICATED'
  | 'INVALID_TOKEN'
  | 'AUTHENTICATED_EMAIL_REQUIRED'
  | 'INVALID_INVITE_ROLE'
  | 'INVITE_IDENTITY_MISMATCH'
  | 'INVITE_NOT_FOUND'
  | 'ORGANIZATION_NOT_FOUND'
  | 'ORGANIZATION_INACTIVE'
  | 'INVITE_STATE_INCONSISTENT'
  | 'INVITE_REVOKED'
  | 'INVITE_EXPIRED'
  | 'INVITE_MAX_USES_REACHED'
  | 'MEMBERSHIP_INACTIVE'
  | 'MEMBERSHIP_STATE_INCONSISTENT'
  | 'INVITE_ALREADY_CONSUMED'
  | 'MEMBER_LIMIT_UNAVAILABLE'
  | 'MEMBER_LIMIT_INVALID'
  | 'MEMBER_LIMIT_REACHED'
  | 'INTERNAL_ERROR'
  | 'NETWORK_ERROR'
  | 'INVALID_RESPONSE';

export function normalizeInvitationJoinLanguage(value: unknown): InvitationJoinLanguage {
  if (typeof value !== 'string') return 'pt';
  const v = value.toLowerCase();
  if (v === 'pt' || v.startsWith('pt-')) return 'pt';
  if (v === 'en' || v.startsWith('en-')) return 'en';
  if (v === 'es' || v.startsWith('es-')) return 'es';
  return 'pt';
}

export type InvitationJoinSuccessPayload = {
  success: true;
  organizationId: string;
  organizationName: string;
  activeOrganizationId: string;
  membershipRole: 'owner' | 'admin' | 'member';
  alreadyMember: boolean;
  legacyTokenMigrated: false;
  reasonCode: 'ALREADY_MEMBER' | 'INVITATION_CAN_BE_ACCEPTED';
};

export type InvitationJoinFailurePayload = {
  success: false;
  reasonCode: InvitationJoinFailureReason;
};

export function isInvitationJoinFailureReason(value: unknown): value is InvitationJoinFailureReason {
  if (typeof value !== 'string') return false;
  const reasonsMap: Record<string, boolean> = {
    UNAUTHENTICATED: true, INVALID_TOKEN: true, AUTHENTICATED_EMAIL_REQUIRED: true, INVALID_INVITE_ROLE: true,
    INVITE_IDENTITY_MISMATCH: true, INVITE_NOT_FOUND: true, ORGANIZATION_NOT_FOUND: true, ORGANIZATION_INACTIVE: true,
    INVITE_STATE_INCONSISTENT: true, INVITE_REVOKED: true, INVITE_EXPIRED: true, INVITE_MAX_USES_REACHED: true,
    MEMBERSHIP_INACTIVE: true, MEMBERSHIP_STATE_INCONSISTENT: true, INVITE_ALREADY_CONSUMED: true,
    MEMBER_LIMIT_UNAVAILABLE: true, MEMBER_LIMIT_INVALID: true, MEMBER_LIMIT_REACHED: true,
    INTERNAL_ERROR: true, NETWORK_ERROR: true, INVALID_RESPONSE: true
  };
  return reasonsMap[value] === true;
}

export function parseInvitationJoinPayload(value: unknown): InvitationJoinSuccessPayload | InvitationJoinFailurePayload {
  if (!value || typeof value !== 'object') {
    return { success: false, reasonCode: 'INVALID_RESPONSE' };
  }

  const record = value as Record<string, unknown>;

  if (record.success === true) {
    if (typeof record.organizationId !== 'string' || record.organizationId.trim() === '') return { success: false, reasonCode: 'INVALID_RESPONSE' };
    if (typeof record.organizationName !== 'string') return { success: false, reasonCode: 'INVALID_RESPONSE' };
    if (typeof record.activeOrganizationId !== 'string' || record.activeOrganizationId.trim() === '') return { success: false, reasonCode: 'INVALID_RESPONSE' };
    if (record.organizationId !== record.activeOrganizationId) return { success: false, reasonCode: 'INVALID_RESPONSE' };
    
    if (record.membershipRole !== 'owner' && record.membershipRole !== 'admin' && record.membershipRole !== 'member') {
       return { success: false, reasonCode: 'INVALID_RESPONSE' };
    }
    if (typeof record.alreadyMember !== 'boolean') return { success: false, reasonCode: 'INVALID_RESPONSE' };
    if (record.legacyTokenMigrated !== false) return { success: false, reasonCode: 'INVALID_RESPONSE' };

    const rawReason = record.reasonCode;
    if (record.alreadyMember === true && rawReason !== 'ALREADY_MEMBER') return { success: false, reasonCode: 'INVALID_RESPONSE' };
    if (record.alreadyMember === false && rawReason !== 'INVITATION_CAN_BE_ACCEPTED') return { success: false, reasonCode: 'INVALID_RESPONSE' };

    const finalReason = rawReason === 'ALREADY_MEMBER' ? 'ALREADY_MEMBER' : 'INVITATION_CAN_BE_ACCEPTED';

    return {
      success: true,
      organizationId: record.organizationId,
      organizationName: record.organizationName,
      activeOrganizationId: record.activeOrganizationId,
      membershipRole: record.membershipRole,
      alreadyMember: record.alreadyMember,
      legacyTokenMigrated: false,
      reasonCode: finalReason
    };
  }

  if (record.success === false) {
    const rawReason = record.reasonCode;
    if (isInvitationJoinFailureReason(rawReason)) {
      return { success: false, reasonCode: rawReason };
    }
    
    return { success: false, reasonCode: 'INVALID_RESPONSE' };
  }

  return { success: false, reasonCode: 'INVALID_RESPONSE' };
}

export type InvitationJoinMessage = {
  title: string;
  description: string;
  retryable: boolean;
};

export function getInvitationJoinMessage(
  reasonCode: InvitationJoinFailureReason,
  language: InvitationJoinLanguage
): InvitationJoinMessage {
  const retryable = ['MEMBER_LIMIT_UNAVAILABLE', 'INTERNAL_ERROR', 'NETWORK_ERROR', 'INVALID_RESPONSE'].includes(reasonCode);

  const messages: Record<InvitationJoinLanguage, Record<InvitationJoinFailureReason, { title: string; description: string }>> = {
    pt: {
      UNAUTHENTICATED: { title: 'Não autenticado', description: 'Você precisa estar logado para aceitar este convite.' },
      INVALID_TOKEN: { title: 'Token inválido', description: 'O link do convite está incompleto ou inválido.' },
      AUTHENTICATED_EMAIL_REQUIRED: { title: 'Email não verificado', description: 'Você precisa ter um email autenticado para aceitar o convite.' },
      INVALID_INVITE_ROLE: { title: 'Permissão inválida', description: 'O convite possui uma permissão inválida e não pode ser aceito.' },
      INVITE_IDENTITY_MISMATCH: { title: 'Convite não autorizado', description: 'Este convite não foi enviado para o seu endereço de email.' },
      INVITE_NOT_FOUND: { title: 'Convite não encontrado', description: 'O convite não existe ou já foi removido.' },
      ORGANIZATION_NOT_FOUND: { title: 'Organização não encontrada', description: 'A organização deste convite não existe mais.' },
      ORGANIZATION_INACTIVE: { title: 'Organização inativa', description: 'A organização encontra-se inativa no momento.' },
      INVITE_STATE_INCONSISTENT: { title: 'Convite inconsistente', description: 'Os dados do convite estão inconsistentes.' },
      INVITE_REVOKED: { title: 'Convite revogado', description: 'Este convite foi cancelado pela organização.' },
      INVITE_EXPIRED: { title: 'Convite expirado', description: 'O prazo de validade deste convite já terminou.' },
      INVITE_MAX_USES_REACHED: { title: 'Limite atingido', description: 'O número máximo de usos deste convite foi alcançado.' },
      MEMBERSHIP_INACTIVE: { title: 'Conta inativa', description: 'Sua conta nesta organização está inativa ou suspensa.' },
      MEMBERSHIP_STATE_INCONSISTENT: { title: 'Estado inconsistente', description: 'Os dados do seu acesso estão inconsistentes.' },
      INVITE_ALREADY_CONSUMED: { title: 'Convite consumido', description: 'Este convite já foi aceito e não pode ser reutilizado.' },
      MEMBER_LIMIT_UNAVAILABLE: { title: 'Serviço indisponível', description: 'Não foi possível verificar os limites de acesso. Tente novamente mais tarde.' },
      MEMBER_LIMIT_INVALID: { title: 'Limite inválido', description: 'Há um problema na configuração de limites da organização.' },
      MEMBER_LIMIT_REACHED: { title: 'Limite excedido', description: 'A organização atingiu o número máximo de membros permitido no plano atual.' },
      INTERNAL_ERROR: { title: 'Erro interno', description: 'Ocorreu um erro inesperado em nossos servidores. Tente novamente.' },
      NETWORK_ERROR: { title: 'Erro de conexão', description: 'Verifique sua conexão com a internet e tente novamente.' },
      INVALID_RESPONSE: { title: 'Resposta inválida', description: 'O servidor retornou uma resposta inesperada. Tente novamente.' }
    },
    en: {
      UNAUTHENTICATED: { title: 'Unauthenticated', description: 'You must be logged in to accept this invitation.' },
      INVALID_TOKEN: { title: 'Invalid token', description: 'The invitation link is incomplete or invalid.' },
      AUTHENTICATED_EMAIL_REQUIRED: { title: 'Unverified email', description: 'You must have an authenticated email to accept the invitation.' },
      INVALID_INVITE_ROLE: { title: 'Invalid role', description: 'The invitation has an invalid role and cannot be accepted.' },
      INVITE_IDENTITY_MISMATCH: { title: 'Unauthorized invitation', description: 'This invitation was not sent to your email address.' },
      INVITE_NOT_FOUND: { title: 'Invitation not found', description: 'The invitation does not exist or has been removed.' },
      ORGANIZATION_NOT_FOUND: { title: 'Organization not found', description: 'The organization for this invitation no longer exists.' },
      ORGANIZATION_INACTIVE: { title: 'Inactive organization', description: 'The organization is currently inactive.' },
      INVITE_STATE_INCONSISTENT: { title: 'Inconsistent invitation', description: 'The invitation data is inconsistent.' },
      INVITE_REVOKED: { title: 'Invitation revoked', description: 'This invitation was cancelled by the organization.' },
      INVITE_EXPIRED: { title: 'Invitation expired', description: 'The validity period for this invitation has ended.' },
      INVITE_MAX_USES_REACHED: { title: 'Limit reached', description: 'The maximum number of uses for this invitation has been reached.' },
      MEMBERSHIP_INACTIVE: { title: 'Inactive account', description: 'Your account in this organization is inactive or suspended.' },
      MEMBERSHIP_STATE_INCONSISTENT: { title: 'Inconsistent state', description: 'Your access data is inconsistent.' },
      INVITE_ALREADY_CONSUMED: { title: 'Invitation consumed', description: 'This invitation has already been accepted and cannot be reused.' },
      MEMBER_LIMIT_UNAVAILABLE: { title: 'Service unavailable', description: 'We could not verify the access limits. Please try again later.' },
      MEMBER_LIMIT_INVALID: { title: 'Invalid limit', description: 'There is a problem with the organization limit configuration.' },
      MEMBER_LIMIT_REACHED: { title: 'Limit exceeded', description: 'The organization has reached the maximum number of members allowed in the current plan.' },
      INTERNAL_ERROR: { title: 'Internal error', description: 'An unexpected error occurred on our servers. Please try again.' },
      NETWORK_ERROR: { title: 'Connection error', description: 'Check your internet connection and try again.' },
      INVALID_RESPONSE: { title: 'Invalid response', description: 'The server returned an unexpected response. Please try again.' }
    },
    es: {
      UNAUTHENTICATED: { title: 'No autenticado', description: 'Debes iniciar sesión para aceptar esta invitación.' },
      INVALID_TOKEN: { title: 'Token inválido', description: 'El enlace de la invitación está incompleto o es inválido.' },
      AUTHENTICATED_EMAIL_REQUIRED: { title: 'Correo no verificado', description: 'Debes tener un correo autenticado para aceptar la invitación.' },
      INVALID_INVITE_ROLE: { title: 'Rol inválido', description: 'La invitación tiene un rol inválido y no puede ser aceptada.' },
      INVITE_IDENTITY_MISMATCH: { title: 'Invitación no autorizada', description: 'Esta invitación no fue enviada a tu dirección de correo.' },
      INVITE_NOT_FOUND: { title: 'Invitación no encontrada', description: 'La invitación no existe o ha sido eliminada.' },
      ORGANIZATION_NOT_FOUND: { title: 'Organización no encontrada', description: 'La organización de esta invitación ya no existe.' },
      ORGANIZATION_INACTIVE: { title: 'Organización inactiva', description: 'La organización se encuentra inactiva en este momento.' },
      INVITE_STATE_INCONSISTENT: { title: 'Invitación inconsistente', description: 'Los datos de la invitación son inconsistentes.' },
      INVITE_REVOKED: { title: 'Invitación revocada', description: 'Esta invitación fue cancelada por la organización.' },
      INVITE_EXPIRED: { title: 'Invitación caducada', description: 'El período de validez de esta invitación ha finalizado.' },
      INVITE_MAX_USES_REACHED: { title: 'Límite alcanzado', description: 'Se ha alcanzado el número máximo de usos para esta invitación.' },
      MEMBERSHIP_INACTIVE: { title: 'Cuenta inactiva', description: 'Tu cuenta en esta organización está inactiva o suspendida.' },
      MEMBERSHIP_STATE_INCONSISTENT: { title: 'Estado inconsistente', description: 'Los datos de tu acceso son inconsistentes.' },
      INVITE_ALREADY_CONSUMED: { title: 'Invitación consumida', description: 'Esta invitación ya fue aceptada y no puede ser reutilizada.' },
      MEMBER_LIMIT_UNAVAILABLE: { title: 'Servicio no disponible', description: 'No pudimos verificar los límites de acceso. Inténtalo de nuevo más tarde.' },
      MEMBER_LIMIT_INVALID: { title: 'Límite inválido', description: 'Hay un problema con la configuración de límites de la organización.' },
      MEMBER_LIMIT_REACHED: { title: 'Límite excedido', description: 'La organización ha alcanzado el número máximo de miembros permitido en el plan actual.' },
      INTERNAL_ERROR: { title: 'Error interno', description: 'Ocurrió un error inesperado en nuestros servidores. Inténtalo de nuevo.' },
      NETWORK_ERROR: { title: 'Error de conexión', description: 'Verifica tu conexión a internet e inténtalo de nuevo.' },
      INVALID_RESPONSE: { title: 'Respuesta inválida', description: 'El servidor devolvió una respuesta inesperada. Inténtalo de nuevo.' }
    }
  };

  const copy = messages[language][reasonCode];
  return {
    title: copy.title,
    description: copy.description,
    retryable
  };
}

export function getInvitationJoinSuccessCopy(
  alreadyMember: boolean,
  organizationName: string,
  language: InvitationJoinLanguage
): { title: string; description: string; redirectLabel: string } {
  if (language === 'en') {
    return {
      title: alreadyMember ? 'All Set!' : 'Invitation Accepted Successfully!',
      description: alreadyMember 
        ? `You were already a part of ${organizationName}.` 
        : `You are now a part of the organization ${organizationName}.`,
      redirectLabel: 'Redirecting to dashboard...'
    };
  }

  if (language === 'es') {
    return {
      title: alreadyMember ? '¡Todo Listo!' : '¡Invitación Aceptada con Éxito!',
      description: alreadyMember 
        ? `Ya eras parte de ${organizationName}.` 
        : `Ahora eres parte de la organización ${organizationName}.`,
      redirectLabel: 'Redirigiendo al panel...'
    };
  }

  return {
    title: alreadyMember ? 'Tudo Certo!' : 'Convite Aceito com Sucesso!',
    description: alreadyMember 
      ? `Você já fazia parte de ${organizationName}.` 
      : `Você agora faz parte da organização ${organizationName}.`,
    redirectLabel: 'Redirecionando para o painel...'
  };
}

export type InvitationJoinUiCopy = {
  validatingTitle: string;
  validatingDescription: string;
  retryLabel: string;
  dashboardLabel: string;
};

export function getInvitationJoinUiCopy(language: InvitationJoinLanguage): InvitationJoinUiCopy {
  if (language === 'en') {
    return {
      validatingTitle: 'Validating invitation...',
      validatingDescription: 'Please wait a moment.',
      retryLabel: 'Try again',
      dashboardLabel: 'Go to my Dashboard'
    };
  }
  if (language === 'es') {
    return {
      validatingTitle: 'Validando invitación...',
      validatingDescription: 'Por favor, espera un momento.',
      retryLabel: 'Intentar de nuevo',
      dashboardLabel: 'Ir a mi Panel'
    };
  }
  return {
    validatingTitle: 'Validando convite...',
    validatingDescription: 'Por favor, aguarde um momento.',
    retryLabel: 'Tentar novamente',
    dashboardLabel: 'Ir para o meu Painel'
  };
}
