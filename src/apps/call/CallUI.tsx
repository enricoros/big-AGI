import * as React from 'react';
import { shallow } from 'zustand/shallow';
import { useRouter } from 'next/router';

import { Box, Card, ListItemDecorator, MenuItem, Switch, Typography } from '@mui/joy';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CallEndIcon from '@mui/icons-material/CallEnd';
import CallIcon from '@mui/icons-material/Call';
import ChatOutlinedIcon from '@mui/icons-material/ChatOutlined';
import MicIcon from '@mui/icons-material/Mic';
import MicNoneIcon from '@mui/icons-material/MicNone';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';

import { useChatLLMDropdown } from '../chat/components/applayout/useLLMDropdown';

import { EXPERIMENTAL_speakTextStream } from '~/modules/elevenlabs/elevenlabs.client';
import { SystemPurposeId, SystemPurposes } from '../../data';
import { VChatMessageIn } from '~/modules/llms/transports/chatGenerate';
import { streamChat } from '~/modules/llms/transports/streamChat';
import { useVoiceDropdown } from '~/modules/elevenlabs/useVoiceDropdown';

import { Link } from '~/common/components/Link';
import { SpeechResult, useSpeechRecognition } from '~/common/components/useSpeechRecognition';
import { conversationTitle, createDMessage, DMessage, useChatStore } from '~/common/state/store-chats';
import { playSoundUrl, usePlaySoundUrl } from '~/common/util/audioUtils';
import { useLayoutPluggable } from '~/common/layout/store-applayout';

import { CallAvatar } from './components/CallAvatar';
import { CallButton } from './components/CallButton';
import { CallMessage } from './components/CallMessage';
import { CallStatus } from './components/CallStatus';


function CallMenuItems(props: {
  pushToTalk: boolean,
  setPushToTalk: (pushToTalk: boolean) => void,
  override: boolean,
  setOverride: (overridePersonaVoice: boolean) => void,
}) {

  // external state
  const { voicesDropdown } = useVoiceDropdown(false, !props.override);

  const handlePushToTalkToggle = () => props.setPushToTalk(!props.pushToTalk);

  const handleChangeVoiceToggle = () => props.setOverride(!props.override);

  return <>

    <MenuItem onClick={handlePushToTalkToggle}>
      <ListItemDecorator>{props.pushToTalk ? <MicNoneIcon /> : <MicIcon />}</ListItemDecorator>
      Push to talk
      <Switch checked={props.pushToTalk} onChange={handlePushToTalkToggle} sx={{ ml: 'auto' }} />
    </MenuItem>

    <MenuItem onClick={handleChangeVoiceToggle}>
      <ListItemDecorator><RecordVoiceOverIcon /></ListItemDecorator>
      Change Voice
      <Switch checked={props.override} onChange={handleChangeVoiceToggle} sx={{ ml: 'auto' }} />
    </MenuItem>

    <MenuItem>
      <ListItemDecorator>{' '}</ListItemDecorator>
      {voicesDropdown}
    </MenuItem>

    <MenuItem component={Link} href='https://github.com/enricoros/big-agi/issues/175' target='_blank'>
      <ListItemDecorator><ChatOutlinedIcon /></ListItemDecorator>
      Voice Calls Feedback
    </MenuItem>

  </>;
}


