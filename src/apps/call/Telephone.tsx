import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Card, Checkbox, Chip, ListItem, ListItemDecorator, MenuItem, Typography } from '@mui/joy';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CallEndIcon from '@mui/icons-material/CallEnd';
import CallIcon from '@mui/icons-material/Call';
import HeadphonesIcon from '@mui/icons-material/Headphones';
import MicIcon from '@mui/icons-material/Mic';

import { ScrollToBottom } from '~/common/scroll-to-bottom/ScrollToBottom';
import { ScrollToBottomButton } from '~/common/scroll-to-bottom/ScrollToBottomButton';
import { useChatLLMDropdown } from '../chat/components/layout-bar/useLLMDropdown';
import { useChatMicTimeoutMsValue } from '../chat/store-app-chat';

import { SystemPurposeId, SystemPurposes } from '../../data';

import { aixChatGenerateContent_DMessage_FromConversation, AixChatGenerateContent_DMessageGuts } from '~/modules/aix/client/aix.client';
import { speakText } from '~/modules/speex/speex.client';

import type { FormRadioOption } from '~/common/components/forms/FormRadioControl';
import type { OptimaBarControlMethods } from '~/common/layout/optima/bar/OptimaBarDropdown';
import { AudioPlayer } from '~/common/util/audio/AudioPlayer';
import { FormChipGroupControl } from '~/common/components/forms/FormChipGroupControl';
import { OptimaPanelGroupedList } from '~/common/layout/optima/panel/OptimaPanelGroupedList';
import { OptimaPanelIn, OptimaToolbarIn } from '~/common/layout/optima/portals/OptimaPortalsIn';
import { SpeechResult, useSpeechRecognition } from '~/common/components/speechrecognition/useSpeechRecognition';
import { clipboardInterceptCtrlCForCleanup } from '~/common/util/clipboardUtils';
import { conversationTitle, remapMessagesSysToUsr } from '~/common/stores/chat/chat.conversation';
import { createDMessageFromFragments, createDMessageTextContent, DMessage, messageFragmentsReduceText, messageWasInterruptedAtStart } from '~/common/stores/chat/chat.message';
import { createErrorContentFragment } from '~/common/stores/chat/chat.fragments';
import { launchAppChat, navigateToIndex } from '~/common/app.routes';
import { useChatStore } from '~/common/stores/chat/store-chats';
import { useGlobalShortcuts } from '~/common/components/shortcuts/useGlobalShortcuts';
import { usePlayUrlInterval } from './state/usePlayUrlInterval';

import type { AppCallIntent } from './AppCall';
import { CallAvatar } from './components/CallAvatar';
import { CallButton } from './components/CallButton';
import { CallMessage } from './components/CallMessage';
import { CallStatus } from './components/CallStatus';
import { useAppCallStore } from './state/store-app-call';


// end-of-turn pause, the 'custom' ladder; 'global' follows the chat Mic Timeout instead (#1188: a call must not inherit the 5s dictation default)
const _sendAfterOptions: ReadonlyArray<FormRadioOption<string>> = [
  { value: '1000', label: '1s', tooltip: 'Snappy back-and-forth' },
  { value: '2000', label: '2s' },
  { value: '5000', label: '5s' },
  { value: '15000', label: '15s', tooltip: 'Room to think mid-sentence' },
] as const;


// how the mic opens: click per turn, or always listening between replies
const _micModeOptions: ReadonlyArray<FormRadioOption<'ptt' | 'always'>> = [
  { value: 'ptt', label: 'Push to talk', description: 'Click' },
  { value: 'always', label: 'Always on', description: 'Mic stays on' },
] as const;


// notice under a row, same look as the Beam 'model unavailable' chip
const _noticeChipSx: SxProps = {
  borderRadius: 'sm',
  border: '1px solid',
  borderColor: 'warning.outlinedBorder',
  fontSize: 'xs',
  lineHeight: 'sm',
  height: 'auto',
  whiteSpace: 'normal',
  px: 1,
  py: 0.5,
};


// chip row in a panel group: same metrics as the chat panel's 'Read aloud' row
const _chipRowSx: SxProps = {
  '--ListItem-minHeight': '2.25rem',
  pl: 1.25,
  // narrow panels: the chips drop under the label, still right-aligned
  '& .MuiFormControl-root': { flexWrap: 'wrap', rowGap: 0.5 },
  '& .MuiButtonGroup-root': { ml: 'auto' },
};

// label-less chip row: the control does not fill the row, the chips align to the end (under the row above)
const _chipRowEndSx: SxProps = {
  ..._chipRowSx,
  justifyContent: 'flex-end',
  '& .MuiFormControl-root': { flexGrow: 0 },
};


