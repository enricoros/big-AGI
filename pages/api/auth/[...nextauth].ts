import CredentialsProvider from 'next-auth/providers/credentials';

import { authNeeded, authUserData } from '@/lib/auth';
import { NextApiRequest, NextApiResponse } from 'next';
import NextAuth from 'next-auth';


const authOptions = {
  secret: process.env.NEXTAUTH_SECRET,

  providers: authNeeded ? [

    CredentialsProvider({
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },

      async authorize(credentials, req) {
        const username = credentials?.username;
        const password = credentials?.password;

        // Check if credentials are valid
        if (username && password) {
          const user = authUserData[username] ?? null;
          if (user?.password === password) {
            return {
              id: user.username,
            };
          }
        }

        // If credentials are invalid, return null
        return null;
      },
    }),

  ] : [],

};

if (process.env.NODE_ENV !== 'development') {
  // say this once
  let message = process.env.OPENAI_API_KEY
    ? 'OPENAI_API_KEY has been provided. '
    : '';
  message += authNeeded
    ? Object.keys(authUserData).length > 0
      ? 'Info: AUTH_TYPE has been provided and users have been set up. '
      : 'Warning: AUTH_TYPE has been provided but no users have been set up. '
    : 'However, an AUTH_TYPE has not been provided. This means that anyone can use your OpenAI API and incur costs. ';
  console.warn(message);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!authNeeded) {
    res.status(200).send('Auth not enabled');
  } else if (Object.keys(authUserData).length <= 0) {
    res.status(200).send('Auth enabled but no users have been set up');
   } else {
    return NextAuth(req, res, authOptions);
  }
}