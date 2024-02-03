import * as React from 'react';
import { fileOpen, FileWithHandle } from 'browser-fs-access';

import { Box, Button, FormControl, Input, Sheet, Textarea, Typography } from '@mui/joy';
import FileUploadIcon from '@mui/icons-material/FileUpload';

import { Brand } from '~/common/app.config';
import { FormRadioOption } from '~/common/components/forms/FormRadioControl';
import { InlineError } from '~/common/components/InlineError';
import { OpenAIIcon } from '~/common/components/icons/vendors/OpenAIIcon';
import { apiAsyncNode } from '~/common/util/trpc.client';
import { createDConversation, createDMessage, DConversationId, DMessage, useChatStore } from '~/common/state/store-chats';
import { useFormRadio } from '~/common/components/forms/useFormRadio';

import type { ChatGptSharedChatSchema } from './server/chatgpt';
import { loadAllConversationsFromJson } from './trade.client';

import { ImportedOutcome, ImportOutcomeModal } from './ImportOutcomeModal';


export type ImportConfig = { dir: 'import' };


const chatGptMedia: FormRadioOption<'source' | 'link'>[] = [
  { label: 'Shared Chat URL', value: 'link' },
  { label: 'Page Source', value: 'source' },
];

/**
 * Components and functionality to import conversations
 * Supports our own JSON files, and ChatGPT Share Links
 */
export function ImportChats(props: { onConversationActivate: (conversationId: DConversationId) => void, onClose: () => void }) {

  // state
  const [importMedia, importMediaControl] = useFormRadio('link', chatGptMedia);
  const [chatGptEdit, setChatGptEdit] = React.useState(false);
  const [chatGptUrl, setChatGptUrl] = React.useState('');
  const [chatGptSource, setChatGptSource] = React.useState('');
  const [importJson, setImportJson] = React.useState<string | null>(null);
  const [importOutcome, setImportOutcome] = React.useState<ImportedOutcome | null>(null);

  // derived state
  const isUrl = importMedia === 'link';
  const isSource = importMedia === 'source';
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
        loadAllConversationsFromJson(fileName, fileObject, outcome);
      } catch (error: any) {
        outcome.conversations.push({ success: false, fileName, error: `Invalid file: ${error?.message || error?.toString() || 'unknown error'}` });
      }
    }

    // import conversations (warning - will overwrite things)
    for (const conversation of [...outcome.conversations].reverse()) {
      if (conversation.success) {
        const conversationId: DConversationId = useChatStore.getState().importConversation(conversation.conversation, false);
        props.onConversationActivate(conversationId);
      }
    }

    // show the outcome of the import
    setImportOutcome(outcome);
  };


  const handleChatGptToggleShown = () => setChatGptEdit(!chatGptEdit);

  const handleChatGptLoad = async () => {
    setImportJson(null);
    if ((isUrl && !chatGptUrlValid) || (isSource && !chatGptSource))
      return;

    const outcome: ImportedOutcome = { conversations: [] };

    // load the conversation
    let conversationId: DConversationId, data: ChatGptSharedChatSchema;
    try {
      ({ conversationId, data } = await apiAsyncNode.trade.importChatGptShare.mutate(isUrl ? { url: chatGptUrl } : { htmlPage: chatGptSource }));
    } catch (error) {
      outcome.conversations.push({ fileName: 'chatgpt', success: false, error: (error as any)?.message || error?.toString() || 'unknown error' });
      setImportOutcome(outcome);
      return;
    }

    // save as JSON
    setImportJson(JSON.stringify(data, null, 2));

    // transform to our data structure
    const conversation = createDConversation();
    conversation.id = conversationId;
    conversation.created = Math.round(data.create_time * 1000);
    conversation.updated = Math.round(data.update_time * 1000);
    conversation.autoTitle = data.title;
    conversation.messages = data.linear_conversation.map(msgNode => {
      const message = msgNode.message;
      if (message?.content.parts) {
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
      useChatStore.getState().importConversation(conversation, false);
      props.onConversationActivate(conversationId);
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

    <Box sx={{ display: 'grid', gap: 1, mx: 'auto' }}>

      <Typography level='body-sm'>
        Select where to <strong>import from</strong>:
      </Typography>

      <Button
        variant='soft' endDecorator={<FileUploadIcon />} sx={{ minWidth: 240, justifyContent: 'space-between' }}
        onClick={handleImportFromFiles}
      >
        {Brand.Title.Base} · JSON
      </Button>

      {!chatGptEdit && (
        <Button
          variant='soft' endDecorator={<OpenAIIcon />} sx={{ minWidth: 240, justifyContent: 'space-between' }}
          color={chatGptEdit ? 'neutral' : 'primary'}
          onClick={handleChatGptToggleShown}
        >
          ChatGPT · Shared Link
        </Button>
      )}

    </Box>

    {/* [chatgpt] data & controls */}
    {chatGptEdit && <Sheet variant='soft' color='primary' sx={{ display: 'flex', flexDirection: 'column', borderRadius: 'md', p: 1, gap: 1 }}>

      <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 1 }}>
        {importMediaControl}
        <OpenAIIcon sx={{ ml: 'auto', my: 1 }} />
      </Box>

      {isUrl && <InlineError error='Note: this operation may be unreliable as OpenAI is often blocking imports.' severity='warning' sx={{ mt: 0 }} />}

      <FormControl>
        {isUrl && <Input
          variant='outlined' placeholder='https://chat.openai.com/share/...'
          required error={!chatGptUrlValid}
          value={chatGptUrl} onChange={event => setChatGptUrl(event.target.value)}
        />}
        {isSource && <Textarea
          variant='outlined' placeholder='Paste the page source here'
          required
          minRows={4} maxRows={8}
          value={chatGptSource} onChange={event => setChatGptSource(event.target.value)}
        />}
      </FormControl>

      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button variant='soft' color='primary' onClick={handleChatGptToggleShown} sx={{ mr: 'auto' }}>
          Cancel
        </Button>
        <Button color='primary' disabled={(isUrl && !chatGptUrlValid) || (isSource && chatGptSource?.length < 100)} onClick={handleChatGptLoad} sx={{ minWidth: 150 }}>
          Import Chat
        </Button>
      </Box>

    </Sheet>}

    {/* import outcome */}
    {!!importOutcome && <ImportOutcomeModal outcome={importOutcome} rawJson={importJson} onClose={handleImportOutcomeClosed} />}

  </>;
}