export function CallUI(props: {
  conversationId: string,
  personaId: string,
}) {

  // state
  const [avatarClickCount, setAvatarClickCount] = React.useState<number>(0);// const [micMuted, setMicMuted] = React.useState(false);
  const [callElapsedTime, setCallElapsedTime] = React.useState<string>('00:00');
  const [callMessages, setCallMessages] = React.useState<DMessage[]>([]);
  const [overridePersonaVoice, setOverridePersonaVoice] = React.useState<boolean>(false);
  const [personaTextInterim, setPersonaTextInterim] = React.useState<string | null>(null);
  const [pushToTalk, setPushToTalk] = React.useState(true);
  const [stage, setStage] = React.useState<'ring' | 'declined' | 'connected' | 'ended'>('ring');
  const responseAbortController = React.useRef<AbortController | null>(null);

  // external state
  const { push: routerPush } = useRouter();
  const { chatLLMId, chatLLMDropdown } = useChatLLMDropdown();
  const { chatTitle, messages } = useChatStore(state => {
    const conversation = state.conversations.find(conversation => conversation.id === props.conversationId);
    return {
      chatTitle: conversation ? conversationTitle(conversation) : 'no conversation',
      messages: conversation ? conversation.messages : [],
    };
  }, shallow);
  const persona = SystemPurposes[props.personaId as SystemPurposeId] ?? undefined;
  const personaCallStarters = persona?.call?.starters ?? undefined;
  const personaVoiceId = overridePersonaVoice ? undefined : (persona?.voices?.elevenLabs?.voiceId ?? undefined);
  const personaSystemMessage = persona?.systemMessage ?? undefined;

  // hooks and speech
  const [speechInterim, setSpeechInterim] = React.useState<SpeechResult | null>(null);
  const onSpeechResultCallback = React.useCallback((result: SpeechResult) => {
    setSpeechInterim(result.done ? null : { ...result });
    if (result.done) {
      const transcribed = result.transcript.trim();
      if (transcribed.length >= 1)
        setCallMessages(messages => [...messages, createDMessage('user', transcribed)]);
    }
  }, []);
  const { isSpeechEnabled, isRecording, isRecordingAudio, isRecordingSpeech, startRecording, stopRecording, toggleRecording } = useSpeechRecognition(onSpeechResultCallback, 1000);

  // derived state
  const isRinging = stage === 'ring';
  const isConnected = stage === 'connected';
  const isDeclined = stage === 'declined';
  const isEnded = stage === 'ended';


  /// Sounds

  // pickup / hangup
  React.useEffect(() => {
    !isRinging && playSoundUrl(isConnected ? '/sounds/chat-begin.mp3' : '/sounds/chat-end.mp3');
  }, [isRinging, isConnected]);

  // ringtone
  usePlaySoundUrl(isRinging ? '/sounds/chat-ringtone.mp3' : null, 300, 2800 * 2);


  /// CONNECTED

  const handleCallStop = () => {
    stopRecording();
    setStage('ended');
  };

  // [E] pickup -> seed message and call timer
  // FIXME: Overriding the voice will reset the call - not a desired behavior
  React.useEffect(() => {
    if (!isConnected) return;

    // show the call timer
    setCallElapsedTime('00:00');
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - start) / 1000);
      const minutes = Math.floor(elapsedSeconds / 60);
      const seconds = elapsedSeconds % 60;
      setCallElapsedTime(`${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`);
    }, 1000);

    // seed the first message
    const phoneMessages = personaCallStarters || ['Hello?', 'Hey!'];
    const firstMessage = phoneMessages[Math.floor(Math.random() * phoneMessages.length)];

    setCallMessages([createDMessage('assistant', firstMessage)]);
    // fire/forget
    void EXPERIMENTAL_speakTextStream(firstMessage, personaVoiceId);

    return () => clearInterval(interval);
  }, [isConnected, personaCallStarters, personaVoiceId]);

  // [E] persona streaming response - upon new user message
  React.useEffect(() => {
    // only act when we have a new user message
    if (!isConnected || callMessages.length < 1 || callMessages[callMessages.length - 1].role !== 'user')
      return;
    switch (callMessages[callMessages.length - 1].text) {
      // do not respond
      case 'Stop.':
        return;
      // command: close the call
      case 'Goodbye.':
        setStage('ended');
        setTimeout(() => {
          void routerPush('/');
        }, 2000);
        return;
      // command: regenerate answer
      case 'Retry.':
      case 'Try again.':
        setCallMessages(messages => messages.slice(0, messages.length - 2));
        return;
      // command: restart chat
      case 'Restart.':
        setCallMessages([]);
        return;
    }

    // bail if no llm selected
    if (!chatLLMId) return;

    // temp fix: when the chat has no messages, only assume a single system message
    const chatMessages: { role: VChatMessageIn['role'], text: string }[] = messages.length > 0
      ? messages
      : personaSystemMessage
        ? [{ role: 'system', text: personaSystemMessage }]
        : [];

    // 'prompt' for a "telephone call"
    // FIXME: can easily run ouf of tokens - if this gets traction, we'll fix it
    const callPrompt: VChatMessageIn[] = [
      { role: 'system', content: 'You are having a phone call. Your response style is brief and to the point, and according to your personality, defined below.' },
      ...chatMessages.map(message => ({ role: message.role, content: message.text })),
      { role: 'system', content: 'You are now on the phone call related to the chat above. Respect your personality and answer with short, friendly and accurate thoughtful lines.' },
      ...callMessages.map(message => ({ role: message.role, content: message.text })),
    ];

    // perform completion
    responseAbortController.current = new AbortController();
    let finalText = '';
    let error: any | null = null;
    streamChat(chatLLMId, callPrompt, responseAbortController.current.signal, (updatedMessage: Partial<DMessage>) => {
      const text = updatedMessage.text?.trim();
      if (text) {
        finalText = text;
        setPersonaTextInterim(text);
      }
    }).catch((err: DOMException) => {
      if (err?.name !== 'AbortError')
        error = err;
    }).finally(() => {
      setPersonaTextInterim(null);
      setCallMessages(messages => [...messages, createDMessage('assistant', finalText + (error ? ` (ERROR: ${error.message || error.toString()})` : ''))]);
      // fire/forget
      void EXPERIMENTAL_speakTextStream(finalText, personaVoiceId);
    });

    return () => {
      responseAbortController.current?.abort();
      responseAbortController.current = null;
    };
  }, [isConnected, callMessages, chatLLMId, messages, personaVoiceId, personaSystemMessage, routerPush]);

  // [E] Message interrupter
  const abortTrigger = isConnected && isRecordingSpeech;
  React.useEffect(() => {
    if (abortTrigger && responseAbortController.current) {
      responseAbortController.current.abort();
      responseAbortController.current = null;
    }
    // TODO.. abort current speech
  }, [abortTrigger]);


  // [E] continuous speech recognition (reload)
  const shouldStartRecording = isConnected && !pushToTalk && speechInterim === null && !isRecordingAudio;
  React.useEffect(() => {
    if (shouldStartRecording)
      startRecording();
  }, [shouldStartRecording, startRecording]);


  // more derived state
  const personaName = persona?.title ?? 'Unknown';
  const isMicEnabled = isSpeechEnabled;
  const isTTSEnabled = true;
  const isEnabled = isMicEnabled && isTTSEnabled;


  // pluggable UI

  const menuItems = React.useMemo(() =>
      <CallMenuItems
        pushToTalk={pushToTalk} setPushToTalk={setPushToTalk}
        override={overridePersonaVoice} setOverride={setOverridePersonaVoice} />
    , [overridePersonaVoice, pushToTalk],
  );

  useLayoutPluggable(chatLLMDropdown, null, menuItems);


  return <>

    <Typography
      level='h1'
      sx={{
        fontSize: { xs: '2.5rem', md: '3rem' },
        textAlign: 'center',
        mx: 2,
      }}
    >
      {isConnected ? personaName : 'Hello'}
    </Typography>

    <CallAvatar
      symbol={persona?.symbol || '?'}
      imageUrl={persona?.imageUri}
      isRinging={isRinging}
      onClick={() => setAvatarClickCount(avatarClickCount + 1)}
    />

    <CallStatus
      callerName={isConnected ? undefined : personaName}
      statusText={isRinging ? 'is calling you' : isDeclined ? 'call declined' : isEnded ? 'call ended' : callElapsedTime}
      regardingText={chatTitle}
      micError={!isMicEnabled} speakError={!isTTSEnabled}
    />

    {/* Live Transcript, w/ streaming messages, audio indication, etc. */}
    {(isConnected || isEnded) && (
      <Card variant='soft' sx={{
        flexGrow: 1,
        minHeight: '15dvh', maxHeight: '24dvh',
        overflow: 'auto',
        width: '100%',
        borderRadius: 'lg',
        flexDirection: 'column-reverse',
      }}>

        {/* Messages in reverse order, for auto-scroll from the bottom */}
        <Box sx={{ display: 'flex', flexDirection: 'column-reverse', gap: 1 }}>

          {/* Listening... */}
          {isRecording && (
            <CallMessage
              text={<>{speechInterim?.transcript ? speechInterim.transcript + ' ' : ''}<i>{speechInterim?.interimTranscript}</i></>}
              variant={isRecordingSpeech ? 'solid' : 'outlined'}
              role='user'
            />
          )}

          {/* Persona streaming text... */}
          {!!personaTextInterim && (
            <CallMessage
              text={personaTextInterim}
              variant='solid' color='neutral'
              role='assistant'
            />
          )}

          {/* Messages (last 6 messages, in reverse order) */}
          {callMessages.slice(-6).reverse().map((message) =>
            <CallMessage
              key={message.id}
              text={message.text}
              variant={message.role === 'assistant' ? 'solid' : 'soft'} color='neutral'
              role={message.role} />,
          )}
        </Box>
      </Card>
    )}

    {/* Call Buttons */}
    <Box sx={{ width: '100%', display: 'flex', justifyContent: 'space-evenly' }}>

      {/* [ringing] Decline / Accept */}
      {isRinging && <CallButton Icon={CallEndIcon} text='Decline' color='danger' onClick={() => setStage('declined')} />}
      {isRinging && isEnabled && <CallButton Icon={CallIcon} text='Accept' color='success' variant='soft' onClick={() => setStage('connected')} />}

      {/* [Calling] Hang / PTT (mute not enabled yet) */}
      {isConnected && <CallButton Icon={CallEndIcon} text='Hang up' color='danger' onClick={handleCallStop} />}
      {isConnected && (pushToTalk
          ? <CallButton Icon={MicIcon} onClick={toggleRecording}
                        text={isRecordingSpeech ? 'Listening...' : isRecording ? 'Listening' : 'Push To Talk'}
                        variant={isRecordingSpeech ? 'solid' : isRecording ? 'soft' : 'outlined'} />
          : null
        // <CallButton disabled={true} Icon={MicOffIcon} onClick={() => setMicMuted(muted => !muted)}
        //               text={micMuted ? 'Muted' : 'Mute'}
        //               color={micMuted ? 'warning' : undefined} variant={micMuted ? 'solid' : 'outlined'} />
      )}

      {/* [ended] Back / Call Again */}
      {(isEnded || isDeclined) && <Link noLinkStyle href='/'><CallButton Icon={ArrowBackIcon} text='Back' variant='soft' /></Link>}
      {(isEnded || isDeclined) && <CallButton Icon={CallIcon} text='Call Again' color='success' variant='soft' onClick={() => setStage('connected')} />}

    </Box>

    {/* DEBUG state */}
    {avatarClickCount > 10 && (avatarClickCount % 2 === 0) && (
      <Card variant='outlined' sx={{ maxHeight: '25dvh', overflow: 'auto', whiteSpace: 'pre', py: 0, width: '100%' }}>
        Special commands: Stop, Retry, Try Again, Restart, Goodbye.
        {JSON.stringify({ isSpeechEnabled, isRecordingAudio, speechInterim }, null, 2)}
      </Card>
    )}

    {/*{isEnded && <Card variant='solid' size='lg' color='primary'>*/}
    {/*  <CardContent>*/}
    {/*    <Typography>*/}
    {/*      Please rate the call quality, 1 to 5 - Just a Joke*/}
    {/*    </Typography>*/}
    {/*  </CardContent>*/}
    {/*</Card>}*/}

  </>;
}