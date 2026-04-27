import { z } from "zod";

const optionalText = (message: string) => z.string({ invalid_type_error: message }).trim().min(1, message).optional();
const optionalRecord = (message: string) =>
  z
    .unknown()
    .optional()
    .refine((value) => value === undefined || (typeof value === "object" && value !== null && !Array.isArray(value)), message) as z.ZodType<
    Record<string, unknown> | undefined
  >;

export const createRenterSchema = z.object(
  {
    displayName: z
      .string({ required_error: "El nombre visible es obligatorio.", invalid_type_error: "El nombre visible debe ser texto." })
      .trim()
      .min(1, "El nombre visible es obligatorio."),
    email: z.string({ invalid_type_error: "El email debe ser texto." }).trim().email("El email no es válido.").optional(),
    phone: optionalText("El teléfono no puede estar vacío."),
    identityNumber: optionalText("El documento no puede estar vacío."),
    guaranteeInfo: optionalRecord("La información de garantía no es válida.")
  },
  { required_error: "Los datos del inquilino son obligatorios.", invalid_type_error: "Los datos del inquilino no son válidos." }
);

export const updateRenterSchema = createRenterSchema.partial().refine((data) => Object.keys(data).length > 0, {
  message: "Tenés que enviar al menos un dato para actualizar."
});

export type CreateRenterDto = z.infer<typeof createRenterSchema>;
export type UpdateRenterDto = z.infer<typeof updateRenterSchema>;

export class CreateRenterRequest {
  displayName!: string;
  email?: string;
  phone?: string;
  identityNumber?: string;
  guaranteeInfo?: Record<string, unknown>;
}

export class UpdateRenterRequest {
  displayName?: string;
  email?: string;
  phone?: string;
  identityNumber?: string;
  guaranteeInfo?: Record<string, unknown>;
}
