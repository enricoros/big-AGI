import * as React from 'react';

import { Box, Button, Divider, FormControl, FormHelperText, FormLabel, Input, Option, Select, Typography } from '@mui/joy';

import { GoodModal } from '~/common/components/GoodModal';
import { apiQuery } from '~/common/util/trpc.client';
import { settingsGap } from '~/common/app.theme';

import type { OllamaAccessSchema } from '../../transports/server/ollama/ollama.router';


export function OllamaAdmin(props: { access: OllamaAccessSchema, onClose: () => void }) {

  // state
  const [pullModel, setPullModel] = React.useState<string | null>('llama2');
  const [pullTag, setPullTag] = React.useState<string>('');

  // external state
  const { data: pullable } = apiQuery.llmOllama.adminListPullable.useQuery({ access: props.access }, {
    staleTime: 1000 * 60,
    refetchOnWindowFocus: false,
  });
  const {
    data: pullData, isLoading: isPulling, status: pullStatus, error: pullModelError,
    mutate: pullMutate,
  } = apiQuery.llmOllama.adminPull.useMutation();

  // derived state
  const pullModelDescription = pullable?.pullable.find(p => p.id === pullModel)?.description ?? null;

  const handlePull = () => {
    if (pullModel) {
      pullMutate({
        access: props.access,
        name: pullModel + (pullTag ? ':' + pullTag : ''),
      });
    }
  };

  return (
    <GoodModal title='Ollama Administration' open onClose={props.onClose}>

      <Divider />

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography level='body-sm'>
          We assume your Ollama host is running and models are already available.
          However we provide a way to pull models from the Ollama host, for convenience.
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, mt: settingsGap }}>
          <FormControl sx={{ flexGrow: 1 }}>
            <FormLabel>
              Name
            </FormLabel>
            <Select value={pullModel || ''} onChange={(_event: any, value: string | null) => setPullModel(value)}>
              {pullable?.pullable.map(p =>
                <Option key={p.id} value={p.id}>{p.id}</Option>,
              )}
            </Select>
          </FormControl>
          <FormControl sx={{ flexGrow: 1 }}>
            <FormLabel>
              Tag
            </FormLabel>
            <Input
              variant='outlined' placeholder='latest'
              value={pullTag || ''} onChange={event => setPullTag(event.target.value)}
              sx={{ minWidth: 100 }}
              slotProps={{ input: { size: 10 } }} // halve the min width
            />
          </FormControl>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'space-between' }}>
          <Box>
            <FormHelperText color={pullModelError !== null ? 'danger' : undefined}>
              {pullModelError?.message || pullModelDescription}
            </FormHelperText>
            {!!pullData?.error
              ? <Typography color='danger'>{pullData.error}</Typography>
              : !!pullData?.status
                ? <Typography color='success'>{pullData.status}</Typography>
                : null
            }
          </Box>
          <Button
            color={pullStatus === 'error' ? 'danger' : pullStatus === 'success' ? 'success' : 'primary'}
            loading={isPulling} onClick={handlePull}
            sx={{ minWidth: 100 }}
          >
            Pull
          </Button>
        </Box>

      </Box>

      <Divider />

    </GoodModal>
  );
}