import { NextApiRequest, NextApiResponse } from 'next';
import { default as NextAuth } from 'next-auth';

import { authBasicUsers, authCreateProviders, authType } from '@/modules/authentication/auth.server';


const authOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: authCreateProviders(),
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!authType)
    return res.status(200).send('Auth not enabled');

  if (Object.keys(authBasicUsers).length <= 0)
    res.status(200).send('Auth enabled but no users have been set up');

  return NextAuth(req, res, authOptions);
}