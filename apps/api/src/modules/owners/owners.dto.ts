import { z } from "zod";

const optionalText = (message: string) => z.string({ invalid_type_error: message }).trim().min(1, message).optional();
const optionalRecord = (message: string) =>
  z
    .unknown()
    .optional()
    .refine((value) => value === undefined || (typeof value === "object" && value !== null && !Array.isArray(value)), message) as z.ZodType<
    Record<string, unknown> | undefined
  >;

export const createOwnerSchema = z.object(
  {
    displayName: z
      .string({ required_error: "El nombre visible es obligatorio.", invalid_type_error: "El nombre visible debe ser texto." })
      .trim()
      .min(1, "El nombre visible es obligatorio."),
    email: z.string({ invalid_type_error: "El email debe ser texto." }).trim().email("El email no es válido.").optional(),
    phone: optionalText("El teléfono no puede estar vacío."),
    taxId: optionalText("La identificación fiscal no puede estar vacía."),
    paymentDetails: optionalRecord("Los datos de pago no son válidos.")
  },
  { required_error: "Los datos del propietario son obligatorios.", invalid_type_error: "Los datos del propietario no son válidos." }
);

export const updateOwnerSchema = createOwnerSchema.partial().refine((data) => Object.keys(data).length > 0, {
  message: "Tenés que enviar al menos un dato para actualizar."
});

export type CreateOwnerDto = z.infer<typeof createOwnerSchema>;
export type UpdateOwnerDto = z.infer<typeof updateOwnerSchema>;

export class CreateOwnerRequest {
  displayName!: string;
  email?: string;
  phone?: string;
  taxId?: string;
  paymentDetails?: Record<string, unknown>;
}

export class UpdateOwnerRequest {
  displayName?: string;
  email?: string;
  phone?: string;
  taxId?: string;
  paymentDetails?: Record<string, unknown>;
}
