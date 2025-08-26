module.exports = {
  root: true,
  ignorePatterns: ["dist", "node_modules"],
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaVersion: 2022, sourceType: "module", project: false },
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier",
  ],
  rules: {
  // Legacy restricted imports cleaned up (Panel/Timeline fully removed)
    "@typescript-eslint/explicit-module-boundary-types": "off",
  },
};
