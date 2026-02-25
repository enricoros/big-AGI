import * as React from 'react';

import { Autocomplete, AutocompleteOption, Box, FormControl, FormHelperText, FormLabel, Typography } from '@mui/joy';

import { Link } from '~/common/components/Link';


interface BedrockRegion {
  id: string;
  label: string;
}

// Bedrock-supported regions enabled by default (no opt-in required).
// Users can type any region (freeSolo) for opt-in regions.
// Sources: https://docs.aws.amazon.com/bedrock/latest/userguide/models-regions.html
//          https://docs.aws.amazon.com/global-infrastructure/latest/regions/aws-regions.html#regions-opt-in-status
const BEDROCK_REGIONS: BedrockRegion[] = [
  // US
  { id: 'us-east-1', label: 'N. Virginia' },
  { id: 'us-east-2', label: 'Ohio' },
  { id: 'us-west-1', label: 'N. California' },
  { id: 'us-west-2', label: 'Oregon' },
  // Canada
  { id: 'ca-central-1', label: 'Canada' },
  // South America
  { id: 'sa-east-1', label: 'São Paulo' },
  // Europe
  { id: 'eu-central-1', label: 'Frankfurt' },
  { id: 'eu-north-1', label: 'Stockholm' },
  { id: 'eu-west-1', label: 'Ireland' },
  { id: 'eu-west-2', label: 'London' },
  { id: 'eu-west-3', label: 'Paris' },
  // Asia Pacific
  { id: 'ap-northeast-1', label: 'Tokyo' },
  { id: 'ap-northeast-2', label: 'Seoul' },
  { id: 'ap-northeast-3', label: 'Osaka' },
  { id: 'ap-south-1', label: 'Mumbai' },
  { id: 'ap-southeast-1', label: 'Singapore' },
  { id: 'ap-southeast-2', label: 'Sydney' },
];

const DEFAULT_REGION = 'us-west-2';


export function BedrockRegionAutocomplete(props: {
  value: string;
  onChange: (value: string) => void;
}) {

  // local input state for freeSolo
  const [inputValue, setInputValue] = React.useState(props.value || DEFAULT_REGION);

  // sync input when value prop changes externally
  React.useEffect(() => {
    setInputValue(props.value || DEFAULT_REGION);
  }, [props.value]);

  // handlers
  const handleChange = React.useCallback((_event: unknown, newValue: string | BedrockRegion | null) => {
    if (newValue === null)
      props.onChange(DEFAULT_REGION);
    else if (typeof newValue === 'string')
      props.onChange(newValue);
    else
      props.onChange(newValue.id);
  }, [props]);

  const handleInputChange = React.useCallback((_event: unknown, newInputValue: string, reason: string) => {
    if (reason !== 'input')
      return;
    setInputValue(newInputValue);
    props.onChange(newInputValue);
  }, [props]);

  return (
    <FormControl>
      <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <FormLabel>
          AWS Region
        </FormLabel>
        <FormHelperText sx={{ display: 'block' }}>
          see <Link level='body-sm' href='https://docs.aws.amazon.com/bedrock/latest/userguide/models-regions.html' target='_blank'>regions</Link>
        </FormHelperText>
      </Box>
      <Autocomplete<BedrockRegion, false, false, true>
        freeSolo
        openOnFocus
        clearOnEscape
        placeholder='us-west-2'
        options={BEDROCK_REGIONS}
        getOptionKey={(option) => typeof option === 'string' ? option : option.id}
        getOptionLabel={(option) => typeof option === 'string' ? option : option.id}
        isOptionEqualToValue={(option, val) => option.id === (typeof val === 'string' ? val : val.id)}
        value={BEDROCK_REGIONS.find(r => r.id === props.value) ?? (props.value || null)}
        onChange={handleChange}
        inputValue={inputValue}
        onInputChange={handleInputChange}
        renderOption={(optionProps, option) => {
          const { key, ...rest } = optionProps as any;
          return (
            <AutocompleteOption key={key} {...rest}>
              <Typography level='title-sm'>{option.id}</Typography>
              <Typography level='body-xs' textColor='text.tertiary' sx={{ ml: 1 }}>{option.label}</Typography>
            </AutocompleteOption>
          );
        }}
        slotProps={{
          root: { sx: { boxShadow: 'none' } },
        }}
      />
    </FormControl>
  );
}