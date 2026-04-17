import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import noUnscopedKotoiq from "./eslint-rules/no-unscoped-kotoiq.mjs";

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
  ]),
  // KotoIQ agency-isolation rule (FND-04)
  {
    files: ["src/**/*.{ts,tsx,js,jsx}"],
    plugins: {
      kotoiq: { rules: { "no-unscoped-kotoiq": noUnscopedKotoiq } },
    },
    rules: {
      "kotoiq/no-unscoped-kotoiq": "error",
    },
  },
]);

export default eslintConfig;
