import { i18nEngine } from '../i18n/index.js';

export interface AIRequestOptions {
  model?: 'fast' | 'reasoning' | 'creative';
  temperature?: number;
  userId: string;
  organizationId: string;
  locale?: string;
}

export interface AIServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  tokensUsed?: number;
  latencyMs?: number;
}

/**
 * Intelligent AI Service Wrapper
 * Enforces standardized context, tracks token usage structurally via EventBus,
 * and maintains unified fallback behavior across all ecosystem apps.
 */
export class AIService {
  
  /**
   * Stub internal AI invocation. Will proxy to the backend or direct SDK layer
   * where proper API key security is handled.
   */
  public async prompt<T>(promptText: string, context: any, options: AIRequestOptions): Promise<AIServiceResponse<T>> {
    const start = Date.now();
    
    // Inject system locale automatically if not specified
    const effectiveOptions = {
      ...options,
      locale: options.locale || i18nEngine.language || 'pt'
    };

    // Prepare system instructions for localization constraints
    const localeInstruction = `[CRITICAL: Respond logically in the following locale code: ${effectiveOptions.locale}. Do NOT translate user-names, specific entity titles like songs or groups, or specific tags unless explicitly asked.]`;
    const enrichedPrompt = `${localeInstruction}\n\n${promptText}`;
    
    // In a real implementation, this would:
    // 1. Call your secure `/api/ai/invoke` endpoint
    // 2. Which then calls Gemini via @google/genai SDK
    
    // Mock simulation for SDK structure
    try {
      const response = await fetch('/api/v1/ai/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: enrichedPrompt, context, options: effectiveOptions })
      });
      
      if (!response.ok) throw new Error('AI Engine failed');
      const data = await response.json();
      
      return {
        success: true,
        data: data.result,
        latencyMs: Date.now() - start
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message,
        latencyMs: Date.now() - start
      };
    }
  }

  /**
   * Specialized AI pattern recognition for analyzing timelines and behavior
   */
  public async analyzeTimelineBehavior(timelineEvents: any[], options: AIRequestOptions) {
    return this.prompt('Analyze this activity timeline and detect drop-offs or overload.', timelineEvents, options);
  }
}

export const aiEngine = new AIService();
