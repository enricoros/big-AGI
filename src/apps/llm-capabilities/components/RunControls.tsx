import * as React from 'react';

import { Box, Button, Chip, IconButton, LinearProgress, Option, Select, Stack, Tooltip, Typography } from '@mui/joy';
import BuildCircleIcon from '@mui/icons-material/BuildCircle';
import ClearIcon from '@mui/icons-material/Clear';
import DownloadIcon from '@mui/icons-material/Download';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import RefreshIcon from '@mui/icons-material/Refresh';
import StopRoundedIcon from '@mui/icons-material/StopRounded';


export type DeclaredFcFilter = 'any' | 'yes' | 'no';

export interface RunControlsProps {
  // filters
  vendors: { id: string; name: string; count: number }[];
  selectedVendor: string;                     // '' = all
  onSelectedVendorChange: (v: string) => void;
  declaredFcFilter: DeclaredFcFilter;
  onDeclaredFcFilterChange: (v: DeclaredFcFilter) => void;
  showHidden: boolean;
  onShowHiddenChange: (v: boolean) => void;
  onOpenServices: () => void;

  // execution knobs
  concurrency: number;
  onConcurrencyChange: (v: number) => void;
  timeoutSec: number;
  onTimeoutSecChange: (v: number) => void;

  // selection & progress
  visibleCount: number;
  selectedCount: number;
  failingSelectedCount: number;
  isRunning: boolean;
  completed: number;
  total: number;

  // actions
  onSelectAllVisible: () => void;
  onClearSelection: () => void;
  onSelectAllFailing: () => void;
  onRunSelected: () => void;
  onRunFailingSelected: () => void;
  onStop: () => void;
  onClearResults: () => void;
  onExportCsv: () => void;
}


export function RunControls(props: RunControlsProps) {
  const {
    vendors, selectedVendor, onSelectedVendorChange,
    declaredFcFilter, onDeclaredFcFilterChange,
    showHidden, onShowHiddenChange, onOpenServices,
    concurrency, onConcurrencyChange,
    timeoutSec, onTimeoutSecChange,
    visibleCount, selectedCount, failingSelectedCount,
    isRunning, completed, total,
    onSelectAllVisible, onClearSelection, onSelectAllFailing,
    onRunSelected, onRunFailingSelected, onStop, onClearResults, onExportCsv,
  } = props;

  const canRun = !isRunning && selectedCount > 0;
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <Stack spacing={1.5}>

      {/* Filters row */}
      <Stack direction='row' spacing={1} sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
        <Typography level='body-sm' sx={{ minWidth: 60 }}>Filter:</Typography>

        <Select
          size='sm'
          value={selectedVendor}
          onChange={(_e, v) => onSelectedVendorChange(v ?? '')}
          sx={{ minWidth: 180 }}
        >
          <Option value=''>All vendors ({vendors.reduce((sum, v) => sum + v.count, 0)})</Option>
          {vendors.map(v => (
            <Option key={v.id} value={v.id}>{v.name} ({v.count})</Option>
          ))}
        </Select>

        <Select
          size='sm'
          value={declaredFcFilter}
          onChange={(_e, v) => onDeclaredFcFilterChange((v ?? 'any') as DeclaredFcFilter)}
          sx={{ minWidth: 160 }}
        >
          <Option value='any'>Any declaration</Option>
          <Option value='yes'>Declares FC</Option>
          <Option value='no'>No FC declared</Option>
        </Select>

        <Button
          size='sm'
          variant={showHidden ? 'solid' : 'outlined'}
          color='neutral'
          onClick={() => onShowHiddenChange(!showHidden)}
        >
          {showHidden ? 'Showing hidden' : 'Visible only'}
        </Button>

        <Tooltip title='Open the AI Models configurator to add/remove services and edit per-model options.' size='sm'>
          <Button
            size='sm'
            variant='outlined'
            color='neutral'
            startDecorator={<BuildCircleIcon />}
            onClick={onOpenServices}
          >
            Services
          </Button>
        </Tooltip>

        <Box sx={{ flex: 1 }} />

        <Chip size='sm' variant='outlined'>{visibleCount} visible</Chip>
        <Chip size='sm' variant='soft' color={selectedCount > 0 ? 'primary' : 'neutral'}>{selectedCount} selected</Chip>
      </Stack>

      {/* Selection shortcuts */}
      <Stack direction='row' spacing={1} sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
        <Typography level='body-sm' sx={{ minWidth: 60 }}>Select:</Typography>
        <Button size='sm' variant='outlined' onClick={onSelectAllVisible} disabled={isRunning || visibleCount === 0}>All visible ({visibleCount})</Button>
        <Button size='sm' variant='outlined' onClick={onSelectAllFailing} disabled={isRunning || failingSelectedCount === 0}>All failing in view ({failingSelectedCount})</Button>
        <Button size='sm' variant='plain' onClick={onClearSelection} disabled={isRunning || selectedCount === 0}>Clear</Button>
      </Stack>

      {/* Execution row */}
      <Stack direction='row' spacing={1} sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
        <Typography level='body-sm' sx={{ minWidth: 60 }}>Run:</Typography>

        <Select size='sm' value={concurrency} onChange={(_e, v) => v && onConcurrencyChange(v)} sx={{ minWidth: 130 }}>
          {[1, 2, 4, 8, 16].map(n => <Option key={n} value={n}>{n} parallel</Option>)}
        </Select>

        <Select size='sm' value={timeoutSec} onChange={(_e, v) => v && onTimeoutSecChange(v)} sx={{ minWidth: 130 }}>
          {[10, 20, 30, 60, 120, 300, 600].map(n => <Option key={n} value={n}>{n >= 60 ? `${n / 60}m` : `${n}s`} timeout</Option>)}
        </Select>

        <Tooltip title='Run all selected models through all scenarios.' size='sm'>
          <span>
            <Button
              size='sm'
              color='primary'
              startDecorator={<PlayArrowRoundedIcon />}
              onClick={onRunSelected}
              disabled={!canRun}
            >
              Run selected ({selectedCount})
            </Button>
          </span>
        </Tooltip>

        <Tooltip title='Re-run only probes that previously failed for selected models.' size='sm'>
          <span>
            <Button
              size='sm'
              variant='outlined'
              startDecorator={<RefreshIcon />}
              onClick={onRunFailingSelected}
              disabled={!canRun}
            >
              Rerun failing
            </Button>
          </span>
        </Tooltip>

        {isRunning && (
          <Button
            size='sm'
            color='danger'
            variant='solid'
            startDecorator={<StopRoundedIcon />}
            onClick={onStop}
          >
            Stop
          </Button>
        )}

        <Box sx={{ flex: 1 }} />

        <Tooltip title='Clear all stored probe results (not the selection).' size='sm'>
          <IconButton size='sm' variant='outlined' color='danger' onClick={onClearResults} disabled={isRunning}><ClearIcon /></IconButton>
        </Tooltip>
        <Tooltip title='Export current view to CSV.' size='sm'>
          <IconButton size='sm' variant='outlined' onClick={onExportCsv}><DownloadIcon /></IconButton>
        </Tooltip>
      </Stack>

      {isRunning && (
        <Stack spacing={0.5}>
          <Typography level='body-xs'>Running: {completed} / {total} probes ({progressPct}%)</Typography>
          <LinearProgress determinate value={progressPct} />
        </Stack>
      )}

    </Stack>
  );
}
