import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as os from 'os';

function getLocalIpAddress(): string | null {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const netList = interfaces[name];
    if (netList) {
      for (const net of netList) {
        if (net.family === 'IPv4' && !net.internal) {
          return net.address;
        }
      }
    }
  }
  return null;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: true,
    credentials: true,
  });
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  await app.listen(port, '0.0.0.0');

  const ipAddress = getLocalIpAddress();
  console.log(`Server running at:`);
  console.log(`- Local:   http://localhost:${port}`);
  if (ipAddress) {
    console.log(`- Network: http://${ipAddress}:${port}`);
  }
}
void bootstrap();

