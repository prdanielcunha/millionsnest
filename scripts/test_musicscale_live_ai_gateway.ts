import assert from 'node:assert/strict';
import type { Request, Response } from 'express';
import { handleMusicScaleLiveAiRequest } from '../src/server/services/MusicScaleLiveAiGatewayService.js';

type JsonBody = Record<string, unknown>;

function request(input: {
  token?: string;
  organizationId?: string;
  task?: string;
  body?: unknown;
}): Request {
  return {
    headers: input.token ? { authorization: `Bearer ${input.token}` } : {},
    params: { organizationId: input.organizationId ?? 'org-live-qa' },
    body: {
      task: input.task ?? 'diagnostic_explanation',
      input: input.body ?? {}
    }
  } as unknown as Request;
}

function response() {
  let statusCode = 200;
  let jsonBody: JsonBody | null = null;
  const headers = new Map<string, string>();
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: JsonBody) {
      jsonBody = body;
      return this;
    },
    setHeader(name: string, value: string) {
      headers.set(name.toLowerCase(), value);
      return this;
    }
  } as unknown as Response;

  return {
    res,
    read: () => ({ statusCode, jsonBody, headers })
  };
}

function fakeDb() {
  const usage = new Map<string, number>();
  const audits: Array<{ path: string; payload: unknown }> = [];

  const db = {
    doc(path: string) {
      return {
        path,
        async set(payload: unknown) {
          audits.push({ path, payload });
        }
      };
    },
    async runTransaction<T>(callback: (transaction: any) => Promise<T>): Promise<T> {
      const transaction = {
        async get(ref: { path: string }) {
          const requests = usage.get(ref.path) ?? 0;
          return {
            data: () => requests > 0 ? { requests, byTask: {} } : undefined
          };
        },
        set(ref: { path: string }, payload: any) {
          if (typeof payload?.requests === 'number') {
            usage.set(ref.path, payload.requests);
          }
        }
      };
      return callback(transaction);
    }
  };

  return { db, audits, usage };
}

function dependencies(input: {
  db: ReturnType<typeof fakeDb>['db'];
  accessible?: boolean;
  generate?: (args: { model: string; prompt: string; timeoutMs: number }) => Promise<{
    text: string;
    inputTokens?: number;
    outputTokens?: number;
  }>;
}) {
  return {
    verifyIdToken: async () => ({ uid: 'user-live-qa' }),
    getFirestore: () => input.db,
    resolveAccess: async () => ({ accessible: input.accessible ?? true }),
    generate: input.generate ?? (async () => ({
      text: JSON.stringify({
        summary: 'Diagnóstico explicado sem executar ações.',
        confidence: 0.9,
        suggestions: [],
        warnings: []
      }),
      inputTokens: 10,
      outputTokens: 20
    }))
  } as any;
}

