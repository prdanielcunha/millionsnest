import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.js';
import { getEcosystemApp } from '../lib/apps.js';
import { openEcosystemModule } from '../lib/ecosystemLauncher.js';
import { resolveCanonicalConnectOrganizationId } from '../lib/connectLaunchPolicy.js';

/**
 * Canonical Hub-side entry point for every ecosystem product.
 *
 * Target apps never need a shared long-lived cookie. When direct entry finds no
 * local Firebase session, it sends the browser here. The Hub reuses its own
 * session, re-resolves the active organization and creates a short-lived app
 * handoff through the existing ecosystem launcher.
 */
export function EcosystemAppLaunch() {
  const { appId = '' } = useParams();
  const app = useMemo(() => getEcosystemApp(appId), [appId]);
  const { user, profile, canonicalContext, loading } = useAuth();
  const navigate = useNavigate();
  const launchStartedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;

    if (!app || !app.directEntrySso || app.authMode !== 'hub_handoff') {
      setError('Este aplicativo ainda não está habilitado para entrada unificada pelo MillionsNest.');
      return;
    }

    if (!app.url) {
      setError(`${app.name} ainda não possui um endereço operacional configurado.`);
      return;
    }

    if (!user) {
      const resumePath = app.hubLaunchRoute || `/apps/${encodeURIComponent(app.id)}/launch`;
      navigate(`/login?redirect=${encodeURIComponent(resumePath)}`, { replace: true });
      return;
    }

    if (!profile) {
      setError('Sua conta foi autenticada, mas o perfil do MillionsNest ainda não está disponível.');
      return;
    }

    const organizationId = resolveCanonicalConnectOrganizationId(canonicalContext);
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
      app.id,
      user,
      profile,
      organization,
      canonicalContext,
    ).catch((launchError) => {
      launchStartedRef.current = false;
      setError(
        launchError instanceof Error
          ? launchError.message
          : `Não foi possível preparar o acesso seguro ao ${app.name}.`,
      );
    });
  }, [app, canonicalContext, loading, navigate, profile, user]);

  const appName = app?.name || 'aplicativo';

  return (
    <main className="grid min-h-screen place-items-center bg-[#050505] px-6 text-white">
      <section className="w-full max-w-lg rounded-[28px] border border-white/10 bg-white/[0.04] p-7 text-center shadow-2xl backdrop-blur-xl">
        <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.05]">
          {error ? <AlertCircle size={21} /> : <Loader2 size={21} className="animate-spin" />}
        </div>
        <h1 className="text-xl font-semibold tracking-tight">
          {error ? `Não foi possível abrir ${appName}` : `Abrindo ${appName}`}
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-400">
          {error || 'Confirmando sua conta, organização e permissões. Se sua sessão do MillionsNest já estiver ativa, não será necessário entrar novamente.'}
        </p>
        {app?.domainStatus === 'setup_required' ? (
          <p className="mx-auto mt-4 max-w-sm rounded-xl border border-amber-400/15 bg-amber-400/[0.05] px-3 py-2 text-xs leading-5 text-amber-100/70">
            O domínio oficial deste produto está reservado e ainda precisa concluir a configuração de DNS/SSL. Enquanto isso, o acesso seguro usa o endereço Firebase Hosting certificado.
          </p>
        ) : null}
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
          <ShieldCheck size={13} /> Acesso seguro · identidade e organização revalidadas
        </div>
      </section>
    </main>
  );
}
