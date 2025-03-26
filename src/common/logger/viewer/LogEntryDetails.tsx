import * as React from 'react';

import { Box, Button, Card, Chip, CircularProgress, Divider, Stack, Typography } from '@mui/joy';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

import { logger } from '~/common/logger';

import type { LogEntry } from '../logger.types';


function _formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleString();
}


export function LogEntryDetails(props: {
  entry: LogEntry;
  onCloseDetails: () => void;
}) {

  // state
  const [executing, setExecuting] = React.useState<string | null>(null);
  const [executionError, setExecutionError] = React.useState<string | null>(null);

  const { entry } = props;


  const handleExecuteAction = async (actionId?: string) => {
    setExecuting(actionId || 'default');
    setExecutionError(null);
    try {
      await logger.executeAction(entry.id, actionId);
    } catch (error) {
      setExecutionError((error as Error).message || 'Action failed');
    } finally {
      setExecuting(null);
    }
  };


  return (
    <Card variant='outlined'>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography level='title-lg'>{entry.message}</Typography>
        <Button
          size='sm'
          variant='plain'
          color='neutral'
          onClick={props.onCloseDetails}
          startDecorator={<CloseIcon />}
        >
          Close
        </Button>
      </Box>

      <Divider />

      {/* Log Info */}
      <Box sx={{ mt: 1, display: 'grid', gridTemplateColumns: 'auto 1fr auto 1fr', gap: 1 }}>
        <Typography fontWeight='bold'>Level:</Typography>
        <div>{entry.level}</div>
        <Typography fontWeight='bold'>Source:</Typography>
        <div>{entry.source}</div>
        <Typography fontWeight='bold'>Time:</Typography>
        <div>{_formatTime(entry.timestamp)}</div>
      </Box>

      {/* Log Details */}
      {entry.details && (
        <Card
          variant='soft'
          sx={{
            fontFamily: 'monospace',
            fontSize: 'sm',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            maxHeight: '300px',
            overflow: 'auto',
          }}
        >
          {typeof entry.details === 'string'
            ? entry.details
            : JSON.stringify(entry.details, null, 2)
          }
        </Card>
      )}

      {/* Actions */}
      {entry.actions && entry.actions.length > 0 && (
        <>
          <Typography level='title-sm' sx={{ mb: 1 }}>Actions</Typography>
          <Stack direction='row' spacing={1} flexWrap='wrap' sx={{ mb: 1 }}>
            {entry.actions.map((action, index) => (
              <Button
                key={action.id || index}
                size='sm'
                variant={action.completed ? 'soft' : 'solid'}
                color={action.completed ? 'success' : 'primary'}
                disabled={action.completed || !!executing}
                startDecorator={
                  action.completed
                    ? <CheckCircleIcon />
                    : executing === (action.id || 'default')
                      ? <CircularProgress size='sm' />
                      : null
                }
                onClick={() => handleExecuteAction(action.id)}
                sx={{ mb: 1 }}
              >
                {action.label}
                {action.completed && action.completedTimestamp && (
                  <Chip size='sm' variant='soft' color='success' sx={{ ml: 1 }}>
                    {new Date(action.completedTimestamp).toLocaleTimeString()}
                  </Chip>
                )}
              </Button>
            ))}
          </Stack>

          {/* Execution error */}
          {executionError && (
            <Card variant='soft' color='danger' sx={{ mt: 1 }}>
              <Typography level='body-sm'>{executionError}</Typography>
            </Card>
          )}
        </>
      )}
    </Card>
  );
}
