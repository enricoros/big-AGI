import * as React from 'react';
import TimeAgo from 'react-timeago';

import type { ColorPaletteProp } from '@mui/joy/styles/types';
import { Box, Button, Chip, Divider, FormControl, FormLabel, Option, Select, Table, Typography } from '@mui/joy';
import BugReportIcon from '@mui/icons-material/BugReport';
import ClearAllIcon from '@mui/icons-material/ClearAll';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';

import { GoodModal } from '~/common/components/modals/GoodModal';

import type { LogEntry, LogLevel, LogSource } from '../logger.types';
import { useLoggerStore } from '../store-logger';

import { LogEntryDetails } from './LogEntryDetails';


function _getLogLevelIcon(level: LogLevel) {
  switch (level) {
    case 'debug':
      return <BugReportIcon fontSize='small' color='action' />;
    case 'info':
      return <InfoIcon fontSize='small' color='info' />;
    case 'warn':
      return <WarningRoundedIcon fontSize='small' color='warning' />;
    case 'error':
      return <ErrorIcon fontSize='small' color='error' />;
    case 'critical':
      return <NotificationsActiveIcon fontSize='small' color='error' />;
    default:
      return null;
  }
}

function _getLogLevelColor(level: LogLevel): ColorPaletteProp {
  return ({
    'DEV': 'warning',
    'debug': 'neutral',
    'info': 'primary',
    'warn': 'warning',
    'error': 'danger',
    'critical': 'danger',
  } satisfies { [level: string]: ColorPaletteProp })[level] || 'neutral';
}

// function _formatTime(timestamp: number) {
//   return new Date(timestamp).toLocaleTimeString();
// }


export function LogViewerDialog(props: {
  onClose: () => void;
}) {

  // state
  const [filterLevel, setFilterLevel] = React.useState<LogLevel | 'all'>('all');
  const [filterSource, setFilterSource] = React.useState<LogSource | 'all'>('all');
  const [selectedLogId, setSelectedLogId] = React.useState<LogEntry['id'] | null>(null);

  // external state
  const entries = useLoggerStore(state => state.entries);


  // derived state

  // unique sources for filter dropdown
  const availableSources = React.useMemo(() => {
    const sources = new Set(entries.map(e => e.source));
    return Array.from(sources);
  }, [entries]);

  const filteredEntries = React.useMemo(() => {
    return entries.filter(entry =>
      (filterLevel === 'all' || entry.level === filterLevel) &&
      (filterSource === 'all' || entry.source === filterSource),
    );
  }, [entries, filterLevel, filterSource]);

  const entry = React.useMemo(() => {
    return !selectedLogId ? undefined : entries.find(e => e.id === selectedLogId);
  }, [entries, selectedLogId]);


  // handlers

  const handleClearAll = React.useCallback(() => {
    useLoggerStore.getState().clearAll();
    setSelectedLogId(null);
  }, []);


  return (
    <GoodModal
      open
      onClose={props.onClose}
      title='Client Logs'
      unfilterBackdrop
      // themedColor='neutral'
      sx={{ maxWidth: undefined, overflow: 'hidden' }}
    >
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, mb: 1 }}>

        {/* Level Filter */}
        <FormControl sx={{ flex: 1 }}>
          <FormLabel>Level</FormLabel>
          <Select
            size='sm'
            value={filterLevel}
            onChange={(_, value) => value !== null && setFilterLevel(value)}
            sx={{ backgroundColor: 'background.popup' }}
          >
            <Option value='all'>All Levels</Option>
            <Option value='debug'>Debug</Option>
            <Option value='info'>Info</Option>
            <Option value='warn'>Warning</Option>
            <Option value='error'>Error</Option>
            <Option value='critical'>Critical</Option>
          </Select>
        </FormControl>

        {/* Source Filter */}
        <FormControl sx={{ flex: 1 }}>
          <FormLabel>Source</FormLabel>
          <Select
            size='sm'
            value={filterSource}
            onChange={(_, value) => value !== null && setFilterSource(value)}
            sx={{ backgroundColor: 'background.popup' }}
          >
            <Option value='all'>All Sources</Option>
            {availableSources.map(source => (
              <Option key={source} value={source}>{source}</Option>
            ))}
          </Select>
        </FormControl>

        {/* Clear Button */}
        <Box sx={{ display: 'flex', alignItems: 'flex-end' }}>
          <Button
            size='sm'
            color='danger'
            onClick={handleClearAll}
            startDecorator={<ClearAllIcon />}
            disabled={entries.length === 0}
          >
            Clear Logs
          </Button>
        </Box>
      </Box>

      {/*<Divider />*/}

      {/* Log entries table */}
      {filteredEntries.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
          <Typography level='body-lg'>No logs to display</Typography>
        </Box>
      ) : (
        <Box sx={{ minHeight: '12rem', overflow: 'auto', my: 1 }}>
          <Table
            size='sm'
            variant='outlined'
            sx={{
              '& th': { fontWeight: 'bold', whiteSpace: 'nowrap', p: 1 },
              '& td': { p: 1 },
              '& tr:hover': { backgroundColor: 'background.level1', cursor: 'pointer' },
              '& tr.selected': { backgroundColor: 'background.level2' },
              backgroundColor: 'background.popup',
              overflow: 'hidden',
            }}
          >
            <thead>
            <tr>
              <th style={{ width: '30px' }}></th>
              <th style={{ width: '120px' }}>Time</th>
              <th style={{ width: '80px' }}>Level</th>
              <th style={{ width: '120px' }}>Source</th>
              <th style={{ minWidth: '100px' }}>Message</th>
              <th style={{ width: '100px' }}>Actions</th>
            </tr>
            </thead>
            <tbody>
            {filteredEntries.map((entry) => (
              <tr
                key={entry.id}
                onClick={() => setSelectedLogId(entry.id)}
                className={selectedLogId === entry.id ? 'selected' : undefined}
              >
                <td>{_getLogLevelIcon(entry.level)}</td>
                <td><TimeAgo date={entry.timestamp} /></td>
                {/*<td>{_formatTime(entry.timestamp)}</td>*/}
                <td>
                  <Chip
                    size='sm'
                    color={_getLogLevelColor(entry.level)}
                    variant='soft'
                  >
                    {entry.level}
                  </Chip>
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>{entry.source}</td>
                <td className='agi-ellipsize'>{entry.message}</td>
                <td>
                  {entry.actions && entry.actions.length > 0 && (
                    <Chip size='sm' variant='outlined'>
                      {entry.hasPendingActions ? 'Pending' : 'Complete'}
                    </Chip>
                  )}
                </td>
              </tr>
            ))}
            </tbody>
          </Table>
        </Box>
      )}

      {/* Selected Log Details */}
      {entry && <>

        <Divider />

        <Box sx={{ mt: 1 }}>
          <LogEntryDetails
            entry={entry}
            onCloseDetails={() => setSelectedLogId(null)}
          />
        </Box>
      </>}
    </GoodModal>
  );
}
