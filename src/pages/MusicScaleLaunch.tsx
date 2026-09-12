import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.js';
import { openEcosystemModule } from '../lib/ecosystemLauncher.js';
import {
  buildEcosystemLoginPath,
  resolveCanonicalEcosystemOrganizationId,
} from '../lib/ecosystemLaunchPolicy.js';

export function MusicScaleLaunch() {
  const { user, profile, canonicalContext, loading } = useAuth();
  const navigate = useNavigate();
  const launchStartedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      navigate(buildEcosystemLoginPath('musicscale'), { replace: true });
      return;
    }

    if (!profile) {
      setError('Sua conta foi autenticada, mas o perfil do MillionsNest ainda não está disponível.');
      return;
    }

    const organizationId = resolveCanonicalEcosystemOrganizationId(canonicalContext);
    if (!organizationId) {
      setError('Não foi possível confirmar sua organização ativa. Abra o Hub, escolha uma organização e tente novamente.');
      return;
    }

    if (launchStartedRef.current) return;
    launchStartedRef.current = true;
    setError(null);

    const organizations = Array.isArray(canonicalContext?.organizations)
      ? canonicalContext.organizations
      : [];
    const organization = organizations.find((candidate: any) => candidate?.id === organizationId) || {
      id: organizationId,
      name: canonicalContext?.activeOrganization?.name || 'Organização MillionsNest',
    };

    void openEcosystemModule(
      'musicscale',
      user,
      profile,
      organization,
      canonicalContext,
      undefined,
      '/start',
    ).catch((launchError) => {
      launchStartedRef.current = false;
      setError(
        launchError instanceof Error
          ? launchError.message
          : 'Não foi possível preparar o acesso seguro ao MusicScale.',
      );
    });
  }, [canonicalContext, loading, navigate, profile, user]);

  return (
    <main className="grid min-h-screen place-items-center bg-[#050505] px-6 text-white">
      <section className="w-full max-w-lg rounded-[28px] border border-white/10 bg-white/[0.04] p-7 text-center shadow-2xl backdrop-blur-xl">
        <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.05]">
          {error ? <AlertCircle size={21} /> : <Loader2 size={21} className="animate-spin" />}
        </div>
        <h1 className="text-xl font-semibold tracking-tight">
          {error ? 'Não foi possível abrir o MusicScale' : 'Abrindo o MusicScale'}
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-400">
          {error || 'Confirmando sua conta, organização e acesso. Se sua sessão MillionsNest já estiver ativa, você não precisa entrar novamente.'}
        </p>
        {error ? (
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950"
            >
              Tentar novamente
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard/overview', { replace: true })}
              className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white"
            >
              Voltar ao Hub
            </button>
          </div>
        ) : null}
        <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-slate-500">
          <ShieldCheck size={13} /> Acesso seguro · identidade, organização e entitlement revalidados
        </div>
      </section>
    </main>
  );
}
