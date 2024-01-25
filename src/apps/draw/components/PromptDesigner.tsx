import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, ButtonGroup, Grid, IconButton, Textarea, Tooltip } from '@mui/joy';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import FormatPaintIcon from '@mui/icons-material/FormatPaint';

import { lineHeightTextarea } from '~/common/app.theme';
import { useDrawIdeas } from '../state/useDrawIdeas';
import { useUIPreferencesStore } from '~/common/state/store-ui';


const promptButtonClass = 'PromptDesigner-button';


export function PromptDesigner(props: {
  isMobile: boolean,
  sx?: SxProps,
}) {

  // state
  const [nextPrompt, setNextPrompt] = React.useState<string>('');

  // external state
  const { currentIdea, nextRandomIdea } = useDrawIdeas();
  const enterIsNewline = useUIPreferencesStore(state => state.enterIsNewline);


  // derived state
  const userHasText = !!nextPrompt;
  const nonEmptyPrompt = nextPrompt || currentIdea.prompt;


  // Drawing

  const handleDrawEnqueue = React.useCallback(() => {
    // bail is busy
    console.log('enqueue Draw', { prompt, nonEmptyPrompt });
    setNextPrompt('');
  }, [nonEmptyPrompt]);


  // Typing

  const handleTextareaTextChange = React.useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNextPrompt(e.target.value);
    // setUserHasChanged(true);
  }, []);

  const handleTextareaKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Check for the primary Draw key
    if (e.key !== 'Enter')
      return;

    // Shift: toggles the 'enter is newline'
    if (enterIsNewline ? e.shiftKey : !e.shiftKey) {
      if (userHasText)
        handleDrawEnqueue();
      return e.preventDefault();
    }
  }, [enterIsNewline, handleDrawEnqueue, userHasText]);


  // Enrichments

  const textEnrichComponents = React.useMemo(() => {

    const handleIdeaUse = (event: React.MouseEvent) => {
      event.stopPropagation();
      event.preventDefault();
      setNextPrompt(currentIdea.prompt);
      // setUserHasChanged(false);
    };

    return (
      // TextArea Effect Buttons
      <Box sx={{
        flex: 1,
        margin: 1,

        // layout
        display: 'flex', flexFlow: 'row wrap', alignItems: 'center', gap: 1,

        // Buttons (tagged by class)
        [`& .${promptButtonClass}`]: {
          '--Button-gap': '1.2rem',
          transition: 'background-color 0.2s, color 0.2s',
          minWidth: 100,
        },
      }}>

        {/* Change / Use idea */}
        <ButtonGroup variant='soft' color='neutral' sx={{ borderRadius: 'sm' }}>
          <Button className={promptButtonClass} disabled={userHasText} onClick={nextRandomIdea}>
            Idea
          </Button>
          <Tooltip disableInteractive title='Use Idea'>
            <IconButton onClick={handleIdeaUse}>
              <ArrowDownwardIcon />
            </IconButton>
          </Tooltip>
        </ButtonGroup>

        {/* Effects */}
        <Button
          variant='soft' color='success'
          disabled={!userHasText}
          className={promptButtonClass}
          endDecorator={<AutoFixHighIcon sx={{ fontSize: '20px' }} />}
          sx={{ borderRadius: 'sm' }}
        >
          Detail
        </Button>

        <Button
          variant='soft' color='success'
          disabled={!userHasText}
          className={promptButtonClass}
          endDecorator={<AutoFixHighIcon sx={{ fontSize: '20px' }} />}
          sx={{ borderRadius: 'sm' }}
        >
          Restyle
        </Button>

        {/* Char counter */}
        {/*<Typography level='body-sm' sx={{ ml: 'auto', mr: 1 }}>*/}
        {/*  {!!nonEmptyPrompt?.length && nonEmptyPrompt.length.toLocaleString()}*/}
        {/*</Typography>*/}
      </Box>
    );
  }, [currentIdea.prompt, nextRandomIdea, userHasText]);

  return (
    <Box aria-label='Drawing Prompt' component='section' sx={props.sx}>
      <Grid container spacing={{ xs: 1, md: 2 }}>

        {/* Effected Text Box */}
        <Grid xs={12} md={9}>

          <Textarea
            variant='outlined'
            // size='sm'
            autoFocus
            minRows={props.isMobile ? 4 : 3}
            maxRows={props.isMobile ? 6 : 8}
            placeholder={currentIdea.prompt}
            value={nextPrompt}
            onChange={handleTextareaTextChange}
            onKeyDown={handleTextareaKeyDown}
            startDecorator={textEnrichComponents}
            slotProps={{
              textarea: {
                enterKeyHint: enterIsNewline ? 'enter' : 'send',
                // ref: props.designerTextAreaRef,
              },
            }}
            sx={{
              boxShadow: 'lg',
              '&:focus-within': { backgroundColor: 'background.popup' },
              lineHeight: lineHeightTextarea,
            }}
          />
        </Grid>

        {/* [Desktop: Right, Mobile: Bottom] Buttons */}
        <Grid xs={12} md={3}>
          <Button
            fullWidth
            variant='solid'
            color='primary'
            endDecorator={<FormatPaintIcon />}
            sx={{
              boxShadow: !props.isMobile
                ? `0 8px 24px -4px rgb(var(--joy-palette-primary-mainChannel) / 20%)`
                : 'none',
            }}
          >
            Draw
          </Button>
        </Grid>

      </Grid> {/* Prompt Designer */}

      {/* Modals...  */}
      {/* ... */}

    </Box>
  );
}