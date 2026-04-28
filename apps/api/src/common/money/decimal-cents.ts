// Helpers de conversión Decimal <-> bigint cents.
// Prisma serializa Decimal a string en JSON; entrada admite string | number | Decimal.
// Trabajamos siempre con dos decimales (centavos) para evitar drift de floats.
//
// Estos helpers se usan en payments y reports. NO duplicar en otros módulos —
// si necesitás aritmética monetaria, importá desde acá.

export function toCents(value: unknown): bigint {
  const text = typeof value === "string" ? value : (value as { toString: () => string }).toString();
  const trimmed = text.trim();
  const negative = trimmed.startsWith("-");
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  const [intPart = "0", fracPart = ""] = unsigned.split(".");
  const fracPadded = (fracPart + "00").slice(0, 2);
  const cents = BigInt(intPart) * 100n + BigInt(fracPadded || "0");
  return negative ? -cents : cents;
}

export function fromCents(cents: bigint): string {
  const negative = cents < 0n;
  const absolute = negative ? -cents : cents;
  const intPart = absolute / 100n;
  const fracPart = (absolute % 100n).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${intPart.toString()}.${fracPart}`;
}
