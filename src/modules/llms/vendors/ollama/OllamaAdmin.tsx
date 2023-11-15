import * as React from 'react';

import { Box, Button, FormControl, Input, Option, Select, Stack, Typography } from '@mui/joy';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { GoodModal } from '~/common/components/GoodModal';
import { apiQuery } from '~/common/util/trpc.client';
import { settingsGap } from '~/common/app.theme';

import type { OllamaAccessSchema } from '../../transports/server/ollama/ollama.router';
import { InlineError } from '~/common/components/InlineError';


export function OllamaAdmin(props: { access: OllamaAccessSchema, onClose: () => void }) {

  // state
  const [modelName, setModelName] = React.useState<string | null>('llama2');
  const [modelTag, setModelTag] = React.useState<string>('');

  // external state
  const { data: pullable } = apiQuery.llmOllama.adminListPullable.useQuery({ access: props.access }, {
    staleTime: 1000 * 60,
    refetchOnWindowFocus: false,
  });
  const { data: pullData, isLoading: isPulling, status: pullStatus, error: pullError, mutate: pullMutate, reset: pullReset } = apiQuery.llmOllama.adminPull.useMutation();
  const { isLoading: isDeleting, status: deleteStatus, error: deleteError, mutate: deleteMutate, reset: deleteReset } = apiQuery.llmOllama.adminDelete.useMutation();

  // derived state
  const pullModelDescription = pullable?.pullable.find(p => p.id === modelName)?.description ?? null;

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

      <Stack direction='column' sx={{ gap: settingsGap }}>
        <Typography level='body-sm'>
          We assume your Ollama host is running and models are already available.
          However we provide a way to pull models from the Ollama host, for convenience.
        </Typography>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <FormControl sx={{ flexGrow: 1 }}>
            <FormLabelStart title='Name' />
            <Select value={modelName || ''} onChange={(_event: any, value: string | null) => setModelName(value)}>
              {pullable?.pullable.map(p =>
                <Option key={p.id} value={p.id}>{p.id}</Option>,
              )}
            </Select>
          </FormControl>
          <FormControl sx={{ flexGrow: 1 }}>
            <FormLabelStart title='Tag' />
            <Input
              variant='outlined' placeholder='latest'
              value={modelTag || ''} onChange={event => setModelTag(event.target.value)}
              sx={{ minWidth: 100 }}
              slotProps={{ input: { size: 10 } }} // halve the min width
            />
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

          <Box sx={{ display: 'flex', gap: 1 }}>
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

      </Stack>

    </GoodModal>
  );
}