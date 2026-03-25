# AGENTS_LOG

## 2026-03-22

### Quality and tooling hardening

- Replaced an invalid `as const` assertion in `src/apps/chat/components/ChatMessageList.tsx` with an explicit `DConversationTurnTerminationMode` value so type-checking stays green.
- Updated the brittle source-text tests around reasoning controls and council trace layout so they reflect the current generalized implementations.
- Switched `npm run lint` from deprecated `next lint` to the direct ESLint CLI with `--max-warnings=0`, and updated `npm run typecheck` to `next typegen && tsc --noEmit` so type checks do not depend on stale `.next/types` output.
- Upgraded direct vulnerable dependencies to `next`/`eslint-config-next`/`@next/bundle-analyzer` `15.5.14`, `@trpc/*` `11.14.1`, and `@posthog/nextjs-config` `1.8.23`.
- Added dependency overrides so the installed tree resolves `undici@7.24.5`, `underscore@1.13.8`, `flatted@3.4.2`, `minimatch@9.0.9`, and `minimatch@10.2.4`.
- Relaxed several UI source-snapshot tests (`ChatBarChat.test.ts`, `ChatDrawer.test.ts`, `useLLMDropdown.test.ts`, `AppChatSettingsUI.test.ts`) so formatting changes do not cause false failures.
- Added `.next-build-test/` to `.gitignore` because alternate Next build outputs are generated artifacts and should not dirty the worktree.
- Verified the final state with `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `npm audit --audit-level=moderate`.
- `npm audit --audit-level=moderate` reports 0 vulnerabilities after the dependency and override updates.
