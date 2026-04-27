import { propertyStatuses, propertyTypes } from "@gu-prop/shared";
import { z } from "zod";

export const propertySchema = z.object({
  ownerId: z.string({ required_error: "Seleccioná un propietario" }).min(1, "Seleccioná un propietario"),
  type: z.enum(propertyTypes, { errorMap: () => ({ message: "Seleccioná un tipo de propiedad válido" }) }),
  status: z.enum(propertyStatuses, { errorMap: () => ({ message: "Seleccioná un estado de propiedad válido" }) }).default("AVAILABLE"),
  addressLine: z.string({ required_error: "La dirección es obligatoria" }).min(1, "La dirección es obligatoria"),
  city: z.string().optional(),
  province: z.string().optional(),
  commissionBps: z
    .number({ required_error: "Ingresá una comisión válida", invalid_type_error: "Ingresá una comisión válida" })
    .int("La comisión debe ser un número entero")
    .min(0, "La comisión no puede ser negativa")
    .max(10_000, "La comisión no puede superar el 100 %")
    .optional()
});

export type PropertyInput = z.infer<typeof propertySchema>;
