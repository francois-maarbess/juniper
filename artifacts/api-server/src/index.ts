import './instrument.js';
import 'reflect-metadata';
import cookieParser from 'cookie-parser';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import type { NextFunction, Request, Response } from 'express';
import type { CorsOptions } from 'cors';

function validateProductionConfiguration() {
  if (process.env.NODE_ENV !== 'production') return;
  for (const key of ['APP_ORIGIN', 'APP_PUBLIC_URL', 'DATABASE_URL']) {
    if (!process.env[key]) throw new Error(`${key} must be configured before production startup.`);
  }
  const appOrigin = new URL(process.env.APP_ORIGIN!);
  const publicUrl = new URL(process.env.APP_PUBLIC_URL!);
  const databaseUrl = new URL(process.env.DATABASE_URL!);
  if (appOrigin.protocol !== 'https:' || publicUrl.protocol !== 'https:') {
    throw new Error('APP_ORIGIN and APP_PUBLIC_URL must use HTTPS in production.');
  }
  if (databaseUrl.protocol !== 'postgres:' && databaseUrl.protocol !== 'postgresql:') {
    throw new Error('DATABASE_URL must point to PostgreSQL in production.');
  }
  if (['localhost', '127.0.0.1', '::1'].includes(databaseUrl.hostname)) {
    throw new Error('DATABASE_URL must point to the production database, not localhost.');
  }
}

async function bootstrap() {
  validateProductionConfiguration();
  const app = await NestFactory.create(AppModule, { bodyParser: true });
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.use((request: Request, response: Response, next: NextFunction) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('X-Frame-Options', 'DENY');
    if (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH') {
      const contentType = request.headers['content-type'] ?? '';
      const privateFileUpload = request.method === 'POST' && (
        request.path === '/api/marketplace/tutor-application/documents' ||
        request.path === '/api/marketplace/resources' ||
        request.path === '/api/marketplace/tutor-vault' ||
        /^\/api\/marketplace\/bookings\/[^/]+\/messages\/attachments$/.test(request.path) ||
        /^\/api\/marketplace\/bookings\/[^/]+\/payment\/report$/.test(request.path) ||
        /^\/api\/marketplace\/requests\/[^/]+\/attachments$/.test(request.path) ||
        /^\/api\/marketplace\/requests\/[^/]+\/voice-note$/.test(request.path) ||
        /^\/api\/marketplace\/bookings\/[^/]+\/voice-note$/.test(request.path)
      ) && contentType.toLowerCase().startsWith('multipart/form-data;');
      if (!contentType.includes('application/json') && !privateFileUpload) {
        response.status(415).json({ statusCode: 415, message: 'Send JSON request data.' });
        return;
      }
    }
    next();
  });
  const corsOptions: CorsOptions = {
    credentials: true,
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      const configuredOrigin = process.env.APP_ORIGIN ? new URL(process.env.APP_ORIGIN).origin : undefined;
      const localDevelopmentOrigin = process.env.NODE_ENV !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
      if (origin === configuredOrigin || localDevelopmentOrigin) return callback(null, true);
      return callback(new Error('Origin not allowed by Juniper API.'));
    },
  };
  app.enableCors(corsOptions);
  app.enableShutdownHooks();
  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
  console.info(`Juniper API listening on port ${port}`);
}

void bootstrap();
