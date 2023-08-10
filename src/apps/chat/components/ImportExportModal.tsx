import * as React from 'react';

import { Box, Button, Divider, FormControl, FormLabel, Input, Sheet, Typography } from '@mui/joy';

import type { ChatGptSharedChatSchema } from '~/modules/sharing/import.chatgpt';
import { OpenAIIcon } from '~/modules/llms/openai/OpenAIIcon';
import { apiAsync } from '~/modules/trpc/trpc.client';

import { Brand } from '~/common/brand';
import { GoodModal } from '~/common/components/GoodModal';
import { createDConversation, createDMessage, DMessage, useChatStore } from '~/common/state/store-chats';

import { ImportedOutcome, ImportOutcomeModal } from './ImportOutcomeModal';
import { restoreConversationFromJson } from '../exportImport';


export type ImportExportMode = 'import' | 'export';


export function ImportExportModal(props: { mode: ImportExportMode, onClose: () => void }) {

  // state
  const importFilesInputRef = React.useRef<HTMLInputElement>(null);
  const [importChatGptShow, setImportChatGptShow] = React.useState(false);
  const [importChatGptUrl, setImportChatGptUrl] = React.useState('');
  const [conversationImportOutcome, setConversationImportOutcome] = React.useState<ImportedOutcome | null>(null);


  // derived

  const chatGptUrlValid = importChatGptUrl.startsWith('https://chat.openai.com/share/') && importChatGptUrl.length > 40;


  // imports

  const handleImportFromFiles = () => importFilesInputRef.current?.click();

  const handleImportLoadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target?.files;
    if (!files || files.length < 1)
      return;

    // restore conversations from the selected files
    const outcomes: ImportedOutcome = { conversations: [] };
    for (const file of files) {
      const fileName = file.name || 'unknown file';
      try {
        const conversation = restoreConversationFromJson(await file.text());
        if (conversation) {
          useChatStore.getState().importConversation(conversation);
          outcomes.conversations.push({ fileName, success: true, conversationId: conversation.id });
        } else {
          const fileDesc = `(${file.type}) ${file.size.toLocaleString()} bytes`;
          outcomes.conversations.push({ fileName, success: false, error: `Invalid file: ${fileDesc}` });
        }
      } catch (error) {
        console.error(error);
        outcomes.conversations.push({ fileName, success: false, error: (error as any)?.message || error?.toString() || 'unknown error' });
      }
    }

    // show the outcome of the import
    setConversationImportOutcome(outcomes);

    // this is needed to allow the same file to be selected again
    e.target.value = '';
  };

  const handleImportOutcomeClosed = () => {
    setConversationImportOutcome(null);
    props.onClose();
  };

  const handleChatGptToggleShown = () => setImportChatGptShow(!importChatGptShow);

  const handleChatGptLoadFromURL = async () => {
    // validate url
    if (!chatGptUrlValid)
      return;

    // init outcomes
    const outcomes: ImportedOutcome = { conversations: [] };

    // load the conversation
    let conversationId: string, data: ChatGptSharedChatSchema;
    try {
      ({ conversationId, data } = await apiAsync.sharing.importChatGptShare.query({ url: importChatGptUrl }));
    } catch (error) {
      outcomes.conversations.push({ fileName: 'chatgpt', success: false, error: (error as any)?.message || error?.toString() || 'unknown error' });
      setConversationImportOutcome(outcomes);
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

    // create the outcome
    if (conversation.messages.length >= 1) {
      useChatStore.getState().importConversation(conversation);
      outcomes.conversations.push({ fileName: 'chatgpt', success: true, conversationId: conversation.id });
    } else {
      outcomes.conversations.push({ fileName: 'chatgpt', success: false, error: `Empty conversation` });
    }

    // show the outcome of the import
    setConversationImportOutcome(outcomes);
  };


  // ui
  const showImport = props.mode === 'import';
  const showExport = props.mode === 'export';


  return <>

    {/* File Import: file-picker trigger */}
    {showImport && <input type='file' multiple hidden accept='.json' ref={importFilesInputRef} onChange={handleImportLoadFiles} />}

    <GoodModal title={<><b>{showImport ? 'Import ' : showExport ? 'Export ' : ''}</b> conversations</>} open onClose={props.onClose}>

      <Divider />

      {/* Import Buttons */}
      {showImport && <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' }}>

        <Typography level='body-sm'>
          Select where to import from
        </Typography>

        {!importChatGptShow && <Button variant='soft' size='md' color={importChatGptShow ? 'neutral' : 'primary'} onClick={handleChatGptToggleShown} sx={{ minWidth: 260 }}>
          ChatGPT Shared Links
        </Button>}

        <Button variant='soft' size='md' onClick={handleImportFromFiles} sx={{ minWidth: 260 }}>
          {Brand.Title.Base} JSON Files
        </Button>
      </Box>}

      {/* ChatGPT Import: data & controls */}
      {importChatGptShow && <Sheet variant='soft' color='primary' sx={{ display: 'flex', flexDirection: 'column', borderRadius: 'md', p: 1, gap: 1 }}>

        <OpenAIIcon sx={{ mx: 'auto', my: 1 }} />

        <FormControl>
          <FormLabel>
            Shared Chat URL
          </FormLabel>
          <Input
            variant='outlined' placeholder='https://chat.openai.com/share/...'
            required error={!chatGptUrlValid}
            value={importChatGptUrl} onChange={event => setImportChatGptUrl(event.target.value)}
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

      <Divider />

    </GoodModal>

    {!!conversationImportOutcome && <ImportOutcomeModal outcome={conversationImportOutcome} onClose={handleImportOutcomeClosed} />}
  </>;
}