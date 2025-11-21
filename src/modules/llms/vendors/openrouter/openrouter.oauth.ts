// /**
//  * OpenRouter OAuth PKCE utilities
//  *
//  * Implements Proof Key for Code Exchange (PKCE) for secure OAuth flow
//  * Reference: https://openrouter.ai/docs/use-cases/oauth-pkce
//  */
//
// /**
//  * Generates a cryptographically secure random string for PKCE code_verifier
//  * @param length - Length of the verifier (43-128 characters recommended)
//  */
// export function generateCodeVerifier(length: number = 64): string {
//   const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
//   const randomValues = new Uint8Array(length);
//   crypto.getRandomValues(randomValues);
//
//   return Array.from(randomValues)
//     .map(v => charset[v % charset.length])
//     .join('');
// }
//
// /**
//  * Creates a SHA-256 hash of the code verifier and returns base64url-encoded string
//  * @param codeVerifier - The code verifier string
//  * @returns Promise<string> - base64url-encoded SHA-256 hash (code_challenge)
//  */
// export async function createSHA256CodeChallenge(codeVerifier: string): Promise<string> {
//   const encoder = new TextEncoder();
//   const data = encoder.encode(codeVerifier);
//   const hash = await crypto.subtle.digest('SHA-256', data);
//
//   // Convert to base64url encoding (RFC 4648)
//   return base64urlEncode(hash);
// }
//
// /**
//  * Converts ArrayBuffer to base64url string (RFC 4648)
//  */
// function base64urlEncode(buffer: ArrayBuffer): string {
//   const bytes = new Uint8Array(buffer);
//   let binary = '';
//   for (let i = 0; i < bytes.byteLength; i++) {
//     binary += String.fromCharCode(bytes[i]);
//   }
//
//   return btoa(binary)
//     .replace(/\+/g, '-')
//     .replace(/\//g, '_')
//     .replace(/=/g, '');
// }
//
// /**
//  * Storage keys for PKCE flow state
//  */
// export const OPENROUTER_PKCE_STORAGE = {
//   CODE_VERIFIER: 'openrouter_code_verifier',
//   CODE_CHALLENGE_METHOD: 'openrouter_code_challenge_method',
// } as const;
//
// /**
//  * Stores PKCE state in localStorage for later retrieval during callback
//  *
//  * Note: We use localStorage instead of sessionStorage because:
//  * 1. sessionStorage doesn't persist across redirects in some browsers
//  * 2. The code_verifier is only valid for ~10 minutes (OpenRouter's OAuth timeout)
//  * 3. We clear it immediately after use for security
//  */
// export function storePKCEState(codeVerifier: string, method: 'S256' = 'S256'): void {
//   try {
//     localStorage.setItem(OPENROUTER_PKCE_STORAGE.CODE_VERIFIER, codeVerifier);
//     localStorage.setItem(OPENROUTER_PKCE_STORAGE.CODE_CHALLENGE_METHOD, method);
//   } catch (error) {
//     console.error('[OpenRouter PKCE] Failed to store state:', error);
//     throw new Error('Unable to store OAuth state. Please check browser storage permissions.');
//   }
// }
//
// /**
//  * Retrieves PKCE state from localStorage WITHOUT clearing it
//  * (clearing happens after successful token exchange to handle React Strict Mode double-mounting)
//  * @returns Object with codeVerifier and method, or null if not found
//  */
// export function retrievePKCEState(): { codeVerifier: string; method: string } | null {
//   try {
//     const codeVerifier = localStorage.getItem(OPENROUTER_PKCE_STORAGE.CODE_VERIFIER);
//     const method = localStorage.getItem(OPENROUTER_PKCE_STORAGE.CODE_CHALLENGE_METHOD);
//     return (codeVerifier && method) ? { codeVerifier, method } : null;
//   } catch (error) {
//     console.error('[OpenRouter PKCE] Failed to retrieve state:', error);
//     return null;
//   }
// }
//
// /**
//  * Clears PKCE state from localStorage after successful exchange
//  */
// export function clearPKCEState(): void {
//   try {
//     localStorage.removeItem(OPENROUTER_PKCE_STORAGE.CODE_VERIFIER);
//     localStorage.removeItem(OPENROUTER_PKCE_STORAGE.CODE_CHALLENGE_METHOD);
//   } catch (error) {
//     console.error('[OpenRouter PKCE] Failed to clear state:', error);
//   }
// }
