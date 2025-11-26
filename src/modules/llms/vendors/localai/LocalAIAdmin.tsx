import * as React from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

import { Alert, Box, Button, Card, Chip, CircularProgress, IconButton, LinearProgress, List, ListItem, Sheet, Switch, Table, Typography } from '@mui/joy';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';

import { ExpanderAccordion } from '~/common/components/ExpanderAccordion';
import { GoodModal } from '~/common/components/modals/GoodModal';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { apiQuery } from '~/common/util/trpc.client';
import { capitalizeFirstLetter } from '~/common/util/textUtils';

import type { OpenAIAccessSchema } from '../../server/openai/openai.access';


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
  const parentRef = React.useRef<HTMLDivElement>(null);

  // external state
  const { data, error } = apiQuery.llmOpenAI.dialectLocalAI_galleryModelsAvailable.useQuery({ access: props.access }, {
    staleTime: 1000 * 60,
  });

  // derived state
  const galleryNotConfigured = data === null;
  const filteredModels = React.useMemo(() =>
    data?.filter(model => showVoiceModels || !model.name?.startsWith('voice-')) || [],
    [data, showVoiceModels]
  );

  // virtualizer
  const virtualizer = useVirtualizer({
    count: filteredModels.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40, // Fixed row height
    overscan: 5,
  });


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
          Install models from your LocalAI Model Gallery. <b>You need a properly configured LocalAI gallery.</b>
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
          Available Models in Gallery
        </Typography>

        {/* Errors */}
        {!!error && <InlineError error={error} />}
        {galleryNotConfigured && <InlineError error={<>
          Model galleries do not seem to be configured (null response).
          Please refer to the <Link href='https://localai.io/models/' target='_blank'>documentation</Link> for
          how to configure model galleries.
        </>} />}

        {/* Table loading */}
        {!data ? (
          <CircularProgress color='success' />
        ) : (
          <>
            <Sheet
              variant='outlined'
              sx={{
                borderRadius: 'md',
                overflow: 'hidden',
              }}
            >
              <Box
                ref={parentRef}
                sx={{
                  height: '500px',
                  overflow: 'auto',
                }}
              >
                <Table
                  stickyHeader
                  hoverRow
                >
                  <thead>
                    <tr>
                      <th style={{ width: '35%' }}>Model</th>
                      <th style={{ width: '35%' }}>Description</th>
                      <th style={{ width: '20%' }}>Tags</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
                    {virtualizer.getVirtualItems().map((virtualItem) => {
                      const model = filteredModels[virtualItem.index];
                      if (!model?.name) return null;

                      return (
                        <tr
                          key={virtualItem.key}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '40px',
                            transform: `translateY(${virtualItem.start}px)`,
                            display: 'flex',
                          }}
                        >
                          <td style={{ width: '35%', minWidth: 0 }} className='agi-ellipsize'>
                            {capitalizeFirstLetter(model.name)}
                          </td>
                          <td style={{ width: '35%', minWidth: 0 }} className='agi-ellipsize'>
                            <small>{model.description || '-'}</small>
                          </td>
                          <td style={{ width: '20%', minWidth: 0 }} className='agi-ellipsize'>
                            {model.tags && model.tags.length > 0 &&
                              model.tags.slice(0, 2).map((tag, idx) => (
                                <Chip key={idx} size='sm' variant='soft' sx={{ fontSize: 'xs' }}>
                                  {tag}
                                </Chip>
                             ))}
                            {model.tags && model.tags.length > 2 && (
                              <small>+{model.tags.length - 2}</small>
                            )}
                          </td>
                          <td style={{ minWidth: 0, textAlign: 'right', flexShrink: 0 }}>
                            <Button
                              size='sm'
                              color='neutral'
                              disabled={installModels.some(p => p.galleryName === model.gallery.name && p.modelName === model.name)}
                              onClick={() => model.name && handleAppendInstall(model.gallery.name, model.name)}
                              sx={{ minWidth: 'auto', minHeight: 'auto', px: 1, py: 0.25 }}
                            >
                              Install
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </Box>
            </Sheet>

            <List variant='outlined' sx={{ borderRadius: 'md', p: 0, mt: 2 }}>
              <ListItemSwitch title='Show Voice Models' checked={showVoiceModels} onChange={setShowVoiceModels} />

              <ExpanderAccordion title='Debug: show JSON' startCollapsed sx={{ fontSize: 'sm' }}>
                <Box sx={{ whiteSpace: 'break-spaces' }}>
                  {JSON.stringify(data, null, 2)}
                </Box>
              </ExpanderAccordion>
            </List>
          </>
        )}

      </Box>
    </GoodModal>
  );
}