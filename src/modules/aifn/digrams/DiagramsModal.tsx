import * as React from 'react';

import { Box, Button, ButtonGroup, CircularProgress, Divider, FormControl, FormLabel, Grid, IconButton, Input } from '@mui/joy';
import AccountTreeTwoToneIcon from '@mui/icons-material/AccountTreeTwoTone';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ReplayIcon from '@mui/icons-material/Replay';
import StopOutlinedIcon from '@mui/icons-material/StopOutlined';
import TelegramIcon from '@mui/icons-material/Telegram';

import { AutoBlocksRenderer } from '~/modules/blocks/AutoBlocksRenderer';
import { aixChatGenerateText_Simple } from '~/modules/aix/client/aix.client';

import { ConversationsManager } from '~/common/chat-overlay/ConversationsManager';
import { GoodModal } from '~/common/components/modals/GoodModal';
import { InlineError } from '~/common/components/InlineError';
import { adjustContentScaling } from '~/common/app.theme';
import { createDMessageTextContent, messageFragmentsReduceText } from '~/common/stores/chat/chat.message';
import { splitSystemMessageFromHistory } from '~/common/stores/chat/chat.conversation';
import { useFormRadio } from '~/common/components/forms/useFormRadio';
import { useFormRadioLlmType } from '~/common/components/forms/useFormRadioLlmType';
import { useIsMobile } from '~/common/components/useMatchMedia';
import { useUIContentScaling } from '~/common/state/store-ui';

import { bigDiagramPrompt, DiagramLanguage, diagramLanguages, DiagramType, diagramTypes } from './diagrams.data';


// configuration
const DIAGRAM_ACTOR_PREFIX = 'diagram';


// Used by the callers to setup the diagram session
export interface DiagramConfig {
  conversationId: string;
  messageId: string;
  text: string;
}


// This method fixes issues in the generation output. Very heuristic.
function hotFixDiagramCode(llmCode: string): string {
  // put the code in markdown, if missing
  if (llmCode.startsWith('@start'))
    llmCode = '```\n' + llmCode + '\n```';
  // fix generation mistakes
  return llmCode
    .replaceAll('@startumd', '@startuml') // haiku
    .replaceAll('@endutml', '@enduml') // haiku
    .replaceAll('@endmindmap\n@enduml', '@endmindmap') // gpt-3.5
    .replaceAll('@endmindmap\n@end', '@endmindmap') // gpt-3.5
    .replaceAll('```\n```', '```');
}


