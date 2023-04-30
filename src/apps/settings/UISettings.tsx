import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, FormControl, FormHelperText, FormLabel, Option, Radio, RadioGroup, Select, Stack, Switch, Tooltip } from '@mui/joy';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import WidthNormalIcon from '@mui/icons-material/WidthNormal';
import WidthWideIcon from '@mui/icons-material/WidthWide';

import { Section } from '@/common/components/Section';
import { hideOnMobile, settingsGap } from '@/common/theme';
import { useSettingsStore } from '@/common/state/store-settings';

// languages is defined as a JSON file
import languages from './languages.json' assert { type: 'json' };


function LanguageSelect() {
  // external state
  const { preferredLanguage, setPreferredLanguage } = useSettingsStore(state => ({ preferredLanguage: state.preferredLanguage, setPreferredLanguage: state.setPreferredLanguage }), shallow);

  const handleLanguageChanged = (event: any, newValue: string | null) => {
    if (!newValue) return;
    setPreferredLanguage(newValue as string);

    // NOTE: disabled, to make sure the code can be adapted at runtime - will re-enable to trigger translations, if not dynamically switchable
    //if (typeof window !== 'undefined')
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
          <Option key={code} value={code}>
            {`${language} (${country})`}
          </Option>
        ))
      )), []);

  return (
    <Select value={preferredLanguage} onChange={handleLanguageChanged}
            indicator={<KeyboardArrowDownIcon />}
            slotProps={{
              root: { sx: { minWidth: 200 } },
              indicator: { sx: { opacity: 0.5 } },
            }}>
      {languageOptions}
    </Select>
  );
}


export function UISettings() {
  // external state
  const {
    centerMode, setCenterMode,
    renderMarkdown, setRenderMarkdown,
    showPurposeFinder, setShowPurposeFinder,
    zenMode, setZenMode,
  } = useSettingsStore(state => ({
    centerMode: state.centerMode, setCenterMode: state.setCenterMode,
    renderMarkdown: state.renderMarkdown, setRenderMarkdown: state.setRenderMarkdown,
    showPurposeFinder: state.showPurposeFinder, setShowPurposeFinder: state.setShowPurposeFinder,
    zenMode: state.zenMode, setZenMode: state.setZenMode,
  }), shallow);

  const handleCenterModeChange = (event: React.ChangeEvent<HTMLInputElement>) => setCenterMode(event.target.value as 'narrow' | 'wide' | 'full' || 'wide');

  const handleZenModeChange = (event: React.ChangeEvent<HTMLInputElement>) => setZenMode(event.target.value as 'clean' | 'cleaner');

  const handleRenderMarkdownChange = (event: React.ChangeEvent<HTMLInputElement>) => setRenderMarkdown(event.target.checked);

  const handleShowSearchBarChange = (event: React.ChangeEvent<HTMLInputElement>) => setShowPurposeFinder(event.target.checked);

  return (
    <Section>
      <Stack direction='column' sx={{ gap: settingsGap }}>

        <FormControl orientation='horizontal' sx={{ ...hideOnMobile, alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <FormLabel>Centering</FormLabel>
            <FormHelperText>{centerMode === 'full' ? 'Full screen' : centerMode === 'narrow' ? 'Narrow' : 'Wide'} chat</FormHelperText>
          </Box>
          <RadioGroup orientation='horizontal' value={centerMode} onChange={handleCenterModeChange}>
            <Radio value='narrow' label={<WidthNormalIcon sx={{ width: 25, height: 24, mt: -0.25 }} />} />
            <Radio value='wide' label={<WidthWideIcon sx={{ width: 25, height: 24, mt: -0.25 }} />} />
            <Radio value='full' label='Full' />
          </RadioGroup>
        </FormControl>

        <FormControl orientation='horizontal' sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <FormLabel>Appearance</FormLabel>
            <FormHelperText>{zenMode === 'clean' ? 'Show senders' : 'Hide senders and menus'}</FormHelperText>
          </Box>
          <RadioGroup orientation='horizontal' value={zenMode} onChange={handleZenModeChange}>
            {/*<Radio value='clean' label={<Face6Icon sx={{ width: 24, height: 24, mt: -0.25 }} />} />*/}
            <Radio value='clean' label='Clean' />
            <Radio value='cleaner' label='Empty' />
          </RadioGroup>
        </FormControl>

        <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
          <Box>
            <FormLabel>Markdown</FormLabel>
            <FormHelperText>{renderMarkdown ? 'Render markdown' : 'Text only'}</FormHelperText>
          </Box>
          <Switch checked={renderMarkdown} onChange={handleRenderMarkdownChange}
                  endDecorator={renderMarkdown ? 'On' : 'Off'}
                  slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />
        </FormControl>

        <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
          <Box>
            <FormLabel>Purpose finder</FormLabel>
            <FormHelperText>{showPurposeFinder ? 'Show search bar' : 'Hide search bar'}</FormHelperText>
          </Box>
          <Switch checked={showPurposeFinder} onChange={handleShowSearchBarChange}
                  endDecorator={showPurposeFinder ? 'On' : 'Off'}
                  slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />
        </FormControl>

        <FormControl orientation='horizontal' sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Tooltip title='Currently for Microphone input and Voice output. Microphone support varies by browser (iPhone/Safari lacks speech input). We will use the ElevenLabs MultiLanguage model if a language other than English is selected.'>
              <FormLabel>
                Language <InfoOutlinedIcon sx={{ mx: 0.5 }} />
              </FormLabel>
            </Tooltip>
            <FormHelperText>
              Speech input
            </FormHelperText>
          </Box>
          <LanguageSelect />
        </FormControl>

      </Stack>
    </Section>
  );
}