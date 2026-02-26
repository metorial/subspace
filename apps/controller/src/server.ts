import { createRequire } from 'module';
import { initTelemetry } from '@lowerdeck/telemetry';

// Provide CommonJS `require` in ESM runtime for bundled deps.
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).require = require;

async function main() {
  await import('./init');
  initTelemetry({ serviceName: 'subspace-controller' });
  await import('./instrument');
  await import('./endpoints');
  await import('./connection/server');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
