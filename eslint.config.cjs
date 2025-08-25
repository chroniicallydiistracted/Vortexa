// ESLint flat config migrated from previous .eslintrc.cjs
const ts = require("@typescript-eslint/eslint-plugin");
const tsParser = require("@typescript-eslint/parser");

module.exports = [
  {
    files: ["**/*.ts", "**/*.tsx"],
    ignores: ["**/dist/**", "**/node_modules/**", "sam-installer/**"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parser: tsParser,
    },
    plugins: { "@typescript-eslint": ts },
    rules: {
      ...ts.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        { patterns: ["../../*", "../../../*"] },
      ],
      "@typescript-eslint/explicit-module-boundary-types": "off",
    },
  },
];
