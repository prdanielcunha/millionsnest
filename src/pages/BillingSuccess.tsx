import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Loader2,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Check,
  BookOpen
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext.js';
import { analytics } from '../lib/analytics.js';
import { openEcosystemModule } from '../lib/ecosystemLauncher.js';

export default function BillingSuccess() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const requestedApp =
    searchParams.get('app') === 'nestlocal'
      ? 'nestlocal'
      : 'musicscale';

  const navigate = useNavigate();
  const { t } = useTranslation(['checkout']);
  const { user, profile, loading } = useAuth();

  const [status, setStatus] = useState<
    'loading' | 'success' | 'error'
  >('loading');
  const [message, setMessage] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [confirmedOrganizationId, setConfirmedOrganizationId] =
    useState<string | null>(null);
  const [launchingApp, setLaunchingApp] = useState(false);
  const [confirmedApp, setConfirmedApp] = useState<
    'musicscale' | 'nestlocal'
  >(requestedApp);

  const appName =
    confirmedApp === 'nestlocal'
      ? 'NestLocal'
      : 'MusicScale';

  const activationSteps = useMemo(
    () =>
      confirmedApp === 'nestlocal'
        ? [
            t('activation.nestlocal_step_1'),
            t('activation.nestlocal_step_2'),
            t('activation.nestlocal_step_3')
          ]
        : [
            t('activation.musicscale_step_1'),
            t('activation.musicscale_step_2'),
            t('activation.musicscale_step_3')
          ],
    [confirmedApp, t]
  );

  const launchPurchasedApp = useCallback(
    async (organizationId: string | null) => {
      if (!user || !organizationId) {
        navigate('/dashboard');
        return;
      }

      setLaunchingApp(true);

      try {
        analytics.track('app_usage', {
          app: confirmedApp,
          userId: user.uid,
          organizationId,
          metadata: {
            action: 'post_checkout_launch',
            source: 'billing_success'
          }
        });

        await openEcosystemModule(
          confirmedApp,
          user,
          profile,
          { id: organizationId },
          {}
        );
      } catch (error) {
        console.warn(
          '[BillingSuccess] Direct app launch failed; keeping recovery UI available.',
          error
        );
        setMessage(
          t('activation.launch_failed', {
            app: confirmedApp === 'nestlocal'
              ? 'NestLocal'
              : 'MusicScale'
          })
        );
        setLaunchingApp(false);
      }
    },
    [confirmedApp, navigate, profile, t, user]
  );

  const openGettingStarted = useCallback(() => {
    if (confirmedApp === 'musicscale') {
      navigate(
        '/dashboard/apps/musicscale?section=getting-started'
      );
      return;
    }

    navigate('/dashboard/apps/nestlocal');
  }, [confirmedApp, navigate]);

  useEffect(() => {
    setMessage(
      t('activation.loading_message', {
        app:
          requestedApp === 'nestlocal'
            ? 'NestLocal'
            : 'MusicScale'
      })
    );
  }, [requestedApp, t]);

  useEffect(() => {
    if (!sessionId) {
      navigate('/dashboard/billing');
      return;
    }

    if (loading) return;

    if (!user) {
      setStatus('error');
      setMessage(t('activation.session_expired'));
      return;
    }

    let isMounted = true;

    const confirmCheckout = async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch(
          '/api/v1/billing/checkout/confirm',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              session_id: sessionId
            })
          }
        );

        const data = await res.json();
        if (!isMounted) return;

        if (
          data.ok &&
          data.action === 'subscription_ready'
        ) {
          const purchasedApp =
            data.app === 'nestlocal'
              ? 'nestlocal'
              : 'musicscale';

          setStatus('success');
          setConfirmedApp(purchasedApp);
          setMessage(
            t('activation.activated_message', {
              app:
                purchasedApp === 'nestlocal'
                  ? 'NestLocal'
                  : 'MusicScale'
            })
          );

          const organizationId =
            data.organizationId || null;
          setConfirmedOrganizationId(
            organizationId
          );

          const analyticsKey =
            `mn_checkout_completed_${sessionId}`;

          if (
            !sessionStorage.getItem(
              analyticsKey
            )
          ) {
            analytics.track(
              'checkout_completed',
              {
                app: purchasedApp,
                userId: user.uid,
                organizationId:
                  organizationId ||
                  undefined,
                metadata: {
                  source:
                    'billing_confirmation'
                }
              }
            );

            sessionStorage.setItem(
              analyticsKey,
              '1'
            );
          }

          return;
        }

        if (
          data.ok &&
          data.action === 'provisioning'
        ) {
          if (retryCount < 5) {
            window.setTimeout(() => {
              if (isMounted) {
                setRetryCount(
                  current => current + 1
                );
              }
            }, data.retryAfterMs || 2000);
            return;
          }

          setStatus('error');
          setMessage(
            t(
              'activation.provisioning_delayed'
            )
          );
          return;
        }

        setStatus('error');
        setMessage(
          data.error ||
            t('activation.confirmation_failed')
        );
      } catch {
        if (!isMounted) return;

        setStatus('error');
        setMessage(
          t('activation.verification_error')
        );
      }
    };

    void confirmCheckout();

    return () => {
      isMounted = false;
    };
  }, [
    sessionId,
    retryCount,
    user,
    loading,
    navigate,
    t
  ]);

  return (
    <div className="min-h-screen bg-[#07090D] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl items-center justify-center">
        <div className="w-full overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[#0B0F16] shadow-[0_32px_120px_rgba(0,0,0,.35)]">
          <div className="relative border-b border-white/[0.07] px-6 py-8 text-center sm:px-9">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(43,133,235,.16),transparent_58%)]" />

            {status === 'loading' && (
              <div className="relative">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#2B85EB]/20 bg-[#2B85EB]/10">
                  <Loader2 className="h-8 w-8 animate-spin text-[#78B8FF]" />
                </div>
                <h1 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
                  {t('activation.loading_title')}
                </h1>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[#9AA6B6]">
                  {message}
                </p>
              </div>
            )}

            {status === 'success' && (
              <div className="relative">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.08]">
                  <CheckCircle className="h-8 w-8 text-emerald-300" />
                </div>
                <h1 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
                  {t('activation.activated_title')}
                </h1>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[#9AA6B6]">
                  {message}
                </p>
              </div>
            )}

            {status === 'error' && (
              <div className="relative">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/[0.08]">
                  <AlertCircle className="h-8 w-8 text-amber-300" />
                </div>
                <h1 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
                  {t('activation.warning_title')}
                </h1>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[#9AA6B6]">
                  {message}
                </p>
              </div>
            )}
          </div>

          {status === 'success' && (
            <div className="px-6 py-7 sm:px-9 sm:py-8">
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
                <div className="mb-4 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-[#86BEFF]" />
                  <h2 className="text-sm font-semibold text-white">
                    {t('activation.next_title')}
                  </h2>
                </div>

                <div className="space-y-3">
                  {activationSteps.map(
                    (step, index) => (
                      <div
                        key={step}
                        className="flex items-start gap-3"
                      >
                        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-emerald-400/15 bg-emerald-400/[0.07]">
                          <Check className="h-3.5 w-3.5 text-emerald-300" />
                        </div>
                        <p className="text-sm leading-relaxed text-[#A6B0BE]">
                          <span className="mr-1 font-semibold text-white/80">
                            {index + 1}.
                          </span>
                          {step}
                        </p>
                      </div>
                    )
                  )}
                </div>
              </div>

              <p className="mt-4 text-center text-xs leading-relaxed text-[#758091]">
                {t('activation.access_note', {
                  app: appName
                })}
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() =>
                    void launchPurchasedApp(
                      confirmedOrganizationId
                    )
                  }
                  disabled={launchingApp}
                  className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#06080C] transition hover:bg-[#F2F5F8] disabled:cursor-wait disabled:opacity-60"
                >
                  {launchingApp ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t(
                        'activation.opening_app',
                        { app: appName }
                      )}
                    </>
                  ) : (
                    <>
                      {t(
                        'activation.open_app',
                        { app: appName }
                      )}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={openGettingStarted}
                  className="min-h-[50px] rounded-xl border border-white/[0.09] bg-white/[0.035] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.07]"
                >
                  {t('activation.guide_action')}
                </button>
              </div>

              <button
                type="button"
                onClick={() =>
                  navigate('/dashboard')
                }
                className="mt-3 w-full py-2 text-xs font-medium text-[#798596] transition hover:text-white"
              >
                {t('activation.dashboard_action')}
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="grid gap-3 px-6 py-7 sm:grid-cols-2 sm:px-9">
              <button
                type="button"
                onClick={() => {
                  setStatus('loading');
                  setRetryCount(0);
                  setMessage(
                    t(
                      'activation.loading_message',
                      {
                        app:
                          requestedApp ===
                          'nestlocal'
                            ? 'NestLocal'
                            : 'MusicScale'
                      }
                    )
                  );
                }}
                className="min-h-[48px] rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#06080C] transition hover:bg-[#F2F5F8]"
              >
                {t('activation.retry_action')}
              </button>
              <button
                type="button"
                onClick={() =>
                  navigate('/dashboard/billing')
                }
                className="min-h-[48px] rounded-xl border border-white/[0.09] bg-white/[0.035] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.07]"
              >
                {t('activation.billing_action')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
