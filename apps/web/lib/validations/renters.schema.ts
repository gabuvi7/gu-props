import { z } from "zod";

export const renterSchema = z.object({
  displayName: z.string({ required_error: "El nombre del inquilino es obligatorio" }).min(1, "El nombre del inquilino es obligatorio"),
  email: z.string().email("Ingresá un email válido").optional().or(z.literal("")),
  phone: z.string().optional(),
  identityNumber: z.string().optional(),
  guaranteeInfo: z.record(z.unknown()).optional()
});

export type RenterInput = z.infer<typeof renterSchema>;
