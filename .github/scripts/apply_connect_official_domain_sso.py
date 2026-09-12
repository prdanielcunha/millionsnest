from pathlib import Path

policy = Path('src/lib/connectLaunchPolicy.ts')
policy.write_text("""export const CONNECT_OFFICIAL_URL = 'https://connect.millionsnest.com';
export const CONNECT_HUB_LAUNCH_PATH = '/connect/launch';

export function resolveSafePostLoginPath(search: string): string | null {
  const params = new URLSearchParams(search || '');
  const next = params.get('next');
  return next === CONNECT_HUB_LAUNCH_PATH ? CONNECT_HUB_LAUNCH_PATH : null;
}

export function buildConnectLoginPath(): string {
  return `/login?next=${encodeURIComponent(CONNECT_HUB_LAUNCH_PATH)}`;
}

export function resolveCanonicalConnectOrganizationId(
  canonicalContext: any,
): string | null {
  const candidate = typeof canonicalContext?.activeOrganizationId === 'string'
    ? canonicalContext.activeOrganizationId.trim()
    : '';
  return candidate || null;
}
""")

launch = Path('src/pages/ConnectLaunch.tsx')
launch.write_text("""import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.js';
import { openEcosystemModule } from '../lib/ecosystemLauncher.js';
import {
  buildConnectLoginPath,
  resolveCanonicalConnectOrganizationId,
} from '../lib/connectLaunchPolicy.js';

export function ConnectLaunch() {
  const { user, profile, canonicalContext, loading } = useAuth();
  const navigate = useNavigate();
  const launchStartedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      navigate(buildConnectLoginPath(), { replace: true });
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
      'connect',
      user,
      profile,
      organization,
      canonicalContext,
    ).catch((launchError) => {
      launchStartedRef.current = false;
      setError(
        launchError instanceof Error
          ? launchError.message
          : 'Não foi possível preparar o acesso seguro ao MillionsNest Connect.',
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
          {error ? 'Não foi possível abrir o Connect' : 'Abrindo o MillionsNest Connect'}
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-400">
          {error || 'Confirmando sua conta, organização e permissões. Você não precisa entrar novamente se sua sessão do MillionsNest já estiver ativa.'}
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
          <ShieldCheck size={13} /> Acesso seguro · identidade e organização revalidadas
        </div>
      </section>
    </main>
  );
}
""")

app = Path('src/App.tsx')
text = app.read_text()
old_import = "const MusicScaleLanding = lazy(() => import('./pages/MusicScaleLanding.js').then(module => ({ default: module.MusicScaleLanding })));"
new_import = old_import + "\nconst ConnectLaunch = lazy(() => import('./pages/ConnectLaunch.js').then(module => ({ default: module.ConnectLaunch })));"
if old_import not in text:
    raise SystemExit('App import anchor not found')
text = text.replace(old_import, new_import, 1)
old_route = '                <Route path="/musicscale" element={<MusicScaleLanding />} />'
new_route = '                <Route path="/connect/launch" element={<ConnectLaunch />} />\n' + old_route
if old_route not in text:
    raise SystemExit('App route anchor not found')
text = text.replace(old_route, new_route, 1)
app.write_text(text)

login = Path('src/pages/Login.tsx')
text = login.read_text()
old_router = 'import { useNavigate } from "react-router-dom";'
new_router = 'import { useLocation, useNavigate } from "react-router-dom";'
if old_router not in text:
    raise SystemExit('Login router import not found')
text = text.replace(old_router, new_router, 1)
logo_import = 'import { MillionsNestLogo } from "../components/MillionsNestLogo.js";'
policy_import = logo_import + '\nimport { resolveSafePostLoginPath } from "../lib/connectLaunchPolicy.js";'
if logo_import not in text:
    raise SystemExit('Login import anchor not found')
text = text.replace(logo_import, policy_import, 1)
old_nav = '  const navigate = useNavigate();\n  const { t } = useTranslation([\'auth\']);'
new_nav = '  const navigate = useNavigate();\n  const location = useLocation();\n  const { t } = useTranslation([\'auth\']);'
if old_nav not in text:
    raise SystemExit('Login navigate anchor not found')
