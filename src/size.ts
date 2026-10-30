/**
 * Size arithmetic for the `basalt-size` bundle gate.
 */
import { gzipSync } from "node:zlib";

/** Bytes per unit, keyed by lower-case unit name. */
const BYTES_PER_UNIT: Readonly<Record<string, number>> = { b: 1, kb: 1024, mb: 1024 * 1024 };

/** Matches `800`, `800b`, `12kb`, `1.5 KB` and `2mb`. */
const SIZE_PATTERN = /^(\d+(?:\.\d+)?)\s*(b|kb|mb)?$/i;

/**
 * Parses a human-written size budget into bytes.
 *
 * @param text - A size such as `12kb`, `1.5 KB`, `800b` or `800` (bytes).
 * @returns The size in bytes, rounded to a whole byte.
 * @throws {Error} When the text is not a supported size.
 * @example
 * ```ts
 * parseSize("12kb"); // 12288
 * ```
 */
export function parseSize(text: string): number {
  const match = SIZE_PATTERN.exec(text.trim());
  if (!match) {
    throw new Error(`Unsupported size "${text}".\n  Use a number with b, kb or mb, such as 12kb.`);
  }

  const [, amount, unit = "b"] = match;
  return Math.round(Number(amount) * (BYTES_PER_UNIT[unit.toLowerCase()] ?? 1));
}

/**
 * Measures how many bytes some content takes after gzip at the highest level.
 *
 * @param contents - File contents.
 * @returns The gzipped size in bytes.
 * @example
 * ```ts
 * gzipSize(readFileSync("dist/index.mjs"));
 * ```
 */
export function gzipSize(contents: string | Uint8Array): number {
  return gzipSync(contents, { level: 9 }).byteLength;
}

/**
 * Formats a byte count for people.
 *
 * @param bytes - Size in bytes.
 * @returns For example `"512 B"` or `"3.21 KB"`.
 * @example
 * ```ts
 * formatSize(3287); // "3.21 KB"
 * ```
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(2)} KB`;
}
