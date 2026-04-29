import { beforeEach, describe, expect, it, vi } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// pdfkit mock (Opción A del design)
//
// Capturamos cada instancia construida en `mockInstances` para inspeccionar
// las llamadas a métodos del documento.
// ─────────────────────────────────────────────────────────────────────────────

type MockDoc = {
  pipe: ReturnType<typeof vi.fn>;
  fontSize: ReturnType<typeof vi.fn>;
  font: ReturnType<typeof vi.fn>;
  text: ReturnType<typeof vi.fn>;
  moveDown: ReturnType<typeof vi.fn>;
  moveTo: ReturnType<typeof vi.fn>;
  lineTo: ReturnType<typeof vi.fn>;
  stroke: ReturnType<typeof vi.fn>;
  image: ReturnType<typeof vi.fn>;
  addPage: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  __isMockReadable: true;
};

const mockInstances: MockDoc[] = [];

vi.mock("pdfkit", () => {
  const PDFDocument = vi.fn(() => {
    const doc: MockDoc = {
      pipe: vi.fn(),
      fontSize: vi.fn(),
      font: vi.fn(),
      text: vi.fn(),
      moveDown: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      image: vi.fn(),
      addPage: vi.fn(),
      end: vi.fn(),
      on: vi.fn(),
      __isMockReadable: true
    };
    // Cada método chainable devuelve el mismo doc.
    doc.pipe.mockReturnValue(doc);
    doc.fontSize.mockReturnValue(doc);
    doc.font.mockReturnValue(doc);
    doc.text.mockReturnValue(doc);
    doc.moveDown.mockReturnValue(doc);
    doc.moveTo.mockReturnValue(doc);
    doc.lineTo.mockReturnValue(doc);
    doc.stroke.mockReturnValue(doc);
    doc.image.mockReturnValue(doc);
    doc.addPage.mockReturnValue(doc);
    doc.on.mockReturnValue(doc);
    mockInstances.push(doc);
    return doc;
  });
  return { default: PDFDocument };
});

// Importamos DESPUÉS del mock.
import {
  PdfKitLiquidationRenderer,
  type PdfAdjustment,
  type PdfLineItem,
  type PdfOwnerInfo,
  type PdfTenantHeader,
  type RenderLiquidationInput
} from "./pdf-renderer";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function lastDoc(): MockDoc {
  const doc = mockInstances[mockInstances.length - 1];
  if (!doc) {
    throw new Error("No se construyó ningún PDFDocument mock todavía.");
  }
  return doc;
}

/** Devuelve TODOS los strings que pasaron como primer argumento a `text(...)`. */
function textCalls(doc: MockDoc): string[] {
  return doc.text.mock.calls.map((call) => String(call[0] ?? ""));
}

/** ¿Algún `text(...)` contiene este substring? */
function textContains(doc: MockDoc, needle: string): boolean {
  return textCalls(doc).some((s) => s.includes(needle));
}

function buildTenant(overrides: Partial<PdfTenantHeader> = {}): PdfTenantHeader {
  return {
    commercialName: "Inmobiliaria Modelo",
    ...overrides
  };
}

function buildOwner(overrides: Partial<PdfOwnerInfo> = {}): PdfOwnerInfo {
  return {
    displayName: "Juan Pérez",
    ...overrides
  };
}

function buildLineItem(overrides: Partial<PdfLineItem> = {}): PdfLineItem {
  return {
    propertyAddress: "Av. Siempreviva 742",
    paidAt: new Date("2026-04-15T12:00:00.000Z"),
    paidAmount: "100000.00",
    dueAmount: "100000.00",
    liquidableAmount: "100000.00",
    commissionBpsApplied: 1000,
    commissionAmount: "10000.00",
    netAmount: "90000.00",
    ...overrides
  };
}

function buildInput(overrides: Partial<RenderLiquidationInput> = {}): RenderLiquidationInput {
  return {
    tenant: buildTenant(),
    owner: buildOwner(),
    liquidationId: "liq-123",
    status: "ISSUED",
    periodStart: new Date("2026-04-01T00:00:00.000Z"),
    periodEnd: new Date("2026-04-30T23:59:59.999Z"),
    currency: "ARS",
    lineItems: [buildLineItem()],
    adjustments: [],
    totals: {
      grossAmount: "100000.00",
      commissionAmount: "10000.00",
      adjustmentsTotal: "0.00",
      netAmount: "90000.00"
    },
    ...overrides
  };
}

