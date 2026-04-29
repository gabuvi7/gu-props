import PDFDocument from "pdfkit";
import type { Readable } from "stream";
import type { Currency, LiquidationAdjustmentSign } from "@gu-prop/database";

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export type LegalIdentity = {
  taxId?: string; // CUIT
  licenseNumber?: string; // matrícula
  legalAddress?: string;
  commercialName?: string; // override de TenantSettings.commercialName
};

export type PdfTenantHeader = {
  commercialName: string;
  logoUrl?: string; // MVP: no carga; ver TODO en renderHeader
  legalIdentity?: LegalIdentity;
};

export type PdfOwnerInfo = {
  displayName: string;
  email?: string | null;
  phone?: string | null;
  taxId?: string | null;
};

export type PdfLineItem = {
  propertyAddress: string;
  paidAt: Date;
  paidAmount: string; // ya formateado "100000.50"
  dueAmount: string;
  liquidableAmount: string;
  commissionBpsApplied: number;
  commissionAmount: string;
  netAmount: string;
};

export type PdfAdjustment = {
  concept: string;
  amount: string;
  sign: LiquidationAdjustmentSign; // CREDIT | DEBIT
};

export type PdfTotals = {
  grossAmount: string;
  commissionAmount: string;
  adjustmentsTotal: string;
  netAmount: string;
};

export type RenderLiquidationInput = {
  tenant: PdfTenantHeader;
  owner: PdfOwnerInfo;
  liquidationId: string;
  status: "ISSUED" | "PAID"; // REQ-012: solo emitidas o pagadas
  periodStart: Date;
  periodEnd: Date;
  currency: Currency;
  lineItems: PdfLineItem[];
  adjustments: PdfAdjustment[];
  totals: PdfTotals;
  notes?: string;
  issuedAt?: Date;
};

export interface PdfRenderer {
  render(input: RenderLiquidationInput): Readable;
}

/**
 * Token de inyección Nest para registrar la implementación concreta de
 * `PdfRenderer`. `PdfRenderer` es una interface y por ende no existe en
 * runtime: necesitamos un token explícito para que el contenedor DI resuelva
 * la dependencia. El `LiquidationsService` consume con
 * `@Inject(PDF_RENDERER) pdfRenderer: PdfRenderer` y el `LiquidationsModule`
 * provee con `{ provide: PDF_RENDERER, useFactory: () => new PdfKitLiquidationRenderer() }`.
 */
export const PDF_RENDERER = Symbol("PDF_RENDERER");

// ─────────────────────────────────────────────────────────────────────────────
// Implementación con pdfkit
//
// Decisiones:
// - El documento de pdfkit ES un Readable (extiende stream.Readable). Lo devolvemos directo.
// - Layout simple: textos secuenciales con moveDown() entre secciones. Sin grid de tablas.
// - Idioma: español rioplatense.
// - Currency va antepuesto al monto: "ARS 100.000,50" (separadores es-AR).
// - Cualquier campo opcional ausente se omite (no imprime "undefined" ni "null" ni vacíos).
// ─────────────────────────────────────────────────────────────────────────────

type PdfDoc = PDFKit.PDFDocument;

export class PdfKitLiquidationRenderer implements PdfRenderer {
  private static readonly TITLE_SIZE = 16;
  private static readonly SECTION_SIZE = 12;
  private static readonly BODY_SIZE = 10;
  private static readonly NET_SIZE = 14; // énfasis del Neto en totales

