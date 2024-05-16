import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import { Checkbox, FormControl, FormHelperText, Option, Select, Typography } from '@mui/joy';

import { AlreadySet } from '~/common/components/AlreadySet';
import { ExternalLink } from '~/common/components/ExternalLink';
import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { platformAwareKeystrokes } from '~/common/components/KeyStroke';

import { useBrowseCapability, useBrowseStore } from './store-module-browsing';


export function BrowseSettings() {

  // external state
  const { mayWork, isServerConfig, isClientValid, inCommand, inComposer, inReact, inPersonas } = useBrowseCapability();
  const {
    wssEndpoint, setWssEndpoint,
    pageTransform, setPageTransform,
    setEnableCommandBrowse, setEnableComposerAttach, setEnableReactTool, setEnablePersonaTool,
  } = useBrowseStore(useShallow(state => ({
    wssEndpoint: state.wssEndpoint,
    pageTransform: state.pageTransform,
    setPageTransform: state.setPageTransform,
    setWssEndpoint: state.setWssEndpoint,
    setEnableCommandBrowse: state.setEnableCommandBrowse,
    setEnableComposerAttach: state.setEnableComposerAttach,
    setEnableReactTool: state.setEnableReactTool,
    setEnablePersonaTool: state.setEnablePersonaTool,
  })));

  const handlePageTransformChange = (_event: any, value: typeof pageTransform | null) => value && setPageTransform(value);


  return <>

    <Typography level='body-sm'>
      Configure Browsing to enable loading links and web pages. <ExternalLink
      href='https://github.com/enricoros/big-agi/blob/main/docs/config-feature-browse.md'>
      Learn more</ExternalLink>.
    </Typography>

    <FormInputKey
      autoCompleteId='browse-wss' label='Puppeteer Wss' noKey
      value={wssEndpoint} onChange={setWssEndpoint}
      rightLabel={<AlreadySet required={!isServerConfig} />}
      required={!isServerConfig} isError={!isClientValid && !isServerConfig}
      placeholder='wss://...'
    />


    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title='Load pages as:' />
      <Select
        variant='outlined'
        value={pageTransform} onChange={handlePageTransformChange}
        slotProps={{
          root: { sx: { minWidth: '140px' } },
          indicator: { sx: { opacity: 0.5 } },
          button: { sx: { whiteSpace: 'inherit' } },
        }}
      >
        <Option value='text'>Text (default)</Option>
        <Option value='markdown'>Markdown</Option>
        <Option value='html'>HTML</Option>
      </Select>
    </FormControl>


    <Typography level='body-sm' sx={{ mt: 2 }}>Browsing enablement:</Typography>

    <FormControl disabled={!mayWork}>
      <Checkbox size='sm' label='Paste URLs' checked={inComposer} onChange={(event) => setEnableComposerAttach(event.target.checked)} />
      <FormHelperText>{platformAwareKeystrokes('Load and attach when pasting a URL')}</FormHelperText>
    </FormControl>

    <FormControl disabled={!mayWork}>
      <Checkbox size='sm' label='/browse' checked={inCommand} onChange={(event) => setEnableCommandBrowse(event.target.checked)} />
      <FormHelperText>{platformAwareKeystrokes('Use /browse to load a web page')}</FormHelperText>
    </FormControl>

    <FormControl disabled={!mayWork}>
      <Checkbox size='sm' label='ReAct' checked={inReact} onChange={(event) => setEnableReactTool(event.target.checked)} />
      <FormHelperText>Enables loadURL() in ReAct</FormHelperText>
    </FormControl>

    <FormControl disabled>
      <Checkbox size='sm' label='Chat with Personas' checked={false} onChange={(event) => setEnablePersonaTool(event.target.checked)} />
      <FormHelperText>Not yet available</FormHelperText>
      {/*<FormHelperText>Enable loading URLs by Personas</FormHelperText>*/}
    </FormControl>

  </>;
}