import * as React from 'react';

import { FormControl, FormHelperText, FormLabel, IconButton, Input } from '@mui/joy';
import KeyIcon from '@mui/icons-material/Key';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';


export function FormInputKey(props: {
  label?: string, description?: string | React.JSX.Element,
  value: string, onChange: (value: string) => void,
  placeholder?: string, isVisible?: boolean,
  required: boolean, isError?: boolean,
  noFormControl?: boolean,
}) {

  // internal state is only whether the text is visible or not - the actual value is stored in the parent
  const [isVisible, setIsVisible] = React.useState(!!props.isVisible);

  const handleChange = (e: React.ChangeEvent) => props.onChange((e.target as HTMLInputElement).value);

  const endDecorator = React.useMemo(() => !!props.value && (
    <IconButton variant='plain' color='neutral' onClick={() => setIsVisible(!isVisible)}>
      {isVisible ? <VisibilityIcon /> : <VisibilityOffIcon />}
    </IconButton>
  ), [props.value, isVisible]);

  const Wrapper = props.noFormControl ? React.Fragment : FormControl;

  return <Wrapper>

    {!!props.label && <FormLabel>{props.label}</FormLabel>}

    <Input
      variant={props.required ? 'outlined' : 'outlined' /* 'soft */}
      value={props.value} onChange={handleChange}
      placeholder={props.required ? props.placeholder ? 'required: ' + props.placeholder : 'required' : props.placeholder || '...'}
      type={isVisible ? 'text' : 'password'}
      error={props.isError}
      startDecorator={<KeyIcon />}
      endDecorator={endDecorator}
    />

    {props.description && <FormHelperText sx={{ display: 'block' }}>{props.description}</FormHelperText>}

  </Wrapper>;
}