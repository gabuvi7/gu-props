import type { Currency } from "./enums";

export type Money = Readonly<{
  amountCents: bigint;
  currency: Currency;
}>;

export function money(amountCents: bigint | number, currency: Currency = "ARS"): Money {
  if (typeof amountCents === "number" && !Number.isInteger(amountCents)) {
    throw new Error("Money amount must use integer minor units");
  }

  return { amountCents: BigInt(amountCents), currency };
}

export function assertSameCurrency(left: Money, right: Money): void {
  if (left.currency !== right.currency) {
    throw new Error(`Currency mismatch: ${left.currency} !== ${right.currency}`);
  }
}

export function addMoney(left: Money, right: Money): Money {
  assertSameCurrency(left, right);
  return money(left.amountCents + right.amountCents, left.currency);
}

export function subtractMoney(left: Money, right: Money): Money {
  assertSameCurrency(left, right);
  return money(left.amountCents - right.amountCents, left.currency);
}

export function multiplyByRate(value: Money, rate: number): Money {
  if (!Number.isFinite(rate) || rate < 0) {
    throw new Error("Rate must be a non-negative finite number");
  }

  return money(BigInt(Math.round(Number(value.amountCents) * rate)), value.currency);
}
