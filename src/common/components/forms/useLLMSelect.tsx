import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Chip, ColorPaletteProp, FormControl, IconButton, ListDivider, ListItemDecorator, Option, optionClasses, Select, SelectSlotsAndSlotProps, SvgIconProps, VariantProp } from '@mui/joy';
import AutoModeIcon from '@mui/icons-material/AutoMode';

import type { IModelVendor } from '~/modules/llms/vendors/IModelVendor';
import { findModelVendor } from '~/modules/llms/vendors/vendors.registry';

import type { DModelDomainId } from '~/common/stores/llms/model.domains.types';
import { DLLM, DLLMId, LLM_IF_OAI_Reasoning, LLM_IF_Outputs_Audio, LLM_IF_Outputs_Image, LLM_IF_Tools_WebSearch } from '~/common/stores/llms/llms.types';
import { TooltipOutlined } from '~/common/components/TooltipOutlined';
import { getChatLLMId, llmsStoreActions } from '~/common/stores/llms/store-llms';
import { optimaOpenModels } from '~/common/layout/optima/useOptima';
import { useVisibleLLMs } from '~/common/stores/llms/llms.hooks';

import { FormLabelStart } from './FormLabelStart';


// configuration
const LLM_SELECT_REDUCE_OPTIONS = 10; // optimization: number of options over which only the selected is kept when closed (we'll have special notes for accessibility)
const LLM_SELECT_SHOW_REASONING_ICON = false;
const LLM_TEXT_PLACEHOLDER = 'Models …';
const LLM_TEXT_CONFIGURE = 'Add Models …';


/*export function useLLMSelectGlobalState(): [DLLMId | null, (llmId: DLLMId | null) => void] {
  return ...(useShallow(state => [state.chatLLMId, state.setChatLLMId]));
}*/

export function useLLMSelectLocalState(initFromGlobal: boolean): [DLLMId | null, (llmId: DLLMId | null) => void] {
  return React.useState<DLLMId | null>(initFromGlobal ? () => {
    return getChatLLMId();
  } : null);
}

const llmSelectSx: SxProps = {
  flex: 1,
  backgroundColor: 'background.popup',
  // minWidth: '200',
} as const;

const styleChips: SxProps = {
  ml: 'auto',
  backgroundColor: 'background.popup',
  boxShadow: 'xs',
} as const;

const _slotProps: SelectSlotsAndSlotProps<false>['slotProps'] = {
  // see the OptimaBarDropdown.listbox for a well made customization (max-height, max-width, etc.)
  listbox: {
    sx: {
      // larger list
      '--ListItem-paddingLeft': '1rem',
      '--ListItem-minHeight': '2.5rem', // note that in the Optima Dropdowns we use 2.75rem

      // No need for larger SVG icons here
      // '--Icon-fontSize': 'var(--joy-fontSize-xl2)',

      // No need to remove the gutter
      // paddingBlock: 0,

      // v-size: keep the default
      // maxHeight: 'calc(100dvh - 56px - 24px)',

      // Decorator: do not change the emoji size
      // [`& .${listItemDecoratorClasses.root}`]: {
      //   fontSize: 'var(--joy-fontSize-lg)',
      // } as const,

      // Option: clip width to 200...360px
      [`& .${optionClasses.root}`]: {
        // NOTE: was maxWidth: 'min(600px, calc(100dvw - 0.25rem))', however llmSelect could be wider on Beam
        maxWidth: 'calc(100dvw - 0.25rem)', // the small reduction is to avoid accidental h-scrolling because of the border
        minWidth: 200,
      } as const,

      // minWidth: '100%',
      zIndex: 1300, // on top of ScratchChat
    } as const,
  } as const,
  button: {
    'aria-description': 'Options may be filtered when closed. Open dropdown to see all options.',
    sx: {
      // show the full name on the button
      whiteSpace: 'inherit',
      wordBreak: 'break-word',
      minWidth: '6rem',
    } as const,
  } as const,
} as const;


interface LLMSelectOptions {
  label: string;
  sx?: SxProps;
  color?: ColorPaletteProp;
  variant?: VariantProp;
  larger?: boolean;
  disabled?: boolean;
  placeholder?: string;
  isHorizontal?: boolean;
  autoRefreshDomain?: DModelDomainId;
}

/**
 * Select the Model, synced with either Global (Chat) LLM state, or local
 *
 * @param llmId (required) the LLM id
 * @param setLlmId (required) the function to set the LLM id
 * @param options (optional) any array of options
 */
