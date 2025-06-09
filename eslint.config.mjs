import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default eslintConfig;

// import js from "@eslint/js";
// import { FlatCompat } from "@eslint/eslintrc";
// import path from "path";
// import { fileURLToPath } from "url";

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);
// const compat = new FlatCompat({
//   baseDirectory: __dirname,
// });

// const eslintConfig = [
//   js.configs.recommended,
//   ...compat.extends(
//     "next/core-web-vitals",
//     "plugin:@typescript-eslint/recommended"
//   ),
//   {
//     ignores: [
//       "node_modules/",
//       ".next/",
//       ".vscode/",
//       "out/",
//       "build/",
//       "dist/",
//       "coverage/",
//     ],
//     rules: {
//       "@typescript-eslint/no-explicit-any": "warn",
//       "@typescript-eslint/no-unused-vars": "warn",
//       "react/no-unescaped-entities": "warn",
//       "no-console": "off",
//       "no-trailing-spaces": "warn",
//       "prefer-const": "error",
//       "no-unused-vars": "warn",
//     },
//   },
// ];

// export default eslintConfig;
