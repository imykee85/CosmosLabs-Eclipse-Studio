import coreWebVitals from "eslint-config-next/core-web-vitals";

// Vendored skills, archives and build output are not part of the app.
const ignores = [".next/**", "node_modules/**", ".agents/**", "core/skills/**", "media-archive/**", "next-env.d.ts"];

// eslint-config-next 16 turned on the React Compiler checks. They flag patterns this app uses on purpose (loading data in effects,
// timers kept in refs) and rewriting 130 places for a lint rule risks real bugs, so they are warnings, not failures. Fix them one by one when touching a file.
const compilerChecks = {
  "react-hooks/set-state-in-effect": "warn",
  "react-hooks/refs": "warn",
  "react-hooks/immutability": "warn",
  "react-hooks/preserve-manual-memoization": "warn",
  "react-hooks/purity": "warn",
  "react-hooks/static-components": "warn",
  "react-hooks/use-memo": "warn",
};

export default [{ ignores }, ...coreWebVitals, { rules: compilerChecks }];
