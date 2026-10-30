/**
 * Version arithmetic for `basalt-release`.
 *
 * Versions are `MAJOR.MINOR.PATCH`, optionally followed by a `-next.N` prerelease suffix.
 * Git tags (`v1.2.3`) are the source of truth. `package.json` only receives the computed
 * version at publish time.
 */

/**
 * The kinds of release `basalt-release` can cut.
 *
 * @example
 * ```ts
 * const type: ReleaseType = "minor";
 * ```
 */
export type ReleaseType = "patch" | "minor" | "major" | "prerelease";

/** Every accepted release type, in the order the CLI usage line lists them. */
export const RELEASE_TYPES: readonly ReleaseType[] = ["patch", "minor", "major", "prerelease"];

/**
 * A parsed version. `next` is the `N` in `-next.N` and is absent for full releases.
 *
 * @example
 * ```ts
 * const version: Version = { major: 1, minor: 2, patch: 3, next: 0 }; // 1.2.3-next.0
 * ```
 */
export type Version = {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly next?: number;
};

/** Matches `1.2.3`, `v1.2.3` and `1.2.3-next.4`. */
const VERSION_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)(?:-next\.(\d+))?$/;

/**
 * Checks whether a string is a supported release type.
 *
 * @param value - Candidate release type, usually from the command line.
 * @returns `true` when `value` is one of `RELEASE_TYPES`.
 * @example
 * ```ts
 * isReleaseType("minor"); // true
 * isReleaseType("huge"); // false
 * ```
 */
export function isReleaseType(value: string): value is ReleaseType {
  return (RELEASE_TYPES as readonly string[]).includes(value);
}

/**
 * Parses a version string.
 *
 * @param text - A version such as `1.2.3`, `v1.2.3` or `1.2.3-next.4`.
 * @returns The parsed version.
 * @throws {Error} When the text is not a supported version.
 * @example
 * ```ts
 * parseVersion("v1.2.3-next.4"); // { major: 1, minor: 2, patch: 3, next: 4 }
 * ```
 */
export function parseVersion(text: string): Version {
  const match = VERSION_PATTERN.exec(text.trim());
  if (!match) {
    throw new Error(
      `Unsupported version "${text}".\n  Use MAJOR.MINOR.PATCH, optionally followed by -next.N.`
    );
  }

  const [, major, minor, patch, next] = match;
  const release = { major: Number(major), minor: Number(minor), patch: Number(patch) };
  return next === undefined ? release : { ...release, next: Number(next) };
}

/**
 * Formats a version without the leading `v`.
 *
 * @param version - The version to format.
 * @returns The version string, for example `1.2.3` or `1.2.3-next.0`.
 * @example
 * ```ts
 * formatVersion({ major: 1, minor: 2, patch: 3 }); // "1.2.3"
 * ```
 */
export function formatVersion(version: Version): string {
  const release = `${version.major}.${version.minor}.${version.patch}`;
  return version.next === undefined ? release : `${release}-next.${version.next}`;
}

/**
 * Orders two versions. A full release sorts after its own prereleases.
 *
 * @param left - First version.
 * @param right - Second version.
 * @returns A negative number, zero or a positive number, like `Array.prototype.sort` expects.
 * @example
 * ```ts
 * compareVersions(parseVersion("1.2.3-next.1"), parseVersion("1.2.3")); // < 0
 * ```
 */
export function compareVersions(left: Version, right: Version): number {
  for (const part of ["major", "minor", "patch"] as const) {
    if (left[part] !== right[part]) return left[part] - right[part];
  }

  const leftNext = left.next ?? Number.POSITIVE_INFINITY;
  const rightNext = right.next ?? Number.POSITIVE_INFINITY;
  if (leftNext === rightNext) return 0;
  return leftNext < rightNext ? -1 : 1;
}

/**
 * Finds the newest version among git tags. Tags that aren't versions are ignored.
 *
 * @param tags - Tag names, for example the output of `git tag --list "v*"`.
 * @returns The newest version, or `undefined` when no tag is a version.
 * @example
 * ```ts
 * latestVersion(["v1.0.0", "v1.1.0-next.0", "nightly"]); // 1.1.0-next.0
 * ```
 */
export function latestVersion(tags: readonly string[]): Version | undefined {
  let latest: Version | undefined;

  for (const tag of tags) {
    if (!VERSION_PATTERN.test(tag.trim())) continue;
    const version = parseVersion(tag);
    if (latest === undefined || compareVersions(version, latest) > 0) latest = version;
  }

  return latest;
}

/**
 * Computes the next version.
 *
 * A prerelease graduates instead of skipping ahead when the requested bump would land on
 * the version it is already a prerelease of. For example `patch` turns `1.2.4-next.1` into
 * `1.2.4`, and `major` turns `2.0.0-next.3` into `2.0.0`. A `prerelease` bump starts
 * `-next.0` on the next patch, or increments an existing `-next.N`.
 *
 * @param current - The latest released version.
 * @param type - The kind of release to cut.
 * @returns The next version.
 * @example
 * ```ts
 * bumpVersion(parseVersion("1.2.3"), "minor"); // 1.3.0
 * bumpVersion(parseVersion("1.2.3"), "prerelease"); // 1.2.4-next.0
 * ```
 */
export function bumpVersion(current: Version, type: ReleaseType): Version {
  const { major, minor, patch } = current;
  const isPrerelease = current.next !== undefined;

  switch (type) {
    case "major": {
      const graduates = isPrerelease && minor === 0 && patch === 0;
      return graduates ? { major, minor, patch } : { major: major + 1, minor: 0, patch: 0 };
    }
    case "minor": {
      const graduates = isPrerelease && patch === 0;
      return graduates ? { major, minor, patch } : { major, minor: minor + 1, patch: 0 };
    }
    case "patch": {
      return isPrerelease ? { major, minor, patch } : { major, minor, patch: patch + 1 };
    }
    case "prerelease": {
      return isPrerelease
        ? { major, minor, patch, next: (current.next ?? 0) + 1 }
        : { major, minor, patch: patch + 1, next: 0 };
    }
  }
}

/**
 * Picks the npm dist-tag for a version.
 *
 * @param version - The version being published.
 * @returns `"next"` for prereleases, otherwise `"latest"`.
 * @example
 * ```ts
 * npmTag(parseVersion("1.2.3-next.0")); // "next"
 * ```
 */
export function npmTag(version: Version): "latest" | "next" {
  return version.next === undefined ? "latest" : "next";
}
