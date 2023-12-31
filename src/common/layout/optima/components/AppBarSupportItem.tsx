import * as React from 'react';

import { Button, Tooltip } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';

import { Link } from '~/common/components/Link';
import { cssRainbowColorKeyframes } from '~/common/app.theme';


export function BringTheLove(props: { text: string, link: string, icon?: React.JSX.Element, sx?: SxProps }) {
  const [loved, setLoved] = React.useState(false);
  const icon = loved ? '❤️' : props.icon ?? null; // '❤️' : '🤍';
  return <Tooltip title={props.text}><Button
    variant='solid' color='neutral' size='md'
    component={Link} noLinkStyle href={props.link} target='_blank'
    onClick={() => setLoved(true)}
    // endDecorator={icon}
    sx={{
      background: 'transparent',
      // '&:hover': { background: props.theme.palette.neutral.solidBg },
      '&:hover': { animation: `${cssRainbowColorKeyframes} 5s linear infinite` },
      ...(props.sx ? props.sx : {}),
    }}>
    {/*{props.text || icon}*/}
    {icon}
  </Button></Tooltip>;
}

/*
export function AppBarSupportItem() {
  const theme = useTheme();
  const fadedColor = theme.palette.neutral.plainDisabledColor;
  const iconColor = '';
  return (
    <ListItem
      variant='solid' color='neutral'
      sx={{
        // background: theme.palette.neutral.solidActiveBg,
        display: 'flex', flexDirection: 'row', gap: 1,
        justifyContent: 'space-between',
      }}>
      <BringTheLove text={Brand.Title.Base} link={Brand.URIs.Home} sx={{ color: fadedColor }} />
      <BringTheLove text='Discord' icon={<DiscordIcon sx={{ color: iconColor }} />} link={Brand.URIs.SupportInvite} />
      <BringTheLove text='GitHub' icon={<GitHubIcon sx={{ color: iconColor }} />} link={Brand.URIs.OpenRepo} />
    </ListItem>
  );
}
*/