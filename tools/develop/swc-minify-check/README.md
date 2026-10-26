# SWC minify check

`next build` minifies with SWC; `next dev`, tsc, lint and tests never do, so a minifier miscompile only shows in
production. These two checks run real source through the minify step of the installed Next.

Run them after any Next or SWC upgrade, or when production behaves differently from dev.

## Usage (from the repo root)

```bash
node tools/develop/swc-minify-check/cases.mjs     # listed functions: minified vs source, case by case
node tools/develop/swc-minify-check/dropped.mjs   # all of src/: reachable code the minifier deleted
```

Both print the Next version they ran against and exit 1 on a finding.

**cases.mjs** compiles each function listed in `cases/` from its real source, calls it unminified and minified on
every case, and prints a `MISMATCH` line where the two disagree, or where the source disagrees with the case's expected
value. `--source <path>` runs one case file against another copy of the source, such as an older version.
To cover a function, add `cases/<name>.mjs` like `cases/messageTerminalOutcome.mjs`: source path, export, stubs for its
imports, cases.

**dropped.mjs** puts a marker after every compound statement and at every function entry, minifies each file with
Next's SWC and with Terser, and prints a `SUSPECT` line for a marker SWC removed while Terser kept it, TypeScript sees
the code as reachable, and the function itself survived. Pass files or folders to narrow it.

## Limits

- One file at a time: no cross-module inlining, no DefinePlugin values.
- The TS transform approximates Next's loader (ES2022, CommonJS); the minify options mirror Next's
  `minify-webpack-plugin` and need a recheck after a Next upgrade (see `nextswc.mjs`).
- `dropped.mjs` sees deleted code only, not code kept but computed wrong; `cases.mjs` sees only the listed functions.
- `dropped.mjs` skips code gated by a file-level literal constant (`const FLAG = false`): SWC folds it on purpose.
- The known miscompiled shapes are a lint error: `tools/eslint/swc-miscompile.mjs`.
