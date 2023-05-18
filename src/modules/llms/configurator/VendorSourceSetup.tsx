import * as React from 'react';

import { DModelSource } from '../llm.types';
import { findVendorById } from '~/modules/llms/vendor.registry';


export function VendorSourceSetup(props: { source: DModelSource }) {
  const vendor = findVendorById(props.source.vId);
  if (!vendor)
    return <>Configuration issue: Vendor not found for Source {props.source.id}</>;
  return vendor.createSourceSetupComponent(props.source.id);
}