# @basalt-js/ci

Shared tooling for every basalt-js repository. One place for the lint rules, the TypeScript settings, the CI pipeline and the release script, so all repos are held to the same gates.

## What's inside

| Export / file | Use it as |
|---|---|
| `@basalt-js/ci/biome` | `biome.json` → `{ "extends": ["@basalt-js/ci/biome"] }` |
| `@basalt-js/ci/tsconfig.base.json` | `tsconfig.json` → `{ "extends": "@basalt-js/ci/tsconfig.base.json" }` |
| `@basalt-js/ci/eslint` | `eslint.config.js` → `import { basalt } from "@basalt-js/ci/eslint"; export default basalt();` |
| `basalt-size` (bin) | `"size": "basalt-size dist/index.mjs --max 12kb"`. Fails when the gzipped size is over budget. |
| `basalt-release` (bin) | `basalt-release <patch\|minor\|major\|prerelease> [--dry-run]`. See below. |
| `.github/workflows/package-ci.yml` | Reusable CI: lint, typecheck matrix, tests, build + validate + size. |
| `.github/workflows/package-release.yml` | Reusable release job that runs `basalt-release`. |
| `.github/workflows/pr-review.yml` | Reusable Claude review of a pull request. Its check, `claude / review`, fails when the review rejects. Needs `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY`. Usage is in the file's header. |

Each consuming repo installs the tools themselves as devDependencies: `@biomejs/biome`, `eslint`, `typescript`.

## Releases

Git tags are the source of truth. `basalt-release` performs these steps:

1. Takes the newest `v*` tag, or `package.json` if there is none, and computes the next version.
2. Runs the package's `check` script.
3. Writes the version into `package.json` in the working tree only. It is never committed.
4. Creates and pushes `v<next>`.
5. Publishes with `bun publish` (in CI: `npm publish --provenance`, since bun can't attach provenance). Prereleases (`-next.N`) go to the `next` dist-tag.
6. Creates a GitHub release.

Run it with `--dry-run` to see the next version without changing anything.

In GitHub Actions, the caller's workflow **must be named `publish.yml`**, because npm Trusted Publishing is registered against that file name.

## Development

```sh
bun install
bun run check   # typecheck + lint + test
```
