/**
 * Official MillionsNest Ecosystem Event Registry
 * Every standardized event across the entire OS must be registered here.
 */

export const RegisteredEvents = {
  // Identity & Organizations
  USER_LOGIN: 'user.login',
  USER_SIGNUP: 'user.signup',
  ORG_CREATED: 'org.created',
  ORG_MEMBER_JOINED: 'org.member_joined',
  ORG_MEMBER_LEFT: 'org.member_left',

  // MusicScale & Scales (Ministry Operations)
  SCALE_CREATED: 'scale.created',
  SCALE_PUBLISHED: 'scale.published',
  SCALE_CONFIRMED: 'scale.confirmed',
  SCALE_DECLINED: 'scale.declined',
  REHEARSAL_SCHEDULED: 'rehearsal.scheduled',
  REHEARSAL_CONFIRMED: 'rehearsal.confirmed',
  WORSHIP_STARTED: 'worship.started',
  WORSHIP_ENDED: 'worship.ended',
  VOLUNTEER_ASSIGNED: 'volunteer.assigned',

  // Cells & Small Groups (CellSync)
  CELL_MEETING_SCHEDULED: 'cell.meeting_scheduled',
  CELL_MEETING_COMPLETED: 'cell.meeting_completed',
  MEMBER_CHECKIN: 'member.checkin',

  // Assets & Resources
  SONG_CREATED: 'song.created',
  SONG_OPENED: 'song.opened',
  RESOURCE_UPLOADED: 'resource.uploaded',

  // AI Operations
  AI_IMPORT_STARTED: 'ai.import_started',
  AI_IMPORT_SUCCESS: 'ai.import_success',
  AI_IMPORT_FAILED: 'ai.import_failed',
  AI_SUGGESTION_APPLIED: 'ai.suggestion_applied',

  // Billing
  BILLING_CHECKOUT_STARTED: 'billing.checkout_started',
  BILLING_UPGRADED: 'billing.upgraded',
  BILLING_DOWNGRADED: 'billing.downgraded'
} as const;

export type OSActionType = typeof RegisteredEvents[keyof typeof RegisteredEvents];

/**
 * Event Metadata Schemas 
 * Ensures type safety across cross-app telemetry
 */
export interface BaseEventPayload {
  organizationId: string;
  userId: string;
  appSource: 'core' | 'musicscale' | 'cultoflow' | 'cells' | string;
  sessionId?: string;
  targetEntityId?: string;
  timestamp?: number;
}
