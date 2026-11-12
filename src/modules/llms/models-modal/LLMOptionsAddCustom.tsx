import * as React from 'react';

import { Box, Button, FormControl, Input, Typography } from '@mui/joy';

import type { DLLMId } from '~/common/stores/llms/llms.types';
import type { DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { GoodModal } from '~/common/components/modals/GoodModal';
import { llmsStoreActions } from '~/common/stores/llms/store-llms';
import { useLLMExists } from '~/common/stores/llms/llms.hooks';

import { getDLLMCustomId } from '../llm.client';


/**
 * Adds a model by ID to a service, for endpoints that do not list their models.
 */
export function LLMOptionsAddCustom(props: {
  serviceId: DModelsServiceId;
  onClose: () => void;
  onAdded?: (llmId: DLLMId) => void;
}) {

  const { serviceId, onClose, onAdded } = props;

  // state
  const [label, setLabel] = React.useState('');
  const [llmRef, setLlmRef] = React.useState('');

  // derived
  const llmRefTrimmed = llmRef.trim();
  const idExists = useLLMExists(llmRefTrimmed ? getDLLMCustomId(serviceId, llmRefTrimmed) : null);
  const canCreate = !!llmRefTrimmed && !idExists;

  const handleCreate = React.useCallback(() => {
    if (!canCreate) return;
    const llmId = llmsStoreActions().userCreateLLM(serviceId, label.trim() || llmRefTrimmed, llmRefTrimmed);
    if (llmId) {
      onClose();
      onAdded?.(llmId);
    }
  }, [canCreate, label, llmRefTrimmed, onAdded, onClose, serviceId]);

  return (
    <GoodModal
      open
      onClose={onClose}
      title='Add Model'
      hideBottomClose
    >
      <Typography level='body-sm' sx={{ mb: 2 }}>
        Add a model by its ID, for endpoints that do not list their models.
      </Typography>

      <FormControl sx={{ mb: 2 }}>
        <FormLabelStart title='Model ID' description='as the API expects it' />
        <Input
          autoFocus
          variant='outlined'
          placeholder='e.g. my-model-name'
          value={llmRef}
          onChange={(e) => setLlmRef(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          error={idExists}
          sx={{ backgroundColor: 'background.popup' }}
        />
        {idExists && (
          <Typography level='body-xs' sx={{ mt: 0.5, color: 'warning.plainColor' }}>
            This model was already added
          </Typography>
        )}
      </FormControl>

      <FormControl sx={{ mb: 2 }}>
        <FormLabelStart title='Display Name' />
        <Input
          variant='outlined'
          placeholder={llmRefTrimmed || 'Model name'}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          sx={{ backgroundColor: 'background.popup' }}
        />
      </FormControl>

      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        <Button color='neutral' onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={!canCreate} onClick={handleCreate}>
          Add Model
        </Button>
      </Box>

    </GoodModal>
  );
}
