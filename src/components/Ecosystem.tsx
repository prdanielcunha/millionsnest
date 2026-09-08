import { motion } from "framer-motion";
import { ArrowUpRight, BarChart3, MapPin, Network, Route, Sparkles, UsersRound, WalletCards } from "lucide-react";
import { useTranslation, Trans } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ECOSYSTEM_APPS, type EcosystemApp } from "../lib/apps.js";
import { trackHomeMusicScaleInterest } from "../lib/publicFunnelAnalytics.js";

const publicProductIds = new Set(["musicscale", "nestfinance", "nestlocal", "nestjourney"]);

function ProductIcon({ app }: { app: EcosystemApp }) {
  if (app.iconAsset) {
    return <img src={app.iconAsset} alt="" aria-hidden="true" draggable={false} className="h-7 w-7 object-contain" />;
  }
  if (app.id === "nestlocal") return <MapPin className="h-5 w-5" />;
  if (app.id === "nestjourney") return <Route className="h-5 w-5" />;
  return <img src="/LogoIconMusicScale-1.png" alt="" aria-hidden="true" className="h-6 w-6 object-contain" />;
}

function ProductPreview({ appId }: { appId: string }) {
  const { t } = useTranslation(["landing"]);

  if (appId === "musicscale") {
    return (
      <div className="grid h-full min-h-[250px] grid-rows-[auto_1fr] overflow-hidden rounded-[22px] border border-white/[0.07] bg-[#06090E]">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#66A8FF]" />
            <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#728093]">MusicScale</span>
          </div>
          <span className="rounded-md border border-emerald-400/15 bg-emerald-400/[0.055] px-2 py-1 text-[8px] font-bold uppercase tracking-wider text-emerald-300">{t("eco_preview_ready")}</span>
        </div>
        <div className="grid gap-2 p-3 sm:grid-cols-[.42fr_.58fr]">
          <div className="space-y-2">
            {[t("eco_preview_service"), t("eco_preview_repertoire"), t("eco_preview_team")].map((label, index) => (
              <div key={label} className={`rounded-xl border p-3 ${index === 0 ? "border-[#2B85EB]/20 bg-[#2B85EB]/[0.08]" : "border-white/[0.05] bg-white/[0.018]"}`}>
                <p className="text-[9px] font-semibold text-[#A9B3C1]">{label}</p>
                <div className="mt-2 h-1.5 rounded-full bg-white/[0.06]">
                  <div className={`h-full rounded-full ${index === 0 ? "w-4/5 bg-[#66A8FF]/70" : index === 1 ? "w-3/5 bg-white/15" : "w-2/3 bg-white/15"}`} />
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.018] p-3">
            <div className="flex items-center justify-between">
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#697484]">{t("eco_preview_next_scale")}</p>
              <UsersRound className="h-3.5 w-3.5 text-[#66A8FF]" />
            </div>
            <div className="mt-5 space-y-2">
              {[82, 64, 72, 48].map((width, index) => (
                <div key={index} className="flex items-center gap-2 rounded-lg border border-white/[0.045] bg-black/20 p-2">
                  <span className="h-5 w-5 rounded-md bg-white/[0.05]" />
                  <span className="h-1.5 rounded-full bg-white/10" style={{ width: `${width}%` }} />
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-300/80" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const Icon = appId === "nestfinance" ? WalletCards : appId === "nestlocal" ? BarChart3 : Route;
  return (
    <div className="relative min-h-[210px] overflow-hidden rounded-[22px] border border-white/[0.06] bg-[#06090E] p-4">
      <div className="absolute right-[-15%] top-[-25%] h-40 w-40 rounded-full bg-[#2B85EB]/10 blur-[70px]" />
      <div className="relative">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025] text-[#7BB8FF]">
          <Icon className="h-4 w-4" />
        </div>
        <div className="mt-8 grid grid-cols-3 gap-2">
          {[64, 82, 48].map((width, index) => (
            <div key={index} className="rounded-xl border border-white/[0.05] bg-white/[0.018] p-3">
              <div className="h-1.5 rounded-full bg-white/[0.07]">
                <div className="h-full rounded-full bg-[#66A8FF]/45" style={{ width: `${width}%` }} />
              </div>
              <div className="mt-6 h-5 w-2/3 rounded-md bg-white/[0.05]" />
              <div className="mt-2 h-1.5 w-full rounded-full bg-white/[0.04]" />
            </div>
          ))}
        </div>
        <div className="mt-2 rounded-xl border border-white/[0.05] bg-white/[0.015] p-3">
          <div className="h-1.5 w-4/5 rounded-full bg-white/[0.06]" />
          <div className="mt-2 h-1.5 w-3/5 rounded-full bg-white/[0.04]" />
        </div>
      </div>
    </div>
  );
}

export function Ecosystem() {
  const { t } = useTranslation(["landing"]);
  const navigate = useNavigate();
  const products = ECOSYSTEM_APPS.filter(app => publicProductIds.has(app.id));
  const activeProduct = products.find(app => app.status === "active");
  const futureProducts = products.filter(app => app.status !== "active");
  const connect = ECOSYSTEM_APPS.find(app => app.id === "connect");

  const descriptionKey: Record<string, string> = {
    musicscale: "ecosystem_musicscale_desc",
    nestfinance: "ecosystem_nestfinance_desc",
    nestlocal: "ecosystem_nestlocal_desc",
    nestjourney: "ecosystem_nestjourney_desc",
  };
  const highlights: Record<string, string[]> = {
    musicscale: [t("ecosystem_musicscale_h1"), t("ecosystem_musicscale_h2")],
    nestfinance: [t("ecosystem_nestfinance_h1"), t("ecosystem_nestfinance_h2")],
    nestlocal: [t("ecosystem_nestlocal_h1"), t("ecosystem_nestlocal_h2")],
    nestjourney: [t("ecosystem_nestjourney_h1"), t("ecosystem_nestjourney_h2")],
  };

  return (
    <section id="ecossistema" className="relative overflow-hidden border-b border-white/[0.06] bg-[#070A10] py-24 md:py-32">
      <div className="absolute left-1/2 top-1/3 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-[#2B85EB]/[0.05] blur-[140px]" />
      <div className="relative z-10 mx-auto max-w-7xl px-6">
        <div className="grid gap-8 lg:grid-cols-[1fr_.55fr] lg:items-end">
          <div className="max-w-4xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6EAFFF]">{t("eco_tag")}</div>
            <h2 className="mt-5 text-4xl font-semibold leading-[1.02] tracking-[-0.05em] text-white md:text-6xl">
              <Trans i18nKey="landing:eco_title" components={{ 1: <span className="text-[#8D98A8]" /> }} />
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[#8792A1]">{t("eco_desc")}</p>
          </div>
          <div className="lg:justify-self-end">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.025] px-3.5 py-2 text-[10px] font-semibold text-[#8994A4]">
              <Sparkles className="h-3.5 w-3.5 text-[#66A8FF]" />
              {t("eco_gallery_hint")}
            </div>
          </div>
        </div>

        {activeProduct && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            onClick={() => {
              if (activeProduct.id === "musicscale") trackHomeMusicScaleInterest("ecosystem_live");
              if (activeProduct.landingRoute) navigate(activeProduct.landingRoute);
            }}
            className="group relative mt-14 w-full overflow-hidden rounded-[30px] border border-[#2B85EB]/25 bg-[#0A1019] p-4 text-left shadow-[0_35px_90px_rgba(0,0,0,0.28)] transition hover:border-[#2B85EB]/45 sm:p-5"
          >
            <div className="absolute right-[-10%] top-[-30%] h-96 w-96 rounded-full bg-[#2B85EB]/15 blur-[110px]" />
            <div className="relative grid gap-5 lg:grid-cols-[.72fr_1.28fr] lg:items-stretch">
              <div className="flex min-h-[330px] flex-col p-3 sm:p-5">
                <div className="flex items-center justify-between">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#2B85EB]/20 bg-[#2B85EB]/10 text-[#7BB8FF]">
                    <ProductIcon app={activeProduct} />
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[0.055] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                    {t("ecosystem_status_live")}
                  </span>
                </div>

                <div className="mt-auto max-w-2xl pt-14">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#687384]">{t("eco_live_label")}</div>
                  <h3 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-white">{activeProduct.name}</h3>
                  <p className="mt-4 text-base leading-relaxed text-[#8B96A6] md:text-lg">{t(descriptionKey[activeProduct.id], activeProduct.description)}</p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    {(highlights[activeProduct.id] || []).map(item => (
                      <span key={item} className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-[#A9B2BF]">{item}</span>
                    ))}
                  </div>
                  <div className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-[#CFE3FF]">
                    {t("flagship_cta")} <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </div>
                </div>
              </div>

              <div className="min-w-0">
                <ProductPreview appId={activeProduct.id} />
              </div>
            </div>
          </motion.button>
        )}

        <div className="mt-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#687384]">{t("eco_next_label")}</div>
              <div className="mt-1 text-sm font-medium text-[#CCD2DC]">{t("eco_next_desc")}</div>
            </div>
          </div>

          <div className="-mx-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-6 pb-2 no-scrollbar md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
            {futureProducts.map((app, idx) => {
              const statusLabel = t(app.badgeLabelKey || "ecosystem_status_soon");
              return (
                <motion.article
                  key={app.id}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.04 }}
                  className="w-[82vw] max-w-[360px] shrink-0 snap-center overflow-hidden rounded-[24px] border border-white/[0.07] bg-[#090C12] p-3 sm:w-[70vw] md:w-auto md:max-w-none"
                >
                  <ProductPreview appId={app.id} />
                  <div className="p-3 pt-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-[#A7B0BD]">
                          <ProductIcon app={app} />
                        </div>
                        <h3 className="truncate font-semibold text-[#E4E8EF]">{app.name}</h3>
                      </div>
                      <span className="shrink-0 rounded-md border border-white/[0.07] bg-white/[0.03] px-2 py-1 text-[8px] font-bold uppercase tracking-wider text-[#737E8D]">{statusLabel}</span>
                    </div>
                    <p className="mt-3 text-xs leading-relaxed text-[#727D8C]">{t(descriptionKey[app.id], app.description)}</p>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {(highlights[app.id] || []).map(item => (
                        <span key={item} className="rounded-full border border-white/[0.06] bg-white/[0.018] px-2.5 py-1 text-[9px] text-[#7D8897]">{item}</span>
                      ))}
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>
        </div>

        {connect && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-5 grid gap-5 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 sm:grid-cols-[auto_1fr_auto] sm:items-center"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035]">
              {connect.iconAsset ? <img src={connect.iconAsset} alt="" aria-hidden="true" className="h-6 w-6 object-contain" /> : <Network className="h-5 w-5 text-[#8590A0]" />}
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#667181]">{t("eco_foundation_label")}</div>
              <div className="mt-1 text-sm font-semibold text-[#E0E5EC]">{connect.name}</div>
              <p className="mt-1 text-sm leading-relaxed text-[#788392]">{t("ecosystem_connect_desc", connect.description)}</p>
            </div>
            <div className="hidden text-xs text-[#626D7B] sm:block">{t("ecosystem_status_infrastructure")}</div>
          </motion.div>
        )}
      </div>
    </section>
  );
}
