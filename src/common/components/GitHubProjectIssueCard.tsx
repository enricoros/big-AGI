import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Card, Link as MuiLink, Typography } from '@mui/joy';
import GitHubIcon from '@mui/icons-material/GitHub';


export const GitHubProjectIssueCard = (props: {
  issue: number,
  text: string,
  note?: string | React.ReactNode,
  note2?: string | React.ReactNode,
  sx?: SxProps
}) =>
  <Card variant='outlined' color='primary' sx={props.sx}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <GitHubIcon />
      <Typography level='body-sm'>
        <MuiLink overlay href={`https://github.com/enricoros/big-AGI/issues/${props.issue}`} target='_blank'>
          big-AGI #{props.issue}
        </MuiLink>
        {' · '}{props.text}.
      </Typography>
    </Box>
    {!!props.note && (
      <Typography level='body-sm' sx={{ mt: 1 }}>
        {props.note}
      </Typography>
    )}
    {!!props.note2 && (
      <Typography level='body-sm' sx={{ mt: 1 }}>
        {props.note2}
      </Typography>
    )}
  </Card>;