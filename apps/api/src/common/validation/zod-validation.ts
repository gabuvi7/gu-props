import { BadRequestException } from "@nestjs/common";
import type { ZodType } from "zod";

export function parseRequestBody<T>(schema: ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);

  if (!result.success) {
    throw new BadRequestException({
      message: "Los datos enviados no son válidos.",
      errors: result.error.issues.map((issue) => issue.message)
    });
  }

  return result.data;
}
