import typescriptEslint from "@typescript-eslint/eslint-plugin"
import tsParser from "@typescript-eslint/parser"
import eslintComments from "eslint-plugin-eslint-comments"
import importPlugin from "eslint-plugin-import"
import noOnlyTests from "eslint-plugin-no-only-tests"
import { defineConfig, globalIgnores } from "eslint/config"
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig([
  globalIgnores([
    "**/node_modules",
    "**/dist",
    "**/dev",
    "**/tsup.config.ts",
    "**/vitest.config.ts",
  ]),
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "@typescript-eslint": typescriptEslint,
      "eslint-comments": eslintComments,
      "no-only-tests": noOnlyTests,
      import: importPlugin,
    },

    languageOptions: {
      parser: tsParser,
      ecmaVersion: 5,
      sourceType: "module",

      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: __dirname,
      },
    },

    rules: {
      "@typescript-eslint/no-unnecessary-condition": "warn",
      "@typescript-eslint/no-unnecessary-type-assertion": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-useless-empty-export": "warn",
      "eslint-comments/no-unused-disable": "warn",
      "import/extensions": ["error", "always"],
      "no-console": [
        "error",
        {
          allow: ["warn", "error", "info", "debug"],
        },
      ],
      "no-debugger": "warn",
      "no-only-tests/no-only-tests": "warn",
      "prefer-const": "warn",
      "curly": ["error", "all"],
    },
  },
])
