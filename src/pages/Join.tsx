import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.js';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle2, XCircle, ArrowRight, RefreshCw } from 'lucide-react';
import { MillionsNestLogo } from '../components/MillionsNestLogo.js';
import {
  InvitationJoinLanguage,
  InvitationJoinFailureReason,
  normalizeInvitationJoinLanguage,
  parseInvitationJoinPayload,
  getInvitationJoinMessage,
  getInvitationJoinSuccessCopy
} from '../lib/InvitationJoinClientPolicy.js';

type JoinStatus = 'validating' | 'success' | 'already_member' | 'error';

export function Join() {
  const { orgId } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  
  const [status, setStatus] = useState<JoinStatus>('validating');
  const [errorMessage, setErrorMessage] = useState<{ title: string; description: string; retryable: boolean } | null>(null);
  const [inviteData, setInviteData] = useState<{ organizationName: string } | null>(null);
  
  const requestFiredRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getLanguage = (): InvitationJoinLanguage => {
    return normalizeInvitationJoinLanguage(document.documentElement.lang || navigator.language);
  };

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      sessionStorage.setItem('mn_invite_redirect', `/join/${orgId}${token ? `?token=${token}` : ''}`);
      navigate(`/login?org=${orgId}&invite=true`);
      return;
    }

    if (requestFiredRef.current) return;
    requestFiredRef.current = true;

    validateAndAcceptInvite();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [user, authLoading, orgId, token, navigate]);

  const validateAndAcceptInvite = async () => {
    const lang = getLanguage();
    
    if (!orgId) {
      setStatus('error');
      setErrorMessage(getInvitationJoinMessage('INVALID_RESPONSE', lang));
      return;
    }

    const trimmedToken = token?.trim() || '';
    if (!trimmedToken) {
      setStatus('error');
      setErrorMessage(getInvitationJoinMessage('INVALID_TOKEN', lang));
      return;
    }

    if (!user) {
      setStatus('error');
      setErrorMessage(getInvitationJoinMessage('UNAUTHENTICATED', lang));
      return;
    }

    abortControllerRef.current = new AbortController();

    try {
      const idToken = await user.getIdToken();
      
      const res = await fetch('/api/v1/invitations/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ token: trimmedToken }),
        signal: abortControllerRef.current.signal
      });
      
      const rawData = await res.json().catch(() => null);
      const parsed = parseInvitationJoinPayload(rawData);
      
      if (parsed.success) {
        setInviteData({ organizationName: parsed.organizationName });
        setStatus(parsed.alreadyMember ? 'already_member' : 'success');
        sessionStorage.removeItem('mn_invite_redirect');
        
        timeoutRef.current = setTimeout(() => {
          window.location.href = '/dashboard';
        }, 2500);
      } else {
        setStatus('error');
        setErrorMessage(getInvitationJoinMessage(parsed.reasonCode as InvitationJoinFailureReason, lang));
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') {
        return;
      }
      setStatus('error');
      setErrorMessage(getInvitationJoinMessage('NETWORK_ERROR', lang));
    }
  };

  const handleRetry = () => {
    setStatus('validating');
    setErrorMessage(null);
    requestFiredRef.current = true;
    validateAndAcceptInvite();
  };

  const lang = getLanguage();
  const uiTexts = {
    pt: { validating: 'Validando convite...', wait: 'Por favor, aguarde um momento.', retry: 'Tentar novamente', dashboard: 'Ir para o meu Painel' },
    en: { validating: 'Validating invitation...', wait: 'Please wait a moment.', retry: 'Try again', dashboard: 'Go to my Dashboard' },
    es: { validating: 'Validando invitación...', wait: 'Por favor, espera un momento.', retry: 'Intentar de nuevo', dashboard: 'Ir a mi Panel' }
  };
  const t = uiTexts[lang];

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-[#2B85EB]/5 to-transparent pointer-events-none rounded-[2rem]" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-[#0B0F19]/50 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl relative text-center"
        aria-live="polite"
        aria-busy={status === 'validating'}
      >
        <div className="flex justify-center mb-8">
           <MillionsNestLogo className="h-10 w-auto" />
        </div>

        {status === 'validating' && (
          <div className="flex flex-col items-center py-8">
            <Loader2 className="w-12 h-12 text-[#2B85EB] animate-spin mb-4" />
            <h2 className="text-[#F5F7FA] font-semibold text-lg">{t.validating}</h2>
            <p className="text-[#A0A7B5] text-sm mt-2">{t.wait}</p>
          </div>
        )}

        {(status === 'success' || status === 'already_member') && inviteData && (
          <div className="flex flex-col items-center py-8">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-6 ${status === 'already_member' ? 'bg-[#2B85EB]/10 text-[#2B85EB]' : 'bg-emerald-500/10 text-emerald-400'}`}>
              <CheckCircle2 className="w-8 h-8" />
            </div>
            
            {(() => {
              const successCopy = getInvitationJoinSuccessCopy(status === 'already_member', inviteData.organizationName, lang);
              return (
                <>
                  <h2 className="text-[#F5F7FA] font-bold text-xl mb-2">{successCopy.title}</h2>
                  <p className="text-[#A0A7B5] text-sm mb-8">{successCopy.description}</p>
                  <p className="text-xs text-[#A0A7B5] flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin" /> {successCopy.redirectLabel}
                  </p>
                </>
              );
            })()}
          </div>
        )}

        {status === 'error' && errorMessage && (
          <div className="flex flex-col items-center py-8">
            <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-6">
              <XCircle className="w-8 h-8" />
            </div>
            <h2 className="text-[#F5F7FA] font-bold text-xl mb-2">{errorMessage.title}</h2>
            <p className="text-[#A0A7B5] text-sm mb-8">{errorMessage.description}</p>
            
            {errorMessage.retryable ? (
              <button 
                onClick={handleRetry}
                disabled={status === 'validating'}
                className="w-full py-3 bg-[#2B85EB] text-white text-sm font-semibold rounded-xl hover:bg-[#2B85EB]/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4" /> {t.retry}
              </button>
            ) : (
              <Link 
                to="/dashboard"
                className="w-full py-3 bg-white/5 text-[#F5F7FA] text-sm font-semibold rounded-xl hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
              >
                {t.dashboard} <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        )}

      </motion.div>
    </div>
  );
}
