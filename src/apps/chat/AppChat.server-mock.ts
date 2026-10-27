/**
 * `next dev` server compiler only (next.config.ts): stands in for AppChat, which the single-tab gate (ProviderSingleTab)
 * never renders on the server. Being rendered means a page bypasses the gate: fail the render loudly.
 */

// same value as in AppChat, imported by the chat bars
export const CHAT_NOVEL_TITLE = 'Chat';

export function AppChat(): never {
  throw new Error('[DEV] AppChat rendered on the server, but next dev compiles AppChat.server-mock in its place: this page bypasses the single-tab gate - drop its exemption or the mock in next.config.ts');
}
