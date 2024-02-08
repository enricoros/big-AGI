import * as React from 'react';
import { StaticImageData } from 'next/image';

import { SxProps } from '@mui/joy/styles/types';
import { Box, Button, Card, CardContent, Chip, Grid, Typography } from '@mui/joy';
import LaunchIcon from '@mui/icons-material/Launch';

import { Brand } from '~/common/app.config';
import { Link } from '~/common/components/Link';
import { clientUtmSource } from '~/common/util/pwaUtils';
import { platformAwareKeystrokes } from '~/common/components/KeyStroke';

// Images
// An image of a capybara sculpted entirely from black cotton candy, set against a minimalist backdrop with splashes of bright, contrasting sparkles. The capybara is calling on a 3D origami old-school pink telephone and the camera is zooming on the telephone. Close up photography, bokeh, white background.
import coverV113 from '../../../public/images/covers/release-cover-v1.13.0.png';
import coverV112 from '../../../public/images/covers/release-cover-v1.12.0.png';


// update this variable every time you want to broadcast a new version to clients
export const incrementalVersion: number = 13;


const wowStyle: SxProps = {
  textDecoration: 'underline',
  textDecorationThickness: '0.4em',
  textDecorationColor: 'rgba(var(--joy-palette-primary-lightChannel) / 1)',
  // textDecorationColor: 'rgba(0 255 0 / 0.5)',
  textDecorationSkipInk: 'none',
  // textUnderlineOffset: '-0.5em',
};

function B(props: {
  // one-of
  href?: string,
  issue?: number,
  code?: string,

  wow?: boolean,
  children: React.ReactNode
}) {
  const href =
    props.issue ? `${Brand.URIs.OpenRepo}/issues/${props.issue}`
      : props.code ? `${Brand.URIs.OpenRepo}/blob/main/${props.code}`
        : props.href;
  const boldText = (
    <Typography component='span' color={!!href ? 'primary' : 'neutral'} sx={{ fontWeight: 600 }}>
      {props.children}
    </Typography>
  );
  if (!href)
    return boldText;
  return (
    <Link href={href + clientUtmSource()} target='_blank' sx={props.wow ? wowStyle : undefined}>
      {boldText} <LaunchIcon sx={{ mx: 0.5, fontSize: 16 }} />
    </Link>
  );
}


// callout, for special occasions
export const newsRoadmapCallout =
  <Card variant='solid' invertedColors>
    <CardContent sx={{ gap: 2 }}>
      <Typography level='title-lg'>
        Open Roadmap
      </Typography>
      <Typography level='body-sm'>
        Take a peek at our roadmap to see what&apos;s in the pipeline.
        Discover upcoming features and let us know what excites you the most!
      </Typography>
      <Grid container spacing={1}>
        <Grid xs={12} sm={7}>
          <Button
            fullWidth variant='soft' color='primary' endDecorator={<LaunchIcon />}
            component={Link} href={Brand.URIs.OpenProject} noLinkStyle target='_blank'
          >
            Explore
          </Button>
        </Grid>
        <Grid xs={12} sm={5} sx={{ display: 'flex', flexAlign: 'center', justifyContent: 'center' }}>
          <Button
            fullWidth variant='plain' color='primary' endDecorator={<LaunchIcon />}
            component={Link} href={Brand.URIs.OpenRepo + '/issues/new?template=roadmap-request.md&title=%5BSuggestion%5D'} noLinkStyle target='_blank'
          >
            Suggest a Feature
          </Button>
        </Grid>
      </Grid>
    </CardContent>
  </Card>;


interface NewsItem {
  versionCode: string;
  versionName?: string;
  versionMoji?: string;
  versionDate?: Date;
  versionCoverImage?: StaticImageData;
  text?: string | React.JSX.Element;
  items?: {
    text: string | React.JSX.Element;
    dev?: boolean;
    issue?: number;
  }[];
}

