import { NestFactory } from '@nestjs/core';
import { CommandService } from 'nestjs-command';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  await app.get(CommandService).exec();
  await app.close();
}
bootstrap();
