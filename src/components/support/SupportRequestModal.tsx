import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext.js';
import { submitSupportTicket, loadSupportCapabilities } from '../../services/supportClient.js';
import { SupportCategory, SUPPORT_CATEGORIES, SupportLocale } from '../../lib/supportContracts.js';
import { X, AlertCircle, CheckCircle, Mail, MessageSquare } from 'lucide-react';

interface SupportRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string | null;
  organizationName?: string | null;
  appId?: string;
}

export function SupportRequestModal({
  isOpen,
  onClose,
  organizationId,
  organizationName,
  appId = 'core'
}: SupportRequestModalProps) {
  const { t, i18n } = useTranslation(['dashboard']);
  const { user, profile } = useAuth();

  const [whatsapp, setWhatsapp] = useState('');
  const [category, setCategory] = useState<SupportCategory>('general');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [protocol, setProtocol] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [hasEditedSinceError, setHasEditedSinceError] = useState(false);
  const [capabilities, setCapabilities] = useState<{
    hasPrioritySupport: boolean;
    hasGlobalEntitlementOverride: boolean;
  } | null>(null);
  const [loadingCapabilities, setLoadingCapabilities] = useState(false);

  const [requestId, setRequestId] = useState(() => generateUUID());

  const triggerRef = useRef<HTMLElement | null>(null);
  const firstEditableRef = useRef<HTMLInputElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);

  function generateUUID(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // Auto-derived identity fields
  let automaticName = '';
  if (profile?.displayName) {
    automaticName = profile.displayName;
  } else if (user?.displayName) {
    automaticName = user.displayName;
  } else if (user?.email) {
    automaticName = user.email.split('@')[0];
  } else if (profile?.email) {
    automaticName = profile.email.split('@')[0];
  } else {
    automaticName = t('common.user', 'Usuário');
  }

  let automaticEmail = '';
  if (user?.email) {
    automaticEmail = user.email;
  } else if (profile?.email) {
    automaticEmail = profile.email;
  } else {
    automaticEmail = t('common.unavailable', 'Indisponível');
  }

  // Handle active element and body scroll
  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement as HTMLElement;
      document.body.style.overflow = 'hidden';
      // Generate request ID once per logical form mount
      setRequestId(generateUUID());
      setStatus('idle');
      setWhatsapp('');
      setCategory('general');
      setMessage('');
      setErrorCode('');
      setHasEditedSinceError(false);

      setTimeout(() => {
        firstEditableRef.current?.focus();
      }, 50);
    } else {
      document.body.style.overflow = '';
      if (triggerRef.current) {
        triggerRef.current.focus();
      }
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Load support capabilities on mount/open
  useEffect(() => {
    if (isOpen && user && organizationId) {
      setLoadingCapabilities(true);
      const controller = new AbortController();

      loadSupportCapabilities({
        user,
        organizationId,
        signal: controller.signal
      })
      .then((res) => {
        if (res.success && 'supportTier' in res) {
          setCapabilities({
            hasPrioritySupport: res.hasPrioritySupport,
            hasGlobalEntitlementOverride: res.hasGlobalEntitlementOverride
          });
        }
      })
      .catch((err) => {
        console.error('Error loading support capabilities:', err);
      })
      .finally(() => {
        setLoadingCapabilities(false);
      });

      return () => {
        controller.abort();
      };
    } else {
      setCapabilities(null);
      setLoadingCapabilities(false);
    }
  }, [isOpen, user, organizationId]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && status !== 'submitting') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, status]);

  // Regenerate requestId if user edits fields after a failed attempt
  const handleFieldChange = (fieldSetter: (val: any) => void, val: any) => {
    fieldSetter(val);
    if (status === 'error') {
      setHasEditedSinceError(true);
      setRequestId(generateUUID());
      setStatus('idle');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !organizationId) return;

    if (message.trim().length < 20) {
      setStatus('error');
      setErrorCode('MESSAGE_TOO_SHORT');
      return;
    }

    setStatus('submitting');
    setErrorCode('');

    const pagePath = window.location.pathname + window.location.search;
    const currentLocale = (i18n.language || 'pt').substring(0, 2) as SupportLocale;
    const finalLocale = ['pt', 'en', 'es'].includes(currentLocale) ? currentLocale : 'pt';

    const requestPayload = {
      requestId,
      organizationId,
      category,
      message,
      whatsapp: whatsapp.trim() || undefined,
      appId: appId || 'core',
      pagePath,
      locale: finalLocale
    };

    const response = await submitSupportTicket({
      user,
      request: requestPayload
    });

    if (response.success === true) {
      setProtocol(response.reference);
      setStatus('success');
      // Generate new ID for potential subsequent forms
      setRequestId(generateUUID());
    } else {
      const failRes = response as any;
      setErrorCode(failRes.reasonCode || 'INTERNAL_ERROR');
      setStatus('error');
    }
  };

  const handleReset = () => {
    setWhatsapp('');
    setCategory('general');
    setMessage('');
    setStatus('idle');
    setErrorCode('');
    setHasEditedSinceError(false);
    setRequestId(generateUUID());
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && status !== 'submitting') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="support-modal-title"
        aria-describedby="support-modal-description"
        className="w-full max-w-[600px] max-h-[90vh] flex flex-col bg-[#050505] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-5 h-5 text-[#2B85EB]" />
            <h2 id="support-modal-title" className="text-lg font-bold text-white">
              {t('support.modal.title', 'Enviar uma solicitação')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={status === 'submitting'}
            aria-label={t('support.accessibility.close_dialog', 'Fechar formulário de suporte')}
            className="p-2 text-[#A0A7B5] hover:text-white hover:bg-white/5 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          <p id="support-modal-description" className="text-sm text-[#A0A7B5]">
            {t('support.modal.description', 'Conte o que aconteceu e nossa equipe receberá as informações necessárias para ajudar.')}
          </p>

          {/* SKELETON LOADER */}
          {loadingCapabilities && (
            <div className="animate-pulse flex items-center gap-3 p-3.5 bg-white/5 border border-white/5 rounded-xl">
              <div className="w-4 h-4 bg-white/20 rounded-full animate-ping shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 bg-white/20 rounded w-1/3" />
                <div className="h-3 bg-white/10 rounded w-2/3" />
              </div>
            </div>
          )}

          {/* PRIORITY BADGE */}
          {!loadingCapabilities && capabilities?.hasPrioritySupport && (
            <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl animate-in fade-in duration-200">
              <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-amber-500/15 text-amber-400 shrink-0">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                </svg>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                    {t('support.priority.badge', 'Suporte prioritário')}
                  </span>
                  <span className="text-[10px] font-semibold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">
                    PREMIUM
                  </span>
                </div>
                <p className="text-xs text-[#E1E4EB]">
                  {t('support.priority.description', 'Seu acesso inclui atendimento prioritário.')}
                </p>
                {capabilities.hasGlobalEntitlementOverride && (
                  <p className="text-[11px] text-amber-400/80">
                    {t('support.priority.global_override', 'Acesso completo concedido pelo seu papel no ecossistema.')}
                  </p>
                )}
              </div>
            </div>
          )}

          {status === 'success' ? (
            <div role="status" className="flex flex-col items-center text-center py-8 space-y-4 animate-in fade-in duration-200">
              <CheckCircle className="w-16 h-16 text-green-500" />
              <h3 className="text-xl font-bold text-white">
                {t('support.success.received', 'Recebemos sua solicitação.')}
              </h3>
              <p className="text-sm text-green-400 bg-green-500/10 border border-green-500/20 px-4 py-2 rounded-xl font-mono">
                {t('support.success.protocol', 'Protocolo: {{reference}}', { reference: protocol })}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 w-full pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-xl transition-colors min-h-[44px]"
                >
                  {t('support.success.close', 'Fechar')}
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex-1 py-3 bg-[#2B85EB] hover:bg-[#3B95FB] text-white font-semibold rounded-xl transition-colors min-h-[44px]"
                >
                  {t('support.success.send_another', 'Enviar outra solicitação')}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {status === 'error' && errorCode && (
                <div role="alert" className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <span className="text-sm text-red-400 font-medium">
                    {t(`support.errors.${errorCode}`, t('support.errors.INTERNAL_ERROR', 'Não foi possível enviar agora. Tente novamente.'))}
                  </span>
                </div>
              )}

              {/* READ-ONLY IDENTITY FIELDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="support-field-name" className="block text-xs font-bold text-[#A0A7B5] uppercase tracking-wider mb-2">
                    {t('support.fields.name', 'Nome')}
                  </label>
                  <input
                    id="support-field-name"
                    type="text"
                    value={automaticName}
                    readOnly
                    className="w-full px-4 py-3 bg-white/5 border border-white/5 rounded-xl text-[#6D7582] text-sm outline-none cursor-not-allowed"
                  />
                </div>
                <div>
                  <label htmlFor="support-field-email" className="block text-xs font-bold text-[#A0A7B5] uppercase tracking-wider mb-2">
                    {t('support.fields.email', 'E-mail')}
                  </label>
                  <input
                    id="support-field-email"
                    type="email"
                    value={automaticEmail}
                    readOnly
                    className="w-full px-4 py-3 bg-white/5 border border-white/5 rounded-xl text-[#6D7582] text-sm outline-none cursor-not-allowed"
                  />
                </div>
              </div>

              {/* WHATSAPP */}
              <div>
                <label htmlFor="support-field-whatsapp" className="block text-xs font-bold text-[#A0A7B5] uppercase tracking-wider mb-2">
                  {t('support.fields.whatsapp', 'WhatsApp, opcional')}
                </label>
                <input
                  ref={firstEditableRef}
                  id="support-field-whatsapp"
                  type="text"
                  placeholder="+55 (11) 99999-9999"
                  value={whatsapp}
                  onChange={(e) => handleFieldChange(setWhatsapp, e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 hover:border-white/20 focus:border-[#2B85EB]/50 rounded-xl text-white text-sm outline-none transition-all min-h-[44px]"
                />
              </div>

              {/* CATEGORY */}
              <div>
                <label htmlFor="support-field-category" className="block text-xs font-bold text-[#A0A7B5] uppercase tracking-wider mb-2">
                  {t('support.fields.category', 'Assunto')}
                </label>
                <select
                  id="support-field-category"
                  value={category}
                  onChange={(e) => handleFieldChange(setCategory, e.target.value as SupportCategory)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 hover:border-white/20 focus:border-[#2B85EB]/50 rounded-xl text-white text-sm outline-none transition-all min-h-[44px] appearance-none cursor-pointer"
                >
                  {SUPPORT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat} className="bg-[#050505] text-white">
                      {t(`support.categories.${cat}`, cat)}
                    </option>
                  ))}
                </select>
              </div>

              {/* MESSAGE */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label htmlFor="support-field-message" className="block text-xs font-bold text-[#A0A7B5] uppercase tracking-wider">
                    {t('support.fields.message', 'Como podemos ajudar?')}
                  </label>
                  <span className="text-[10px] text-[#A0A7B5]">
                    {t('support.accessibility.character_counter', '{{current}} de 4000 caracteres', { current: message.length })}
                  </span>
                </div>
                <textarea
                  id="support-field-message"
                  rows={6}
                  placeholder={t('support.validation.message_too_short', 'Conte um pouco mais sobre o que aconteceu (mínimo de 20 caracteres).')}
                  value={message}
                  onChange={(e) => handleFieldChange(setMessage, e.target.value)}
                  maxLength={4000}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 hover:border-white/20 focus:border-[#2B85EB]/50 rounded-xl text-white text-sm outline-none transition-all resize-none"
                />
                <p className="text-[10px] text-[#6D7582] mt-1">
                  Mínimo de 20 caracteres.
                </p>
              </div>

              {/* SECURITY NOTICE */}
              <div className="flex items-center gap-3 p-4 bg-white/5 border border-white/5 rounded-xl">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                <span className="text-xs text-[#A0A7B5]">
                  {t('support.modal.security_notice', 'Não envie senhas, códigos de acesso ou dados completos de cartão.')}
                </span>
              </div>

              {/* FOOTER ACTIONS */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={status === 'submitting'}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-xl transition-colors min-h-[44px]"
                >
                  {t('common.cancel', 'Cancelar')}
                </button>
                <button
                  type="submit"
                  disabled={status === 'submitting'}
                  className="flex-1 py-3 bg-[#2B85EB] hover:bg-[#3B95FB] disabled:bg-[#2B85EB]/50 text-white font-semibold rounded-xl transition-colors min-h-[44px] flex items-center justify-center gap-2"
                >
                  {status === 'submitting'
                    ? t('support.modal.submitting', 'Enviando...')
                    : t('support.modal.submit', 'Enviar solicitação')}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
