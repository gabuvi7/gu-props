import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { Readable } from "node:stream";
import type {
  Currency,
  Liquidation,
  LiquidationLineItem,
  LiquidationManualAdjustment,
  LiquidationStatus,
  Prisma
} from "@gu-prop/database";
import { PrismaService } from "../../common/prisma";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { fromCents, toCents } from "../../common/money/decimal-cents";
import { DOCUMENT_STORAGE, type DocumentStorage } from "../../common/storage/document-storage.interface";
import {
  type CalculatedLineItem,
  type CalculatorAdjustment,
  type CalculatorPayment,
  type CalculatorPropertyCommission,
  type CalculatorResult,
  LiquidationCalculator
} from "./calculation/liquidation-calculator";
import { PDF_RENDERER, type PdfRenderer, type RenderLiquidationInput, type LegalIdentity } from "./pdf/pdf-renderer";
import { LiquidationStateMachine } from "./state-machine/liquidation-state-machine";
import type {
  AddManualAdjustmentDto,
  ChangeLiquidationStatusDto,
  CreateLiquidationDto,
  ListLiquidationsQueryDto,
  ManualAdjustmentInputDto,
  PreviewLiquidationDto,
  UpdateLiquidationDraftDto
} from "./liquidations.dto";

const DUPLICATE_ACTIVE_MESSAGE = "Ya existe una liquidación activa para este propietario, período y moneda.";
const ACTIVE_STATUSES: ReadonlyArray<LiquidationStatus> = ["DRAFT", "ISSUED", "PAID"];
const EXCLUDED_PAYMENT_STATUSES = ["VOIDED", "PENDING"] as const;

export type LiquidationRecord = Liquidation;
export type LiquidationWithRelations = Liquidation & {
  lineItems: LiquidationLineItem[];
  manualAdjustments: LiquidationManualAdjustment[];
};

type PaymentWithContract = {
  id: string;
  contractId: string;
  paidAt: Date | null;
  paidAmount: Prisma.Decimal | string | number;
  dueAmount: Prisma.Decimal | string | number;
  currency: Currency;
  status: "PAID" | "PARTIAL" | "OVERPAID" | "VOIDED" | "PENDING";
  contract: { id: string; propertyId: string; ownerId: string };
};

type PropertyForCommission = {
  id: string;
  commissionBps: number | null;
  addressLine: string;
};

type CalculatorInputs = {
  payments: PaymentWithContract[];
  properties: PropertyForCommission[];
  defaultCommissionBps: number;
};

@Injectable()
export class LiquidationsService {
  private readonly logger = new Logger(LiquidationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly contextService: RequestContextService,
    private readonly calculator: LiquidationCalculator,
    private readonly stateMachine: LiquidationStateMachine,
    @Inject(PDF_RENDERER) private readonly pdfRenderer: PdfRenderer,
    @Inject(DOCUMENT_STORAGE) private readonly storage: DocumentStorage
  ) {}

  // ─── Public API ────────────────────────────────────────────────────────────

  async previewLiquidation(input: PreviewLiquidationDto): Promise<CalculatorResult> {
    const { tenantId } = this.contextService.get();
    await this.assertOwnerBelongsToTenant(input.ownerId, tenantId);

    const periodStart = new Date(input.periodStart);
    const periodEnd = new Date(input.periodEnd);

    const calculatorInputs = await this.loadCalculatorInputs({
      tenantId,
      ownerId: input.ownerId,
      currency: input.currency,
      periodStart,
      periodEnd
    });

    return this.calculator.calculate({
      payments: calculatorInputs.payments.map((p) => toCalculatorPayment(p, calculatorInputs.properties)),
      propertyCommissions: calculatorInputs.properties.map(toCalculatorPropertyCommission),
      defaultCommissionBps: calculatorInputs.defaultCommissionBps,
      currency: input.currency,
      periodStart,
      periodEnd
    });
  }