function CallMenu(props: {
  pushToTalk: boolean,
  setPushToTalk: (pushToTalk: boolean) => void,
}) {

  // external state
  const { grayUI, toggleGrayUI, sendAfterMs, setSendAfterMs, sendAfterMode, setSendAfterMode } = useAppCallStore();
  const chatMicTimeoutMs = useChatMicTimeoutMsValue();

  // derived: the Settings chip shows the value it follows
  const sendAfterModeOptions = React.useMemo((): ReadonlyArray<FormRadioOption<'global' | 'custom'>> => [
    { value: 'global', label: 'Settings', description: `${chatMicTimeoutMs / 1000}s` },
    { value: 'custom', label: 'Custom', description: 'Calls only' },
  ], [chatMicTimeoutMs]);

  return <>

    <OptimaPanelGroupedList title='Window'>
      <MenuItem onClick={toggleGrayUI}>
        <ListItemDecorator><Checkbox size='md' color={grayUI ? 'primary' : 'neutral'} variant={grayUI ? 'plain' : 'outlined'} checked={grayUI} /></ListItemDecorator>
        Grayed UI
      </MenuItem>
    </OptimaPanelGroupedList>

    <OptimaPanelGroupedList title='Microphone'>

      <ListItem sx={_chipRowSx}>
        <FormChipGroupControl
          size='sm'
          title='Start'
          renderVariant='solid'
          options={_micModeOptions}
          value={props.pushToTalk ? 'ptt' : 'always'}
          onChange={value => props.setPushToTalk(value === 'ptt')}
        />
      </ListItem>

      {!props.pushToTalk && (
        <ListItem sx={{ pl: 1.25 }}>
          <Chip color='warning' variant='soft' startDecorator={<HeadphonesIcon sx={{ fontSize: 'md' }} />} sx={_noticeChipSx}>
            Headset advised: the mic may hear the reply. Push to talk avoids it.
          </Chip>
        </ListItem>
      )}

      <ListItem sx={_chipRowSx}>
        <FormChipGroupControl
          size='sm'
          title='Send after'
          renderVariant='solid'
          options={sendAfterModeOptions}
          value={sendAfterMode}
          onChange={setSendAfterMode}
        />
      </ListItem>

      {sendAfterMode === 'custom' && (
        <ListItem sx={_chipRowEndSx}>
          <FormChipGroupControl
            size='sm'
            title=''
            renderVariant='solid'
            options={_sendAfterOptions}
            value={'' + sendAfterMs}
            onChange={value => setSendAfterMs(parseInt(value))}
          />
        </ListItem>
      )}

    </OptimaPanelGroupedList>

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
  const [personaTextInterim, setPersonaTextInterim] = React.useState<string | null>(null);
  const [pushToTalk, setPushToTalk] = React.useState(true);
  const [stage, setStage] = React.useState<'ring' | 'declined' | 'connected' | 'ended'>('ring');
  const llmDropdownRef = React.useRef<OptimaBarControlMethods>(null);
  const responseAbortController = React.useRef<AbortController | null>(null);

  // external state
  const { chatLLMId: modelId, chatLLMDropdown: modelDropdown } = useChatLLMDropdown(llmDropdownRef);
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
  // const personaVoiceSelector = React.useMemo(() => personaGetVoiceSelector(persona), [persona]);
  const personaSystemMessage = persona?.systemMessage ?? undefined;

  // hooks and speech
  const [speechInterim, setSpeechInterim] = React.useState<SpeechResult | null>(null);
  const onSpeechResultCallback = React.useCallback((result: SpeechResult) => {
    setSpeechInterim(result.done ? null : { ...result });
    if (result.done) {
      const userSpeechTranscribed = result.transcript.trim();
      if (userSpeechTranscribed.length >= 1)
        setCallMessages(messages => [...messages, createDMessageTextContent('user', userSpeechTranscribed)]); // [state] append user:speech
    }
  }, []);
  const chatMicTimeoutMs = useChatMicTimeoutMsValue();
  const { sendAfterMs, sendAfterMode } = useAppCallStore(useShallow(state => ({ sendAfterMs: state.sendAfterMs, sendAfterMode: state.sendAfterMode })));
  const { recognitionState, startRecognition, stopRecognition, toggleRecognition } = useSpeechRecognition('webSpeechApi', onSpeechResultCallback, (sendAfterMode === 'global' ? chatMicTimeoutMs : sendAfterMs) || 2000);

  // derived state
  const isRinging = stage === 'ring';
  const isConnected = stage === 'connected';
  const isDeclined = stage === 'declined';
  const isEnded = stage === 'ended';


  /// Sounds

  // pickup / hangup
  React.useEffect(() => {
    !isRinging && void AudioPlayer.playUrl(isConnected ? '/sounds/chat-begin.mp3' : '/sounds/chat-end.mp3').catch(() => {/* autoplay may be blocked */});
  }, [isRinging, isConnected]);

  // ringtone
  usePlayUrlInterval(isRinging ? '/sounds/chat-ringtone.mp3' : null, 300, 2800 * 2);


  /// Shortcuts

  useGlobalShortcuts('Telephone', React.useMemo(() => [
    { key: 'm', ctrl: true, action: toggleRecognition },
  ], [toggleRecognition]));

  /// CONNECTED

  const handleCallStop = () => {
    stopRecognition(false);
    setStage('ended');
  };

  // [E] pickup -> seed message and call timer
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

    setCallMessages([createDMessageTextContent('assistant', firstMessage)]); // [state] set assistant:hello message

    // fire/forget - use 'fast' priority for real-time conversation
    void speakText(firstMessage,
      undefined,
      { label: 'Call', priority: 'fast' },
    );

    return () => clearInterval(interval);
  }, [isConnected, personaCallStarters]);

  // [E] persona streaming response - upon new user message
  React.useEffect(() => {
    // only act when we have a new user message
    if (!isConnected || callMessages.length < 1)
      return;

    // Voice commands
    const lastUserMessage = callMessages[callMessages.length - 1];
    if (lastUserMessage.role !== 'user')
      return;
    switch (messageFragmentsReduceText(lastUserMessage.fragments)) {
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
    if (!modelId) return;


    // Call Message Generation Prompt
    const callSystemInstruction = createDMessageTextContent('system', 'You are having a phone call. Your response style is brief and to the point, and according to your personality, defined below.');
    const reMessagesRemapSysToUsr = remapMessagesSysToUsr(reMessages);
    const callGenerationInputHistory: DMessage[] = [
      // Chat messages, including the system prompt which is casted to a user message
      // TODO: when upgrading to dynamic personas, we need to inject the persona message instead - not rely on reMessages, as messages[0] !== 'system'
      ...(reMessagesRemapSysToUsr ? reMessagesRemapSysToUsr : [createDMessageTextContent('user', personaSystemMessage)]),
      // Call system prompt 2, to indicate the call has started
      createDMessageTextContent('user', '**You are now on the phone call related to the chat above**.\nRespect your personality and answer with short, friendly and accurate thoughtful brief lines.'),
      // Call history
      ...callMessages,
    ];


    // perform completion
    responseAbortController.current = new AbortController();
    let finalText = '';
    setPersonaTextInterim('💭...');

    aixChatGenerateContent_DMessage_FromConversation(
      modelId,
      callSystemInstruction,
      callGenerationInputHistory,
      'call',
      callMessages[0].id,
      { abortSignal: responseAbortController.current.signal },
      (update: AixChatGenerateContent_DMessageGuts, _isDone: boolean) => {
        const updatedText = messageFragmentsReduceText(update.fragments).trim();
        if (updatedText)
          setPersonaTextInterim(finalText = updatedText);
      },
    ).then((status) => {

      // don't add the message to conversation if it was interrupted with no content
      if (messageWasInterruptedAtStart(status.lastDMessage))
        return;

      // whether status.outcome === 'completed' or not, we get a valid DMessage, eventually with Error Fragments inside
      const fullMessage = createDMessageFromFragments('assistant', status.lastDMessage.fragments);
      fullMessage.generator = status.lastDMessage.generator;
      setCallMessages(messages => [...messages, fullMessage]); // [state] append assistant:call_response

      // fire/forget - use 'fast' priority for real-time conversation
      if (status.outcome === 'completed' && finalText?.length >= 1)
        void speakText(finalText,
          undefined,
          { label: 'Call', priority: 'fast' },
        );

    }).catch((err: DOMException) => {
      if (err?.name !== 'AbortError') {
        // create an error message to explain the exception
        const errorMessage = createDMessageFromFragments('assistant', [createErrorContentFragment(err.message || err.toString())]);
        setCallMessages(messages => [...messages, errorMessage]); // [state] append assistant:call_response-ERROR
      }
    }).finally(() => {
      setPersonaTextInterim(null);
    });

    return () => {
      responseAbortController.current?.abort();
      responseAbortController.current = null;
    };
  }, [callMessages, isConnected, modelId, personaSystemMessage, reMessages]);

  // [E] Message interrupter
  const abortTrigger = isConnected && recognitionState.hasSpeech;
  React.useEffect(() => {
    if (abortTrigger && responseAbortController.current) {
      responseAbortController.current.abort();
      responseAbortController.current = null;
    }
    // TODO.. abort current speech
  }, [abortTrigger]);


  // [E] continuous speech recognition (reload)
  const shouldStartRecording = isConnected && !pushToTalk && speechInterim === null && !recognitionState.hasAudio;
  React.useEffect(() => {
    if (shouldStartRecording)
      startRecognition();
  }, [shouldStartRecording, startRecognition]);


  // more derived state
  const personaName = persona?.title ?? 'Unknown';
  const isMicEnabled = recognitionState.isAvailable;
  const isTTSEnabled = true;
  const isEnabled = isMicEnabled && isTTSEnabled;
  const micErrorMessage = recognitionState.errorMessage;


  return <>

    {/* -> Toolbar */}
    <OptimaToolbarIn>{modelDropdown}</OptimaToolbarIn>
    {/* -> Panel */}
    <OptimaPanelIn>
      <CallMenu
        pushToTalk={pushToTalk} setPushToTalk={setPushToTalk}
      />
    </OptimaPanelIn>

    <Box sx={{
      width: '100%',
      display: { xs: 'contents', md: (isConnected || isEnded) ? 'grid' : 'contents' },
      gridTemplateColumns: 'minmax(11.5rem, 0.4fr) minmax(0, 1fr)',
      alignItems: 'center',
      gap: 3,
    }}>

      {/* Caller details - beside the transcript on desktop */}
      <Box sx={{ display: { xs: 'contents', md: (isConnected || isEnded) ? 'flex' : 'contents' }, flexDirection: 'column', alignItems: 'center', gap: 1 }}>
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
          micError={!isMicEnabled} micErrorMessage={micErrorMessage} speakError={!isTTSEnabled}
        />
      </Box>

      {/* Live Transcript, w/ streaming messages, audio indication, etc. */}
      {(isConnected || isEnded) && (
        <Card variant='outlined' sx={{
          flexGrow: { xs: 1, md: 0 },
          height: { md: 'min(56dvh, 34rem)' },
          minHeight: { xs: '20%', md: '22rem' },
          maxHeight: { xs: '28%', md: '70dvh' },
          width: '100%',
          resize: { md: 'vertical' },
          overflow: 'auto', // also required by 'resize'

          // style
          // backgroundColor: 'background.surface',
          borderRadius: 'lg',
          // boxShadow: 'sm',

          // children
          padding: 0, // move this to the ScrollToBottom component
        }}>

          <ScrollToBottom stickToBottomInitial>

            <Box onCopy={clipboardInterceptCtrlCForCleanup} sx={{ minHeight: '100%', p: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>

              {/* Call Messages [] */}
              {callMessages.map((message) =>
                <CallMessage
                  key={message.id}
                  text={messageFragmentsReduceText(message.fragments)}
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
              {recognitionState.isActive && (
                <CallMessage
                  text={<>{speechInterim?.transcript.trim() || null}{speechInterim?.interimTranscript.trim() ? <i> {speechInterim.interimTranscript}</i> : null}</>}
                  variant={(recognitionState.hasSpeech || !!speechInterim?.transcript) ? 'soft' : 'outlined'}
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

    </Box>

    {/* Call Buttons */}
    <Box sx={{ width: '100%', display: 'flex', justifyContent: 'space-evenly', gap: 4 }}>

      {/* [ringing] Decline / Accept */}
      {isRinging && <CallButton Icon={CallEndIcon} text='Decline' color='danger' variant='solid' onClick={() => setStage('declined')} />}
      {isRinging && isEnabled && <CallButton Icon={CallIcon} text='Accept' color='success' variant='solid' onClick={() => setStage('connected')} />}

      {/* [Calling] Hang / PTT (mute not enabled yet) */}
      {isConnected && <CallButton Icon={CallEndIcon} text='Hang up' color='danger' variant='soft' onClick={handleCallStop} />}
      {isConnected && (pushToTalk ? (
          <CallButton
            Icon={MicIcon} onClick={toggleRecognition}
            text={recognitionState.hasSpeech ? 'Listening...' : recognitionState.isActive ? 'Listening' : 'Push To Talk'}
            variant={recognitionState.hasSpeech ? 'solid' : recognitionState.isActive ? 'soft' : 'outlined'}
            color='primary'
            sx={!recognitionState.isActive ? { backgroundColor: 'background.surface' } : undefined}
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
      <Card variant='outlined' sx={{ maxHeight: '25dvh', fontSize: 'sm', overflow: 'auto', whiteSpace: 'pre', py: 0, width: '100%' }}>
        Special commands: Stop, Retry, Try Again, Restart, Goodbye.<br />
        {JSON.stringify({ ...recognitionState, speechInterim }, null, 2)}
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