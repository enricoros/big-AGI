import { withAuth } from 'next-auth/middleware';

import { authType } from '@/modules/authentication/auth.server';


// noinspection JSUnusedGlobalSymbols
export const middleware = !authType ? () => null : withAuth({
  callbacks: {
    authorized({ req, token }) {
      // console.log('authorized', req, token);
      return !!token;
    },
  },
});

export const config = { matcher: ['/:path*'] };
