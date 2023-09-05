import { authMiddleware } from '@clerk/nextjs';
import { HAS_AUTH } from 'auth';

function noopmiddleware() {}

// This example protects all routes including api/trpc routes
// Please edit this to allow other routes to be public as needed.
// See https://clerk.com/docs/references/nextjs/auth-middleware for more information about configuring your middleware
export default HAS_AUTH ? authMiddleware({}) : noopmiddleware;

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
