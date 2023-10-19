import * as React from 'react';

import { Box, Button, FormControl, FormHelperText, FormLabel, Input, Switch } from '@mui/joy';
import SyncIcon from '@mui/icons-material/Sync';

import { type ToggleableBoolean } from '~/common/util/useToggleableBoolean';
import { settingsCol1Width } from '~/common/theme';

/**
 * Bottom row: model reload and optional 'advanced' toggle
 */
export function RefetchButton(props: { refetch: () => void, disabled: boolean, error: boolean, advanced?: ToggleableBoolean }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between' }}>

      {!!props.advanced && (
        <FormLabel onClick={props.advanced.toggle} sx={{ textDecoration: 'underline', cursor: 'pointer' }}>
          {props.advanced.on ? 'Hide Advanced' : 'Advanced'}
        </FormLabel>
      )}

      <Button
        variant='solid' color={props.error ? 'warning' : 'primary'}
        disabled={props.disabled}
        endDecorator={<SyncIcon />}
        onClick={props.refetch}
        sx={{ minWidth: 120, ml: 'auto' }}
      >
        Models
      </Button>

    </Box>
  );
}


/**
 * Text form field (e.g. enter a host)
 */
export function SetupTextControl(props: {
  title: string | React.JSX.Element, description?: string | React.JSX.Element,
  placeholder?: string
  value: string | undefined, onChange: (text: string) => void,
}) {
  return (
    <FormControl orientation='horizontal' sx={{ flexWrap: 'wrap', justifyContent: 'space-between' }}>
      <Box sx={{ minWidth: settingsCol1Width }}>
        <FormLabel>
          {props.title}
        </FormLabel>
        <FormHelperText sx={{ display: 'block' }}>
          {props.description}
        </FormHelperText>
      </Box>
      <Input
        variant='outlined' placeholder={props.placeholder}
        value={props.value} onChange={event => props.onChange(event.target.value)}
        sx={{ flexGrow: 1 }}
      />
    </FormControl>
  );
}

/**
 * Switch control
 */
export function SetupSwitchControl(props: {
  title: string | React.JSX.Element, description?: string | React.JSX.Element,
  value: boolean, onChange: (on: boolean) => void,
}) {
  return (
    <FormControl orientation='horizontal' sx={{ flexWrap: 'wrap', justifyContent: 'space-between' }}>
      <Box sx={{ minWidth: settingsCol1Width }}>
        <FormLabel>
          {props.title}
        </FormLabel>
        <FormHelperText sx={{ display: 'block' }}>
          {props.description}
        </FormHelperText>
      </Box>
      <Switch
        checked={props.value}
        onChange={event => props.onChange(event.target.checked)}
        endDecorator={props.value ? 'Enabled' : 'Off'}
        sx={{ flexGrow: 1 }}
      />
    </FormControl>
  );
}