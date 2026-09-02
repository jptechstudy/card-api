import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);

  const server = app.getHttpServer();
  const address = server.address();

  const port = typeof address === 'string' ? address : address.port;

  const host = 'localhost';

  const url = `http://${host}:${port}`;

  console.log('Server running at:', url);
}
void bootstrap();
