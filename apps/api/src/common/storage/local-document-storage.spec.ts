import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalDocumentStorage } from "./local-document-storage";

function readableFromBuffer(buf: Buffer): Readable {
  return Readable.from([buf]);
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

describe("LocalDocumentStorage", () => {
  let basePath: string;
  let storage: LocalDocumentStorage;

  beforeEach(() => {
    basePath = mkdtempSync(join(tmpdir(), "gu-prop-storage-"));
    storage = new LocalDocumentStorage(basePath);
  });

  afterEach(() => {
    rmSync(basePath, { recursive: true, force: true });
  });

  describe("save", () => {
    it("escribe un Buffer bajo basePath/key con contenido idéntico", async () => {
      const key = "tenant-1/liquidations/liq-1/comprobante.pdf";
      const data = Buffer.from("contenido binario", "utf8");

      await storage.save(key, data);

      const fullPath = join(basePath, key);
      expect(existsSync(fullPath)).toBe(true);
      expect(readFileSync(fullPath)).toEqual(data);
    });

    it("acepta un Readable y persiste los mismos bytes", async () => {
      const key = "tenant-1/liquidations/liq-2/doc.pdf";
      const data = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]);

      await storage.save(key, readableFromBuffer(data));

      const fullPath = join(basePath, key);
      expect(readFileSync(fullPath)).toEqual(data);
    });

    it("crea los directorios padre si no existen", async () => {
      const key = "tenant-1/liquidations/anidado/profundo/nuevo.pdf";
      await storage.save(key, Buffer.from("ok"));
      expect(existsSync(join(basePath, key))).toBe(true);
    });

    it("rechaza claves con `..` con mensaje en español", async () => {
      await expect(
        storage.save("../escape.pdf", Buffer.from("x"))
      ).rejects.toThrow("La ruta del documento no es válida.");

      await expect(
        storage.save("tenant-1/../../escape.pdf", Buffer.from("x"))
      ).rejects.toThrow("La ruta del documento no es válida.");
    });

    it("rechaza claves absolutas con mensaje en español", async () => {
      await expect(
        storage.save("/etc/passwd", Buffer.from("x"))
      ).rejects.toThrow("La ruta del documento no es válida.");
    });
  });

  describe("read", () => {
    it("devuelve un Readable cuyos bytes coinciden con lo guardado", async () => {
      const key = "tenant-1/liquidations/liq-1/doc.pdf";
      const data = Buffer.from("hola mundo", "utf8");
      await storage.save(key, data);

      const stream = await storage.read(key);
      const out = await streamToBuffer(stream);
      expect(out).toEqual(data);
    });

    it("lanza error específico en español si la key no existe", async () => {
      await expect(storage.read("tenant-1/missing/doc.pdf")).rejects.toThrow(
        "El documento solicitado no existe."
      );
    });

    it("rechaza claves con path traversal", async () => {
      await expect(storage.read("../escape.pdf")).rejects.toThrow(
        "La ruta del documento no es válida."
      );
    });
  });

  describe("exists", () => {
    it("devuelve true cuando el archivo está", async () => {
      const key = "tenant-1/liquidations/liq-1/doc.pdf";
      await storage.save(key, Buffer.from("x"));
      expect(await storage.exists(key)).toBe(true);
    });

    it("devuelve false cuando no existe", async () => {
      expect(await storage.exists("tenant-1/missing.pdf")).toBe(false);
    });

    it("rechaza claves inválidas", async () => {
      await expect(storage.exists("../oops")).rejects.toThrow(
        "La ruta del documento no es válida."
      );
    });
  });

  describe("delete", () => {
    it("borra el archivo si existe", async () => {
      const key = "tenant-1/liquidations/liq-1/doc.pdf";
      await storage.save(key, Buffer.from("x"));
      expect(existsSync(join(basePath, key))).toBe(true);

      await storage.delete(key);

      expect(existsSync(join(basePath, key))).toBe(false);
    });

    it("es idempotente cuando la key no existe (no lanza)", async () => {
      await expect(storage.delete("tenant-1/missing.pdf")).resolves.toBeUndefined();
    });

    it("rechaza claves inválidas", async () => {
      await expect(storage.delete("/absolute/path.pdf")).rejects.toThrow(
        "La ruta del documento no es válida."
      );
    });
  });
});
