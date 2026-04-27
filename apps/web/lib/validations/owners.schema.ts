import { z } from "zod";

export const ownerSchema = z.object({
  displayName: z.string({ required_error: "El nombre del propietario es obligatorio" }).min(1, "El nombre del propietario es obligatorio"),
  email: z.string().email("Ingresá un email válido").optional().or(z.literal("")),
  phone: z.string().optional(),
  taxId: z.string().optional(),
  paymentDetails: z.record(z.unknown()).optional()
});

export type OwnerInput = z.infer<typeof ownerSchema>;
