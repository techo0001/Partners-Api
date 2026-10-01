import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AuthService } from './auth/auth.service';

async function bootstrap() {
  const logger = new Logger('TechoPartnersBootstrap');
  const app = await NestFactory.create(AppModule);

  // 1. Enable CORS for Developer Portal and Supplier Mobile/Web Clients
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // 2. Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // 3. Swagger API Documentation
  const config = new DocumentBuilder()
    .setTitle('Techo Partners API')
    .setDescription('Enterprise Backend API for External Partners (Suppliers & Customers) and Developer Command Dashboard')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);
  SwaggerModule.setup('api/docs', app, document);

  // 4. Seed default developer account
  const authService = app.get(AuthService);
  await authService.seedDeveloperAccount();

  const port = process.env.PORT || 4000;
  await app.listen(port);
  logger.log(`🚀 Techo Partners Backend API is running on: http://localhost:${port}`);
  logger.log(`📚 Swagger API Documentation available at: http://localhost:${port}/docs`);
}

bootstrap();
