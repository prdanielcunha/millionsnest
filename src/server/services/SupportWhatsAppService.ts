import { Request, Response } from 'express';
import { resolveAuthenticatedSupportContext } from './SupportCapabilitiesService.js';
import { getSupportConfig } from '../config/supportConfig.js';
import { SupportWhatsAppLinkRequest, SupportLocale } from '../../lib/supportContracts.js';

function getAppName(appId?: string): string {
  switch (appId) {
    case 'musicscale': return 'MusicScale';
    case 'nestfinance': return 'NestFinance';
    case 'core':
    default:
      return 'MillionsNest';
  }
}

function getPageDescription(pagePath?: string): string {
  if (!pagePath) return 'Página não especificada';
  
  // Basic descriptions based on routes
  if (pagePath.includes('/musicscale/songs')) return 'Músicas';
  if (pagePath.includes('/musicscale/scales')) return 'Escalas';
  if (pagePath.includes('/musicscale/members')) return 'Integrantes';
  if (pagePath.includes('/musicscale/resources')) return 'Recursos';
  if (pagePath.includes('/settings/team')) return 'Equipe';
  if (pagePath.includes('/settings/billing')) return 'Assinatura e Faturamento';
  
  // Clean up hash or query if present (though pagePath should be clean)
  let cleanPath = pagePath.split('#')[0].split('?')[0];
  if (cleanPath.startsWith('//') || cleanPath.startsWith('http') || cleanPath.startsWith('javascript:')) {
    return 'Caminho inválido';
  }

  return cleanPath;
}

export async function createSupportWhatsAppLink(req: Request, res: Response) {
  try {
    const payload = req.body as Partial<SupportWhatsAppLinkRequest>;

    if (!payload.organizationId || typeof payload.organizationId !== 'string') {
      return res.status(400).json({ success: false, reasonCode: 'INVALID_ORGANIZATION_ID' });
    }

    const { message, locale, appId, pagePath, organizationId } = payload;

    if (!message || typeof message !== 'string' || message.trim().length < 10) {
      return res.status(400).json({ success: false, reasonCode: 'MESSAGE_TOO_SHORT' });
    }

    if (message.length > 1500) {
      return res.status(400).json({ success: false, reasonCode: 'MESSAGE_TOO_LONG' });
    }

    const supportedLocales = ['pt', 'en', 'es'];
    if (!locale || !supportedLocales.includes(locale)) {
      return res.status(400).json({ success: false, reasonCode: 'INVALID_LOCALE' });
    }

    if (appId && typeof appId !== 'string') {
      return res.status(400).json({ success: false, reasonCode: 'INVALID_APP_ID' });
    }
    if (appId && appId.length > 64) {
      return res.status(400).json({ success: false, reasonCode: 'INVALID_APP_ID' });
    }

    if (pagePath && typeof pagePath !== 'string') {
       return res.status(400).json({ success: false, reasonCode: 'INVALID_PAGE_PATH' });
    }
    let cleanPagePath = pagePath;
    if (pagePath) {
      if (pagePath.length > 500) return res.status(400).json({ success: false, reasonCode: 'INVALID_PAGE_PATH' });
      cleanPagePath = pagePath.split('#')[0];
      if (cleanPagePath.startsWith('//') || cleanPagePath.startsWith('http') || cleanPagePath.startsWith('javascript:')) {
         return res.status(400).json({ success: false, reasonCode: 'INVALID_PAGE_PATH' });
      }
    }

    const context = await resolveAuthenticatedSupportContext({
      authorizationHeader: req.headers.authorization,
      organizationId
    });

    if (context.error) {
      return res.status(context.error.status).json({ success: false, reasonCode: context.error.reasonCode });
    }

    if (!context.resolvedAccess?.hasPrioritySupport) {
      return res.status(403).json({ success: false, reasonCode: 'WHATSAPP_NOT_INCLUDED' });
    }

    const config = getSupportConfig();
    if (!config.isWhatsAppConfigured || !config.whatsappNumber) {
      return res.status(503).json({ success: false, reasonCode: 'WHATSAPP_NOT_CONFIGURED' });
    }

    const userName = context.displayName;
    const orgName = context.orgData?.name || 'Organização desconhecida';
    const appName = getAppName(appId);
    const pageDesc = getPageDescription(cleanPagePath);
    
    // Clean message control chars but preserve newlines
    const cleanMessage = message.trim().replace(/[\x00-\x09\x0B-\x1F\x7F]/g, '');

    let textTemplate = '';
    
    if (locale === 'en') {
      textTemplate = `Hello! My name is ${userName}.

I need help with ${appName}.

Organization: ${orgName}
Page: ${pageDesc}

My question:
${cleanMessage}`;
    } else if (locale === 'es') {
      textTemplate = `¡Hola! Mi nombre es ${userName}.

Necesito ayuda con ${appName}.

Organización: ${orgName}
Página: ${pageDesc}

Mi consulta:
${cleanMessage}`;
    } else {
      textTemplate = `Olá! Meu nome é ${userName}.

Preciso de ajuda com ${appName}.

Organização: ${orgName}
Página: ${pageDesc}

Minha dúvida:
${cleanMessage}`;
    }

    const encodedText = encodeURIComponent(textTemplate);
    const url = `https://wa.me/${config.whatsappNumber}?text=${encodedText}`;

    return res.status(200).json({
      success: true,
      url
    });

  } catch (error: any) {
    console.error('[SupportWhatsAppService] CRITICAL ERROR:', error.message);
    return res.status(500).json({ success: false, reasonCode: 'INTERNAL_ERROR' });
  }
}
