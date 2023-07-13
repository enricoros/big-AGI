import * as React from 'react';

import { Box } from '@mui/joy';

import { Brand } from '~/common/brand';
import { Link } from '~/common/components/Link';
import { clientUtmSource } from '~/common/util/pwaUtils';


// update this variable every time you want to broadcast a new version to clients
export const incrementalVersion: number = 1;

// news and feature surfaces
export const NewsItems: NewsItem[] = [
  {
    versionName: '1.2.1',
    // text: '',
    items: [
      { text: <>New home page: <b><Link href={Brand.URIs.Home + clientUtmSource()} target='_blank'>{Brand.URIs.Home.replace('https://', '')}</Link></b></> },
      { text: 'Support 𝑓unction models' }, // (n)
      { text: <Box sx={{ display: 'flex', alignItems: 'center' }}>Goofy labs: experiments</Box> }, // ⚗️🧬🔬🥼 🥽🧪 <ScienceIcon sx={{ fontSize: 24, opacity: 0.5 }} />
    ],
  },
];


interface NewsItem {
  versionName: string;
  text?: string | React.JSX.Element;
  items?: {
    text: string | React.JSX.Element;
  }[];
}
