import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, ButtonGroup, Dropdown, Grid, IconButton, Menu, MenuButton, MenuItem, Textarea, Typography } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import FormatPaintIcon from '@mui/icons-material/FormatPaint';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import MoreTimeIcon from '@mui/icons-material/MoreTime';
import RemoveIcon from '@mui/icons-material/Remove';
import StopOutlinedIcon from '@mui/icons-material/StopOutlined';

import { animationStopEnter } from '../../chat/components/composer/Composer';

import { lineHeightTextarea } from '~/common/app.theme';
import { useUIPreferencesStore } from '~/common/state/store-ui';

import { ButtonPromptFromIdea } from './ButtonPromptFromIdea';
import { ButtonPromptFromPlaceholder } from './ButtonPromptFromPlaceholder';
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
  const [tempCount, setTempCount] = React.useState<number>(2);

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


  // Ideas

  const handleIdeaUse = React.useCallback(() => {
    setNextPrompt(currentIdea.prompt);
  }, [currentIdea.prompt]);

  // PromptFx

  const textEnrichComponents = React.useMemo(() => {

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
        {/*{props.isMobile && (*/}
        {/*  <ButtonGroup variant='soft' color='neutral' sx={{ borderRadius: 'sm' }}>*/}
        {/*    <Button className={promptButtonClass} disabled={userHasText} onClick={handleIdeaNext}>*/}
        {/*      Idea*/}
        {/*    </Button>*/}
        {/*    <Tooltip disableInteractive title='Use Idea'>*/}
        {/*      <IconButton onClick={handleIdeaUse}>*/}
        {/*        <ArrowDownwardIcon />*/}
        {/*      </IconButton>*/}
        {/*    </Tooltip>*/}
        {/*  </ButtonGroup>*/}
        {/*)}*/}

        {/* PromptFx */}
        <Button
          variant='soft' color='success'
          disabled={!userHasText}
          className={promptButtonClass}
          endDecorator={<AutoFixHighIcon sx={{ fontSize: '20px' }} />}
          onClick={handleClickMissing}
          sx={{ borderRadius: 'sm' }}
        >
          Enhance
        </Button>

        {/*<Button*/}
        {/*  variant='soft' color='success'*/}
        {/*  disabled={!userHasText}*/}
        {/*  className={promptButtonClass}*/}
        {/*  endDecorator={<AutoFixHighIcon sx={{ fontSize: '20px' }} />}*/}
        {/*  onClick={handleClickMissing}*/}
        {/*  sx={{ borderRadius: 'sm' }}*/}
        {/*>*/}
        {/*  Restyle*/}
        {/*</Button>*/}

        <ButtonGroup sx={{ ml: 'auto' }}>
          {tempCount > 1 && <IconButton onClick={() => setTempCount(count => count - 1)}>
            <RemoveIcon />
          </IconButton>}
          {tempCount > 1 && <>
            <IconButton>
              <KeyboardArrowLeftIcon />
            </IconButton>
            <Button
              sx={{
                px: 0,
                minWidth: '3rem',
                pointerEvents: 'none',
                fontSize: 'xs',
                fontWeight: 600,
              }}>
              <Typography level='body-xs' color='danger' sx={{ fontWeight: 'lg' }}>
                {tempCount > 1 ? `1 / ${tempCount}` : '1'}
              </Typography>
            </Button>
            <IconButton>
              <KeyboardArrowRightIcon />
            </IconButton>
          </>}
          <IconButton onClick={() => setTempCount(count => count + 1)}>
            <AddIcon />
          </IconButton>
        </ButtonGroup>


        {/* Char counter */}
        {/*<Typography level='body-sm' sx={{ ml: 'auto', mr: 1 }}>*/}
        {/*  {!!nonEmptyPrompt?.length && nonEmptyPrompt.length.toLocaleString()}*/}
        {/*</Typography>*/}
      </Box>
    );
  }, [tempCount, userHasText]);

  return (
    <Box aria-label='Drawing Prompt' component='section' sx={props.sx}>
      <Grid container spacing={{ xs: 1, md: 2 }}>

        {/* Prompt (Text) Box */}
        <Grid xs={12} md={9}><Box sx={{ display: 'flex', gap: { xs: 1, md: 2 } }}>

          {props.isMobile ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>

              <Dropdown>
                <MenuButton slots={{ root: IconButton }}>
                  <ArrowForwardIcon />
                </MenuButton>
                <Menu placement='top'>
                  {/* Add From History? */}
                  {/*<MenuItem>*/}
                  {/*  <ButtonPromptFromPlaceholder name='History' disabled />*/}
                  {/*</MenuItem>*/}
                  <MenuItem>
                    <ButtonPromptFromIdea disabled={userHasText} onIdeaNext={nextRandomIdea} onIdeaUse={handleIdeaUse} />
                  </MenuItem>
                  <MenuItem>
                    <ButtonPromptFromPlaceholder name='Image' disabled />
                  </MenuItem>
                  {/*<MenuItem>*/}
                  {/*  <ButtonPromptFromPlaceholder name='Chat' disabled />*/}
                  {/*</MenuItem>*/}
                </Menu>
              </Dropdown>

            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>

              <ButtonPromptFromIdea disabled={userHasText} onIdeaNext={nextRandomIdea} onIdeaUse={handleIdeaUse} />

              <ButtonPromptFromPlaceholder name='Image' disabled />

              {/*<ButtonPromptFromPlaceholder name='Chats' disabled />*/}

            </Box>

          )}

          <Textarea
            variant='outlined'
            // size='sm'
            autoFocus
            minRows={props.isMobile ? 5 : 3}
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
              flexGrow: 1,
              boxShadow: 'lg',
              '&:focus-within': { backgroundColor: 'background.popup' },
              lineHeight: lineHeightTextarea,
            }}
          />

        </Box></Grid>

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
                Draw {tempCount > 1 ? `(${tempCount})` : ''}
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

            <ButtonGroup size='sm' variant='soft' sx={{ flex: 1, display: 'flex' }}>
              <Button sx={{ flex: 1 }}>
                1
              </Button>
              <Button sx={{ flex: 1 }}>
                x2
              </Button>
              <Button color='primary'  sx={{ flex: 1 }}>
                x4
              </Button>
              <Button sx={{ flex: 1 }}>
                xN
              </Button>
            </ButtonGroup>

          </Box>
        </Grid>

      </Grid> {/* Prompt Designer */}

      {/* Modals...  */}
      {/* ... */}

    </Box>
  );
}