import * as React from 'react';
import { keyframes } from '@emotion/react';

import { Box, Button, Card, CardContent, IconButton, ListItemDecorator, Typography } from '@mui/joy';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ChatIcon from '@mui/icons-material/Chat';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import MicIcon from '@mui/icons-material/Mic';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import WarningIcon from '@mui/icons-material/Warning';

import { navigateBack } from '~/common/routes';
import { openLayoutPreferences } from '~/common/layout/store-applayout';
import { useCapabilityBrowserSpeechRecognition, useCapabilityElevenLabs } from '~/common/components/useCapabilities';
import { useChatStore } from '~/common/state/store-chats';
import { useUICounter } from '~/common/state/store-ui';


const cssRainbowBackgroundKeyframes = keyframes`
    100%, 0% {
        background-color: rgb(128, 0, 0);
    }
    8% {
        background-color: rgb(102, 51, 0);
    }
    16% {
        background-color: rgb(64, 64, 0);
    }
    25% {
        background-color: rgb(38, 76, 0);
    }
    33% {
        background-color: rgb(0, 89, 0);
    }
    41% {
        background-color: rgb(0, 76, 41);
    }
    50% {
        background-color: rgb(0, 64, 64);
    }
    58% {
        background-color: rgb(0, 51, 102);
    }
    66% {
        background-color: rgb(0, 0, 128);
    }
    75% {
        background-color: rgb(63, 0, 128);
    }
    83% {
        background-color: rgb(76, 0, 76);
    }
    91% {
        background-color: rgb(102, 0, 51);
    }`;

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
          {props.hasIssue ? <WarningIcon color='warning' /> : <CheckIcon color='success' />}
        </ListItemDecorator>
      </CardContent>
    </Card>
  );
}


export function CallWizard(props: { strict?: boolean, conversationId: string, children: React.ReactNode }) {
  // state
  const [chatEmptyOverride, setChatEmptyOverride] = React.useState(false);
  const [recognitionOverride, setRecognitionOverride] = React.useState(false);

  // external state
  const recognition = useCapabilityBrowserSpeechRecognition();
  const synthesis = useCapabilityElevenLabs();
  const chatIsEmpty = useChatStore(state => {
    const conversation = state.conversations.find(conversation => conversation.id === props.conversationId);
    return !(conversation?.messages?.length);
  });
  const { novel, touch } = useUICounter('call-wizard');

  // derived state
  const overriddenEmptyChat = chatEmptyOverride || !chatIsEmpty;
  const overriddenRecognition = recognitionOverride || recognition.mayWork;
  const allGood = overriddenEmptyChat && overriddenRecognition && synthesis.mayWork;
  const fatalGood = overriddenRecognition && synthesis.mayWork;

  if (!novel && fatalGood)
    return props.children;

  const handleOverrideChatEmpty = () => setChatEmptyOverride(true);

  const handleOverrideRecognition = () => setRecognitionOverride(true);

  const handleConfigureElevenLabs = () => {
    openLayoutPreferences(3);
  };

  const handleFinishButton = () => {
    if (!allGood)
      return navigateBack();
    touch();
  };


  return <>

    <Box sx={{ flexGrow: 0.5 }} />

    <Typography level='title-lg' sx={{ fontSize: '3rem', fontWeight: 200, lineHeight: '1.5em', textAlign: 'center' }}>
      Welcome to<br />
      <Typography
        component='span'
        sx={{
          backgroundColor: 'primary.solidActiveBg', mx: -0.5, px: 0.5,
          animation: `${cssRainbowBackgroundKeyframes} 15s linear infinite`,
        }}>
        your first call
      </Typography>
    </Typography>

    <Box sx={{ flexGrow: 0.5 }} />

    <Typography level='body-lg'>
      {/*Before you receive your first call, */}
      Let&apos;s get you all set up.
    </Typography>

    {/* Chat Empty status */}
    <StatusCard
      icon={<ChatIcon />}
      hasIssue={!overriddenEmptyChat}
      text={overriddenEmptyChat ? 'Great! Your chat has messages.' : 'The chat is empty. Calls are effective when the caller has context.'}
      button={overriddenEmptyChat ? undefined : (
        <Button variant='outlined' onClick={handleOverrideChatEmpty} sx={{ mx: 1 }}>
          Ignore
        </Button>
      )}
    />

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
      icon={<RecordVoiceOverIcon />}
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
        size='lg' variant={allGood ? 'soft' : 'solid'} color={allGood ? 'success' : 'danger'}
        onClick={handleFinishButton} sx={{ borderRadius: '50px' }}
      >
        {allGood ? <ArrowForwardIcon sx={{ fontSize: '1.5em' }} /> : <CloseIcon sx={{ fontSize: '1.5em' }} />}
      </IconButton>
    </Box>

    <Box sx={{ flexGrow: 0.5 }} />

  </>;
}