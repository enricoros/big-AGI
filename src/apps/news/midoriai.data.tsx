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
import { clientUtmSource } from '~/common/util/pwaUtils';
import { platformAwareKeystrokes } from '~/common/components/KeyStroke';


// Cover Images
// (not exactly) Imagine a futuristic, holographically bounded space. Inside this space, four capybaras stand. Three of them are in various stages of materialization, their forms made up of thousands of tiny, vibrant particles of electric blues, purples, and greens. These particles represent the merging of different intelligent inputs, symbolizing the concept of 'Beaming'. Positioned slightly towards the center and ahead of the others, the fourth capybara is fully materialized and composed of shimmering golden cotton candy, representing the optimal solution the 'Beam' feature seeks to achieve. The golden capybara gazes forward confidently, embodying a target achieved. Illuminated grid lines softly glow on the floor and walls of the setting, amplifying the futuristic aspect. In front of the golden capybara, floating, holographic interfaces depict complex networks of points and lines symbolizing the solution space 'Beaming' explores. The capybara interacts with these interfaces, implying the user's ability to control and navigate towards the best outcomes.
import midoriaicoverV1 from '../../../public/images/covers/midori-ai-cover-1.png';
import { beamBlogUrl } from './beam.data';


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
export const MidoriAIItems: NewsItem[] = [
  /*{
    versionCode: '1.16.0',
    items: [
      Draw
      ...
      Screen Capture (when removed from labs)
    ]
  }*/
  {
    versionCode: '4.19.0',
    versionName: 'Midori AI',
    versionDate: new Date('2024-04-10T08:00:00Z'),
    versionCoverImage: midoriaicoverV1,
    items: [
      { 
        text: (
          <>
            <B href={beamBlogUrl} wow>
              Midori AI Subsystem: Introducing the Midori AI Docker Subsystem
            </B>
          </>
        ),
        issue: 443, 
        icon: ChatBeamIcon 
      },
      { 
        text: (
          <>
            Experience seamless AI deployment and management with the Midori AI Docker Subsystem. 
            This image of Big AGI includes a free remote 14b SD Carly model api key for testing, 
            baked right into the system!
          </>
        ),
        noBullet: true 
      },
    ]
  }
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
  return (
    <ExternalLink href={href + clientUtmSource()} highlight={props.wow} icon={props.issue ? 'issue' : undefined}>
      {boldText}
    </ExternalLink>
  );
}