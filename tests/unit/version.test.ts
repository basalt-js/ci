import { describe, expect, it } from "vitest";
import {
  bumpVersion,
  compareVersions,
  formatVersion,
  isReleaseType,
  latestVersion,
  npmTag,
  parseVersion
} from "../../src/version";

const bump = (from: string, type: Parameters<typeof bumpVersion>[1]) =>
  formatVersion(bumpVersion(parseVersion(from), type));

describe("parseVersion / formatVersion", () => {
  it("round-trips releases and prereleases", () => {
    expect(formatVersion(parseVersion("1.2.3"))).toBe("1.2.3");
    expect(formatVersion(parseVersion("v1.2.3-next.4"))).toBe("1.2.3-next.4");
  });

  it("rejects other formats with an actionable message", () => {
    expect(() => parseVersion("1.2")).toThrow(/Unsupported version "1.2"/);
    expect(() => parseVersion("1.2.3-beta.1")).toThrow(/-next\.N/);
  });
});

describe("compareVersions", () => {
  it("orders by major, minor, patch", () => {
    expect(compareVersions(parseVersion("2.0.0"), parseVersion("1.9.9"))).toBeGreaterThan(0);
    expect(compareVersions(parseVersion("1.2.3"), parseVersion("1.2.3"))).toBe(0);
  });

  it("puts a release after its own prereleases", () => {
    expect(compareVersions(parseVersion("1.2.3-next.9"), parseVersion("1.2.3"))).toBeLessThan(0);
    expect(compareVersions(parseVersion("1.2.3-next.1"), parseVersion("1.2.3-next.0"))).toBe(1);
  });
});

describe("latestVersion", () => {
  it("picks the newest version tag and ignores the rest", () => {
    const latest = latestVersion(["v1.0.0", "v1.1.0-next.0", "nightly", "v1.0.9"]);
    expect(latest && formatVersion(latest)).toBe("1.1.0-next.0");
  });

  it("returns undefined when no tag is a version", () => {
    expect(latestVersion([])).toBeUndefined();
    expect(latestVersion(["nightly"])).toBeUndefined();
  });
});

describe("bumpVersion", () => {
  it("bumps full releases", () => {
    expect(bump("1.2.3", "patch")).toBe("1.2.4");
    expect(bump("1.2.3", "minor")).toBe("1.3.0");
    expect(bump("1.2.3", "major")).toBe("2.0.0");
    expect(bump("0.0.0", "minor")).toBe("0.1.0");
  });

  it("starts and increments prereleases", () => {
    expect(bump("1.2.3", "prerelease")).toBe("1.2.4-next.0");
    expect(bump("1.2.4-next.0", "prerelease")).toBe("1.2.4-next.1");
  });

  it("graduates a prerelease instead of skipping past it", () => {
    expect(bump("1.2.4-next.1", "patch")).toBe("1.2.4");
    expect(bump("1.3.0-next.2", "minor")).toBe("1.3.0");
    expect(bump("2.0.0-next.3", "major")).toBe("2.0.0");
  });

  it("moves past a prerelease when the bump is larger than it", () => {
    expect(bump("1.2.4-next.1", "minor")).toBe("1.3.0");
    expect(bump("1.2.4-next.1", "major")).toBe("2.0.0");
  });
});

describe("isReleaseType / npmTag", () => {
  it("accepts only the four release types", () => {
    expect(isReleaseType("prerelease")).toBe(true);
    expect(isReleaseType("huge")).toBe(false);
  });

  it("publishes prereleases under next", () => {
    expect(npmTag(parseVersion("1.2.4-next.0"))).toBe("next");
    expect(npmTag(parseVersion("1.2.4"))).toBe("latest");
  });
});
