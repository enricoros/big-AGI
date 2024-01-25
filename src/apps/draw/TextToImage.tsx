import * as React from 'react';

import { Box, Button, Card, CardContent, Grid, Textarea, Typography } from '@mui/joy';
import ConstructionIcon from '@mui/icons-material/Construction';
import FormatPaintIcon from '@mui/icons-material/FormatPaint';

import { DallESettings } from '~/modules/t2i/dalle/DallESettings';
import { ProdiaSettings } from '~/modules/t2i/prodia/ProdiaSettings';

import type { TextToImageProvider } from '~/common/components/useCapabilities';
import { lineHeightTextarea } from '~/common/app.theme';
import { useUIPreferencesStore } from '~/common/state/store-ui';

import { ProviderSelect } from './components/ProviderSelect';
import { useDrawIdeas } from './state/useDrawIdeas';


export function TextToImage(props: {
  isMobile: boolean,
  providers: TextToImageProvider[],
  activeProviderId: string | null,
  setActiveProviderId: (providerId: (string | null)) => void
}) {

  // state
  const [nextPrompt, setNextPrompt] = React.useState<string>('');
  const [showProviderSettings, setShowProviderSettings] = React.useState(false);

  // external state
  const { currentIdea, nextRandomIdea } = useDrawIdeas();
  const enterIsNewline = useUIPreferencesStore(state => state.enterIsNewline);


  // derived state
  const { provider, ProviderConfig } = React.useMemo(() => {
    const provider = props.providers.find(provider => provider.id === props.activeProviderId);
    const ProviderConfig: React.FC | null = provider?.vendor === 'openai' ? DallESettings : provider?.vendor === 'prodia' ? ProdiaSettings : null;
    return {
      provider,
      ProviderConfig,
    };
  }, [props.providers, props.activeProviderId]);
  const settingsShown = showProviderSettings && !!ProviderConfig;

  const userHasText = !!nextPrompt;
  const nonEmptyPrompt = nextPrompt || currentIdea.prompt;


  const handleToggleProviderSettings = React.useCallback(() => {
    setShowProviderSettings(on => !on);
  }, [setShowProviderSettings]);


  // Drawing

  const handleDrawEnqueue = React.useCallback(() => {
    // bail is busy
    console.log('enqueue Draw', { prompt, nonEmptyPrompt });
    setNextPrompt('');
  }, [nonEmptyPrompt]);


  // Typing

  const handleTextareaTextChange = React.useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNextPrompt(e.target.value);
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

  const handleIdeaClick = React.useCallback(() => {
    nextRandomIdea();
  }, [nextRandomIdea]);


  return <>

    <Box sx={{ flex: 0, display: 'flex', flexDirection: 'column' }}>

      {/* Service / Options Button */}
      <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1 }}>
        <ProviderSelect {...props} />
        <Button
          variant={settingsShown ? 'solid' : 'outlined'}
          color={settingsShown ? 'primary' : 'neutral'}
          endDecorator={<ConstructionIcon />}
          onClick={handleToggleProviderSettings}
          sx={{ backgroundColor: settingsShown ? undefined : 'background.surface' }}
        >
          Options
        </Button>
      </Box>

      {/* Options */}
      {settingsShown && (
        <Card variant='outlined' sx={{ my: 1, borderTopColor: 'primary.softActiveBg' }}>
          <CardContent sx={{ gap: 2 }}>
            <ProviderConfig />
          </CardContent>
        </Card>
      )}

    </Box>

    {/* Main */}
    <Box sx={{
      flexGrow: 1,
      overflowY: 'auto',
      border: '1px solid blue',
    }}>

      <Box sx={{
        my: 'auto',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 4,
        border: '1px solid red',
      }}>
        a
      </Box>

    </Box>

    {/* Prompt Designer */}
    <Box aria-label='Prompt Designer' component='section' sx={{
      // zIndex: 21,
      // backgroundColor: themeBgAppChatComposer,
      // m: -6, p: 6,
    }}>

      <Grid container spacing={{ xs: 1, md: 2 }}>

        <Grid xs={12} md={9}>

          <Textarea
            variant='outlined'
            autoFocus
            minRows={3}
            maxRows={6}
            placeholder={currentIdea.prompt}
            value={nextPrompt}
            onChange={handleTextareaTextChange}
            onKeyDown={handleTextareaKeyDown}
            startDecorator={
              <Box sx={{
                flex: 1,
                display: 'flex', gap: 1, alignItems: 'center',
              }}>
                <Button
                  endDecorator='🎲'
                  disabled={userHasText}
                  onClick={handleIdeaClick}
                  sx={{ minWidth: 120 }}
                >
                  Idea
                </Button>
                {/*<Button variant='outlined' color='neutral' sx={{ ml: 'auto' }}>*/}
                {/*  See all*/}
                {/*</Button>*/}
              </Box>
            }
            endDecorator={
              <Typography level='body-sm' sx={{ ml: 'auto', mr: 1 }}>
                {!!nonEmptyPrompt?.length && nonEmptyPrompt.length.toLocaleString() + ' characters'}
              </Typography>
            }
            slotProps={{
              textarea: {
                enterKeyHint: enterIsNewline ? 'enter' : 'send',
                // ref: props.composerTextAreaRef,
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
              boxShadow: props.isMobile ? 'none' : `0 8px 24px -4px rgb(var(--joy-palette-primary-mainChannel) / 20%)`,
            }}
          >
            Draw
          </Button>

        </Grid>

      </Grid>
    </Box>
  </>;
}