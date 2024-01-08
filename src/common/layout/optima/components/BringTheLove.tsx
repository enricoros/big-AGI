import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Button, IconButton, Tooltip } from '@mui/joy';

import { Link } from '~/common/components/Link';
import { cssRainbowColorKeyframes } from '~/common/app.theme';


export function BringTheLove(props: { text: string, link: string, asIcon?: boolean, icon: React.FC, sx?: SxProps }) {
  // state
  const [loved, setLoved] = React.useState(false);
  const icon = loved ? '❤️' : <props.icon /> ?? null; // '❤️' : '🤍';

  // reset loved after 5 seconds
  React.useEffect(() => {
    if (loved) {
      const timer = setTimeout(() => setLoved(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [loved]);

  return (
    <Tooltip followCursor title={props.text}>
      {props.asIcon ? (
        <IconButton
          variant='solid'
          size='sm'
          onClick={() => setLoved(true)}
          component={Link} href={props.link} target='_blank' noLinkStyle
          sx={{
            '&:hover': { animation: `${cssRainbowColorKeyframes} 5s linear infinite` },
            background: 'transparent',
            textDecoration: 'none',
            ...props.sx,
          }}
        >
          {icon}
        </IconButton>
      ) : (
        <Button
          onClick={() => setLoved(true)}
          component={Link} href={props.link} target='_blank' noLinkStyle
          sx={{
            '&:hover': { animation: `${cssRainbowColorKeyframes} 5s linear infinite` },
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