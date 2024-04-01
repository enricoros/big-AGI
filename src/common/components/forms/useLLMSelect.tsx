import * as React from 'react';
import { shallow } from 'zustand/shallow';

import type { SxProps } from '@mui/joy/styles/types';
import { FormControl, ListDivider, ListItemDecorator, Option, Select, SvgIconProps } from '@mui/joy';

import { DLLM, DLLMId, useModelsStore } from '~/modules/llms/store-llms';
import { findVendorById } from '~/modules/llms/vendors/vendors.registry';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { IModelVendor } from '~/modules/llms/vendors/IModelVendor';


/*export function useLLMSelectGlobalState(): [DLLMId | null, (llmId: DLLMId | null) => void] {
  return useModelsStore(state => [state.chatLLMId, state.setChatLLMId], shallow);
}*/

export function useLLMSelectLocalState(initFromGlobal: boolean): [DLLMId | null, (llmId: DLLMId | null) => void] {
  return React.useState<DLLMId | null>(initFromGlobal ? () => {
    return useModelsStore.getState().chatLLMId;
  } : null);
}

const llmSelectSx: SxProps = {
  flex: 1,
  backgroundColor: 'background.popup',
  // minWidth: '200',
};

/**
 * Select the Model, synced with either Global (Chat) LLM state, or local
 *
 * @param chatLLMId (required) the LLM id
 * @param setChatLLMId (required) the function to set the LLM id
 * @param label label of the select, use '' to hide it
 * @param smaller if true, the select is smaller
 * @param disabled
 * @param placeholder placeholder of the select
 * @param isHorizontal if true, the select is horizontal (label - select)
 */
export function useLLMSelect(
  chatLLMId: DLLMId | null,
  setChatLLMId: (llmId: DLLMId | null) => void,
  label: string = 'Model',
  smaller: boolean = false,
  disabled: boolean = false,
  placeholder: string = 'Models …',
  isHorizontal: boolean = false,
): [DLLM | null, React.JSX.Element | null, React.FunctionComponent<SvgIconProps> | undefined] {

  // external state
  const _filteredLLMs = useModelsStore(state => {
    return state.llms.filter(llm => !llm.hidden || (chatLLMId && llm.id === chatLLMId));
  }, shallow);

  // derived state
  const noIcons = false; //smaller;
  const chatLLM = chatLLMId
    ? _filteredLLMs.find(llm => llm.id === chatLLMId) ?? null
    : null;


  // Memo the LLM Options for the Select
  const componentOptions = React.useMemo(() => {
    // create the option items
    let formerVendor: IModelVendor | null = null;
    return _filteredLLMs.reduce((acc, llm, _index) => {

      const vendor = findVendorById(llm._source?.vId);
      const vendorChanged = vendor !== formerVendor;
      if (vendorChanged)
        formerVendor = vendor;

      // add separators if the vendor changed (and more than one vendor)
      const addSeparator = vendorChanged && formerVendor !== null;
      if (addSeparator)
        acc.push(<ListDivider key={'llm-sep-' + llm.id}>{vendor?.name}</ListDivider>);

      // the option component
      acc.push(
        <Option
          key={'llm-' + llm.id}
          value={llm.id}
          // Disabled to avoid regenerating the memo too frequently
          // sx={llm.id === chatLLMId ? { fontWeight: 'md' } : undefined}
        >
          {(!noIcons && !!vendor?.Icon) && (
            <ListItemDecorator>
              <vendor.Icon />
            </ListItemDecorator>
          )}
          {/*<Tooltip title={llm.description}>*/}
          {llm.label}
          {/*</Tooltip>*/}
          {/*{llm.gen === 'sdxl' && <Chip size='sm' variant='outlined'>XL</Chip>} {llm.label}*/}
        </Option>,
      );

      return acc;
    }, [] as React.JSX.Element[]);
  }, [_filteredLLMs, noIcons]);


  const onSelectChange = React.useCallback((_event: unknown, value: DLLMId | null) => value && setChatLLMId(value), [setChatLLMId]);

  // Memo the Select component
  const llmSelectComponent = React.useMemo(() => (
    <FormControl orientation={isHorizontal ? 'horizontal' : undefined}>
      {!!label && <FormLabelStart title={label} sx={/*{ mb: '0.25rem' }*/ undefined} />}
      {/*<Box sx={{ display: 'flex', justifyContent: 'space-between' }}>*/}
      <Select
        variant='outlined'
        value={chatLLMId}
        size={smaller ? 'sm' : undefined}
        disabled={disabled}
        onChange={onSelectChange}
        placeholder={placeholder}
        slotProps={{
          listbox: {
            sx: {
              // larger list
              '--ListItem-paddingLeft': '1rem',
              '--ListItem-minHeight': '2.5rem',
              // minWidth: '100%',
            },
          },
          button: {
            sx: {
              // show the full name on the button
              whiteSpace: 'inherit',
            },
          },
        }}
        sx={llmSelectSx}
      >
        {componentOptions}
      </Select>
      {/*</Box>*/}
    </FormControl>
  ), [chatLLMId, componentOptions, disabled, isHorizontal, label, onSelectChange, placeholder, smaller]);

  // Memo the vendor icon for the chat LLM
  const chatLLMVendorIconFC = React.useMemo(() => {
    return findVendorById(chatLLM?._source?.vId)?.Icon;
  }, [chatLLM]);

  return [chatLLM, llmSelectComponent, chatLLMVendorIconFC];
}