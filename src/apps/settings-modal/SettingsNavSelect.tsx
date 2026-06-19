import * as React from 'react';

import { Box, IconButton, Option, Select } from '@mui/joy';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';

import { getSettingsNavTopLevelGroup, SETTINGS_NAV_FLAT, SettingsNavId } from './settings.nav';


const _styles = {
  box: {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    mb: 2,
  },
  select: {
    flex: 1,
  },
  childOption: {
    pl: 4,
  },
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


  let backArrowId: SettingsNavId | undefined;
  const currentItem = SETTINGS_NAV_FLAT.find(item => item.id === props.value);
  if (currentItem?.path) {
    const parentId = getSettingsNavTopLevelGroup(currentItem.id);
    if (parentId && parentId !== currentItem.id)
      backArrowId = parentId;
  }

  return (
    <Box sx={_styles.box}>

      {backArrowId && (
        <IconButton
          // color='primary'
          onClick={() => onSelect(backArrowId)}
        >
          <KeyboardArrowLeftIcon />
        </IconButton>
      )}

      <Select<SettingsNavId>
        value={props.value}
        onChange={handleChange}
        // color='primary'
        indicator={<KeyboardArrowDownIcon />}
        slotProps={{ button: { sx: { fontWeight: 'lg' } }, listbox: { sx: { boxShadow: 'xl' } } }}
        sx={_styles.select}
      >
        {SETTINGS_NAV_FLAT.map((item) => (
          <Option key={item.id} value={item.id} sx={item.isChild ? _styles.childOption : undefined} label={item.path || item.label}>
            {/*<ListItemDecorator>{item.icon}</ListItemDecorator>*/}
            {item.label}
          </Option>
        ))}
      </Select>

    </Box>
  );
}
