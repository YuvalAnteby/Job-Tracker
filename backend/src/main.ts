import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : [process.env.FRONTEND_URL || 'http://localhost:5173'];

  app.enableCors({
    origin: allowedOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Job Tracker API')
    .setDescription('The Job Tracker API description')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port)
  .then(() => {
    logger.verbose(`Application is running on: ${process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace('5173', port.toString()) : `http://localhost:${port}`}/api`);
    logger.verbose(
      `Swagger documentation is available at: ${process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace('5173', port.toString()) : `http://localhost:${port}`}/api/docs`,
    );
  })
  .catch((err) => {
    logger.error('Failed to start application', err);
  })
}
bootstrap();
