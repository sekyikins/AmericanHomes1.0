import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { createGlobalValidationPipe } from './common/pipes/validation.pipe';

async function bootstrap() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    const jwtSecret = process.env.JWT_SECRET?.trim() ?? '';
    if (jwtSecret.length < 32 || jwtSecret === 'dev-jwt-secret-change-in-prod') {
      throw new Error('FATAL: JWT_SECRET must be at least 32 characters in production.');
    }
    const corsEnv = process.env.CORS_ORIGINS?.trim() ?? '';
    if (!corsEnv || corsEnv === '*') {
      throw new Error('FATAL: CORS_ORIGINS must be explicitly set to allowed domain(s) in production.');
    }
  }

  const app = await NestFactory.create(AppModule);
  const httpAdapter = app.getHttpAdapter().getInstance() as { disable?: (setting: string) => void };
  httpAdapter.disable?.('x-powered-by');

  const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins, credentials: true });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(createGlobalValidationPipe());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  if (!isProduction || process.env.ENABLE_SWAGGER === 'true') {
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
