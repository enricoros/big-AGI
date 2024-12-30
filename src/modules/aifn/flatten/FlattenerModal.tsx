import * as React from 'react';

import { Alert, Box, Button, CircularProgress, Divider, FormControl, FormLabel, IconButton, List, ListDivider, ListItem, ListItemButton, ListItemContent, ListItemDecorator, Typography } from '@mui/joy';
import ForkRightIcon from '@mui/icons-material/ForkRight';
import ReplayIcon from '@mui/icons-material/Replay';

import { useStreamChatText } from '~/modules/aifn/useStreamChatText';

import { ConfirmationModal } from '~/common/components/modals/ConfirmationModal';
import { ConversationsManager } from '~/common/chat-overlay/ConversationsManager';
import { DConversationId } from '~/common/stores/chat/chat.conversation';
import { GoodModal } from '~/common/components/modals/GoodModal';
import { InlineTextarea } from '~/common/components/InlineTextarea';
import { createDMessageTextContent, DMessage, messageFragmentsReduceText } from '~/common/stores/chat/chat.message';
import { useFormRadioLlmType } from '~/common/components/forms/useFormRadioLlmType';

import { FLATTEN_PROFILES, FlattenStyleType } from './flatten.data';


function StylesList(props: { selectedStyle: FlattenStyleType | null, onSelectedStyle: (type: FlattenStyleType) => void }) {
  const readonly = !!props.selectedStyle;
  const items = FLATTEN_PROFILES.filter(style => !readonly || style.type === props.selectedStyle);
  return (
    <List sx={{ p: 0 }}>
      {items.map((style, idx) => (
        <React.Fragment key={style.type}>
          <ListItem>
            <ListItemButton onClick={() => !readonly && props.onSelectedStyle(style.type)}>
              <ListItemDecorator sx={{ fontSize: '16pt' }}>
                {style.emoji}
              </ListItemDecorator>
              <ListItemContent>
                <Typography>
                  {style.name}
                </Typography>
                <Typography level='body-sm'>
                  {style.description}
                </Typography>
              </ListItemContent>
            </ListItemButton>
          </ListItem>
          {idx < items.length - 1 && <ListDivider key={'div-' + style.type} inset='startContent' />}
        </React.Fragment>
      ))}
    </List>
  );
}

