import * as React from 'react';

import { FormControl, Typography } from '@mui/joy';
import AddAPhotoIcon from '@mui/icons-material/AddAPhoto';
import VerticalSplitIcon from '@mui/icons-material/VerticalSplit';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { FormSwitchControl } from '~/common/components/forms/FormSwitchControl';
import { Link } from '~/common/components/Link';
import { useIsMobile } from '~/common/components/useMatchMedia';
import { useUXLabsStore } from '~/common/state/store-ux-labs';


export function UxLabsSettings() {

  // external state
  const isMobile = useIsMobile();
  const {
    labsCameraDesktop, labsSplitBranching,
    setLabsCameraDesktop, setLabsSplitBranching,
  } = useUXLabsStore();

  return <>

    {!isMobile && <FormSwitchControl
      title={<><AddAPhotoIcon color={labsCameraDesktop ? 'primary' : undefined} sx={{ mr: 0.25 }} /> Webcam</>} description={labsCameraDesktop ? 'Enabled' : 'Disabled'}
      checked={labsCameraDesktop} onChange={setLabsCameraDesktop}
    />}

    <FormSwitchControl
      title={<><VerticalSplitIcon color={labsSplitBranching ? 'primary' : undefined} sx={{ mr: 0.25 }} /> Split Branching</>} description={labsSplitBranching ? 'Enabled' : 'Disabled'}
      checked={labsSplitBranching} onChange={setLabsSplitBranching}
    />

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title='Graduated' />
      <Typography level='body-xs'>
        <Link href='https://github.com/enricoros/big-AGI/issues/359' target='_blank'>Draw</Link>
        {' · '}<Link href='https://github.com/enricoros/big-AGI/issues/354' target='_blank'>Call AGI</Link>
        {' · '}<Link href='https://github.com/enricoros/big-AGI/issues/282' target='_blank'>Persona Creator</Link>
        {' · '}<Link href='https://github.com/enricoros/big-agi/issues/192' target='_blank'>Auto Diagrams</Link>
        {' · '}Imagine · Relative chat size · Text Tools · LLM Overheat
      </Typography>
    </FormControl>

  </>;
}