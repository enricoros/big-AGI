import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Checkbox, FormControl, FormHelperText } from '@mui/joy';

import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { platformAwareKeystrokes } from '~/common/components/KeyStroke';

import { useBrowseCapability, useBrowseStore } from './store-module-browsing';


export function BrowseSettings() {

  // external state
  const { mayWork, isServerConfig, isClientValid, inCommand, inComposer, inReact } = useBrowseCapability();
  const { wssEndpoint, setWssEndpoint, setEnableCommandBrowse, setEnableComposerAttach, setEnableReactTool } = useBrowseStore(state => ({
    wssEndpoint: state.wssEndpoint,
    setWssEndpoint: state.setWssEndpoint,
    setEnableCommandBrowse: state.setEnableCommandBrowse,
    setEnableComposerAttach: state.setEnableComposerAttach,
    setEnableReactTool: state.setEnableReactTool,
  }), shallow);

  return <>

    {!isServerConfig && <FormInputKey
      id='browse-wss' label='WSS Endpoint' noKey
      value={wssEndpoint} onChange={setWssEndpoint}
      rightLabel={!isServerConfig ? 'must be valid' : '✔️ already set in server'}
      required={!isServerConfig} isError={!isClientValid}
      placeholder='wss://...'
    />}

    <FormControl disabled={!mayWork}>
      <Checkbox variant='outlined' label='Attach URLs' checked={inComposer} onChange={(event) => setEnableComposerAttach(event.target.checked)} />
      <FormHelperText>{platformAwareKeystrokes('Load and attach a web page on Ctrl + V')}</FormHelperText>
    </FormControl>

    <FormControl disabled={!mayWork}>
      <Checkbox variant='outlined' label='/browse' checked={inCommand} onChange={(event) => setEnableCommandBrowse(event.target.checked)} />
      <FormHelperText>{platformAwareKeystrokes('Enable the /browse command')}</FormHelperText>
    </FormControl>

    <FormControl disabled={!mayWork}>
      <Checkbox variant='outlined' label='ReAct' checked={inReact} onChange={(event) => setEnableReactTool(event.target.checked)} />
      <FormHelperText>Enable the loadURL() tool in ReAct</FormHelperText>
    </FormControl>

    {/*<FormControl disabled>*/}
    {/*  <Checkbox variant='outlined' label='Personas' checked={inPersonas} onChange={(event) => setEnablePersonaTool(event.target.checked)} />*/}
    {/*  <FormHelperText>Enable loading URLs by Personas</FormHelperText>*/}
    {/*</FormControl>*/}

  </>;
}