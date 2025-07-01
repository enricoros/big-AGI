import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import { Button, FormControl, Switch } from '@mui/joy';
import BuildCircleIcon from '@mui/icons-material/BuildCircle';
import WidthNormalIcon from '@mui/icons-material/WidthNormal';
import WidthWideIcon from '@mui/icons-material/WidthWide';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { FormRadioControl } from '~/common/components/forms/FormRadioControl';
import { useUIPreferencesStore } from '~/common/stores/store-ui';
import { isPwa } from '~/common/util/pwaUtils';
import { optimaOpenModels } from '~/common/layout/optima/useOptima';
import { useIsMobile } from '~/common/components/useMatchMedia';
import { useModelsZeroState } from '~/common/stores/llms/hooks/useModelsZeroState';

import { SettingUIComplexity } from './SettingUIComplexity';
import { SettingUIComposerQuickButton } from './SettingUIComposerQuickButton';
import { SettingUIContentScaling } from './SettingUIContentScaling';


// configuration
const SHOW_MARKDOWN_DISABLE_SETTING = false;
const SHOW_PURPOSE_FINDER = false;


const OptionsPageSize = [
  { value: 'narrow', label: <WidthNormalIcon sx={{ width: 25, height: 24, mt: -0.25 }} /> },
  { value: 'wide', label: <WidthWideIcon sx={{ width: 25, height: 24, mt: -0.25 }} /> },
  { value: 'full', label: 'Full' },
] as const;


function ModelsSetupButton(props: { isMissingModels?: boolean }) {
  return <Button
    // variant='soft' color='success'
    color={props.isMissingModels ? 'danger' : undefined}
    onClick={optimaOpenModels}
    startDecorator={<BuildCircleIcon />}
    sx={{
      '--Icon-fontSize': 'var(--joy-fontSize-xl2)',
      minWidth: 150,
      boxShadow: props.isMissingModels ? 'lg' : undefined,
    }}
  >
    {/*Admin Models*/}
    AI Models
  </Button>;
}


export function AppChatSettingsUI() {

  // external state
  const isMobile = useIsMobile();
  const isMissingModels = useModelsZeroState();
  const {
    centerMode, setCenterMode,
    disableMarkdown, setDisableMarkdown,
    doubleClickToEdit, setDoubleClickToEdit,
    enterIsNewline, setEnterIsNewline,
    showPersonaFinder, setShowPersonaFinder,
  } = useUIPreferencesStore(useShallow(state => ({
    centerMode: state.centerMode, setCenterMode: state.setCenterMode,
    disableMarkdown: state.disableMarkdown, setDisableMarkdown: state.setDisableMarkdown,
    doubleClickToEdit: state.doubleClickToEdit, setDoubleClickToEdit: state.setDoubleClickToEdit,
    enterIsNewline: state.enterIsNewline, setEnterIsNewline: state.setEnterIsNewline,
    showPersonaFinder: state.showPersonaFinder, setShowPersonaFinder: state.setShowPersonaFinder,
  })));

  const handleEnterIsNewlineChange = (event: React.ChangeEvent<HTMLInputElement>) => setEnterIsNewline(!event.target.checked);

  const handleDoubleClickToEditChange = (event: React.ChangeEvent<HTMLInputElement>) => setDoubleClickToEdit(event.target.checked);

  const handleDisableMarkdown = (event: React.ChangeEvent<HTMLInputElement>) => setDisableMarkdown(event.target.checked);

  const handleShowSearchBarChange = (event: React.ChangeEvent<HTMLInputElement>) => setShowPersonaFinder(event.target.checked);

  return <>

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title='AI Models'
                      description='Configure' />
      <ModelsSetupButton isMissingModels={isMissingModels} />
    </FormControl>

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
      <FormLabelStart title='Enter sends ⏎'
                      description={enterIsNewline ? 'New line' : 'Sends message'} />
      <Switch checked={!enterIsNewline} onChange={handleEnterIsNewlineChange}
              endDecorator={enterIsNewline ? 'Off' : 'On'}
              slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />
    </FormControl>

    {SHOW_MARKDOWN_DISABLE_SETTING && (
      <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
        <FormLabelStart title='Disable Markdown'
                        description={disableMarkdown ? 'As text' : 'Render markdown'} />
        <Switch checked={disableMarkdown} onChange={handleDisableMarkdown}
                endDecorator={disableMarkdown ? 'On' : 'Off'}
                slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />
      </FormControl>
    )}

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
      <FormLabelStart title={isMobile ? 'Edit Mode' : 'Easy Edit'}
                      description={doubleClickToEdit ? (isMobile ? 'Double tap' : 'Double click') : (isMobile ? 'Menu' : 'Shift + double-click')} />
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

    <SettingUIContentScaling />

    {!isPwa() && !isMobile && (
      <FormRadioControl
        title='Page Size'
        description={centerMode === 'full' ? 'Full screen chat' : centerMode === 'narrow' ? 'Narrow chat' : 'Wide'}
        options={OptionsPageSize}
        value={centerMode} onChange={setCenterMode}
      />
    )}

    <SettingUIComplexity />

    {isMobile && <SettingUIComposerQuickButton />}

  </>;
}
