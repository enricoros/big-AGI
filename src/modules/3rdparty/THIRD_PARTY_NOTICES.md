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
