'use server';
'server-only';

import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from '@clerk/nextjs/server';

export function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const user = getAuth(req);
    console.log(`User: ${JSON.stringify(user)}`);
    const { userId = null } = user;
    console.log`userId: ${userId}`;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    console.log(JSON.stringify(user));

    // retrieve data from your database

    return res.status(200).json({});
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error - I blame Bloogson' });
  }
}

export default handler;
