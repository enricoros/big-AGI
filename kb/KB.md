# Knowledge Base

Internal documentation for Big-AGI architecture and systems, for use by AI agents and developers.

**Structure:**
- `/kb/modules/` - Core business logic (e.g. AIX)
- `/kb/systems/` - Infrastructure (routing, startup)

## Index

### Modules Documentation

#### AIX - AI Communication Framework
- **[AIX.md](modules/AIX.md)** - AIX streaming architecture documentation
- **[AIX-callers-analysis.md](modules/AIX-callers-analysis.md)** - Analysis of AIX entry points, call chains, common and different rendering, error handling, etc.

### Systems Documentation

#### Core Platform Systems
- **[app-routing.md](systems/app-routing.md)** - Next.js routing, provider stack, and display state hierarchy
- **[LLM-parameters-system.md](systems/LLM-parameters-system.md)** - Language model parameter flow across the system

## Guidelines

### Writing Style

- **Direct and factual** - No marketing language
- **Present tense** - "AIX handles streaming" not "AIX will handle"
- **Active voice** - "The system processes" not "Processing is done by"
- **Concrete examples** - Show actual code/config when helpful, briefly

### Maintenance

- Remove outdated information when detected!
- Keep cross-references current when files move
