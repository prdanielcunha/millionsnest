import {useEffect, useState} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {useAuth} from '../contexts/AuthContext.js';
import {MillionsNestLogo} from '../components/MillionsNestLogo.js';

/** Acquisition never creates a Stripe session or selects a paid plan. */
export default function StartTrial() {
  const {user, profile, canonicalContext, loading} = useAuth();
  const {t, i18n} = useTranslation('auth');
  const navigate = useNavigate();
  const appId = new URLSearchParams(window.location.search).get('app') === 'nestlocal' ? 'nestlocal' : 'musicscale';
  const appName = appId === 'musicscale' ? 'MusicScale' : 'NestLocal';
  const organizationId = canonicalContext?.activeOrganizationId || profile?.activeOrganizationId || profile?.primaryOrganizationId || profile?.organizationId;
  const [offer, setOffer] = useState<{available:boolean; trialActive?:boolean; expiresAt?:string; reason?:string} | null>(null);
  const [checking, setChecking] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let canceled = false;
    setOffer(null); setError('');
    if (loading || !user || !organizationId) return;
    setChecking(true);
    void (async () => {
      try {
        const token = await user.getIdToken();
        const query = new URLSearchParams({appId, organizationId});
        const response = await fetch('/api/v1/billing/trial/offer?' + query, {
          headers:{Authorization:'Bearer ' + token}, cache:'no-store',
        });
        if (!response.ok) throw Error('OFFER_UNAVAILABLE');
        const data = await response.json();
        if (!canceled) setOffer(data);
      } catch {
        if (!canceled) setError(t('trial_error'));
      } finally { if (!canceled) setChecking(false); }
    })();
    return () => { canceled = true; };
  }, [loading, user, organizationId, appId, retry, t]);

  const activate = async () => {
    if (!user) {
      sessionStorage.removeItem('purchase_intent');
      sessionStorage.removeItem('purchase_app');
      navigate('/login?next=' + encodeURIComponent('/start-trial?app=' + appId));
      return;
    }
    if (!organizationId || !offer?.available || starting) return;
    setStarting(true); setError('');
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/v1/billing/trial/activate', {
        method:'POST', headers:{Authorization:'Bearer ' + token, 'Content-Type':'application/json'},
        body:JSON.stringify({appId, organizationId}),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok !== true) throw Error('ACTIVATION_FAILED');
      // The launcher freshly resolves the server entitlement and preserves the tenant.
      navigate('/apps/' + appId + '/launch', {replace:true});
    } catch { setError(t('trial_error')); }
    finally { setStarting(false); }
  };

  const busy = loading || checking || starting;
  const canStart = !user || offer?.available === true;
  return <main className="min-h-screen bg-[#05070A] px-5 py-10 text-white flex items-center justify-center">
    <section className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0B0F19] p-7 sm:p-10">
      <Link to="/"><MillionsNestLogo className="h-9 w-auto mb-10" /></Link>
      <p className="text-sm text-emerald-300 mb-3">{appName} · {t('trial_badge')}</p>
      <h1 className="text-3xl font-semibold tracking-tight">{t('trial_title')}</h1>
      <p className="mt-4 text-slate-300 leading-relaxed">{t('trial_description')}</p>
      <p className="mt-4 text-sm text-slate-400 leading-relaxed">{t(appId === 'musicscale' ? 'trial_limits_music' : 'trial_limits_local')}</p>
      {user && organizationId && <p className="mt-5 text-sm text-slate-400">{canonicalContext?.organizations?.find((org:any) => org.id === organizationId)?.name || profile?.organizationName || appName}</p>}
      {offer?.trialActive && <p className="mt-5 text-emerald-300">{t('trial_active')} {offer.expiresAt && new Date(offer.expiresAt).toLocaleString(i18n.language)}</p>}
      {offer && !offer.available && !offer.trialActive && <p className="mt-5 text-slate-300">{t(offer.reason === 'offer_disabled' ? 'trial_disabled' : 'trial_unavailable')}</p>}
      {error && <p role="alert" className="mt-5 text-sm text-amber-200">{error}</p>}
      {canStart && <button type="button" onClick={activate} disabled={busy}
        className="mt-7 w-full rounded-xl bg-white px-5 py-3.5 font-semibold text-black disabled:opacity-50">
        {busy ? t('trial_loading') : t('trial_start')}
      </button>}
      {!canStart && !busy && offer && offer.reason !== 'offer_disabled' && <Link to={'/apps/' + appId + '/launch'} className="mt-7 block rounded-xl bg-white px-5 py-3.5 text-center font-semibold text-black">{t('trial_open')}</Link>}
      {(error || (!loading && user && !organizationId)) && <button onClick={() => setRetry(value => value + 1)} className="mt-5 block text-sm underline">{t('trial_retry')}</button>}
      {user && !organizationId && !loading && <Link to="/dashboard" className="mt-5 block text-sm underline">{t('trial_organization')}</Link>}
      {user && offer && !offer.available && !offer.trialActive && offer.reason !== 'offer_disabled' && <Link to={'/checkout?app=' + appId} className="mt-5 block text-center text-sm text-slate-300 underline">{t('trial_plans')}</Link>}
      <p className="mt-6 text-xs text-slate-400 leading-relaxed">{t('trial_no_charge')}</p>
    </section>
  </main>;
}
