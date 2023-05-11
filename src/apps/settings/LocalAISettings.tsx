import * as React from 'react';
import { FormControl, FormLabel, Input } from '@mui/joy';
import { useSettingsStore } from '@/common/state/store-settings';

export function LocalAISettings() {
  const { localAIUrl, setLocalAIUrl } = useSettingsStore(state => ({
    localAIUrl: state.localAIUrl,
    setLocalAIUrl: state.setLocalAIUrl,
  }));

  const handleLocalAIUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setLocalAIUrl(event.target.value);
  };

  return (
    <FormControl>
      <FormLabel>LocalAI API Url</FormLabel>
      <Input
        value={localAIUrl}
        onChange={handleLocalAIUrlChange}
        placeholder="http://localhost:8080"
      />

    </FormControl>
  );
}
