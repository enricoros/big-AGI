import packageJson from '../../../../package.json';

import { BaseProduct } from '~/common/app.release';


/**
 * Outbound app identity for LLM vendor requests - otherwise we go out as the runtime default
 * ('User-Agent: node' on undici). Applied by the AIX executor and inside the Bedrock signer.
 *
 * Empty in the browser: on the CSF path a custom header forces a CORS preflight that several vendor
 * hosts reject (Gemini 403s it) - see kb/systems/client-side-fetch.md. Attribution that must ride
 * the browser path goes in that vendor's access builder instead.
 */
export const LLM_APP_IDENTITY_HEADERS: Readonly<Record<string, string>> = typeof window !== 'undefined' ? {} : {
  'User-Agent': `${BaseProduct.ProductName}/${packageJson.version} (${BaseProduct.ProductURL})`, // 'name/version (url)' - the shape Stripe/Wikimedia/crates.io prescribe (no '+', that reads as a crawler)
  'HTTP-Referer': BaseProduct.ProductURL, // OpenRouter's attribution convention, inert elsewhere
  // 'X-Title': BaseProduct.ProductName, // not useful, really
};

/**
 * Adds identity, skipping vendor-set names case-insensitively: Bedrock's signer lowercases, and a
 * 'HTTP-Referer' + 'http-referer' pair is sent as one combined value, breaking the signature.
 */
export function llmAppIdentityHeaders(vendorHeaders: HeadersInit): HeadersInit {
  const headers = vendorHeaders as Record<string, string>;
  const presentLowercase = new Set(Object.keys(headers).map(name => name.toLowerCase()));
  const identity = Object.entries(LLM_APP_IDENTITY_HEADERS).filter(([name]) => !presentLowercase.has(name.toLowerCase()));
  return !identity.length ? headers : { ...Object.fromEntries(identity), ...headers };
}
