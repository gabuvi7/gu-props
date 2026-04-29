import { z } from "zod";

// TODO(refactor): los helpers `requiredId`, `isoDateString`, `currencySchema` y
// `decimalAmountSchema` están duplicados en `contracts.dto.ts` y `payments.dto.ts`.
// Cuando se haga el refactor a `apps/api/src/common/validation/common-fields.ts`,
// importar desde allí y borrar estas copias. Decisión: NO refactorizar acá para
// no introducir cambios cruzados que rompan tests de otros módulos en este batch.

const currencySchema = z.enum(["ARS", "USD"], { errorMap: () => ({ message: "La moneda no es válida." }) });

const liquidationStatusSchema = z.enum(["DRAFT", "ISSUED", "PAID", "VOIDED"], {
  errorMap: () => ({ message: "El estado de la liquidación no es válido." })
});

const adjustmentSignSchema = z.enum(["CREDIT", "DEBIT"], {
  errorMap: () => ({ message: "El signo del ajuste no es válido." })
});

const requiredId = (label: string) =>
  z
    .string({ required_error: `${label} es obligatorio.`, invalid_type_error: `${label} debe ser texto.` })
    .trim()
    .min(1, `${label} es obligatorio.`);

const isoDateString = (label: string) =>
  z
    .string({ required_error: `${label} es obligatoria.`, invalid_type_error: `${label} debe ser texto.` })
    .trim()
    .min(1, `${label} es obligatoria.`)
    .refine((value) => !Number.isNaN(Date.parse(value)), `${label} debe ser una fecha ISO válida.`);

const optionalIsoDateString = (label: string) => isoDateString(label).optional();

// Monto positivo con hasta dos decimales (decimal string).
const positiveAmountSchema = (label: string) =>
  z
    .union([
      z
        .string({ invalid_type_error: `${label} debe ser texto o número.` })
        .trim()
        .regex(/^\d+(\.\d{1,2})?$/, `${label} debe tener hasta dos decimales.`),
      z.number({ invalid_type_error: `${label} debe ser texto o número.` }).finite(`${label} debe ser finito.`)
    ])
    .transform((value) => (typeof value === "number" ? value.toString() : value))
    .refine((value) => /^\d+(\.\d{1,2})?$/.test(value), `${label} debe tener hasta dos decimales.`)
    .refine((value) => Number(value) > 0, `${label} debe ser mayor a cero.`);

const PERIOD_RANGE_MESSAGE = "El período no es válido: la fecha de inicio debe ser anterior al fin.";

// ─────────────────────────────────────────────────────────────────────────────
// previewLiquidationSchema — POST /liquidations/preview body
// ─────────────────────────────────────────────────────────────────────────────

const periodFieldsSchema = z.object(
  {
    ownerId: requiredId("El propietario"),
    periodStart: isoDateString("La fecha de inicio del período"),
    periodEnd: isoDateString("La fecha de fin del período"),
    currency: currencySchema
  },
  {
    required_error: "Las fechas del período son obligatorias y deben tener formato ISO.",
    invalid_type_error: "Los datos de la liquidación no son válidos."
  }
);

export const previewLiquidationSchema = periodFieldsSchema.refine(
  (data) => Date.parse(data.periodStart) < Date.parse(data.periodEnd),
  { message: PERIOD_RANGE_MESSAGE, path: ["periodEnd"] }
);

// ─────────────────────────────────────────────────────────────────────────────
// createLiquidationSchema — POST /liquidations body
// ─────────────────────────────────────────────────────────────────────────────

const manualAdjustmentInputSchema = z.object(
  {
    concept: z
      .string({ required_error: "El concepto del ajuste es obligatorio.", invalid_type_error: "El concepto del ajuste debe ser texto." })
      .trim()
      .min(1, "El concepto del ajuste es obligatorio.")
      .max(200, "El concepto del ajuste no puede superar los 200 caracteres."),
    amount: positiveAmountSchema("El monto del ajuste"),
    sign: adjustmentSignSchema
  },
  { required_error: "Los datos del ajuste son obligatorios.", invalid_type_error: "Los datos del ajuste no son válidos." }
);

