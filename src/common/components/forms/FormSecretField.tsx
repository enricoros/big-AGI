import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { FormControl, IconButton, Input } from '@mui/joy';
import KeyIcon from '@mui/icons-material/Key';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

import { FormLabelStart } from './FormLabelStart';


const _styles = {
  formControl: {
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputDefault: {
    flexGrow: 1,
  },
} as const satisfies Record<string, SxProps>;


/**
 * Secret/API key form field with visibility toggle.
 * Same inline layout as FormTextField but with secret-specific features:
 * - Password masking with visibility toggle
 * - Key icon (customizable)
 * - Password manager integration
 */
export function FormSecretField(props: {
  autoCompleteId: string;
  title: string | React.JSX.Element;
  description?: string | React.JSX.Element;
  tooltip?: string | React.JSX.Element;
  placeholder?: string;
  value: string;
  onChange: (text: string) => void;
  // Behavior
  required?: boolean;
  disabled?: boolean;
  isError?: boolean;
  // Appearance
  inputSx?: SxProps;
  /** Custom start decorator, or false to hide. Default: KeyIcon */
  startDecorator?: React.ReactNode | false;
}) {

  // state
  const [isVisible, setIsVisible] = React.useState(false);

  // derived
  const acId = 'secret-' + props.autoCompleteId;
  // password manager username
  const ghost = props.autoCompleteId.replace(/-key$/, '').replace(/-/g, ' ');

  const endDecorator = React.useMemo(() => !!props.value && (
    <IconButton size='sm' onClick={() => setIsVisible(on => !on)}>
      {isVisible ? <VisibilityIcon sx={{ fontSize: 'md' }} /> : <VisibilityOffIcon sx={{ fontSize: 'md' }} />}
    </IconButton>
  ), [props.value, isVisible]);

  return (
    <FormControl
      id={acId}
      orientation='horizontal'
      disabled={props.disabled}
      sx={_styles.formControl}
    >
      <FormLabelStart title={props.title} description={props.description} tooltip={props.tooltip} />
      {/* Hidden username field for password manager association */}
      <input
        type='text'
        autoComplete='username'
        value={ghost}
        readOnly
        tabIndex={-1}
        style={{ display: 'none' }}
      />
      <Input
        name={acId}
        type={isVisible ? 'text' : 'password'}
        autoComplete='new-password'
        variant='outlined'
        placeholder={props.required && !props.placeholder ? 'required' : props.placeholder}
        error={props.isError}
        value={props.value}
        onChange={event => props.onChange(event.target.value)}
        startDecorator={props.startDecorator ?? <KeyIcon sx={{ fontSize: 'md' }} />}
        endDecorator={endDecorator}
        sx={props.inputSx ?? _styles.inputDefault}
      />
    </FormControl>
  );
}
