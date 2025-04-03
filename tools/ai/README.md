# repo-structure.sh

Quick utility to generate a repository file structure in a format optimized for AI assistants. The output uses XML-style context tags with proper indentation for easy understanding of the directory hierarchy.

## Why?

Ever tried explaining a codebase to an AI assistant? This tool creates a compact, hierarchical representation of your Git repository that you can paste directly into an assistant prompt to provide immediate context.

## Usage

You need to be inside a Git repository to run this:

### Direct execution (recommended)

```bash
# From the repository root:
./tools/ai/repo-structure.sh

# Include hidden files (starting with .)
./tools/ai/repo-structure.sh --all

# Copy directly to clipboard
./tools/ai/repo-structure.sh --clipboard

# Save to a file
./tools/ai/repo-structure.sh --output repo-structure.xml
