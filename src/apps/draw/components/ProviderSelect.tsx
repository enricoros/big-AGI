import * as React from 'react';

import { FormControl, FormLabel, ListItemDecorator, Option, Select } from '@mui/joy';
import FormatPaintTwoToneIcon from '@mui/icons-material/FormatPaintTwoTone';

import type { TextToImageProvider } from '~/common/components/useCapabilities';
import { OpenAIIcon } from '~/common/components/icons/vendors/OpenAIIcon';
import { hideOnMobile } from '~/common/app.theme';


export function ProviderSelect(props: {
  providers: TextToImageProvider[],
  activeProviderId: string | null,
  setActiveProviderId: (providerId: (string | null)) => void
}) {

  // create the options
  const providerOptions = React.useMemo(() => {
    const options: { label: string, value: string, configured: boolean, Icon?: React.FC }[] = [];
    props.providers.forEach(provider => {
      options.push({
        label: provider.label + (provider.painter !== provider.label ? ` ${provider.painter}` : ''),
        value: provider.id,
        configured: provider.configured,
        Icon: provider.vendor === 'openai' ? OpenAIIcon : FormatPaintTwoToneIcon,
      });
    });
    return options;
  }, [props.providers]);


  return (
    <FormControl orientation='horizontal' sx={{ justifyContent: 'start', alignItems: 'center' }}>

      <FormLabel sx={hideOnMobile}>
        Service:
      </FormLabel>

      <Select
        variant='outlined'
        value={props.activeProviderId}
        placeholder='Select a service'
        onChange={(_event, value) => value && props.setActiveProviderId(value)}
        // startDecorator={<FormatPaintTwoToneIcon sx={{ display: { xs: 'none', sm: 'inherit' } }} />}
        sx={{
          minWidth: '12rem',
        }}
      >
        {providerOptions.map(option => (
          <Option key={option.value} value={option.value} disabled={!option.configured}>
            <ListItemDecorator>
              {!!option.Icon && <option.Icon />}
            </ListItemDecorator>
            {option.label}
            {!option.configured && ' (not configured)'}
          </Option>
        ))}
      </Select>

    </FormControl>
  );
}