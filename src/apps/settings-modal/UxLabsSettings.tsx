import * as React from 'react';

import { FormControl, Typography } from '@mui/joy';
import AddAPhotoIcon from '@mui/icons-material/AddAPhoto';
import ScreenshotMonitorIcon from '@mui/icons-material/ScreenshotMonitor';
import SpeedIcon from '@mui/icons-material/Speed';
import TitleIcon from '@mui/icons-material/Title';

import { ChatBeamIcon } from '~/common/components/icons/ChatBeamIcon';
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
    labsBeam, setLabsBeam,
    labsCameraDesktop, setLabsCameraDesktop,
    labsChatBarAlt, setLabsChatBarAlt,
    labsHighPerformance, setLabsHighPerformance,
  } = useUXLabsStore();

  return <>

    <FormSwitchControl
      title={<><ChatBeamIcon color={labsBeam ? 'primary' : undefined} sx={{ mr: 0.25 }} />Chat Beam</>} description={'v1.15 · ' + (labsBeam ? 'Active' : 'Off')}
      checked={labsBeam} onChange={setLabsBeam}
    />

    <FormSwitchControl
      title={<><SpeedIcon color={labsHighPerformance ? 'primary' : undefined} sx={{ mr: 0.25 }} />Performance</>} description={'v1.14 · ' + (labsHighPerformance ? 'Unlocked' : 'Default')}
      checked={labsHighPerformance} onChange={setLabsHighPerformance}
    />

    {DEV_MODE_SETTINGS && <FormSwitchControl
      title={<><TitleIcon color={labsChatBarAlt ? 'primary' : undefined} sx={{ mr: 0.25 }} />Chat Title</>} description={'v1.14 · ' + (labsChatBarAlt === 'title' ? 'Show Title' : 'Show Models')}
      checked={labsChatBarAlt === 'title'} onChange={(on) => setLabsChatBarAlt(on ? 'title' : false)}
    />}

    {!isMobile && <FormSwitchControl
      title={<><ScreenshotMonitorIcon color={labsAttachScreenCapture ? 'primary' : undefined} sx={{ mr: 0.25 }} /> Screen Capture</>} description={'v1.13 · ' + (labsAttachScreenCapture ? 'Enabled' : 'Disabled')}
      checked={labsAttachScreenCapture} onChange={setLabsAttachScreenCapture}
    />}

    {!isMobile && <FormSwitchControl
      title={<><AddAPhotoIcon color={labsCameraDesktop ? 'primary' : undefined} sx={{ mr: 0.25 }} /> Webcam</>} description={/*'v1.8 · ' +*/ (labsCameraDesktop ? 'Enabled' : 'Disabled')}
      checked={labsCameraDesktop} onChange={setLabsCameraDesktop}
    />}

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title='Graduated' description='Ex-labs' />
      <Typography level='body-xs'>
        <Link href='https://github.com/enricoros/big-AGI/issues/208' target='_blank'>Split Chats</Link>
        {' · '}<Link href='https://github.com/enricoros/big-AGI/issues/359' target='_blank'>Draw App</Link>
        {' · '}<Link href='https://github.com/enricoros/big-AGI/issues/354' target='_blank'>Call AGI</Link>
        {' · '}<Link href='https://github.com/enricoros/big-AGI/issues/282' target='_blank'>Persona Creator</Link>
        {' · '}<Link href='https://github.com/enricoros/big-agi/issues/192' target='_blank'>Auto Diagrams</Link>
        {' · '}Imagine · Relative chat size · Text Tools · LLM Overheat
      </Typography>
    </FormControl>

  </>;
}