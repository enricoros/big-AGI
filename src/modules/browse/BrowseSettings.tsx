import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Checkbox, FormControl, FormHelperText } from '@mui/joy';

import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { Link } from '~/common/components/Link';
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

    <FormHelperText sx={{ display: 'block' }}>
      Configure a browsing service to enable loading links and pages. See the <Link
      href='https://github.com/enricoros/big-agi/blob/main/docs/config-feature-browse.md' target='_blank' noLinkStyle>
      browse configuration guide</Link> for more information.
    </FormHelperText>

    <FormInputKey
      id='browse-wss' label='Puppeteer Endpoint' noKey
      value={wssEndpoint} onChange={setWssEndpoint}
      rightLabel={!isServerConfig ? 'required' : '✔️ already set in server'}
      required={!isServerConfig} isError={!isClientValid && !isServerConfig}
      placeholder='wss://...'
    />

    <FormControl disabled={!mayWork}>
      <Checkbox variant='outlined' label='Attach URLs' checked={inComposer} onChange={(event) => setEnableComposerAttach(event.target.checked)} />
      <FormHelperText>{platformAwareKeystrokes('Load and attach a page when pasting a URL')}</FormHelperText>
    </FormControl>

    <FormControl disabled={!mayWork}>
      <Checkbox variant='outlined' label='/browse' checked={inCommand} onChange={(event) => setEnableCommandBrowse(event.target.checked)} />
      <FormHelperText>{platformAwareKeystrokes('Use /browse to load a web page')}</FormHelperText>
    </FormControl>

    <FormControl disabled={!mayWork}>
      <Checkbox variant='outlined' label='ReAct' checked={inReact} onChange={(event) => setEnableReactTool(event.target.checked)} />
      <FormHelperText>Enables loadURL() in ReAct</FormHelperText>
    </FormControl>

    {/*<FormControl disabled>*/}
    {/*  <Checkbox variant='outlined' label='Personas' checked={inPersonas} onChange={(event) => setEnablePersonaTool(event.target.checked)} />*/}
    {/*  <FormHelperText>Enable loading URLs by Personas</FormHelperText>*/}
    {/*</FormControl>*/}

  </>;
}