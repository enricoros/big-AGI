# Third-Party Notices

This project includes third-party software components that are subject to separate license terms. These components are located in the `src/modules/3rdparty/` directory. Below is a list of the third-party components and their respective licensing information.

---

## Aider

**Locations:**

- `src/modules/3rdparty/aider/coderPrompts.ts`
- `src/modules/3rdparty/aider/editBlockPrompts.ts`
- `src/modules/3rdparty/aider/wholeFilePrompts.ts`

**Original Repository:** [Aider](https://github.com/paul-gauthier/aider)

**License:** Apache License 2.0

**License File:** [AIDER-LICENSE.txt](aider/AIDER-LICENSE.txt)

### Description

Portions of this project are derived from **Aider**, specifically:

- Base prompts and variables for code editing functionality.
- Prompt templates for code editing and whole file modifications.
- The prompts have been translated from Python to JavaScript and adapted for use in the Big-AGI project.

### Modifications

- Translated from Python to JavaScript.
- Adjusted prompts to fit the context and functionality of the Big-AGI project.
- Organized the derived code within the `src/modules/3rdparty/aider/` directory for modularity.

**Note:** The inclusion of Aider code in this project is solely for enhancing the code-diff functionality. All obligations under the Apache License 2.0 are acknowledged and fulfilled. Users are advised to review the license terms provided.

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
