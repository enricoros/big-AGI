import * as React from 'react';

import { DModelSource } from '~/modules/llms/llm.types';
import { findVendorById } from '~/modules/llms/vendor.registry';


export function VendorSourceSetup(props: { source: DModelSource }) {
  const vendor = findVendorById(props.source.vId);
  if (!vendor)
    return <>Configuration issue: Vendor not found for Source {props.source.id}</>;

  const SourceSetupComponent = vendor.SourceSetupComponent;
  return <SourceSetupComponent sourceId={props.source.id} />;
}