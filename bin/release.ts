#!/usr/bin/env bun
/**
 * basalt-release: cuts a release of the package in the current directory.
 *
 * Usage: basalt-release <patch|minor|major|prerelease> [--dry-run] [--skip-checks]
 *
 * Git tags are the source of truth for versions. The script:
 *   1. computes the next version from the newest `v*` tag (or package.json when there is none);
 *   2. runs the package's `check` script, which includes the build (unless --skip-checks);
 *   3. writes the version into package.json in the working tree only (it is never committed);
 *   4. creates and pushes the tag `v<next>`, which claims the version;
 *   5. publishes to npm (dist-tag `next` for prereleases, with provenance when running in CI);
 *   6. creates a GitHub release with generated notes when the `gh` CLI is available;
 *   7. restores package.json.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import {
  bumpVersion,
  formatVersion,
  isReleaseType,
  latestVersion,
  npmTag,
  parseVersion,
  RELEASE_TYPES
} from "../src/version";

/** The package.json fields the release reads. */
type PackageJson = {
  readonly name: string;
  readonly version: string;
  readonly scripts?: Readonly<Record<string, string>>;
};

/** Windows resolves `npm` and `gh` through `.cmd` shims, which need a shell. */
const USE_SHELL = process.platform === "win32";

/**
 * Stops the release with a message and an exit code.
 *
 * @param message - What went wrong and what to do about it.
 * @param code - Process exit code.
 * @example
 * ```ts
 * fail("Working tree is not clean.");
 * ```
 */
function fail(message: string, code = 1): never {
  console.error(`Release stopped: ${message}`);
  process.exit(code);
}

/**
 * Runs a command with inherited output, and stops the release if it fails.
 *
 * @param command - Executable name.
 * @param commandArguments - Arguments for the executable.
 * @example
 * ```ts
 * run("git", ["push", "origin", "v1.2.3"]);
 * ```
 */
function run(command: string, commandArguments: readonly string[]): void {
  const line = `${command} ${commandArguments.join(" ")}`;
  console.info(`$ ${line}`);

  const result = spawnSync(command, commandArguments, { stdio: "inherit", shell: USE_SHELL });
  if (result.status !== 0) fail(`"${line}" failed.`, result.status ?? 1);
}

/**
 * Runs a command and returns its trimmed standard output. Stops the release if it fails.
 *
 * @param command - Executable name.
 * @param commandArguments - Arguments for the executable.
 * @returns The command's standard output, trimmed.
 * @example
 * ```ts
 * const branch = read("git", ["branch", "--show-current"]);
 * ```
 */
function read(command: string, commandArguments: readonly string[]): string {
  const result = spawnSync(command, commandArguments, { encoding: "utf8", shell: USE_SHELL });
  if (result.status !== 0) fail(`"${command} ${commandArguments.join(" ")}" failed.`);
  return result.stdout.trim();
}

/**
 * Checks whether a command runs successfully, without printing anything.
 *
 * @param command - Executable name.
 * @param commandArguments - Arguments for the executable.
 * @returns `true` when the command exits with code 0.
 * @example
 * ```ts
 * if (succeeds("gh", ["--version"])) { ... }
 * ```
 */
function succeeds(command: string, commandArguments: readonly string[]): boolean {
  return spawnSync(command, commandArguments, { stdio: "ignore", shell: USE_SHELL }).status === 0;
}

// Arguments
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    "dry-run": { type: "boolean", default: false },
    "skip-checks": { type: "boolean", default: false }
  }
});

const [releaseType] = positionals;
if (releaseType === undefined || !isReleaseType(releaseType)) {
  fail(`usage is basalt-release <${RELEASE_TYPES.join("|")}> [--dry-run] [--skip-checks]`, 2);
}
const dryRun = values["dry-run"];

// Preconditions: releases come from a clean main
const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as PackageJson;
const branch = read("git", ["branch", "--show-current"]);

if (!dryRun && branch !== "main") {
  fail(`releases are cut from main, but the current branch is "${branch}".`);
}
if (!dryRun && read("git", ["status", "--porcelain"]) !== "") {
  fail("the working tree is not clean. Commit or stash your changes first.");
}

// Next version, from the newest version tag
const tags = read("git", ["tag", "--list", "v*"]).split("\n").filter(Boolean);
const current = latestVersion(tags) ?? parseVersion(packageJson.version);
const next = bumpVersion(current, releaseType);
const nextText = formatVersion(next);
const tag = `v${nextText}`;

console.info(
  `${packageJson.name}: ${formatVersion(current)} → ${nextText} (npm dist-tag "${npmTag(next)}")`
);

if (dryRun) {
  console.info("Dry run: nothing was changed.");
  process.exit(0);
}

// Gates
if (!values["skip-checks"] && packageJson.scripts?.check !== undefined) {
  run("bun", ["run", "check"]);
}

// The version goes into the working tree only; the tag is the record
writeFileSync(
  "package.json",
  `${JSON.stringify({ ...packageJson, version: nextText }, undefined, 2)}\n`
);

// Claim the version, then publish it
run("git", ["tag", "-a", tag, "-m", tag]);
run("git", ["push", "origin", tag]);

const publishArguments = ["publish", "--access", "public", "--tag", npmTag(next)];
if (process.env.CI) publishArguments.push("--provenance");
run("npm", publishArguments);

// GitHub release, when the gh CLI is available
if (succeeds("gh", ["--version"])) {
  const prereleaseFlag = next.next === undefined ? [] : ["--prerelease"];
  run("gh", ["release", "create", tag, "--title", tag, "--generate-notes", ...prereleaseFlag]);
} else {
  console.info("gh CLI not found: skipped the GitHub release.");
}

run("git", ["checkout", "--", "package.json"]);
console.info(`Released ${packageJson.name}@${nextText}.`);
