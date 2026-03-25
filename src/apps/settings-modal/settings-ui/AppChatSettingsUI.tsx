import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import { Box, Button, FormControl, Switch } from '@mui/joy';
import BuildCircleIcon from '@mui/icons-material/BuildCircle';
import WidthNormalIcon from '@mui/icons-material/WidthNormal';
import WidthWideIcon from '@mui/icons-material/WidthWide';

import { showTestSystemNotification } from '~/common/chat-overlay/ConversationHandler';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { FormRadioControl } from '~/common/components/forms/FormRadioControl';
import { addSnackbar } from '~/common/components/snackbar/useSnackbarsStore';
import { useUIPreferencesStore } from '~/common/stores/store-ui';
import { isPwa } from '~/common/util/pwaUtils';
import { optimaOpenModels } from '~/common/layout/optima/useOptima';
import { useIsMobile } from '~/common/components/useMatchMedia';
import { useModelsZeroState } from '~/common/stores/llms/hooks/useModelsZeroState';
import { useChatShowCallButton, useChatShowCompletionNotifications } from '../../chat/store-app-chat';

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
  const [showCallButton, setShowCallButton] = useChatShowCallButton();
  const [showCompletionNotifications, setShowCompletionNotifications] = useChatShowCompletionNotifications();
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
  const handleShowCallButtonChange = (event: React.ChangeEvent<HTMLInputElement>) => setShowCallButton(event.target.checked);
  const ensureSystemNotificationPermission = React.useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') {
      addSnackbar({ key: 'completion-notifications-unsupported', message: 'System notifications are not supported here.', type: 'issue' });
      return false;
    }

    if (Notification.permission === 'granted')
      return true;

    const permission = await Notification.requestPermission();
    if (permission === 'granted')
      return true;

    addSnackbar({ key: 'completion-notifications-denied', message: 'System notifications were not allowed.', type: 'issue' });
    return false;
  }, []);
  const handleTestCompletionNotification = React.useCallback(async () => {
    const permissionGranted = await ensureSystemNotificationPermission();
    if (!permissionGranted)
      return;

    if (!showTestSystemNotification())
      addSnackbar({ key: 'test-completion-notification-failed', message: 'System notification could not be shown.', type: 'issue' });
  }, [ensureSystemNotificationPermission]);
  const handleShowCompletionNotificationsChange = React.useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const enabled = event.target.checked;
    if (!enabled) {
      setShowCompletionNotifications(false);
      return;
    }

    const permissionGranted = await ensureSystemNotificationPermission();
    setShowCompletionNotifications(permissionGranted);
  }, [ensureSystemNotificationPermission, setShowCompletionNotifications]);

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

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
      <FormLabelStart title='Call Button'
                      description={showCallButton ? 'Show call action' : 'Hidden'} />
      <Switch checked={showCallButton} onChange={handleShowCallButtonChange}
              endDecorator={showCallButton ? 'On' : 'Off'}
              slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />
    </FormControl>

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
      <FormLabelStart title='Completion Notifications'
                      description={showCompletionNotifications ? 'System notifications on reply completion' : 'Muted'} />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Button size='sm' variant='soft' color='neutral' onClick={handleTestCompletionNotification}>
          Test notification
        </Button>
        <Switch checked={showCompletionNotifications} onChange={handleShowCompletionNotificationsChange}
                endDecorator={showCompletionNotifications ? 'On' : 'Off'}
                slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />
      </Box>
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
