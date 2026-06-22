import { defineConfig } from "eslint/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";
import pluginCompat from "eslint-plugin-compat";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default defineConfig([{
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
}]);