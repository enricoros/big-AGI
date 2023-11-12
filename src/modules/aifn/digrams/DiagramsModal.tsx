import * as React from 'react';

import { GoodModal } from '~/common/components/GoodModal';
import { Box, Button, ButtonGroup, CircularProgress, Divider, FormControl, FormLabel, Grid, IconButton, Radio, RadioGroup } from '@mui/joy';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ReplayIcon from '@mui/icons-material/Replay';
import StopOutlinedIcon from '@mui/icons-material/StopOutlined';
import TelegramIcon from '@mui/icons-material/Telegram';

import type { VChatMessageIn } from '~/modules/llms/transports/chatGenerate';
import { ChatMessage } from '../../../apps/chat/components/message/ChatMessage';
import { streamChat } from '~/modules/llms/transports/streamChat';

import { InlineError } from '~/common/components/InlineError';
import { createDMessage, DMessage, useChatStore } from '~/common/state/store-chats';
import { useLlmTypeSelector } from '~/common/components/useLlmTypeSelector';


type DiagramType = 'auto' | 'mind';

export interface DiagramConfig {
  conversationId: string;
  messageId: string,
  text: string;
}


const bigDiagramPrompt = (diagramType: DiagramType, systemPrompt: string, subject: string): VChatMessageIn[] => [
  {
    role: 'system', content:
      'You are an AI that writes PlantUML code based on provided text. You create a valid PlantUML string, enclosed by' +
      (diagramType === 'auto'
        ? ` "@startuml" and "@enduml", ready to be rendered into a diagram or mindmap, ensuring the code contains no external references and all names are properly escaped without spaces. You choose the most suitable diagram type—sequence, class, use case, activity, component, state, object, deployment, wireframe, mindmap, gantt, or flowchart.`
        : ` "@startmindmap" and "@endmindmap", ready to be rendered into a mind map, ensuring the code contains no external references and all names are properly escaped without spaces.`) +
      ' Your output is strictly enclosed in a Markdown block.',
  },
  { role: 'system', content: systemPrompt },
  { role: 'assistant', content: subject },
  {
    role: 'user', content: diagramType === 'auto'
      ? 'Generate the PlantUML code for the diagram type that best represents the preceding assistant message.'
      : 'Generate the PlantUML code for a mind map based on the preceding assistant message.',
  },
];


export function DiagramsModal(props: { config: DiagramConfig, onClose: () => void; }) {

  // state
  const [showOptions, setShowOptions] = React.useState(true);
  const [message, setMessage] = React.useState<DMessage | null>(null);
  const [diagramType, setDiagramType] = React.useState<DiagramType>('auto');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [abortController, setAbortController] = React.useState<AbortController | null>(null);

  // external state
  const { chosenLlm, selectorComponent } = useLlmTypeSelector('Generator');

  // derived state
  const { conversationId, messageId, text: subject } = props.config;


  const handleToggleOptions = () => setShowOptions(options => !options);


  /**
   * Core Diagram Generation function, with Streaming, custom prompt, etc.
   */
  const handleGenerateNew = React.useCallback(async () => {
    if (abortController)
      return;

    const conversation = useChatStore.getState().conversations.find(c => c.id === conversationId);
    if (!conversation || !messageId || !chosenLlm)
      return setErrorMessage('Invalid configuration');

    const systemMessage = conversation.messages?.length > 0 ? conversation.messages[0] : null;
    if (systemMessage?.role !== 'system')
      return setErrorMessage('No System message in this conversation');

    setErrorMessage(null);

    let assistantMessage = createDMessage('assistant', '');
    assistantMessage.purposeId = conversation.systemPurposeId;

    const stepAbortController = new AbortController();
    setAbortController(stepAbortController);

    const diagramPrompt = bigDiagramPrompt(diagramType, systemMessage.text, subject);

    try {
      await streamChat(chosenLlm.id, diagramPrompt, stepAbortController.signal,
        (update: Partial<{ text: string, typing: boolean, originLLM: string }>) => {
          if (update.originLLM)
            update.originLLM = '(diagram)'; // `(diagram) ${update.originLLM}`;
          assistantMessage = { ...assistantMessage, ...update };
          setMessage(assistantMessage);
        },
      );
    } catch (error: any) {
      setMessage(null);
      setErrorMessage(error?.name !== 'AbortError' ? error?.message : 'Interrupted.');
    } finally {
      setAbortController(null);
    }

  }, [abortController, chosenLlm, conversationId, diagramType, messageId, subject]);


  // [Effect] Auto-abort on unmount
  React.useEffect(() => {
    return () => {
      if (abortController) {
        abortController.abort();
        setAbortController(null);
      }
    };
  }, [abortController]);

  // // Automatic generation, with anti-react strict mode
  // React.useEffect(() => {
  //   const timeout = setTimeout(() => handleGenerateNew(), 100);
  //   return () => clearTimeout(timeout);
  // }, [handleGenerateNew]);

  const handleInsertAndClose = () => {
    if (!message || !message.text)
      return setErrorMessage('Nothing to add to the conversation.');
    useChatStore.getState().appendMessage(conversationId, { ...message });
    props.onClose();
  };


  return <GoodModal
    title='Generate Diagram'
    open onClose={props.onClose}
    sx={{ maxWidth: { xs: '100vw', md: '95vw' } }}
    startButton={
      <Button variant='solid' color='primary' disabled={!message || !!abortController} endDecorator={<TelegramIcon />} onClick={handleInsertAndClose}>
        Insert in Chat
      </Button>
    }
  >

    <Divider />

    {showOptions && (
      <Grid container spacing={2}>
        <Grid xs={12} md={6}>
          <FormControl>
            <FormLabel>Diagram Type</FormLabel>
            <RadioGroup
              orientation='horizontal'
              value={diagramType}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => setDiagramType(event.target.value as DiagramType)}>
              <Radio value='auto' label='Auto' />
              <Radio value='mind' label='Mind Map' />
            </RadioGroup>
          </FormControl>
        </Grid>
        <Grid xs={12} md={6}>
          {selectorComponent}
        </Grid>
      </Grid>
    )}

    <ButtonGroup color='primary' sx={{ flexGrow: 1 }}>
      <Button
        fullWidth
        variant={abortController ? 'soft' : 'solid'} color='primary'
        disabled={!chosenLlm}
        onClick={abortController ? () => abortController.abort() : handleGenerateNew}
        endDecorator={abortController ? <StopOutlinedIcon /> : message ? <ReplayIcon /> : <AccountTreeIcon />}
        // loading={!!abortController}
        sx={{ minWidth: 200 }}
      >
        {abortController ? 'Stop' : message ? 'Regenerate' : 'Generate'}
      </Button>
      <IconButton onClick={handleToggleOptions}>
        {showOptions ? <ExpandLessIcon /> : <ExpandMoreIcon />}
      </IconButton>
    </ButtonGroup>

    {errorMessage && <InlineError error={errorMessage} />}

    {!showOptions && !!abortController && <Box sx={{ display: 'flex', justifyContent: 'center' }}>
      <CircularProgress size='lg' />
    </Box>}

    {!!message && (!abortController || showOptions) && (
      <ChatMessage
        message={message} hideAvatars noBottomBorder noMarkdown
        codeBackground='background.surface'
        sx={{
          backgroundColor: abortController ? 'background.level3' : 'background.level2',
          marginX: 'calc(-1 * var(--Card-padding))',
          minHeight: 96,
        }}
      />
    )}

    {!message && <Divider />}

  </GoodModal>;
}