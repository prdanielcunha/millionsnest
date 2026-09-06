import { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Loader2,
  MousePointerClick,
  RefreshCw,
  TrendingUp,
  UserPlus,
} from 'lucide-react';

type AdminUserLike = {
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
};

type FunnelStep = {
  key: string;
  label: string;
  sessions: number;
  reachedFromPrevious: number | null;
  conversionFromPrevious: number | null;
};

type GrowthSource = {
  source: string;
  sessions: number;
  events: number;
};

type GrowthPayload = {
  windowDays: number;
  truncated: boolean;
  summary: {
    eventsScanned: number;
    growthEventsMatched: number;
    funnel: FunnelStep[];
    sourceBreakdown: GrowthSource[];
    sameSessionHomeToCheckout: {
      sessions: number;
      conversion: number | null;
    };
  };
  recentEvents: any[];
};

const sourceLabels: Record<string, string> = {
  hero_primary: 'Hero principal',
  nav_product: 'Menu · MusicScale',
  nav_pricing: 'Menu · Planos',
  nav_trial: 'Menu · Experimentar',
  flagship_primary: 'Destaque MusicScale',
  flagship_pricing: 'Destaque · Planos',
  ecosystem_live: 'Ecossistema · Produto ativo',
  guarantee_primary: 'CTA final · Teste',
  guarantee_pricing: 'CTA final · Planos',
};

