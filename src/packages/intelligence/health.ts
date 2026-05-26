import { BaseEventPayload, RegisteredEvents } from './registry';

export interface HealthMetrics {
  healthScore: number;
  engagementScore: number;
  frictionScore: number;
  participationRate: number;
  overloadWarnings: string[];
}

/**
 * Advanced Cross-App Health Engine
 * Calculates living metrics for the whole ministry based on event telemetry.
 */
export class EcosystemHealthEngine {
  
  /**
   * Evaluates if a user is overloaded cross-apps
   */
  public detectVolunteerOverload(userId: string, recentEvents: any[]): boolean {
    const assignments = recentEvents.filter(e => e.action === RegisteredEvents.VOLUNTEER_ASSIGNED);
    const declines = recentEvents.filter(e => e.action === RegisteredEvents.SCALE_DECLINED);
    
    const isOverloaded = assignments.length > 5 || (declines.length / (assignments.length || 1)) > 0.3;
    if (isOverloaded) {
       // Typically fires an alert to the telemetry bus
       console.warn(`[Health Engine] Overload detected for user ${userId}`);
    }
    return isOverloaded;
  }

  /**
   * Calculates the macro organizational health score based on ecosystem signals
   */
  public computeOrganizationalHealth(orgId: string, eventsLast30Days: any[]): HealthMetrics {
    let engagementPoints = 0;
    let frictionPoints = 0;
    
    eventsLast30Days.forEach(evt => {
      switch(evt.action) {
        case RegisteredEvents.SCALE_CONFIRMED:
        case RegisteredEvents.USER_LOGIN:
        case RegisteredEvents.CELL_MEETING_COMPLETED:
          engagementPoints++;
          break;
        case RegisteredEvents.SCALE_DECLINED:
        case RegisteredEvents.AI_IMPORT_FAILED:
          frictionPoints += 2;
          break;
      }
    });

    const totalEvents = eventsLast30Days.length || 1;
    const baseScore = 70;
    // Calculate normalized health based on weight logic
    let healthScore = baseScore + (engagementPoints * 0.5) - (frictionPoints * 1.5);
    
    return {
      healthScore: Math.min(100, Math.max(0, healthScore)),
      engagementScore: Math.min(100, engagementPoints),
      frictionScore: Math.min(100, frictionPoints),
      participationRate: engagementPoints / totalEvents,
      overloadWarnings: [] // populated by specific overload detectors
    };
  }
}

export const healthEngine = new EcosystemHealthEngine();
