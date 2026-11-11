import { describe, expect, it } from "vitest";
import { bn } from "./bn";
import { en } from "./en";
import { isLang } from "./lang";

describe("i18n dictionaries", () => {
  it("bn has exactly the same keys as en", () => {
    expect(Object.keys(bn).sort()).toEqual(Object.keys(en).sort());
  });

  it("no bn value is empty", () => {
    for (const [key, value] of Object.entries(bn)) {
      expect(value.trim(), key).not.toBe("");
    }
  });

  it("keeps the required NASA credit line verbatim in both languages", () => {
    const credit =
      "Built with NASA SPHEREx data from IRSA/IPAC. AstroBlink is a NASA Space Apps Challenge project and is not endorsed by NASA.";
    expect(en["footer.credit"]).toBe(credit);
    expect(bn["footer.credit"]).toBe(credit);
  });

  it("recognises only supported languages", () => {
    expect(isLang("en")).toBe(true);
    expect(isLang("bn")).toBe(true);
    expect(isLang("fr")).toBe(false);
    expect(isLang(undefined)).toBe(false);
  });
});
