import * as React from 'react';

import { FormControl, Typography } from '@mui/joy';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { FormSwitchControl } from '~/common/components/forms/FormSwitchControl';
import { useUXLabsStore } from '~/common/state/store-ux-labs';


export function UxLabsSettings() {

  // external state
  const { /*labsEnhancedUI,*/ labsMagicDraw, labsPersonaYTCreator, /*setLabsEnhancedUI,*/ setLabsMagicDraw, setLabsPersonaYTCreator } = useUXLabsStore();

  return <>

    <FormSwitchControl
      title='YouTube Personas' description={labsPersonaYTCreator ? 'Creator Enabled' : 'Disabled'}
      checked={labsPersonaYTCreator} onChange={setLabsPersonaYTCreator}
    />

    {/*<FormSwitchControl*/}
    {/*  title='Enhanced UI' description={labsEnhancedUI ? 'Enabled' : 'Disabled'}*/}
    {/*  checked={labsEnhancedUI} onChange={setLabsEnhancedUI}*/}
    {/*/>*/}

    <FormSwitchControl
      title='Assisted Draw' description={labsMagicDraw ? 'Enabled' : 'Disabled'}
      checked={labsMagicDraw} onChange={setLabsMagicDraw}
    />

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title='Graduated' />
      <Typography level='body-xs'>
        Auto Diagrams · Relative chat size · Text Tools
      </Typography>
    </FormControl>

  </>;
}