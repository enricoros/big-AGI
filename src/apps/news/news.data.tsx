import * as React from 'react';

import {Box, Typography} from '@mui/joy';

import { Brand } from '~/common/brand';
import { Link } from '~/common/components/Link';
import { clientUtmSource } from '~/common/util/pwaUtils';


// update this variable every time you want to broadcast a new version to clients
export const incrementalVersion: number = 2;

// news and feature surfaces
export const NewsItems: NewsItem[] = [
  {
    versionName: '1.3.1',
    items: [
      { text: <><Typography color='info'>Flattener</Typography> - 4-mode conversations summarizer</> },
      { text: <><Typography color='info'>Forking</Typography> - branch your conversations</> },
      { text: <><Typography color='info'>/s</Typography> and <Typography color='info'>/a</Typography> to append a <i>system</i> or <i>assistant</i> message</> },
      { text: <>Local LLMs with <Link href='https://github.com/enricoros/big-agi/blob/main/docs/local-llm-text-web-ui.md' target='_blank'>Oobabooga server</Link></> },
      { text: 'NextJS STOP bug.. squashed, with Vercel!' },
    ],
  },
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
