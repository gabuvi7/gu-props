import { z } from "zod";

const currencySchema = z.enum(["ARS", "USD"], { errorMap: () => ({ message: "La moneda no es válida." }) });

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

const nonNegativeAmountSchema = (label: string) =>
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
    .refine((value) => Number(value) >= 0, `${label} no puede ser negativo.`);

export const createPaymentSchema = z.object(
  {
    contractId: requiredId("El contrato"),
    renterId: requiredId("El inquilino"),
    dueAmount: positiveAmountSchema("El monto adeudado"),
    paidAmount: nonNegativeAmountSchema("El monto pagado"),
    currency: currencySchema,
    dueAt: isoDateString("La fecha de vencimiento"),
    paidAt: optionalIsoDateString("La fecha de pago"),
    notes: z
      .string({ invalid_type_error: "Las notas deben ser texto." })
      .trim()
      .max(500, "Las notas no pueden superar los 500 caracteres.")
      .optional()
  },
  { required_error: "Los datos del pago son obligatorios.", invalid_type_error: "Los datos del pago no son válidos." }
);

export const listPaymentsQuerySchema = z
  .object({
    contractId: z.string().trim().min(1).optional(),
    renterId: z.string().trim().min(1).optional()
  })
  .refine((data) => Boolean(data.contractId) || Boolean(data.renterId), {
    message: "Tenés que filtrar por contrato o por inquilino."
  });

export const balanceQuerySchema = z.object(
  {
    contractId: requiredId("El contrato")
  },
  { required_error: "El contrato es obligatorio.", invalid_type_error: "El contrato no es válido." }
);

export const listCashMovementsQuerySchema = z
  .object({
    from: optionalIsoDateString("La fecha desde"),
    to: optionalIsoDateString("La fecha hasta")
  })
  .refine(
    (data) => {
      if (!data.from || !data.to) {
        return true;
      }
      return Date.parse(data.from) <= Date.parse(data.to);
    },
    { message: "El rango de fechas no es válido.", path: ["to"] }
  );

export type CreatePaymentDto = z.infer<typeof createPaymentSchema>;
export type ListPaymentsQueryDto = z.infer<typeof listPaymentsQuerySchema>;
export type BalanceQueryDto = z.infer<typeof balanceQuerySchema>;
export type ListCashMovementsQueryDto = z.infer<typeof listCashMovementsQuerySchema>;

export class CreatePaymentRequest {
  contractId!: string;
  renterId!: string;
  dueAmount!: string | number;
  paidAmount!: string | number;
  currency!: z.infer<typeof currencySchema>;
  dueAt!: string;
  paidAt?: string;
  notes?: string;
}
