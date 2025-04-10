import * as React from 'react';

import { Box, Button, Card, Chip, CircularProgress, Divider, Stack, Typography } from '@mui/joy';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
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
    <Card variant='outlined' sx={{ backgroundColor: 'background.popup' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography level='title-md'>{entry.message}</Typography>
        <Button
          size='sm'
          variant='plain'
          color='neutral'
          onClick={props.onCloseDetails}
          startDecorator={<CloseRoundedIcon />}
        >
          Close
        </Button>
      </Box>

      <Divider />

      {/* Log Info */}
      <Box sx={{ mt: 1, display: 'grid', gridTemplateColumns: 'auto 1fr auto 1fr', gap: 1, fontSize: 'sm' }}>
        <Box fontWeight='bold'>Level:</Box>
        <div>{entry.level}</div>
        <Box fontWeight='bold'>Source:</Box>
        <div>{entry.source}</div>
        <Box fontWeight='bold'>Time:</Box>
        <div style={{ gridColumn: 'span 2' }}>{_formatTime(entry.timestamp)}</div>
      </Box>

      {/* Log Details */}
      {entry.details && (
        <Card
          variant='outlined'
          sx={{
            fontFamily: 'code',
            fontSize: 'xs',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            maxHeight: '300px',
            overflow: 'auto',
            p: 1,
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
