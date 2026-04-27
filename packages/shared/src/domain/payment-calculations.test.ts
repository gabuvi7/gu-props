import { describe, expect, it } from "vitest";
import { allocatePaymentAmount } from "./payment-calculations";
import { money } from "./money";

describe("allocatePaymentAmount", () => {
  it("calculates remaining debt for partial payments", () => {
    const result = allocatePaymentAmount(money(100_000n), money(40_000n));

    expect(result.status).toBe("PARTIAL");
    expect(result.remainingDebt.amountCents).toBe(60_000n);
    expect(result.creditBalance.amountCents).toBe(0n);
  });

  it("calculates credit balance for overpayments", () => {
    const result = allocatePaymentAmount(money(100_000n), money(125_000n));

    expect(result.status).toBe("OVERPAID");
    expect(result.remainingDebt.amountCents).toBe(0n);
    expect(result.creditBalance.amountCents).toBe(25_000n);
  });
});
