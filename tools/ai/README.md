## `repo-structure.sh`

This tool creates a compact, hierarchical representation of your Git repository that you can
paste directly into an assistant prompt to provide immediate context. Uses the XML format of
Claude Code.

### Remote Execution

```bash
# Run this from the ROOT of your git repository
curl -fsSL https://raw.githubusercontent.com/enricoros/big-AGI/v2-dev/tools/ai/repo-structure.sh | sh
```

## Options

- `-a, --all`: Include hidden files and directories
- `-o, --output FILE`: Save output to a file
- `-h, --help`: Show help message

Example with options (include hidden files):

- `curl -fsSL https://raw.githubusercontent.com/enricoros/big-AGI/v2-dev/tools/ai/repo-structure.sh | sh -s -- -a`

## Requirements

- Bash 4+ (for associative arrays)
- Git (the repository must be initialized)
- For clipboard functionality:
  - macOS: pbcopy (built-in)
  - Linux: xclip or xsel
  - Windows: clip (Git Bash)

## How does the output look?

The output is specifically formatted for easy consumption by AI assistants:

```xml
<context name="directoryStructure" description="Below is a snapshot of this project root file structure (git ls-files) at the start of the conversation. This snapshot will NOT update during the conversation.">
- README.md
- src/
  - app/
    - components/
      - Button.tsx
  ...
</context>
```

Just paste this into your AI assistant's prompt for instant context about the codebase structure.
