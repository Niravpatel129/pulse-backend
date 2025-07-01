// Import with `import * as Sentry from "@sentry/node"` if you are using ESM
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: 'https://9f73e9222189bb452b0913c9969854d5@o1363835.ingest.us.sentry.io/4509594192642048',

  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,
});
