import * as React from 'react';

import { Button, ButtonGroup, IconButton, Tooltip } from '@mui/joy';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';

// const desktopButtonLegend =
//   <Box sx={{ px: 1, py: 0.75, lineHeight: '1.5rem' }}>
//     <b>From Idea</b><br />
//     From Idea
//   </Box>;


export function ButtonPromptFromIdea(props: {
  isMobile?: boolean,
  disabled: boolean,
  onIdeaNext: () => void,
  onIdeaUse: () => void,
}) {

  const { onIdeaNext, onIdeaUse } = props;

  const handleIdeaNext = React.useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onIdeaNext();
  }, [onIdeaNext]);

  return props.isMobile ? null : (
    <ButtonGroup
      variant='outlined' color='neutral'
      disabled={props.disabled}
      sx={{
        // '--ButtonGroup-separatorSize': 0,
        minWidth: 160,
      }}
    >
      <Tooltip disableInteractive title='New Idea'>
        <Button
          fullWidth onClick={handleIdeaNext}
          startDecorator={<LightbulbOutlinedIcon />}
          sx={{
            // '--Button-gap': 'auto',
            // minWidth: 100,
            justifyContent: 'flex-start',
            transition: 'background-color 0.2s, color 0.2s',
          }}>
          Idea
        </Button>
      </Tooltip>
      <Tooltip disableInteractive title='Use Idea'>
        <IconButton size='sm' onClick={onIdeaUse}>
          <ArrowForwardRoundedIcon />
        </IconButton>
      </Tooltip>
    </ButtonGroup>
  );
}