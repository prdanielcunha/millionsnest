import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MillionsNestLogo } from './MillionsNestLogo.js';
import { getAvailableApps } from '../lib/apps.js';

export function Footer() {
  const { t } = useTranslation(['landing', 'common']);
  const apps = getAvailableApps([]);

  return (
    <footer className="bg-[#050505] border-t border-white/5 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-12 mb-16">
          <div className="sm:col-span-2 md:col-span-1 lg:col-span-2">
            <Link to="/" className="flex items-center gap-3 mb-6">
              <MillionsNestLogo loading="lazy" decoding="async" className="h-8 md:h-10 w-auto opacity-90 hover:opacity-100 transition-opacity" />
              <span className="font-semibold text-lg tracking-tight text-[#F5F7FA]">MillionsNest</span>
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
              <li><a href="https://api.whatsapp.com/send?phone=5543999907071" target="_blank" rel="noopener noreferrer" className="text-sm font-normal text-[#A0A7B5] hover:text-white transition-colors">{t('footer_contact')}</a></li>
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
