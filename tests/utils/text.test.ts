import { describe, it, expect } from "vitest";
import { wordCount, truncateAtParagraph, fleschReadingEase } from "@/lib/utils/text";

describe("wordCount", () => {
  it("counts words", () => {
    expect(wordCount("hello world foo")).toBe(3);
    expect(wordCount("   ")).toBe(0);
  });
});

describe("truncateAtParagraph", () => {
  it("returns input when short", () => {
    expect(truncateAtParagraph("short", 100)).toBe("short");
  });
  it("cuts on paragraph boundary when possible", () => {
    const para = "a".repeat(200) + "\n\n" + "b".repeat(200);
    const out = truncateAtParagraph(para, 50); // 200 chars max
    expect(out.endsWith("a".repeat(200))).toBe(true);
  });
});

describe("fleschReadingEase", () => {
  it("returns 0..1", () => {
    const score = fleschReadingEase("This is a simple sentence. It has small words.");
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});
