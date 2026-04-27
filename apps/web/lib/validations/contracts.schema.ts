import { currencies, economicIndexTypes, rentalContractStatuses } from "@gu-prop/shared";
import { z } from "zod";

export const contractSchema = z.object({
  propertyId: z.string({ required_error: "Seleccioná una propiedad" }).min(1, "Seleccioná una propiedad"),
  ownerId: z.string({ required_error: "Seleccioná un propietario" }).min(1, "Seleccioná un propietario"),
  renterId: z.string({ required_error: "Seleccioná un inquilino" }).min(1, "Seleccioná un inquilino"),
  status: z.enum(rentalContractStatuses, { errorMap: () => ({ message: "Seleccioná un estado de contrato válido" }) }).default("DRAFT"),
  startsAt: z.coerce.date({ errorMap: () => ({ message: "Ingresá una fecha de inicio válida" }) }),
  endsAt: z.coerce.date({ errorMap: () => ({ message: "Ingresá una fecha de finalización válida" }) }),
  rentAmountCents: z
    .number({ required_error: "Ingresá un importe de alquiler válido", invalid_type_error: "Ingresá un importe de alquiler válido" })
    .int("El importe del alquiler debe ser un número entero")
    .positive("El importe del alquiler debe ser mayor a cero"),
  currency: z.enum(currencies, { errorMap: () => ({ message: "Seleccioná una moneda válida" }) }).default("ARS"),
  dueDayOfMonth: z
    .number({ required_error: "Ingresá un día de vencimiento válido", invalid_type_error: "Ingresá un día de vencimiento válido" })
    .int("El día de vencimiento debe ser un número entero")
    .min(1, "El día de vencimiento debe ser entre 1 y 31")
    .max(31, "El día de vencimiento debe ser entre 1 y 31"),
  adjustmentIndexType: z.enum(economicIndexTypes, { errorMap: () => ({ message: "Seleccioná un índice de ajuste válido" }) }),
  adjustmentPeriodMonths: z
    .number({ required_error: "Ingresá un período de ajuste válido", invalid_type_error: "Ingresá un período de ajuste válido" })
    .int("El período de ajuste debe ser un número entero")
    .positive("El período de ajuste debe ser mayor a cero")
});

export type ContractInput = z.infer<typeof contractSchema>;
