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
    // Bundle thiết kế: prototype .dc.html + support.js là tham chiếu để dựng lại,
    // không phải code production. Xem docs/design_handoff/README.md.
    "docs/**",
    // Prisma Client sinh tự động.
    "generated/**",
  ]),
]);

export default eslintConfig;
