#!/usr/bin/env bun
/**
 * basalt-size: fails when the gzipped size of the given files exceeds a budget.
 *
 * Usage: basalt-size <file...> --max <size>
 * Example: basalt-size dist/index.mjs --max 12kb
 */
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { formatSize, gzipSize, parseSize } from "../src/size";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { max: { type: "string" } }
});

if (positionals.length === 0 || values.max === undefined) {
  console.error("Usage: basalt-size <file...> --max <size>   (for example: --max 12kb)");
  process.exit(2);
}

const budget = parseSize(values.max);
let total = 0;

for (const file of positionals) {
  const size = gzipSize(readFileSync(file));
  total += size;
  console.info(`${file}: ${formatSize(size)} gzipped`);
}

if (total > budget) {
  console.error(
    `Size budget exceeded: ${formatSize(total)} > ${formatSize(budget)}.\n` +
      "  Shrink the bundle, or raise --max on purpose in the package's size script."
  );
  process.exit(1);
}

console.info(`Within budget: ${formatSize(total)} of ${formatSize(budget)}.`);
