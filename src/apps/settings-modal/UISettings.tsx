import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { FormControl, Radio, RadioGroup, Stack, Switch } from '@mui/joy';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ScienceIcon from '@mui/icons-material/Science';
import TelegramIcon from '@mui/icons-material/Telegram';
import WidthNormalIcon from '@mui/icons-material/WidthNormal';
import WidthWideIcon from '@mui/icons-material/WidthWide';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { hideOnMobile, settingsGap } from '~/common/app.theme';
import { isPwa } from '~/common/util/pwaUtils';
import { navigateToLabs } from '~/common/app.routes';
import { useUIPreferencesStore } from '~/common/state/store-ui';


// configuration
const SHOW_PURPOSE_FINDER = false;


export function UISettings() {
  // external state
  const {
    centerMode, setCenterMode,
    doubleClickToEdit, setDoubleClickToEdit,
    enterIsNewline, setEnterIsNewline,
    experimentalLabs, setExperimentalLabs,
    renderMarkdown, setRenderMarkdown,
    showPurposeFinder, setShowPurposeFinder,
    zenMode, setZenMode,
  } = useUIPreferencesStore(state => ({
    centerMode: state.centerMode, setCenterMode: state.setCenterMode,
    doubleClickToEdit: state.doubleClickToEdit, setDoubleClickToEdit: state.setDoubleClickToEdit,
    enterIsNewline: state.enterIsNewline, setEnterIsNewline: state.setEnterIsNewline,
    experimentalLabs: state.experimentalLabs, setExperimentalLabs: state.setExperimentalLabs,
    renderMarkdown: state.renderMarkdown, setRenderMarkdown: state.setRenderMarkdown,
    showPurposeFinder: state.showPurposeFinder, setShowPurposeFinder: state.setShowPurposeFinder,
    zenMode: state.zenMode, setZenMode: state.setZenMode,
  }), shallow);

  const handleCenterModeChange = (event: React.ChangeEvent<HTMLInputElement>) => setCenterMode(event.target.value as 'narrow' | 'wide' | 'full' || 'wide');

  const handleEnterIsNewlineChange = (event: React.ChangeEvent<HTMLInputElement>) => setEnterIsNewline(!event.target.checked);

  const handleDoubleClickToEditChange = (event: React.ChangeEvent<HTMLInputElement>) => setDoubleClickToEdit(event.target.checked);

  const handleZenModeChange = (event: React.ChangeEvent<HTMLInputElement>) => setZenMode(event.target.value as 'clean' | 'cleaner');

  const handleRenderMarkdownChange = (event: React.ChangeEvent<HTMLInputElement>) => setRenderMarkdown(event.target.checked);

  const handleExperimentalLabsChange = (event: React.ChangeEvent<HTMLInputElement>) => setExperimentalLabs(event.target.checked);

  const handleShowSearchBarChange = (event: React.ChangeEvent<HTMLInputElement>) => setShowPurposeFinder(event.target.checked);

  return (

    <Stack direction='column' sx={{ gap: settingsGap }}>

      {!isPwa() && <FormControl orientation='horizontal' sx={{ ...hideOnMobile, alignItems: 'center', justifyContent: 'space-between' }}>
        <FormLabelStart title='Centering'
                        description={centerMode === 'full' ? 'Full screen chat' : centerMode === 'narrow' ? 'Narrow chat' : 'Wide'} />
        <RadioGroup orientation='horizontal' value={centerMode} onChange={handleCenterModeChange}>
          <Radio value='narrow' label={<WidthNormalIcon sx={{ width: 25, height: 24, mt: -0.25 }} />} />
          <Radio value='wide' label={<WidthWideIcon sx={{ width: 25, height: 24, mt: -0.25 }} />} />
          <Radio value='full' label='Full' />
        </RadioGroup>
      </FormControl>}

      <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
        <FormLabelStart title='Enter to send'
                        description={enterIsNewline ? 'New line' : <>Sends message<TelegramIcon /></>} />
        <Switch checked={!enterIsNewline} onChange={handleEnterIsNewlineChange}
                endDecorator={enterIsNewline ? 'Off' : 'On'}
                slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />
      </FormControl>

      <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
        <FormLabelStart title='Double click to edit'
                        description={doubleClickToEdit ? 'Double click' : 'Three dots'} />
        <Switch checked={doubleClickToEdit} onChange={handleDoubleClickToEditChange}
                endDecorator={doubleClickToEdit ? 'On' : 'Off'}
                slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />
      </FormControl>

      <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
        <FormLabelStart title='Markdown'
                        description={renderMarkdown ? 'Render markdown' : 'As text'} />
        <Switch checked={renderMarkdown} onChange={handleRenderMarkdownChange}
                endDecorator={renderMarkdown ? 'On' : 'Off'}
                slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />
      </FormControl>

      {SHOW_PURPOSE_FINDER && <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
        <FormLabelStart title='Purpose finder'
                        description={showPurposeFinder ? 'Show search bar' : 'Hide search bar'} />
        <Switch checked={showPurposeFinder} onChange={handleShowSearchBarChange}
                endDecorator={showPurposeFinder ? 'On' : 'Off'}
                slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />
      </FormControl>}

      <FormControl orientation='horizontal' sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <FormLabelStart title='Appearance'
                        description={zenMode === 'clean' ? 'Show senders' : 'Minimal UI'} />
        <RadioGroup orientation='horizontal' value={zenMode} onChange={handleZenModeChange}>
          {/*<Radio value='clean' label={<Face6Icon sx={{ width: 24, height: 24, mt: -0.25 }} />} />*/}
          <Radio value='clean' label='Clean' />
          <Radio value='cleaner' label='Zen' />
        </RadioGroup>
      </FormControl>

      <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
        <FormLabelStart title={<>Experiments <InfoOutlinedIcon sx={{ mx: 0.5 }} /></>}
                        description={experimentalLabs ? <>Enabled <ScienceIcon /></> : 'Disabled'}
                        onClick={navigateToLabs} />
        <Switch checked={experimentalLabs} onChange={handleExperimentalLabsChange}
                endDecorator={experimentalLabs ? 'On' : 'Off'}
                slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />
      </FormControl>

    </Stack>

  );
}