  async createLiquidation(input: CreateLiquidationDto): Promise<LiquidationRecord> {
    const { tenantId, userId } = this.contextService.get();
    await this.assertOwnerBelongsToTenant(input.ownerId, tenantId);

    const periodStart = new Date(input.periodStart);
    const periodEnd = new Date(input.periodEnd);

    const calculatorInputs = await this.loadCalculatorInputs({
      tenantId,
      ownerId: input.ownerId,
      currency: input.currency,
      periodStart,
      periodEnd
    });

    const adjustments: CalculatorAdjustment[] = (input.manualAdjustments ?? []).map((adj) => ({
      concept: adj.concept,
      amount: adj.amount,
      sign: adj.sign
    }));

    const calculation = this.calculator.calculate({
      payments: calculatorInputs.payments.map((p) => toCalculatorPayment(p, calculatorInputs.properties)),
      propertyCommissions: calculatorInputs.properties.map(toCalculatorPropertyCommission),
      defaultCommissionBps: calculatorInputs.defaultCommissionBps,
      adjustments,
      currency: input.currency,
      periodStart,
      periodEnd
    });

    // Pre-check de duplicado activo (REQ-006). El unique en DB es backstop para race conditions.
    const existingActive = await this.prisma.liquidation.findFirst({
      where: {
        tenantId,
        ownerId: input.ownerId,
        periodStart,
        periodEnd,
        currency: input.currency,
        status: { in: ["DRAFT", "ISSUED", "PAID"] }
      }
    });

    if (existingActive) {
      throw new ConflictException(DUPLICATE_ACTIVE_MESSAGE);
    }

    const createdById = userId ?? null;
    const adjustmentInputs = input.manualAdjustments ?? [];

    try {
      return await this.prisma.$transaction(async (tx) => {
        const liquidation = await tx.liquidation.create({
          data: {
            tenantId,
            ownerId: input.ownerId,
            status: "DRAFT",
            periodStart,
            periodEnd,
            currency: input.currency,
            grossAmount: calculation.totals.grossAmount,
            commissionAmount: calculation.totals.commissionAmount,
            netAmount: calculation.totals.netAmount,
            ...(input.notes !== undefined ? { notes: input.notes } : {}),
            createdById
          }
        });

        if (calculation.lineItems.length > 0) {
          await tx.liquidationLineItem.createMany({
            data: calculation.lineItems.map((item) => toLineItemCreateData(item, liquidation.id, tenantId))
          });
        }

        if (adjustmentInputs.length > 0) {
          await tx.liquidationManualAdjustment.createMany({
            data: adjustmentInputs.map((adj) => toManualAdjustmentCreateData(adj, liquidation.id, tenantId, createdById))
          });
        }

        return liquidation;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException(DUPLICATE_ACTIVE_MESSAGE);
      }

      if (error instanceof BadRequestException || error instanceof ConflictException || error instanceof NotFoundException) {
        throw error;
      }

      throw new BadRequestException("No pudimos crear la liquidación. Revisá los datos enviados.");
    }
  }

  async getLiquidationById(id: string): Promise<LiquidationWithRelations> {
    const { tenantId } = this.contextService.get();

    const liquidation = await this.prisma.liquidation.findUnique({
      where: { id_tenantId: { id, tenantId } },
      include: { lineItems: true, manualAdjustments: true }
    });

    if (!liquidation) {
      throw new NotFoundException("No encontramos la liquidación solicitada.");
    }

    return liquidation as LiquidationWithRelations;
  }

  async listLiquidations(query: ListLiquidationsQueryDto): Promise<LiquidationRecord[]> {
    const { tenantId } = this.contextService.get();

    // Solapamiento inclusive: una liquidación entra si su periodEnd >= queryStart
    // y su periodStart <= queryEnd. Si solo viene un extremo, se aplica solo esa cota.
    const periodFilters: { periodEnd?: { gte: Date }; periodStart?: { lte: Date } } = {};
    if (query.periodStart) {
      periodFilters.periodEnd = { gte: new Date(query.periodStart) };
    }
    if (query.periodEnd) {
      periodFilters.periodStart = { lte: new Date(query.periodEnd) };
    }

    // TODO(batch-future): paginar (limit/cursor) cuando el listado supere ~100 items.
    return this.prisma.liquidation.findMany({
      where: {
        tenantId,
        ...(query.ownerId !== undefined ? { ownerId: query.ownerId } : {}),
        ...(query.status !== undefined ? { status: query.status } : {}),
        ...(query.currency !== undefined ? { currency: query.currency } : {}),
        ...periodFilters
      },
      orderBy: [{ periodEnd: "desc" }, { createdAt: "desc" }]
    });
  }

  /**
   * Actualiza campos editables (sólo `notes` en MVP) cuando la liquidación está
   * en estado DRAFT. REQ-007: bloqueo si ya fue emitida o pagada.
   */
  async updateDraft(id: string, input: UpdateLiquidationDraftDto): Promise<LiquidationWithRelations> {
    const { tenantId } = this.contextService.get();
    const liquidation = await this.loadLiquidationOrThrow(id, tenantId);
    this.assertDraft(liquidation);

    // Si no vino ningún campo, no tocamos DB. Devolvemos el snapshot actual.
    if (input.notes === undefined) {
      return liquidation;
    }

    const updated = await this.prisma.liquidation.update({
      where: { id_tenantId: { id, tenantId } },
      data: { notes: input.notes },
      include: { lineItems: true, manualAdjustments: true }
    });
    return updated as LiquidationWithRelations;
  }

  /**
   * Cambia el estado de una liquidación validando con la state machine.
   *
   * - DRAFT → ISSUED: genera PDF, lo guarda en storage, crea Document y marca issuedAt.
   * - ISSUED → PAID: crea CashMovement OWNER_PAYOUT en la misma transaction.
   * - DRAFT|ISSUED → VOIDED: marca voidedAt + voidReason. NO revierte CashMovement (REQ-009).
   *
   * Idempotencia (REQ-008): un segundo target=PAID sobre una liquidación ya PAID
   * es noop, devuelve la entidad tal cual sin tocar DB ni crear movement.
   */
  async changeStatus(id: string, input: ChangeLiquidationStatusDto): Promise<LiquidationWithRelations> {
    const { tenantId, userId } = this.contextService.get();
    const liquidation = await this.loadLiquidationOrThrow(id, tenantId);

    // REQ-008 — short-circuit idempotente: PAID → PAID es noop. La state machine
    // de otro modo lo rechazaría con INVALID_TRANSITION, pero el spec pide noop.
    if (liquidation.status === input.status && liquidation.status === "PAID") {
      return liquidation;
    }

    // Mapeo HTTP → state machine: el contrato externo (REQ-005) usa `voidReason`,
    // pero la API interna del state machine sigue con `reason` por simplicidad.
    const validation = this.stateMachine.validate({
      from: liquidation.status,
      to: input.status,
      reason: input.voidReason
    });
    if (!validation.ok) {
      throw new BadRequestException(validation.message);
    }

    switch (input.status) {
      case "ISSUED":
        return this.transitionToIssued(liquidation, tenantId, userId ?? null);
      case "PAID":
        return this.transitionToPaid(liquidation, tenantId, userId ?? null);
      case "VOIDED":
        // El validator ya garantizó voidReason no-vacío.
        return this.transitionToVoided(liquidation, tenantId, input.voidReason as string);
      case "DRAFT":
      default:
        // El validator ya rechaza DRAFT como destino, pero el switch debe ser exhaustivo.
        throw new BadRequestException("La transición de estado no es válida.");
    }
  }

  /**
   * Agrega un ajuste manual sobre una liquidación DRAFT y recalcula `netAmount`.
   * REQ-003.
   */
  async addManualAdjustment(
    liquidationId: string,
    input: AddManualAdjustmentDto
  ): Promise<LiquidationWithRelations> {
    const { tenantId, userId } = this.contextService.get();
    const liquidation = await this.loadLiquidationOrThrow(liquidationId, tenantId);
    this.assertDraftForAdjustment(liquidation);

    const newAdjustments = [
      ...liquidation.manualAdjustments.map((adj) => ({ amount: toDecimalString(adj.amount), sign: adj.sign })),
      { amount: input.amount, sign: input.sign }
    ];
    const newNetAmount = recalculateNetAmount(
      toDecimalString(liquidation.grossAmount),
      toDecimalString(liquidation.commissionAmount),
      newAdjustments
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.liquidationManualAdjustment.create({
        data: {
          tenantId,
          liquidationId,
          concept: input.concept,
          amount: input.amount,
          sign: input.sign,
          createdById: userId ?? null
        }
      });
      await tx.liquidation.update({
        where: { id_tenantId: { id: liquidationId, tenantId } },
        data: { netAmount: newNetAmount }
      });
    });

    return this.loadLiquidationOrThrow(liquidationId, tenantId);
  }

