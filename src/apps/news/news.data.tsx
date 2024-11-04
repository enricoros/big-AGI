import * as React from 'react';
import { StaticImageData } from 'next/image';

import { Box, Chip, SvgIconProps, Typography } from '@mui/joy';
import GoogleIcon from '@mui/icons-material/Google';

import { AnthropicIcon } from '~/common/components/icons/vendors/AnthropicIcon';
import { ChatBeamIcon } from '~/common/components/icons/ChatBeamIcon';
import { ExternalLink } from '~/common/components/ExternalLink';
import { GroqIcon } from '~/common/components/icons/vendors/GroqIcon';
import { LocalAIIcon } from '~/common/components/icons/vendors/LocalAIIcon';
import { MistralIcon } from '~/common/components/icons/vendors/MistralIcon';
import { PerplexityIcon } from '~/common/components/icons/vendors/PerplexityIcon';

import { Brand } from '~/common/app.config';
import { Link } from '~/common/components/Link';
import { Release } from '~/common/app.release';
import { clientUtmSource } from '~/common/util/pwaUtils';
import { platformAwareKeystrokes } from '~/common/components/KeyStroke';

import { beamBlogUrl } from './beam.data';


// Cover Images
// A landscape image of a capybara made entirely of clear, translucent crystal, wearing oversized black sunglasses, sitting at a sleek, minimalist desk. The desk is bathed in a soft, ethereal light emanating from within the capybara, symbolizing clarity and transparency. The capybara is typing on a futuristic, holographic keyboard, with floating code snippets and diagrams surrounding it, illustrating an improved developer experience and Auto-Diagrams feature. The background is a clean, white space with subtle, geometric patterns. Close-up photography style with a bokeh effect.
import coverV116 from '../../../public/images/covers/release-cover-v1.16.0.png';
// (not exactly) Imagine a futuristic, holographically bounded space. Inside this space, four capybaras stand. Three of them are in various stages of materialization, their forms made up of thousands of tiny, vibrant particles of electric blues, purples, and greens. These particles represent the merging of different intelligent inputs, symbolizing the concept of 'Beaming'. Positioned slightly towards the center and ahead of the others, the fourth capybara is fully materialized and composed of shimmering golden cotton candy, representing the optimal solution the 'Beam' feature seeks to achieve. The golden capybara gazes forward confidently, embodying a target achieved. Illuminated grid lines softly glow on the floor and walls of the setting, amplifying the futuristic aspect. In front of the golden capybara, floating, holographic interfaces depict complex networks of points and lines symbolizing the solution space 'Beaming' explores. The capybara interacts with these interfaces, implying the user's ability to control and navigate towards the best outcomes.
import coverV115 from '../../../public/images/covers/release-cover-v1.15.0.png';
// An image of a capybara sculpted entirely from iridescent blue cotton candy, gazing into a holographic galaxy of floating AI model icons (representing various AI models like Perplexity, Groq, etc.). The capybara is wearing a lightweight, futuristic headset, and its paws are gesturing as if orchestrating the movement of the models in the galaxy. The backdrop is minimalist, with occasional bursts of neon light beams, creating a sense of depth and wonder. Close-up photography, bokeh effect, with a dark but vibrant background to make the colors pop.
import coverV114 from '../../../public/images/covers/release-cover-v1.14.0.png';
// An image of a capybara sculpted entirely from black cotton candy, set against a minimalist backdrop with splashes of bright, contrasting sparkles. The capybara is using a computer with split screen made of origami, split keyboard and is wearing origami sunglasses with very different split reflections. Split halves are very contrasting. Close up photography, bokeh, white background.
import coverV113 from '../../../public/images/covers/release-cover-v1.13.0.png';
// An image of a capybara sculpted entirely from black cotton candy, set against a minimalist backdrop with splashes of bright, contrasting sparkles. The capybara is calling on a 3D origami old-school pink telephone and the camera is zooming on the telephone. Close up photography, bokeh, white background.
import coverV112 from '../../../public/images/covers/release-cover-v1.12.0.png';


interface NewsItem {
  versionCode: string;
  versionName?: string;
  versionMoji?: string;
  versionDate?: Date;
  versionCoverImage?: StaticImageData;
  text?: string | React.JSX.Element;
  items?: {
    text: React.ReactNode;
    dev?: boolean;
    issue?: number;
    icon?: React.FC<SvgIconProps>;
    noBullet?: boolean;
  }[];
}

