import { describe, expect, it } from "vitest";
import {
  getConditionBadgeVariant,
  getConditionChartColor,
  isAttentionCondition,
} from "./conditionUi";

const CONDITIONS = ["good", "fair", "marginal", "poor", "bad"];

describe("getConditionBadgeVariant", () => {
  it.each(CONDITIONS)("returns a distinct nb-chip variant for %s", (c) => {
    expect(getConditionBadgeVariant(c)).toBe(`nb-chip nb-chip-${c}`);
  });

  it("every rating maps to a unique class so none collapse to the fallback", () => {
    const classes = CONDITIONS.map(getConditionBadgeVariant);
    expect(new Set(classes).size).toBe(CONDITIONS.length);
  });

  it("falls back to the plain chip for unknown conditions", () => {
    expect(getConditionBadgeVariant("unknown")).toBe("nb-chip");
    expect(getConditionBadgeVariant(undefined)).toBe("nb-chip");
  });
});

describe("getConditionChartColor", () => {
  it.each(CONDITIONS)("returns the --cond-%s token", (c) => {
    expect(getConditionChartColor(c)).toBe(`var(--cond-${c})`);
  });

  it("falls back to base-content for unknown conditions", () => {
    expect(getConditionChartColor("unknown")).toBe("var(--color-base-content)");
  });
});

describe("isAttentionCondition", () => {
  it("flags marginal/poor/bad and not good/fair", () => {
    expect(isAttentionCondition("marginal")).toBe(true);
    expect(isAttentionCondition("poor")).toBe(true);
    expect(isAttentionCondition("bad")).toBe(true);
    expect(isAttentionCondition("good")).toBe(false);
    expect(isAttentionCondition("fair")).toBe(false);
    expect(isAttentionCondition(undefined)).toBe(false);
  });
});
