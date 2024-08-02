import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import { Button, FormControl, Switch } from '@mui/joy';
import BuildCircleIcon from '@mui/icons-material/BuildCircle';
import WidthNormalIcon from '@mui/icons-material/WidthNormal';
import WidthWideIcon from '@mui/icons-material/WidthWide';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { FormRadioControl } from '~/common/components/forms/FormRadioControl';
import { useUIPreferencesStore } from '~/common/state/store-ui';
import { isPwa } from '~/common/util/pwaUtils';
import { optimaOpenModels } from '~/common/layout/optima/useOptima';
import { useIsMobile } from '~/common/components/useMatchMedia';

import { SettingUIComplexity } from './SettingUIComplexity';
import { SettingUIContentScaling } from './SettingUIContentScaling';


// configuration
const SHOW_PURPOSE_FINDER = false;

function ModelsSetupButton() {
  return <Button
    // variant='soft' color='success'
    onClick={optimaOpenModels}
    startDecorator={<BuildCircleIcon />}
    sx={{
      '--Icon-fontSize': 'var(--joy-fontSize-xl2)',
    }}
  >
    Models
  </Button>;
}


export function AppChatSettingsUI() {

  // external state
  const isMobile = useIsMobile();
  const {
    centerMode, setCenterMode,
    doubleClickToEdit, setDoubleClickToEdit,
    enterIsNewline, setEnterIsNewline,
    renderMarkdown, setRenderMarkdown,
    showPersonaFinder, setShowPersonaFinder,
  } = useUIPreferencesStore(useShallow(state => ({
    centerMode: state.centerMode, setCenterMode: state.setCenterMode,
    doubleClickToEdit: state.doubleClickToEdit, setDoubleClickToEdit: state.setDoubleClickToEdit,
    enterIsNewline: state.enterIsNewline, setEnterIsNewline: state.setEnterIsNewline,
    renderMarkdown: state.renderMarkdown, setRenderMarkdown: state.setRenderMarkdown,
    showPersonaFinder: state.showPersonaFinder, setShowPersonaFinder: state.setShowPersonaFinder,
  })));

  const handleEnterIsNewlineChange = (event: React.ChangeEvent<HTMLInputElement>) => setEnterIsNewline(!event.target.checked);

  const handleDoubleClickToEditChange = (event: React.ChangeEvent<HTMLInputElement>) => setDoubleClickToEdit(event.target.checked);

  const handleRenderMarkdownChange = (event: React.ChangeEvent<HTMLInputElement>) => setRenderMarkdown(event.target.checked);

  const handleShowSearchBarChange = (event: React.ChangeEvent<HTMLInputElement>) => setShowPersonaFinder(event.target.checked);

  return <>

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title='AI Models'
                      description='Setup' />
      <ModelsSetupButton />
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
                      description={showPersonaFinder ? 'Show search bar' : 'Hide search bar'} />
      <Switch checked={showPersonaFinder} onChange={handleShowSearchBarChange}
              endDecorator={showPersonaFinder ? 'On' : 'Off'}
              slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />
    </FormControl>}

    <SettingUIComplexity />

    <SettingUIContentScaling />

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
