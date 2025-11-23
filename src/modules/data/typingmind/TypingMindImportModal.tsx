import * as React from 'react';

import { Box, Button, Modal, ModalClose, ModalDialog, Typography } from '@mui/joy';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

import { DConversation, DConversationId } from '~/common/stores/chat/chat.conversation';
import { useChatStore } from '~/common/stores/chat/store-chats';

import { parseTypingMindExport } from './typingmind.parser';
import { convertTypingMindChatToConversation } from './typingmind.transformer';
import type { ImportedOutcome } from '../../trade/ImportOutcomeModal';

interface ImportWarning {
  type: 'warning' | 'error';
  message: string;
  chatId?: string;
}

interface ParsedData {
  totalChats: number;
  validChats: number;
  warnings: ImportWarning[];
  conversations: DConversation[];
}

type ImportStep = 'confirm' | 'importing' | 'complete';

export interface TypingMindImportModalProps {
  open: boolean;
  jsonContent: string;
  fileName: string;
  onClose: () => void;
  onConversationActivate: (conversationId: DConversationId) => void;
}

/**
 * Multi-step modal for importing TypingMind exports
 * Steps: Parse → Validate → Confirm → Import → Results
 */
export function TypingMindImportModal(props: TypingMindImportModalProps) {
  const [step, setStep] = React.useState<ImportStep>('confirm');
  const [parsedData, setParsedData] = React.useState<ParsedData | null>(null);
  const [importOutcome, setImportOutcome] = React.useState<ImportedOutcome | null>(null);

  // Parse and validate on mount
  React.useEffect(() => {
    if (!props.open || parsedData) return;

    try {
      // Parse the export
      const exportData = parseTypingMindExport(props.jsonContent);
      const warnings: ImportWarning[] = [];
      const conversations: DConversation[] = [];

      // Check for unsupported features
      if (exportData.data.folders && Array.isArray(exportData.data.folders) && exportData.data.folders.length > 0) {
        warnings.push({
          type: 'warning',
          message: `${exportData.data.folders.length} folder(s) will not be imported - Big-AGI uses a different organization system`,
        });
      }

      if (exportData.data.userPrompts && Array.isArray(exportData.data.userPrompts) && exportData.data.userPrompts.length > 0) {
        warnings.push({
          type: 'warning',
          message: `${exportData.data.userPrompts.length} custom prompt(s) will not be imported - please recreate in Big-AGI if needed`,
        });
      }

      if (exportData.data.userCharacters && Array.isArray(exportData.data.userCharacters) && exportData.data.userCharacters.length > 0) {
        warnings.push({
          type: 'warning',
          message: `${exportData.data.userCharacters.length} AI character(s) will not be imported - please recreate in Big-AGI's persona system`,
        });
      }

      // Convert each chat
      let validChats = 0;
      for (const chat of exportData.data.chats) {
        try {
          const conversation = convertTypingMindChatToConversation(chat);
          if (conversation.messages.length === 0) {
            warnings.push({
              type: 'warning',
              message: `Chat "${chat.chatTitle || chat.chatID}" has no messages and will be skipped`,
              chatId: chat.chatID,
            });
            continue;
          }

          // Check for ID conflicts
          const existingConversation = useChatStore.getState().conversations.find(c => c.id === conversation.id);
          if (existingConversation) {
            warnings.push({
              type: 'warning',
              message: `Chat "${conversation.autoTitle || conversation.id}" already exists and will be overwritten`,
              chatId: conversation.id,
            });
          }

          conversations.push(conversation);
          validChats++;
        } catch (error: any) {
          warnings.push({
            type: 'error',
            message: `Failed to convert chat "${chat.chatTitle || chat.chatID}": ${error?.message || 'Unknown error'}`,
            chatId: chat.chatID,
          });
        }
      }

      setParsedData({
        totalChats: exportData.data.chats.length,
        validChats,
        warnings,
        conversations,
      });
    } catch (error: any) {
      setParsedData({
        totalChats: 0,
        validChats: 0,
        warnings: [{
          type: 'error',
          message: `Failed to parse TypingMind export: ${error?.message || 'Invalid format'}`,
        }],
        conversations: [],
      });
    }
  }, [props.open, props.jsonContent, parsedData]);

  const handleConfirmImport = () => {
    if (!parsedData || parsedData.conversations.length === 0) return;

    setStep('importing');

    // Import conversations
    const outcome: ImportedOutcome = {
      conversations: [],
      activateConversationId: null,
    };

    try {
      for (const conversation of parsedData.conversations) {
        try {
          useChatStore.getState().importConversation(conversation, false);
          outcome.conversations.push({
            success: true,
            fileName: conversation.autoTitle || conversation.id,
            conversation,
          });
        } catch (error: any) {
          outcome.conversations.push({
            success: false,
            fileName: conversation.autoTitle || conversation.id,
            error: error?.message || 'Import failed',
          });
        }
      }

      // Activate the last imported conversation
      const lastSuccess = outcome.conversations.findLast(c => c.success);
      if (lastSuccess && 'conversation' in lastSuccess) {
        outcome.activateConversationId = lastSuccess.conversation.id;
        props.onConversationActivate(lastSuccess.conversation.id);
      }

      setImportOutcome(outcome);
      setStep('complete');
    } catch (error: any) {
      outcome.conversations.push({
        success: false,
        fileName: props.fileName,
        error: error?.message || 'Unknown error',
      });
      setImportOutcome(outcome);
      setStep('complete');
    }
  };

  const handleClose = () => {
    setParsedData(null);
    setImportOutcome(null);
    setStep('confirm');
    props.onClose();
  };

  if (!parsedData) {
    return null;
  }

  const hasErrors = parsedData.warnings.some(w => w.type === 'error');
  const canImport = parsedData.validChats > 0 && !hasErrors;

  return (
    <Modal open={props.open} onClose={handleClose}>
      <ModalDialog sx={{ minWidth: 500, maxWidth: 700 }}>
        <ModalClose />

        {/* Confirmation Step */}
        {step === 'confirm' && (
          <>
            <Typography level='h4'>
              Import from TypingMind
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
              <Typography level='body-md'>
                <strong>File:</strong> {props.fileName}
              </Typography>

              <Typography level='body-md'>
                <strong>Chats found:</strong> {parsedData.totalChats}
                {parsedData.validChats < parsedData.totalChats && (
                  <> ({parsedData.validChats} valid)</>
                )}
              </Typography>

              {parsedData.warnings.length > 0 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography level='body-sm' fontWeight='bold'>
                    {hasErrors ? 'Errors:' : 'Warnings:'}
                  </Typography>
                  {parsedData.warnings.map((warning, idx) => (
                    <Box key={idx} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                      {warning.type === 'error' ? (
                        <ErrorOutlineIcon color='error' sx={{ fontSize: 20, mt: 0.25 }} />
                      ) : (
                        <WarningRoundedIcon color='warning' sx={{ fontSize: 20, mt: 0.25 }} />
                      )}
                      <Typography level='body-sm' color={warning.type === 'error' ? 'danger' : 'warning'}>
                        {warning.message}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}

              <Typography level='body-sm' color='neutral'>
                Note: Folders, custom prompts, AI characters, plugins, and attachments will not be imported.
                See documentation for details.
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 1, mt: 3 }}>
              <Button variant='soft' onClick={handleClose}>
                Cancel
              </Button>
              <Button
                color='primary'
                disabled={!canImport}
                onClick={handleConfirmImport}
                sx={{ ml: 'auto' }}
              >
                Import {parsedData.validChats} Chat{parsedData.validChats !== 1 ? 's' : ''}
              </Button>
            </Box>
          </>
        )}

        {/* Importing Step */}
        {step === 'importing' && (
          <>
            <Typography level='h4'>
              Importing...
            </Typography>
            <Typography level='body-md' sx={{ mt: 2 }}>
              Please wait while we import your chats.
            </Typography>
          </>
        )}

        {/* Complete Step */}
        {step === 'complete' && importOutcome && (
          <>
            <Typography level='h4'>
              Import Complete
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
              <Typography level='body-md'>
                <strong>Successful:</strong> {importOutcome.conversations.filter(c => c.success).length}
              </Typography>
              <Typography level='body-md'>
                <strong>Failed:</strong> {importOutcome.conversations.filter(c => !c.success).length}
              </Typography>

              {importOutcome.conversations.some(c => !c.success) && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography level='body-sm' fontWeight='bold'>
                    Failures:
                  </Typography>
                  {importOutcome.conversations
                    .filter(c => !c.success)
                    .map((conv, idx) => (
                      <Typography key={idx} level='body-sm' color='danger'>
                        • {conv.fileName}: {conv.error}
                      </Typography>
                    ))}
                </Box>
              )}
            </Box>

            <Box sx={{ display: 'flex', gap: 1, mt: 3 }}>
              <Button color='primary' onClick={handleClose} sx={{ ml: 'auto' }}>
                Close
              </Button>
            </Box>
          </>
        )}
      </ModalDialog>
    </Modal>
  );
}
