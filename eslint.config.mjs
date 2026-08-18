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
//     // eslint's own base layer (no-dupe-keys, no-cond-assign, no-fallthrough, ...) - next/core-web-vitals
//     // does NOT include it; until 2026-07 `js` was only imported as FlatCompat's resolver, never applied
//     ...js.configs.recommended,
//     rules: {
//         ...js.configs.recommended.rules,
//         // floods on TS (unused params in signatures, `_exhaustiveCheck`, catch bindings); tsc is the checker here
//         "no-unused-vars": "off",
//         // unbraced-case `const` is house style; tsc already errors on the dangerous cases (cross-case redeclare, TDZ reads)
//         "no-case-declarations": "off",
//     },
// }, {
    // ...minus the core rules the TS compiler already enforces (no-undef, no-dupe-keys, no-redeclare, ...):
    // they false-positive on TS constructs. Scoped to **/*.ts(x) by the config itself.
    ...tsPlugin.configs['flat/eslint-recommended'],
    rules: {
        ...tsPlugin.configs['flat/eslint-recommended'].rules,

        // NOTE: We may work on this one, not sure if there's perf impact or it's just cosmetic/semantic
        // disable prefer-const for now
        "prefer-const": "off",
    },
}, {
    extends: compat.extends("next/core-web-vitals"),
    rules: {
        // intentional empty catches (fire-and-forget cleanup) are house style
        "no-empty": ["error", { allowEmptyCatch: true }],

        // 2026-07-31 adoption backlog: base-layer rules with real findings at adoption time; promote each to error (default) as its count hits zero
        // "prefer-const": "warn",                 // 88 - one `eslint . --fix` commit
        // "no-useless-escape": "warn",            // 11 - over-escaped chars in strings/regexes
        // "no-extra-boolean-cast": "warn",        // 8 - auto-fixable
        // "no-prototype-builtins": "warn",        // x.hasOwnProperty(y) -> Object.hasOwn(x, y)
        "no-async-promise-executor": "warn",    // async executor swallows rejections (promise never settles)
        "no-unsafe-optional-chaining": "warn",  // ?. when already guarded for
        "no-empty-pattern": "warn",             // ({})
        "valid-typeof": "warn",                 // typeof X must be compared to a string literal
        "no-constant-binary-expression": "warn",// fixed with above
        "no-control-regex": "warn",             // NUL-byte sanitizer regex (annottated)
        "prefer-rest-params": "warn",           // do not use `arguments` in TS

        // Big-AGI hook
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
        polyfills: ["requestIdleCallback", "Intl.Segmenter", "ClipboardItem", "navigator.wakeLock"],
    },
}, {
    // Node-side code (tools/ scripts, the src tests that run under tsx): the browserslist floor
    // does not apply - same split as the tools tsconfig project
    files: ["tools/**", "**/*.test.ts"],
    rules: {
        "compat/compat": "off",
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

      // NOTE: Useful
      // // a switch over a union must name every member - a new union member with a forgotten arm is a silent distributed-contract bug; attest intentional partial switches with a `default`
      // "@typescript-eslint/switch-exhaustiveness-check": ["warn", { considerDefaultExhaustiveForUnions: true }],

      // NOTE: Not very useful, we are already okay with these - may replace the `fire/forget` text with `void`
      // // un-awaited, un-`void`ed promise: rejections become unhandled (= PostHog noise); `void x()` attests fire-and-forget
      // "@typescript-eslint/no-floating-promises": "warn",

      // NOTE: Auto-Fix; this is just input noise
      // // `as` that changes nothing - house rule ("no unnecessary TS casts") made mechanical; auto-fixable
      // "@typescript-eslint/no-unnecessary-type-assertion": "warn",

      // NOTE (5): 1 positive in AudioPlayer and a bunch of FPs
      // // `${obj}` on a type without a real toString prints "[object Object]"
      // "@typescript-eslint/no-base-to-string": "warn",

      // NOTE (57): Must look into this - not sure they're all okay to auto-fix
      // // `return promise` inside try escapes the catch; `return await` doesn't - auto-fixable
      // "@typescript-eslint/return-await": ["warn", "in-try-catch"],

      // NOTE (1): Shall fix
      // // thrown non-Errors arrive stackless as `{}` through serializeError -> PostHog
      // "@typescript-eslint/only-throw-error": "warn",

      // NOTE (3): Shall fix
      // // `await` on a non-thenable is a no-op typo
      // "@typescript-eslint/await-thenable": "warn",

      // IGNORE (44)
      // // upgrade-debt radar: flags uses of @deprecated APIs, ours and dependencies'
      // "@typescript-eslint/no-deprecated": "warn",
    },
},
// // module-cycle detection (`npm run lint:cycles`) - full import-graph traversal, too slow for the
// // default lint; machine-checks what code comments enforce today ("value imports referenced only
// // inside function bodies"). Deliberate lazy-value cycles get an eslint-disable with rationale.
// // started by (tba) `"lint:cycles": "cross-env LINT_IMPORT_CYCLES=1 eslint src",` in package.json
// ...(process.env.LINT_IMPORT_CYCLES ? [{
//     files: ["src/**/*.ts", "src/**/*.tsx"],
//     rules: {
//         "import/no-cycle": ["warn", { ignoreExternal: true }],
//     },
// }] : []),
]);