import * as React from 'react';

import { Alert, Box, Button, FormControl, Input, Typography } from '@mui/joy';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';

import { DLLMId, getLLMLabel } from '~/common/stores/llms/llms.types';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { GoodModal } from '~/common/components/modals/GoodModal';
import { llmsStoreActions } from '~/common/stores/llms/store-llms';
import { useLLM, useLLMExists } from '~/common/stores/llms/llms.hooks';

import { getDLLMCloneId } from '../llm.client';


export function LLMOptionsClone(preps: {
  llmId: DLLMId;
  onClose: () => void;
  onCloned?: (cloneId: DLLMId) => void;
}) {

  const { llmId, onClose, onCloned } = preps;

  // state
  const [cloneLabel, setCloneLabel] = React.useState('');
  const [cloneVariant, setCloneVariant] = React.useState('');

  // derived
  const candidateCloneId = getDLLMCloneId(llmId, cloneVariant.trim());

  // external state
  const llm = useLLM(llmId);
  const cloneIdExists = useLLMExists(candidateCloneId);

  // derived 2
  const llmLabel = llm ? getLLMLabel(llm) : 'Unknown Model';

  // validation
  const variantRegex = /^[a-z0-9-]+$/i;
  const variantTrimmed = cloneVariant.trim();
  const isVariantFormatValid = variantTrimmed.length > 0 && variantRegex.test(variantTrimmed);
  const isVariantUnique = !cloneIdExists;
  const canCreate = isVariantFormatValid && isVariantUnique;


  const handleVariantChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    // normalize to lowercase, alphanumeric and hyphens only
    setCloneVariant(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
  }, []);

  const handleCreate = React.useCallback(() => {
    if (!canCreate) return;
    const finalLabel = cloneLabel.trim() || `${llmLabel} (Copy)`;
    const cloneId = llmsStoreActions().userCloneLLM(llmId, finalLabel, variantTrimmed);
    if (cloneId) {
      // close dialog first, then notify parent (which will switch to the new model)
      onClose();
      onCloned?.(cloneId);
    }
  }, [canCreate, cloneLabel, llmId, llmLabel, onCloned, onClose, variantTrimmed]);


  if (!llm) return null;

  return (
    <GoodModal
      open
      onClose={onClose}
      title='Duplicate Model'
      hideBottomClose
    >
      <Typography level='body-sm' sx={{ mb: 2 }}>
        Create a copy of <b>{llmLabel}</b> with independent settings.
      </Typography>

      <FormControl sx={{ mb: 2 }}>
        <FormLabelStart title='Display Name' />
        <Input
          autoFocus
          variant='outlined'
          placeholder={`${llmLabel} (Copy)`}
          value={cloneLabel}
          onChange={(e) => setCloneLabel(e.target.value)}
          sx={{ backgroundColor: 'background.popup' }}
        />
      </FormControl>

      <FormControl sx={{ mb: 2 }}>
        <FormLabelStart title='Variant ID' description='lowercase, no spaces' />
        <Input
          variant='outlined'
          placeholder='my-variant'
          value={cloneVariant}
          onChange={handleVariantChange}
          error={variantTrimmed.length > 0 && !isVariantFormatValid}
          sx={{ backgroundColor: 'background.popup' }}
        />
        <Typography
          level='body-xs'
          sx={{
            mt: 0.5,
            color: !variantTrimmed ? 'text.tertiary'
              : !isVariantFormatValid ? 'danger.plainColor'
                : !isVariantUnique ? 'warning.plainColor'
                  : 'success.plainColor',
          }}
        >
          {!variantTrimmed ? `Full ID: ${llmId}-...`
            : !isVariantUnique ? `ID already exists: ${candidateCloneId}`
              : `Full ID: ${candidateCloneId}`}
        </Typography>
      </FormControl>

      <Alert startDecorator={<WarningRoundedIcon />} sx={{ mb: 2 }}>
        EXPERIMENTAL - The model will be cloned at this point in time and
        won&apos;t receive automatic updates when models are refreshed.
      </Alert>

      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        <Button color='neutral' onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={!canCreate}
          onClick={handleCreate}
        >
          Create Duplicate
        </Button>
      </Box>

    </GoodModal>
  );
}
