import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // PocketBase's own JS migration runner format (globals like `migrate`,
    // `Collection`, `TextField` come from its JSVM sandbox, not a module
    // system) — not part of the Next.js app, shouldn't be linted as such.
    "pb_migrations/**",
  ]),
]);

export default eslintConfig;
