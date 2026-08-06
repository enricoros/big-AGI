import * as React from 'react';

import { Autocomplete, Box, Button, Chip, FormControl, IconButton, Option, Select, Typography } from '@mui/joy';
import LaunchIcon from '@mui/icons-material/Launch';
import FormatListNumberedRtlIcon from '@mui/icons-material/FormatListNumberedRtl';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { GoodModal } from '~/common/components/modals/GoodModal';
import { GoodTooltip } from '~/common/components/GoodTooltip';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { apiQuery } from '~/common/util/trpc.client';

import type { OllamaAccessSchema } from '../../server/ollama/ollama.access';


// configuration
const FALLBACK_PRESELECT_MODEL = 'llama3.3';


const _stableNoPullable = [] as const;
const _stableNoPullableTags = [] as const;

export function OllamaAdministration(props: { access: OllamaAccessSchema, onClose: () => void }) {

  // state
  const [sortByPulls, setSortByPulls] = React.useState<boolean>(false);
  const [_selectedModelName, setSelectedModelName] = React.useState<string | null>(null);
  // state for the autocomplete component
  const [modelTagValue, setModelTagValue] = React.useState<string | null>(null);
  const [modelTagInputValue, setModelTagInputValue] = React.useState<string>('');

  // external state
  const { data: pullableData } = apiQuery.llmOllama.adminListPullable.useQuery({ access: props.access }, {
    staleTime: 1000 * 60,
  });
  const { data: pullData, isPending: isPulling, status: pullStatus, error: pullError, mutate: pullMutate, reset: pullReset } = apiQuery.llmOllama.adminPull.useMutation();
  const { isPending: isDeleting, status: deleteStatus, error: deleteError, mutate: deleteMutate, reset: deleteReset } = apiQuery.llmOllama.adminDelete.useMutation();

  // derived state
  const selectedModelName = _selectedModelName // user selected
    || pullableData?.pullableModels?.[0]?.id // or the first in the list
    || FALLBACK_PRESELECT_MODEL; // or a fallback

  const handleModelPull = React.useCallback(() => {
    deleteReset();
    selectedModelName && pullMutate({ access: props.access, name: selectedModelName + (modelTagInputValue ? ':' + modelTagInputValue : '') });
  }, [selectedModelName, modelTagInputValue, pullMutate, props.access, deleteReset]);

  const handleModelDelete = React.useCallback(() => {
    pullReset();
    selectedModelName && deleteMutate({ access: props.access, name: selectedModelName + (modelTagInputValue ? ':' + modelTagInputValue : '') });
  }, [selectedModelName, modelTagInputValue, deleteMutate, props.access, pullReset]);


  // stabilize the derived arrays
  const { pullableModels, pullModelTags, pullModelDescription } = React.useMemo(() => {
    // optionally sort models by pulls
    let pullable = pullableData?.pullableModels || _stableNoPullable;
    if (sortByPulls)
      pullable = pullable.toSorted((a, b) => b.pulls - a.pulls);

    // return the tags and description for the selected model
    const selectedModel = pullable.find(p => p.id === selectedModelName) ?? null;
    return {
      pullableModels: pullable,
      pullModelDescription: selectedModel?.description || '',
      pullModelTags: selectedModel?.tags || _stableNoPullableTags,
    };
  }, [pullableData?.pullableModels, sortByPulls, selectedModelName]);


  return (
    <GoodModal title='Ollama Administration' dividers open onClose={props.onClose}>

      <Box sx={{ display: 'grid', gap: 'var(--Card-padding)' }}>
        <Typography level='body-sm'>
          We assume your Ollama host is running and models are already available.
          However we provide a way to pull models from the Ollama host, for convenience.
        </Typography>

        <Box sx={{ display: 'flex', flexFlow: 'row wrap', gap: 1 }}>
          <FormControl sx={{ flexGrow: 1, flexBasis: 0.55 }}>
            <FormLabelStart title={sortByPulls ? 'Model (Sorted by Downloads)' : 'Popular Model'} />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Select
                value={selectedModelName || ''}
                onChange={(_event: any, value: string | null) => setSelectedModelName(value)}
                sx={{ flexGrow: 1 }}
              >
                {pullableModels.map(p =>
                  <Option key={p.id} value={p.id} label={p.label}>
                    {p.isNew === true && <Chip size='sm' variant='solid'>NEW</Chip>} {p.label}{sortByPulls && ` (${p.pulls.toLocaleString()})`}
                  </Option>,
                )}
              </Select>
              <GoodTooltip title='Sort by Downloads'>
                <IconButton
                  variant={sortByPulls ? 'solid' : 'outlined'}
                  onClick={() => setSortByPulls(!sortByPulls)}
                >
                  <FormatListNumberedRtlIcon />
                </IconButton>
              </GoodTooltip>
            </Box>
          </FormControl>
          <FormControl sx={{ flexGrow: 1, flexBasis: 0.45 }}>
            <FormLabelStart title='Tag' />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Autocomplete
                freeSolo
                openOnFocus
                clearOnEscape
                placeholder='latest'
                options={pullModelTags}
                value={modelTagValue}
                onChange={(_event, newValue) => setModelTagValue(newValue)}
                inputValue={modelTagInputValue}
                onInputChange={(_event, newInputValue) => setModelTagInputValue(newInputValue)}
                sx={{ minWidth: 80, flexGrow: 1, boxShadow: 'none' }}
                slotProps={{ input: { size: 10 } }} // halve the min width*/
              />
              {/*<Input*/}
              {/*  variant='outlined' placeholder='latest'*/}
              {/*  value={modelTag || ''} onChange={event => setModelTag(event.target.value)}*/}
              {/*  sx={{ minWidth: 80, flexGrow: 1 }}*/}
              {/*  slotProps={{ input: { size: 10 } }} // halve the min width*/}
              {/*/>*/}
              {!!selectedModelName && (
                <IconButton component={Link} href={`https://ollama.ai/library/${selectedModelName}`} target='_blank'>
                  <LaunchIcon />
                </IconButton>
              )}
            </Box>
          </FormControl>
        </Box>


        {/* Status*/}
        {!!pullData && (pullData.error
          ? <Typography color='danger'>{pullData.error}</Typography>
          : <Typography color='success'>{pullData.status || 'Ok, but unkown status'}</Typography>)}
        {!!pullError && <InlineError error={pullError} />}
        {!!deleteError && <InlineError error={deleteError} />}


        {/* Description and Buttons */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'space-between' }}>

          <Typography level='body-sm' sx={{ flex: 1, minWidth: 250 }}>
            {pullModelDescription}
          </Typography>

          <Box sx={{ display: 'flex', flexWrap: 1, gap: 1, alignItems: 'start' }}>
            <Button
              variant='outlined'
              color={deleteStatus === 'error' ? 'danger' : deleteStatus === 'success' ? 'success' : 'primary'}
              loading={isDeleting} disabled={isPulling} onClick={handleModelDelete}
              sx={{ minWidth: 100 }}
            >
              Delete
            </Button>

            <Button
              color={pullStatus === 'error' ? 'danger' : pullStatus === 'success' ? 'success' : 'primary'}
              loading={isPulling} disabled={isDeleting} onClick={handleModelPull}
              sx={{ minWidth: 100 }}
            >
              Pull
            </Button>
          </Box>

        </Box>

        {/* Warnings */}
        {isPulling && <Typography color='warning' level='body-sm'>
          Pulling maybe slow and TIME OUT as the operation will download many GBs from the internet. In case of a
          timeout, the server is still downloading the model. Check back again later and the model should be available.
        </Typography>}

      </Box>

    </GoodModal>
  );
}