  /**
   * Borra un ajuste manual de una liquidación DRAFT y recalcula `netAmount`.
   * REQ-003.
   */
  async removeManualAdjustment(
    liquidationId: string,
    adjustmentId: string
  ): Promise<LiquidationWithRelations> {
    const { tenantId } = this.contextService.get();
    const liquidation = await this.loadLiquidationOrThrow(liquidationId, tenantId);
    this.assertDraftForAdjustment(liquidation);

    const target = liquidation.manualAdjustments.find((adj) => adj.id === adjustmentId);
    if (!target) {
      throw new NotFoundException("No encontramos el ajuste solicitado.");
    }

    const remainingAdjustments = liquidation.manualAdjustments
      .filter((adj) => adj.id !== adjustmentId)
      .map((adj) => ({ amount: toDecimalString(adj.amount), sign: adj.sign }));
    const newNetAmount = recalculateNetAmount(
      toDecimalString(liquidation.grossAmount),
      toDecimalString(liquidation.commissionAmount),
      remainingAdjustments
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.liquidationManualAdjustment.delete({
        where: { id_tenantId: { id: adjustmentId, tenantId } }
      });
      await tx.liquidation.update({
        where: { id_tenantId: { id: liquidationId, tenantId } },
        data: { netAmount: newNetAmount }
      });
    });

