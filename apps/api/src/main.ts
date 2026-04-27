import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

const defaultPort = 3000;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT ?? defaultPort);

  await app.listen(port);
  console.info(`API de GU-Props escuchando en http://localhost:${port}`);
}

void bootstrap();
