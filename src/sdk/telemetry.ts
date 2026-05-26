import { analytics } from "../lib/analytics.js";

/**
 * Intelligent Observability Engine
 * Analyzes behavioral metrics to produce actionable insights like Health Score,
 * Friction, and Volunter Overload.
 */

export interface HealthContext {
  userId: string;
  organizationId: string;
  recentLogins: number; // in last 30 days
  scalesDeclined: number; // in last 30 days
  fastConfirmations: number;
  unhandledErrors: number;
}

export class MNTelemetry {
  /**
   * Calculates an overall Engagement Score (0-100)
   */
  public static calculateEngagementScore(ctx: HealthContext): number {
    let score = 50; // Base score
    
    // Positive factors
    score += Math.min(ctx.recentLogins * 2, 30);
    score += Math.min(ctx.fastConfirmations * 5, 20);
    
    // Negative factors
    score -= Math.min(ctx.scalesDeclined * 10, 40);
    score -= Math.min(ctx.unhandledErrors * 2, 20);

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Identifies potential volunteer burnout/overload
   */
  public static detectOverload(scalesAssignedLast30Days: number, declineRate: number): boolean {
    // If assigned to more than 6 scales in a month, or declining > 30% recently
    return scalesAssignedLast30Days > 6 || declineRate > 0.3;
  }

  /**
   * Wrapper for UX Friction tracking
   */
  public static trackFriction(
    userId: string, 
    organizationId: string, 
    location: string, 
    timeSpentSeconds: number, 
    aborted: boolean
  ) {
    analytics.track('performance_metric', {
      userId,
      organizationId,
      metadata: {
        type: 'ux_friction',
        location,
        timeSpentSeconds,
        aborted
      }
    });
  }
}