    return this.loadLiquidationOrThrow(liquidationId, tenantId);
  }

  /**
   * Devuelve el stream del PDF de una liquidación ISSUED o PAID. Self-healing:
   * si el Document existe pero el archivo no, regenera. Si no existe Document
   * (caso raro tras una emisión truncada), también regenera y crea Document.
   * REQ-010, REQ-012.
   */
  async getOrGeneratePdf(
    id: string
  ): Promise<{ stream: Readable; filename: string; mimeType: string }> {
    const { tenantId, userId } = this.contextService.get();
    const liquidation = await this.loadLiquidationOrThrow(id, tenantId);

    if (liquidation.status === "DRAFT") {
      throw new BadRequestException("La liquidación todavía no está emitida.");
    }
    if (liquidation.status === "VOIDED") {
      throw new BadRequestException("La liquidación fue anulada.");
    }

    const existingDoc = await this.prisma.document.findFirst({
      where: {
        tenantId,
        entityType: "Liquidation",
        entityId: id,
        type: "LIQUIDATION"
      }
    });

    if (existingDoc) {
      const fileExists = await this.storage.exists(existingDoc.storageKey);
      if (fileExists) {
        const stream = await this.storage.read(existingDoc.storageKey);
        return {
          stream,
          filename: existingDoc.fileName,
          mimeType: existingDoc.mimeType
        };
      }
    }

    // Regeneración on-demand: misma orquestación que `transitionToIssued` pero
    // sin actualizar status. Si existe Document, reusamos `existingDoc.storageKey`
    // y `existingDoc.fileName` para no dejar huérfanos por desalineamiento entre
    // la key computada y la persistida (REQ-012, self-healing).
    const computed = this.computePdfLocation(tenantId, id);
    const storageKey = existingDoc?.storageKey ?? computed.storageKey;
    const fileName = existingDoc?.fileName ?? computed.fileName;
    const renderInput = await this.buildPdfInput(liquidation, tenantId);
    const pdfStream = this.pdfRenderer.render(renderInput);
    await this.storage.save(storageKey, pdfStream);

    if (!existingDoc) {
      // NOTE(deuda-tecnica): si dos requests piden PDF en simultáneo y ninguno
      // tiene Document, ambos podrían crear filas distintas. Aceptable para MVP
      // — el unique en `(tenantId, storageKey)` provoca P2002 en uno de ellos
      // y se ignora; el cliente recibe igual el PDF generado.
      try {
        await this.prisma.document.create({
          data: {
            tenantId,
            type: "LIQUIDATION",
            entityType: "Liquidation",
            entityId: id,
            fileName,
            mimeType: "application/pdf",
            storageKey,
            createdById: userId ?? null
          }
        });
      } catch (error) {
        if (!isUniqueConstraintError(error)) {
          throw error;
        }
        // Race con otro request concurrente; el archivo ya está bien guardado.
      }
    }

    const stream = await this.storage.read(storageKey);
    return { stream, filename: fileName, mimeType: "application/pdf" };
  }

  // ─── Helpers privados ──────────────────────────────────────────────────────

  /**
   * Carga la liquidación con sus relaciones o lanza NotFound. Reusable entre
   * updateDraft, changeStatus, addManualAdjustment, removeManualAdjustment y
   * getOrGeneratePdf.
   */
  private async loadLiquidationOrThrow(
    id: string,
    tenantId: string
  ): Promise<LiquidationWithRelations> {
    const liquidation = await this.prisma.liquidation.findUnique({
      where: { id_tenantId: { id, tenantId } },
      include: { lineItems: true, manualAdjustments: true }
    });
    if (!liquidation) {
      throw new NotFoundException("No encontramos la liquidación solicitada.");
    }
    return liquidation as LiquidationWithRelations;
  }

  /** REQ-007: bloquea updates a liquidaciones que ya salieron de DRAFT. */
  private assertDraft(liquidation: LiquidationWithRelations): void {
    if (liquidation.status !== "DRAFT") {
      throw new BadRequestException("No se puede modificar una liquidación que ya fue emitida.");
    }
  }

  /** REQ-003: bloquea ajustes a liquidaciones que no están en DRAFT. */
  private assertDraftForAdjustment(liquidation: LiquidationWithRelations): void {
    if (liquidation.status !== "DRAFT") {
      throw new BadRequestException(
        "La liquidación debe estar en estado borrador para editar ajustes."
      );
    }
  }

  /**
   * DRAFT → ISSUED. Genera PDF, lo guarda en storage, crea Document y actualiza
   * status + issuedAt. Si la generación falla, no se toca DB. Si la tx de DB
   * falla tras subir el archivo, hace cleanup best-effort del storage.
   * REQ-010.
   *
   * Concurrencia: el `updateMany` con `status: "DRAFT"` garantiza que sólo UN
   * request gane la carrera. Si `count === 0`:
   *   - si la liquidación ya quedó ISSUED y existe Document → idempotente,
   *     devolvemos la liquidación SIN borrar el archivo (es del ganador).
   *   - si quedó otro status → BadRequest y cleanup del archivo (no es del ganador).
   */
  private async transitionToIssued(
    liquidation: LiquidationWithRelations,
    tenantId: string,
    userId: string | null
  ): Promise<LiquidationWithRelations> {
    const { storageKey, fileName } = this.computePdfLocation(tenantId, liquidation.id);
    const renderInput = await this.buildPdfInput(liquidation, tenantId);
    const pdfStream = this.pdfRenderer.render(renderInput);

    // Si el storage falla acá, propagamos sin tocar DB. La liquidación queda DRAFT.
    await this.storage.save(storageKey, pdfStream);

    let raceLostKeepFile = false;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const result = await tx.liquidation.updateMany({
          where: { id: liquidation.id, tenantId, status: "DRAFT" },
          data: { status: "ISSUED", issuedAt: new Date() }
        });

        if (result.count === 0) {
          // Carrera perdida. Vemos si el ganador ya emitió correctamente.
          const reloaded = await tx.liquidation.findUnique({
            where: { id_tenantId: { id: liquidation.id, tenantId } },
            include: { lineItems: true, manualAdjustments: true }
          });
          const existingDoc = await tx.document.findFirst({
            where: { tenantId, entityType: "Liquidation", entityId: liquidation.id, type: "LIQUIDATION" }
          });

          if (reloaded && reloaded.status === "ISSUED" && existingDoc) {
            // El ganador ya creó el Document; nuestro archivo NO se borra para
            // no romper el del winner (puede compartir storageKey).
            raceLostKeepFile = true;
            this.logger.warn(
              `[liquidations] Race detectada en transición a ISSUED, archivo conservado por el ganador tenantId=${tenantId} liquidationId=${liquidation.id}`
            );
            return reloaded as LiquidationWithRelations;
          }
          // Status inesperado: somos los únicos con ese archivo, hay que limpiar.
          throw new BadRequestException("La liquidación ya no se puede emitir.");
        }

        await tx.document.create({
          data: {
            tenantId,
            type: "LIQUIDATION",
            entityType: "Liquidation",
            entityId: liquidation.id,
            fileName,
            mimeType: "application/pdf",
            storageKey,
            createdById: userId
          }
        });

        const updated = await tx.liquidation.findUnique({
          where: { id_tenantId: { id: liquidation.id, tenantId } },
          include: { lineItems: true, manualAdjustments: true }
        });
        return updated as LiquidationWithRelations;
      });
    } catch (error) {
      if (raceLostKeepFile) {
        // Defensivo: si raceLostKeepFile=true y aún así escapamos por error post-return,
        // no borramos el archivo. En la práctica este branch no se alcanza porque el
        // return termina la tx sin throw, pero queda como guard explícito.
        throw error;
      }
      // Cleanup best-effort. Si el delete del storage también falla, loggeamos
      // un warning estructurado para limpieza manual posterior.
      await this.storage.delete(storageKey).catch((cleanupError: unknown) => {
        this.logger.warn(
          `[liquidations] storage cleanup failed after tx error tenantId=${tenantId} storageKey=${storageKey} cleanupError=${String(cleanupError)}`
        );
      });
      throw error;
    }
  }

  /**
   * ISSUED → PAID. Update condicional + crea CashMovement OWNER_PAYOUT en la misma tx.
   * REQ-008.
   *
   * Concurrencia: el `updateMany` con `status: "ISSUED"` en el WHERE garantiza que
   * sólo UN request gane la carrera. Si `count === 0`, recargamos:
   *   - si quedó `PAID` → idempotente, return sin crear CashMovement.
   *   - si quedó otro status → BadRequest (alguien la anuló entre medio).
   * Esto evita duplicar OWNER_PAYOUT si dos requests leen `ISSUED` en simultáneo.
   */
  private async transitionToPaid(
    liquidation: LiquidationWithRelations,
    tenantId: string,
    userId: string | null
  ): Promise<LiquidationWithRelations> {
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const result = await tx.liquidation.updateMany({
        where: { id: liquidation.id, tenantId, status: "ISSUED" },
        data: { status: "PAID", paidAt: now }
      });

      if (result.count === 0) {
        // Carrera: alguien más cambió el status. Recargamos para decidir.
        const reloaded = await tx.liquidation.findUnique({
          where: { id_tenantId: { id: liquidation.id, tenantId } },
          include: { lineItems: true, manualAdjustments: true }
        });
        if (reloaded && reloaded.status === "PAID") {
          // Idempotente: el ganador ya creó el CashMovement, no creamos uno nuevo.
          return reloaded as LiquidationWithRelations;
        }
        throw new BadRequestException("La liquidación ya no se puede marcar como pagada.");
      }

      // Sólo el ganador (count === 1) crea el CashMovement.
      await tx.cashMovement.create({
        data: {
          tenantId,
          type: "OWNER_PAYOUT",
          amount: toDecimalString(liquidation.netAmount),
          currency: liquidation.currency,
          paymentId: null,
          sourceType: "LIQUIDATION",
          sourceId: liquidation.id,
          occurredAt: now,
          createdById: userId,
          reason: `Pago a propietario por liquidación ${liquidation.id}`
        }
      });

      const updated = await tx.liquidation.findUnique({
        where: { id_tenantId: { id: liquidation.id, tenantId } },
        include: { lineItems: true, manualAdjustments: true }
      });
      return updated as LiquidationWithRelations;
    });
  }

  /**
   * DRAFT|ISSUED → VOIDED. Marca voidedAt + voidReason. NO revierte CashMovement
   * (REQ-009: deuda técnica).
   */
  private async transitionToVoided(
    liquidation: LiquidationWithRelations,
    tenantId: string,
    voidReason: string
  ): Promise<LiquidationWithRelations> {
    const updated = await this.prisma.liquidation.update({
      where: { id_tenantId: { id: liquidation.id, tenantId } },
      data: { status: "VOIDED", voidedAt: new Date(), voidReason },
      include: { lineItems: true, manualAdjustments: true }
    });
    return updated as LiquidationWithRelations;
  }

  /**
   * Convención de keys: `{tenantId}/liquidations/{liquidationId}/liquidacion-{id}.pdf`.
   * Decisión: NO incluir período/owner-slug en el filename. El path ya scopea
   * todo, y `liquidacion-{id}.pdf` es estable, único y previsible (no requiere
   * slugify ni invalidación si cambia metadata).
   */
  private computePdfLocation(tenantId: string, liquidationId: string): {
    storageKey: string;
    fileName: string;
  } {
    const fileName = `liquidacion-${liquidationId}.pdf`;
    const storageKey = `${tenantId}/liquidations/${liquidationId}/${fileName}`;
    return { storageKey, fileName };
  }

  /**
   * Carga tenant + tenantSettings + owner y arma el input del renderer. Reusable
   * entre `transitionToIssued` y `getOrGeneratePdf`.
   */
  private async buildPdfInput(
    liquidation: LiquidationWithRelations,
    tenantId: string
  ): Promise<RenderLiquidationInput> {
    const [tenant, settings, owner] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { id: tenantId } }),
      this.prisma.tenantSettings.findUnique({ where: { tenantId } }),
      this.prisma.owner.findUnique({
        where: { id_tenantId: { id: liquidation.ownerId, tenantId } }
      })
    ]);

    const commercialName = settings?.commercialName ?? tenant?.name ?? "";
    const legalIdentity = parseLegalIdentity(settings?.legalIdentity ?? null);

    // El renderer sólo acepta status ISSUED|PAID. Si por algún motivo nos
    // llega DRAFT/VOIDED acá, el caller ya lo filtró (transitionToIssued
    // viene desde DRAFT y el target es ISSUED; getOrGeneratePdf rechaza
    // DRAFT/VOIDED upstream).
    const renderStatus: "ISSUED" | "PAID" =
      liquidation.status === "PAID" ? "PAID" : "ISSUED";

    return {
      tenant: { commercialName, legalIdentity },
      owner: {
        displayName: owner?.displayName ?? "",
        email: owner?.email ?? null,
        phone: owner?.phone ?? null,
        taxId: owner?.taxId ?? null
      },
      liquidationId: liquidation.id,
      status: renderStatus,
      periodStart: liquidation.periodStart,
      periodEnd: liquidation.periodEnd,
      currency: liquidation.currency,
      lineItems: liquidation.lineItems.map((item) => ({
        propertyAddress: item.propertyAddress,
        paidAt: item.paidAt,
        paidAmount: toDecimalString(item.paidAmount),
        dueAmount: toDecimalString(item.dueAmount),
        liquidableAmount: toDecimalString(item.liquidableAmount),
        commissionBpsApplied: item.commissionBpsApplied,
        commissionAmount: toDecimalString(item.commissionAmount),
        netAmount: toDecimalString(item.netAmount)
      })),
      adjustments: liquidation.manualAdjustments.map((adj) => ({
        concept: adj.concept,
        amount: toDecimalString(adj.amount),
        sign: adj.sign
      })),
      totals: {
        grossAmount: toDecimalString(liquidation.grossAmount),
        commissionAmount: toDecimalString(liquidation.commissionAmount),
        adjustmentsTotal: computeAdjustmentsTotal(liquidation.manualAdjustments),
        netAmount: toDecimalString(liquidation.netAmount)
      },
      notes: liquidation.notes ?? undefined,
      issuedAt: liquidation.issuedAt ?? undefined
    };
  }

  private async assertOwnerBelongsToTenant(ownerId: string, tenantId: string): Promise<void> {
    const owner = await this.prisma.owner.findFirst({
      where: { id: ownerId, tenantId, deletedAt: null }
    });

    if (!owner) {
      throw new NotFoundException("No encontramos el propietario solicitado.");
    }
  }

  /**
   * Carga en paralelo los pagos del período (filtrados por owner del contrato),
   * las propiedades con su commissionBps y los TenantSettings para conocer
   * `defaultCommissionBps`. Reusable entre preview y create.
   */
  private async loadCalculatorInputs(args: {
    tenantId: string;
    ownerId: string;
    currency: Currency;
    periodStart: Date;
    periodEnd: Date;
  }): Promise<CalculatorInputs> {
    const { tenantId, ownerId, currency, periodStart, periodEnd } = args;

    const [payments, settings] = await Promise.all([
      this.prisma.payment.findMany({
        where: {
          tenantId,
          currency,
          status: { notIn: [...EXCLUDED_PAYMENT_STATUSES] },
          paidAt: { gte: periodStart, lte: periodEnd },
          contract: { ownerId }
        },
        include: {
          contract: { select: { id: true, propertyId: true, ownerId: true } }
        }
      }) as unknown as Promise<PaymentWithContract[]>,
      this.prisma.tenantSettings.findUnique({ where: { tenantId } })
    ]);

    const propertyIds = Array.from(new Set(payments.map((p) => p.contract.propertyId)));
    const properties = (propertyIds.length === 0
      ? []
      : await this.prisma.property.findMany({
          where: { tenantId, id: { in: propertyIds } },
          select: { id: true, commissionBps: true, addressLine: true }
        })) as unknown as PropertyForCommission[];

    const defaultCommissionBps = readDefaultCommissionBps(settings);

    return { payments, properties, defaultCommissionBps };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers (sin estado, sin DB)
// ─────────────────────────────────────────────────────────────────────────────

function toCalculatorPayment(p: PaymentWithContract, properties: PropertyForCommission[]): CalculatorPayment {
  const property = properties.find((prop) => prop.id === p.contract.propertyId);
  // `paidAt` puede ser null en Prisma; el filtro upstream excluye PENDING/VOIDED, pero
  // si llegara null igual lo tratamos como now() para no romper el calculator.
  // En la práctica la query ya filtró `paidAt: { gte, lte }` así que nunca es null.
  const paidAt = p.paidAt ?? new Date(0);

  return {
    paymentId: p.id,
    contractId: p.contractId,
    propertyId: p.contract.propertyId,
    propertyAddress: property?.addressLine ?? "",
    paidAt,
    paidAmount: toDecimalString(p.paidAmount),
    dueAmount: toDecimalString(p.dueAmount),
    currency: p.currency,
    status: p.status
  };
}

function toCalculatorPropertyCommission(prop: PropertyForCommission): CalculatorPropertyCommission {
  return { propertyId: prop.id, commissionBps: prop.commissionBps };
}

function toLineItemCreateData(
  item: CalculatedLineItem,
  liquidationId: string,
  tenantId: string
): Prisma.LiquidationLineItemCreateManyInput {
  return {
    tenantId,
    liquidationId,
    paymentId: item.paymentId,
    contractId: item.contractId,
    propertyId: item.propertyId,
    propertyAddress: item.propertyAddress,
    paidAt: item.paidAt,
    paidAmount: item.paidAmount,
    dueAmount: item.dueAmount,
    liquidableAmount: item.liquidableAmount,
    commissionBpsApplied: item.commissionBpsApplied,
    commissionAmount: item.commissionAmount,
    netAmount: item.netAmount,
    currency: item.currency
  };
}

function toManualAdjustmentCreateData(
  adj: ManualAdjustmentInputDto,
  liquidationId: string,
  tenantId: string,
  createdById: string | null
): Prisma.LiquidationManualAdjustmentCreateManyInput {
  return {
    tenantId,
    liquidationId,
    concept: adj.concept,
    amount: adj.amount,
    sign: adj.sign,
    createdById
  };
}

/**
 * Prisma serializa Decimal a string en JSON (con `.toString()`). El runtime
 * client expone `Decimal` con `.toFixed(2)`. Los mocks de los tests pasan strings
 * directos. Esta función acepta cualquiera de las tres formas y devuelve un
 * string con dos decimales para que `toCents()` pueda parsear correctamente.
 */
function toDecimalString(value: Prisma.Decimal | string | number): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return value.toFixed(2);
  }
  // Decimal: tiene .toFixed(); fallback a toString si no.
  const maybeFixed = (value as unknown as { toFixed?: (digits: number) => string }).toFixed;
  if (typeof maybeFixed === "function") {
    return maybeFixed.call(value, 2);
  }
  return (value as unknown as { toString: () => string }).toString();
}

