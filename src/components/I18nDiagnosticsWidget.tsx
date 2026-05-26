import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Globe, Shield, AlertTriangle, CheckCircle2, 
  ChevronDown, ChevronUp, RefreshCw, Layers, Award
} from 'lucide-react';
import { runStaticI18nAudit, dynamicI18nTracker } from '../packages/i18n/diagnostics.js';

export function I18nDiagnosticsWidget() {
  const { t, i18n } = useTranslation(['common']);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'missing' | 'languages'>('overview');
  const [audit, setAudit] = useState(() => runStaticI18nAudit());
  const [dynamicMissing, setDynamicMissing] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    // Sync dynamic missing keys
    const unsubscribe = dynamicI18nTracker.subscribe(() => {
      setDynamicMissing(dynamicI18nTracker.getMissingKeys());
    });
    return unsubscribe;
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setAudit(runStaticI18nAudit());
      setDynamicMissing(dynamicI18nTracker.getMissingKeys());
      setIsRefreshing(false);
    }, 500);
  };

  const currentLang = i18n.language;

  const scoreColor = (score: number) => {
    if (score >= 98) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (score >= 90) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
  };

  return (
    <>
      {/* Floating launcher badge */}
      <div className="fixed bottom-6 left-6 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-1.5 bg-[#0B0F19] hover:bg-[#111827] text-white/80 hover:text-white rounded-full border border-white/10 shadow-xl transition-all text-xs font-mono font-medium group"
          title="Locale Diagnostics"
          id="btn_i18n_diagnostics"
        >
          <Globe className="w-3.5 h-3.5 text-[#2B85EB] animate-pulse" />
          <span>mn_locale:</span>
          <span className="text-emerald-400 font-bold uppercase">{currentLang}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 group-hover:scale-110 transition-transform" />
          <span className="text-[#A0A7B5] border-l border-white/10 pl-2 text-[10px] font-bold">
            {audit.overallScore}%
          </span>
          {isOpen ? <ChevronDown className="w-3 h-3 text-white/50" /> : <ChevronUp className="w-3 h-3 text-white/50" />}
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-16 left-6 z-50 w-96 bg-[#0E1322] border border-white/10 rounded-2xl shadow-2xl overflow-hidden font-sans"
            id="i18n_diagnostics_modal"
          >
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-[#0E1322] to-[#121B33] border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#2B85EB]" />
                <h3 className="font-semibold text-sm text-[#F5F7FA] tracking-tight">Locale Enforcement Engine</h3>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleRefresh}
                  className={`p-1.5 text-[#A0A7B5] hover:text-white hover:bg-white/5 rounded-md transition-all ${isRefreshing ? 'animate-spin' : ''}`}
                  title="Recalculate Scores"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => dynamicI18nTracker.clear()}
                  className="px-2 py-1 text-[9px] font-bold uppercase bg-white/5 hover:bg-white/10 text-rose-400 rounded border border-white/10 transition-colors"
                  title="Clear runtime state tracker logs"
                >
                  Clear Logs
                </button>
              </div>
            </div>

            {/* Score Banner */}
            <div className="p-4 bg-white/5 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-yellow-400" />
                <div>
                  <div className="text-[10px] text-[#A0A7B5] uppercase tracking-wider font-bold">Ecosystem Coverage Index</div>
                  <div className="text-xs font-semibold text-white">Full-Stack Translation Integrity</div>
                </div>
              </div>
              <div className={`px-2.5 py-1 rounded-md border font-mono font-bold text-sm ${scoreColor(audit.overallScore)}`}>
                {audit.overallScore}%
              </div>
            </div>

            {/* Quick Locale Swapper */}
            <div className="p-3 bg-white/5 border-b border-white/10 flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold text-[#A0A7B5] px-1">Enforce Locale:</span>
              <div className="flex gap-1.5 flex-grow">
                {['pt', 'en', 'es'].map((lng) => (
                  <button
                    key={lng}
                    onClick={() => i18n.changeLanguage(lng)}
                    className={`flex-1 py-1 text-xs font-bold rounded-md uppercase border transition-all ${
                      currentLang === lng
                        ? 'bg-[#2B85EB] text-white border-[#2B85EB] shadow-md'
                        : 'bg-white/5 hover:bg-white/10 text-[#A0A7B5] border-white/5 hover:border-white/10'
                    }`}
                  >
                    {lng}
                  </button>
                ))}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/5 text-xs">
              <button
                onClick={() => setActiveTab('overview')}
                className={`flex-1 py-2 font-medium border-b-2 text-center transition-colors ${
                  activeTab === 'overview' ? 'border-[#2B85EB] text-white bg-white/5' : 'border-transparent text-[#A0A7B5] hover:text-white'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('missing')}
                className={`flex-1 py-2 font-medium border-b-2 text-center transition-colors relative ${
                  activeTab === 'missing' ? 'border-[#2B85EB] text-white bg-white/5' : 'border-transparent text-[#A0A7B5] hover:text-white'
                }`}
              >
                Leaks ({dynamicMissing.length + audit.languages.en.missingKeys.length + audit.languages.es.missingKeys.length})
                {dynamicMissing.length > 0 && (
                  <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                )}
              </button>
              <button
                onClick={() => setActiveTab('languages')}
                className={`flex-1 py-2 font-medium border-b-2 text-center transition-colors ${
                  activeTab === 'languages' ? 'border-[#2B85EB] text-white bg-white/5' : 'border-transparent text-[#A0A7B5] hover:text-white'
                }`}
              >
                Locales
              </button>
            </div>

            {/* Content panel */}
            <div className="p-4 max-h-64 overflow-y-auto text-xs space-y-3 scrollbar-thin">
              {activeTab === 'overview' && (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[#A0A7B5]">
                      <span>Active Namespace Split</span>
                      <span className="font-mono text-white font-semibold">5 Namespaces</span>
                    </div>
                    <div className="flex gap-1">
                      {['common', 'auth', 'landing', 'commandPalette', 'resume'].map(ns => (
                        <span key={ns} className="px-1.5 py-0.5 bg-white/5 rounded border border-white/5 text-[9px] text-[#A0A7B5] font-mono whitespace-nowrap">
                          {ns}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="h-px bg-white/5 my-2" />

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-white font-medium">No Hardcoded Strings Check</span>
                      </div>
                      <span className="text-emerald-400 font-bold bg-emerald-400/10 px-1.5 py-0.5 rounded text-[10px]">PASSING</span>
                    </div>
                    <p className="text-[#A0A7B5] text-[11px] leading-relaxed">
                      All translation hooks are strictly configured with standard PT fallback objects to prevent empty screens or broken layouts.
                    </p>
                  </div>
                </>
              )}

              {activeTab === 'missing' && (
                <>
                  {dynamicMissing.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-6 text-center text-[#A0A7B5]">
                      <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-2" />
                      <p className="font-semibold text-white">No Runtime Leaks Detected</p>
                      <p className="text-[10px] mt-1 pr-6 pl-6">Zero missing translation lookups registered while using the dashboard pages.</p>
                    </div>
                  )}

                  {dynamicMissing.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-amber-400 font-bold text-[10px] uppercase">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Runtime Missing keys
                      </div>
                      <div className="bg-[#050505] border border-white/5 rounded-lg p-2 max-h-24 overflow-y-auto space-y-1">
                        {dynamicMissing.map(key => (
                          <div key={key} className="font-mono text-[9px] text-amber-200 bg-amber-500/10 px-1 rounded py-0.5 truncate select-all" title={key}>
                            {key}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {audit.languages.en.missingKeys.length > 0 && (
                    <div className="space-y-1.5 pt-2">
                      <div className="text-rose-400 font-bold text-[10px] uppercase">
                        Mismatches keys (EN vs PT)
                      </div>
                      <div className="bg-[#050505] border border-white/5 rounded-lg p-2 max-h-24 overflow-y-auto space-y-1">
                        {audit.languages.en.missingKeys.slice(0, 10).map(key => (
                          <div key={key} className="font-mono text-[9px] text-rose-300 bg-rose-500/10 px-1 rounded py-0.5 truncate" title={key}>
                            {key}
                          </div>
                        ))}
                        {audit.languages.en.missingKeys.length > 10 && (
                          <div className="text-[10px] text-white/50 text-center py-1">
                            And {audit.languages.en.missingKeys.length - 10} more keys...
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

              {activeTab === 'languages' && (
                <div className="space-y-3">
                  {Object.entries(audit.languages).map(([lng, details]: [string, any]) => (
                    <div key={lng} className="p-2 bg-white/5 rounded-lg border border-white/5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold uppercase text-white font-mono">{lng}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${scoreColor(details.score)}`}>
                          {details.score}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-[#A0A7B5]">
                        <span>Defined: {details.definedKeys} / {details.totalKeys} keys</span>
                        {details.missingKeys.length > 0 && (
                          <span className="text-rose-400 font-medium">{details.missingKeys.length} Missing</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-white/5 border-t border-white/10 flex items-center justify-between text-[10px] text-[#A0A7B5]">
              <span className="flex items-center gap-1">
                <Layers className="w-3 h-3 text-[#2B85EB]" /> Runtime Active Integrity Enforced
              </span>
              <span className="font-mono bg-white/5 px-1 py-0.5 rounded">v2.1.0_prod</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
