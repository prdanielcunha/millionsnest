// Entry point to initialize all OS modules early
import { diagnosticsEngine } from './diagnostics.js';
import { watchdog } from './watchdog.js';
import { queueIntegrity } from './queue.js';
import { runtimeCleanup } from './runtime.js';

export function initializeOSHardening() {
  diagnosticsEngine.log('Booting OS Hardening Layer...', 'info', 'OS_INIT');
  
  // They are mostly initialized as Singletons on import, but we can explicitly call them to ensure they ran
  const state = {
    diagnostics: diagnosticsEngine ? 'OK' : 'FAIL',
    watchdog: watchdog ? 'OK' : 'FAIL',
    queue: queueIntegrity ? 'OK' : 'FAIL',
    runtime: runtimeCleanup ? 'OK' : 'FAIL',
  };

  diagnosticsEngine.log('Ecosystem SRE Layer initialized logically.', 'info', 'OS_INIT', state);
}