beforeEach(() => {
  mockInstances.length = 0;
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// Bloque A — Header del tenant
// ─────────────────────────────────────────────────────────────────────────────

describe("PdfKitLiquidationRenderer — Bloque A: header del tenant", () => {
  it("renderiza commercialName siempre", () => {
    const renderer = new PdfKitLiquidationRenderer();
    renderer.render(buildInput({ tenant: buildTenant({ commercialName: "ACME Propiedades" }) }));

    const doc = lastDoc();
    expect(textContains(doc, "ACME Propiedades")).toBe(true);
  });

  it("renderiza taxId con formato 'CUIT: ...' si está presente", () => {
    const renderer = new PdfKitLiquidationRenderer();
    renderer.render(
      buildInput({
        tenant: buildTenant({
          legalIdentity: { taxId: "30-12345678-9" }
        })
      })
    );

    expect(textContains(lastDoc(), "CUIT: 30-12345678-9")).toBe(true);
  });

  it("renderiza licenseNumber con formato 'Matrícula: ...' si está presente", () => {
    const renderer = new PdfKitLiquidationRenderer();
    renderer.render(
      buildInput({
        tenant: buildTenant({
          legalIdentity: { licenseNumber: "1234" }
        })
      })
    );

    expect(textContains(lastDoc(), "Matrícula: 1234")).toBe(true);
  });

  it("renderiza legalAddress si está presente", () => {
    const renderer = new PdfKitLiquidationRenderer();
    renderer.render(
      buildInput({
        tenant: buildTenant({
          legalIdentity: { legalAddress: "Calle Falsa 123, CABA" }
        })
      })
    );

    expect(textContains(lastDoc(), "Calle Falsa 123, CABA")).toBe(true);
  });

  it("omite líneas legales si los campos son undefined (no muestra 'undefined' ni vacíos)", () => {
    const renderer = new PdfKitLiquidationRenderer();
    renderer.render(buildInput({ tenant: buildTenant({ legalIdentity: {} }) }));

    const calls = textCalls(lastDoc());
    expect(calls.every((s) => !s.includes("undefined"))).toBe(true);
    expect(calls.every((s) => !s.includes("CUIT:"))).toBe(true);
    expect(calls.every((s) => !s.includes("Matrícula:"))).toBe(true);
    // Tampoco strings vacíos
    expect(calls.every((s) => s.trim().length > 0)).toBe(true);
  });

  it("usa commercialName del legalIdentity como override del top-level", () => {
    const renderer = new PdfKitLiquidationRenderer();
    renderer.render(
      buildInput({
        tenant: buildTenant({
          commercialName: "Top Level Name",
          legalIdentity: { commercialName: "Override Name" }
        })
      })
    );

    const doc = lastDoc();
    expect(textContains(doc, "Override Name")).toBe(true);
    expect(textContains(doc, "Top Level Name")).toBe(false);
  });

  it("documenta logoUrl como TODO sin cargar imagen (no llama a image())", () => {
    const renderer = new PdfKitLiquidationRenderer();
    renderer.render(
      buildInput({
        tenant: buildTenant({ logoUrl: "https://example.com/logo.png" })
      })
    );

    expect(lastDoc().image).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Bloque B — Datos del propietario
// ─────────────────────────────────────────────────────────────────────────────

describe("PdfKitLiquidationRenderer — Bloque B: datos del propietario", () => {
  it("renderiza displayName", () => {
    const renderer = new PdfKitLiquidationRenderer();
    renderer.render(buildInput({ owner: buildOwner({ displayName: "Carla Gómez" }) }));

    expect(textContains(lastDoc(), "Carla Gómez")).toBe(true);
  });

  it("renderiza email si está presente", () => {
    const renderer = new PdfKitLiquidationRenderer();
    renderer.render(
      buildInput({ owner: buildOwner({ email: "carla@example.com" }) })
    );

    expect(textContains(lastDoc(), "carla@example.com")).toBe(true);
  });

  it("renderiza phone si está presente", () => {
    const renderer = new PdfKitLiquidationRenderer();
    renderer.render(buildInput({ owner: buildOwner({ phone: "+54 9 11 1234-5678" }) }));

    expect(textContains(lastDoc(), "+54 9 11 1234-5678")).toBe(true);
  });

  it("renderiza taxId del owner si está presente", () => {
    const renderer = new PdfKitLiquidationRenderer();
    renderer.render(buildInput({ owner: buildOwner({ taxId: "20-12345678-3" }) }));

    expect(textContains(lastDoc(), "20-12345678-3")).toBe(true);
  });

  it("omite líneas si email/phone son null", () => {
    const renderer = new PdfKitLiquidationRenderer();
    renderer.render(
      buildInput({
        owner: buildOwner({ email: null, phone: null, taxId: null })
      })
    );

    const calls = textCalls(lastDoc());
    expect(calls.every((s) => !s.toLowerCase().includes("null"))).toBe(true);
    expect(calls.every((s) => !s.includes("Email:"))).toBe(true);
    expect(calls.every((s) => !s.includes("Teléfono:"))).toBe(true);
  });

  it("omite líneas si email/phone son undefined", () => {
    const renderer = new PdfKitLiquidationRenderer();
    renderer.render(buildInput({ owner: buildOwner() }));

    const calls = textCalls(lastDoc());
    expect(calls.every((s) => !s.includes("undefined"))).toBe(true);
    expect(calls.every((s) => !s.includes("Email:"))).toBe(true);
    expect(calls.every((s) => !s.includes("Teléfono:"))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Bloque C — Período y metadata
// ─────────────────────────────────────────────────────────────────────────────

describe("PdfKitLiquidationRenderer — Bloque C: período y metadata", () => {
  it("renderiza el liquidationId con formato 'Liquidación: {id}'", () => {
    const renderer = new PdfKitLiquidationRenderer();
    renderer.render(buildInput({ liquidationId: "liq-abc-001" }));

    expect(textContains(lastDoc(), "Liquidación: liq-abc-001")).toBe(true);
  });

  it("renderiza el período en formato 'Período: DD/MM/YYYY al DD/MM/YYYY'", () => {
    const renderer = new PdfKitLiquidationRenderer();
    renderer.render(
      buildInput({
        periodStart: new Date("2026-04-01T03:00:00.000Z"),
        periodEnd: new Date("2026-04-30T03:00:00.000Z")
      })
    );

    expect(textContains(lastDoc(), "Período: 01/04/2026 al 30/04/2026")).toBe(true);
  });

  it("renderiza moneda y estado", () => {
    const renderer = new PdfKitLiquidationRenderer();
    renderer.render(buildInput({ currency: "ARS", status: "PAID" }));

    const doc = lastDoc();
    expect(textContains(doc, "ARS")).toBe(true);
    expect(textContains(doc, "PAID")).toBe(true);
  });

  it("renderiza issuedAt como 'Emitida el DD/MM/YYYY' si está presente", () => {
    const renderer = new PdfKitLiquidationRenderer();
    renderer.render(
      buildInput({ issuedAt: new Date("2026-05-02T10:00:00.000Z") })
    );

    expect(textContains(lastDoc(), "Emitida el 02/05/2026")).toBe(true);
  });

  it("omite la línea 'Emitida el ...' si issuedAt es undefined", () => {
    const renderer = new PdfKitLiquidationRenderer();
    renderer.render(buildInput());

    const calls = textCalls(lastDoc());
    expect(calls.every((s) => !s.includes("Emitida el"))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Bloque D — Tabla de line items
// ─────────────────────────────────────────────────────────────────────────────

describe("PdfKitLiquidationRenderer — Bloque D: tabla de line items", () => {
  it("renderiza header de tabla en español", () => {
    const renderer = new PdfKitLiquidationRenderer();
    renderer.render(buildInput());

    const calls = textCalls(lastDoc()).join("\n");
    expect(calls).toContain("Propiedad");
    expect(calls).toContain("Fecha");
    expect(calls).toContain("Cobrado");
    expect(calls).toContain("Liquidable");
    // BPS aparece en el header (puede ser "BPS" o "Comisión (BPS)")
    expect(calls.includes("BPS") || calls.includes("bps")).toBe(true);
    expect(calls).toContain("Comisión");
    expect(calls).toContain("Neto");
  });

  it("renderiza propertyAddress de cada line item", () => {
    const renderer = new PdfKitLiquidationRenderer();
    renderer.render(
      buildInput({
        lineItems: [
          buildLineItem({ propertyAddress: "Av. Corrientes 1500" }),
          buildLineItem({ propertyAddress: "Defensa 500" })
        ]
      })
    );

    const doc = lastDoc();
    expect(textContains(doc, "Av. Corrientes 1500")).toBe(true);
    expect(textContains(doc, "Defensa 500")).toBe(true);
  });

  it("formatea paidAt de cada line item como DD/MM/YYYY", () => {
    const renderer = new PdfKitLiquidationRenderer();
    renderer.render(
      buildInput({
        lineItems: [
          buildLineItem({ paidAt: new Date("2026-04-15T12:00:00.000Z") })
        ]
      })
    );

    expect(textContains(lastDoc(), "15/04/2026")).toBe(true);
  });

  it("formatea montos con currency adelante y separadores es-AR", () => {
    const renderer = new PdfKitLiquidationRenderer();
    renderer.render(
      buildInput({
        currency: "ARS",
        lineItems: [
          buildLineItem({
            paidAmount: "100000.50",
            dueAmount: "100000.50",
            liquidableAmount: "100000.50",
            commissionAmount: "10000.05",
            netAmount: "90000.45"
          })
        ]
      })
    );

    const calls = textCalls(lastDoc()).join("\n");
    // separador de miles "." y decimales ",": 100.000,50
    expect(calls).toContain("ARS 100.000,50");
    expect(calls).toContain("ARS 10.000,05");
    expect(calls).toContain("ARS 90.000,45");
  });

  it("renderiza commissionBpsApplied como número entero", () => {
    const renderer = new PdfKitLiquidationRenderer();
    renderer.render(
      buildInput({
        lineItems: [buildLineItem({ commissionBpsApplied: 850 })]
      })
    );

    const calls = textCalls(lastDoc()).join("\n");
    expect(calls).toContain("850");
  });

  it("muestra 'Sin pagos para liquidar en el período.' si lineItems está vacío", () => {
    const renderer = new PdfKitLiquidationRenderer();
    renderer.render(buildInput({ lineItems: [] }));

    expect(textContains(lastDoc(), "Sin pagos para liquidar en el período.")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Bloque E — Adjustments
// ─────────────────────────────────────────────────────────────────────────────

describe("PdfKitLiquidationRenderer — Bloque E: ajustes manuales", () => {
  it("NO renderiza la sección 'Ajustes manuales' si adjustments está vacío", () => {
    const renderer = new PdfKitLiquidationRenderer();
    renderer.render(buildInput({ adjustments: [] }));

    const calls = textCalls(lastDoc());
    expect(calls.every((s) => !s.includes("Ajustes manuales"))).toBe(true);
  });

  it("muestra CREDIT con signo '+' y concept + amount en la misma línea", () => {
    const renderer = new PdfKitLiquidationRenderer();
    const adj: PdfAdjustment = { concept: "Reintegro gastos", amount: "5000.00", sign: "CREDIT" };
    renderer.render(buildInput({ adjustments: [adj] }));

    const calls = textCalls(lastDoc());
    expect(calls.some((s) => s.includes("Ajustes manuales"))).toBe(true);

    const adjLine = calls.find((s) => s.includes("Reintegro gastos"));
    expect(adjLine).toBeDefined();
    // En la misma línea: signo "+", concept y monto formateado.
    expect(adjLine!.startsWith("+") || adjLine!.includes("+ ")).toBe(true);
    expect(adjLine).toContain("Reintegro gastos");
    expect(adjLine).toContain("ARS 5.000,00");
  });

  it("muestra DEBIT con signo '-' y concept + amount en la misma línea", () => {
    const renderer = new PdfKitLiquidationRenderer();
    const adj: PdfAdjustment = { concept: "Multa retraso", amount: "1500.00", sign: "DEBIT" };
    renderer.render(buildInput({ adjustments: [adj] }));

    const calls = textCalls(lastDoc());
    const adjLine = calls.find((s) => s.includes("Multa retraso"));
    expect(adjLine).toBeDefined();
    expect(adjLine!.startsWith("-") || adjLine!.includes("- ")).toBe(true);
    expect(adjLine).toContain("Multa retraso");
    expect(adjLine).toContain("ARS 1.500,00");
  });

  it("renderiza múltiples ajustes mezclando CREDIT y DEBIT", () => {
    const renderer = new PdfKitLiquidationRenderer();
    renderer.render(
      buildInput({
        adjustments: [
          { concept: "Crédito A", amount: "1000.00", sign: "CREDIT" },
          { concept: "Débito B", amount: "500.00", sign: "DEBIT" }
        ]
      })
    );

    const calls = textCalls(lastDoc()).join("\n");
    expect(calls).toContain("Crédito A");
    expect(calls).toContain("Débito B");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Bloque F — Totales
// ─────────────────────────────────────────────────────────────────────────────

describe("PdfKitLiquidationRenderer — Bloque F: totales", () => {
  it("renderiza siempre Bruto, Comisión, Ajustes y Neto", () => {
    const renderer = new PdfKitLiquidationRenderer();
    renderer.render(
      buildInput({
        totals: {
          grossAmount: "200000.00",
          commissionAmount: "20000.00",
          adjustmentsTotal: "5000.00",
          netAmount: "185000.00"
        }
      })
    );

    const calls = textCalls(lastDoc()).join("\n");
    expect(calls).toContain("Bruto");
    expect(calls).toContain("Comisión");
    expect(calls).toContain("Ajustes");
    expect(calls).toContain("Neto");
  });

  it("formatea totales con currency adelante y separadores es-AR", () => {
    const renderer = new PdfKitLiquidationRenderer();
    renderer.render(
      buildInput({
        currency: "ARS",
        totals: {
          grossAmount: "200000.00",
          commissionAmount: "20000.00",
          adjustmentsTotal: "5000.00",
          netAmount: "185000.00"
        }
      })
    );

    const calls = textCalls(lastDoc()).join("\n");
    expect(calls).toContain("ARS 200.000,00");
    expect(calls).toContain("ARS 20.000,00");
    expect(calls).toContain("ARS 5.000,00");
    expect(calls).toContain("ARS 185.000,00");
  });

  it("Neto se enfatiza con font/fontSize distinto antes de imprimirlo", () => {
    const renderer = new PdfKitLiquidationRenderer();
    renderer.render(buildInput());

    const doc = lastDoc();
    // Hay varios "Neto" en el documento (header de tabla y totales). El último
    // corresponde al bloque de totales: pedimos que ANTES de esa última llamada
    // a text() haya habido al menos un cambio de font() o fontSize().
    const textOrders = doc.text.mock.invocationCallOrder;
    const lastNetoOrder = doc.text.mock.calls
      .map((call, idx) => ({ str: String(call[0] ?? ""), order: textOrders[idx]! }))
      .filter(({ str }) => str.includes("Neto"))
      .map(({ order }) => order)
      .pop();
    expect(lastNetoOrder).toBeDefined();

    const hadFontChange = doc.font.mock.invocationCallOrder.some((o) => o < lastNetoOrder!);
    const hadFontSizeChange = doc.fontSize.mock.invocationCallOrder.some(
      (o) => o < lastNetoOrder!
    );
    expect(hadFontChange || hadFontSizeChange).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Bloque G — Notes
// ─────────────────────────────────────────────────────────────────────────────

describe("PdfKitLiquidationRenderer — Bloque G: observaciones", () => {
  it("renderiza la sección 'Observaciones' si notes está presente", () => {
    const renderer = new PdfKitLiquidationRenderer();
    renderer.render(buildInput({ notes: "Saldo aplicado a próximo período." }));

    const calls = textCalls(lastDoc()).join("\n");
    expect(calls).toContain("Observaciones");
    expect(calls).toContain("Saldo aplicado a próximo período.");
  });

  it("omite la sección si notes es undefined", () => {
    const renderer = new PdfKitLiquidationRenderer();
    renderer.render(buildInput());

    const calls = textCalls(lastDoc());
    expect(calls.every((s) => !s.includes("Observaciones"))).toBe(true);
  });

  it("omite la sección si notes es vacío", () => {
    const renderer = new PdfKitLiquidationRenderer();
    renderer.render(buildInput({ notes: "" }));

    const calls = textCalls(lastDoc());
    expect(calls.every((s) => !s.includes("Observaciones"))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Bloque H — Cierre del documento
// ─────────────────────────────────────────────────────────────────────────────

describe("PdfKitLiquidationRenderer — Bloque H: cierre", () => {
  it("llama a end() exactamente una vez al final", () => {
    const renderer = new PdfKitLiquidationRenderer();
    renderer.render(buildInput());

    expect(lastDoc().end).toHaveBeenCalledTimes(1);
  });

  it("devuelve el documento (que actúa como Readable)", () => {
    const renderer = new PdfKitLiquidationRenderer();
    const stream = renderer.render(buildInput());

    expect(stream).toBe(lastDoc());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Bloque I — Idempotencia
// ─────────────────────────────────────────────────────────────────────────────

describe("PdfKitLiquidationRenderer — Bloque I: idempotencia", () => {
  it("dos llamadas a render producen dos PDFDocument independientes", () => {
    const renderer = new PdfKitLiquidationRenderer();
    const a = renderer.render(buildInput());
    const b = renderer.render(buildInput());

    expect(mockInstances.length).toBe(2);
    expect(a).not.toBe(b);
    expect(mockInstances[0]!.end).toHaveBeenCalledTimes(1);
    expect(mockInstances[1]!.end).toHaveBeenCalledTimes(1);
  });
});
