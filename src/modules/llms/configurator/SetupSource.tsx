import * as React from 'react';

import { DModelSource } from '../store-models';
import { findVendor } from '../vendors-registry';


export function SetupSource(props: { source: DModelSource }) {
  const vendor = findVendor(props.source.vendorId);
  return vendor?.createSetupComponent(props.source.id) ?? null;
}