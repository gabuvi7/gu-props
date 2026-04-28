import { z } from "zod";

const requiredId = (label: string) =>
  z
    .string({ required_error: `${label} es obligatorio.`, invalid_type_error: `${label} debe ser texto.` })
    .trim()
    .min(1, `${label} es obligatorio.`);

const optionalId = z.string().trim().min(1).optional();

const optionalIsoDate = (label: string) =>
  z
    .string({ invalid_type_error: `${label} debe ser texto.` })
    .trim()
    .min(1, `${label} es obligatoria.`)
    .refine((value) => !Number.isNaN(Date.parse(value)), `${label} debe ser una fecha ISO válida.`)
    .optional();

export const renterHistoryParamsSchema = z.object({
  renterId: requiredId("El inquilino")
});

export const upcomingDuePaymentsQuerySchema = z
  .object({
    from: optionalIsoDate("La fecha desde"),
    to: optionalIsoDate("La fecha hasta"),
    contractId: optionalId,
    propertyId: optionalId,
    renterId: optionalId
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

export const cashFlowQuerySchema = z.object({
  month: z
    .string({ required_error: "El mes es obligatorio.", invalid_type_error: "El mes debe ser texto." })
    .trim()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "El mes debe tener formato AAAA-MM.")
});

export const outstandingBalancesQuerySchema = z.object({
  propertyId: optionalId,
  ownerId: optionalId,
  asOf: optionalIsoDate("La fecha de corte")
});

export type RenterHistoryParamsDto = z.infer<typeof renterHistoryParamsSchema>;
export type UpcomingDuePaymentsQueryDto = z.infer<typeof upcomingDuePaymentsQuerySchema>;
export type CashFlowQueryDto = z.infer<typeof cashFlowQuerySchema>;
export type OutstandingBalancesQueryDto = z.infer<typeof outstandingBalancesQuerySchema>;
