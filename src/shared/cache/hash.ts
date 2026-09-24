import { createHash } from "crypto";

export function hashQuery(params: Record<string, unknown>): string {
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(params).sort()) {
    const val = params[key];
    if (val !== undefined && val !== null) {
      sorted[key] = val;
    }
  }
  return createHash("md5").update(JSON.stringify(sorted)).digest("hex").slice(0, 12);
}
