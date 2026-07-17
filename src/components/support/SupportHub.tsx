import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleHelp, Mail, MessageCircle, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { useSupportHub } from './SupportHubContext.js';
import { useAuth } from '../../contexts/AuthContext.js';
import { useOrganization } from '../../contexts/OrganizationContext.js';
import { loadSupportCapabilities } from '../../services/supportClient.js';
import { resolveSupportGuide } from '../../lib/supportGuideRegistry.js';
import { useLocation } from 'react-router-dom';

export function SupportHub() {
  const { t } = useTranslation(['dashboard']);
  const { hubOpen, openHub, closeHub, toggleHub, openRequest, openWhatsApp, openCurrentGuide, appId } = useSupportHub();
  const { user } = useAuth();
  const { organization } = useOrganization();
  const location = useLocation();

  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('mn_support_widget_collapsed_v1') === 'true';
  });
  const [capabilities, setCapabilities] = useState<{
    canUseWhatsAppSupport: boolean;
    hasGlobalEntitlementOverride: boolean;
    hasPrioritySupport: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('mn_support_widget_collapsed_v1', isCollapsed.toString());
  }, [isCollapsed]);

  // Load capabilities when opened
  useEffect(() => {
    if (hubOpen && user && organization) {
      setLoading(true);
      const controller = new AbortController();
      
      loadSupportCapabilities({
        user: { getIdToken: () => user.getIdToken(), uid: user.uid },
        organizationId: organization.id,
        signal: controller.signal
      })
      .then(res => {
        if (res.success && 'canUseWhatsAppSupport' in res) {
          setCapabilities({
            canUseWhatsAppSupport: res.canUseWhatsAppSupport,
            hasGlobalEntitlementOverride: res.hasGlobalEntitlementOverride,
            hasPrioritySupport: res.hasPrioritySupport
          });
        }
      })
      .catch(console.error)
      .finally(() => {
        setLoading(false);
      });

      return () => controller.abort();
    }
  }, [hubOpen, user, organization]);

  // Click outside to close
  useEffect(() => {
    if (!hubOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeHub();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [hubOpen, closeHub]);

  // Escape to close
  useEffect(() => {
    if (!hubOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeHub();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [hubOpen, closeHub]);

  const currentGuide = resolveSupportGuide({
    pathname: location.pathname,
    searchParams: new URLSearchParams(location.search),
    appId
  });

  return (
    <div className="fixed z-50 bottom-[calc(env(safe-area-inset-bottom)+24px)] right-6 md:bottom-6 flex flex-col items-end">
      
      {hubOpen && (
        <div 
          ref={menuRef}
          className="mb-4 w-80 bg-[#1C1C1F] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-200"
        >
          <div className="p-4 border-b border-white/10 bg-[#232326]">
            <h3 className="font-bold text-white text-sm">
              {t('support.hub.title', 'Como podemos ajudar?')}
            </h3>
            <p className="text-xs text-white/60 mt-0.5">
              {t('support.hub.description', 'Escolha a melhor forma de continuar.')}
            </p>
          </div>

          <div className="p-2 flex flex-col gap-1">
            <button
              type="button"
              onClick={openRequest}
              className="flex items-start gap-3 p-3 text-left rounded-xl hover:bg-white/5 transition-colors group"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 shrink-0 group-hover:bg-blue-500/20 group-hover:text-blue-300 transition-colors">
                <Mail className="w-4 h-4" />
              </div>
              <div>
                <div className="font-semibold text-white text-sm">
                  {t('support.hub.request.title', 'Enviar uma solicitação')}
                </div>
                <div className="text-xs text-[#E1E4EB] leading-snug">
                  {t('support.hub.request.description', 'Conte o que aconteceu e receba um protocolo.')}
                </div>
              </div>
            </button>

            {loading ? (
              <div className="flex items-start gap-3 p-3">
                 <div className="w-8 h-8 rounded-lg bg-white/5 animate-pulse shrink-0" />
                 <div className="flex-1 space-y-2 py-1">
                   <div className="h-3 bg-white/10 rounded w-1/2 animate-pulse" />
                   <div className="h-3 bg-white/5 rounded w-3/4 animate-pulse" />
                 </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (capabilities?.canUseWhatsAppSupport) {
                    openWhatsApp();
                  }
                }}
                disabled={!capabilities?.canUseWhatsAppSupport}
                className={`flex items-start gap-3 p-3 text-left rounded-xl transition-colors group ${
                  capabilities?.canUseWhatsAppSupport 
                    ? 'hover:bg-white/5 cursor-pointer' 
                    : 'opacity-60 cursor-not-allowed'
                }`}
              >
                <div className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 transition-colors ${
                  capabilities?.canUseWhatsAppSupport
                    ? 'bg-green-500/10 text-green-500 group-hover:bg-green-500/20 group-hover:text-green-400'
                    : 'bg-white/5 text-white/40'
                }`}>
                  <MessageCircle className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-white text-sm">
                      {t('support.hub.whatsapp.title', 'Falar pelo WhatsApp')}
                    </div>
                    {!capabilities?.hasGlobalEntitlementOverride && (
                       <span className="text-[9px] font-bold bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30 tracking-wider">
                         PRO
                       </span>
                    )}
                  </div>
                  <div className="text-xs text-[#E1E4EB] leading-snug mt-0.5">
                    {capabilities?.canUseWhatsAppSupport 
                      ? t('support.hub.whatsapp.description', 'Converse pelo canal de suporte prioritário.')
                      : t('support.hub.whatsapp.locked', 'Disponível no plano Pro.')
                    }
                  </div>
                </div>
              </button>
            )}

            {currentGuide && (
              <button
                type="button"
                onClick={openCurrentGuide}
                className="flex items-start gap-3 p-3 text-left rounded-xl hover:bg-white/5 transition-colors group"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 shrink-0 group-hover:bg-purple-500/20 group-hover:text-purple-300 transition-colors">
                  <Info className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-white text-sm">
                    {t('support.hub.guide.title', 'Ajuda sobre esta página')}
                  </div>
                  <div className="text-xs text-[#E1E4EB] leading-snug">
                    {t('support.hub.guide.description', 'Veja um guia rápido desta tela.')}
                  </div>
                </div>
              </button>
            )}
          </div>

          {!loading && capabilities?.hasPrioritySupport && (
            <div className="p-3 bg-amber-500/10 border-t border-amber-500/20 text-center text-xs text-amber-400">
               {capabilities.hasGlobalEntitlementOverride 
                 ? t('support.priority.global_override', 'Acesso completo concedido pelo seu papel no ecossistema.')
                 : t('support.priority.badge', 'Suporte prioritário')
               }
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center justify-center w-8 h-8 rounded-full bg-black/40 text-white/60 hover:text-white hover:bg-black/60 backdrop-blur-md transition-colors border border-white/10"
          aria-label={isCollapsed ? t('support.hub.expand', 'Abrir ajuda') : t('support.hub.collapse', 'Recolher ajuda')}
        >
          {isCollapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        
        <button
          type="button"
          onClick={toggleHub}
          aria-expanded={hubOpen}
          aria-haspopup="menu"
          aria-label={t('support.hub.trigger', 'Precisa de ajuda?')}
          className={`flex items-center justify-center bg-blue-600 hover:bg-blue-500 text-white shadow-lg transition-all focus:ring-2 focus:ring-blue-400 focus:outline-none ${
            isCollapsed ? 'w-11 h-11 rounded-full' : 'h-11 px-5 rounded-full gap-2'
          }`}
        >
          <CircleHelp className="w-5 h-5" />
          {!isCollapsed && (
            <span className="font-medium text-sm whitespace-nowrap">
              {t('support.hub.trigger', 'Precisa de ajuda?')}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
