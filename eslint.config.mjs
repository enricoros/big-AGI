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