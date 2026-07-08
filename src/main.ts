import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable validations globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip away bad fields from the request
      forbidNonWhitelisted: true, // Throw when request has unwanted fields
    }),
  );

  await app.listen(3000);
}
bootstrap();
