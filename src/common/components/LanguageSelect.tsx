import * as React from 'react';

import { Option, optionClasses, Select, SelectSlotsAndSlotProps } from '@mui/joy';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

import { useUIPreferencesStore } from '~/common/stores/store-ui';


// languages are defined as a JSON file
import languages from './Languages.json';


// copied from useLLMSelect.tsx - inspired by optimaSelectSlotProps.listbox
const _selectSlotProps: SelectSlotsAndSlotProps<false>['slotProps'] = {
  root: { sx: { minWidth: 200 } },
  listbox: {
    sx: {
      boxShadow: 'xl',
      [`& .${optionClasses.root}`]: {
        maxWidth: 'min(640px, calc(100dvw - 0.25rem))',
      },
    },
  } as const,
} as const;


export function LanguageSelect() {
  // external state

  const preferredLanguage = useUIPreferencesStore(state => state.preferredLanguage);

  const handleLanguageChanged = (_event: any, newValue: string | null) => {
    if (!newValue) return;
    useUIPreferencesStore.getState().setPreferredLanguage(newValue as string);

    // NOTE: disabled, to make sure the code can be adapted at runtime - will re-enable to trigger translations, if not dynamically switchable
    //if (isBrowser)
    //  window.location.reload();
  };

  const languageOptions = React.useMemo(() => Object.entries(languages).map(([language, localesOrCode]) =>
    typeof localesOrCode === 'string'
      ? (
        <Option key={localesOrCode} value={localesOrCode}>
          {language}
        </Option>
      ) : (
        Object.entries(localesOrCode).map(([country, code]) => (
          <Option key={code} value={code} label={language}>
            {`${language} (${country})`}
          </Option>
        ))
      )), []);

  return (
    <Select
      value={preferredLanguage}
      onChange={handleLanguageChanged}
      indicator={<KeyboardArrowDownIcon />}
      slotProps={_selectSlotProps}
    >
      {languageOptions}
    </Select>
  );
}