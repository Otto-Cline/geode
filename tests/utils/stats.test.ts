import { describe, it, expect } from "vitest";
import { clamp01, mean, variance, seededRng } from "@/lib/utils/stats";

describe("clamp01", () => {
  it("clamps", () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(0.5)).toBe(0.5);
  });
});

describe("mean/variance", () => {
  it("computes basic stats", () => {
    expect(mean([1, 2, 3])).toBe(2);
    expect(variance([1, 2, 3])).toBeCloseTo(2 / 3, 5);
  });
});

describe("seededRng", () => {
  it("is deterministic for same seed", () => {
    const a = seededRng("abc");
    const b = seededRng("abc");
    expect(a()).toBe(b());
    expect(a()).toBe(b());
  });
  it("differs across seeds", () => {
    expect(seededRng("a")()).not.toBe(seededRng("b")());
  });
});
