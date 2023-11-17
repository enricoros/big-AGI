import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { FormControl, Radio, RadioGroup, Switch } from '@mui/joy';
import WidthNormalIcon from '@mui/icons-material/WidthNormal';
import WidthWideIcon from '@mui/icons-material/WidthWide';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { hideOnMobile } from '~/common/app.theme';
import { isPwa } from '~/common/util/pwaUtils';
import { useUIPreferencesStore } from '~/common/state/store-ui';


// configuration
const SHOW_PURPOSE_FINDER = false;


export function AppChatSettings() {
  // external state
  const {
    centerMode, setCenterMode,
    doubleClickToEdit, setDoubleClickToEdit,
    enterIsNewline, setEnterIsNewline,
    renderMarkdown, setRenderMarkdown,
    showPurposeFinder, setShowPurposeFinder,
    zenMode, setZenMode,
    autosetChatTitle, setAutoSetChatTitle,
  } = useUIPreferencesStore(state => ({
    centerMode: state.centerMode, setCenterMode: state.setCenterMode,
    doubleClickToEdit: state.doubleClickToEdit, setDoubleClickToEdit: state.setDoubleClickToEdit,
    enterIsNewline: state.enterIsNewline, setEnterIsNewline: state.setEnterIsNewline,
    renderMarkdown: state.renderMarkdown, setRenderMarkdown: state.setRenderMarkdown,
    showPurposeFinder: state.showPurposeFinder, setShowPurposeFinder: state.setShowPurposeFinder,
    zenMode: state.zenMode, setZenMode: state.setZenMode,
    autosetChatTitle: state.autoSetChatTitle, setAutoSetChatTitle: state.setAutoSetChatTitle,
  }), shallow);

  const handleCenterModeChange = (event: React.ChangeEvent<HTMLInputElement>) => setCenterMode(event.target.value as 'narrow' | 'wide' | 'full' || 'wide');

  const handleEnterIsNewlineChange = (event: React.ChangeEvent<HTMLInputElement>) => setEnterIsNewline(!event.target.checked);

  const handleDoubleClickToEditChange = (event: React.ChangeEvent<HTMLInputElement>) => setDoubleClickToEdit(event.target.checked);

  const handleZenModeChange = (event: React.ChangeEvent<HTMLInputElement>) => setZenMode(event.target.value as 'clean' | 'cleaner');

  const handleRenderMarkdownChange = (event: React.ChangeEvent<HTMLInputElement>) => setRenderMarkdown(event.target.checked);

  const handleShowSearchBarChange = (event: React.ChangeEvent<HTMLInputElement>) => setShowPurposeFinder(event.target.checked);

  const handleAutoSetChatTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => setAutoSetChatTitle(event.target.checked);

  return <>

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
      <FormLabelStart title='Enter sends ⏎'
                      description={enterIsNewline ? 'New line' : 'Sends message'} />
      <Switch checked={!enterIsNewline} onChange={handleEnterIsNewlineChange}
              endDecorator={enterIsNewline ? 'Off' : 'On'}
              slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />
    </FormControl>

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
      <FormLabelStart title='Markdown'
                      description={renderMarkdown ? 'Render markdown' : 'As text'} />
      <Switch checked={renderMarkdown} onChange={handleRenderMarkdownChange}
              endDecorator={renderMarkdown ? 'On' : 'Off'}
              slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />
    </FormControl>

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
      <FormLabelStart title='Edit mode'
                      description={doubleClickToEdit ? 'Double click' : 'Three dots'} />
      <Switch checked={doubleClickToEdit} onChange={handleDoubleClickToEditChange}
              endDecorator={doubleClickToEdit ? 'On' : 'Off'}
              slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />
    </FormControl>

    {SHOW_PURPOSE_FINDER && <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
      <FormLabelStart title='Purpose finder'
                      description={showPurposeFinder ? 'Show search bar' : 'Hide search bar'} />
      <Switch checked={showPurposeFinder} onChange={handleShowSearchBarChange}
              endDecorator={showPurposeFinder ? 'On' : 'Off'}
              slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />
    </FormControl>}

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
      <FormLabelStart title='Auto Chat Title'
                      description={autosetChatTitle ? 'LLM Titling' : 'Manual only'} />
      <Switch checked={autosetChatTitle} onChange={handleAutoSetChatTitleChange}
              endDecorator={autosetChatTitle ? 'On' : 'Off'}
              slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />
    </FormControl>

    <FormControl orientation='horizontal' sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
      <FormLabelStart title='Appearance'
                      description={zenMode === 'clean' ? 'Show senders' : 'Minimal UI'} />
      <RadioGroup orientation='horizontal' value={zenMode} onChange={handleZenModeChange}>
        {/*<Radio value='clean' label={<Face6Icon sx={{ width: 24, height: 24, mt: -0.25 }} />} />*/}
        <Radio value='clean' label='Clean' />
        <Radio value='cleaner' label='Zen' />
      </RadioGroup>
    </FormControl>

    {!isPwa() && <FormControl orientation='horizontal' sx={{ ...hideOnMobile, alignItems: 'center', justifyContent: 'space-between' }}>
      <FormLabelStart title='Page Size'
                      description={centerMode === 'full' ? 'Full screen chat' : centerMode === 'narrow' ? 'Narrow chat' : 'Wide'} />
      <RadioGroup orientation='horizontal' value={centerMode} onChange={handleCenterModeChange}>
        <Radio value='narrow' label={<WidthNormalIcon sx={{ width: 25, height: 24, mt: -0.25 }} />} />
        <Radio value='wide' label={<WidthWideIcon sx={{ width: 25, height: 24, mt: -0.25 }} />} />
        <Radio value='full' label='Full' />
      </RadioGroup>
    </FormControl>}

  </>;
}
