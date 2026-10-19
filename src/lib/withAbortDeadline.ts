/** Bound token acquisition as well as fetch/body reads, including unmount cancellation. */
export async function withAbortDeadline<T>(controller: AbortController, operation: () => Promise<T>, timeoutMs = 20000): Promise<T> {
  let cancel: () => void;
  const aborted = new Promise<never>((_resolve, reject) => {
    cancel = () => reject(new Error('REQUEST_ABORTED'));
    controller.signal.addEventListener('abort', cancel, { once: true });
    if (controller.signal.aborted) cancel();
  });
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try { return await Promise.race([aborted, operation()]); }
  finally { clearTimeout(timeout); controller.signal.removeEventListener('abort', cancel!); }
}
