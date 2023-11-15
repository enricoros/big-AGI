import * as React from 'react';

import { Alert, Box, Button, CircularProgress, Divider, FormControl, FormLabel, IconButton, List, ListDivider, ListItem, ListItemButton, ListItemContent, ListItemDecorator, Typography } from '@mui/joy';
import ReplayIcon from '@mui/icons-material/Replay';

import { GoodModal } from '~/common/components/GoodModal';
import { InlineTextarea } from '~/common/components/InlineTextarea';
import { createDMessage, DConversation, useChatStore } from '~/common/state/store-chats';
import { useFormRadioLlmType } from '~/common/components/forms/useFormRadioLlmType';

import { FLATTEN_PROFILES, FlattenStyleType } from './flatten.data';
import { flattenConversation } from './flatten';


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

function FlatteningProgress(props: { llmLabel: string }) {
  return (
    <Box sx={{ mx: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <CircularProgress />
      <Typography>
        Flattening...
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


export function FlattenerModal(props: { conversationId: string | null, onClose: () => void }) {

  // state
  const [selectedStyle, setSelectedStyle] = React.useState<FlattenStyleType | null>(null);
  const [selectedLLMLabel, setSelectedLLMLabel] = React.useState<string | null>(null);
  const [flattenedText, setFlattenedText] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // external state
  const [diagramLlm, llmComponent] = useFormRadioLlmType();

  const handlePerformFlattening = async (type: FlattenStyleType) => {
    if (!props.conversationId || !type) return;
    const conversation: DConversation | undefined = useChatStore.getState().conversations.find(c => c.id === props.conversationId);
    if (!conversation) return;

    // begin working...
    setSelectedStyle(type);

    // select model
    if (!diagramLlm) {
      setErrorMessage('No model selected');
      return;
    }
    setSelectedLLMLabel(diagramLlm.label);

    let text: string | null = null;
    try {
      text = await flattenConversation(diagramLlm.id, conversation, type);
    } catch (error: any) {
      setErrorMessage(error?.message || error?.toString() || 'Unknown error');
    }

    // ...got the message (or error)
    setFlattenedText(text || 'Issue: the flattened text was blank.');
  };

  const handleReplaceConversation = () => {
    if (!props.conversationId || !selectedStyle || !flattenedText) return;
    const newRootMessage = createDMessage('user', flattenedText);
    useChatStore.getState().setMessages(props.conversationId, [newRootMessage]);
    props.onClose();
  };

  const handleErrorRetry = () => {
    setSelectedStyle(null);
    setFlattenedText(null);
    setErrorMessage(null);
  };


  const isFlattening = selectedStyle && !flattenedText;
  const isDone = !!flattenedText || !!errorMessage;
  const isError = !!errorMessage;

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
      {isFlattening && !!selectedLLMLabel && <FlatteningProgress llmLabel={selectedLLMLabel} />}

      {/* Group post-execution */}
      {isDone && <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, flexGrow: 1 }}>

        {/* Possible Error */}
        {errorMessage && <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1, alignItems: 'center' }}>
          <Alert variant='soft' color='danger' sx={{ my: 1, flexGrow: 1 }}>
            <Typography>{errorMessage}</Typography>
          </Alert>
          <IconButton variant='solid' color='danger' onClick={handleErrorRetry}>
            <ReplayIcon />
          </IconButton>
        </Box>}

        {/* Review Text */}
        {!!flattenedText && <InlineTextarea initialText={flattenedText} onEdit={setFlattenedText} />}

        {/* Proceed*/}
        {isDone && !isError && <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1, alignItems: 'center', justifyContent: 'space-between' }}>
          <IconButton
            variant={isError ? 'solid' : 'plain'} color={isError ? 'danger' : 'primary'}
            onClick={handleErrorRetry}
          >
            <ReplayIcon />
          </IconButton>

          {/* TODO: ask confirmation? */}
          <Button onClick={handleReplaceConversation} sx={{ minWidth: 142 }}>
            Looks Good
          </Button>
        </Box>}

      </Box>}

      {!isDone && !isFlattening && !!llmComponent && <Divider />}

      {!isDone && !isFlattening && llmComponent}

    </GoodModal>
  );
}