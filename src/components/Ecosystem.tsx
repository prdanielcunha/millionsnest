import { motion } from "framer-motion";
import { ArrowUpRight, MapPin, Network, Route } from "lucide-react";
import { useTranslation, Trans } from 'react-i18next';
import { useNavigate } from "react-router-dom";
import { ECOSYSTEM_APPS, type EcosystemApp } from "../lib/apps.js";
import { trackHomeMusicScaleInterest } from "../lib/publicFunnelAnalytics.js";

const publicProductIds = new Set(['musicscale', 'nestfinance', 'nestlocal', 'nestjourney']);

function ProductIcon({ app }: { app: EcosystemApp }) {
  if (app.iconAsset) return <img src={app.iconAsset} alt="" aria-hidden="true" draggable={false} className="h-7 w-7 object-contain" />;
  if (app.id === 'nestlocal') return <MapPin className="h-5 w-5" />;
  if (app.id === 'nestjourney') return <Route className="h-5 w-5" />;
  return <img src="/LogoIconMusicScale-1.png" alt="" aria-hidden="true" className="h-6 w-6 object-contain" />;
}

export function Ecosystem() {
  const { t } = useTranslation(['landing']);
  const navigate = useNavigate();
  const products = ECOSYSTEM_APPS.filter(app => publicProductIds.has(app.id));
  const activeProduct = products.find(app => app.status === 'active');
  const futureProducts = products.filter(app => app.status !== 'active');
  const connect = ECOSYSTEM_APPS.find(app => app.id === 'connect');

  const descriptionKey: Record<string, string> = {
    musicscale: 'ecosystem_musicscale_desc',
    nestfinance: 'ecosystem_nestfinance_desc',
    nestlocal: 'ecosystem_nestlocal_desc',
    nestjourney: 'ecosystem_nestjourney_desc',
  };
  const highlights: Record<string, string[]> = {
    musicscale: [t('ecosystem_musicscale_h1'), t('ecosystem_musicscale_h2')],
    nestfinance: [t('ecosystem_nestfinance_h1'), t('ecosystem_nestfinance_h2')],
    nestlocal: [t('ecosystem_nestlocal_h1'), t('ecosystem_nestlocal_h2')],
    nestjourney: [t('ecosystem_nestjourney_h1'), t('ecosystem_nestjourney_h2')],
  };

  return (
    <section id="ecossistema" className="relative overflow-hidden border-b border-white/[0.06] bg-[#070A10] py-24 md:py-32">
      <div className="absolute left-1/2 top-1/3 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-[#2B85EB]/[0.05] blur-[140px]" />
      <div className="relative z-10 mx-auto max-w-7xl px-6">
        <div className="max-w-4xl">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6EAFFF]">{t('eco_tag')}</div>
          <h2 className="mt-5 text-4xl font-semibold leading-[1.02] tracking-[-0.05em] text-white md:text-6xl">
            <Trans i18nKey="landing:eco_title" components={{ 1: <span className="text-[#8D98A8]" /> }} />
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[#8792A1]">{t('eco_desc')}</p>
        </div>

        <div className="mt-14 grid gap-5 lg:grid-cols-[1.18fr_.82fr]">
          {activeProduct && (
            <motion.button
              type="button"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              onClick={() => {
                if (activeProduct.id === 'musicscale') trackHomeMusicScaleInterest('ecosystem_live');
                if (activeProduct.landingRoute) navigate(activeProduct.landingRoute);
              }}
              className="group relative min-h-[430px] overflow-hidden rounded-[28px] border border-[#2B85EB]/25 bg-[#0A1019] p-7 text-left shadow-[0_35px_90px_rgba(0,0,0,0.28)] transition hover:border-[#2B85EB]/45 md:p-9"
            >
              <div className="absolute right-[-10%] top-[-20%] h-80 w-80 rounded-full bg-[#2B85EB]/15 blur-[100px]" />
              <div className="relative z-10 flex h-full flex-col">
                <div className="flex items-center justify-between">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#2B85EB]/20 bg-[#2B85EB]/10 text-[#7BB8FF]">
                    <ProductIcon app={activeProduct} />
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[0.055] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                    {t('ecosystem_status_live')}
                  </span>
                </div>

                <div className="mt-auto max-w-2xl pt-16">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#687384]">{t('eco_live_label')}</div>
                  <h3 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-white">{activeProduct.name}</h3>
                  <p className="mt-4 text-base leading-relaxed text-[#8B96A6] md:text-lg">{t(descriptionKey[activeProduct.id], activeProduct.description)}</p>
                  <div className="mt-7 flex flex-wrap gap-2">
                    {(highlights[activeProduct.id] || []).map(item => (
                      <span key={item} className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-[#A9B2BF]">{item}</span>
                    ))}
                  </div>
                  <div className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[#CFE3FF]">
                    {t('flagship_cta')} <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </div>
                </div>
              </div>
            </motion.button>
          )}

          <div className="rounded-[28px] border border-white/[0.07] bg-[#090C12] p-5 md:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#687384]">{t('eco_next_label')}</div>
                <div className="mt-1 text-sm font-medium text-[#CCD2DC]">{t('eco_next_desc')}</div>
              </div>
            </div>
            <div className="space-y-2">
              {futureProducts.map((app, idx) => {
                const statusLabel = t(app.badgeLabelKey || 'ecosystem_status_soon');
                return (
                  <motion.div key={app.id} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: idx * 0.04 }} className="rounded-2xl border border-white/[0.06] bg-white/[0.018] p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.035] text-[#A7B0BD]">
                        <ProductIcon app={app} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="font-semibold text-[#E4E8EF]">{app.name}</h3>
                          <span className="rounded-md border border-white/[0.07] bg-white/[0.03] px-2 py-1 text-[8px] font-bold uppercase tracking-wider text-[#737E8D]">{statusLabel}</span>
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-[#727D8C]">{t(descriptionKey[app.id], app.description)}</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>

        {connect && (
          <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mt-5 grid gap-5 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 sm:grid-cols-[auto_1fr_auto] sm:items-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035]">
              {connect.iconAsset ? <img src={connect.iconAsset} alt="" aria-hidden="true" className="h-6 w-6 object-contain" /> : <Network className="h-5 w-5 text-[#8590A0]" />}
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#667181]">{t('eco_foundation_label')}</div>
              <div className="mt-1 text-sm font-semibold text-[#E0E5EC]">{connect.name}</div>
              <p className="mt-1 text-sm leading-relaxed text-[#788392]">{t('ecosystem_connect_desc', connect.description)}</p>
            </div>
            <div className="hidden text-xs text-[#626D7B] sm:block">{t('ecosystem_status_infrastructure')}</div>
          </motion.div>
        )}
      </div>
    </section>
  );
}
