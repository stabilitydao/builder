import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { readFileSync } from 'node:fs';
import { NestApplicationOptions } from '@nestjs/common';

async function bootstrap() {
  const sslKey = process.env.SSL_KEY;
  const sslCert = process.env.SSL_CERT;

  const isSsl = sslKey && sslCert;

  const options: NestApplicationOptions = isSsl
    ? {
        httpsOptions: {
          key: readFileSync(sslKey),
          cert: readFileSync(sslCert),
        },
      }
    : {};

  const app = await NestFactory.create(AppModule, options);

  app.enableCors({
    origin: [
      'https://stability.farm',
      'https://stabilitydao.org',
      'https://alpha.stabilitydao.org',
      'https://beta.stability.farm',
      'https://stability.market',
      'http://localhost:4321',
      'http://localhost:3000',
    ],
  });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
