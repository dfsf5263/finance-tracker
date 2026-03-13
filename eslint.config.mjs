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
    },
  },
];

export default eslintConfig;
