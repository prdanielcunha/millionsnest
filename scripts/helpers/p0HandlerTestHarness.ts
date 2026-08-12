import { getApps, initializeApp } from 'firebase-admin/app';
import { Firestore, getFirestore } from 'firebase-admin/firestore';
import type { Request, Response } from 'express';

export const INVITATION_TEST_PROJECT_ID = 'demo-millionsnest-invitations-p0';

export type HandlerResult = { statusCode: number; body: Record<string, unknown> };

export function requireInvitationEmulator(): Firestore {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error('FIRESTORE_EMULATOR_HOST is required; production Firestore is forbidden');
  }
  process.env.GCLOUD_PROJECT = INVITATION_TEST_PROJECT_ID;
  process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: INVITATION_TEST_PROJECT_ID });
  const app = getApps()[0] ?? initializeApp({ projectId: INVITATION_TEST_PROJECT_ID });
  return getFirestore(app);
}

export async function clearInvitationEmulator(): Promise<void> {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  if (!host) throw new Error('FIRESTORE_EMULATOR_HOST is required');
  const response = await fetch(
    `http://${host}/emulator/v1/projects/${INVITATION_TEST_PROJECT_ID}/databases/(default)/documents`,
    { method: 'DELETE' }
  );
  if (!response.ok) throw new Error(`Unable to clear emulator: ${response.status}`);
}

export async function invokeHandler(
  handler: (req: Request, res: Response) => Promise<unknown>,
  options: { bearer?: string; body?: Record<string, unknown> } = {}
): Promise<HandlerResult> {
  let statusCode = 200;
  let body: Record<string, unknown> = {};
  const req = {
    headers: options.bearer ? { authorization: `Bearer ${options.bearer}` } : {},
    body: options.body ?? {}
  } as Request;
  const res = {
    status(code: number) { statusCode = code; return this; },
    json(payload: Record<string, unknown>) { body = payload; return this; }
  } as unknown as Response;
  await handler(req, res);
  return { statusCode, body };
}

export function createAssertions() {
  let passed = 0;
  let failed = 0;
  return {
    assert(name: string, condition: unknown) {
      if (condition) { passed++; console.log(`[PASS] ${name}`); }
      else { failed++; console.error(`[FAIL] ${name}`); }
    },
    finish() {
      console.log(`\nResults: ${passed} PASS / ${failed} FAIL`);
      if (failed) process.exitCode = 1;
      return { passed, failed };
    }
  };
}
