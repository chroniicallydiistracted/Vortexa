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
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          "../../*",
          "../../../*",
          "**/Timeline",
          "**/Timeline.tsx",
          "**/Timeline.removed",
        ],
        paths: [
          { name: "web/src/components/Timeline", message: "Use TimeBar instead" },
          { name: "web/src/components/Timeline.tsx", message: "Use TimeBar instead" },
          { name: "web/src/components/Timeline.removed.tsx", message: "Do not import removed file" },
        ],
      },
    ],
    "@typescript-eslint/explicit-module-boundary-types": "off",
  },
};
