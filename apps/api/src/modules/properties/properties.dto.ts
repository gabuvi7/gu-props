import { z } from "zod";

const optionalText = (message: string) => z.string({ invalid_type_error: message }).trim().min(1, message).optional();
const propertyTypeSchema = z.enum(["APARTMENT", "HOUSE", "COMMERCIAL", "LAND", "OTHER"], {
  errorMap: () => ({ message: "El tipo de propiedad no es válido." })
});
const propertyStatusSchema = z.enum(["AVAILABLE", "RENTED", "INACTIVE"], {
  errorMap: () => ({ message: "El estado de la propiedad no es válido." })
});

export const createPropertySchema = z.object(
  {
    ownerId: z
      .string({ required_error: "El propietario es obligatorio.", invalid_type_error: "El propietario debe ser texto." })
      .trim()
      .min(1, "El propietario es obligatorio."),
    type: propertyTypeSchema,
    status: propertyStatusSchema.optional(),
    addressLine: z
      .string({ required_error: "La dirección es obligatoria.", invalid_type_error: "La dirección debe ser texto." })
      .trim()
      .min(1, "La dirección es obligatoria."),
    city: optionalText("La ciudad no puede estar vacía."),
    province: optionalText("La provincia no puede estar vacía."),
    postalCode: optionalText("El código postal no puede estar vacío."),
    commissionBps: z
      .number({ invalid_type_error: "La comisión debe ser un número." })
      .int("La comisión debe ser un número entero.")
      .min(0, "La comisión no puede ser negativa.")
      .optional()
  },
  { required_error: "Los datos de la propiedad son obligatorios.", invalid_type_error: "Los datos de la propiedad no son válidos." }
);

export const updatePropertySchema = createPropertySchema.partial().refine((data) => Object.keys(data).length > 0, {
  message: "Tenés que enviar al menos un dato para actualizar."
});

export type CreatePropertyDto = z.infer<typeof createPropertySchema>;
export type UpdatePropertyDto = z.infer<typeof updatePropertySchema>;

export class CreatePropertyRequest {
  ownerId!: string;
  type!: z.infer<typeof propertyTypeSchema>;
  status?: z.infer<typeof propertyStatusSchema>;
  addressLine!: string;
  city?: string;
  province?: string;
  postalCode?: string;
  commissionBps?: number;
}

export class UpdatePropertyRequest {
  ownerId?: string;
  type?: z.infer<typeof propertyTypeSchema>;
  status?: z.infer<typeof propertyStatusSchema>;
  addressLine?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  commissionBps?: number;
}
