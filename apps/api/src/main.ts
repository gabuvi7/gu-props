import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";
import {
  ensureStorageBasePath,
  resolveStorageBasePath
} from "./common/storage/storage.config";

const defaultPort = 3001;

async function bootstrap(): Promise<void> {
  // Validar/crear el directorio de almacenamiento de documentos antes de aceptar tráfico.
  // El `LiquidationsModule` (Batch 6) inyectará `LocalDocumentStorage` apuntando a este path.
  const storageBasePath = resolveStorageBasePath();
  await ensureStorageBasePath(storageBasePath);

  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const port = Number(config.get<string>("API_PORT") ?? config.get<string>("PORT") ?? defaultPort);

  await app.listen(port);
  console.info(`API de GU-Props escuchando en http://localhost:${port}`);
  console.info(`Storage de documentos en ${storageBasePath}`);
}

void bootstrap();
