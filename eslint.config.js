import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  js.configs.recommended,
  ...compat.extends(
    "next/core-web-vitals",
    "plugin:@typescript-eslint/recommended"
  ),
  {
    ignores: [
      "node_modules/",
      ".next/",
      ".vscode/",
      "out/",
      "build/",
      "dist/",
      "coverage/",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      "react/no-unescaped-entities": "off",
      "no-console": "warn",
      "no-trailing-spaces": "error",
      "prefer-const": "error",
      "no-unused-vars": "off",
    },
  },
];

export default eslintConfig;
