import { describe, it, expect } from "vitest";

/**
 * BlinkCanvas component test — placeholder.
 *
 * Real tests will cover:
 * - Rendering with tile URLs
 * - Epoch switching via keyboard (1/2/3, arrow keys)
 * - Mark placement on click with WCS conversion
 * - Masked pixel hatching visibility
 *
 * See PRD §FR-1, §FR-2.
 */
describe("BlinkCanvas", () => {
  it("placeholder: module exists", async () => {
    const mod = await import("@/components/BlinkCanvas");
    expect(mod.default).toBeDefined();
  });
});

describe("Generated Types", () => {
  it("placeholder: types file is importable", async () => {
    const types = await import("@/lib/api/generated/types");
    // Verify key type exports exist (they're interfaces, so we check
    // that the module loaded without error).
    expect(types).toBeDefined();
  });
});
