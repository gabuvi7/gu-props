import type { LiquidationStatus } from "@gu-prop/database";

export type StateTransition = {
  from: LiquidationStatus;
  to: LiquidationStatus;
  reason?: string;
};

export type StateValidationResult =
  | { ok: true }
  | { ok: false; code: "INVALID_TRANSITION"; message: string }
  | { ok: false; code: "VOID_REASON_REQUIRED"; message: string }
  | { ok: false; code: "PAID_VOID_NOT_ALLOWED"; message: string };

type TransitionKey = `${LiquidationStatus}->${LiquidationStatus}`;

const VALID_TRANSITIONS: ReadonlySet<TransitionKey> = new Set<TransitionKey>([
  "DRAFT->ISSUED",
  "ISSUED->PAID",
  "DRAFT->VOIDED",
  "ISSUED->VOIDED"
]);

const MESSAGES = {
  INVALID_TRANSITION: "La transición de estado no es válida.",
  VOID_REASON_REQUIRED: "Es necesario indicar un motivo de anulación.",
  PAID_VOID_NOT_ALLOWED: "No se puede anular una liquidación pagada."
} as const;

function key(from: LiquidationStatus, to: LiquidationStatus): TransitionKey {
  return `${from}->${to}`;
}

function isNonEmptyReason(reason: string | undefined): reason is string {
  return typeof reason === "string" && reason.trim().length > 0;
}

/**
 * Pure state machine for `Liquidation.status` transitions.
 * No DB, no async, no Nest decorators — instantiate directly from the service layer.
 *
 * Allowed transitions (REQ-005):
 *   DRAFT  -> ISSUED
 *   ISSUED -> PAID
 *   DRAFT  -> VOIDED  (requires non-empty reason)
 *   ISSUED -> VOIDED  (requires non-empty reason)
 *
 * PAID -> VOIDED is rejected with a dedicated code (REQ-009 — documented tech debt:
 * reverting an OWNER_PAYOUT requires a future user story).
 */
export class LiquidationStateMachine {
  validate(transition: StateTransition): StateValidationResult {
    const { from, to, reason } = transition;

    // Special case: PAID -> VOIDED gets its own code so the API can return a more
    // explicit message and so the future "void paid liquidation" feature can detect
    // exactly this branch instead of a generic invalid transition (REQ-009).
    if (from === "PAID" && to === "VOIDED") {
      return {
        ok: false,
        code: "PAID_VOID_NOT_ALLOWED",
        message: MESSAGES.PAID_VOID_NOT_ALLOWED
      };
    }

    if (!VALID_TRANSITIONS.has(key(from, to))) {
      return {
        ok: false,
        code: "INVALID_TRANSITION",
        message: MESSAGES.INVALID_TRANSITION
      };
    }

    if (to === "VOIDED" && !isNonEmptyReason(reason)) {
      return {
        ok: false,
        code: "VOID_REASON_REQUIRED",
        message: MESSAGES.VOID_REASON_REQUIRED
      };
    }

    return { ok: true };
  }

  canIssue(currentStatus: LiquidationStatus): boolean {
    return currentStatus === "DRAFT";
  }

  canPay(currentStatus: LiquidationStatus): boolean {
    return currentStatus === "ISSUED";
  }

  canVoid(currentStatus: LiquidationStatus): boolean {
    return currentStatus === "DRAFT" || currentStatus === "ISSUED";
  }

  canEditDraft(currentStatus: LiquidationStatus): boolean {
    return currentStatus === "DRAFT";
  }
}
