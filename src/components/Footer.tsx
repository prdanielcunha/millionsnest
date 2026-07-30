import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { NestFinanceLogo } from './brand/NestFinanceLogo.js';
import { getAvailableApps } from '../lib/apps.js';
import { createPublicSalesWhatsAppLink, resolvePublicContactLocale } from '../services/publicContactClient.js';
import { Loader2 } from 'lucide-react';

export function Footer() {
  const { t, i18n } = useTranslation(['landing', 'common']);
  const apps = getAvailableApps([]);
  const [isContacting, setIsContacting] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const location = useLocation();

  const handleContact = async () => {
    if (isContacting) return;
    
    setContactError(null);
    
    // Open a blank window synchronously to avoid popup blockers
    const popup = window.open('about:blank', '_blank');
    if (!popup) {
      setContactError(t('public_contact_error'));
      return;
    }

    try {
      popup.opener = null;
    } catch (e) {
      // Ignored
    }

    try {
      setIsContacting(true);
      const url = await createPublicSalesWhatsAppLink({
        intent: 'general',
        locale: resolvePublicContactLocale(i18n.resolvedLanguage ?? i18n.language),
        pagePath: location.pathname
      });
      if (url.startsWith('https://wa.me/')) {
        popup.location.href = url;
      } else {
        throw new Error('Invalid URL');
      }
    } catch (error) {
      popup.close();
      setContactError(t('public_contact_error'));
    } finally {
      setIsContacting(false);
    }
  };

  return (
    <footer className="bg-[#050505] border-t border-white/5 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-12 mb-16">
          <div className="sm:col-span-2 md:col-span-1 lg:col-span-2">
            <Link to="/" className="flex mb-6">
              <NestFinanceLogo layout="horizontal" tagline={true} surface="dark" loading="lazy" decoding="async" className="h-10 md:h-[52px] w-[190px] md:w-[230px] opacity-90 hover:opacity-100 transition-opacity" />
            </Link>
            <p className="text-sm font-normal text-[#A0A7B5] max-w-sm leading-relaxed">
              {t('footer_tag')}
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold text-sm text-[#F5F7FA] mb-6 tracking-wide">{t('footer_solutions')}</h4>
            <ul className="space-y-4">
              {apps.map(app => (
                <li key={`footer-${app.id}`} className="min-w-0">
                  {app.status === 'active' && app.landingRoute ? (
                    <Link to={app.landingRoute} className="text-sm font-normal text-[#A0A7B5] hover:text-white transition-colors">
                      {app.name}
                    </Link>
                  ) : (
                    <span className="flex items-center gap-2 text-sm font-normal text-[#A0A7B5] w-full min-w-0">
                      <span className="truncate" title={app.name}>{app.name}</span>
                      {app.status !== 'active' && (
                         <span className="text-[9px] bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-[#A0A7B5] uppercase tracking-widest font-medium shrink-0 leading-none select-none">
                           {t('footer_soon')}
                         </span>
                      )}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-sm text-[#F5F7FA] mb-6 tracking-wide">{t('footer_legal')}</h4>
            <ul className="space-y-4">
              <li><Link to="/termos-de-uso" className="text-sm font-normal text-[#A0A7B5] hover:text-white transition-colors">{t('footer_terms')}</Link></li>
              <li><Link to="/politica-de-privacidade" className="text-sm font-normal text-[#A0A7B5] hover:text-white transition-colors">{t('footer_privacy')}</Link></li>
              <li><Link to="/politicas-de-cancelamento" className="text-sm font-normal text-[#A0A7B5] hover:text-white transition-colors">{t('footer_cancel')}</Link></li>
              <li><Link to="/politicas-de-reembolso" className="text-sm font-normal text-[#A0A7B5] hover:text-white transition-colors">{t('footer_refund')}</Link></li>
              <li>
                <div className="flex flex-col items-start gap-1">
                  <button 
                    type="button"
                    onClick={handleContact}
                    disabled={isContacting}
                    aria-label={t('footer_contact_aria')}
                    className="text-sm font-normal text-[#A0A7B5] hover:text-white transition-colors flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-white/20 rounded disabled:opacity-50"
                  >
                    {isContacting ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        {t('public_contact_loading')}
                      </>
                    ) : (
                      t('footer_contact')
                    )}
                  </button>
                  {contactError && (
                    <div role="status" aria-live="polite" className="text-xs text-red-400 mt-1">
                      {contactError}
                    </div>
                  )}
                </div>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs font-normal text-[#A0A7B5]">
            © {new Date().getFullYear()} {t('footer_rights')}
          </p>
        </div>
      </div>
    </footer>
  );
}
