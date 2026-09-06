import { motion } from "framer-motion";
import { MapPin, Route, Network } from "lucide-react";
import { useTranslation, Trans } from 'react-i18next';
import { useNavigate } from "react-router-dom";
import { ECOSYSTEM_APPS, type EcosystemApp } from "../lib/apps.js";

const publicProductIds = new Set(['musicscale', 'nestfinance', 'nestlocal', 'nestjourney']);

function ProductIcon({ app }: { app: EcosystemApp }) {
  if (app.iconAsset) {
    return <img src={app.iconAsset} alt="" aria-hidden="true" draggable={false} className="w-7 h-7 object-contain" />;
  }
  if (app.id === 'nestlocal') return <MapPin className="w-5 h-5" />;
  if (app.id === 'nestjourney') return <Route className="w-5 h-5" />;
  return <img src="/LogoIconMusicScale-1.png" alt="" aria-hidden="true" className="w-5 h-5 object-contain" />;
}

export function Ecosystem() {
  const { t } = useTranslation(['landing']);
  const navigate = useNavigate();
  const products = ECOSYSTEM_APPS.filter(app => publicProductIds.has(app.id));
  const connect = ECOSYSTEM_APPS.find(app => app.id === 'connect');

  const highlights: Record<string, string[]> = {
    musicscale: [t('ecosystem_musicscale_h1'), t('ecosystem_musicscale_h2')],
    nestfinance: [t('ecosystem_nestfinance_h1'), t('ecosystem_nestfinance_h2')],
    nestlocal: [t('ecosystem_nestlocal_h1'), t('ecosystem_nestlocal_h2')],
    nestjourney: [t('ecosystem_nestjourney_h1'), t('ecosystem_nestjourney_h2')],
  };
  const descriptionKey: Record<string, string> = {
    musicscale: 'ecosystem_musicscale_desc',
    nestfinance: 'ecosystem_nestfinance_desc',
    nestlocal: 'ecosystem_nestlocal_desc',
    nestjourney: 'ecosystem_nestjourney_desc',
  };

  return (
    <section id="ecossistema" className="py-24 md:py-32 bg-[#050505] border-b border-white/5 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl h-[400px] bg-white/5 rounded-[100%] blur-[120px] pointer-events-none transform-gpu" />
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-16 md:mb-24">
          <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[11px] font-medium text-[#A0A7B5] uppercase tracking-widest mb-6">{t('eco_tag')}</motion.div>
          <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-4xl md:text-5xl font-semibold text-[#F5F7FA] tracking-tight mb-6">
            <Trans i18nKey="landing:eco_title" components={{ 1: <span className="text-[#2B85EB]" /> }} />
          </motion.h2>
          <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-lg text-[#A0A7B5] font-normal leading-relaxed">{t('eco_desc')}</motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {products.map((app, idx) => {
            const active = app.status === 'active';
            const statusLabel = active ? t('ecosystem_status_live') : t(app.badgeLabelKey || 'ecosystem_status_soon');
            return (
              <motion.div key={app.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: idx * 0.05 }} onClick={() => active && app.landingRoute && navigate(app.landingRoute)} className={`rounded-3xl p-7 md:p-8 border relative overflow-hidden flex flex-col min-h-[300px] transition-all ${active ? 'bg-[#2B85EB]/5 border-[#2B85EB]/25 shadow-[0_0_40px_rgba(43,133,235,0.06)] cursor-pointer hover:border-[#2B85EB]/50' : 'bg-[#0B0F19] border-white/5 hover:border-white/10'}`}>
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.025] to-transparent pointer-events-none" />
                <div className="flex items-start justify-between gap-4 mb-8 relative z-10">
                  <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center ${active ? 'bg-[#2B85EB]/10 text-[#2B85EB] border-[#2B85EB]/20' : 'bg-white/5 text-[#F5F7FA] border-white/10'}`}><ProductIcon app={app} /></div>
                  <span className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg uppercase tracking-widest border ${active ? 'bg-[#2B85EB]/10 text-[#2B85EB] border-[#2B85EB]/20' : 'bg-white/5 text-[#A0A7B5] border-white/10'}`}>{statusLabel}</span>
                </div>
                <div className="relative z-10 flex-1">
                  <h3 className="text-2xl font-semibold text-[#F5F7FA] mb-3">{app.name}</h3>
                  <p className="text-[#A0A7B5] text-sm md:text-base leading-relaxed max-w-xl">{t(descriptionKey[app.id], app.description)}</p>
                </div>
                <ul className="grid sm:grid-cols-2 gap-3 relative z-10 border-t border-white/5 pt-6 mt-8">
                  {(highlights[app.id] || []).map(item => <li key={item} className="text-xs text-[#A0A7B5] flex items-center gap-2"><span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${active ? 'bg-[#2B85EB]' : 'bg-white/30'}`} />{item}</li>)}
                </ul>
              </motion.div>
            );
          })}
        </div>

        {connect && (
          <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mt-6 rounded-2xl border border-white/5 bg-white/[0.02] px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
              {connect.iconAsset ? <img src={connect.iconAsset} alt="" aria-hidden="true" className="w-6 h-6 object-contain" /> : <Network className="w-5 h-5 text-[#A0A7B5]" />}
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1"><span className="text-sm font-semibold text-[#F5F7FA]">{connect.name}</span><span className="text-[9px] font-bold px-2 py-1 rounded-md bg-white/5 text-[#A0A7B5] uppercase tracking-widest border border-white/10">{t('ecosystem_status_infrastructure')}</span></div>
              <p className="text-sm text-[#A0A7B5]">{t('ecosystem_connect_desc', connect.description)}</p>
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
}
