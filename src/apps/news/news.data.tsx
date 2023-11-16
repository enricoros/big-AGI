import * as React from 'react';

import { Box, Typography } from '@mui/joy';

import { Brand } from '~/common/app.config';
import { Link } from '~/common/components/Link';
import { clientUtmSource } from '~/common/util/pwaUtils';


// update this variable every time you want to broadcast a new version to clients
export const incrementalVersion: number = 5;

const B = (props: { children: React.ReactNode }) => <Typography color='danger' sx={{ fontWeight: 600 }}>{props.children}</Typography>;

// news and feature surfaces
export const NewsItems: NewsItem[] = [
  /*{
    versionName: 'NEXT',
    items: [
      { text: <>CloudFlare OpenAI API Gateway</> },
      { text: <>Helicone Anthropic support</> },
      { text: <>Highlight differneces (Labs)</> },
      { text: <>(Labs mode) YouTube personas creator</> },
    ],
  },*/
  {
    versionName: '1.4.0',
    items: [
      { text: <><B>Share and clone</B> conversations, with public links</> },
      { text: <><B>Azure</B> models <Link href='https://github.com/enricoros/big-agi/blob/main/docs/config-azure-openai.md' target='_blank'>full support</Link>, incl. gpt-4-32k</> },
      { text: <><B>OpenRouter</B> models full support, incl. gpt-4-32k</> },
      { text: <>Latex Rendering</> },
      { text: <>Augmented Chat modes (Labs)</> },
    ],
  },
  {
    versionName: '1.3.5',
    items: [
      { text: <>AI in the real world with <B>Camera OCR</B> - MOBILE-ONLY</> },
      { text: <><B>Anthropic</B> models full support</> },
      { text: <>Removed the 20 chats hard limit</> },
      { text: <>Backup chats (export all)</> },
      { text: <>Import ChatGPT shared chats</> },
      { text: <>Cleaner, better, newer UI, including relative chats size</> },
    ],
  },
  {
    versionName: '1.3.1',
    items: [
      { text: <><B>Flattener</B> - 4-mode conversations summarizer</> },
      { text: <><B>Forking</B> - branch your conversations</> },
      { text: <><B>/s</B> and <B>/a</B> to append a <i>system</i> or <i>assistant</i> message</> },
      { text: <>Local LLMs with <Link href='https://github.com/enricoros/big-agi/blob/main/docs/config-local-oobabooga.md' target='_blank'>Oobabooga server</Link></> },
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
