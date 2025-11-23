/**
 * Main data import modal component
 * Provides a multi-step import flow: file selection -> validation -> confirmation -> import
 */

import * as React from 'react';
import { Box, Button, CircularProgress, Typography } from '@mui/joy';
import FileUploadIcon from '@mui/icons-material/FileUpload';

import { GoodModal } from '~/common/components/modals/GoodModal';
import type { DConversationId } from '~/common/stores/chat/chat.conversation';
import type { VendorId } from '../vendors/vendor.types';
import type { ImportResult } from '../data.types';

import { ImportConfirmStep } from './ImportConfirmStep';
import { ImportResultModal } from './ImportResultModal';


interface DataImportModalProps {
  vendorId: VendorId;
  vendorLabel: string;
  open: boolean;
  onConversationActivate?: (conversationId: DConversationId) => void;
  onClose: () => void;
}


type ImportStep = 'select' | 'processing' | 'confirm' | 'importing' | 'complete';


export function DataImportModal(props: DataImportModalProps) {
  const { vendorId, vendorLabel, open, onClose } = props;

  // State
  const [step, setStep] = React.useState<ImportStep>('select');
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [importPreview, setImportPreview] = React.useState<any>(null);
  const [importResult, setImportResult] = React.useState<ImportResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // File input ref
  const fileInputRef = React.useRef<HTMLInputElement>(null);


  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setStep('processing');
    setError(null);

    try {
      // Dynamic import of the vendor importer
      const { importTypingMindData } = await import('../vendors/typingmind/typingmind.import-function');

      // TODO: Use vendor registry to get the correct importer
      // For now, only TypingMind is supported
      if (vendorId !== 'typingmind') {
        throw new Error(`Vendor ${vendorId} not yet supported`);
      }

      // Parse and validate the file
      const result = await importTypingMindData(file, { dryRun: true });

      if (!result.success) {
        setError(result.errors[0]?.message || 'Failed to parse file');
        setStep('select');
        return;
      }

      setImportPreview(result);
      setStep('confirm');

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStep('select');
    }
  };


  const handleConfirmImport = async () => {
    if (!selectedFile) return;

    setStep('importing');
    setError(null);

    try {
      // Dynamic import of the vendor importer
      const { importTypingMindData } = await import('../vendors/typingmind/typingmind.import-function');

      // Actually perform the import
      const result = await importTypingMindData(selectedFile, { dryRun: false });

      setImportResult(result);
      setStep('complete');

      // Activate the last imported conversation
      if (result.success && result.conversations.length > 0 && props.onConversationActivate) {
        const lastConv = result.conversations[result.conversations.length - 1];
        props.onConversationActivate(lastConv.id);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStep('confirm');
    }
  };


  const handleCancelImport = () => {
    setStep('select');
    setSelectedFile(null);
    setImportPreview(null);
    setError(null);
  };


  const handleCloseComplete = () => {
    setStep('select');
    setSelectedFile(null);
    setImportPreview(null);
    setImportResult(null);
    setError(null);
    onClose();
  };


  const handleOpenFilePicker = () => {
    fileInputRef.current?.click();
  };


  // Render step content
  const renderStepContent = () => {
    switch (step) {
      case 'select':
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', py: 4 }}>
            <Typography level='body-md'>
              Select a {vendorLabel} export file to import
            </Typography>

            <input
              ref={fileInputRef}
              type='file'
              accept='.json,application/json'
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />

            <Button
              variant='solid'
              color='primary'
              size='lg'
              startDecorator={<FileUploadIcon />}
              onClick={handleOpenFilePicker}
            >
              Choose File
            </Button>

            {error && (
              <Typography level='body-sm' color='danger'>
                {error}
              </Typography>
            )}
          </Box>
        );

      case 'processing':
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', py: 4 }}>
            <CircularProgress />
            <Typography level='body-md'>Processing file...</Typography>
          </Box>
        );

      case 'confirm':
        return importPreview ? (
          <ImportConfirmStep
            preview={importPreview}
            vendorLabel={vendorLabel}
            onConfirm={handleConfirmImport}
            onCancel={handleCancelImport}
          />
        ) : null;

      case 'importing':
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', py: 4 }}>
            <CircularProgress />
            <Typography level='body-md'>Importing conversations...</Typography>
          </Box>
        );

      case 'complete':
        return null; // Handled by separate modal

      default:
        return null;
    }
  };


  // Show result modal when complete
  if (step === 'complete' && importResult) {
    return (
      <ImportResultModal
        result={importResult}
        vendorLabel={vendorLabel}
        onClose={handleCloseComplete}
      />
    );
  }


  return (
    <GoodModal
      open={open && step !== 'complete'}
      title={`Import from ${vendorLabel}`}
      onClose={step === 'processing' || step === 'importing' ? undefined : onClose}
    >
      <Box>{renderStepContent()}</Box>
    </GoodModal>
  );
}
