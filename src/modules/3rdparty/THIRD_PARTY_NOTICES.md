# Third-Party Notices

This project includes third-party software components that are subject to separate license terms. These components are located in the `src/modules/3rdparty/` directory. Below is a list of the third-party components and their respective licensing information.

---

## t3-env

**Locations:**
- `src/modules/3rdparty/t3-env/index.ts`
- `src/modules/3rdparty/t3-env/env-core.ts`
- `src/modules/3rdparty/t3-env/standard.ts`

**Original Repository:** [t3-oss/t3-env](https://github.com/t3-oss/t3-env/tree/main)

**License:** [MIT](https://github.com/t3-oss/t3-env/tree/main?tab=MIT-1-ov-file#readme)

### Description

The folder contains source code from the @t3-oss/t3-env package, a library for managing environment variables.
The original code includes:

- Presets for various environments (which we didn't use)
- Support for standard schema parsers (we only use Zod)

### Purpose

- To reduce dependency on an external library
- To initially migrate to Zod4 without waiting for this library to be updated

### Source Files

- [index.ts](https://github.com/t3-oss/t3-env/blob/main/packages/nextjs/src/index.ts) (commit b13d46b)
- [env-core.ts](https://github.com/t3-oss/t3-env/blob/main/packages/core/src/index.ts) (commit b13d46b)
- [standard.ts](https://github.com/t3-oss/t3-env/blob/main/packages/core/src/standard.ts) (commit eb37304)

**Note:** All obligations under the MIT License are acknowledged and fulfilled
Users are advised to review the license terms of the original repository.
