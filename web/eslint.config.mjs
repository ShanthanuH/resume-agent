import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["app/**/*.tsx", "components/**/*.tsx"],
    rules: {
      // Every word a visitor reads lives in content/copy.yaml. This rule fails
      // the lint when text is typed straight into a component instead.
      "react/jsx-no-literals": [
        "error",
        {
          noStrings: true, // also catches {"text"} written inside braces
          ignoreProps: true, // class names and other attributes are not text
          // Punctuation and symbols that join texts together are not copy.
          allowedStrings: [" ", ", ", "PDF"],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "lib/copy.gen.ts", // generated from content/copy.yaml
  ]),
]);

export default eslintConfig;
