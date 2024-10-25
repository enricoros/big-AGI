import * as React from 'react';

import { Option, FormControl, Select, Switch, Typography, Box, IconButton } from '@mui/joy';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import CloseRounded from '@mui/icons-material/CloseRounded';
import { addSnackbar } from '~/common/components/snackbar/useSnackbarsStore';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { useBrowserSpeechVoiceDropdown } from './useWebspeechVoiceDropdown';
import { useLanguageCodeForFilter } from './store-module-webspeech';

// languages are defined as a JSON file
import languages from './preSelect/Languages.json';

export function WebspeechSettings() {
  // state
  const [testUtterance, setTestUtterance] = React.useState<string | null>(null);
  const [voiceNameFilters, setVoiceNameFilters] = React.useState<string[] | null>(null);

  // external state
  const [languageCode, setLanguageCode] = useLanguageCodeForFilter();

  React.useEffect(() => {
    if (languageCode) {
      const fetchFunction = async () => {
        let res = await fetch(`https://raw.githubusercontent.com/HadrienGardeur/web-speech-recommended-voices/refs/heads/main/json/${languageCode}.json`);
        let data = await res.json();
        let voices = data.voices;
        voices = voices.filter((voice: any) => {
          return voice.quality.includes('high') || voice.quality.includes('veryHigh');
        });
        let voiceNameFilters = voices.map((voice: any) => voice.name);
        setTestUtterance(data.testUtterance);
        setVoiceNameFilters(voiceNameFilters);
      };
      fetchFunction().catch((err) => {
        console.log('Error getting voice list: ', err);
        addSnackbar({ key: 'browser-speech-synthesis', message: 'Error getting voice list', type: 'issue' });
        setTestUtterance(null);
        setVoiceNameFilters(null);
        setLanguageCode('');
      });
    } else {
      setTestUtterance(null);
      setVoiceNameFilters(null);
    }
  }, [languageCode, setLanguageCode]);

  const { voicesDropdown } = useBrowserSpeechVoiceDropdown(true, { voiceNameFilters, testUtterance });

  const languageOptions = React.useMemo(() => {
    return Object.entries(languages)
      .sort((a, b) => {
        return a[1].localeCompare(b[1]);
      })
      .map(([languageCode, languageName]) => (
        <Option key={languageCode} value={languageCode}>
          {`${languageName}`}
        </Option>
      ));
  }, []);

  function handleLanguageChanged(_event: any, newValue: string | null) {
    setLanguageCode(newValue || '');
  }

  return (
    <>
      <FormControl orientation="horizontal" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <FormLabelStart title="pre-select" description="pre-selected high quality voices" tooltip="" />
        <Select
          value={languageCode}
          onChange={handleLanguageChanged}
          indicator={<KeyboardArrowDownIcon />}
          placeholder="Choose one…"
          slotProps={{
            root: { sx: { minWidth: 200 } },
            indicator: { sx: { opacity: 0.5 } },
          }}
          {...(languageCode && {
            // display the button and remove select indicator
            // when user has selected a value
            endDecorator: (
              <IconButton
                size="sm"
                variant="plain"
                color="neutral"
                onMouseDown={(event) => {
                  // don't open the popup when clicking on this button
                  event.stopPropagation();
                }}
                onClick={() => {
                  setLanguageCode('');
                }}
              >
                <CloseRounded />
              </IconButton>
            ),
            indicator: null,
          })}
        >
          {languageOptions}
        </Select>
      </FormControl>
      <FormControl orientation="horizontal" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <FormLabelStart title="Assistant Voice" />
        {voicesDropdown}
      </FormControl>
    </>
  );
}