export function useLLMSelect(
  llmId: undefined | DLLMId | null, // undefined: not set at all, null: has the meaning of no-llm-wanted here
  setLlmId: (llmId: DLLMId | null) => void,
  options: LLMSelectOptions,
): [DLLM | null, React.JSX.Element | null, React.FunctionComponent<SvgIconProps> | undefined] {

  // state
  const [controlledOpen, setControlledOpen] = React.useState(false);

  // external state
  const _filteredLLMs = useVisibleLLMs(llmId);

  // derived state
  const { label, larger = false, disabled = false, placeholder = LLM_TEXT_PLACEHOLDER, isHorizontal = false, autoRefreshDomain } = options;
  const noIcons = false; //smaller;
  const llm = !llmId ? null : _filteredLLMs.find(llm => llm.id === llmId) ?? null;
  const isReasoning = !LLM_SELECT_SHOW_REASONING_ICON ? false : llm?.interfaces?.includes(LLM_IF_OAI_Reasoning) ?? false;


  // memo LLM Options

  const optimizeToSingleVisibleId = (!controlledOpen && _filteredLLMs.length > LLM_SELECT_REDUCE_OPTIONS) ? llmId : null; // id to keep visible when optimizing

  const optionsArray = React.useMemo(() => {
    // create the option items
    let formerVendor: IModelVendor | null = null;
    return _filteredLLMs.reduce((acc, llm, _index) => {

      if (optimizeToSingleVisibleId && llm.id !== optimizeToSingleVisibleId)
        return acc;

      const vendor = findModelVendor(llm.vId);
      const vendorChanged = vendor !== formerVendor;
      if (vendorChanged)
        formerVendor = vendor;

      // add separators if the vendor changed (and more than one vendor)
      const addSeparator = vendorChanged && formerVendor !== null;
      if (addSeparator && !optimizeToSingleVisibleId)
        acc.push(<ListDivider key={'llm-sep-' + llm.id}>{vendor?.name}</ListDivider>);

      let features = '';
      const isNotSymlink = !llm.label.startsWith('🔗');
      const seemsFree = !!llm.pricing?.chat?._isFree;
      if (isNotSymlink) {
        // check features
        if (seemsFree) features += 'free ';
        if (llm.interfaces.includes(LLM_IF_OAI_Reasoning))
          features += '🧠 '; // can reason
        if (llm.interfaces.includes(LLM_IF_Tools_WebSearch))
          features += '🌐 '; // can web search
        if (llm.interfaces.includes(LLM_IF_Outputs_Audio))
          features += '🔊 '; // can output audio
        if (llm.interfaces.includes(LLM_IF_Outputs_Image))
          features += '🖼️ '; // can draw images
      }

      // the option component
      acc.push(
        <Option
          key={llm.id}
          value={llm.id}
          // Disabled to avoid regenerating the memo too frequently
          // sx={llm.id === llmId ? { fontWeight: 'md' } : undefined}
          label={llm.label}
        >
          {(!noIcons && !!vendor?.Icon) && (
            <ListItemDecorator>
              {llm.userStarred ? '⭐ ' : <vendor.Icon />}
            </ListItemDecorator>
          )}
          {/*<Tooltip title={llm.description}>*/}

          <div className='agi-ellipsize'>{llm.label}</div>

          {/* Features Chips - sync with `ModelsList.tsx` */}
          {!!features && <Chip size='sm' color={seemsFree ? 'success' : undefined} variant='plain' sx={styleChips}>{features.trim().replace(' ', ' ')}</Chip>}

          {/*</Tooltip>*/}
          {/*{llm.gen === 'sdxl' && <Chip size='sm' variant='outlined'>XL</Chip>} {llm.label}*/}
        </Option>,
      );

      return acc;
    }, [] as React.JSX.Element[]);
  }, [_filteredLLMs, noIcons, optimizeToSingleVisibleId]);


  const onSelectChange = React.useCallback((_event: unknown, value: DLLMId | null) => value && setLlmId(value), [setLlmId]);

  const hasNoModels = _filteredLLMs.length === 0;
  const showNoOptions = !optionsArray.length;

  // memo Select
  const llmSelectComponent = React.useMemo(() => (
    <FormControl orientation={(isHorizontal || autoRefreshDomain) ? 'horizontal' : undefined}>
      {!!label && <FormLabelStart title={label} sx={/*{ mb: '0.25rem' }*/ undefined} />}
      {/*<Box sx={{ display: 'flex', justifyContent: 'space-between' }}>*/}
      <Select
        color={options.color}
        variant={options.variant ?? 'outlined'}
        value={showNoOptions ? null : llmId ?? null}
        size={larger ? undefined : 'sm'}
        disabled={disabled}
        onChange={onSelectChange}
        listboxOpen={controlledOpen}
        onListboxOpenChange={hasNoModels ? optimaOpenModels : setControlledOpen}
        placeholder={hasNoModels ? LLM_TEXT_CONFIGURE : placeholder}
        slotProps={_slotProps}
        endDecorator={autoRefreshDomain ?
          <TooltipOutlined title='Auto-select the model'>
            <IconButton onClick={() => llmsStoreActions().assignDomainModelId(autoRefreshDomain, null)}>
              <AutoModeIcon />
            </IconButton>
          </TooltipOutlined>
          : isReasoning ? '🧠' : undefined}
        sx={options.sx ?? llmSelectSx}
      >
        {optionsArray}
      </Select>
      {/*</Box>*/}
    </FormControl>
  ), [autoRefreshDomain, controlledOpen, disabled, hasNoModels, isHorizontal, isReasoning, label, larger, llmId, onSelectChange, options.color, options.sx, options.variant, optionsArray, placeholder, showNoOptions]);

  // Memo the vendor icon for the chat LLM
  const chatLLMVendorIconFC = React.useMemo(() => {
    return findModelVendor(llm?.vId)?.Icon;
  }, [llm?.vId]);

  return [llm, llmSelectComponent, chatLLMVendorIconFC];
}