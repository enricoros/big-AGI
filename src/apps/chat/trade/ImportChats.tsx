import * as React from 'react';
import { fileOpen, FileWithHandle } from 'browser-fs-access';

import { Box, Button, FormControl, FormLabel, Input, Sheet, Typography } from '@mui/joy';
import FileUploadIcon from '@mui/icons-material/FileUpload';

import type { ChatGptSharedChatSchema } from '~/modules/sharing/import.chatgpt';
import { OpenAIIcon } from '~/modules/llms/openai/OpenAIIcon';
import { apiAsync } from '~/modules/trpc/trpc.client';

import { Brand } from '~/common/brand';
import { createDConversation, createDMessage, DMessage, useChatStore } from '~/common/state/store-chats';

import { ImportedOutcome, ImportOutcomeModal } from './ImportOutcomeModal';
import { restoreDConversationsFromJSON } from './trade.json';


export type ImportConfig = { dir: 'import' };

/**
 * Components and functionality to import conversations
 * Supports our own JSON files, and ChatGPT Share Links
 */
export function ImportConversations(props: { onClose: () => void }) {

  // state
  const [chatGptEdit, setChatGptEdit] = React.useState(false);
  const [chatGptUrl, setChatGptUrl] = React.useState('');
  const [importOutcome, setImportOutcome] = React.useState<ImportedOutcome | null>(null);

  // derived state
  const chatGptUrlValid = chatGptUrl.startsWith('https://chat.openai.com/share/') && chatGptUrl.length > 40;

  const handleImportFromFiles = async () => {
    // pick file(s)
    let blobs: FileWithHandle[];
    try {
      blobs = await fileOpen({ description: `${Brand.Title.Base} JSON`, mimeTypes: ['application/json'], multiple: true, startIn: 'downloads' });
    } catch (error) {
      return;
    }

    // begin
    const outcome: ImportedOutcome = { conversations: [] };

    // unroll files to conversations
    for (const blob of blobs) {
      const fileName = blob.name || 'unknown file';
      try {
        const fileString = await blob.text();
        const fileObject = JSON.parse(fileString);
        restoreDConversationsFromJSON(fileName, fileObject, outcome);
      } catch (error: any) {
        outcome.conversations.push({ success: false, fileName, error: `Invalid file: ${error?.message || error?.toString() || 'unknown error'}` });
      }
    }

    // import conversations (warning - will overwrite things)
    for (let conversation of [...outcome.conversations].reverse()) {
      if (conversation.success)
        useChatStore.getState().importConversation(conversation.conversation);
    }

    // show the outcome of the import
    setImportOutcome(outcome);
  };

  const handleChatGptToggleShown = () => setChatGptEdit(!chatGptEdit);

  const handleChatGptLoadFromURL = async () => {
    if (!chatGptUrlValid)
      return;

    const outcome: ImportedOutcome = { conversations: [] };

    // load the conversation
    let conversationId: string, data: ChatGptSharedChatSchema;
    try {
      ({ conversationId, data } = await apiAsync.sharing.importChatGptShare.query({ url: chatGptUrl }));
    } catch (error) {
      outcome.conversations.push({ fileName: 'chatgpt', success: false, error: (error as any)?.message || error?.toString() || 'unknown error' });
      setImportOutcome(outcome);
      return;
    }

    // transform to our data structure
    const conversation = createDConversation();
    conversation.id = conversationId;
    conversation.created = Math.round(data.create_time * 1000);
    conversation.updated = Math.round(data.update_time * 1000);
    conversation.autoTitle = data.title;
    conversation.messages = data.linear_conversation.map(msgNode => {
      const message = msgNode.message;
      if (message && message.content.parts) {
        const role = message.author.role;
        const joinedText = message.content.parts.join('\n');
        if ((role === 'user' || role === 'assistant') && joinedText.length >= 1) {
          const dMessage = createDMessage(role, joinedText);
          dMessage.id = message.id;
          if (message.create_time)
            dMessage.created = Math.round(message.create_time * 1000);
          return dMessage;
        }
      }
      return null;
    }).filter(msg => !!msg) as DMessage[];

    // outcome
    const success = conversation.messages.length >= 1;
    if (success) {
      useChatStore.getState().importConversation(conversation);
      outcome.conversations.push({ success: true, fileName: 'chatgpt', conversation });
    } else
      outcome.conversations.push({ success: false, fileName: 'chatgpt', error: `Empty conversation` });
    setImportOutcome(outcome);
  };

  const handleImportOutcomeClosed = () => {
    setImportOutcome(null);
    props.onClose();
  };


  return <>

    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', py: 1 }}>
      <Typography level='body-sm'>
        Select where to import from
      </Typography>

      <Button variant='soft' size='md' endDecorator={<FileUploadIcon />} sx={{ minWidth: 240, justifyContent: 'space-between' }}
              onClick={handleImportFromFiles}>
        Upload JSON
      </Button>

      {!chatGptEdit && (
        <Button variant='soft' size='md' endDecorator={<OpenAIIcon />} sx={{ minWidth: 240, justifyContent: 'space-between' }}
                color={chatGptEdit ? 'neutral' : 'primary'}
                onClick={handleChatGptToggleShown}>
          ChatGPT shared link
        </Button>
      )}
    </Box>

    {/* [chatgpt] data & controls */}
    {chatGptEdit && <Sheet variant='soft' color='primary' sx={{ display: 'flex', flexDirection: 'column', borderRadius: 'md', p: 1, gap: 1 }}>

      <OpenAIIcon sx={{ mx: 'auto', my: 1 }} />

      <FormControl>
        <FormLabel>
          Shared Chat URL
        </FormLabel>
        <Input
          variant='outlined' placeholder='https://chat.openai.com/share/...'
          required error={!chatGptUrlValid}
          value={chatGptUrl} onChange={event => setChatGptUrl(event.target.value)}
        />
      </FormControl>

      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button variant='soft' color='primary' onClick={handleChatGptToggleShown} sx={{ mr: 'auto' }}>
          Cancel
        </Button>
        <Button color='primary' disabled={!chatGptUrlValid} onClick={handleChatGptLoadFromURL} sx={{ minWidth: 150 }}>
          Import Chat
        </Button>
      </Box>

    </Sheet>}

    {/* import outcome */}
    {!!importOutcome && <ImportOutcomeModal outcome={importOutcome} onClose={handleImportOutcomeClosed} />}

  </>;
}