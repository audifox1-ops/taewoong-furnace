import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ensureLocalPostgres } from './dev/local-postgres';

function getAllowedOrigins(): string[] {
  const defaults = [
    'http://localhost:5173',
    'http://localhost:3000',
  ];
  const envOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
    : [];
  const legacyOrigin = process.env.CORS_ORIGIN;
  if (legacyOrigin) {
    envOrigins.push(...legacyOrigin.split(',').map(s => s.trim()).filter(Boolean));
  }
  return [...new Set([...defaults, ...envOrigins])];
}

async function bootstrap() {
  await ensureLocalPostgres();

  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');
  
  const allowedOrigins = getAllowedOrigins();
  logger.log(`CORS allowed origins: ${allowedOrigins.join(', ')}`);

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn(`CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    maxAge: 86400,
  });
  
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  app.getHttpAdapter().get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('TAEWOONG Furnace Management API')
      .setDescription('Gas Reading & Charge Management System')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`Application running on port ${port}`);
}
bootstrap();
