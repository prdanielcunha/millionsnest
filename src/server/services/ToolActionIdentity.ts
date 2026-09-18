import { createHash } from 'node:crypto';

export function stableToolJson(
  value: unknown
): string {
  if (
    value === null ||
    typeof value !== 'object'
  ) {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return (
      '[' +
      value.map(stableToolJson).join(',') +
      ']'
    );
  }

  const object =
    value as Record<string, unknown>;

  return (
    '{' +
    Object.keys(object)
      .sort()
      .map(
        key =>
          `${JSON.stringify(key)}:${stableToolJson(
            object[key]
          )}`
      )
      .join(',') +
    '}'
  );
}

export function createToolRequestFingerprint(input: {
  toolId: string;
  toolInput: Record<string, unknown>;
  source: Record<string, unknown> | null;
}): string {
  return createHash('sha256')
    .update(stableToolJson(input))
    .digest('hex');
}

export function createScopedToolRecordId(
  parts: readonly string[]
): string {
  return createHash('sha256')
    .update(parts.join(':'))
    .digest('hex')
    .slice(0, 48);
}
