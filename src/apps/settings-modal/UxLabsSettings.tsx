import * as React from 'react';

import { FormControl, Typography } from '@mui/joy';
import CallIcon from '@mui/icons-material/Call';
import FormatPaintIcon from '@mui/icons-material/FormatPaint';
import VerticalSplitIcon from '@mui/icons-material/VerticalSplit';
import YouTubeIcon from '@mui/icons-material/YouTube';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { FormSwitchControl } from '~/common/components/forms/FormSwitchControl';
import { Link } from '~/common/components/Link';
import { useUXLabsStore } from '~/common/state/store-ux-labs';


export function UxLabsSettings() {

  // external state
  const {
    labsCalling, /*labsEnhancedUI,*/ labsMagicDraw, labsPersonaYTCreator, labsSplitBranching,
    setLabsCalling, /*setLabsEnhancedUI,*/ setLabsMagicDraw, setLabsPersonaYTCreator, setLabsSplitBranching,
  } = useUXLabsStore();

  return <>

    <FormSwitchControl
      title={<><YouTubeIcon /> YouTube Personas</>} description={labsPersonaYTCreator ? 'Creator Enabled' : 'Disabled'}
      checked={labsPersonaYTCreator} onChange={setLabsPersonaYTCreator}
    />

    <FormSwitchControl
      title={<><FormatPaintIcon />Assisted Draw</>} description={labsMagicDraw ? 'Enabled' : 'Disabled'}
      checked={labsMagicDraw} onChange={setLabsMagicDraw}
    />

    <FormSwitchControl
      title={<><CallIcon /> Voice Calls</>} description={labsCalling ? 'Call AGI' : 'Disabled'}
      checked={labsCalling} onChange={setLabsCalling}
    />

    <FormSwitchControl
      title={<><VerticalSplitIcon /> Split Branching</>} description={labsSplitBranching ? 'Enabled' : 'Disabled'} disabled
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