async function main() {
  {
    const recorder = response();
    await handleMusicScaleLiveAiRequest(
      request({ token: undefined }),
      recorder.res,
      dependencies({ db: fakeDb().db })
    );
    assert.equal(recorder.read().statusCode, 401);
    assert.equal(recorder.read().jsonBody?.reasonCode, 'UNAUTHENTICATED');
  }

  {
    const recorder = response();
    await handleMusicScaleLiveAiRequest(
      request({ token: 'token', organizationId: 'org-denied' }),
      recorder.res,
      dependencies({ db: fakeDb().db, accessible: false })
    );
    assert.equal(recorder.read().statusCode, 403);
    assert.equal(recorder.read().jsonBody?.reasonCode, 'MUSICSCALE_ACCESS_DENIED');
  }

  {
    const store = fakeDb();
    let capturedModel = '';
    let capturedPrompt = '';
    const recorder = response();
    await handleMusicScaleLiveAiRequest(
      request({
        token: 'token',
        organizationId: 'org-redaction',
        body: {
          email: 'operator@example.com',
          phone: '+55 43 99999-1234',
          providerToken: 'super-sensitive-provider-token-value',
          diagnostics: { state: 'offline' }
        }
      }),
      recorder.res,
      dependencies({
        db: store.db,
        generate: async ({ model, prompt }) => {
          capturedModel = model;
          capturedPrompt = prompt;
          return {
            text: JSON.stringify({
              summary: 'O provider está offline segundo os fatos fornecidos.',
              confidence: 0.95,
              suggestions: [{
                kind: 'safe_check',
                label: 'Verificar o aplicativo conectado',
                reason: 'O estado observado informado é offline.'
              }],
              warnings: []
            }),
            inputTokens: 120,
            outputTokens: 60
          };
        }
      })
    );

    assert.equal(recorder.read().statusCode, 200);
    assert.equal(recorder.read().jsonBody?.success, true);
    assert.equal(capturedModel, 'gemini-3.5-flash-lite');
    assert.match(capturedPrompt, /Never execute, imply execution of, or manufacture TAKE/);
    assert.doesNotMatch(capturedPrompt, /operator@example\.com/);
    assert.doesNotMatch(capturedPrompt, /99999-1234/);
    assert.doesNotMatch(capturedPrompt, /super-sensitive-provider-token-value/);
    assert.match(capturedPrompt, /\[email-redacted\]/);
    assert.match(capturedPrompt, /\[phone-redacted\]/);
    assert.match(capturedPrompt, /\[secret-redacted\]/);
    assert.equal(store.audits.length, 1);
  }

  {
    const recorder = response();
    await handleMusicScaleLiveAiRequest(
      request({
        token: 'token',
        organizationId: 'org-invalid-output',
        body: { unique: 'invalid-output-case' }
      }),
      recorder.res,
      dependencies({
        db: fakeDb().db,
        generate: async () => ({ text: '{"summary":"missing schema"}' })
      })
    );
    assert.equal(recorder.read().statusCode, 502);
    assert.equal(recorder.read().jsonBody?.reasonCode, 'AI_UNAVAILABLE');
    assert.equal(recorder.read().jsonBody?.fallback, 'deterministic');
  }

  {
    const previousLimit = process.env.MUSICSCALE_LIVE_AI_MONTHLY_REQUEST_LIMIT;
    process.env.MUSICSCALE_LIVE_AI_MONTHLY_REQUEST_LIMIT = '1';
    const store = fakeDb();

    try {
      const first = response();
      await handleMusicScaleLiveAiRequest(
        request({
          token: 'token',
          organizationId: 'org-budget',
          body: { request: 'first-budget-request' }
        }),
        first.res,
        dependencies({ db: store.db })
      );
      assert.equal(first.read().statusCode, 200);

      const second = response();
      await handleMusicScaleLiveAiRequest(
        request({
          token: 'token',
          organizationId: 'org-budget',
          body: { request: 'second-budget-request' }
        }),
        second.res,
        dependencies({ db: store.db })
      );
      assert.equal(second.read().statusCode, 429);
      assert.equal(second.read().jsonBody?.reasonCode, 'AI_MONTHLY_BUDGET_EXCEEDED');
    } finally {
      if (previousLimit === undefined) {
        delete process.env.MUSICSCALE_LIVE_AI_MONTHLY_REQUEST_LIMIT;
      } else {
        process.env.MUSICSCALE_LIVE_AI_MONTHLY_REQUEST_LIMIT = previousLimit;
      }
    }
  }

  {
    let model = '';
    const recorder = response();
    await handleMusicScaleLiveAiRequest(
      request({
        token: 'token',
        organizationId: 'org-advanced-model',
        task: 'post_service_summary',
        body: { timeline: ['x'.repeat(5_000), 'y'.repeat(5_000)] }
      }),
      recorder.res,
      dependencies({
        db: fakeDb().db,
        generate: async args => {
          model = args.model;
          return {
            text: JSON.stringify({
              summary: 'Resumo factual.',
              confidence: 0.8,
              suggestions: [],
              warnings: []
            })
          };
        }
      })
    );
    assert.equal(recorder.read().statusCode, 200);
    assert.equal(model, 'gemini-3.8-flash');
  }

  console.log('MUSICSCALE_LIVE_AI_GATEWAY_QA_OK');
}

await main();
