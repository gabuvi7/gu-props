import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";

const defaultPort = 3001;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const port = Number(config.get<string>("API_PORT") ?? config.get<string>("PORT") ?? defaultPort);

  await app.listen(port);
  console.info(`API de GU-Props escuchando en http://localhost:${port}`);
}

void bootstrap();
