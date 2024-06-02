import * as React from 'react';

import { Box, Button, Chip, FormControl, IconButton, Input, Option, Select, Typography } from '@mui/joy';
import LaunchIcon from '@mui/icons-material/Launch';
import FormatListNumberedRtlIcon from '@mui/icons-material/FormatListNumberedRtl';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { GoodModal } from '~/common/components/GoodModal';
import { GoodTooltip } from '~/common/components/GoodTooltip';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { apiQuery } from '~/common/util/trpc.client';

import type { OllamaAccessSchema } from '../../server/ollama/ollama.router';


export function OllamaAdministration(props: { access: OllamaAccessSchema, onClose: () => void }) {

  // state
  const [sortByPulls, setSortByPulls] = React.useState<boolean>(false);
  const [modelName, setModelName] = React.useState<string | null>('llama3');
  const [modelTag, setModelTag] = React.useState<string>('');

  // external state
  const { data: pullableData } = apiQuery.llmOllama.adminListPullable.useQuery({ access: props.access }, {
    staleTime: 1000 * 60,
    refetchOnWindowFocus: false,
  });
  const { data: pullData, isLoading: isPulling, status: pullStatus, error: pullError, mutate: pullMutate, reset: pullReset } = apiQuery.llmOllama.adminPull.useMutation();
  const { isLoading: isDeleting, status: deleteStatus, error: deleteError, mutate: deleteMutate, reset: deleteReset } = apiQuery.llmOllama.adminDelete.useMutation();

  // derived state
  let pullable = pullableData?.pullable || [];
  if (sortByPulls)
    pullable = pullable.toSorted((a, b) => b.pulls - a.pulls);
  const pullModelDescription = pullable.find(p => p.id === modelName)?.description ?? null;


  const handleModelPull = () => {
    deleteReset();
    modelName && pullMutate({ access: props.access, name: modelName + (modelTag ? ':' + modelTag : '') });
  };

  const handleModelDelete = () => {
    pullReset();
    modelName && deleteMutate({ access: props.access, name: modelName + (modelTag ? ':' + modelTag : '') });
  };


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
                  <Option key={p.id} value={p.id}>
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
              <Input
                variant='outlined' placeholder='latest'
                value={modelTag || ''} onChange={event => setModelTag(event.target.value)}
                sx={{ minWidth: 80, flexGrow: 1 }}
                slotProps={{ input: { size: 10 } }} // halve the min width
              />
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