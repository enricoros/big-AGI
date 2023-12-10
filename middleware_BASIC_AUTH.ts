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

  // Request authentication if credentials are invalid
  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
  const [username, password] = credentials.split(':');
  if (
    !username || !password ||
    username !== process.env.HTTP_BASIC_AUTH_USERNAME ||
    password !== process.env.HTTP_BASIC_AUTH_PASSWORD
  )
    return new Response('Unauthorized', unauthResponse);

  return NextResponse.next();
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