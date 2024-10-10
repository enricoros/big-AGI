import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, ButtonGroup, Dropdown, FormControl, Grid, IconButton, Menu, MenuButton, MenuItem, Textarea, Typography } from '@mui/joy';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import FormatPaintTwoToneIcon from '@mui/icons-material/FormatPaintTwoTone';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import MoreTimeIcon from '@mui/icons-material/MoreTime';
import NumbersRoundedIcon from '@mui/icons-material/NumbersRounded';
import RemoveIcon from '@mui/icons-material/Remove';
import StopOutlinedIcon from '@mui/icons-material/StopOutlined';

import { imaginePromptFromTextOrThrow } from '~/modules/aifn/imagine/imaginePromptFromText';

import { agiUuid } from '~/common/util/idUtils';
import { animationEnterBelow } from '~/common/util/animUtils';
import { lineHeightTextareaMd } from '~/common/app.theme';
import { useUIPreferencesStore } from '~/common/state/store-ui';

import { ButtonPromptFromIdea } from './ButtonPromptFromIdea';
import { useDrawIdeas } from './useDrawIdeas';


const promptButtonClass = 'PromptDesigner-button';


export interface DesignerPrompt {
  dpId: string,
  prompt: string,
  _repeatCount: number,
  // tags: string[],
  // effects: string[],
  // style: string[],
  // detail: string[],
  // restyle: string[],
  // [key: string]: string[],
}