export function GrowthFunnelPanel({
  user,
  onRecentEvents,
}: {
  user: AdminUserLike | null;
  onRecentEvents?: (events: any[]) => void;
}) {
  const [days, setDays] = useState<7 | 30>(7);
  const [data, setData] = useState<GrowthPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/admin/analytics/growth?days=${days}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Não foi possível carregar o funil.');
      }

      const payload = (await response.json()) as GrowthPayload;
      setData(payload);

      if (onRecentEvents) {
        onRecentEvents(
          (payload.recentEvents || []).map((event) => ({
            ...event,
            timestamp: {
              seconds: Math.floor((event.timestampMs || 0) / 1000),
            },
          })),
        );
      }
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar o funil.');
    } finally {
      setLoading(false);
    }
  }, [days, onRecentEvents, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const funnel = data?.summary?.funnel || [];
  const firstCount = funnel[0]?.sessions || 0;
  const checkoutCount = funnel.find((step) => step.key === 'checkout_completed')?.sessions || 0;
  const interestCount = funnel.find((step) => step.key === 'musicscale_interest')?.sessions || 0;
  const signupCount = funnel.find((step) => step.key === 'signup')?.sessions || 0;

  return (
    <section className="rounded-3xl border border-white/10 bg-[#080B11] p-5 md:p-7">
      <div className="flex flex-col gap-5 border-b border-white/10 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6EAFFF]">
            Growth Intelligence
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">
            Funil comercial MillionsNest → MusicScale
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#8C97A7]">
            Sessões únicas por etapa. A passagem entre etapas usa a mesma sessionId, evitando taxas artificiais por simples divisão de volumes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {[7, 30].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setDays(value as 7 | 30)}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                days === value
                  ? 'border-[#2B85EB]/40 bg-[#2B85EB]/10 text-[#8EC2FF]'
                  : 'border-white/10 bg-white/[0.025] text-[#8C97A7] hover:bg-white/[0.05]'
              }`}
            >
              {value} dias
            </button>
          ))}
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.025] text-[#8C97A7] transition hover:bg-white/[0.05] disabled:opacity-50"
            aria-label="Atualizar funil"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex min-h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[#6EAFFF]" />
        </div>
      ) : error ? (
        <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-5 text-sm text-red-300">
          {error}
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: 'Sessões na Home',
                value: firstCount,
                icon: TrendingUp,
                detail: `últimos ${days} dias`,
              },
              {
                label: 'Interesse no MusicScale',
                value: interestCount,
                icon: MousePointerClick,
                detail:
                  firstCount > 0
                    ? `${Math.round((interestCount / firstCount) * 1000) / 10}% do volume da Home`
                    : 'sem base ainda',
              },
              {
                label: 'Cadastros',
                value: signupCount,
                icon: UserPlus,
                detail: 'novas sessões identificadas',
              },
              {
                label: 'Checkout concluído',
                value: checkoutCount,
                icon: CreditCard,
                detail:
                  data?.summary.sameSessionHomeToCheckout.conversion == null
                    ? 'sem base ainda'
                    : `${data.summary.sameSessionHomeToCheckout.conversion}% na mesma sessão da Home`,
              },
            ].map(({ label, value, icon: Icon, detail }) => (
              <div key={label} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
                <Icon className="h-4 w-4 text-[#6EAFFF]" />
                <div className="mt-7 text-3xl font-semibold tracking-[-0.04em] text-white">{value}</div>
                <div className="mt-1 text-sm font-medium text-[#D7DDE6]">{label}</div>
                <div className="mt-1 text-xs text-[#697484]">{detail}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-[1.45fr_.55fr]">
            <div className="rounded-2xl border border-white/[0.07] bg-[#05070B] p-5 md:p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Passagem por etapa</h3>
                  <p className="mt-1 text-xs text-[#697484]">
                    Conversão = sessões da etapa anterior que também chegaram à próxima.
                  </p>
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#596474]">
                  {data?.summary.growthEventsMatched || 0} eventos do funil
                </span>
              </div>

              <div className="space-y-3">
                {funnel.map((step, index) => {
                  const relativeWidth =
                    firstCount > 0 ? Math.max(3, Math.min(100, (step.sessions / firstCount) * 100)) : 0;
                  return (
                    <div key={step.key} className="rounded-xl border border-white/[0.06] bg-white/[0.018] p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="font-mono text-[10px] text-[#566171]">
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          <span className="truncate text-sm font-medium text-[#DDE2E9]">{step.label}</span>
                        </div>
                        <div className="flex shrink-0 items-center gap-3 text-right">
                          <span className="text-sm font-semibold text-white">{step.sessions}</span>
                          {step.conversionFromPrevious != null && (
                            <span className="min-w-14 rounded-md border border-white/[0.07] bg-white/[0.03] px-2 py-1 text-[10px] font-semibold text-[#8EC2FF]">
                              {step.conversionFromPrevious}%
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.04]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#2B85EB] to-[#6E56CF]"
                          style={{ width: `${relativeWidth}%` }}
                        />
                      </div>
                      {step.reachedFromPrevious != null && (
                        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-[#657080]">
                          <ArrowRight className="h-3 w-3" />
                          {step.reachedFromPrevious} sessões da etapa anterior chegaram aqui
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.07] bg-[#05070B] p-5 md:p-6">
              <h3 className="text-sm font-semibold text-white">Origem do interesse</h3>
              <p className="mt-1 text-xs leading-relaxed text-[#697484]">
                Qual CTA da Home está levando pessoas para o MusicScale.
              </p>

              <div className="mt-5 space-y-2">
                {(data?.summary.sourceBreakdown || []).length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/10 p-4 text-xs text-[#697484]">
                    Ainda não há cliques registrados nesta janela.
                  </div>
                ) : (
                  data!.summary.sourceBreakdown.map((source) => (
                    <div key={source.source} className="rounded-xl border border-white/[0.06] bg-white/[0.018] p-3.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-medium text-[#C9D0DA]">
                          {sourceLabels[source.source] || source.source}
                        </span>
                        <span className="text-sm font-semibold text-white">{source.sessions}</span>
                      </div>
                      <div className="mt-1 text-[10px] text-[#657080]">
                        {source.events} eventos · sessões únicas
                      </div>
                    </div>
                  ))
                )}
              </div>

              {data?.truncated && (
                <div className="mt-4 rounded-xl border border-amber-400/15 bg-amber-400/[0.05] p-3 text-[10px] leading-relaxed text-amber-200">
                  A janela atingiu o limite operacional de eventos. O painel continua seguro, mas esta leitura deve ser tratada como amostra.
                </div>
              )}

              <div className="mt-5 flex items-start gap-2 rounded-xl border border-emerald-400/10 bg-emerald-400/[0.035] p-3 text-[10px] leading-relaxed text-[#7D8998]">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />
                Nenhuma ferramenta paga de analytics foi adicionada. O painel usa o feed interno MillionsNest.
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
