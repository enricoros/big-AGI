import * as React from 'react';

import { Chip, SvgIconProps } from '@mui/joy';

import type { UAFormFactor } from '~/common/util/pwaUtils';

import { PhDesktop } from './phosphor/PhDesktop';
import { PhDeviceMobile } from './phosphor/PhDeviceMobile';
import { PhDeviceTablet } from './phosphor/PhDeviceTablet';


/**
 * Device symbols: classification (see `classifyUA` in pwaUtils) -> icon components, one vocabulary
 * for every surface that renders devices (devices list, provenance stamps, future presence/park).
 * This mapping lives CLIENT-SIDE on purpose: the server only stores/serves raw device facts
 * (user_agent today, self-reported class later), so old rows stay re-classifiable forever and the
 * rendering vocabulary can evolve without schema churn.
 * NOTE: the OS axis is deliberately NOT iconified (logo glyphs rejected) - express it in text/labels.
 */

const _FORM_FACTOR_ICONS: Record<Exclude<UAFormFactor, 'unknown'>, React.ComponentType<SvgIconProps>> = {
  phone: PhDeviceMobile,
  tablet: PhDeviceTablet,
  computer: PhDesktop,
};


/** Form-factor symbol (phone, tablet, computer) - renders nothing when unknown. */
export function DeviceFormFactorIcon(props: { form: UAFormFactor } & SvgIconProps): React.JSX.Element | null {
  const { form, ...iconProps } = props;
  if (form === 'unknown') return null;
  const Icon = _FORM_FACTOR_ICONS[form];
  return <Icon {...iconProps} />;
}

/** App-form chip (Mobile App / PWA / Web), falling back to the UA-classified form factor for legacy rows without device_form. */
export function DeviceFormChip(props: { deviceForm: string | null, formFactor: UAFormFactor }) {
  if (props.deviceForm === 'app') return <Chip size='sm' color='primary'>Mobile App</Chip>;
  if (props.deviceForm === 'pwa') return <Chip size='sm' color='success'>PWA</Chip>;
  if (props.deviceForm === 'web') return <Chip size='sm' color='neutral'>Web</Chip>;
  return props.formFactor === 'phone' ? <Chip size='sm' color='primary'>Mobile</Chip>
    : props.formFactor === 'tablet' ? <Chip size='sm' color='warning'>Tablet</Chip>
      : <Chip size='sm' color='neutral'>Desktop</Chip>;
}
