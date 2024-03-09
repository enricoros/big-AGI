import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, FormControl, ListDivider, ListItemDecorator, Option, Select } from '@mui/joy';

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


/**
 * Select the Model, synced with either Global (Chat) LLM state, or local
 *
 * @param chatLLMId (required) the LLM id
 * @param setChatLLMId (required) the function to set the LLM id
 * @param label label of the select, use '' to hide it
 * @param smaller if true, the select is smaller
 * @param placeholder placeholder of the select
 * @param isHorizontal if true, the select is horizontal (label - select)
 */
export function useLLMSelect(
  chatLLMId: DLLMId | null,
  setChatLLMId: (llmId: DLLMId | null) => void,
  label: string = 'Model',
  smaller: boolean = false,
  placeholder: string = 'Models …',
  isHorizontal: boolean = false,
): [DLLM | null, React.JSX.Element | null] {

  // external state
  const llms = useModelsStore(state => state.llms, shallow);

  // derived state
  const chatLLM = chatLLMId ? llms.find(llm => llm.id === chatLLMId) ?? null : null;


  const component = React.useMemo(() => {
    // hide invisible models, except the current model
    const filteredLLMs = llms.filter(llm => !llm.hidden || llm.id === chatLLMId);

    // create the option items
    let formerVendor: IModelVendor | null = null;
    const options = filteredLLMs.map((llm) => {

      const vendor = findVendorById(llm._source?.vId);
      const vendorChanged = vendor !== formerVendor;
      const addSeparator = vendorChanged && formerVendor !== null;
      if (vendorChanged)
        formerVendor = vendor;

      return (
        <React.Fragment key={'llm-' + llm.id}>
          {addSeparator && <ListDivider />}
          <Option
            value={llm.id}
            sx={llm.id === chatLLMId ? { fontWeight: 'md' } : undefined}
          >
            {!!vendor?.Icon && (
              <ListItemDecorator>
                <vendor.Icon />
              </ListItemDecorator>
            )}
            {/*<Tooltip title={llm.description}>*/}
            {llm.label}
            {/*</Tooltip>*/}
            {/*{llm.gen === 'sdxl' && <Chip size='sm' variant='outlined'>XL</Chip>} {llm.label}*/}
          </Option>
        </React.Fragment>
      );
    });

    // create the component
    return (
      <FormControl orientation={isHorizontal ? 'horizontal' : undefined}>
        {!!label && <FormLabelStart title={label} />}
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Select
            variant='outlined'
            value={chatLLMId}
            size={smaller ? 'sm' : undefined}
            onChange={(_event, value) => value && setChatLLMId(value)}
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
            sx={{
              flex: 1,
              backgroundColor: 'background.popup',
              // minWidth: '200',
            }}
          >
            {options}
          </Select>
        </Box>
      </FormControl>
    );
  }, [chatLLMId, isHorizontal, label, llms, placeholder, setChatLLMId]);


  return [chatLLM, component];
}