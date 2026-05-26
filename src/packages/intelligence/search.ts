/**
 * Context-Aware Universal Search Foundation
 * Powers the intelligent Command Palette across all MillionsNest OS apps.
 */

export interface SearchContext {
  orgId: string;
  activeApp: 'core' | 'musicscale' | 'cultoflow' | 'cells' | string;
  permissions?: string[];
  enabledApps?: string[]; // Arrays of apps the org has purchased/enabled
}

export interface SearchResult {
  id: string;
  type: 'person' | 'scale' | 'song' | 'cell' | 'ministry' | 'action';
  title: string;
  subtitle?: string;
  appSource: string; // The app this entity belongs to
  routingDetails: string; // Internal URI or action identifier
  relevanceScore: number;
}

export class UniversalSearchEngine {
  private localIndex: Map<string, any> = new Map();

  /**
   * Syncs local indexing structure (usually fetched from offline DB or Firebase)
   */
  public async hydrateIndex(orgId: string) {
    console.log(`[Universal Search] Hydrating search index for Organization: ${orgId}`);
    // implementation connects to offline engine cache
  }

  /**
   * Generates scoped default actions when search query is empty based on context.
   */
  public async getDefaultActions(context: SearchContext): Promise<SearchResult[]> {
    const actions: SearchResult[] = [];
    const { activeApp, enabledApps = [] } = context;

    // Base actions
    actions.push({
      id: 'action_invite', type: 'person', title: 'Convidar Voluntário', subtitle: 'Core', appSource: 'core', routingDetails: '/team/invite', relevanceScore: 1
    });

    if (activeApp === 'musicscale' && enabledApps.includes('musicscale')) {
      actions.unshift(
        { id: 'action_song', type: 'song', title: 'Adicionar Música ao Repertório', subtitle: 'MusicScale', appSource: 'musicscale', routingDetails: '/songs/new', relevanceScore: 2 },
        { id: 'action_scale', type: 'scale', title: 'Criar Nova Escala', subtitle: 'MusicScale', appSource: 'musicscale', routingDetails: '/scales/new', relevanceScore: 2 }
      );
    } else if (activeApp === 'cells' && enabledApps.includes('cells')) {
       actions.unshift(
        { id: 'action_cell_meeting', type: 'cell', title: 'Registrar Encontro', subtitle: 'CellSync', appSource: 'cells', routingDetails: '/cells/meeting/new', relevanceScore: 2 },
        { id: 'action_cell_create', type: 'cell', title: 'Nova Célula', subtitle: 'CellSync', appSource: 'cells', routingDetails: '/cells/new', relevanceScore: 2 }
      );
    } else if (activeApp === 'cultoflow' && enabledApps.includes('cultoflow')) {
       actions.unshift(
        { id: 'action_cultoflow_plan', type: 'scale', title: 'Planejar Culto', subtitle: 'CultoFlow', appSource: 'cultoflow', routingDetails: '/cultos/new', relevanceScore: 2 },
        { id: 'action_cultoflow_role', type: 'person', title: 'Escalar Voluntário', subtitle: 'CultoFlow', appSource: 'cultoflow', routingDetails: '/cultos/roster', relevanceScore: 2 }
      );
    }

    return actions.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Global fuzzy search across all registered ecosystem apps, weighted by context.
   */
  public async query(term: string, context: SearchContext): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    if (!term || term.trim() === '') return this.getDefaultActions(context);

    const searchTerm = term.toLowerCase();

    // Mock Execution with contextual awareness
    if ('equipe de louvor'.includes(searchTerm) && context.enabledApps?.includes('musicscale')) {
      results.push({
        id: 'team_01', type: 'ministry', title: 'Equipe de Louvor', 
        appSource: 'musicscale', routingDetails: '/teams/louvor', 
        relevanceScore: context.activeApp === 'musicscale' ? 1.5 : 1.0 // Scoped boost
      });
    }

    if ('culto de domingo'.includes(searchTerm)) {
      results.push({
        id: 'evt_01', type: 'scale', title: 'Culto de Domingo - Manhã', 
        subtitle: '10/05/2026', appSource: 'cultoflow', routingDetails: '/scales/evt_01', 
        relevanceScore: context.activeApp === 'cultoflow' ? 1.5 : 0.9
      });
    }

    if ('abrir performance mode'.includes(searchTerm) && context.activeApp === 'musicscale') {
      results.push({
         id: 'action_perf_mode', type: 'action', title: 'Abrir Performance Mode',
         subtitle: 'Contextual Action', appSource: 'musicscale', routingDetails: 'ACTION:PERFORMANCE_MODE',
         relevanceScore: 2.0
      });
    }

    return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }
}

export const searchEngine = new UniversalSearchEngine();
