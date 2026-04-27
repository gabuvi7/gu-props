import type { PaymentStatus } from "./enums";
import { money, subtractMoney, type Money } from "./money";

export type PaymentAllocation = Readonly<{
  status: PaymentStatus;
  paid: Money;
  remainingDebt: Money;
  creditBalance: Money;
}>;

export function allocatePaymentAmount(due: Money, paid: Money): PaymentAllocation {
  if (due.currency !== paid.currency) {
    throw new Error(`Currency mismatch: ${due.currency} !== ${paid.currency}`);
  }
  if (due.amountCents < 0n || paid.amountCents < 0n) {
    throw new Error("Payment amounts cannot be negative");
  }

  const zero = money(0n, due.currency);
  const delta = subtractMoney(due, paid);

  if (paid.amountCents === 0n) {
    return { status: "PENDING", paid, remainingDebt: due, creditBalance: zero };
  }

  if (delta.amountCents > 0n) {
    return { status: "PARTIAL", paid, remainingDebt: delta, creditBalance: zero };
  }

  if (delta.amountCents === 0n) {
    return { status: "PAID", paid, remainingDebt: zero, creditBalance: zero };
  }

  return {
    status: "OVERPAID",
    paid,
    remainingDebt: zero,
    creditBalance: money(delta.amountCents * -1n, due.currency)
  };
}
