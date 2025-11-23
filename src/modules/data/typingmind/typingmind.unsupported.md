# TypingMind Import - Unsupported Features

This document explains what TypingMind features are not imported and why.

## Folders

**TypingMind Feature:** Chats can be organized into folders with hierarchical structure.

**Why Not Imported:** Big-AGI currently uses a different organization system. All chats are imported to the root level. The folder structure from TypingMind is not preserved.

**Future:** If Big-AGI implements folder/tagging functionality, this could be revisited.

## User Prompts

**TypingMind Feature:** Custom prompt library with variables, tags, and favorites.

**Why Not Imported:** Big-AGI has a different prompt/persona system. TypingMind prompts use a different variable syntax (`{field}`, `{{action}}`) and organization model.

**Alternative:** Users can manually recreate important prompts in Big-AGI's persona system.

## User Characters / AI Personas

**TypingMind Feature:** Custom AI characters with system instructions, conversation starters, default models, training data, and voice settings.

**Why Not Imported:** Big-AGI has its own persona system with different capabilities and structure. TypingMind characters include features like:
- Enforced model selection
- Speech synthesis settings (ElevenLabs, OpenAI TTS)
- Plugin assignments
- Training file attachments

These don't have direct equivalents in Big-AGI's current architecture.

**Alternative:** Users can manually recreate character behaviors using Big-AGI's persona system.

## Installed Plugins / Tools

**TypingMind Feature:** Custom plugins with JavaScript code, HTTP actions, and OpenAI function specs (web search, image generation, research tools, etc.).

**Why Not Imported:** Plugin architectures are fundamentally incompatible:
- TypingMind uses JavaScript execution and HTTP actions
- Big-AGI has its own tool/integration system
- Security model differences

**Result:** Only text messages are imported. Any tool/plugin invocations or results in the chat history are preserved as text content.

## Attachments and Images

**TypingMind Feature:** File attachments and images uploaded to chats, with blob storage.

**Why Not Imported:** TypingMind's export feature has a known bug where attachments are not included in the export, despite being referenced in the JSON. The JSON contains public URLs to images, but:
- URLs may expire or become inaccessible
- Downloading from external URLs introduces privacy/security concerns
- No guarantee the files still exist

**Current Behavior:** Image and file references appear as text mentions in the imported messages (e.g., `[Image: url]` or `[File: filename]`).

**Future:** If TypingMind fixes their export to include attachments, this feature could be implemented with:
- User consent for downloading external resources
- Rate limiting to respect server constraints
- Local storage of downloaded assets

## Token Usage and Cost Tracking

**TypingMind Feature:** Detailed token usage and cost tracking per chat, including cached tokens and reasoning tokens.

**Why Not Imported:** Big-AGI has its own token counting and cost tracking system. Historical cost data from TypingMind is not carried over.

**Result:** Imported chats will have token counts recalculated by Big-AGI's system.

## Model Parameters and Settings

**TypingMind Feature:** Per-chat model parameters (context limit, streaming, output settings, system message templates with variables).

**Why Not Imported:** These are session-specific settings that don't transfer meaningfully:
- Big-AGI users select models interactively
- System messages use a different variable system
- Output tone/language/style/format settings are TypingMind-specific

**Result:** Imported chats use Big-AGI's default model and settings.