// news and feature surfaces
export const NewsItems: NewsItem[] = [
  {
    versionCode: Release.App.versionCode,
    versionName: Release.App.versionName,
    versionDate: new Date('2024-10-15T01:00:00Z'),
    items: [
      { text: <>You&apos;re running an <B>unsupported Early Access</B> build of Big-AGI V2. This version is used by developers to implement long-term breaking features.</> },
      { text: <>This branch previews experimental features that are subject to change and may break without notice.</> },
      { text: <>Please report screenshots of breakages and console error messages.</> },
      { text: <>Please note that this is not the official release.</> },
      { text: <>For stable releases: <ExternalLink href='https://big-agi.com'>big-agi.com</ExternalLink>.</> },
    ],
  },
  {
    versionCode: '1.16.8',
    versionName: 'Crystal Clear',
    versionDate: new Date('2024-06-07T05:00:00Z'),
    // versionDate: new Date('2024-05-13T19:00:00Z'),
    // versionDate: new Date('2024-05-09T00:00:00Z'),
    versionCoverImage: coverV116,
    items: [
      { text: <><B href={beamBlogUrl} wow>Beam</B> core and UX improvements based on user feedback</>, issue: 470, icon: ChatBeamIcon },
      { text: <>Chat <B>Cost estimation</B> with supported models* 💰</> },
      { text: <>Major <B>Auto-Diagrams</B> enhancements</> },
      { text: <>Save/load chat files with Ctrl+S / O</>, issue: 466 },
      { text: <><B issue={500}>YouTube Transcriber</B> persona: chat with videos</>, issue: 500 },
      { text: <>Improved <B issue={508}>formula render</B>, dark-mode diagrams</>, issue: 508 },
      { text: <>More: <B issue={517}>code soft-wrap</B>, selection toolbar, <B issue={507}>3x faster</B> on Apple silicon</>, issue: 507 },
      { text: <>Updated <B>Anthropic</B>*, <B>Groq</B>, <B>Ollama</B>, <B>OpenAI</B>*, <B>OpenRouter</B>*, and <B>Perplexity</B></> },
      { text: <>Developers: update LLMs data structures</>, dev: true },
      { text: <>1.16.1: Support for <B>OpenAI</B> <B href='https://openai.com/index/hello-gpt-4o/'>GPT-4o</B></> },
      { text: <>1.16.2: Proper <B>Gemini</B> support, <B>HTML/Markdown</B> downloads, and latest <B>Mistral</B></> },
      { text: <>1.16.3: Support for <B href='https://www.anthropic.com/news/claude-3-5-sonnet'>Claude 3.5 Sonnet</B> (refresh your <B>Anthropic</B> models)</> },
      { text: <>1.16.4: <B>8192 tokens</B> support for Claude 3.5 Sonnet</> },
      { text: <>1.16.5: OpenAI <B>GPT-4o Mini</B> support</> },
      { text: <>1.16.6: Groq <B>Llama 3.1</B> support</> },
      { text: <>1.16.7: Gpt-4o <B>2024-08-06</B></> },
      { text: <>1.16.8: <B>ChatGPT-4o</B> latest</> },
      { text: <>OpenAI <B>o1</B> and newer models require Big-AGI 2. <B href='https://y2rjg0zillz.typeform.com/to/ZSADpr5u?utm_source=gh-2&utm_medium=news&utm_campaign=ea2'>Sign up here</B></> },
    ],
  },
  {
    versionCode: '1.15',
    versionName: 'Beam',
    versionDate: new Date('2024-04-10T08:00:00Z'),
    versionCoverImage: coverV115,
    items: [
      { text: <><B href={beamBlogUrl} wow>Beam</B>: Find better answers with multi-model AI reasoning</>, issue: 443, icon: ChatBeamIcon },
      // { text: <><B>Explore diverse perspectives</B> and <B>synthesize optimal responses</B></>, noBullet: true },
      { text: <><B issue={436}>Auto-configure</B> models for managed deployments</>, issue: 436 },
      { text: <>Message <B issue={476}>starring ⭐</B>, filtering and attachment</>, issue: 476 },
      { text: <>Default persona improvements</> },
      { text: <>Fixes to Gemini models and SVGs, improvements to UI and icons, and more</> },
      { text: <>Developers: imperative LLM models discovery</>, dev: true },
      { text: <>1.15.1: Support for <B>Gemini Pro 1.5</B> and <B>OpenAI 2024-04-09</B> models</> },
    ],
  },
  {
    versionCode: '1.14',
    versionName: 'Modelmorphic',
    versionCoverImage: coverV114,
    versionDate: new Date('2024-03-07T08:00:00Z'),
    items: [
      { text: <>Anthropic <B href='https://www.anthropic.com/news/claude-3-family'>Claude-3</B> support for smarter chats</>, issue: 443, icon: AnthropicIcon },
      { text: <><B issue={407}>Perplexity</B> support, including Online models</>, issue: 407, icon: PerplexityIcon },
      { text: <><B issue={427}>Groq</B> support, with speeds up to 500 tok/s</>, issue: 427, icon: GroqIcon },
      { text: <>Support for new Mistral-Large models</>, icon: MistralIcon },
      { text: <>Support for Google Gemini 1.5 models and various improvements</>, icon: GoogleIcon as any },
      { text: <>Deeper LocalAI integration including support for <B issue={411}>model galleries</B></>, icon: LocalAIIcon },
      { text: <>Major <B href='https://twitter.com/enricoros/status/1756553038293303434'>performance optimizations</B>: runs faster, saves power, saves memory</> },
      { text: <>Improvements: auto-size charts, search and folder experience</> },
      { text: <>Perfect chat scaling, with rapid keyboard shortcuts</> },
      { text: <>Also: diagrams auto-resize, open code with StackBlitz and JSFiddle, quick model visibility toggle, open links externally, docs on the web</> },
      { text: <>Fixes: standalone LaTeX blocks, close views by dragging, knowledge cutoff dates, crashes on Google translate (thanks dad)</> },
    ],
  },
  {
    versionCode: '1.13',
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
    versionCode: '1.12',
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
    versionCode: '1.11',
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
    versionCode: '1.10',
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
    versionCode: '1.9',
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
    versionCode: '1.8',
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
    versionCode: '1.7',
    versionName: 'Attachment Theory',
    // versionDate: new Date('2023-12-11T06:00:00Z'), // 1.7.3
    versionDate: new Date('2023-12-10T12:00:00Z'), // 1.7.0
    items: [
      { text: <>New <B issue={251} wow>attachments system</B>: drag, paste, link, snap, images, text, pdfs</> },
      { text: <>Desktop <B issue={253}>webcam access</B> for direct image capture (Labs option)</> },
      { text: <>Independent browsing with <B code='/docs/config-feature-browse.md'>Browserless</B> support</> },
      { text: <><B issue={256}>Overheat</B> LLMs with higher temperature limits</> },
      { text: <>Enhanced security via <B code='/docs/deploy-authentication.md'>password protection</B></> },
      { text: <>{platformAwareKeystrokes('Ctrl+Shift+O')}: quick access to model options</> },
      { text: <>Optimized voice input and performance</> },
      { text: <>Latest Ollama models</> },
    ],
  },
  {
    versionCode: '1.6',
    versionName: 'Surf\'s Up',
    versionDate: new Date('2023-11-28T21:00:00Z'),
    items: [
      { text: <><B issue={237} wow>Web Browsing</B> support, see the <B code='/docs/config-feature-browse.md'>browsing user guide</B></> },
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
    versionCode: '1.5',
    versionName: 'Loaded!',
    versionDate: new Date('2023-11-19T21:00:00Z'),
    items: [
      { text: <><B issue={190} wow>Continued Voice</B> for hands-free interaction</> },
      { text: <><B issue={192}>Visualization</B> Tool for data representations</> },
      { text: <><B code='/docs/config-local-ollama.md'>Ollama (guide)</B> local models support</> },
      { text: <><B issue={194}>Text Tools</B> including highlight differences</> },
      { text: <><B href='https://mermaid.js.org/'>Mermaid</B> Diagramming Rendering</> },
      { text: <><B>OpenAI 1106</B> Chat Models</> },
      { text: <><B>SDXL</B> support with Prodia</> },
      { text: <>Cloudflare OpenAI API Gateway</> },
      { text: <>Helicone for Anthropic</> },
    ],
  },
  {
    versionCode: '1.4',
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
    <Typography component='span' color={!!href ? 'primary' : 'neutral'} sx={{ fontWeight: 'lg' }}>
      {props.children}
    </Typography>
  );
  if (!href)
    return boldText;
  // append UTM details if missing
  const hrefWithUtm = href.includes('utm_source=') ? href : href + clientUtmSource();
  return (
    <ExternalLink href={hrefWithUtm} highlight={props.wow} icon={props.issue ? 'issue' : undefined}>
      {boldText}
    </ExternalLink>
  );
}