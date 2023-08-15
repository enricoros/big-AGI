import * as React from 'react';

import { Box, Typography } from '@mui/joy';

import { Brand } from '~/common/brand';
import { Link } from '~/common/components/Link';
import { clientUtmSource } from '~/common/util/pwaUtils';


// update this variable every time you want to broadcast a new version to clients
export const incrementalVersion: number = 4;

// news and feature surfaces
export const NewsItems: NewsItem[] = [
  {
    versionName: '1.3.5',
    items: [
      // { text: <>(Labs mode) YouTube personas creator</> },
      { text: <>Backup chats (export all)</> },
      { text: <>Import ChatGPT shared chats</> },
      { text: <>Cleaner, better, newer UI, including relative chats size</> },
      // -- version separator --
      { text: <>AI in the real world with <Typography color='success' sx={{ fontWeight: 600 }}>camera OCR</Typography> - MOBILE-ONLY</> },
      { text: <><Typography color='success' sx={{ fontWeight: 600 }}>Anthropic</Typography> models full support</> },
    ],
  },
  {
    versionName: '1.3.1',
    items: [
      { text: <><Typography color='success'>Flattener</Typography> - 4-mode conversations summarizer</> },
      { text: <><Typography color='success'>Forking</Typography> - branch your conversations</> },
      { text: <><Typography color='success'>/s</Typography> and <Typography color='success'>/a</Typography> to append a <i>system</i> or <i>assistant</i> message</> },
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
      { text: <Box sx={{ display: 'flex', alignItems: 'center' }}>Labs: experiments</Box> }, // ⚗️🧬🔬🥼 🥽🧪 <ScienceIcon sx={{ fontSize: 24, opacity: 0.5 }} />
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
