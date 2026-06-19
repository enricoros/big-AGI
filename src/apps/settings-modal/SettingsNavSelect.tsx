import * as React from 'react';

import { ListItemDecorator, Option, Select } from '@mui/joy';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

import type { SettingsNavId } from './settings.nav';
import { SETTINGS_NAV_FLAT } from './settings.nav';


const _styles = {
  select: {
    mb: 2,
  } as const,
  childOption: {
    pl: 3,
  } as const,
} as const;


/**
 * Mobile section selector: a single dropdown listing every nav node (sub-items indented),
 * replacing the side-by-side panes used on desktop.
 */
export function SettingsNavSelect(props: {
  value: SettingsNavId,
  onSelect: (id: SettingsNavId) => void,
}) {

  const { onSelect } = props;

  const handleChange = React.useCallback((_event: any, newValue: SettingsNavId | null) => {
    if (newValue) onSelect(newValue);
  }, [onSelect]);

  return (
    <Select<SettingsNavId>
      value={props.value}
      onChange={handleChange}
      variant='outlined'
      color='primary'
      indicator={<KeyboardArrowDownIcon />}
      slotProps={{ button: { sx: { fontWeight: 'lg' } } }}
      sx={_styles.select}
    >
      {SETTINGS_NAV_FLAT.map((item) => (
        <Option key={item.id} value={item.id} sx={item.isChild ? _styles.childOption : undefined}>
          <ListItemDecorator>{item.icon}</ListItemDecorator>
          {item.label}
        </Option>
      ))}
    </Select>
  );
}
