import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext.js';
import { createSupportWhatsAppLink } from '../../services/supportClient.js';
import { SupportLocale } from '../../lib/supportContracts.js';
import { X, MessageCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useOrganization } from '../../contexts/OrganizationContext.js';

interface SupportWhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  appId?: string;
}

export function SupportWhatsAppModal({ isOpen, onClose, appId }: SupportWhatsAppModalProps) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { organization } = useOrganization();
  const location = useLocation();

  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'success'>('idle');
  const [errorCode, setErrorCode] = useState('');
  const [popupBlocked, setPopupBlocked] = useState(false);
  
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setMessage('');
      setStatus('idle');
      setErrorCode('');
      setPopupBlocked(false);
    }
  }, [isOpen]);

  // Focus trap & Escape key
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      if (modalRef.current) {
        modalRef.current.focus();
      }
      
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };
      
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        if (previousFocusRef.current) {
          previousFocusRef.current.focus();
        }
      };
    }
  }, [isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !organization || message.trim().length < 10) return;

    setStatus('loading');
    setErrorCode('');
    setPopupBlocked(false);

    try {
      const locale = (i18n.language.split('-')[0] || 'en') as SupportLocale;
      const res = await createSupportWhatsAppLink({
        user: { getIdToken: () => user.getIdToken(), uid: user.uid },
        request: {
          organizationId: organization.id,
          locale,
          message,
          appId,
          pagePath: location.pathname + location.search
        }
      });

      if (res.success && res.url.startsWith('https://wa.me/')) {
        setStatus('success');
        
        // Attempt to open WhatsApp
        const newWin = window.open(res.url, '_blank', 'noopener,noreferrer');
        if (!newWin || newWin.closed || typeof newWin.closed === 'undefined') {
          setPopupBlocked(true);
        } else {
          // If successful, close modal after a short delay
          setTimeout(() => {
            onClose();
          }, 1500);
        }
      } else {
        setStatus('error');
        setErrorCode(res.success === false ? res.reasonCode : 'INTERNAL_ERROR');
      }
    } catch (error) {
      setStatus('error');
      setErrorCode('INTERNAL_ERROR');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Modal */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="whatsapp-title"
        tabIndex={-1}
        className="relative w-full max-w-lg bg-[#1C1C1F] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 focus:outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-green-500/10 text-green-500">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 id="whatsapp-title" className="text-xl font-bold text-white tracking-tight">
                {t('dashboard.support.whatsapp.modal.title', 'Falar pelo WhatsApp')}
              </h2>
              <p className="text-sm text-[#E1E4EB]">
                {t('dashboard.support.whatsapp.modal.description', 'O WhatsApp será aberto com uma mensagem pronta. Você poderá revisá-la antes de enviar.')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 -mr-2 text-white/50 hover:text-white rounded-lg hover:bg-white/5 transition-colors self-start"
            aria-label={t('dashboard.support.accessibility.close_dialog', 'Fechar modal de WhatsApp')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6">
           {/* Auto-filled read-only fields */}
           <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                {t('support.modal.name_label', 'Nome')}
              </label>
              <input
                type="text"
                value={user?.displayName || ''}
                readOnly
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white/70 text-sm cursor-not-allowed"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                {t('support.modal.organization_label', 'Organização')}
              </label>
              <input
                type="text"
                value={organization?.name || ''}
                readOnly
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white/70 text-sm cursor-not-allowed"
              />
            </div>
          </div>

          <form id="whatsapp-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="message" className="block text-sm font-medium text-[#E1E4EB]">
                {t('dashboard.support.whatsapp.field.message', 'Como podemos ajudar?')} <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  maxLength={1500}
                  className="w-full bg-[#161618] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors resize-none"
                  placeholder={t('support.modal.message_placeholder', 'Descreva o que está acontecendo...')}
                  required
                />
                <div className="absolute bottom-3 right-3 text-xs text-white/40">
                  {t('support.accessibility.character_counter', '{{current}} de 1500 caracteres', { current: message.length })}
                </div>
              </div>
            </div>

            {status === 'error' && (
              <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-200">
                  {errorCode === 'WHATSAPP_NOT_INCLUDED' && t('dashboard.support.whatsapp.errors.not_included', 'O WhatsApp está disponível no plano Pro.')}
                  {errorCode === 'WHATSAPP_NOT_CONFIGURED' && t('dashboard.support.whatsapp.errors.not_configured', 'O canal de WhatsApp está temporariamente indisponível.')}
                  {errorCode === 'UNAUTHENTICATED' && t('dashboard.support.whatsapp.errors.unauthenticated', 'Sua sessão expirou. Entre novamente.')}
                  {errorCode === 'ORGANIZATION_CONTEXT_MISMATCH' && t('dashboard.support.whatsapp.errors.mismatch', 'A organização ativa mudou. Feche esta janela e tente novamente.')}
                  {errorCode === 'INTERNAL_ERROR' && t('dashboard.support.whatsapp.errors.internal', 'Não foi possível abrir o WhatsApp agora.')}
                  {!['WHATSAPP_NOT_INCLUDED', 'WHATSAPP_NOT_CONFIGURED', 'UNAUTHENTICATED', 'ORGANIZATION_CONTEXT_MISMATCH', 'INTERNAL_ERROR'].includes(errorCode) && t('dashboard.support.whatsapp.errors.internal', 'Não foi possível abrir o WhatsApp agora.')}
                </p>
              </div>
            )}

            {popupBlocked && (
              <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-200">
                  {t('dashboard.support.whatsapp.popup_blocked', 'O navegador bloqueou a nova janela. Permita pop-ups e tente novamente.')}
                </p>
              </div>
            )}
          </form>
        </div>

        <div className="p-6 border-t border-white/10 bg-[#161618] rounded-b-2xl shrink-0 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-semibold text-white hover:bg-white/5 rounded-xl transition-colors"
          >
            {t('support.modal.cancel', 'Cancelar')}
          </button>
          
          <button
            form="whatsapp-form"
            type="submit"
            disabled={status === 'loading' || message.trim().length < 10}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-green-500 hover:bg-green-600 text-white font-semibold text-sm rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-[#1C1C1F] outline-none"
          >
            {status === 'loading' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t('dashboard.support.whatsapp.opening', 'Abrindo...')}</span>
              </>
            ) : (
              <>
                <MessageCircle className="w-4 h-4" />
                <span>{t('dashboard.support.whatsapp.action', 'Abrir WhatsApp')}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