text = text.replace(old_nav, new_nav, 1)
old_block = '''      if (profile) {
          // UX Optimized: Check if user was trying to buy something before login
          const purchaseIntent = sessionStorage.getItem('purchase_intent');
          if (purchaseIntent) {
            sessionStorage.removeItem('purchase_intent');
            navigate(`/checkout?plan=${purchaseIntent}`);
          } else {
            navigate('/dashboard/overview');
          }
      }'''
new_block = '''      if (profile) {
          const safeNext = resolveSafePostLoginPath(location.search);
          if (safeNext) {
            navigate(safeNext, { replace: true });
            return;
          }

          // UX Optimized: Check if user was trying to buy something before login
          const purchaseIntent = sessionStorage.getItem('purchase_intent');
          if (purchaseIntent) {
            sessionStorage.removeItem('purchase_intent');
            navigate(`/checkout?plan=${purchaseIntent}`);
          } else {
            navigate('/dashboard/overview');
          }
      }'''
if old_block not in text:
    raise SystemExit('Login post-auth block not found')
text = text.replace(old_block, new_block, 1)
old_deps = '  }, [user, profile, authLoading, navigate]);'
new_deps = '  }, [user, profile, authLoading, navigate, location.search]);'
if old_deps not in text:
    raise SystemExit('Login effect dependencies not found')
text = text.replace(old_deps, new_deps, 1)
login.write_text(text)

apps = Path('src/lib/apps.ts')
text = apps.read_text()
old_connect = '''    url: ((typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env.VITE_CONNECT_APP_URL : undefined) || 'https://mn-connect-555464791734.web.app',
    operationalUrl: ((typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env.VITE_CONNECT_APP_URL : undefined) || 'https://mn-connect-555464791734.web.app',
    status: 'beta',
    primaryAction: 'disabled','''
new_connect = '''    url: ((typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env.VITE_CONNECT_APP_URL : undefined) || 'https://connect.millionsnest.com',
    operationalUrl: ((typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env.VITE_CONNECT_APP_URL : undefined) || 'https://connect.millionsnest.com',
    status: 'beta',
    primaryAction: 'open','''
if old_connect not in text:
    raise SystemExit('Connect catalog block not found')
text = text.replace(old_connect, new_connect, 1)
apps.write_text(text)

test = Path('scripts/test_connect_official_launch.ts')
test.write_text("""import {
  CONNECT_HUB_LAUNCH_PATH,
  CONNECT_OFFICIAL_URL,
  buildConnectLoginPath,
  resolveCanonicalConnectOrganizationId,
  resolveSafePostLoginPath,
} from '../src/lib/connectLaunchPolicy.js';

let passed = 0;
function assert(value: unknown, message: string) {
  if (!value) throw new Error(message);
  passed += 1;
}

assert(CONNECT_OFFICIAL_URL === 'https://connect.millionsnest.com', 'Connect official URL is canonical');
assert(CONNECT_HUB_LAUNCH_PATH === '/connect/launch', 'Hub launch route is fixed');
assert(buildConnectLoginPath() === '/login?next=%2Fconnect%2Flaunch', 'login return path is encoded and internal');
assert(resolveSafePostLoginPath('?next=%2Fconnect%2Flaunch') === '/connect/launch', 'Connect launch return is allowed');
assert(resolveSafePostLoginPath('?next=https%3A%2F%2Fevil.example') === null, 'external login return is rejected');
assert(resolveSafePostLoginPath('?next=%2F%2Fevil.example') === null, 'protocol-relative login return is rejected');
assert(resolveSafePostLoginPath('?next=%2Fdashboard%2Foverview') === null, 'unrelated internal return is rejected by narrow policy');
assert(resolveCanonicalConnectOrganizationId({ activeOrganizationId: ' org-1 ' }) === 'org-1', 'canonical active organization is normalized');
assert(resolveCanonicalConnectOrganizationId({}) === null, 'launch fails closed without canonical active organization');

console.log(`✅ Connect official launch policy: ${passed} / 9`);
""")

qa = Path('.github/workflows/millionsnest-qa.yml')
text = qa.read_text()
anchor = '''      - name: MusicScale handoff contract
        run: npx tsx scripts/test_mn_access_02_musicscale_handoff.ts
'''
addition = anchor + '''
      - name: Connect official-domain SSO launch contract
        run: npx tsx scripts/test_connect_official_launch.ts
'''
if anchor not in text:
    raise SystemExit('QA insertion anchor not found')
text = text.replace(anchor, addition, 1)
qa.write_text(text)
