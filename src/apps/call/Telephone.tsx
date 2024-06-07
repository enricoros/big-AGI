import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import { Box, Card, ListDivider, ListItemDecorator, MenuItem, Switch, Typography } from '@mui/joy';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CallEndIcon from '@mui/icons-material/CallEnd';
import CallIcon from '@mui/icons-material/Call';
import MicIcon from '@mui/icons-material/Mic';
import MicNoneIcon from '@mui/icons-material/MicNone';
import RecordVoiceOverTwoToneIcon from '@mui/icons-material/RecordVoiceOverTwoTone';

import { ScrollToBottom } from '~/common/scroll-to-bottom/ScrollToBottom';
import { ScrollToBottomButton } from '~/common/scroll-to-bottom/ScrollToBottomButton';
import { useChatLLMDropdown } from '../chat/components/useLLMDropdown';

import { EXPERIMENTAL_speakTextStream } from '~/modules/elevenlabs/elevenlabs.client';
import { SystemPurposeId, SystemPurposes } from '../../data';
import { llmStreamingChatGenerate, VChatMessageIn } from '~/modules/llms/llm.client';
import { useElevenLabsVoiceDropdown } from '~/modules/elevenlabs/useElevenLabsVoiceDropdown';

import { Link } from '~/common/components/Link';
import { SpeechResult, useSpeechRecognition } from '~/common/components/useSpeechRecognition';
import { conversationTitle, createDMessage, DMessage, useChatStore } from '~/common/state/store-chats';
import { launchAppChat, navigateToIndex } from '~/common/app.routes';
import { playSoundUrl, usePlaySoundUrl } from '~/common/util/audioUtils';
import { usePluggableOptimaLayout } from '~/common/layout/optima/useOptimaLayout';

import type { AppCallIntent } from './AppCall';
import { CallAvatar } from './components/CallAvatar';
import { CallButton } from './components/CallButton';
import { CallMessage } from './components/CallMessage';
import { CallStatus } from './components/CallStatus';
import { useAppCallStore } from './state/store-app-call';


function CallMenuItems(props: {
  pushToTalk: boolean,
  setPushToTalk: (pushToTalk: boolean) => void,
  override: boolean,
  setOverride: (overridePersonaVoice: boolean) => void,
}) {

  // external state
  const { grayUI, toggleGrayUI } = useAppCallStore();
  const { voicesDropdown } = useElevenLabsVoiceDropdown(false, !props.override);

  const handlePushToTalkToggle = () => props.setPushToTalk(!props.pushToTalk);

  const handleChangeVoiceToggle = () => props.setOverride(!props.override);

  return <>

    <MenuItem onClick={handlePushToTalkToggle}>
      <ListItemDecorator>{props.pushToTalk ? <MicNoneIcon /> : <MicIcon />}</ListItemDecorator>
      Push to talk
      <Switch checked={props.pushToTalk} onChange={handlePushToTalkToggle} sx={{ ml: 'auto' }} />
    </MenuItem>

    <MenuItem onClick={handleChangeVoiceToggle}>
      <ListItemDecorator><RecordVoiceOverTwoToneIcon /></ListItemDecorator>
      Change Voice
      <Switch checked={props.override} onChange={handleChangeVoiceToggle} sx={{ ml: 'auto' }} />
    </MenuItem>

    <MenuItem>
      <ListItemDecorator>{' '}</ListItemDecorator>
      {voicesDropdown}
    </MenuItem>

    <ListDivider />

    <MenuItem onClick={toggleGrayUI}>
      Grayed UI
      <Switch checked={grayUI} sx={{ ml: 'auto' }} />
    </MenuItem>

    <MenuItem component={Link} href='https://github.com/enricoros/big-agi/issues/175' target='_blank'>
      Voice Calls Feedback
    </MenuItem>

  </>;
}


