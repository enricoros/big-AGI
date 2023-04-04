import { NextApiRequest, NextApiResponse } from 'next';
import Airtable from 'airtable';

const apiKey = process.env.AIRTABLE_API_KEY;
const baseId = process.env.AIRTABLE_BASE_ID;

if (!apiKey) {
  throw new Error('AIRTABLE_API_KEY is not defined in .env');
}

if (!baseId) {
  throw new Error('AIRTABLE_BASE_ID is not defined in .env');
}

const base = new Airtable({ apiKey }).base(baseId);

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    base('Table 1')
      .select({})
      .firstPage((error, records) => {
        if (error) {
          res.status(500).json({ message: 'Failed to fetch data from Airtable' });
          return;
        }
        const data = records?.map((record) => ({
          id: record.id,
          title: record.get('Title'),
          description: record.get('Description'),
        }));
        res.status(200).json({ data });
      });
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}
