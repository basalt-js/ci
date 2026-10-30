// @ts-check
import biomeConfig from "eslint-config-biome";
import jsdocPlugin from "eslint-plugin-jsdoc";
import sonarjs from "eslint-plugin-sonarjs";
import eslintPluginUnicorn from "eslint-plugin-unicorn";
import tseslint from "typescript-eslint";

/**
 * Builds the shared basalt-js ESLint flat config.
 *
 * Source files get the strict JSDoc contract (description, params, returns and an
 * `@example` on every function and type). Tests and config files are relaxed. The Biome
 * compatibility layer always comes last so ESLint never fights Biome.
 *
 * @param {object} [options] - Optional overrides.
 * @param {string[]} [options.sourceFiles] - Globs that get the strict JSDoc rules.
 * @param {string[]} [options.testFiles] - Globs that get the relaxed test rules.
 * @param {string[]} [options.ignores] - Extra globs to ignore.
 * @returns {import("eslint").Linter.Config[]} The flat config array.
 * @example
 * ```js
 * // eslint.config.js
 * import { basalt } from "@basalt-js/ci/eslint";
 *
 * export default basalt();
 * ```
 */
export function basalt(options = {}) {
  const sourceFiles = options.sourceFiles ?? ["src/**/*.ts"];
  const testFiles = options.testFiles ?? ["tests/**/*.ts", "**/__tests__/**/*.ts"];
  const ignores = options.ignores ?? [];

  return [
    // Global ignores
    { ignores: ["dist/**", "coverage/**", "node_modules/**", "bun.lock", ...ignores] },

    // Lint every TypeScript file, not only the default JS extensions
    { files: ["**/*.ts"] },

    // TypeScript parser, then the recommended rule sets
    tseslint.configs.base,
    eslintPluginUnicorn.configs.recommended,
    sonarjs.configs.recommended,
    jsdocPlugin.configs["flat/recommended-typescript-error"],

    // JSDoc style: allow {Type} annotations and one blank line before the first tag
    {
      rules: {
        "jsdoc/no-types": "off",
        "jsdoc/tag-lines": ["error", "never", { startLines: 1 }],
        // `export {};` is the module marker for empty entry points
        "unicorn/require-module-specifiers": "off",
        // Basalt's own API has `find(plugin)` (ctx.find, app.find), which this rule
        // mistakes for Array#find with a callback reference
        "unicorn/no-array-callback-reference": "off"
      }
    },

    // Source files: the full JSDoc contract
    {
      files: sourceFiles,
      rules: {
        "jsdoc/require-jsdoc": [
          "error",
          {
            require: {
              ArrowFunctionExpression: true,
              ClassDeclaration: true,
              FunctionDeclaration: true,
              FunctionExpression: true,
              MethodDefinition: true
            },
            contexts: ["TSInterfaceDeclaration", "TSTypeAliasDeclaration"]
          }
        ],
        "jsdoc/require-description": "error",
        "jsdoc/require-param": "error",
        "jsdoc/require-param-description": "error",
        "jsdoc/require-returns": "error",
        "jsdoc/require-returns-description": "error",
        "jsdoc/require-example": "error",
        // Type-only imports must stay type-only (no accidental runtime coupling)
        "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }]
      }
    },

    // Tests: no JSDoc requirements, allow test-style code
    {
      files: testFiles,
      rules: {
        "jsdoc/require-jsdoc": "off",
        "jsdoc/require-description": "off",
        "jsdoc/require-param": "off",
        "jsdoc/require-returns": "off",
        "jsdoc/require-example": "off",
        "unicorn/no-useless-undefined": "off",
        "unicorn/prevent-abbreviations": "off",
        "sonarjs/no-duplicate-string": "off"
      }
    },

    // Type tests assert at compile time (expectTypeOf, @ts-expect-error)
    {
      files: ["**/*.test-d.ts"],
      rules: {
        "sonarjs/assertions-in-tests": "off"
      }
    },

    // Config files
    {
      files: ["*.config.ts", "*.config.js"],
      rules: {
        "jsdoc/require-jsdoc": "off",
        "jsdoc/require-description": "off"
      }
    },

    // MUST be last: turns off ESLint rules that Biome already enforces
    biomeConfig
  ];
}
