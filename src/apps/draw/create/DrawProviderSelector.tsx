import * as React from 'react';

import type { VariantProp } from '@mui/joy/styles/types';
import { FormControl, FormLabel, ListItemDecorator, Option, Select } from '@mui/joy';
import FormatPaintTwoToneIcon from '@mui/icons-material/FormatPaintTwoTone';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

import type { TextToImageProvider } from '~/common/components/useCapabilities';
import { OpenAIIcon } from '~/common/components/icons/vendors/OpenAIIcon';
import { hideOnMobile } from '~/common/app.theme';
import { optimaSelectSlotProps } from '~/common/layout/optima/bar/OptimaBarDropdown';


export function DrawProviderSelector(props: {
  title?: string,
  variant: VariantProp,
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
        value: provider.providerId,
        configured: provider.configured,
        Icon: provider.vendor === 'openai' ? OpenAIIcon : FormatPaintTwoToneIcon,
      });
    });
    return options;
  }, [props.providers]);


  return (
    <FormControl orientation='horizontal' sx={{ justifyContent: 'start', alignItems: 'center' }}>

      {!!props.title && (
        <FormLabel sx={hideOnMobile}>
          {props.title}
        </FormLabel>
      )}

      <Select
        variant={props.variant}
        value={props.activeProviderId}
        onChange={(_event, value) => value && props.setActiveProviderId(value)}
        placeholder='Select a service'
        indicator={<KeyboardArrowDownIcon />}
        slotProps={{
          ...optimaSelectSlotProps,
          button: {
            sx: {
              // overwrite all properties of the button (we don't need 'agi-ellipsize', max-width, etc.)
              minWidth: '7.5rem',
            },
          },
        }}
        // startDecorator={<FormatPaintTwoToneIcon sx={{ display: { xs: 'none', sm: 'inherit' } }} />}
        // sx={{ minWidth: '12rem' /* doesn't work anymore with SlotProps */ }}
      >
        {providerOptions.map(option => (
          <Option key={option.value} value={option.value} disabled={!option.configured} label={option.label}>
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