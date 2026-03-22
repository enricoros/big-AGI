# AGENTS_LOG

## 2026-03-22

### Baseline quality repair

- Replaced an invalid `as const` assertion in `src/apps/chat/components/ChatMessageList.tsx` with an explicit `DConversationTurnTerminationMode` value so `npx tsc --noEmit` passes again.
- Updated brittle source-structure tests in `src/apps/chat/components/layout-bar/useLLMDropdown.test.ts` and `src/apps/chat/components/message/CouncilTraceMessage.layout.test.ts` to match the current generalized reasoning-control and council-trace layout implementations.
- Added `npm run typecheck`, `npm test`, `npm run format:check`, and `npm run format:write` in `package.json`, plus a minimal `.prettierignore`, and updated `docs/installation.md` to reference the current quality commands.
- Verified the baseline with `npm run lint`, `npx tsc --noEmit`, `npm run test:node`, `npm run typecheck`, and `npm test`.
- `npm run format:check` still reports a large existing backlog: 1,039 files are not Prettier-clean. I left that as an explicit follow-up instead of auto-formatting the entire repository in the same change set.
