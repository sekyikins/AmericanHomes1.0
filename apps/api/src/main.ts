import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParserModule from 'cookie-parser';
import * as helmetModule from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { createGlobalValidationPipe } from './common/pipes/validation.pipe';

function validateProductionEnvironment(): void {
  const missing: string[] = [];
  if (!process.env.DATABASE_URL?.trim()) missing.push('DATABASE_URL');

  const jwtSecret = process.env.JWT_SECRET?.trim() ?? '';
  if (jwtSecret.length < 32 || jwtSecret === 'dev-jwt-secret-change-in-prod') {
    missing.push('JWT_SECRET (minimum 32 characters)');
  }

  const corsEnv = process.env.CORS_ORIGINS?.trim() ?? '';
  if (!corsEnv || corsEnv === '*') {
    missing.push('CORS_ORIGINS (explicit allowed origin(s), not "*")');
  }

  const paystackKey = process.env.PAYSTACK_SECRET_KEY?.trim() ?? '';
  if (!paystackKey || !paystackKey.startsWith('sk_live_')) {
    missing.push('PAYSTACK_SECRET_KEY (live sk_live_... key required in production)');
  }

  if (process.env.OTP_DUMMY_MODE === 'true') {
    missing.push('OTP_DUMMY_MODE must be false in production');
  }
  const otpKey = process.env.OTP_API_KEY?.trim() ?? '';
  if (!otpKey || /placeholder|changeme|your[-_]/i.test(otpKey)) {
    missing.push('OTP_API_KEY (valid Arkesel API key)');
  }

  if (missing.length > 0) {
    throw new Error(
      `FATAL: Production startup blocked — invalid or missing configuration:\n - ${missing.join('\n - ')}`,
    );
  }
}

async function bootstrap() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    validateProductionEnvironment();
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  const helmetFn =
    typeof helmetModule === 'function'
      ? helmetModule
      : (helmetModule as unknown as { default: (...args: unknown[]) => unknown }).default;
  const cookieParserFn =
    typeof cookieParserModule === 'function'
      ? cookieParserModule
      : (cookieParserModule as unknown as { default: (...args: unknown[]) => unknown }).default;

  app.use(
    helmetFn({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }) as Parameters<typeof app.use>[0],
  );
  app.use(cookieParserFn() as Parameters<typeof app.use>[0]);

  app.useBodyParser('json', { limit: '8mb' });
  app.useBodyParser('urlencoded', { extended: true, limit: '8mb' });

  const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  app.enableCors({
    origin: origins,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With'],
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(createGlobalValidationPipe());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Never expose public Swagger API docs in production
  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('AmericanHomes API')
      .setDescription('AmericanHomes Business Platform REST API')
      .setVersion('1.0')
      .addBearerAuth()
      .addSecurityRequirements('bearer')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
}

void bootstrap();