function readDefaultCommissionBps(settings: { defaultCommissionBps?: number | null } | null): number {
  if (!settings) return 0;
  const value = settings.defaultCommissionBps;
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: unknown }).code === "P2002";
}

/**
 * Recalcula `netAmount` en cents bigint para evitar drift de floats.
 * Fórmula: `gross - commission + sum(CREDIT) - sum(DEBIT)`.
 *
 * Recibe `gross`/`commission` como strings decimales y la lista de adjustments
 * con `amount` (decimal string) y `sign`. Devuelve un decimal string con dos
 * decimales listo para persistir.
 */
function recalculateNetAmount(
  grossAmount: string,
  commissionAmount: string,
  adjustments: Array<{ amount: string; sign: "CREDIT" | "DEBIT" }>
): string {
  let net = toCents(grossAmount) - toCents(commissionAmount);
  for (const adj of adjustments) {
    const amountCents = toCents(adj.amount);
    net += adj.sign === "CREDIT" ? amountCents : -amountCents;
  }
  return fromCents(net);
}

/** Calcula el total de adjustments (CREDIT - DEBIT) como decimal string. */
function computeAdjustmentsTotal(
  adjustments: Array<{ amount: Prisma.Decimal | string | number; sign: "CREDIT" | "DEBIT" }>
): string {
  let total = 0n;
  for (const adj of adjustments) {
    const amountCents = toCents(toDecimalString(adj.amount));
    total += adj.sign === "CREDIT" ? amountCents : -amountCents;
  }
  return fromCents(total);
}

/**
 * Parsea el JSON `legalIdentity` de TenantSettings extrayendo sólo las claves
 * documentadas (REQ-014). Ignora claves desconocidas y tipos no-string para
 * mantener el render seguro.
 */
function parseLegalIdentity(value: unknown): LegalIdentity | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const source = value as Record<string, unknown>;
  const result: LegalIdentity = {};
  if (typeof source.taxId === "string") result.taxId = source.taxId;
  if (typeof source.licenseNumber === "string") result.licenseNumber = source.licenseNumber;
  if (typeof source.legalAddress === "string") result.legalAddress = source.legalAddress;
  if (typeof source.commercialName === "string") result.commercialName = source.commercialName;
  return Object.keys(result).length > 0 ? result : undefined;
}
