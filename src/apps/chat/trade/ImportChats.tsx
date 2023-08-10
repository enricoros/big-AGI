import * as React from 'react';

import { Box, Button, FormControl, FormLabel, Input, Sheet, Typography } from '@mui/joy';
import FileUploadIcon from '@mui/icons-material/FileUpload';

import type { ChatGptSharedChatSchema } from '~/modules/sharing/import.chatgpt';
import { OpenAIIcon } from '~/modules/llms/openai/OpenAIIcon';
import { apiAsync } from '~/modules/trpc/trpc.client';
import { createDConversation, createDMessage, DMessage, useChatStore } from '~/common/state/store-chats';

import { ImportedOutcome, ImportOutcomeModal } from './ImportOutcomeModal';
import { restoreDConversationFromJson } from './trade.json';


export type ImportConfig = { dir: 'import' };

/**
 * Components and functionality to import conversations
 * Supports our own JSON files, and ChatGPT Share Links
 */
export function ImportConversations(props: { onClose: () => void }) {

  // state
  const importFilesInputRef = React.useRef<HTMLInputElement>(null);
  const [chatGptEdit, setChatGptEdit] = React.useState(false);
  const [chatGptUrl, setChatGptUrl] = React.useState('');
  const [importOutcome, setImportOutcome] = React.useState<ImportedOutcome | null>(null);

  // derived state
  const chatGptUrlValid = chatGptUrl.startsWith('https://chat.openai.com/share/') && chatGptUrl.length > 40;

  const handleImportFromFiles = () => importFilesInputRef.current?.click();

  const handleImportLoadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target?.files;
    if (!files || files.length < 1)
      return;

    // restore conversations from the selected files
    const outcome: ImportedOutcome = { conversations: [] };
    for (const file of files) {
      const fileName = file.name || 'unknown file';
      try {
        const conversation = restoreDConversationFromJson(await file.text());
        if (conversation) {
          useChatStore.getState().importConversation(conversation);
          outcome.conversations.push({ fileName, success: true, conversationId: conversation.id });
        } else {
          const fileDesc = `(${file.type}) ${file.size.toLocaleString()} bytes`;
          outcome.conversations.push({ fileName, success: false, error: `Invalid file: ${fileDesc}` });
        }
      } catch (error) {
        console.error(error);
        outcome.conversations.push({ fileName, success: false, error: (error as any)?.message || error?.toString() || 'unknown error' });
      }
    }

    // show the outcome of the import
    setImportOutcome(outcome);

    // this is needed to allow the same file to be selected again
    e.target.value = '';
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
      outcome.conversations.push({ fileName: 'chatgpt', success: true, conversationId: conversation.id });
    } else
      outcome.conversations.push({ fileName: 'chatgpt', success: false, error: `Empty conversation` });
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

    {/* [file] file-picker trigger */}
    <input type='file' multiple hidden accept='.json' ref={importFilesInputRef} onChange={handleImportLoadFiles} />

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