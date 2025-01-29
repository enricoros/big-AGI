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

import type { OllamaAccessSchema } from '../../server/ollama/ollama.router';


// configuration
const FALLBACK_PRESELECT_MODEL = 'llama3';


export function OllamaAdministration(props: { access: OllamaAccessSchema, onClose: () => void }) {

  // state
  const [sortByPulls, setSortByPulls] = React.useState<boolean>(false);
  const [_modelName, setModelName] = React.useState<string | null>(null);
  const [modelTag, setModelTag] = React.useState<string>('');

  // external state
  const { data: pullableData } = apiQuery.llmOllama.adminListPullable.useQuery({ access: props.access }, {
    staleTime: 1000 * 60,
  });
  const { data: pullData, isPending: isPulling, status: pullStatus, error: pullError, mutate: pullMutate, reset: pullReset } = apiQuery.llmOllama.adminPull.useMutation();
  const { isPending: isDeleting, status: deleteStatus, error: deleteError, mutate: deleteMutate, reset: deleteReset } = apiQuery.llmOllama.adminDelete.useMutation();

  // derived state
  const modelName = _modelName || pullableData?.pullable?.[0]?.id || FALLBACK_PRESELECT_MODEL;
  let pullable = pullableData?.pullable || [];
  if (sortByPulls)
    pullable = pullable.toSorted((a, b) => b.pulls - a.pulls);
  const pullModelDescription = pullable.find(p => p.id === modelName)?.description ?? null;


  const handleModelPull = React.useCallback(() => {
    deleteReset();
    modelName && pullMutate({ access: props.access, name: modelName + (modelTag ? ':' + modelTag : '') });
  }, [modelName, modelTag, pullMutate, props.access, deleteReset]);

  const handleModelDelete = React.useCallback(() => {
    pullReset();
    modelName && deleteMutate({ access: props.access, name: modelName + (modelTag ? ':' + modelTag : '') });
  }, [modelName, modelTag, deleteMutate, props.access, pullReset]);


  // memo 'tags' for the autocomplete for the currently selected model
  const pullableTagsMemo = React.useMemo(() => {
    const model = pullable.find(p => p.id === modelName);
    return model?.tags || [];
  }, [pullable, modelName]);


  return (
    <GoodModal title='Ollama Administration' dividers open onClose={props.onClose}>

      <Box sx={{ display: 'grid', gap: 'var(--Card-padding)' }}>
        <Typography level='body-sm'>
          We assume your Ollama host is running and models are already available.
          However we provide a way to pull models from the Ollama host, for convenience.
        </Typography>

        <Box sx={{ display: 'flex', flexFlow: 'row wrap', gap: 1 }}>
          <FormControl sx={{ flexGrow: 1, flexBasis: 0.55 }}>
            <FormLabelStart title='Name' />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Select
                value={modelName || ''}
                onChange={(_event: any, value: string | null) => setModelName(value)}
                sx={{ flexGrow: 1 }}
              >
                {pullable.map(p =>
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
                placeholder='latest'
                options={pullableTagsMemo}
                value={modelTag || ''}
                onChange={(_event: any, value: string | null) => setModelTag(value || '')}
                sx={{ minWidth: 80, flexGrow: 1, boxShadow: 'none' }}
                slotProps={{ input: { size: 10 } }} // halve the min width*/
              />
              {/*<Input*/}
              {/*  variant='outlined' placeholder='latest'*/}
              {/*  value={modelTag || ''} onChange={event => setModelTag(event.target.value)}*/}
              {/*  sx={{ minWidth: 80, flexGrow: 1 }}*/}
              {/*  slotProps={{ input: { size: 10 } }} // halve the min width*/}
              {/*/>*/}
              {!!modelName && (
                <IconButton
                  component={Link} href={`https://ollama.ai/library/${modelName}`} target='_blank'
                >
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
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'space-between' }}>

          <Typography level='body-sm'>
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