  render(input: RenderLiquidationInput): Readable {
    const doc = new PDFDocument({ size: "A4", margin: 50 });

    this.renderHeader(doc, input.tenant);
    this.renderOwnerInfo(doc, input.owner);
    this.renderMetadata(doc, input);
    this.renderLineItems(doc, input.lineItems, input.currency);
    this.renderAdjustments(doc, input.adjustments, input.currency);
    this.renderTotals(doc, input.totals, input.currency);
    if (input.notes && input.notes.trim().length > 0) {
      this.renderNotes(doc, input.notes);
    }

    doc.end();
    return doc as unknown as Readable;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Secciones
  // ───────────────────────────────────────────────────────────────────────────

  private renderHeader(doc: PdfDoc, tenant: PdfTenantHeader): void {
    // TODO(batch-future): cargar logo desde DocumentStorage si tenant.logoUrl está presente.
    // Para el MVP no se renderiza imagen.

    const commercialName =
      tenant.legalIdentity?.commercialName ?? tenant.commercialName;

    doc.font("Helvetica-Bold").fontSize(PdfKitLiquidationRenderer.TITLE_SIZE);
    doc.text(commercialName);

    doc.font("Helvetica").fontSize(PdfKitLiquidationRenderer.BODY_SIZE);

    const taxId = tenant.legalIdentity?.taxId;
    if (taxId) {
      doc.text(`CUIT: ${taxId}`);
    }

    const licenseNumber = tenant.legalIdentity?.licenseNumber;
    if (licenseNumber) {
      doc.text(`Matrícula: ${licenseNumber}`);
    }

    const legalAddress = tenant.legalIdentity?.legalAddress;
    if (legalAddress) {
      doc.text(legalAddress);
    }

    doc.moveDown();
  }

  private renderOwnerInfo(doc: PdfDoc, owner: PdfOwnerInfo): void {
    doc.font("Helvetica-Bold").fontSize(PdfKitLiquidationRenderer.SECTION_SIZE);
    doc.text("Propietario");

    doc.font("Helvetica").fontSize(PdfKitLiquidationRenderer.BODY_SIZE);
    doc.text(owner.displayName);

    if (owner.email) {
      doc.text(`Email: ${owner.email}`);
    }
    if (owner.phone) {
      doc.text(`Teléfono: ${owner.phone}`);
    }
    if (owner.taxId) {
      doc.text(`CUIT: ${owner.taxId}`);
    }

    doc.moveDown();
  }

  private renderMetadata(doc: PdfDoc, input: RenderLiquidationInput): void {
    doc.font("Helvetica").fontSize(PdfKitLiquidationRenderer.BODY_SIZE);

    doc.text(`Liquidación: ${input.liquidationId}`);
    doc.text(
      `Período: ${this.formatDate(input.periodStart)} al ${this.formatDate(input.periodEnd)}`
    );
    doc.text(`Moneda: ${input.currency}`);
    doc.text(`Estado: ${input.status}`);
    if (input.issuedAt) {
      doc.text(`Emitida el ${this.formatDate(input.issuedAt)}`);
    }

    doc.moveDown();
  }

  private renderLineItems(
    doc: PdfDoc,
    lineItems: PdfLineItem[],
    currency: Currency
  ): void {
    doc.font("Helvetica-Bold").fontSize(PdfKitLiquidationRenderer.SECTION_SIZE);
    doc.text("Detalle de pagos");

    doc.font("Helvetica-Bold").fontSize(PdfKitLiquidationRenderer.BODY_SIZE);
    doc.text(
      "Propiedad  |  Fecha  |  Cobrado  |  Liquidable  |  BPS  |  Comisión  |  Neto"
    );

    doc.font("Helvetica").fontSize(PdfKitLiquidationRenderer.BODY_SIZE);

    if (lineItems.length === 0) {
      doc.text("Sin pagos para liquidar en el período.");
      doc.moveDown();
      return;
    }

    for (const item of lineItems) {
      const parts = [
        item.propertyAddress,
        this.formatDate(item.paidAt),
        this.formatCurrency(item.paidAmount, currency),
        this.formatCurrency(item.liquidableAmount, currency),
        String(item.commissionBpsApplied),
        this.formatCurrency(item.commissionAmount, currency),
        this.formatCurrency(item.netAmount, currency)
      ];
      doc.text(parts.join("  |  "));
    }

    doc.moveDown();
  }

  private renderAdjustments(
    doc: PdfDoc,
    adjustments: PdfAdjustment[],
    currency: Currency
  ): void {
    if (adjustments.length === 0) {
      return;
    }

    doc.font("Helvetica-Bold").fontSize(PdfKitLiquidationRenderer.SECTION_SIZE);
    doc.text("Ajustes manuales");

    doc.font("Helvetica").fontSize(PdfKitLiquidationRenderer.BODY_SIZE);
    for (const adj of adjustments) {
      const sign = adj.sign === "CREDIT" ? "+" : "-";
      doc.text(
        `${sign} ${adj.concept}  ${this.formatCurrency(adj.amount, currency)}`
      );
    }

    doc.moveDown();
  }

  private renderTotals(doc: PdfDoc, totals: PdfTotals, currency: Currency): void {
    doc.font("Helvetica-Bold").fontSize(PdfKitLiquidationRenderer.SECTION_SIZE);
    doc.text("Totales");

    doc.font("Helvetica").fontSize(PdfKitLiquidationRenderer.BODY_SIZE);
    doc.text(`Bruto: ${this.formatCurrency(totals.grossAmount, currency)}`);
    doc.text(`Comisión: ${this.formatCurrency(totals.commissionAmount, currency)}`);
    doc.text(`Ajustes: ${this.formatCurrency(totals.adjustmentsTotal, currency)}`);

    // Énfasis del Neto: cambio explícito de font + fontSize antes de imprimir.
    doc.font("Helvetica-Bold").fontSize(PdfKitLiquidationRenderer.NET_SIZE);
    doc.text(`Neto: ${this.formatCurrency(totals.netAmount, currency)}`);

    doc.moveDown();
  }

  private renderNotes(doc: PdfDoc, notes: string): void {
    doc.font("Helvetica-Bold").fontSize(PdfKitLiquidationRenderer.SECTION_SIZE);
    doc.text("Observaciones");

    doc.font("Helvetica").fontSize(PdfKitLiquidationRenderer.BODY_SIZE);
    doc.text(notes);

    doc.moveDown();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Helpers privados
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Formatea un monto decimal-string como "ARS 100.000,50" usando Intl es-AR.
   *
   * - Asume `amount` válido (validado upstream por el calculator/service).
   * - Currency va antepuesto manualmente para no depender del símbolo localizado
   *   de Intl, que para currencies como USD podría ambigüedad ($) en es-AR.
   */
  private formatCurrency(amount: string, currency: Currency): string {
    const num = Number(amount);
    if (!Number.isFinite(num)) {
      // Defensive: si llegara un string inválido, no rompemos el PDF.
      return `${currency} ${amount}`;
    }
    const formatted = new Intl.NumberFormat("es-AR", {
      style: "decimal",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
    return `${currency} ${formatted}`;
  }

  /** Formatea una fecha como DD/MM/YYYY en locale es-AR. */
  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "America/Argentina/Buenos_Aires"
    }).format(date);
  }
}
