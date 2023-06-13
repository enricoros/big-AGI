import * as React from 'react';

import { Box, FormControl, FormHelperText, FormLabel, IconButton, Input } from '@mui/joy';
import KeyIcon from '@mui/icons-material/Key';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';


export function FormInputKey(props: {
  label?: string, rightLabel?: string | React.JSX.Element,
  description?: string | React.JSX.Element,
  value: string, onChange: (value: string) => void,
  placeholder?: string, isVisible?: boolean,
  required: boolean, isError?: boolean,
  noFormControl?: boolean,
  noKey?: boolean,
}) {

  // internal state is only whether the text is visible or not - the actual value is stored in the parent
  const [isVisible, setIsVisible] = React.useState(!!props.isVisible);

  const handleChange = (e: React.ChangeEvent) => props.onChange((e.target as HTMLInputElement).value);

  const endDecorator = React.useMemo(() => !!props.value && !props.noKey && (
    <IconButton variant='plain' color='neutral' onClick={() => setIsVisible(!isVisible)}>
      {isVisible ? <VisibilityIcon /> : <VisibilityOffIcon />}
    </IconButton>
  ), [props.value, props.noKey, isVisible]);

  const Wrapper = props.noFormControl ? React.Fragment : FormControl;

  return <Wrapper>

    {!!props.label && <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1, alignItems: 'baseline', flexWrap: 'wrap', justifyContent: 'space-between' }}>
      <FormLabel>{props.label}</FormLabel>
      {!!props.rightLabel && <FormHelperText sx={{ display: 'block' }}>
        {props.rightLabel}
      </FormHelperText>}
    </Box>}

    <Input
      variant={props.required ? 'outlined' : 'outlined' /* 'soft */}
      value={props.value} onChange={handleChange}
      placeholder={props.required ? props.placeholder ? 'required: ' + props.placeholder : 'required' : props.placeholder || '...'}
      type={(isVisible || !!props.noKey) ? 'text' : 'password'}
      error={props.isError}
      startDecorator={!props.noKey && <KeyIcon />}
      endDecorator={endDecorator}
    />

    {props.description && <FormHelperText sx={{ display: 'block' }}>{props.description}</FormHelperText>}

  </Wrapper>;
}