export function PromptComposer(props: {
  isMobile: boolean,
  queueLength: number,
  onDrawingStop: () => void,
  onPromptEnqueue: (prompt: DesignerPrompt[]) => void,
  sx?: SxProps,
}) {

  // state
  const [nextPrompt, setNextPrompt] = React.useState<string>('');
  const [tempCount, setTempCount] = React.useState<number>(1);
  const [tempRepeat, setTempRepeat] = React.useState<number>(1);
  const [isSimpleEnhancing, setIsSimpleEnhancing] = React.useState<boolean>(false);
  const [showMobileRepeat, setShowMobileRepeat] = React.useState<boolean>(false);

  // external state
  const { currentIdea, nextRandomIdea, clearCurrentIdea } = useDrawIdeas();
  const enterIsNewline = useUIPreferencesStore(state => state.enterIsNewline);


  // derived state
  const isRepeatShown = showMobileRepeat || !props.isMobile;
  const userHasText = !!nextPrompt;
  const currentIdeaPrompt = currentIdea?.prompt || '';
  const nonEmptyPrompt = nextPrompt || currentIdeaPrompt;
  const queueLength = props.queueLength;
  const qBusy = queueLength > 0;


  // Drawing

  const { onDrawingStop, onPromptEnqueue } = props;

  const handleDrawStop = React.useCallback(() => {
    onDrawingStop();
  }, [onDrawingStop]);

  const handlePromptEnqueue = React.useCallback(() => {
    setNextPrompt('');
    clearCurrentIdea();
    if (nonEmptyPrompt?.trim()) {
      onPromptEnqueue([{
        dpId: agiUuid('draw-prompt'),
        prompt: nonEmptyPrompt,
        _repeatCount: isRepeatShown ? tempRepeat : 1,
      }]);
    }
  }, [clearCurrentIdea, isRepeatShown, nonEmptyPrompt, onPromptEnqueue, tempRepeat]);


  // Type...

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
    currentIdeaPrompt && setNextPrompt(currentIdeaPrompt);
  }, [currentIdeaPrompt]);

  // PromptFx
  const handleSimpleEnhance = React.useCallback(async () => {
    if (nonEmptyPrompt?.trim()) {
      setIsSimpleEnhancing(true);
      const improvedPrompt = await imaginePromptFromTextOrThrow(nonEmptyPrompt, 'DEV')
        .catch(console.error);
      if (improvedPrompt)
        setNextPrompt(improvedPrompt);
      setIsSimpleEnhancing(false);
    }
  }, [nonEmptyPrompt]);

  const textEnrichComponents = React.useMemo(() => (
    <Box sx={{
      flex: 1,
      margin: 1,
      marginTop: 0,

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
        variant={isSimpleEnhancing ? 'solid' : 'soft'}
        color='primary'
        disabled={!userHasText}
        loading={isSimpleEnhancing}
        className={promptButtonClass}
        endDecorator={<AutoFixHighIcon sx={{ fontSize: '20px' }} />}
        onClick={handleSimpleEnhance}
        sx={{
          boxShadow: (!userHasText || isSimpleEnhancing) ? undefined : '0 6px 6px -6px rgb(var(--joy-palette-primary-darkChannel) / 40%)',
          borderRadius: 'xs',
          // boxShadow: 'xs'
        }}
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
          <AddRoundedIcon />
        </IconButton>
      </ButtonGroup>

      {/* Char counter */}
      {/*<Typography level='body-sm' sx={{ ml: 'auto', mr: 1 }}>*/}
      {/*  {!!nonEmptyPrompt?.length && nonEmptyPrompt.length.toLocaleString()}*/}
      {/*</Typography>*/}
    </Box>
  ), [handleSimpleEnhance, isSimpleEnhancing, tempCount, userHasText]);

  return (
    <Box aria-label='Drawing Prompt' component='section' sx={props.sx}>

      <Grid container spacing={{ xs: 1, md: 2 }}>

        {/* Prompt (Text) Box */}
        <Grid xs={12} md={9}>
          <Box sx={{
            height: '100%',
            display: 'flex',
            gap: { xs: 1, md: 2 },
          }}>

            {props.isMobile ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>

                <Dropdown>
                  <MenuButton disabled={userHasText} slots={{ root: IconButton }}>
                    <AddRoundedIcon />
                  </MenuButton>
                  <Menu placement='top'>
                    {/* Add From History? */}
                    {/*<MenuItem>*/}
                    {/*  <ButtonPromptFromPlaceholder name='History' disabled />*/}
                    {/*</MenuItem>*/}
                    <MenuItem>
                      <ButtonPromptFromIdea disabled={userHasText} onIdeaNext={nextRandomIdea} onIdeaUse={handleIdeaUse} />
                    </MenuItem>
                    {/*<MenuItem>*/}
                    {/*  <ButtonPromptFromX name='Image' disabled />*/}
                    {/*</MenuItem>*/}
                    {/*<MenuItem>*/}
                    {/*  <ButtonPromptFromPlaceholder name='Chat' disabled />*/}
                    {/*</MenuItem>*/}
                  </Menu>
                </Dropdown>

              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>

                <ButtonPromptFromIdea disabled={userHasText} onIdeaNext={nextRandomIdea} onIdeaUse={handleIdeaUse} />

                {/*<ButtonPromptFromX name='Image' disabled />*/}

                {/*<ButtonPromptFromPlaceholder name='Chats' disabled />*/}

              </Box>

            )}

            <Textarea
              variant='outlined'
              // size='sm'
              autoFocus
              minRows={props.isMobile ? 4 : 3}
              maxRows={props.isMobile ? 6 : 8}
              placeholder={currentIdeaPrompt || 'Enter your prompt here and hit "Draw".'}
              value={nextPrompt}
              onChange={handleTextareaTextChange}
              onKeyDown={handleTextareaKeyDown}
              endDecorator={textEnrichComponents}
              slotProps={{
                textarea: {
                  enterKeyHint: enterIsNewline ? 'enter' : 'send',
                  // ref: props.designerTextAreaRef,
                },
              }}
              sx={{
                flexGrow: 1,
                boxShadow: 'md',
                '&:focus-within': { backgroundColor: 'background.popup' },
                lineHeight: lineHeightTextareaMd,
              }}
            />

          </Box>
        </Grid>

        {/* [Desktop: Right, Mobile: Bottom] Buttons */}
        <Grid xs={12} md={3} sx={{
          mb: 'auto',
          display: 'flex',
          alignItems: 'flex-end', // to align the mobile number picker to the bottom
          gap: { xs: 1, md: 2 },
        }}>

          {/* Toggle the Numbers Picker */}
          {props.isMobile && (
            <IconButton
              variant='soft'
              onClick={() => setShowMobileRepeat(show => !show)}
              sx={isRepeatShown ? {
                backgroundColor: 'background.surface',
                boxShadow: '0 0 8px 0 rgb(var(--joy-palette-primary-mainChannel) / 40%)',
              } : undefined}
            >
              <NumbersRoundedIcon />
            </IconButton>
          )}

          {/* vertical: Draw Button | Number selector  */}
          <Box sx={{
            flex: 1,
            display: 'grid',
            gap: 1,
          }}>

            {/* Draw / Stop */}
            {!qBusy ? (
              <Button
                key='draw-queue'
                variant='solid' color='primary'
                endDecorator={<FormatPaintTwoToneIcon />}
                onClick={handlePromptEnqueue}
                sx={{
                  animation: `${animationEnterBelow} 0.1s ease-out`,
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
                  // animation: `${animationEnterBelow} 0.1s ease-out`,
                  boxShadow: !props.isMobile ? `0 8px 24px -4px rgb(var(--joy-palette-warning-mainChannel) / 20%)` : 'none',
                  justifyContent: 'space-between',
                }}
              >
                Stop / CLEAR (wip)
              </Button>
              <Button
                key='draw-queuemore'
                variant='soft'
                color='primary'
                endDecorator={<MoreTimeIcon sx={{ fontSize: 18 }} />}
                onClick={handlePromptEnqueue}
                sx={{
                  animation: `${animationEnterBelow} 0.1s ease-out`,
                  boxShadow: !props.isMobile ? `0 8px 24px -4px rgb(var(--joy-palette-primary-mainChannel) / 20%)` : 'none',
                  justifyContent: 'space-between',
                }}
              >
                Enqueue
              </Button>
            </>}

            {/* Number selector */}
            {isRepeatShown && (
              <FormControl sx={{ gap: 1 }}>
                {!props.isMobile && <Typography level='body-xs'>&nbsp;Number of Images:</Typography>}
                <Box sx={{ display: 'flex', justifyContent: 'space-evenly' }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <IconButton
                      key={n}
                      color={tempRepeat === n ? 'primary' : 'neutral'}
                      variant={tempRepeat === n ? 'soft' : 'plain'}
                      onClick={() => setTempRepeat(n)}
                      sx={{
                        backgroundColor: tempRepeat === n ? 'background.surface' : undefined,
                        borderRadius: '50%',
                        boxShadow: tempRepeat === n ? '0 0 8px 1px rgb(var(--joy-palette-primary-mainChannel) / 40%)' : 'none',
                        fontWeight: tempRepeat === n ? 'xl' : 400, /* reset, from 600 */
                        '&:hover': {
                          backgroundColor: tempRepeat === n ? 'background.popup' : 'background.surface',
                          boxShadow: '0 0 8px 1px rgb(var(--joy-palette-primary-mainChannel) / 40%)',
                        },
                      }}
                    >
                      {n}
                    </IconButton>
                  ))}
                </Box>
              </FormControl>
            )}

          </Box>

        </Grid>

      </Grid>

      {/* Modals...  */}
      {/* ... */}

    </Box>
  );
}