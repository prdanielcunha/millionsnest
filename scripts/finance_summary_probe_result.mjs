// Firestore streaming REST errors can arrive inside an array, even on HTTP 400.
export function summarizeProbeResult(payload, httpStatus) {
  const entries = Array.isArray(payload) ? payload : [payload];
  const error = entries.find(entry => entry?.error)?.error;
  return {
    http: httpStatus,
    code: typeof error?.status === 'string' ? error.status :
      httpStatus >= 200 && httpStatus < 300 ? 'OK' : 'UNKNOWN_HTTP_ERROR',
    requiresIndex: /requires an index|index.*required/i.test(String(error?.message ?? '')),
  };
}
