import { createReadStream, promises as fs } from "node:fs";
import { dirname, isAbsolute, join, normalize, sep } from "node:path";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Injectable } from "@nestjs/common";
import type { DocumentStorage } from "./document-storage.interface";

/**
 * Implementación dev/MVP de `DocumentStorage` que persiste archivos en disco
 * bajo un directorio base. Sirve para entornos locales y testing; para
 * producción se sustituye por R2/S3 sin tocar consumidores.
 */
@Injectable()
export class LocalDocumentStorage implements DocumentStorage {
  constructor(private readonly basePath: string) {}

  async save(key: string, content: Readable | Buffer): Promise<void> {
    this.assertValidKey(key);
    const fullPath = join(this.basePath, key);
    await fs.mkdir(dirname(fullPath), { recursive: true });

    if (Buffer.isBuffer(content)) {
      await fs.writeFile(fullPath, content);
      return;
    }

    // Escritura por stream para no bufferizar PDFs grandes en memoria.
    const handle = await fs.open(fullPath, "w");
    try {
      const writeStream = handle.createWriteStream();
      await pipeline(content, writeStream);
    } finally {
      // pipeline cierra el writeStream pero el FileHandle queda abierto
      // hasta que lo cerramos explícitamente.
      await handle.close().catch(() => undefined);
    }
  }

  async read(key: string): Promise<Readable> {
    this.assertValidKey(key);
    const fullPath = join(this.basePath, key);

    try {
      await fs.access(fullPath);
    } catch {
      throw new Error("El documento solicitado no existe.");
    }

    return createReadStream(fullPath);
  }

  async exists(key: string): Promise<boolean> {
    this.assertValidKey(key);
    const fullPath = join(this.basePath, key);

    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    this.assertValidKey(key);
    const fullPath = join(this.basePath, key);

    try {
      await fs.unlink(fullPath);
    } catch (error) {
      // Idempotente: si no existe, no falla.
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return;
      }
      throw error;
    }
  }

  /**
   * Rechaza claves con path traversal o paths absolutos.
   * Normaliza y verifica que no se escape del base path.
   */
  private assertValidKey(key: string): void {
    if (typeof key !== "string" || key.length === 0) {
      throw new Error("La ruta del documento no es válida.");
    }

    if (isAbsolute(key)) {
      throw new Error("La ruta del documento no es válida.");
    }

    // Detección directa de segmentos `..`.
    const segments = key.split(/[\\/]/);
    if (segments.some((segment) => segment === "..")) {
      throw new Error("La ruta del documento no es válida.");
    }

    // Defensa adicional: tras normalizar, no debe empezar con `..` ni alejarse del base path.
    const normalized = normalize(key);
    if (normalized.startsWith("..") || normalized.startsWith(`..${sep}`)) {
      throw new Error("La ruta del documento no es válida.");
    }
  }
}

/**
 * Factory utilitaria para construir el provider sin acoplarse a Nest DI.
 * El `LiquidationsModule` (Batch 6) lo usa para registrar el provider con el
 * token `DOCUMENT_STORAGE` y el base path resuelto desde env.
 */
export function createLocalDocumentStorage(basePath: string): LocalDocumentStorage {
  return new LocalDocumentStorage(basePath);
}
