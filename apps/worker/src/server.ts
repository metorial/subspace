import { createRequire } from 'module';
import { initTelemetry } from '@lowerdeck/telemetry';

// Provide CommonJS `require` in ESM runtime for bundled deps.
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).require = require;

async function main() {
  await import('./init');
  initTelemetry({ serviceName: 'subspace-worker' });
  await import('./instrument');
  await import('./worker');
  await import('./connection');
  await import('./endpoints');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
