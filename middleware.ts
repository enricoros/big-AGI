/**
 * Middleware to protect `big-AGI` with a password prompt
 *
 * For more information on how to deploy with password protection, see:
 *  - [deploy-authentication.md](docs/deploy-authentication.md)
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// noinspection JSUnusedGlobalSymbols
export function middleware(request: NextRequest) {
  // Validate deployment configuration
  if (!process.env.PAGE_PASSWORD) {
    console.warn('Page password is not configured');
    return new Response('Unconfigured', { status: 401 });
  }


const storedPassword = request.cookies.get('page-password')?.value;

  if (!storedPassword) {
    return NextResponse.redirect(new URL('/login', request.url,));
  }

  if (storedPassword !== process.env.PAGE_PASSWORD) {
    
    return NextResponse.redirect(new URL('/login?wrong=true', request.url));
    
  } 

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Include root
    '/',
    // Include pages
    '/(call|index|news|personas|link)(.*)',
    // Include API routes
    
    // Note: this excludes _next, /images etc..
  ],
};