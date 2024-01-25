import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, ButtonGroup, Grid, IconButton, Textarea, Tooltip } from '@mui/joy';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import FormatPaintIcon from '@mui/icons-material/FormatPaint';
import MoreTimeIcon from '@mui/icons-material/MoreTime';
import StopOutlinedIcon from '@mui/icons-material/StopOutlined';

import { lineHeightTextarea } from '~/common/app.theme';
import { useUIPreferencesStore } from '~/common/state/store-ui';

import { animationStopEnter } from '../../chat/components/composer/Composer';
import { useDrawIdeas } from '../state/useDrawIdeas';


const promptButtonClass = 'PromptDesigner-button';


export interface DesignerPrompt {
  prompt: string,
  // tags: string[],
  // effects: string[],
  // style: string[],
  // detail: string[],
  // restyle: string[],
  // [key: string]: string[],
}


export function PromptDesigner(props: {
  isMobile: boolean,
  queueLength: number,
  onDrawingStop: () => void,
  onPromptEnqueue: (prompt: DesignerPrompt) => void,
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
  const queueLength = props.queueLength;
  const qBusy = queueLength > 0;


  // Drawing

  const { onDrawingStop, onPromptEnqueue } = props;

  const handleDrawStop = React.useCallback(() => {
    onDrawingStop();
  }, [onDrawingStop]);

  const handlePromptEnqueue = React.useCallback(() => {
    setNextPrompt('');
    onPromptEnqueue({
      prompt: nonEmptyPrompt,
    });
  }, [nonEmptyPrompt, onPromptEnqueue]);


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
        handlePromptEnqueue();
      return e.preventDefault();
    }
  }, [enterIsNewline, handlePromptEnqueue, userHasText]);


  // PromptFx

  const textEnrichComponents = React.useMemo(() => {

    const handleIdeaUse = (event: React.MouseEvent) => {
      event.preventDefault();
      setNextPrompt(currentIdea.prompt);
      // setUserHasChanged(false);
    };

    const handleClickMissing = (_event: React.MouseEvent) => {
      alert('Not implemented yet');
    };

    return (
      // PromptFx Buttons
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

        {/* PromptFx */}
        <Button
          variant='soft' color='success'
          disabled={!userHasText}
          className={promptButtonClass}
          endDecorator={<AutoFixHighIcon sx={{ fontSize: '20px' }} />}
          onClick={handleClickMissing}
          sx={{ borderRadius: 'sm' }}
        >
          Detail
        </Button>

        <Button
          variant='soft' color='success'
          disabled={!userHasText}
          className={promptButtonClass}
          endDecorator={<AutoFixHighIcon sx={{ fontSize: '20px' }} />}
          onClick={handleClickMissing}
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

        {/* Prompt (Text) Box */}
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
        <Grid xs={12} md={3} spacing={1}>
          <Box sx={{ display: 'grid', gap: 1 }}>

            {/* Draw */}
            {!qBusy ? (
              <Button
                key='draw-queue'
                variant='solid' color='primary'
                endDecorator={<FormatPaintIcon />}
                onClick={handlePromptEnqueue}
                sx={{
                  animation: `${animationStopEnter} 0.1s ease-out`,
                  boxShadow: !props.isMobile ? `0 8px 24px -4px rgb(var(--joy-palette-primary-mainChannel) / 20%)` : 'none',
                  justifyContent: 'space-between',
                }}
              >
                Draw
              </Button>
            ) : <>
              <Button
                key='draw-terminate'
                variant='soft' color='warning'
                endDecorator={<StopOutlinedIcon sx={{ fontSize: 18 }} />}
                onClick={handleDrawStop}
                sx={{
                  // animation: `${animationStopEnter} 0.1s ease-out`,
                  boxShadow: !props.isMobile ? `0 8px 24px -4px rgb(var(--joy-palette-warning-mainChannel) / 20%)` : 'none',
                  justifyContent: 'space-between',
                }}
              >
                Stop
              </Button>
              <Button
                key='draw-queueup'
                variant='soft'
                color='primary'
                endDecorator={<MoreTimeIcon sx={{ fontSize: 18 }} />}
                onClick={handlePromptEnqueue}
                sx={{
                  animation: `${animationStopEnter} 0.1s ease-out`,
                  boxShadow: !props.isMobile ? `0 8px 24px -4px rgb(var(--joy-palette-primary-mainChannel) / 20%)` : 'none',
                  justifyContent: 'space-between',
                }}
              >
                Enqueue
              </Button>
            </>}
          </Box>
        </Grid>

      </Grid> {/* Prompt Designer */}

      {/* Modals...  */}
      {/* ... */}

    </Box>
  );
}