function FlatteningProgress(props: { llmLabel: string, partialText: string | null }) {
  return (
    <Box sx={{ mx: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <CircularProgress />
      <Typography>
        {props.partialText?.length ? `${props.partialText.length} characters` : 'Flattening'}...
      </Typography>
      <Typography level='body-sm'>
        This may take up to a minute.
      </Typography>
      <Typography level='body-xs'>
        Using: {props.llmLabel}
      </Typography>
    </Box>
  );
}


function encodeConversationAsUserMessage(userPrompt: string, messages: Readonly<DMessage[]>): string {
  let encodedMessages = '';

  for (const message of messages) {
    if (message.role === 'system') continue;
    const author = message.role === 'user' ? 'User' : 'Assistant';
    const messageText = messageFragmentsReduceText(message.fragments);
    const text = messageText.replace(/\n/g, '\n\n');
    encodedMessages += `---${author}---\n${text}\n\n`;
  }

  return userPrompt ? userPrompt + '\n\n' + encodedMessages.trim() : encodedMessages.trim();
}


export function FlattenerModal(props: {
  conversationId: string | null,
  onConversationBranch: (conversationId: DConversationId, messageId: string | null, addSplitPane: boolean) => DConversationId | null,
  onClose: () => void,
}) {

  // state
  const [selectedStyle, setSelectedStyle] = React.useState<FlattenStyleType | null>(null);
  const [selectedLLMLabel, setSelectedLLMLabel] = React.useState<string | null>(null);
  const [confirmOverwrite, setConfirmOverwrite] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // external state
  const [llm, llmComponent] = useFormRadioLlmType();
  const {
    isStreaming, text: flattenedText, partialText, streamError,
    startStreaming, setText, resetText,
  } = useStreamChatText();


  const handlePerformFlattening = React.useCallback(async (flattenStyle: FlattenStyleType) => {

    // validate config (or set error)
    if (!props.conversationId)
      return setErrorMessage('No conversation selected');
    const cHandler = ConversationsManager.getHandler(props.conversationId);
    const messages = !cHandler.isValid() ? [] : cHandler.historyViewHeadOrThrow('flattener-modal');
    if (!messages.length)
      return setErrorMessage('No messages in conversation');
    if (!llm)
      return setErrorMessage('No model selected');
    const flattenProfile = FLATTEN_PROFILES.find(s => s.type === flattenStyle);
    if (!flattenProfile)
      return setErrorMessage('No style selected');

    setSelectedStyle(flattenStyle);
    setSelectedLLMLabel(llm.label);
    setErrorMessage(null);

    // start (auto-abort previous and at unmount)
    await startStreaming(
      llm.id,
      flattenProfile.systemPrompt,
      [{ role: 'user', text: encodeConversationAsUserMessage(flattenProfile.userPrompt, messages) }],
      'ai-flattener',
      messages[0].id,
    );

  }, [llm, props.conversationId, startStreaming]);


  const handleErrorRetry = () => {
    setSelectedStyle(null);
    setErrorMessage(null);
    resetText();
  };


  const handleReplaceConversation = (branch: boolean) => {
    if (!props.conversationId || !selectedStyle || !flattenedText) return;
    let newConversationId: string | null = props.conversationId;
    if (branch)
      newConversationId = props.onConversationBranch(props.conversationId, null, false /* no pane from Flatter new */);
    if (newConversationId) {
      const ncHandler = ConversationsManager.getHandler(newConversationId);
      const newRootMessage = createDMessageTextContent('user', flattenedText);// [new chat] user:former chat summary
      ncHandler.historyClear();
      ncHandler.messageAppend(newRootMessage);
    }
    props.onClose();
  };

  const isSuccess = !!flattenedText;
  const isError = !!errorMessage || !!streamError;

  return (
    <GoodModal
      open={!!props.conversationId} dividers
      title={!selectedStyle ? 'Compression' : 'Flattening...'}
      onClose={props.onClose}
    >

      {/* Style selector */}
      <FormControl>
        <FormLabel>Style</FormLabel>
        <StylesList selectedStyle={selectedStyle} onSelectedStyle={handlePerformFlattening} />
      </FormControl>

      {/* Progress indicator */}
      {isStreaming && !!selectedLLMLabel && (
        <FlatteningProgress llmLabel={selectedLLMLabel} partialText={partialText} />
      )}

      {/* Group post-execution */}
      {(isSuccess || isError) && <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, flexGrow: 1 }}>

        {/* Possible Error */}
        {isError && <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1, alignItems: 'center' }}>
          <Alert variant='soft' color='danger' sx={{ my: 1, flexGrow: 1 }}>
            {!!errorMessage && <Typography>{errorMessage}</Typography>}
            {!!streamError && <Typography>LLM issue: {streamError}</Typography>}
          </Alert>
          <IconButton variant='solid' color='danger' onClick={handleErrorRetry}>
            <ReplayIcon />
          </IconButton>
        </Box>}

        {/* Proceed*/}
        {isSuccess && !isError && (
          <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1, alignItems: 'center' }}>
            <IconButton
              variant={isError ? 'solid' : 'plain'} color={isError ? 'danger' : 'primary'}
              onClick={handleErrorRetry}
            >
              <ReplayIcon />
            </IconButton>

            <Button variant='outlined' onClick={() => setConfirmOverwrite(true)} sx={{ ml: 'auto' }}>
              Replace Chat
            </Button>
            <Button variant='solid' onClick={() => handleReplaceConversation(true)} startDecorator={<ForkRightIcon />}>
              Branch
            </Button>
          </Box>
        )}

        {/* Review or Edit Text */}
        {isSuccess && <InlineTextarea initialText={flattenedText} onEdit={setText} />}

      </Box>}

      {!isSuccess && !isStreaming && !!llmComponent && <Divider />}

      {!isSuccess && !isStreaming && llmComponent}


      {/* [confirmation] Overwrite Conversation */}
      {confirmOverwrite && <ConfirmationModal
        open onClose={() => setConfirmOverwrite(false)} onPositive={() => handleReplaceConversation(false)}
        confirmationText='Are you sure you want to overwrite the conversation with the flattened text?'
        positiveActionText='Replace conversation'
      />}

    </GoodModal>
  );
}