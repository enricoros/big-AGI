import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import { Checkbox, FormControl, FormHelperText, FormLabel, Option, Select, Typography } from '@mui/joy';

import { AlreadySet } from '~/common/components/AlreadySet';
import { ExternalLink } from '~/common/components/ExternalLink';
import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { platformAwareKeystrokes } from '~/common/components/KeyStroke';

import { useBrowseCapability, useBrowseStore } from './store-module-browsing';


const _styleHelperText = {
  fontSize: 'xs',
} as const;


export function BrowseSettings() {

  // external state
  const { mayWork, isServerConfig, isClientValid, inComposer, inReact, inPersonas } = useBrowseCapability();
  const {
    wssEndpoint, setWssEndpoint,
    pageTransform, setPageTransform,
    setEnableComposerAttach, setEnableReactTool, setEnablePersonaTool,
  } = useBrowseStore(useShallow(state => ({
    wssEndpoint: state.wssEndpoint,
    pageTransform: state.pageTransform,
    setPageTransform: state.setPageTransform,
    setWssEndpoint: state.setWssEndpoint,
    setEnableComposerAttach: state.setEnableComposerAttach,
    setEnableReactTool: state.setEnableReactTool,
    setEnablePersonaTool: state.setEnablePersonaTool,
  })));

  const handlePageTransformChange = (_event: any, value: typeof pageTransform | null) => value && setPageTransform(value);


  return <>

    <Typography level='body-sm'>
      Download and process web pages for analysis. <ExternalLink href='https://big-agi.com/docs/config-feature-browse'>Learn more</ExternalLink>.
    </Typography>

    <FormInputKey
      autoCompleteId='browse-wss' label='Puppeteer Wss' noKey
      value={wssEndpoint} onChange={setWssEndpoint}
      rightLabel={<AlreadySet required={!isServerConfig} />}
      required={!isServerConfig} isError={!isClientValid && !isServerConfig}
      placeholder='wss://...'
    />


    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart title='Web page to LLM' description={pageTransform === 'text' ? 'Converts to text' : pageTransform === 'markdown' ? 'Converts to markdown' : 'Preserves HTML (heavy)'} />
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


    <FormLabel>Enable page loading for:</FormLabel>

    <FormControl disabled={!mayWork}>
      <Checkbox size='sm' label='Attachments' checked={inComposer} onChange={(event) => setEnableComposerAttach(event.target.checked)} />
      <FormHelperText sx={_styleHelperText}>{platformAwareKeystrokes('Load and attach when pasting a URL')}</FormHelperText>
    </FormControl>

    <FormControl disabled={!mayWork}>
      <Checkbox size='sm' label='ReAct' checked={inReact} onChange={(event) => setEnableReactTool(event.target.checked)} />
      <FormHelperText sx={_styleHelperText}>Enables loadURL() in ReAct</FormHelperText>
    </FormControl>

    <FormControl disabled>
      <Checkbox size='sm' label='Personas browsing tool' checked={false} onChange={(event) => setEnablePersonaTool(event.target.checked)} />
      <FormHelperText sx={_styleHelperText}>Available in a future release</FormHelperText>
      {/*<FormHelperText sx={_styleHelperText}>Enable loading URLs by Personas</FormHelperText>*/}
    </FormControl>

  </>;
}