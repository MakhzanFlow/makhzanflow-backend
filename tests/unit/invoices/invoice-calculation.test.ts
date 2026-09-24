import { describe, it } from "node:test";
import assert from "node:assert";
import {
  toCents,
  fromCents,
  computeLineTotal,
  computeInvoiceTotal,
  resolveInvoiceStatus,
  buildInvoiceNumber,
  parseInvoiceSeq,
} from "../../../src/modules/invoices/invoice-calculation.js";

void describe("invoice-calculation", () => {
  void it("computes money in integer cents without float drift", () => {
    assert.strictEqual(computeLineTotal(3, 19.99), 59.97);
    assert.strictEqual(toCents(0.1) + toCents(0.2), 30);
    assert.strictEqual(fromCents(30), 0.3);
  });

  void it("clamps totals at zero when discount exceeds subtotal", () => {
    assert.strictEqual(computeInvoiceTotal(100, 150, 0), 0);
    assert.strictEqual(computeInvoiceTotal(100, 10, 5), 95);
  });

  void it("resolves paid / partially_paid / pending correctly", () => {
    assert.strictEqual(resolveInvoiceStatus(100, 100), "paid");
    assert.strictEqual(resolveInvoiceStatus(100, 40), "partially_paid");
    assert.strictEqual(resolveInvoiceStatus(100, 0), "pending");
    assert.strictEqual(resolveInvoiceStatus(0, 0), "pending");
  });

  void it("builds zero-padded invoice numbers and parses the sequence back", () => {
    const num = buildInvoiceNumber(new Date("2026-09-23T00:00:00.000Z"), 7);
    assert.strictEqual(num, "INV-20260923-0007");
    assert.strictEqual(parseInvoiceSeq(num), 7);
    assert.strictEqual(parseInvoiceSeq("garbage"), 0);
  });
});
