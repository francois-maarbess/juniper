import * as Sentry from '@sentry/nestjs';

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 0,
    dataCollection: { httpBodies: [] },
    beforeSend(event) {
      if (event.request) {
        delete event.request.data;
        delete event.request.query_string;
        if (event.request.headers) {
          const headers = event.request.headers as Record<string, unknown>;
          delete headers.authorization;
          delete headers.Authorization;
          delete headers.cookie;
          delete headers.Cookie;
        }
      }
      return event;
    },
  });
}
