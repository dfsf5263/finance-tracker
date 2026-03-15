import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      // Downgraded from error: flagging async data-fetching in useEffect as well as
      // common form-reset patterns that require larger architectural changes to fix.
      "react-hooks/set-state-in-effect": "warn",
      // Allow intentionally-unused variables when prefixed with _ (common TS convention).
      "@typescript-eslint/no-unused-vars": ["warn", { "varsIgnorePattern": "^_" }],
      // Enforce pino logger on server; prevent debug console.* calls reaching production.
      "no-console": "error",
    },
  },
];

export default eslintConfig;