// news and feature surfaces
export const NewsItems: NewsItem[] = [
  // still unannounced: screen capture (when removed from labs)
  {
    versionCode: '1.13.0',
    versionName: 'Multi + Mind',
    versionMoji: '🧠🔀',
    versionDate: new Date('2024-02-08T07:47:00Z'),
    versionCoverImage: coverV113,
    items: [
      { text: <>Side-by-Side <B issue={208}>split windows</B>: multitask with parallel conversations</>, issue: 208 },
      { text: <><B issue={388} wow>Multi-Chat</B> mode: message all, all at once</>, issue: 388 },
      { text: <>Adjustable <B>text size</B>: denser chats</>, issue: 399 },
      { text: <>Export <B issue={392}>tables as CSV</B> files</>, issue: 392 },
      { text: <><B>Dev2</B> persona technology preview</> },
      { text: <>Better looking chats, spacing, fonts, menus</> },
      { text: <>More: video player, LM Studio tutorial, speedups, MongoDB (docs)</> },
    ],
  },
  {
    versionCode: '1.12.0',
    versionName: 'AGI Hotline',
    versionMoji: '✨🗣️',
    versionDate: new Date('2024-01-26T12:30:00Z'),
    versionCoverImage: coverV112,
    items: [
      { text: <><B issue={354} wow>Voice Call Personas</B>: save time, recap conversations</>, issue: 354 },
      { text: <>Updated <B issue={364}>OpenAI Models</B> to the 0125 release</>, issue: 364 },
      { text: <>Chats: Auto-<B issue={222} wow>Rename</B> and <B issue={360}>assign folders</B></>, issue: 222 },
      { text: <><B issue={356}>Link Sharing</B> makeover and control</>, issue: 356 },
      { text: <><B issue={358}>Accessibility</B> for screen readers</>, issue: 358 },
      { text: <>Export chats to <B>Markdown</B></>, issue: 337 },
      { text: <>Paste <B>tables from Excel</B></>, issue: 286 },
      { text: <>Large optimizations</> },
      { text: <>Ollama updates</>, issue: 309 },
      { text: <>Over <B>150 commits</B> and <B>7,000+ lines changed</B> for development enhancements</>, dev: true },
    ],
  },
  {
    versionCode: '1.11.0',
    versionName: 'Singularity',
    versionMoji: '🌌🌠',
    versionDate: new Date('2024-01-16T06:30:00Z'),
    items: [
      { text: <><B issue={329} wow>Search chats</B> (@joriskalz)</>, issue: 329 },
      { text: <>Quick <B issue={327}>commands pane</B> (open with &apos;/&apos;)</>, issue: 327 },
      { text: <><B>Together AI</B> Inference platform support</>, issue: 346 },
      { text: <>Persona creation: <B issue={301}>history</B></>, issue: 301 },
      { text: <>Persona creation: fix <B issue={328}>API timeouts</B></>, issue: 328 },
      { text: <>Support up to five <B issue={323}>OpenAI-compatible</B> endpoints</>, issue: 323 },
    ],
  },
  {
    versionCode: '1.10.0',
    versionName: 'The Year of AGI',
    // versionMoji: '🎊✨',
    versionDate: new Date('2024-01-06T08:00:00Z'),
    items: [
      { text: <><B issue={201} wow>New UI</B> for desktop and mobile, enabling future expansions</>, issue: 201 },
      { text: <><B issue={321} wow>Folder categorization</B> for conversation management</>, issue: 321 },
      { text: <><B>LM Studio</B> support and refined token management</> },
      { text: <>Draggable panes in split screen mode</>, issue: 308 },
      { text: <>Bug fixes and UI polish</> },
      { text: <>Developers: document proxy settings on docker</>, issue: 318, dev: true },
    ],
  },
  {
    versionCode: '1.9.0',
    versionName: 'Creative Horizons',
    // versionMoji: '🎨🌌',
    versionDate: new Date('2023-12-28T22:30:00Z'),
    items: [
      { text: <><B issue={212} wow>DALL·E 3</B> support (/draw), with advanced control</>, issue: 212 },
      { text: <><B issue={304} wow>Perfect scrolling</B> UX, on all devices</>, issue: 304 },
      { text: <>Create personas <B issue={287}>from text</B></>, issue: 287 },
      { text: <>Openrouter: auto-detect models, support free-tiers and rates</>, issue: 291 },
      { text: <>Image drawing: unified UX, including auto-prompting</> },
      { text: <>Fix layout on Firefox</>, issue: 255 },
      { text: <>Developers: new Text2Image subsystem, Optima layout subsystem, ScrollToBottom library, using new Panes library, improved Llms subsystem</>, dev: true },
    ],
  },
  {
    versionCode: '1.8.0',
    versionName: 'To The Moon And Back',
    // versionMoji: '🚀🌕🔙❤️',
    versionDate: new Date('2023-12-20T09:30:00Z'),
    items: [
      { text: <><B issue={275} wow>Google Gemini</B> models support</> },
      { text: <><B issue={273}>Mistral Platform</B> support</> },
      { text: <><B issue={270}>Ollama chats</B> perfection</> },
      { text: <>Custom <B issue={280}>diagrams instructions</B> (@joriskalz)</> },
      { text: <><B>Single-Tab</B> mode, enhances data integrity and prevents DB corruption</> },
      { text: <>Updated Ollama (v0.1.17) and OpenRouter models</> },
      { text: <>More: fixed ⌘ shortcuts on Mac</> },
      { text: <><Link href='https://big-agi.com'>Website</Link>: official downloads</> },
      { text: <>Easier Vercel deployment, documented <Link href='https://github.com/enricoros/big-AGI/issues/276#issuecomment-1858591483'>network troubleshooting</Link></>, dev: true },
    ],
  },
  {
    versionCode: '1.7.0',
    versionName: 'Attachment Theory',
    // versionDate: new Date('2023-12-11T06:00:00Z'), // 1.7.3
    versionDate: new Date('2023-12-10T12:00:00Z'), // 1.7.0
    items: [
      { text: <>New <B issue={251} wow>attachments system</B>: drag, paste, link, snap, images, text, pdfs</> },
      { text: <>Desktop <B issue={253}>webcam access</B> for direct image capture (Labs option)</> },
      { text: <>Independent browsing with <B code='/docs/config-browse.md'>Browserless</B> support</> },
      { text: <><B issue={256}>Overheat</B> LLMs with higher temperature limits</> },
      { text: <>Enhanced security via <B code='/docs/deploy-authentication.md'>password protection</B></> },
      { text: <>{platformAwareKeystrokes('Ctrl+Shift+O')}: quick access to model options</> },
      { text: <>Optimized voice input and performance</> },
      { text: <>Latest Ollama and Oobabooga models</> },
    ],
  },
  {
    versionCode: '1.6.0',
    versionName: 'Surf\'s Up',
    versionDate: new Date('2023-11-28T21:00:00Z'),
    items: [
      { text: <><B issue={237} wow>Web Browsing</B> support, see the <B code='/docs/config-browse.md'>browsing user guide</B></> },
      { text: <><B issue={235}>Branching Discussions</B> at any message</> },
      { text: <><B issue={207}>Keyboard Navigation</B>: use {platformAwareKeystrokes('Ctrl+Shift+Left/Right')} to navigate chats</> },
      { text: <><B issue={236}>UI fixes</B> (thanks to the first sponsor)</> },
      { text: <>Added support for Anthropic Claude 2.1</> },
      { text: <>Large rendering performance optimization</> },
      { text: <>More: <Chip>/help</Chip>, import ChatGPT from source, new Flattener</> },
      { text: <>Devs: improved code quality, snackbar framework</>, dev: true },
    ],
  },
  {
    versionCode: '1.5.0',
    versionName: 'Loaded!',
    versionDate: new Date('2023-11-19T21:00:00Z'),
    items: [
      { text: <><B issue={190} wow>Continued Voice</B> for hands-free interaction</> },
      { text: <><B issue={192}>Visualization</B> Tool for data representations</> },
      { text: <><B code='/docs/config-ollama.md'>Ollama (guide)</B> local models support</> },
      { text: <><B issue={194}>Text Tools</B> including highlight differences</> },
      { text: <><B href='https://mermaid.js.org/'>Mermaid</B> Diagramming Rendering</> },
      { text: <><B>OpenAI 1106</B> Chat Models</> },
      { text: <><B>SDXL</B> support with Prodia</> },
      { text: <>Cloudflare OpenAI API Gateway</> },
      { text: <>Helicone for Anthropic</> },
    ],
  },
  {
    versionCode: '1.4.0',
    items: [
      { text: <><B>Share and clone</B> conversations, with public links</> },
      { text: <><B code='/docs/config-azure-openai.md'>Azure</B> models, incl. gpt-4-32k</> },
      { text: <><B>OpenRouter</B> models full support, incl. gpt-4-32k</> },
      { text: <>Latex Rendering</> },
      { text: <>Augmented Chat modes (Labs)</> },
    ],
  },
  {
    versionCode: '1.3.5',
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
    versionCode: '1.3.1',
    items: [
      { text: <><B>Flattener</B> - 4-mode conversations summarizer</> },
      { text: <><B>Forking</B> - branch your conversations</> },
      { text: <><B>/s</B> and <B>/a</B> to append a <i>system</i> or <i>assistant</i> message</> },
      { text: <>Local LLMs with <B code='/docs/config-local-oobabooga.md'>Oobabooga server</B></> },
      { text: 'NextJS STOP bug.. squashed, with Vercel!' },
    ],
  },
  {
    versionCode: '1.2.1',
    // text: '',
    items: [
      { text: <>New home page: <b><Link href={Brand.URIs.Home + clientUtmSource()} target='_blank'>{Brand.URIs.Home.replace('https://', '')}</Link></b></> },
      { text: 'Support 𝑓unction models' }, // (n)
      { text: <Box sx={{ display: 'flex', alignItems: 'center' }}>Labs: experiments</Box> }, // ⚗️🧬🔬🥼 🥽🧪 <ScienceIcon sx={{ fontSize: 24, opacity: 0.5 }} />
    ],
  },
];
