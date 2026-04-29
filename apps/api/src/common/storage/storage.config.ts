import { promises as fs } from "node:fs";
import { isAbsolute, resolve } from "node:path";

/**
 * Nombre de la variable de entorno que controla la base path del storage local.
 * Si no está definida, se usa `./storage` resuelto contra `process.cwd()`.
 */
export const STORAGE_BASE_PATH_ENV = "STORAGE_BASE_PATH";

/**
 * Default relativo al cwd. La función `resolveStorageBasePath` se encarga de
 * convertirlo en absoluto antes de usarlo.
 */
export const DEFAULT_STORAGE_BASE_PATH = "./storage";

/**
 * Resuelve la base path del storage de documentos a partir de:
 *   - `process.env.STORAGE_BASE_PATH` (si está definido y no es vacío).
 *   - Default `./storage` relativo al cwd, resuelto a absoluto.
 *
 * NO toca el filesystem; sólo computa el path. Para crear/validar el directorio
 * usar `ensureStorageBasePath`.
 */
export function resolveStorageBasePath(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env[STORAGE_BASE_PATH_ENV]?.trim();
  const candidate = raw && raw.length > 0 ? raw : DEFAULT_STORAGE_BASE_PATH;
  return isAbsolute(candidate) ? candidate : resolve(process.cwd(), candidate);
}

/**
 * Asegura que el directorio de storage existe. Si no existe lo crea.
 * Lanza un error con mensaje en español si no se puede crear.
 *
 * Pensado para llamarse en bootstrap (`main.ts`) y/o en el provider del
 * módulo de liquidaciones cuando se cree (Batch 6).
 */
export async function ensureStorageBasePath(basePath: string): Promise<void> {
  try {
    await fs.mkdir(basePath, { recursive: true });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `No se pudo inicializar el directorio de almacenamiento de documentos en "${basePath}". ${reason}`
    );
  }
}

/**
 * NOTA DE INYECCIÓN (Batch 6 — `LiquidationsModule`):
 *
 * Cuando se cree el `LiquidationsModule`, registrar el provider así:
 *
 *   import { DOCUMENT_STORAGE } from "../../common/storage/document-storage.interface";
 *   import { LocalDocumentStorage } from "../../common/storage/local-document-storage";
 *   import { resolveStorageBasePath } from "../../common/storage/storage.config";
 *
 *   {
 *     provide: DOCUMENT_STORAGE,
 *     useFactory: () => new LocalDocumentStorage(resolveStorageBasePath())
 *   }
 *
 * Y consumirlo con `@Inject(DOCUMENT_STORAGE) storage: DocumentStorage`.
 *
 * En `main.ts` se debería invocar `ensureStorageBasePath(resolveStorageBasePath())`
 * antes de `app.listen` para fallar rápido si el directorio no es escribible.
 */
