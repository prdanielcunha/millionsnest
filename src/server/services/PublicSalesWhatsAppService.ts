import { Request, Response } from 'express';
import { getSupportConfig } from '../config/supportConfig.js';
import { 
  PublicSalesWhatsAppRequest, 
  PublicSalesContactIntent,
  PublicSalesWhatsAppSuccessResponse,
  PublicSalesWhatsAppFailureResponse
} from '../../lib/supportContracts.js';

const VALID_INTENTS: PublicSalesContactIntent[] = [
  'pricing',
  'pre_sales_question',
  'partnership',
  'general'
];

const VALID_LOCALES = ['pt', 'en', 'es'];

const MESSAGES = {
  pt: {
    pricing: 'Olá! Gostaria de saber mais sobre os planos do MillionsNest.',
    pre_sales_question: 'Olá! Tenho uma dúvida antes de contratar o MillionsNest.',
    partnership: 'Olá! Gostaria de conversar sobre uma parceria com o MillionsNest.',
    general: 'Olá! Gostaria de falar com a equipe comercial do MillionsNest.'
  },
  en: {
    pricing: 'Hello! I would like to know more about MillionsNest plans.',
    pre_sales_question: 'Hello! I have a question before subscribing to MillionsNest.',
    partnership: 'Hello! I would like to discuss a partnership with MillionsNest.',
    general: 'Hello! I would like to speak with the MillionsNest sales team.'
  },
  es: {
    pricing: '¡Hola! Me gustaría saber más sobre los planes de MillionsNest.',
    pre_sales_question: '¡Hola! Tengo una duda antes de suscribirme a MillionsNest.',
    partnership: '¡Hola! Me gustaría hablar sobre una asociación con MillionsNest.',
    general: '¡Hola! Me gustaría hablar con el equipo comercial de MillionsNest.'
  }
};

export const createPublicSalesWhatsAppLink = async (req: Request, res: Response) => {
  try {
    const config = getSupportConfig();
    
    if (!config.isSalesWhatsAppConfigured || !config.salesWhatsappNumber) {
      const response: PublicSalesWhatsAppFailureResponse = {
        success: false,
        reasonCode: 'SALES_WHATSAPP_NOT_CONFIGURED'
      };
      res.status(503).json(response);
      return;
    }

    const payload = req.body as Partial<PublicSalesWhatsAppRequest>;

    if (!payload.intent || !VALID_INTENTS.includes(payload.intent as PublicSalesContactIntent)) {
      const response: PublicSalesWhatsAppFailureResponse = {
        success: false,
        reasonCode: 'INVALID_INTENT'
      };
      res.status(400).json(response);
      return;
    }

    if (!payload.locale || !VALID_LOCALES.includes(payload.locale)) {
      const response: PublicSalesWhatsAppFailureResponse = {
        success: false,
        reasonCode: 'INVALID_LOCALE'
      };
      res.status(400).json(response);
      return;
    }

    let finalMessage = '';
    const localeMap = MESSAGES[payload.locale as keyof typeof MESSAGES];
    const prefix = localeMap[payload.intent as PublicSalesContactIntent];
    
    finalMessage += prefix;

    if (payload.pagePath) {
      if (typeof payload.pagePath !== 'string' || !payload.pagePath.startsWith('/') || payload.pagePath.startsWith('//') || payload.pagePath.length > 500 || payload.pagePath.includes('http')) {
        const response: PublicSalesWhatsAppFailureResponse = {
          success: false,
          reasonCode: 'INVALID_PAGE_PATH'
        };
        res.status(400).json(response);
        return;
      }
      finalMessage += `\n\nOrigem: ${payload.pagePath.split('#')[0]}`;
    }

    if (payload.message) {
      const userMessage = payload.message.trim().replace(/[\x00-\x1F\x7F]/g, '');
      if (userMessage.length === 0 || userMessage.length > 1000 || /javascript:/i.test(userMessage)) {
        const response: PublicSalesWhatsAppFailureResponse = {
          success: false,
          reasonCode: 'INVALID_MESSAGE'
        };
        res.status(400).json(response);
        return;
      }
      finalMessage += `\n\n${userMessage}`;
    }

    const url = `https://wa.me/${config.salesWhatsappNumber}?text=${encodeURIComponent(finalMessage)}`;

    res.set('Cache-Control', 'no-store');
    const response: PublicSalesWhatsAppSuccessResponse = {
      success: true,
      url
    };
    
    res.status(200).json(response);
  } catch (error) {
    const response: PublicSalesWhatsAppFailureResponse = {
      success: false,
      reasonCode: 'INTERNAL_ERROR'
    };
    res.status(500).json(response);
  }
};