export const createLiquidationSchema = periodFieldsSchema
  .extend({
    notes: z
      .string({ invalid_type_error: "Las observaciones deben ser texto." })
      .trim()
      .max(2000, "Las observaciones no pueden superar los 2000 caracteres.")
      .optional(),
    manualAdjustments: z
      .array(manualAdjustmentInputSchema, { invalid_type_error: "Los ajustes manuales deben ser una lista." })
      .optional()
      .default([])
  })
  .refine((data) => Date.parse(data.periodStart) < Date.parse(data.periodEnd), {
    message: PERIOD_RANGE_MESSAGE,
    path: ["periodEnd"]
  });

// ─────────────────────────────────────────────────────────────────────────────
// listLiquidationsQuerySchema — GET /liquidations query
// ─────────────────────────────────────────────────────────────────────────────

export const listLiquidationsQuerySchema = z
  .object({
    ownerId: z.string().trim().min(1).optional(),
    status: liquidationStatusSchema.optional(),
    currency: currencySchema.optional(),
    periodStart: optionalIsoDateString("La fecha de inicio del período"),
    periodEnd: optionalIsoDateString("La fecha de fin del período")
  })
  .refine(
    (data) => {
      if (!data.periodStart || !data.periodEnd) {
        return true;
      }
      return Date.parse(data.periodStart) < Date.parse(data.periodEnd);
    },
    { message: "El período no es válido.", path: ["periodEnd"] }
  );

// ─────────────────────────────────────────────────────────────────────────────
// updateLiquidationDraftSchema — PATCH /liquidations/:id body (sólo DRAFT)
// ─────────────────────────────────────────────────────────────────────────────

export const updateLiquidationDraftSchema = z.object({
  notes: z
    .string({ invalid_type_error: "Las observaciones deben ser texto." })
    .max(2000, "Las observaciones no pueden superar los 2000 caracteres.")
    .optional()
});

// ─────────────────────────────────────────────────────────────────────────────
// changeLiquidationStatusSchema — PATCH /liquidations/:id/status body
// ─────────────────────────────────────────────────────────────────────────────

export const changeLiquidationStatusSchema = z.object({
  status: liquidationStatusSchema,
  voidReason: z
    .string({ invalid_type_error: "El motivo de anulación debe ser texto." })
    .min(1, "Es necesario indicar un motivo de anulación.")
    .max(500, "El motivo de anulación no puede superar los 500 caracteres.")
    .optional()
});

// ─────────────────────────────────────────────────────────────────────────────
// addManualAdjustmentSchema — POST /liquidations/:id/manual-adjustments body
// ─────────────────────────────────────────────────────────────────────────────

export const addManualAdjustmentSchema = z.object({
  concept: z
    .string({ required_error: "El concepto del ajuste es obligatorio.", invalid_type_error: "El concepto del ajuste debe ser texto." })
    .trim()
    .min(1, "El concepto del ajuste es obligatorio.")
    .max(200, "El concepto no puede superar los 200 caracteres."),
  amount: positiveAmountSchema("El monto del ajuste"),
  sign: adjustmentSignSchema
});

// ─────────────────────────────────────────────────────────────────────────────
// Inferred types
// ─────────────────────────────────────────────────────────────────────────────

export type PreviewLiquidationDto = z.infer<typeof previewLiquidationSchema>;
export type CreateLiquidationDto = z.infer<typeof createLiquidationSchema>;
export type ListLiquidationsQueryDto = z.infer<typeof listLiquidationsQuerySchema>;
export type ManualAdjustmentInputDto = z.infer<typeof manualAdjustmentInputSchema>;
export type UpdateLiquidationDraftDto = z.infer<typeof updateLiquidationDraftSchema>;
export type ChangeLiquidationStatusDto = z.infer<typeof changeLiquidationStatusSchema>;
export type AddManualAdjustmentDto = z.infer<typeof addManualAdjustmentSchema>;
