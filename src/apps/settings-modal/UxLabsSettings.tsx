import * as React from 'react';

import { FormControl, Typography } from '@mui/joy';
import AddAPhotoIcon from '@mui/icons-material/AddAPhoto';
import CallIcon from '@mui/icons-material/Call';
import FormatPaintIcon from '@mui/icons-material/FormatPaint';
import VerticalSplitIcon from '@mui/icons-material/VerticalSplit';
import YouTubeIcon from '@mui/icons-material/YouTube';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { FormSwitchControl } from '~/common/components/forms/FormSwitchControl';
import { Link } from '~/common/components/Link';
import { useIsMobile } from '~/common/components/useMatchMedia';
import { useUXLabsStore } from '~/common/state/store-ux-labs';


export function UxLabsSettings() {

  // external state
  const isMobile = useIsMobile();
  const {
    labsCalling, labsCameraDesktop, /*labsEnhancedUI,*/ labsMagicDraw, labsPersonaYTCreator, labsSplitBranching,
    setLabsCalling, setLabsCameraDesktop, /*setLabsEnhancedUI,*/ setLabsMagicDraw, setLabsPersonaYTCreator, setLabsSplitBranching,
  } = useUXLabsStore();

  return <>

    <FormSwitchControl
      title={<><YouTubeIcon color={labsPersonaYTCreator ? 'primary' : undefined} sx={{ mr: 0.25 }} /> YouTube Personas</>} description={labsPersonaYTCreator ? 'Creator Enabled' : 'Disabled'}
      checked={labsPersonaYTCreator} onChange={setLabsPersonaYTCreator}
    />

    <FormSwitchControl
      title={<><FormatPaintIcon color={labsMagicDraw ? 'primary' : undefined} sx={{ mr: 0.25 }} />Assisted Draw</>} description={labsMagicDraw ? 'Enabled' : 'Disabled'}
      checked={labsMagicDraw} onChange={setLabsMagicDraw}
    />

    <FormSwitchControl
      title={<><CallIcon color={labsCalling ? 'primary' : undefined} sx={{ mr: 0.25 }} /> Voice Calls</>} description={labsCalling ? 'Call AGI' : 'Disabled'}
      checked={labsCalling} onChange={setLabsCalling}
    />

    {!isMobile && <FormSwitchControl
      title={<><AddAPhotoIcon color={labsCameraDesktop ? 'primary' : undefined} sx={{ mr: 0.25 }} /> Webcam</>} description={labsCameraDesktop ? 'Enabled' : 'Disabled'}
      checked={labsCameraDesktop} onChange={setLabsCameraDesktop}
    />}

    <FormSwitchControl
      title={<><VerticalSplitIcon color={labsSplitBranching ? 'primary' : undefined} sx={{ mr: 0.25 }} /> Split Branching</>} description={labsSplitBranching ? 'Enabled' : 'Disabled'} disabled
      checked={labsSplitBranching} onChange={setLabsSplitBranching}
    />

    {/*<FormSwitchControl*/}
    {/*  title='Enhanced UI' description={labsEnhancedUI ? 'Enabled' : 'Disabled'}*/}
    {/*  checked={labsEnhancedUI} onChange={setLabsEnhancedUI}*/}
    {/*/>*/}

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title='Graduated' />
      <Typography level='body-xs'>
        <Link href='https://github.com/enricoros/big-agi/issues/192' target='_blank'>Auto Diagrams</Link> · Relative chat size · Text Tools · LLM Overheat
      </Typography>
    </FormControl>

  </>;
}