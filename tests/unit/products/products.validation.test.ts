import { describe, it } from "node:test";
import assert from "node:assert";
import {
  createProductSchema,
  updateProductSchema,
  normalizeBooleanFlag,
} from "../../../src/modules/products/products.validation.js";

const baseCreateBody = { name: "Milk", price: 10 };

void describe("products is_active flag", () => {
  void describe("normalizeBooleanFlag()", () => {
    void it("passes real booleans through", () => {
      assert.strictEqual(normalizeBooleanFlag(true), true);
      assert.strictEqual(normalizeBooleanFlag(false), false);
    });

    void it('maps "true"/"false" strings to booleans', () => {
      assert.strictEqual(normalizeBooleanFlag("true"), true);
      assert.strictEqual(normalizeBooleanFlag("false"), false);
    });

    void it("returns undefined for missing values", () => {
      assert.strictEqual(normalizeBooleanFlag(undefined), undefined);
      assert.strictEqual(normalizeBooleanFlag(null), undefined);
    });
  });

  void describe("updateProductSchema", () => {
    void it("accepts boolean and string forms of is_active", () => {
      for (const is_active of [true, false, "true", "false"]) {
        const parsed = updateProductSchema.parse({ body: { is_active }, query: {}, params: {} });
        assert.ok(parsed);
      }
    });

    void it("accepts a body without is_active", () => {
      const parsed = updateProductSchema.parse({ body: { name: "Milk" }, query: {}, params: {} });
      assert.ok(parsed);
    });

    void it("rejects garbage values for is_active", () => {
      for (const is_active of ["yes", 123, {}]) {
        assert.throws(() =>
          updateProductSchema.parse({ body: { is_active }, query: {}, params: {} })
        );
      }
    });
  });

  void describe("createProductSchema", () => {
    void it("accepts boolean and string forms of is_active and defaults to true", () => {
      for (const is_active of [true, false, "true", "false"]) {
        const parsed = createProductSchema.parse({
          body: { ...baseCreateBody, is_active },
          query: {},
          params: {},
        });
        assert.ok(parsed);
      }
      const defaulted = createProductSchema.parse({
        body: { ...baseCreateBody },
        query: {},
        params: {},
      });
      assert.strictEqual((defaulted.body as any).is_active, true);
    });
  });
});
