import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.js';
import { analytics } from '../lib/analytics.js';
import { openEcosystemModule } from '../lib/ecosystemLauncher.js';

export default function BillingSuccess() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Seu pagamento foi confirmado. Estamos preparando o MusicScale para sua organização.');
  const [retryCount, setRetryCount] = useState(0);
  const [confirmedOrganizationId, setConfirmedOrganizationId] = useState<string | null>(null);
  const [launchingMusicScale, setLaunchingMusicScale] = useState(false);
  const autoLaunchAttemptedRef = useRef(false);

  const launchMusicScale = useCallback(async (organizationId: string | null) => {
    if (!user || !organizationId) {
      navigate('/dashboard');
      return;
    }

    autoLaunchAttemptedRef.current = true;
    setLaunchingMusicScale(true);
    try {
      analytics.track('app_usage', {
        app: 'musicscale',
        userId: user.uid,
        organizationId,
        metadata: { action: 'post_checkout_launch', source: 'billing_success' }
      });

      await openEcosystemModule(
        'musicscale',
        user,
        profile,
        { id: organizationId },
        {}
      );
    } catch (error) {
      console.warn('[BillingSuccess] Direct MusicScale launch failed; keeping recovery UI available.', error);
      setMessage('Sua assinatura está ativa. Não conseguimos abrir o MusicScale automaticamente; tente novamente pelo botão abaixo.');
      setLaunchingMusicScale(false);
    }
  }, [navigate, profile, user]);

  useEffect(() => {
    if (!sessionId) {
      navigate('/dashboard/billing');
      return;
    }

    if (loading) return;

    if (!user) {
      setStatus('error');
      setMessage('Sua sessão expirou. Entre novamente para confirmar sua assinatura.');
      return;
    }

    let isMounted = true;
    const confirmCheckout = async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/v1/billing/checkout/confirm', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ session_id: sessionId })
        });

        const data = await res.json();
        if (!isMounted) return;

        if (data.ok && data.action === 'subscription_ready') {
          setStatus('success');
          setMessage('Tudo certo. O MusicScale já está disponível.');

          const organizationId = data.organizationId || null;
          setConfirmedOrganizationId(organizationId);

          const analyticsKey = `mn_checkout_completed_${sessionId}`;
          if (!sessionStorage.getItem(analyticsKey)) {
            analytics.track('checkout_completed', {
              app: 'musicscale',
              userId: user?.uid,
              organizationId: organizationId || undefined,
              metadata: { source: 'billing_confirmation' }
            });
            sessionStorage.setItem(analyticsKey, '1');
          }
        } else if (data.ok && data.action === 'provisioning') {
          if (retryCount < 5) {
             setTimeout(() => {
                if (isMounted) setRetryCount(prev => prev + 1);
             }, data.retryAfterMs || 2000);
          } else {
             setStatus('error');
             setMessage('Sua compra foi concluída, mas ainda estamos finalizando a ativação.');
          }
        } else {
          setStatus('error');
          setMessage(data.error || 'Não foi possível confirmar sua assinatura no momento.');
        }
      } catch (err) {
        if (!isMounted) return;
        setStatus('error');
        setMessage('Ocorreu um erro ao verificar sua compra.');
      }
    };

    confirmCheckout();

    return () => { isMounted = false; };
  }, [sessionId, retryCount, user, loading, navigate]);

  useEffect(() => {
    if (
      status !== 'success' ||
      !confirmedOrganizationId ||
      !user ||
      autoLaunchAttemptedRef.current
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (!autoLaunchAttemptedRef.current) {
        void launchMusicScale(confirmedOrganizationId);
      }
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [status, confirmedOrganizationId, user, launchMusicScale]);

  return (
    <div className="min-h-screen bg-[#0A0D14] flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full bg-[#1A1D24] border border-white/5 rounded-2xl p-8 flex flex-col items-center text-center">
        {status === 'loading' && (
          <>
            <div className="w-16 h-16 bg-[#2B85EB]/10 rounded-full flex items-center justify-center mb-6">
              <Loader2 className="w-8 h-8 text-[#2B85EB] animate-spin" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Ativando sua assinatura</h2>
            <p className="text-[#A0A7B5] leading-relaxed">
              {message}
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6">
              <CheckCircle className="w-8 h-8 text-emerald-500" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Assinatura ativada</h2>
            <p className="text-[#A0A7B5] leading-relaxed mb-8">
              {message}
            </p>
            <div className="w-full flex flex-col gap-3">
              <button
                onClick={() => void launchMusicScale(confirmedOrganizationId)}
                disabled={launchingMusicScale}
                className="w-full flex items-center justify-center gap-2 bg-[#2B85EB] hover:bg-[#2B85EB]/90 disabled:opacity-60 text-white font-semibold py-3 px-6 rounded-xl transition-all"
              >
                {launchingMusicScale ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Abrindo MusicScale...
                  </>
                ) : (
                  <>
                    Abrir MusicScale
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full text-[#A0A7B5] hover:text-white font-medium py-2 px-6 transition-colors"
              >
                Ir para o painel
              </button>
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Aviso de ativação</h2>
            <p className="text-[#A0A7B5] leading-relaxed mb-8">
              {message}
            </p>
            <div className="flex flex-col w-full gap-3">
              <button
                onClick={() => { setStatus('loading'); setRetryCount(0); }}
                className="w-full bg-white/5 hover:bg-white/10 text-white font-semibold py-3 px-6 rounded-xl transition-all"
              >
                Tentar ativar novamente
              </button>
              <button
                onClick={() => navigate('/dashboard/billing')}
                className="w-full text-[#A0A7B5] hover:text-white font-medium py-3 px-6 transition-colors"
              >
                Voltar para a MillionsNest
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
