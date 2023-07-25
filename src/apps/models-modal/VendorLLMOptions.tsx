import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { DLLMId } from '~/modules/llms/llm.types';
import { findVendorById } from '~/modules/llms/vendor.registry';
import { useModelsStore } from '~/modules/llms/store-llms';


export function VendorLLMOptions(props: { id: DLLMId }) {
  // get LLM (warning: this will refresh all children components on every change of any LLM field)
  const llm = useModelsStore(state => state.llms.find(llm => llm.id === props.id), shallow);
  if (!llm)
    return <>Configuration issue: LLM not found for id {props.id}</>;

  // get vendor
  const vendor = findVendorById(llm._source.vId);
  if (!vendor)
    return <>Configuration issue: Vendor not found for LLM {llm.id}, source: {llm.sId}</>;

  const LLMOptionsComponent = vendor.LLMOptionsComponent;
  return <LLMOptionsComponent llm={llm} />;
}