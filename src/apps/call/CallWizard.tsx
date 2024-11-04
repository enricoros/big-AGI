import * as React from 'react';

import { Box, Button, Card, CardContent, IconButton, ListItemDecorator, Typography } from '@mui/joy';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import ChatIcon from '@mui/icons-material/Chat';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import MicIcon from '@mui/icons-material/Mic';
import RecordVoiceOverTwoToneIcon from '@mui/icons-material/RecordVoiceOverTwoTone';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';

import { animationColorRainbow } from '~/common/util/animUtils';
import { navigateBack } from '~/common/app.routes';
import { optimaOpenPreferences } from '~/common/layout/optima/useOptima';
import { useCapabilityBrowserSpeechRecognition, useCapabilityElevenLabs } from '~/common/components/useCapabilities';
import { useChatStore } from '~/common/stores/chat/store-chats';
import { useUICounter } from '~/common/state/store-ui';


function StatusCard(props: { icon: React.JSX.Element, hasIssue: boolean, text: string, button?: React.JSX.Element }) {
  return (
    <Card sx={{ width: '100%' }}>
      <CardContent sx={{ flexDirection: 'row' }}>
        <ListItemDecorator>
          {props.icon}
        </ListItemDecorator>
        <Typography level='title-md' color={props.hasIssue ? 'warning' : undefined} sx={{ flexGrow: 1 }}>
          {props.text}
          {props.button}
        </Typography>
        <ListItemDecorator>
          {props.hasIssue ? <WarningRoundedIcon color='warning' /> : <CheckRoundedIcon color='success' />}
        </ListItemDecorator>
      </CardContent>
    </Card>
  );
}


export function CallWizard(props: { strict?: boolean, conversationId: string | null, children: React.ReactNode }) {

  // state
  const [chatEmptyOverride, setChatEmptyOverride] = React.useState(false);
  const [recognitionOverride, setRecognitionOverride] = React.useState(false);

  // external state
  const recognition = useCapabilityBrowserSpeechRecognition();
  const synthesis = useCapabilityElevenLabs();
  const chatIsEmpty = useChatStore(state => {
    if (!props.conversationId)
      return false;
    const conversation = state.conversations.find(conversation => conversation.id === props.conversationId);
    return !(conversation?.messages?.length);
  });
  const { novel, touch } = useUICounter('call-wizard');

  // derived state
  const outOfTheBlue = !props.conversationId;
  const overriddenEmptyChat = chatEmptyOverride || !chatIsEmpty;
  const overriddenRecognition = recognitionOverride || recognition.mayWork;
  const allGood = overriddenEmptyChat && overriddenRecognition && synthesis.mayWork;
  const fatalGood = overriddenRecognition && synthesis.mayWork;


  const handleOverrideChatEmpty = React.useCallback(() => setChatEmptyOverride(true), []);

  const handleOverrideRecognition = React.useCallback(() => setRecognitionOverride(true), []);

  const handleConfigureElevenLabs = React.useCallback(() => optimaOpenPreferences('voice'), []);

  const handleFinishButton = React.useCallback(() => {
    if (!allGood)
      return navigateBack();
    touch();
  }, [allGood, touch]);


  if (!novel && fatalGood)
    return props.children;


  return <>

    <Box sx={{ flexGrow: 0.5 }} />

    <Typography level='title-lg' sx={{ fontSize: '3rem', fontWeight: 'sm', textAlign: 'center' }}>
      Welcome to<br />
      <Box component='span' sx={{ animation: `${animationColorRainbow} 15s linear infinite` }}>
        your first call
      </Box>
    </Typography>

    <Box sx={{ flexGrow: 0.5 }} />

    <Typography level='body-lg'>
      {/*Before you receive your first call, */}
      Let&apos;s get you all set up.
    </Typography>

    {/* Chat Empty status */}
    {!outOfTheBlue && <StatusCard
      icon={<ChatIcon />}
      hasIssue={!overriddenEmptyChat}
      text={overriddenEmptyChat ? 'Great! Your chat has messages.' : 'The chat is empty. Calls are effective when the caller has context.'}
      button={overriddenEmptyChat ? undefined : (
        <Button variant='outlined' onClick={handleOverrideChatEmpty} sx={{ mx: 1 }}>
          Ignore
        </Button>
      )}
    />}

    {/* Add the speech to text feature status */}
    <StatusCard
      icon={<MicIcon />}
      text={
        ((overriddenRecognition && !recognition.warnings.length) ? 'Speech recognition should be good to go.' : 'There might be a speech recognition issue.')
        + (recognition.isApiAvailable ? '' : ' Your browser does not support the speech recognition API.')
        + (recognition.isDeviceNotSupported ? ' Your device does not provide this feature.' : '')
        + (recognition.warnings.length ? ' ⚠️ ' + recognition.warnings.join(' · ') : '')
      }
      button={overriddenRecognition ? undefined : (
        <Button variant='outlined' onClick={handleOverrideRecognition} sx={{ mx: 1 }}>
          Ignore
        </Button>
      )}
      hasIssue={!overriddenRecognition}
    />

    {/* Text to Speech status */}
    <StatusCard
      icon={<RecordVoiceOverTwoToneIcon />}
      text={
        (synthesis.mayWork ? 'Voice synthesis should be ready.' : 'There might be an issue with ElevenLabs voice synthesis.')
        + (synthesis.isConfiguredServerSide ? '' : (synthesis.isConfiguredClientSide ? '' : ' Please add your API key in the settings.'))
      }
      button={synthesis.mayWork ? undefined : (
        <Button variant='outlined' onClick={handleConfigureElevenLabs} sx={{ mx: 1 }}>
          Configure
        </Button>
      )}
      hasIssue={!synthesis.mayWork}
    />

    {/*<Typography>*/}
    {/*  1. To start a call, click the "Accept" button when you receive an incoming call.*/}
    {/*  2. If your mic is enabled, you'll see a "Push to Talk" button. Press and hold it to speak, then release it to stop speaking.*/}
    {/*  3. If your mic is disabled, you can still type your messages in the chat and the assistant will respond.*/}
    {/*  4. During the call, you can control the voice synthesis settings from the menu in the top right corner.*/}
    {/*  5. To end the call, click the "Hang up" button.*/}
    {/*</Typography>*/}

    <Box sx={{ flexGrow: 2 }} />

    {/* bottom: text & button */}
    <Box sx={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', width: '100%', gap: 2, px: 0.5 }}>

      <Typography level='body-lg'>
        {allGood ? 'Ready, Set, Call' : 'Please resolve the issues above before proceeding with the call'}
      </Typography>

      <IconButton
        size='lg'
        variant='solid' color={allGood ? 'success' : 'danger'}
        onClick={handleFinishButton}
        sx={{
          borderRadius: '50px',
          mr: 0.5,
          // animation: `${cssRainbowBackgroundKeyframes} 15s linear infinite`,
          // boxShadow: allGood ? 'md' : 'none',
        }}
      >
        {allGood ? <ArrowForwardRoundedIcon sx={{ fontSize: '1.5em' }} /> : <CloseRoundedIcon sx={{ fontSize: '1.5em' }} />}
      </IconButton>
    </Box>

    <Box sx={{ flexGrow: 2 }} />

  </>;
}