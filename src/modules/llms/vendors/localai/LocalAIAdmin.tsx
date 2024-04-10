import * as React from 'react';

import { Alert, Box, Button, Card, CircularProgress, IconButton, LinearProgress, List, ListItem, Switch, Typography } from '@mui/joy';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';

import { ExpanderAccordion } from '~/common/components/ExpanderAccordion';
import { GoodModal } from '~/common/components/GoodModal';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { apiQuery } from '~/common/util/trpc.client';
import { capitalizeFirstLetter } from '~/common/util/textUtils';

import type { OpenAIAccessSchema } from '../../server/openai/openai.router';


function ListItemSwitch(props: { title: string, checked: boolean, onChange: (checked: boolean) => void }) {
  return (
    <ListItem variant='soft'>
      <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
        {props.title}
        <Switch
          checked={props.checked}
          onChange={event => props.onChange(event.target.checked)}
          endDecorator={props.checked ? 'Show' : 'Hide'}
          sx={{ ml: 'auto' }}
        />
      </Box>
    </ListItem>
  );
}


/**
 * Show the progress of a model install job by polling the server every 1 second until complete.
 *  - uses the LocalAI /models/jobs API
 */
function ModelJobStatusChecker(props: { access: OpenAIAccessSchema, jobId: string }) {

  // local state
  const [isPolling, setIsPolling] = React.useState(true);

  // external state
  const { data, error } = apiQuery.llmOpenAI.dialectLocalAI_galleryModelsJob.useQuery({ access: props.access, jobId: props.jobId }, {
    enabled: isPolling,
    refetchInterval: 1000,
  });

  // [effect] stop polling when job is done
  const isDone = data?.processed === true || data?.progress === 100;
  React.useEffect(() => {
    if (isDone)
      setIsPolling(false);
  }, [isDone]);

  return <>

    {!!error && <InlineError error={error} />}

    {data && <Box sx={{ display: 'grid', gap: 1, my: 1 }}>
      {data.message && <Typography component='div' level='body-sm'>Message: {data.message}</Typography>}
      {data.file_name && <Typography component='div' level='body-sm'>File: {data.file_name}</Typography>}
      {data.file_size && <Typography component='div' level='body-sm'>File size: {data.file_size}</Typography>}
      {data.downloaded_size && <Typography component='div' level='body-sm'>Downloaded: {data.downloaded_size}</Typography>}
    </Box>}

    {isPolling
      ? <Alert variant='soft' color='primary'>Installation has begun. This may take a very long time.</Alert>
      : <Alert variant='soft' color={error ? 'warning' : 'success'}>
        {error ? 'Installation failed' : 'Installation complete'}
      </Alert>}

    <LinearProgress determinate color={error ? 'warning' : isDone ? 'success' : 'primary'} value={data?.progress || 0} sx={{ mt: 1 }} />

  </>;
}

/**
 * Every model being installed has a panel showing the status.
 *  - uses the LocalAI /models/apply API
 */
function ModelInstallPanel(props: { access: OpenAIAccessSchema, modelName: string, galleryName: string }) {

  // state
  const [hideSelf, setHideSelf] = React.useState(false);

  // external state
  const { data, error, mutate } = apiQuery.llmOpenAI.dialectLocalAI_galleryModelsApply.useMutation();

  // [effect] auto-install
  React.useEffect(() => {
    mutate({ access: props.access, galleryName: props.galleryName, modelName: props.modelName });
  }, [mutate, props.access, props.galleryName, props.modelName]);

  if (hideSelf)
    return null;

  return (
    <Card sx={{ gap: 0, boxShadow: 'sm' }}>

      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Typography level='title-sm'>
          Installing <strong>{props.modelName}</strong> from the <strong>{props.galleryName}</strong>
        </Typography>
        <IconButton size='sm' onClick={() => setHideSelf(true)} sx={{ ml: 'auto' }}>
          <CloseRoundedIcon />
        </IconButton>
      </Box>

      {!!error && <InlineError error={error} />}

      {!!data?.uuid && <ModelJobStatusChecker access={props.access} jobId={data.uuid} />}

    </Card>
  );
}


/**
 * Administration panel for LocalAI. Mainly to install models from the Gallery.
 */
export function LocalAIAdmin(props: { access: OpenAIAccessSchema, onClose: () => void }) {

  // state
  const [installModels, setInstallModels] = React.useState<{ galleryName: string; modelName: string; }[]>([]);
  const [showVoiceModels, setShowVoiceModels] = React.useState(false);

  // external state
  const { data, error } = apiQuery.llmOpenAI.dialectLocalAI_galleryModelsAvailable.useQuery({ access: props.access }, {
    staleTime: 1000 * 60,
    refetchOnWindowFocus: false,
  });

  // derived state
  const galleryNotConfigured = data === null;


  const handleAppendInstall = React.useCallback((galleryName: string, modelName: string) => {
    setInstallModels(prev => {
      // if already in list, do not add
      if (prev.some(p => p.galleryName === galleryName && p.modelName === modelName))
        return prev;
      return [...prev, { galleryName, modelName }];
    });
  }, []);


  return (
    <GoodModal title='LocalAI Administration' dividers open onClose={props.onClose}>
      <Box sx={{ display: 'grid', gap: 'var(--Card-padding)' }}>

        <Typography level='body-sm'>
          Install models from your LocalAI Model Gallery. We assume your LocalAI server is correcly
          configured and running.
        </Typography>

        {/* Models being Installed */}
        {installModels.length > 0 && <>

          <Typography level='title-lg'>
            Model Installation
          </Typography>

          <List sx={{ gap: 1 }}>
            {installModels.map((params, index) =>
              <ModelInstallPanel key={'install-' + index} access={props.access} {...params} />,
            )}
          </List>

        </>}


        <Typography level='title-md'>
          Available Models List
        </Typography>

        {/* Errors */}
        {!!error && <InlineError error={error} />}
        {galleryNotConfigured && <InlineError error={<>
          Model galleries do not seem to be configured (null response).
          Please refer to the <Link href='https://localai.io/models/' target='_blank'>documentation</Link> for
          how to configure model galleries.
        </>} />}

        {/* List loading */}
        {!data ? (
          <CircularProgress color='success' />
        ) : (
          <List
            variant='outlined'
            sx={{
              '--ListItem-minHeight': '2.75rem',
              borderRadius: 'md',
              p: 0,
            }}
          >
            {data
              .filter(model => showVoiceModels || !model.name.startsWith('voice-'))
              .map((model) => (
                <ListItem key={model.name}>

                  {capitalizeFirstLetter(model.name)}

                  <Button
                    color='neutral'
                    size='sm'
                    disabled={installModels.some(p => p.galleryName === model.gallery.name && p.modelName === model.name)}
                    onClick={() => handleAppendInstall(model.gallery.name, model.name)}
                    sx={{
                      ml: 'auto',
                    }}
                  >
                    Install
                  </Button>
                </ListItem>
              ))}

            <ListItemSwitch title='Show Voice Models' checked={showVoiceModels} onChange={setShowVoiceModels} />

            <ExpanderAccordion title='Debug: show JSON' startCollapsed sx={{ fontSize: 'sm' }}>
              <Box sx={{ whiteSpace: 'break-spaces' }}>
                {JSON.stringify(data, null, 2)}
              </Box>
            </ExpanderAccordion>
          </List>
        )}

      </Box>
    </GoodModal>
  );
}