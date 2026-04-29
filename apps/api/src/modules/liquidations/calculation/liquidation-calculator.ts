import type { Currency, LiquidationAdjustmentSign } from "@gu-prop/database";
import { fromCents, toCents } from "../../../common/money/decimal-cents";

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export type CalculatorPayment = {
  paymentId: string;
  contractId: string;
  propertyId: string;
  propertyAddress: string;
  paidAt: Date;
  paidAmount: string; // decimal string ("100000.50")
  dueAmount: string;
  currency: Currency;
  status: "PAID" | "PARTIAL" | "OVERPAID" | "VOIDED" | "PENDING";
};

export type CalculatorPropertyCommission = {
  propertyId: string;
  commissionBps: number | null;
};

export type CalculatorAdjustment = {
  concept: string;
  amount: string; // decimal string
  sign: LiquidationAdjustmentSign; // CREDIT | DEBIT
};

export type CalculatorInput = {
  payments: CalculatorPayment[];
  propertyCommissions: CalculatorPropertyCommission[];
  defaultCommissionBps: number;
  adjustments?: CalculatorAdjustment[];
  currency: Currency;
  periodStart: Date;
  periodEnd: Date;
};

export type CalculatedLineItem = {
  paymentId: string;
  contractId: string;
  propertyId: string;
  propertyAddress: string;
  paidAt: Date;
  paidAmount: string;
  dueAmount: string;
  liquidableAmount: string;
  commissionBpsApplied: number;
  commissionAmount: string;
  netAmount: string;
  currency: Currency;
};

export type CalculatedTotals = {
  grossAmount: string;
  commissionAmount: string;
  adjustmentsTotal: string; // sum(CREDIT) - sum(DEBIT), can be negative
  netAmount: string; // gross - commission + adjustmentsTotal
  currency: Currency;
};

export type CalculatorResult = {
  lineItems: CalculatedLineItem[];
  totals: CalculatedTotals;
};

// ─────────────────────────────────────────────────────────────────────────────
// Implementation
// ─────────────────────────────────────────────────────────────────────────────

const INCLUDED_PAYMENT_STATUSES: ReadonlySet<CalculatorPayment["status"]> = new Set([
  "PAID",
  "PARTIAL",
  "OVERPAID"
]);

function bigIntMin(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}

/**
 * Pure liquidation calculator. No DB, no async, no Nest decorators —
 * the service layer hydrates the input and calls `calculate` synchronously.
 *
 * All monetary math runs in `bigint` cents through the shared helpers in
 * `apps/api/src/common/money/decimal-cents.ts`. NEVER use `Number` for totals.
 *
 * Covers REQ-001 (gross), REQ-002 (BPS hierarchy + snapshot), REQ-003
 * (manual adjustments, signed), REQ-004 (multi-currency isolation).
 */
export class LiquidationCalculator {
  calculate(input: CalculatorInput): CalculatorResult {
    const periodStartMs = input.periodStart.getTime();
    const periodEndMs = input.periodEnd.getTime();

    // 1. Build a property → bps lookup with fallback to default.
    const bpsByProperty = this.buildBpsLookup(
      input.propertyCommissions,
      input.defaultCommissionBps
    );

    // 2. Filter payments (status, currency, period range) and project line items.
    const lineItems: CalculatedLineItem[] = [];
    for (const payment of input.payments) {
      if (!INCLUDED_PAYMENT_STATUSES.has(payment.status)) continue;
      if (payment.currency !== input.currency) continue;

      const paidAtMs = payment.paidAt.getTime();
      if (paidAtMs < periodStartMs || paidAtMs > periodEndMs) continue;

      lineItems.push(
        this.buildLineItem(payment, bpsByProperty, input.defaultCommissionBps, input.currency)
      );
    }

    // 3. Stable order: paidAt asc, then paymentId asc.
    lineItems.sort((a, b) => {
      const dt = a.paidAt.getTime() - b.paidAt.getTime();
      if (dt !== 0) return dt;
      if (a.paymentId < b.paymentId) return -1;
      if (a.paymentId > b.paymentId) return 1;
      return 0;
    });

    // 4. Aggregate totals in cents.
    let grossCents = 0n;
    let commissionCents = 0n;
    for (const item of lineItems) {
      grossCents += toCents(item.liquidableAmount);
      commissionCents += toCents(item.commissionAmount);
    }

    // 5. Adjustments: sum(CREDIT) - sum(DEBIT). Can be negative.
    let adjustmentsCents = 0n;
    for (const adj of input.adjustments ?? []) {
      const amountCents = toCents(adj.amount);
      adjustmentsCents += adj.sign === "CREDIT" ? amountCents : -amountCents;
    }

    // 6. Net = gross - commission + adjustmentsTotal. Can be negative.
    const netCents = grossCents - commissionCents + adjustmentsCents;

    return {
      lineItems,
      totals: {
        grossAmount: fromCents(grossCents),
        commissionAmount: fromCents(commissionCents),
        adjustmentsTotal: fromCents(adjustmentsCents),
        netAmount: fromCents(netCents),
        currency: input.currency
      }
    };
  }

  private buildBpsLookup(
    propertyCommissions: CalculatorPropertyCommission[],
    defaultCommissionBps: number
  ): Map<string, number> {
    const lookup = new Map<string, number>();
    for (const entry of propertyCommissions) {
      // null commissionBps means "use the tenant default" — REQ-002 fallback chain.
      const effective =
        entry.commissionBps === null ? defaultCommissionBps : entry.commissionBps;
      lookup.set(entry.propertyId, effective);
    }
    return lookup;
  }

  private resolveBps(
    propertyId: string,
    bpsByProperty: Map<string, number>,
    defaultCommissionBps: number
  ): number {
    // Property explicitly mapped → use that (already resolves null → default).
    if (bpsByProperty.has(propertyId)) {
      // Map.has narrows to true but TS still doesn't refine the get(); guard it.
      const value = bpsByProperty.get(propertyId);
      if (typeof value === "number") return value;
    }
    // Property not in lookup → fall back to tenant default.
    // Defensive: if neither is set we bottom out at 0 (REQ-002).
    return Number.isFinite(defaultCommissionBps) ? defaultCommissionBps : 0;
  }

  private buildLineItem(
    payment: CalculatorPayment,
    bpsByProperty: Map<string, number>,
    defaultCommissionBps: number,
    currency: Currency
  ): CalculatedLineItem {
    const paidCents = toCents(payment.paidAmount);
    const dueCents = toCents(payment.dueAmount);
    const liquidableCents = bigIntMin(paidCents, dueCents);

    const bps = this.resolveBps(payment.propertyId, bpsByProperty, defaultCommissionBps);

    // bigint floor division naturally truncates toward zero for non-negative values,
    // which matches REQ-002's "redondeando hacia abajo".
    const commissionCents = (liquidableCents * BigInt(bps)) / 10000n;
    const netCents = liquidableCents - commissionCents;

    return {
      paymentId: payment.paymentId,
      contractId: payment.contractId,
      propertyId: payment.propertyId,
      propertyAddress: payment.propertyAddress,
      paidAt: payment.paidAt,
      paidAmount: fromCents(paidCents),
      dueAmount: fromCents(dueCents),
      liquidableAmount: fromCents(liquidableCents),
      commissionBpsApplied: bps,
      commissionAmount: fromCents(commissionCents),
      netAmount: fromCents(netCents),
      currency
    };
  }
}
