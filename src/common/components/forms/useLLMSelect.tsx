import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, FormControl, ListDivider, ListItemDecorator, Option, Select } from '@mui/joy';

import { DLLM, DLLMId, useModelsStore } from '~/modules/llms/store-llms';
import { findVendorById } from '~/modules/llms/vendors/vendors.registry';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { IModelVendor } from '~/modules/llms/vendors/IModelVendor';


/**
 * Select the Model, synced with either Global (Chat) LLM state, or local
 *
 * @param localState if true, the state is local to the hook, otherwise the global chat model is changed
 * @param label label of the select, use '' to hide it
 * @param placeholder placeholder of the select
 */
export function useLLMSelect(localState: boolean = true, label: string = 'Model', placeholder: string = 'Models …'): [DLLM | null, React.JSX.Element | null] {

  // state
  const localSwitch = React.useRef(localState);

  // external state
  const { llms, globalChatLLMId, globalSetChatLLMId } = useModelsStore(state => ({
    llms: state.llms,
    globalChatLLMId: state.chatLLMId,
    globalSetChatLLMId: state.setChatLLMId,
  }), shallow);

  // local state initially synced to the global state (may be used or not)
  const [localLLMId, setLocalLLMId] = React.useState<DLLMId | null>(globalChatLLMId);

  // global/local (stable) switch - do not change at runtime
  const chatLLMId = localSwitch.current ? localLLMId : globalChatLLMId;
  const setChatLLMId = localSwitch.current ? setLocalLLMId : globalSetChatLLMId;


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
            sx={llm.id === chatLLMId ? { fontWeight: 500 } : undefined}
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
      <FormControl>
        {!!label && <FormLabelStart title={label} />}
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Select
            variant='outlined'
            value={chatLLMId}
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
              // minWidth: '200',
            }}
          >
            {options}
          </Select>
        </Box>
      </FormControl>
    );
  }, [chatLLMId, label, llms, placeholder, setChatLLMId]);


  return [chatLLM, component];
}