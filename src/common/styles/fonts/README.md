# Fonts

Inter 4.1 and JetBrains Mono 2.211 (Google Fonts `v20`, `v24`): the Google Fonts subset files, committed so the
build never calls Google. Variable weight axes: Inter 100-900, JetBrains Mono 400-800; no optical-size axis.
Loaded by `app.fonts.ts` through `next/font/local`, which emits them content-hashed and writes the Latin preloads.
The size-adjusted Arial fallback faces are pinned in `app.fonts.css`. Licensed SIL OFL 1.1: each folder's `OFL.txt`
must ship with its files.

## Update

1. Fetch the CSS with a desktop Chrome User-Agent (other agents get TTF or a different split):
   - `https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap`
   - `https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap`
2. Each `/* subset */ @font-face` block names a file; the four weights of a subset share one variable file.
   Save it as `<family>/<subset>.woff2` and check it starts with `wOF2`.
3. Copy each block's `unicode-range` into the matching call in `app.fonts.ts`. Keep Google's block order, and
   add or remove a call when Google adds or drops a subset. Update the versions above: font version from the
   file's name table, Google's from the `/vNN/` in the URL.
4. Verify with `next build`: one `static/media/*.woff2` per subset file, two of them preloaded (`.p`), and the
   app's computed font is `Inter` with `Inter Fallback` next.

Fallback faces: the values come from next/font's Google metrics table, frequency-weighted letter widths that measured
closer to real chat and code text than next/font/local's computed estimate. Recompute them after a font update with
`node -e "console.log(require('next/dist/server/font-utils').calculateSizeAdjustValues('Inter'))"` (and
`'JetBrains Mono'`), then update `app.fonts.css`.

Weights: the files carry the whole axis above whatever the URL requests; `weight` in `app.fonts.ts` limits what
the browser uses. Optical size (Inter `opsz` 14-32) needs `opsz,wght@14..32,...` in the URL and grows the Latin
file from 48 KB to 73 KB.
