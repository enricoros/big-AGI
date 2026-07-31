import { defineConfig } from "eslint/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";
import pluginCompat from "eslint-plugin-compat";
// typed linting - rides eslint-config-next's own @typescript-eslint packages
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default defineConfig([{
    /* Ours to declare: `lint` calls eslint directly (`next lint` supplied these, and is removed in
       Next 16). Flat config only auto-skips node_modules - NOT dot-dirs. Only list what eslint
       would otherwise open: js/ts under here would be linted with app rules and lie. */
    ignores: [
      ".next*/**", "out/**", "dist/**", // build output (minified bundles trip compat/ on every modern API)
      "public/**",                      // served verbatim, outside the bundler + type program
      ".claude/**",                     // agent tooling, own runtime
      "electron/**",                    // excluded from the type program (root tsconfig)
      "tools/video/**",                 // self-contained package, own toolchain
    ],
}, {
    extends: compat.extends("next/core-web-vitals"),
    rules: {
        //
        "react-hooks/exhaustive-deps": ["warn", {
            additionalHooks: "(useMemoShallowStable)",
        }],
        // older-browser guard: we deliberately support sub-floor engines (Chrome 109/Win7, old Brave)
        // for a few APIs, so ban the ones that crash there. eslint-plugin-compat can't catch these:
        // they're at/below the browserslist floor (Chrome 110), so it considers them "supported".
        "no-restricted-syntax": ["warn", {
            selector: "CallExpression[callee.property.name=/^(toSorted|toReversed|toSpliced)$/]",
            message: "ES2023 array method crashes on Chrome <110 (Win7/8) and old Brave. Use a copy + in-place form instead: [...arr].sort() / [...arr].reverse(), or arr.filter() instead of toSpliced().",
        }, {
            selector: "CallExpression[callee.property.name='with'][arguments.length=2]",
            message: "Array.prototype.with() crashes on Chrome <110 (Win7/8) and old Brave. Use arr.map((v, i) => i === idx ? value : v), or a copy + index assignment.",
        }, {
            selector: "NewExpression[callee.object.name='Intl'][callee.property.name='Segmenter']",
            message: "Intl.Segmenter is absent on older engines and throws. Call textIsSingleEmoji() (which feature-detects + falls back), or guard with `if (Intl.Segmenter)` and provide a fallback.",
        }],
    },
}, {
    // browser API compatibility guard (reads `browserslist` from package.json) - catches
    // above-floor Web APIs (the next Promise.withResolvers) at lint time before they ship.
    ...pluginCompat.configs["flat/recommended"],
    settings: {
        // feature-detected in-code (fallback/guard present), so they don't break older browsers
        polyfills: ["requestIdleCallback", "Intl.Segmenter", "ClipboardItem"],
    },
}, {
    // Enrico 2026-07-30: TYPED rules - needs a full type program, so this is the ~15s of `npm run lint`
    // unbound-method: detaching a prototype method (destructure, stored reference, callback) silently
    // rebinds `this` - the destructure-heavy house style is only safe with this guard.
    // Annotate genuinely 'detach-safe' declarations with `this: void` (or declare them property-style).
    files: ["src/**/*.ts", "src/**/*.tsx"], // pages/ + app/ are in the program too, but hold ~no logic
    ignores: ["**/*.test.ts"], // in the tools program, not this one
    languageOptions: {
        parser: tsParser,
        parserOptions: { projectService: true, tsconfigRootDir: __dirname },
    },
    plugins: { "@typescript-eslint": tsPlugin },
    rules: {
      // a detached method (destructure, stored ref, callback) loses `this` at the call - attest detach-safe declarations with `this: void`, or declare them property-style
      "@typescript-eslint/unbound-method": "warn",
      // `delete arr[i]` leaves a hole (length unchanged) - use splice/filter
      "@typescript-eslint/no-array-delete": "warn",
      // for-in on arrays walks string keys (+ inherited props), not values - use for-of / .entries()
      "@typescript-eslint/no-for-in-array": "warn",
      // promises where values belong (conditionals, spreads); void-return check off - async onClick/handlers are idiomatic
      "@typescript-eslint/no-misused-promises": ["warn", { checksVoidReturn: false }],
    },
}]);