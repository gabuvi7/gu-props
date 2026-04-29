import type { Readable } from "node:stream";

/**
 * Abstracción de almacenamiento de documentos para GU-Props.
 *
 * Convención de claves (`key`):
 *   `{tenantId}/{entityType}/{entityId}/{filename}.{ext}`
 *
 * Reglas obligatorias para cualquier implementación (Local, R2, S3, etc.):
 *  - Los segmentos de path deben ser relativos al base path configurado.
 *  - Está PROHIBIDO usar `..`, paths absolutos, o cualquier secuencia que
 *    permita escapar del base path (path traversal). La implementación
 *    DEBE rechazar esas claves con un error específico.
 *  - El aislamiento por tenant se logra usando `tenantId` como primer
 *    segmento; nunca exponer la key cruda al cliente HTTP.
 */
export interface DocumentStorage {
  /**
   * Guarda contenido bajo la clave indicada. Crea directorios padre si hace falta.
   * Acepta tanto un `Buffer` (contenido en memoria) como un `Readable` (stream).
   */
  save(key: string, content: Readable | Buffer): Promise<void>;

  /**
   * Devuelve un `Readable` con el contenido del documento.
   * Lanza un error si la clave no existe.
   */
  read(key: string): Promise<Readable>;

  /**
   * Indica si existe un documento bajo la clave dada.
   * No debe lanzar si no existe; devuelve `false`.
   */
  exists(key: string): Promise<boolean>;

  /**
   * Elimina el documento. Idempotente: no falla si la clave no existe.
   */
  delete(key: string): Promise<void>;
}

/**
 * Token de inyección Nest para registrar la implementación concreta de `DocumentStorage`.
 */
export const DOCUMENT_STORAGE = Symbol("DOCUMENT_STORAGE");
