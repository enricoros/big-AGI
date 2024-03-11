import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Button, Tooltip } from '@mui/joy';

import { Link } from '~/common/components/Link';
import { animationColorRainbow } from '~/common/util/animUtils';

import { DesktopNavIcon, navItemClasses } from './DesktopNavIcon';


export function BringTheLove(props: { text: string, link: string, asIcon?: boolean, icon: React.FC, sx?: SxProps }) {
  // state
  const [loved, setLoved] = React.useState(false);

  // reset loved after 6.9 seconds
  React.useEffect(() => {
    if (loved) {
      const timer = setTimeout(() => setLoved(false), 6900 + 420);
      return () => clearTimeout(timer);
    }
  }, [loved]);

  const icon = loved ? '❤️' : <props.icon /> ?? null; // '❤️' : '🤍';

  return (
    <Tooltip followCursor title={props.text}>
      {props.asIcon ? (
        <DesktopNavIcon
          variant='solid'
          className={navItemClasses.typeLinkOrModal}
          component={Link} href={props.link} target='_blank'
          onClick={() => setLoved(true)}
          sx={{
            background: 'transparent',
            // color: 'text.tertiary',
            '&:hover': {
              animation: `${animationColorRainbow} 5s linear infinite`,
            },
          }}
        >
          {icon}
        </DesktopNavIcon>
      ) : (
        <Button
          component={Link} href={props.link} target='_blank' noLinkStyle
          onClick={() => setLoved(true)}
          sx={{
            '&:hover': { animation: `${animationColorRainbow} 5s linear infinite` },
            background: 'transparent',
            ...props.sx,
          }}
        >
          {icon}
        </Button>
      )}
    </Tooltip>
  );
}