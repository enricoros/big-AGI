import { withAuth } from 'next-auth/middleware';
import { authNeeded } from '@/lib/auth';

export const middleware = !authNeeded ? () => null : withAuth({
  callbacks: {
    authorized({ req, token }) {
      // console.log('authorized', req, token);
      return !!token;
    },
  },
});

export const config = { matcher: ['/:path*'] };
