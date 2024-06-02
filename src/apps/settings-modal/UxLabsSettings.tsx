import * as React from 'react';

import { FormControl, Typography } from '@mui/joy';
import AddAPhotoIcon from '@mui/icons-material/AddAPhoto';
import LocalAtmOutlinedIcon from '@mui/icons-material/LocalAtmOutlined';
import ScreenshotMonitorIcon from '@mui/icons-material/ScreenshotMonitor';
import SpeedIcon from '@mui/icons-material/Speed';
import TitleIcon from '@mui/icons-material/Title';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { FormSwitchControl } from '~/common/components/forms/FormSwitchControl';
import { Link } from '~/common/components/Link';
import { useIsMobile } from '~/common/components/useMatchMedia';
import { useUXLabsStore } from '~/common/state/store-ux-labs';


// uncomment for more settings
export const DEV_MODE_SETTINGS = false;


export function UxLabsSettings() {

  // external state
  const isMobile = useIsMobile();
  const {
    labsAttachScreenCapture, setLabsAttachScreenCapture,
    labsCameraDesktop, setLabsCameraDesktop,
    labsChatBarAlt, setLabsChatBarAlt,
    labsHighPerformance, setLabsHighPerformance,
    labsShowCost, setLabsShowCost,
  } = useUXLabsStore();

  return <>

    {/* 'v1.15 · ' + .. */}

    <FormSwitchControl
      title={<><SpeedIcon sx={{ fontSize: 'lg', mr: 0.5, mb: 0.25 }} />Performance</>} description={labsHighPerformance ? 'Unlocked' : 'Default'}
      checked={labsHighPerformance} onChange={setLabsHighPerformance}
    />

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