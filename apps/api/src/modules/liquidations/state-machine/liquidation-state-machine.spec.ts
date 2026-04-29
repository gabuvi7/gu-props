import type { LiquidationStatus } from "@gu-prop/database";
import { describe, expect, it } from "vitest";
import { LiquidationStateMachine } from "./liquidation-state-machine";

const ALL_STATUSES: LiquidationStatus[] = ["DRAFT", "ISSUED", "PAID", "VOIDED"];

const VALID_NON_VOID_TRANSITIONS: Array<{ from: LiquidationStatus; to: LiquidationStatus }> = [
  { from: "DRAFT", to: "ISSUED" },
  { from: "ISSUED", to: "PAID" }
];

const VALID_VOID_TRANSITIONS: Array<{ from: LiquidationStatus; to: LiquidationStatus }> = [
  { from: "DRAFT", to: "VOIDED" },
  { from: "ISSUED", to: "VOIDED" }
];

// All combinations except the 4 valid ones (DRAFT->ISSUED, ISSUED->PAID, DRAFT->VOIDED, ISSUED->VOIDED)
// and excluding PAID->VOIDED (which has its own dedicated error code).
const INVALID_TRANSITIONS: Array<{ from: LiquidationStatus; to: LiquidationStatus }> = [
  { from: "DRAFT", to: "DRAFT" },
  { from: "DRAFT", to: "PAID" },
  { from: "ISSUED", to: "DRAFT" },
  { from: "ISSUED", to: "ISSUED" },
  { from: "PAID", to: "DRAFT" },
  { from: "PAID", to: "ISSUED" },
  { from: "PAID", to: "PAID" },
  { from: "VOIDED", to: "DRAFT" },
  { from: "VOIDED", to: "ISSUED" },
  { from: "VOIDED", to: "PAID" },
  { from: "VOIDED", to: "VOIDED" }
];

describe("LiquidationStateMachine", () => {
  describe("validate — valid transitions", () => {
    it.each(VALID_NON_VOID_TRANSITIONS)(
      "permite %s -> %s sin reason",
      ({ from, to }) => {
        const sm = new LiquidationStateMachine();
        const result = sm.validate({ from, to });
        expect(result).toEqual({ ok: true });
      }
    );

    it.each(VALID_VOID_TRANSITIONS)(
      "permite %s -> %s con reason no vacío",
      ({ from, to }) => {
        const sm = new LiquidationStateMachine();
        const result = sm.validate({ from, to, reason: "Error de carga" });
        expect(result).toEqual({ ok: true });
      }
    );

    it("permite DRAFT -> VOIDED ignorando whitespace alrededor del reason", () => {
      const sm = new LiquidationStateMachine();
      const result = sm.validate({ from: "DRAFT", to: "VOIDED", reason: "  motivo válido  " });
      expect(result).toEqual({ ok: true });
    });
  });

  describe("validate — invalid transitions", () => {
    it.each(INVALID_TRANSITIONS)(
      "rechaza %s -> %s con INVALID_TRANSITION",
      ({ from, to }) => {
        const sm = new LiquidationStateMachine();
        const result = sm.validate({ from, to });
        expect(result).toEqual({
          ok: false,
          code: "INVALID_TRANSITION",
          message: "La transición de estado no es válida."
        });
      }
    );

    it("rechaza una transición inválida con mensaje exacto incluso si el reason vino", () => {
      const sm = new LiquidationStateMachine();
      const result = sm.validate({ from: "ISSUED", to: "DRAFT", reason: "no debería importar" });
      expect(result).toEqual({
        ok: false,
        code: "INVALID_TRANSITION",
        message: "La transición de estado no es válida."
      });
    });
  });

  describe("validate — VOID requires reason", () => {
    it("rechaza DRAFT -> VOIDED sin reason con VOID_REASON_REQUIRED", () => {
      const sm = new LiquidationStateMachine();
      const result = sm.validate({ from: "DRAFT", to: "VOIDED" });
      expect(result).toEqual({
        ok: false,
        code: "VOID_REASON_REQUIRED",
        message: "Es necesario indicar un motivo de anulación."
      });
    });

    it.each(["", "   ", "\n", "\t  \t"])(
      "rechaza ISSUED -> VOIDED con reason vacío o sólo whitespace (%j)",
      (reason) => {
        const sm = new LiquidationStateMachine();
        const result = sm.validate({ from: "ISSUED", to: "VOIDED", reason });
        expect(result).toEqual({
          ok: false,
          code: "VOID_REASON_REQUIRED",
          message: "Es necesario indicar un motivo de anulación."
        });
      }
    );
  });

  describe("validate — PAID -> VOIDED is forbidden specifically", () => {
    it("rechaza PAID -> VOIDED con PAID_VOID_NOT_ALLOWED aunque venga reason válido", () => {
      const sm = new LiquidationStateMachine();
      const result = sm.validate({
        from: "PAID",
        to: "VOIDED",
        reason: "operador pidió anular"
      });
      expect(result).toEqual({
        ok: false,
        code: "PAID_VOID_NOT_ALLOWED",
        message: "No se puede anular una liquidación pagada."
      });
    });

    it("rechaza PAID -> VOIDED sin reason también con PAID_VOID_NOT_ALLOWED (no con VOID_REASON_REQUIRED)", () => {
      const sm = new LiquidationStateMachine();
      const result = sm.validate({ from: "PAID", to: "VOIDED" });
      expect(result).toEqual({
        ok: false,
        code: "PAID_VOID_NOT_ALLOWED",
        message: "No se puede anular una liquidación pagada."
      });
    });
  });

  describe("canIssue", () => {
    it.each(ALL_STATUSES)("para current=%s devuelve true sólo si DRAFT", (status) => {
      const sm = new LiquidationStateMachine();
      expect(sm.canIssue(status)).toBe(status === "DRAFT");
    });
  });

  describe("canPay", () => {
    it.each(ALL_STATUSES)("para current=%s devuelve true sólo si ISSUED", (status) => {
      const sm = new LiquidationStateMachine();
      expect(sm.canPay(status)).toBe(status === "ISSUED");
    });
  });

  describe("canVoid", () => {
    it.each(ALL_STATUSES)(
      "para current=%s devuelve true sólo si DRAFT o ISSUED",
      (status) => {
        const sm = new LiquidationStateMachine();
        expect(sm.canVoid(status)).toBe(status === "DRAFT" || status === "ISSUED");
      }
    );
  });

  describe("canEditDraft", () => {
    it.each(ALL_STATUSES)("para current=%s devuelve true sólo si DRAFT", (status) => {
      const sm = new LiquidationStateMachine();
      expect(sm.canEditDraft(status)).toBe(status === "DRAFT");
    });
  });
});
