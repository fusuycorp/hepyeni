import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "max-depth": ["error", 3],
    },
  },
  {
    files: [
      "src/lib/**/*.{ts,tsx}",
      "src/app/api/**/*.{ts,tsx}",
      "src/app/groups/[groupId]/group-content-view.tsx",
      "src/app/groups/[groupId]/titles/[titleId]/title-detail-view.tsx",
      "src/app/shelf/quotes-tab.tsx",
    ],
    rules: {
      complexity: ["error", 10],
    },
  },
  {
    files: ["**/tests/**"],
    rules: {
      // Tests intentionally use loose typing for PocketBase mocks, fixtures,
      // and `as never` session stubs; `any` and non-null assertions there are
      // deliberate and not app-code hygiene violations.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-asserted-optional-chain": "off",
    },
  },
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
