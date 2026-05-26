import { BaseEventPayload, RegisteredEvents } from './registry.js';
import { aiEngine } from '../ai/index.js';

export interface AIInsight {
  id: string;
  type: 'automation' | 'prediction' | 'suggestion';
  title: string;
  description: string;
  actionableContext?: any;
  confidence: number;
}

/**
 * AI Operational Layer
 * Operates cross-app, finding intelligence patterns and suggesting optimizations
 * across the church's ecosystem.
 */
export class AIOperationsLayer {
  
  /**
   * Generates proactive ministry insights based on timeline and graph
   */
  public async generateEcosystemInsights(orgId: string, recentEvents: BaseEventPayload[]): Promise<AIInsight[]> {
    console.log(`[AI Ops] Generating insights for Org: ${orgId}`);
    
    // Fallback static rules before heavy lifting
    const frictionEvents = recentEvents.filter(e => {
      const evt = e as any;
      return evt.action === RegisteredEvents.SCALE_DECLINED || evt.action === RegisteredEvents.AI_IMPORT_FAILED;
    });
    
    const insights: AIInsight[] = [];

    // Structural Rule Engine 
    if (frictionEvents.length > 5) {
      insights.push({
        id: crypto.randomUUID(),
        type: 'suggestion',
        title: 'Alta Taxa de Atrito Recente',
        description: 'Vários voluntários têm recusado escalas ou o sistema falhou ao importar repertório. Revisar carga.',
        confidence: 0.85
      });
    }

    // Dynamic Engine (Requires real LLM Processing via package)
    try {
      // In production, context is heavily optimized before LLM shipment
      const prompt = `Analise os eventos operacionais recentes da igreja ${orgId} e sugira otimizações.`;
      const response = await aiEngine.prompt<AIInsight[]>(prompt, { eventsSize: recentEvents.length }, {
         model: 'reasoning',
         userId: 'system',
         organizationId: orgId
      });

      if (response.success && response.data) {
        insights.push(...response.data);
      }
    } catch (e) {
      // Silent degrade
    }

    return insights;
  }

  /**
   * Translates natural language into a system action request
   * e.g. "Create a scale for tomorrow night using the standard band"
   */
  public async parseIntent(naturalLanguageCmd: string, orgId: string): Promise<any> {
     // AI Intent mapping leveraging GenAI tools (Function Calling)
     return aiEngine.prompt('Map user intent to OS Functions', { command: naturalLanguageCmd }, {
        model: 'fast',
        userId: 'session',
        organizationId: orgId
     });
  }
}

export const aiOps = new AIOperationsLayer();