export function Telephone(props: {
  callIntent: AppCallIntent,
  backToContacts: () => void,
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
  const { chatLLMId, chatLLMDropdown } = useChatLLMDropdown();
  const { chatTitle, reMessages } = useChatStore(useShallow(state => {
    const conversation = props.callIntent.conversationId
      ? state.conversations.find(conversation => conversation.id === props.callIntent.conversationId) ?? null
      : null;
    return {
      chatTitle: conversation ? conversationTitle(conversation) : null,
      reMessages: conversation ? conversation.messages : null,
    };
  }));
  const persona = SystemPurposes[props.callIntent.personaId as SystemPurposeId] ?? undefined;
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
        setTimeout(launchAppChat, 2000);
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
    const chatMessages: { role: VChatMessageIn['role'], text: string }[] = (reMessages && reMessages.length > 0)
      ? reMessages
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
    setPersonaTextInterim('💭...');
    llmStreamingChatGenerate(chatLLMId, callPrompt, 'call', callMessages[0].id, null, null, responseAbortController.current.signal, ({ textSoFar }) => {
      const text = textSoFar?.trim();
      if (text) {
        finalText = text;
        setPersonaTextInterim(text);
      }
    }).catch((err: DOMException) => {
      if (err?.name !== 'AbortError')
        error = err;
    }).finally(() => {
      setPersonaTextInterim(null);
      if (finalText || error)
        setCallMessages(messages => [...messages, createDMessage('assistant', finalText + (error ? ` (ERROR: ${error.message || error.toString()})` : ''))]);
      // fire/forget
      if (finalText?.length >= 1)
        void EXPERIMENTAL_speakTextStream(finalText, personaVoiceId);
    });

    return () => {
      responseAbortController.current?.abort();
      responseAbortController.current = null;
    };
  }, [isConnected, callMessages, chatLLMId, personaVoiceId, personaSystemMessage, reMessages]);

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

  usePluggableOptimaLayout(null, chatLLMDropdown, menuItems, 'CallUI');


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
      statusText={isRinging ? '' /*'is calling you'*/ : isDeclined ? 'call declined' : isEnded ? 'call ended' : callElapsedTime}
      regardingText={chatTitle}
      micError={!isMicEnabled} speakError={!isTTSEnabled}
    />

    {/* Live Transcript, w/ streaming messages, audio indication, etc. */}
    {(isConnected || isEnded) && (
      <Card variant='outlined' sx={{
        flexGrow: 1,
        maxHeight: '28%',
        minHeight: '20%',
        width: '100%',

        // style
        // backgroundColor: 'background.surface',
        borderRadius: 'lg',
        // boxShadow: 'sm',

        // children
        padding: 0, // move this to the ScrollToBottom component
      }}>

        <ScrollToBottom stickToBottomInitial>

          <Box sx={{ minHeight: '100%', p: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>

            {/* Call Messages [] */}
            {callMessages.map((message) =>
              <CallMessage
                key={message.id}
                text={message.text}
                variant={message.role === 'assistant' ? 'solid' : 'soft'}
                color={message.role === 'assistant' ? 'neutral' : 'primary'}
                role={message.role}
              />,
            )}

            {/* Persona streaming text... */}
            {!!personaTextInterim && (
              <CallMessage
                text={personaTextInterim}
                variant='outlined'
                color='neutral'
                role='assistant'
              />
            )}

            {/* Listening... */}
            {isRecording && (
              <CallMessage
                text={<>{speechInterim?.transcript.trim() || null}{speechInterim?.interimTranscript.trim() ? <i> {speechInterim.interimTranscript}</i> : null}</>}
                variant={(isRecordingSpeech || !!speechInterim?.transcript) ? 'soft' : 'outlined'}
                color='primary'
                role='user'
              />
            )}

          </Box>

          {/* Visibility and actions are handled via Context */}
          <ScrollToBottomButton />

        </ScrollToBottom>
      </Card>
    )}

    {/* Call Buttons */}
    <Box sx={{ width: '100%', display: 'flex', justifyContent: 'space-evenly', gap: 4 }}>

      {/* [ringing] Decline / Accept */}
      {isRinging && <CallButton Icon={CallEndIcon} text='Decline' color='danger' variant='solid' onClick={() => setStage('declined')} />}
      {isRinging && isEnabled && <CallButton Icon={CallIcon} text='Accept' color='success' variant='solid' onClick={() => setStage('connected')} />}

      {/* [Calling] Hang / PTT (mute not enabled yet) */}
      {isConnected && <CallButton Icon={CallEndIcon} text='Hang up' color='danger' variant='soft' onClick={handleCallStop} />}
      {isConnected && (pushToTalk ? (
          <CallButton
            Icon={MicIcon} onClick={toggleRecording}
            text={isRecordingSpeech ? 'Listening...' : isRecording ? 'Listening' : 'Push To Talk'}
            variant={isRecordingSpeech ? 'solid' : isRecording ? 'soft' : 'outlined'}
            color='primary'
            sx={!isRecording ? { backgroundColor: 'background.surface' } : undefined}
          />
        ) : null
        // <CallButton disabled={true} Icon={MicOffIcon} onClick={() => setMicMuted(muted => !muted)}
        //               text={micMuted ? 'Muted' : 'Mute'}
        //               color={micMuted ? 'warning' : undefined} variant={micMuted ? 'solid' : 'outlined'} />
      )}

      {/* [ended] Back / Call Again */}
      {(isEnded || isDeclined) && <CallButton Icon={ArrowBackIcon} text='Back' variant='soft' onClick={() => props.callIntent.backTo === 'app-chat' ? navigateToIndex() : props.backToContacts()} />}
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