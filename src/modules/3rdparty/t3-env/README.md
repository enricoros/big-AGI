# Project: t3-env
This folder contains source code from the @t3-oss/t3-env package, a library for
managing environment variables. Comes with presets for various environments (which
we didn't use) and support for standard schema parsers (we only use Zod)

Purpose: to reduce dependency on an external library, and initially migrate to Zod4 without
waiting for this library to be updated.

Upstream Source: https://github.com/t3-oss/t3-env/tree/main
Upstream License: MIT (2025 Julius Marminge, see LICENSE of the upstream project)
Files imported:
- https://github.com/t3-oss/t3-env/blob/main/packages/nextjs/src/index.ts (b13d46b)
- https://github.com/t3-oss/t3-env/blob/main/packages/core/src/index.ts (b13d46b)
- https://github.com/t3-oss/t3-env/blob/main/packages/core/src/standard.ts (eb37304)
