import { describe, expect, it } from "vitest";
import { formatSize, gzipSize, parseSize } from "../../src/size";

describe("parseSize", () => {
  it("reads bytes, kilobytes and megabytes", () => {
    expect(parseSize("800")).toBe(800);
    expect(parseSize("800b")).toBe(800);
    expect(parseSize("12kb")).toBe(12_288);
    expect(parseSize("1.5 KB")).toBe(1536);
    expect(parseSize("2mb")).toBe(2_097_152);
  });

  it("rejects other formats with an actionable message", () => {
    expect(() => parseSize("12 gigs")).toThrow(/Unsupported size "12 gigs"/);
  });
});

describe("gzipSize", () => {
  it("measures compressed bytes, smaller than the input for repetitive text", () => {
    const text = "basalt ".repeat(1000);
    expect(gzipSize(text)).toBeGreaterThan(0);
    expect(gzipSize(text)).toBeLessThan(text.length);
  });
});

describe("formatSize", () => {
  it("uses bytes below 1 KB and kilobytes above", () => {
    expect(formatSize(512)).toBe("512 B");
    expect(formatSize(3287)).toBe("3.21 KB");
  });
});
