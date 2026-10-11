# Export for Claude Code

SHIPPED. Per-chat export that lets Claude Code, or any coding agent, resume a big-AGI chat or work on it as
files. The contract of record is `ClaudeCodeExport` in the trade module; this doc owns the two file
formats, which outside readers consume, and the Claude Code behavior they rely on.

## Why

Agents work on files and sessions, not on a browser database. Two needs, two formats: continue a chat
inside Claude Code (session), and hand an agent a chat to read, search and edit (folder). The export is
honest about loss: the dialog shows what is exported and what is not (reasoning never is), and anything
the exporter cannot represent becomes a one-line placeholder instead of vanishing.

## Formats

**Session** (`.jsonl`): a Claude Code transcript, resumed with `claude --resume <file>`. One line per turn
linked by `parentUuid`, then a `custom-title` line, since the resume picker reads the file tail. Assistant
turns carry `model: '<synthetic>'`, Claude Code's own marker for turns not from its API. The first user
turn opens with a preamble naming the source chat and the models that answered, plus the original system
prompt (option). Images travel inline, assistant-generated ones in the following user turn, because the
Messages API accepts images from the user only.

**Folder** (zip, schema `vnd.agi.chat-folder` v1, stamped in the `chat.md` front matter): one top-level
folder per chat named `YYYY-MM-DD-title-slug-id8`, stable across re-exports, with no shared files, so any
number of exports extract into one parent. Inside: `chat.md` (one section per message, each anchored by
message id and time), `images/` (named by message position), `chat.agi.json` (importable on main and dev
through the schema-less single-chat path), and optionally the session. Images inside `chat.agi.json`
still point to device-local blobs: on another device the chat imports without them.

## Claude Code behavior relied on

Measured on Claude Code 2.1.296 with `claude -p "<question>" --no-session-persistence --resume <file>
--tools ""` (the prompt goes first: `--tools` is variadic):
- `--resume` accepts a `.jsonl` path from any folder (undocumented) and assigns a new session id; nothing
  is written under `~/.claude/projects`
- loads `<synthetic>` and foreign model ids, a non-existent `cwd`, no `gitBranch`, inline images, a
  trailing user turn, fake-signature thinking, and foreign `tool_use`/`tool_result` pairs
- interactive resume works the same (checked by hand)

When Claude Code changes its transcript shape, re-run these probes and bump the version constant the
exporter stamps.

## Gaps

- One chat per export. Multi-chat export (current folder, all chats) is PROPOSED; the folder naming
  already allows it.
- No way back in: importing a folder with its images, or a Claude Code session as a chat, is not built.
- Images are not resized: one over the API size limit fails the resumed session, as it would in the chat.
- Hosted files and audio are not exported; persona names are not shown, as the system prompt carries the
  persona.
