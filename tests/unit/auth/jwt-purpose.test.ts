import { describe, it } from "node:test";
import assert from "node:assert";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "../../../src/shared/utils/jwt.js";

void describe("jwt purpose separation", () => {
  void it("accepts an access token only via verifyAccessToken", () => {
    const access = generateAccessToken({ id: "u1", email: "a@b.c" });
    const decoded = verifyAccessToken(access);
    assert.strictEqual(decoded.purpose, "access");
    assert.throws(() => verifyRefreshToken(access));
  });

  void it("accepts a refresh token only via verifyRefreshToken", () => {
    const refresh = generateRefreshToken({ id: "u1", email: "a@b.c" });
    const decoded = verifyRefreshToken(refresh);
    assert.strictEqual(decoded.purpose, "refresh");
    assert.throws(() => verifyAccessToken(refresh));
  });
});
