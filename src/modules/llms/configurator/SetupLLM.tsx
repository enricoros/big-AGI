import * as React from 'react';

import { DLLM } from '../llm.types';
import { findVendorById } from '../vendors/vendor.registry';


export function SetupLLM(props: { llm: DLLM }) {
  const vendor = findVendorById(props.llm._source.vId);
  if (!vendor)
    return <>Configuration issue: Vendor not found for LLM {props.llm.id}, source: {props.llm.sId}</>;
  return vendor.createLLMSettingsComponent(props.llm);
}