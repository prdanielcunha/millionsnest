import { createHash, createHmac } from 'node:crypto';

/** This server-only source is invoked AFTER the Hub verifies church membership,
 * assigned caregiver, tenant/congregation, active care request and explicit,
 * non-revoked contact consent. It NEVER contains a person's phone or name.
 * A followup-context GET remains successful when Connect is unavailable.
 */
export type NestJourneyConnectFollowupSource = {
  organizationId: string;
  followupId: string;
  ownerUid: string;
  dueAt: string;
};
export type NestJourneyConnectPublisherOptions = NestJourneyConnectFollowupSource & {
  enabled: boolean;
  signingSecret?: string;
  operatorTargetsJson?: string;
  now?: () => number;
  fetchImpl?: typeof fetch;
};
type Outcome = 'disabled' | 'not_due' | 'not_configured' | 'accepted' | 'duplicate';
const safe = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() === value && value.length > 0 &&
  value.length <= 180 && !/[\\/\u0000-\u001f\u007f]/.test(value);

export async function publishNestJourneyFollowupDue(
  input: NestJourneyConnectPublisherOptions,
): Promise<Outcome> {
  if (!input.enabled) return 'disabled';
  if (![input.organizationId, input.followupId, input.ownerUid].every(safe))
    throw new Error('JOURNEY_CONNECT_SOURCE_INVALID');
  const now = (input.now ?? Date.now)();
  const dueTime = Date.parse(input.dueAt);
  if (!Number.isSafeInteger(now) || !Number.isFinite(dueTime) ||
      dueTime > now || dueTime < now - 7 * 86400000) return 'not_due';
  if (!input.signingSecret || input.signingSecret.length < 32 ||
      input.signingSecret.length > 4096 ||
      !input.operatorTargetsJson || input.operatorTargetsJson.length > 16000) return 'not_configured';
  let target: { conversationId: string; recipientUid: string } | undefined;
  try {
    const parsed: unknown = JSON.parse(input.operatorTargetsJson);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') return 'not_configured';
    const entries = Object.entries(parsed);
    if (entries.length > 100 || entries.some(([org, candidate]) => {
      if (!safe(org) || !candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return true;
      const c = candidate as Record<string, unknown>;
      return Object.keys(c).length !== 2 ||
        !Object.keys(c).every(k => ['conversationId','recipientUid'].includes(k)) ||
        !safe(c.conversationId) || !safe(c.recipientUid);
    })) return 'not_configured';
    target = (parsed as Record<string, typeof target>)[input.organizationId];
  } catch { return 'not_configured'; }
  if (!target) return 'not_configured';

  // Event identity is stable across Hub retries. Origin authorization proves
  // an opaque operator alert only; Connect separately checks current Hub
  // membership, recipient, assigned conversation, device and consent gates.
  const eventId = createHash('sha256').update(JSON.stringify([
    'nestjourney', input.organizationId, input.followupId,
    new Date(dueTime).toISOString(), input.ownerUid,
  ])).digest('hex');
  const raw = JSON.stringify({
    schemaVersion: 1, sourceApp: 'nestjourney', eventId,
    organizationId: input.organizationId,
    conversationId: target.conversationId,
    occurredAt: new Date(dueTime).toISOString(),
    trigger: 'followup.due', recipientUid: target.recipientUid,
  });
  const timestamp = String(now);
  const signature = createHmac('sha256', input.signingSecret)
    .update('nestjourney\n' + timestamp + '\n' + raw).digest('hex');
  let response: Response;
  try {
    response = await (input.fetchImpl ?? fetch)(
      'https://connect.millionsnest.com/api/core/automations/events/nestjourney', {
        method: 'POST', redirect: 'error', cache: 'no-store',
        signal: AbortSignal.timeout(2500),
        headers: { 'Content-Type': 'application/json',
          'x-connect-timestamp': timestamp, 'x-connect-signature': signature },
        body: raw,
      });
  } catch {
    throw new Error('JOURNEY_CONNECT_TRANSPORT_UNCERTAIN');
  }
  if (response.status !== 202) throw new Error('JOURNEY_CONNECT_EVENT_NOT_ACCEPTED');
  let reply: unknown;
  try { reply = await response.json(); }
  catch { throw new Error('JOURNEY_CONNECT_ACK_INVALID'); }
  const ack = reply as { accepted?: unknown; duplicate?: unknown } | null;
  if (!ack || ack.accepted !== true || typeof ack.duplicate !== 'boolean')
    throw new Error('JOURNEY_CONNECT_ACK_INVALID');
  return ack.duplicate ? 'duplicate' : 'accepted';
}
