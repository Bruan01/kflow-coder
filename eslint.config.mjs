import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

const nodeGlobals = {
  Buffer: "readonly",
  URL: "readonly",
  console: "readonly",
  fetch: "readonly",
  process: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
};

const browserGlobals = {
  document: "readonly",
  fetch: "readonly",
  Intl: "readonly",
  navigator: "readonly",
  setTimeout: "readonly",
  window: "readonly",
};

export default tseslint.config(
  {
    ignores: [
      "dist/",
      "node_modules/",
      "lr-machine/snapshots/*.html",
      "testforkfc/",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.mjs"],
    languageOptions: {
      globals: nodeGlobals,
    },
  },
  {
    files: ["lr-machine/public/**/*.js"],
    languageOptions: {
      globals: browserGlobals,
    },
  },
);
