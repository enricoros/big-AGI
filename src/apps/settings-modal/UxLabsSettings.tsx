import * as React from 'react';

import { FormControl, Switch, Typography } from '@mui/joy';
import AddAPhotoIcon from '@mui/icons-material/AddAPhoto';
import CodeIcon from '@mui/icons-material/Code';
import EditNoteIcon from '@mui/icons-material/EditNote';
import EngineeringIcon from '@mui/icons-material/Engineering';
import LocalAtmOutlinedIcon from '@mui/icons-material/LocalAtmOutlined';
import ScreenshotMonitorIcon from '@mui/icons-material/ScreenshotMonitor';
import ShortcutIcon from '@mui/icons-material/Shortcut';
import SpeedIcon from '@mui/icons-material/Speed';
import TitleIcon from '@mui/icons-material/Title';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { FormSwitchControl } from '~/common/components/forms/FormSwitchControl';
import { Is } from '~/common/util/pwaUtils';
import { Link } from '~/common/components/Link';
import { useIsMobile } from '~/common/components/useMatchMedia';
import { useUXLabsStore } from '~/common/stores/store-ux-labs';


// uncomment for more settings
export const DEV_MODE_SETTINGS = false;


export function UxLabsSettings() {

  // external state
  const isMobile = useIsMobile();
  const {
    labsAttachScreenCapture, setLabsAttachScreenCapture,
    labsCameraDesktop, setLabsCameraDesktop,
    labsChatBarAlt, setLabsChatBarAlt,
    labsEnhanceCodeBlocks, setLabsEnhanceCodeBlocks,
    labsHighPerformance, setLabsHighPerformance,
    labsShowCost, setLabsShowCost,
    labsAutoHideComposer, setLabsAutoHideComposer,
    labsShowShortcutBar, setLabsShowShortcutBar,
    labsDevMode, setLabsDevMode,
    labsDevNoStreaming, setLabsDevNoStreaming,
  } = useUXLabsStore();

  return <>

    {/* [DEV MODE] Settings */}

    {(Is.Deployment.Localhost || labsDevMode) && (
      <FormSwitchControl
        title={<><EngineeringIcon color='warning' sx={{ fontSize: 'lg', mr: 0.5, mb: 0.25 }} />Developer Mode</>} description={labsDevMode ? 'Enabled' : 'Disabled'}
        checked={labsDevMode} onChange={setLabsDevMode}
      />
    )}

    {labsDevMode && (
      <FormSwitchControl
        title={<><EngineeringIcon color='warning' sx={{ fontSize: 'lg', mr: 0.5, mb: 0.25 }} />Disable Streaming</>} description={labsDevNoStreaming ? 'Enabled' : 'Disabled'}
        checked={labsDevNoStreaming} onChange={setLabsDevNoStreaming}
      />
    )}

    {/* Non-Graduated Settings */}

    <FormSwitchControl
      title={<><CodeIcon sx={{ fontSize: 'lg', mr: 0.5, mb: 0.25 }} />Enhance Legacy Code</>} description={labsEnhanceCodeBlocks ? 'Auto-Enhance' : 'Disabled'}
      checked={labsEnhanceCodeBlocks} onChange={setLabsEnhanceCodeBlocks}
    />

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
      <FormLabelStart
        title={<><SpeedIcon sx={{ fontSize: 'lg', mr: 0.5, mb: 0.25 }} />Unlock Refresh</>}
        description={labsHighPerformance ? 'Unlocked' : 'Default'}
        tooltipWarning={labsHighPerformance}
        tooltip={<>
          Unlocks the maximum UI refresh rate for Chats and Beams, and will draw every single token as they come in.
          <hr />
          THIS MAY CAUSE HIGH CPU USAGE, BATTERY DRAIN, AND STUTTERING WITH FAST MODELS.
          <hr />
          Default: OFF
        </>}
      />
      <Switch checked={labsHighPerformance} onChange={event => setLabsHighPerformance(event.target.checked)}
              endDecorator={labsHighPerformance ? 'On' : 'Off'}
              slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />
    </FormControl>

    {DEV_MODE_SETTINGS && <FormSwitchControl
      title={<><TitleIcon sx={{ fontSize: 'lg', mr: 0.5, mb: 0.25 }} />Chat Title</>} description={labsChatBarAlt === 'title' ? 'Show Title' : 'Show Models'}
      checked={labsChatBarAlt === 'title'} onChange={(on) => setLabsChatBarAlt(on ? 'title' : false)}
    />}

    {!isMobile && <FormSwitchControl
      title={<><ScreenshotMonitorIcon sx={{ fontSize: 'lg', mr: 0.5, mb: 0.25 }} /> Screen Capture</>} description={labsAttachScreenCapture ? 'Enabled' : 'Disabled'}
      checked={labsAttachScreenCapture} onChange={setLabsAttachScreenCapture}
    />}

    {!isMobile && <FormSwitchControl
      title={<><AddAPhotoIcon sx={{ fontSize: 'lg', mr: 0.5, mb: 0.25 }} /> Webcam Capture</>} description={/*'v1.8 · ' +*/ (labsCameraDesktop ? 'Enabled' : 'Disabled')}
      checked={labsCameraDesktop} onChange={setLabsCameraDesktop}
    />}

    <FormSwitchControl
      title={<><LocalAtmOutlinedIcon sx={{ fontSize: 'lg', mr: 0.5, mb: 0.25 }} />Cost of messages</>} description={labsShowCost ? 'Show when available' : 'Disabled'}
      checked={labsShowCost} onChange={setLabsShowCost}
    />

    {!isMobile && <FormSwitchControl
      title={<><ShortcutIcon sx={{ fontSize: 'lg', mr: 0.5, mb: 0.25 }} />Shortcuts Bar</>} description={labsShowShortcutBar ? 'Status Bar' : 'Disabled'}
      checked={labsShowShortcutBar} onChange={setLabsShowShortcutBar}
    />}

    <FormSwitchControl
      title={<><EditNoteIcon sx={{ fontSize: 'lg', mr: 0.5, mb: 0.25 }} />Auto-hide input</>} description={labsAutoHideComposer ? 'Hover to show' : 'Always visible'}
      checked={labsAutoHideComposer} onChange={setLabsAutoHideComposer}
    />

    {/*
      Other Graduated (removed or backlog):
        - <Link href='https://github.com/enricoros/big-AGI/issues/359' target='_blank'>Draw App</Link>
        - Text Tools: dinamically shown where applicable (e.g. Diff)
        - Chat Mode: follow-ups; moved to Chat Advanced UI
    */}

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title='Graduated' description='Ex-labs' />
      <Typography level='body-xs'>
        <Link href='https://big-agi.com/blog/beam-multi-model-ai-reasoning' target='_blank'>Beam</Link>
        {' · '}<Link href='https://github.com/enricoros/big-AGI/issues/208' target='_blank'>Split Chats</Link>
        {' · '}<Link href='https://github.com/enricoros/big-AGI/issues/354' target='_blank'>Call AGI</Link>
        {' · '}<Link href='https://github.com/enricoros/big-AGI/issues/282' target='_blank'>Persona Creator</Link>
        {' · '}<Link href='https://github.com/enricoros/big-agi/issues/192' target='_blank'>Auto Diagrams</Link>
        {' · '}Imagine · Chat Search · Text Tools · LLM Overheat
      </Typography>
    </FormControl>

  </>;
}