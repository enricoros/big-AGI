import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Button, FormControl, Switch } from '@mui/joy';
import BuildCircleIcon from '@mui/icons-material/BuildCircle';
import WidthNormalIcon from '@mui/icons-material/WidthNormal';
import WidthWideIcon from '@mui/icons-material/WidthWide';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { FormRadioControl } from '~/common/components/forms/FormRadioControl';
import { isPwa } from '~/common/util/pwaUtils';
import { openLayoutModelsSetup } from '~/common/layout/store-applayout';
import { useIsMobile } from '~/common/components/useMatchMedia';
import { useUIPreferencesStore } from '~/common/state/store-ui';


// configuration
const SHOW_PURPOSE_FINDER = false;


const ModelOptionsButton = () =>
  <Button
    // variant='soft' color='success'
    onClick={openLayoutModelsSetup}
    startDecorator={<BuildCircleIcon />}
    sx={{
      '--Icon-fontSize': 'var(--joy-fontSize-xl2)',
    }}
  >
    Models
  </Button>;


export function AppChatSettingsUI() {

  // external state
  const isMobile = useIsMobile();
  const {
    centerMode, setCenterMode,
    doubleClickToEdit, setDoubleClickToEdit,
    enterIsNewline, setEnterIsNewline,
    renderMarkdown, setRenderMarkdown,
    showPurposeFinder, setShowPurposeFinder,
    zenMode, setZenMode,
  } = useUIPreferencesStore(state => ({
    centerMode: state.centerMode, setCenterMode: state.setCenterMode,
    doubleClickToEdit: state.doubleClickToEdit, setDoubleClickToEdit: state.setDoubleClickToEdit,
    enterIsNewline: state.enterIsNewline, setEnterIsNewline: state.setEnterIsNewline,
    renderMarkdown: state.renderMarkdown, setRenderMarkdown: state.setRenderMarkdown,
    showPurposeFinder: state.showPurposeFinder, setShowPurposeFinder: state.setShowPurposeFinder,
    zenMode: state.zenMode, setZenMode: state.setZenMode,
  }), shallow);

  const handleEnterIsNewlineChange = (event: React.ChangeEvent<HTMLInputElement>) => setEnterIsNewline(!event.target.checked);

  const handleDoubleClickToEditChange = (event: React.ChangeEvent<HTMLInputElement>) => setDoubleClickToEdit(event.target.checked);

  const handleRenderMarkdownChange = (event: React.ChangeEvent<HTMLInputElement>) => setRenderMarkdown(event.target.checked);

  const handleShowSearchBarChange = (event: React.ChangeEvent<HTMLInputElement>) => setShowPurposeFinder(event.target.checked);

  return <>

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title='AI Models'
                      description='Setup' />
      <ModelOptionsButton />
    </FormControl>

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

    <FormRadioControl
      title='Appearance'
      description={zenMode === 'clean' ? 'Show senders' : 'Minimal UI'}
      options={[
        { label: 'Clean', value: 'clean' },
        { label: 'Zen', value: 'cleaner' },
      ]}
      value={zenMode} onChange={setZenMode} />

    {!isPwa() && !isMobile && (
      <FormRadioControl
        title='Page Size'
        description={centerMode === 'full' ? 'Full screen chat' : centerMode === 'narrow' ? 'Narrow chat' : 'Wide'}
        options={[
          { value: 'narrow', label: <WidthNormalIcon sx={{ width: 25, height: 24, mt: -0.25 }} /> },
          { value: 'wide', label: <WidthWideIcon sx={{ width: 25, height: 24, mt: -0.25 }} /> },
          { value: 'full', label: 'Full' },
        ]}
        value={centerMode} onChange={setCenterMode}
      />
    )}

  </>;
}
