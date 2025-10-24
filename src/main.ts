import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { readFileSync } from 'node:fs';

async function bootstrap() {
  const sslKey = process.env.SSL_KEY;
  const sslCert = process.env.SSL_CERT;

  const isSsl = sslKey && sslCert;

  const options = isSsl
    ? {
        httpsOptions: {
          key: readFileSync(sslKey),
          cert: readFileSync(sslCert),
        },
      }
    : {};

  const app = await NestFactory.create(AppModule, options);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