export function DiagramsModal(props: { config: DiagramConfig, onClose: () => void; }) {

  // state
  const [showOptions, setShowOptions] = React.useState(true);
  const [diagramCode, setDiagramCode] = React.useState<string | null>(null);
  const [diagramType, diagramComponent] = useFormRadio<DiagramType>('mind', diagramTypes, 'Diagram');
  const [diagramLanguage, languageComponent, setDiagramLanguage] = useFormRadio<DiagramLanguage>('mermaid', diagramLanguages, 'Syntax');
  const [customInstruction, setCustomInstruction] = React.useState<string>('');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [abortController, setAbortController] = React.useState<AbortController | null>(null);

  // external state
  const isMobile = useIsMobile();
  const contentScaling = useUIContentScaling();
  const [diagramLlm, llmComponent] = useFormRadioLlmType('Generator', 'chat');

  // derived state
  const { messageId, text: subject } = props.config;
  const diagramLlmId = diagramLlm?.id;

  // conversation handler (to view history and eventually append the message)
  const cHandler = ConversationsManager.getHandler(props.config.conversationId);

  /**
   * Core Diagram Generation function, with Streaming, custom prompt, etc.
   */
  const handleGenerateNew = React.useCallback(async () => {
    if (abortController)
      return;

    if (!diagramType || !diagramLanguage || !diagramLlm)
      return setErrorMessage(`Invalid diagram Type, Language, or Model (${diagramLlm}).`);

    setErrorMessage(null);

    let diagramCode: string = 'Loading...';
    setDiagramCode(diagramCode);

    const stepAbortController = new AbortController();
    setAbortController(stepAbortController);
    // cHandler.setAbortController(stepAbortController);

    const reChatHistory = cHandler.historyViewHeadOrThrow('diagrams-modal');
    const { chatSystemInstruction } = splitSystemMessageFromHistory(reChatHistory);
    if (!chatSystemInstruction)
      return setErrorMessage('No System instruction in this conversation');

    try {
      const { systemInstruction, messages } = bigDiagramPrompt(
        diagramType,
        diagramLanguage,
        messageFragmentsReduceText(chatSystemInstruction.fragments),
        subject,
        customInstruction,
      );
      await aixChatGenerateText_Simple(
        diagramLlm.id,
        systemInstruction,
        messages,
        'ai-diagram', messageId,
        { abortSignal: stepAbortController.signal },
        (text) => !!text && setDiagramCode(diagramCode = text.trim()),
      );
    } catch (error: any) {
      setDiagramCode(null);
      setErrorMessage(error?.name !== 'AbortError' ? error?.message : 'Interrupted.');
    } finally {
      setDiagramCode(hotFixDiagramCode(diagramCode));
      setAbortController(null);
    }

  }, [abortController, cHandler, customInstruction, diagramLanguage, diagramLlm, diagramType, messageId, subject]);

  // [Effect] Auto-abort on unmount
  React.useEffect(() => {
    return () => {
      if (abortController) {
        abortController.abort();
        // cHandler.setAbortController(null);
        setAbortController(null);
      }
    };
  }, [abortController, cHandler]);


  // custom instruction

  const handleCustomInstructionKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void handleGenerateNew();
    }
  }, [handleGenerateNew]);

  const handleCustomInstructionChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setCustomInstruction(event.target.value);
  }, []);


  // done

  const handleAppendMessageAndClose = React.useCallback(() => {
    if (!diagramCode)
      return setErrorMessage('Nothing to add to the conversation.');

    const diagramMessage = createDMessageTextContent('assistant', diagramCode); // [chat] append assistant:diagram
    // diagramMessage.purposeId = conversation.systemPurposeId;
    diagramMessage.generator = { mgt: 'named', name: DIAGRAM_ACTOR_PREFIX + (diagramLlmId ? `-${diagramLlmId}` : '') };

    cHandler.messageAppend(diagramMessage);
    props.onClose();
  }, [cHandler, diagramCode, diagramLlmId, props]);


  // [effect] Auto-switch language to match diagram type
  React.useEffect(() => {
    setDiagramLanguage(diagramType === 'mind' ? 'mermaid' : 'plantuml');
  }, [diagramType, setDiagramLanguage]);


  return (
    <GoodModal
      titleStartDecorator={<AutoFixHighIcon sx={{ fontSize: 'md', mr: 1 }} />}
      title={<>
        Auto-Diagram
        <IconButton
          aria-label={showOptions ? 'Hide Options' : 'Show Options'}
          size='sm'
          onClick={() => setShowOptions(options => !options)}
          sx={{ ml: 1, my: -0.5 }}
        >
          {showOptions ? <ExpandMoreIcon /> : <ExpandLessIcon />}
        </IconButton>
      </>}
      hideBottomClose
      open onClose={props.onClose}
      sx={{ maxWidth: { xs: '100vw', md: '95vw', lg: '88vw' } }}
    >

      {showOptions && (
        <Grid container spacing={2}>
          <Grid xs={12} md={6}>
            {diagramComponent}
          </Grid>
          {languageComponent && (
            <Grid xs={12} md={6}>
              {languageComponent}
            </Grid>
          )}
          <Grid xs={12} md={6}>
            {llmComponent}
          </Grid>
          <Grid xs={12} md={6}>
            <FormControl>
              <FormLabel>Customize</FormLabel>
              <Input
                title='Custom Instruction'
                placeholder='e.g. visualize as state'
                value={customInstruction}
                onKeyDown={handleCustomInstructionKeyDown}
                onChange={handleCustomInstructionChange}
                endDecorator={(abortController && customInstruction) ? <CircularProgress size='sm' /> : undefined}
              />
            </FormControl>
          </Grid>
        </Grid>
      )}

      {errorMessage && <InlineError error={errorMessage} />}

      {!showOptions && !!abortController && <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <CircularProgress size='lg' />
      </Box>}

      {!!diagramCode && (!abortController || showOptions) && (
        <Box sx={{
          backgroundColor: 'background.level2',
          marginX: 'calc(-1 * var(--Card-padding))',
          minHeight: 96,
          p: { xs: 1, md: 2 },
          overflow: 'hidden',
        }}>
          <AutoBlocksRenderer
            text={diagramCode}
            fromRole='assistant'
            contentScaling={adjustContentScaling(contentScaling, -1)}
            fitScreen={isMobile}
            isMobile={isMobile}
            blocksProcessor='diagram'
            codeRenderVariant='plain'
            textRenderVariant='text'
            // Edit is moved from the BlocksRenderer to the ContentPartText
            // onMessageEdit={(text) => setMessage({ ...message, text })}
          />
        </Box>
      )}

      {!diagramCode && <Divider />}

      {/* End */}
      <Box sx={{ mt: 'auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between' }}>

        {/* Add Message to Chat (once complete) */}
        <Button variant='soft' color='success' disabled={!diagramCode || !!abortController} endDecorator={<TelegramIcon />} onClick={handleAppendMessageAndClose}>
          Add To Chat
        </Button>

        {/* Button Group to toggle controls visibility - NOT enabled at the moment */}
        <ButtonGroup variant='solid' color='primary' sx={{ ml: 'auto' }}>
          {/*<IconButton*/}
          {/*  aria-label={showOptions ? 'Hide Options' : 'Show Options'}*/}
          {/*  onClick={() => setShowOptions(options => !options)}*/}
          {/*>*/}
          {/*  {showOptions ? <ExpandLessIcon /> : <ExpandMoreIcon />}*/}
          {/*</IconButton>*/}
          <Button
            variant={abortController ? 'soft' : 'solid'} color='primary'
            disabled={!diagramLlm}
            onClick={abortController ? () => {
              abortController.abort();
              // cHandler.setAbortController(null);
              setAbortController(null);
            } : handleGenerateNew}
            endDecorator={abortController ? <StopOutlinedIcon /> : diagramCode ? <ReplayIcon /> : <AccountTreeTwoToneIcon />}
            sx={{ minWidth: isMobile ? 160 : 220 }}
          >
            {abortController ? 'Stop' : diagramCode ? 'Regenerate' : 'Generate'}
          </Button>
        </ButtonGroup>

      </Box>

    </GoodModal>
  );
}