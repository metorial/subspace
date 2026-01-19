import { setSentry } from '@lowerdeck/sentry';
import * as Sentry from '@sentry/bun';

declare global {
  // eslint-disable-next-line no-var
  var sentryInitialized: boolean | undefined;
}

if (
  process.env.METORIAL_ENV != 'development' &&
  !global.sentryInitialized &&
  process.env.ENABLE_SENTRY === 'true'
) {
  global.sentryInitialized = true;

  Sentry.init({
    dsn: 'https://7c06753d28767b9128d203c285d11013@o4509422540292096.ingest.de.sentry.io/4509422550515792',

    sendDefaultPii: true,

    environment: process.env.METORIAL_ENV,

    beforeSend(event) {
      // Optional: add allocation ID to all events here as fallback
      if (!event.tags) event.tags = {};
      event.tags.allocationId = process.env.NOMAD_ALLOC_ID || 'unknown';
      return event;
    },

    ignoreErrors: ['The client is closed']
  });

  setSentry(Sentry as any);
}

console.log('Sentry initialized for Bun');
