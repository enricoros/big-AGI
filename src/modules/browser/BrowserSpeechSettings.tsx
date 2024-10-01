import * as React from 'react';

import { Option, FormControl, Select, Switch, Typography, Box, IconButton } from '@mui/joy';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import CloseRounded from '@mui/icons-material/CloseRounded';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { useBrowserSpeechVoiceDropdown } from './useBrowserSpeechVoiceDropdown';
import { useLanguageCodeForFilter } from './store-module-browser';

// languages are defined as a JSON file
import { languages } from './web-speech-recommended-voices/json/localizedNames/full/en.json';


export function BrowserSpeechSettings() {

  // state
  const [testUtterance, setTestUtterance] = React.useState<string | null>(null);
  const [voiceNameFilters, setVoiceNameFilters] = React.useState<string[] | null>(null);

  // external state
  const [languageCode, setLanguageCode] = useLanguageCodeForFilter();

  React.useEffect(() => {
    if (languageCode) {
      try{
        import(`./web-speech-recommended-voices/json/${languageCode}.json`).then((data) => {
          let voices = data.voices;
          voices = voices.filter((voice:any) => {
            return voice.quality.includes('high') || voice.quality.includes('veryHigh');
          });
          let voiceNameFilters = voices.map((voice:any) => voice.name);
          setTestUtterance(data.testUtterance); // TODO: replace {name} with local name
          setVoiceNameFilters(voiceNameFilters);
        });
      } catch (e) {
        console.log('Error loading recommended voices: ', e);
        setTestUtterance(null); // TODO: replace {name} with local name
        setVoiceNameFilters([]);
      }
    } else {
      setVoiceNameFilters(null);
      setTestUtterance(null);
    }
  }, [languageCode]);

  const { voicesDropdown } = useBrowserSpeechVoiceDropdown(true, { voiceNameFilters, testUtterance });

  const languageOptions = React.useMemo(() => {
    return Object.entries(languages).map(([languagesCode, languagesName]) => (
      <Option key={languagesCode} value={languagesCode}>
        {`${languagesName}`}
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
