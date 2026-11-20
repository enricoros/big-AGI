/**
 * OpenRouter sign-in: OAuth with PKCE and state - https://openrouter.ai/docs/use-cases/oauth-pkce
 *
 * The callback page exchanges a code only for a flow this browser started: the pending flow (state + code verifier)
 * is stored before leaving for OpenRouter, the callback must bring back the same state, and the server sends the
 * verifier with the code. A crafted callback link carrying someone else's code therefore fails, instead of replacing
 * the user's key.
 *
 * localStorage, not sessionStorage: the callback page may load in a popup or after a full-page redirect.
 *
 * The pending flow has no expiry of its own: OpenRouter expires the code, 10 minutes from when it issues it, which
 * can be long after the sign-in started (an account created on the way). The next sign-in replaces a stale entry.
 */

import { convert_UInt8Array_To_Base64 } from '~/common/util/blobUtils';


const PENDING_FLOW_KEY = 'agi-openrouter-oauth-pending';

interface PendingFlow {
  state: string;
  codeVerifier: string;
}


/** Starts a sign-in: stores the pending flow and returns the OpenRouter authorization URL. Throws where it cannot hash or store. */
export async function openRouterOAuthBegin(callbackUrl: string): Promise<string> {
  if (!globalThis.crypto?.subtle) // secure contexts only
    throw new Error('this page must be served over HTTPS, or from localhost');

  const codeVerifier = _randomBase64Url(32); // 43 chars, within the 43-128 of RFC 7636
  const state = _randomBase64Url(16);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));

  const pending: PendingFlow = { state, codeVerifier };
  localStorage.setItem(PENDING_FLOW_KEY, JSON.stringify(pending));

  const authUrl = new URL('https://openrouter.ai/auth');
  authUrl.searchParams.set('callback_url', callbackUrl);
  authUrl.searchParams.set('code_challenge', _base64Url(new Uint8Array(digest)));
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('state', state); // returned unchanged on the callback URL
  return authUrl.toString();
}

/**
 * The code verifier of the pending flow that `state` belongs to, or null: no flow started here, or another flow.
 * Not consumed here (React Strict Mode mounts twice) - call openRouterOAuthEnd after the exchange.
 */
export function openRouterOAuthVerifierForState(state: string | undefined): string | null {
  if (!state) return null;
  try {
    const pending = JSON.parse(localStorage.getItem(PENDING_FLOW_KEY) || 'null') as PendingFlow | null;
    if (!pending || pending.state !== state)
      return null;
    return pending.codeVerifier;
  } catch {
    return null;
  }
}

/** Ends the pending flow, whatever the outcome of the exchange: codes are single-use. */
export function openRouterOAuthEnd(): void {
  try {
    localStorage.removeItem(PENDING_FLOW_KEY);
  } catch {
    // storage unavailable: nothing to clear
  }
}


function _randomBase64Url(byteCount: number): string {
  return _base64Url(crypto.getRandomValues(new Uint8Array(byteCount)));
}

function _base64Url(bytes: Uint8Array): string {
  return convert_UInt8Array_To_Base64(bytes, 'openrouter.oauth').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
