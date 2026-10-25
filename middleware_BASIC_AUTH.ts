/**
 * Middleware to protect `big-AGI` with HTTP Basic Authentication
 *
 * For more information on how to deploy with HTTP Basic Authentication, see:
 *  - [deploy-authentication.md](docs/deploy-authentication.md)
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';


// noinspection JSUnusedGlobalSymbols
export function middleware(request: NextRequest) {

  // Validate deployment configuration
  if (!process.env.HTTP_BASIC_AUTH_USERNAME || !process.env.HTTP_BASIC_AUTH_PASSWORD) {
    console.warn('HTTP Basic Authentication is enabled but not configured');
    return new Response('Unauthorized/Unconfigured', unauthResponse);
  }

  // Request client authentication if no credentials are provided
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Basic '))
    return new Response('Unauthorized', unauthResponse);

  // Request authentication if credentials are invalid: split on the first ':' only (passwords may contain
  // colons), decode as UTF-8, compare in constant time
  const base64Credentials = authHeader.slice('Basic '.length).trim();
  const credentials = Buffer.from(base64Credentials, 'base64').toString('utf8');
  const separator = credentials.indexOf(':');
  const username = separator > 0 ? credentials.slice(0, separator) : '';
  const password = separator > 0 ? credentials.slice(separator + 1) : '';
  if (
    !username || !password ||
    !_constantTimeEqual(username, process.env.HTTP_BASIC_AUTH_USERNAME) ||
    !_constantTimeEqual(password, process.env.HTTP_BASIC_AUTH_PASSWORD)
  )
    return new Response('Unauthorized', unauthResponse);

  return NextResponse.next();
}


/** Constant-time comparison, edge-runtime safe (no node:crypto). Length still leaks, as in every HTTP Basic implementation. */
function _constantTimeEqual(a: string, b: string): boolean {
  const ab = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  const n = Math.max(ab.length, bb.length);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < n; i++)
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}


// Response to send when authentication is required
const unauthResponse: ResponseInit = {
  status: 401,
  headers: {
    'WWW-Authenticate': 'Basic realm="Secure big-AGI"',
  },
};

export const config = {
  matcher: [
    // Include root
    '/',
    // Include pages
    '/(call|index|news|personas|link)(.*)',
    // Include API routes
    '/api(.*)',
    // Note: this excludes _next, /images etc..
  ],
};