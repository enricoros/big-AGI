import * as React from 'react';

import { Divider } from '@mui/joy';

import { AddVendor } from '@/modules/models/AddVendor';
import { ConfigureSources } from '@/modules/models/ConfigureSources';


export function ModelConfigurator() {
  return <>

    <AddVendor />

    <Divider />

    <ConfigureSources />

    {/*<Divider />*/}

    {/* Models List */}
    {/*<Sheet*/}
    {/*  variant='solid'*/}
    {/*  invertedColors*/}
    {/*  sx={{ borderRadius: 'sm', p: 2 }}*/}
    {/*>*/}
    {/*  <div>Model 1</div>*/}
    {/*  <div>Model 2</div>*/}
    {/*  <div>Model 3</div>*/}
    {/*  <div>Model 4</div>*/}
    {/*</Sheet>*/}

  </>;
}