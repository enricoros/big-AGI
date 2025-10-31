import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Chip, ColorPaletteProp, FormControl, IconButton, ListDivider, ListItemDecorator, Option, optionClasses, Select, SelectSlotsAndSlotProps, SvgIconProps, VariantProp } from '@mui/joy';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import AutoModeIcon from '@mui/icons-material/AutoMode';
import BuildCircleIcon from '@mui/icons-material/BuildCircle';

import type { IModelVendor } from '~/modules/llms/vendors/IModelVendor';
import { findModelVendor } from '~/modules/llms/vendors/vendors.registry';
import { llmsGetVendorIcon, LLMVendorIcon } from '~/modules/llms/components/LLMVendorIcon';

import type { DModelDomainId } from '~/common/stores/llms/model.domains.types';
import { DLLM, DLLMId, getLLMPricing, LLM_IF_OAI_Reasoning, LLM_IF_Outputs_Audio, LLM_IF_Outputs_Image, LLM_IF_Tools_WebSearch } from '~/common/stores/llms/llms.types';
import { PhGearSixIcon } from '~/common/components/icons/phosphor/PhGearSixIcon';
import { StarredNoXL2 } from '~/common/components/StarIcons';
import { TooltipOutlined } from '~/common/components/TooltipOutlined';
import { getChatLLMId, llmsStoreActions } from '~/common/stores/llms/store-llms';
import { optimaActions, optimaOpenModels } from '~/common/layout/optima/useOptima';
import { useVisibleLLMs } from '~/common/stores/llms/llms.hooks';

import { FormLabelStart } from './FormLabelStart';


// configuration
const LLM_SELECT_REDUCE_OPTIONS = 10; // optimization: number of options over which only the selected is kept when closed (we'll have special notes for accessibility)
const LLM_SELECT_SHOW_REASONING_ICON = false;
const LLM_TEXT_PLACEHOLDER = 'Models …';
const LLM_TEXT_CONFIGURE = 'Add Models …';
const LLM_SPECIAL_CONFIGURE_ID = '_CONF_' as DLLMId; // special id to open the Models panel


/*export function useLLMSelectGlobalState(): [DLLMId | null, (llmId: DLLMId | null) => void] {
  return ...(useShallow(state => [state.chatLLMId, state.setChatLLMId]));
}*/

export function useLLMSelectLocalState(initFromGlobal: boolean): [DLLMId | null, (llmId: DLLMId | null) => void] {
  return React.useState<DLLMId | null>(initFromGlobal ? () => {
    return getChatLLMId();
  } : null);
}

const _styles = {
  select: {
    flex: 1,
    backgroundColor: 'background.popup',
    // minWidth: '200',
  },
  chips: {
    ml: 'auto',
    backgroundColor: 'background.popup',
    boxShadow: 'xs',
  },
  configButton: {
    ml: 'auto',
    my: -0.5,
    // mr: -0.25,
    backgroundColor: 'background.popup',
    boxShadow: 'xs',
  },
  listVendor: {
    // see OptimaBarDropdown's _styles.separator
    fontSize: 'sm',
    color: 'text.tertiary',
    textAlign: 'center',
    my: 0.75,
  },
  listConfSep: {
    mb: 0,
  },
  listConfigure: {
    py: 'calc(2 * var(--ListDivider-gap))',
  },
} as const satisfies Record<string, SxProps>;

const _slotProps: SelectSlotsAndSlotProps<false>['slotProps'] = {
  // see the OptimaBarDropdown.listbox for a well made customization (max-height, max-width, etc.)
  listbox: {
    sx: {
      // larger list
      '--ListItem-paddingLeft': '1rem',
      '--ListItem-minHeight': '2.5rem', // note that in the Optima Dropdowns we use 2.75rem

      // No need for larger SVG icons here
      // '--Icon-fontSize': 'var(--joy-fontSize-xl2)',

      // remove the gutter from the bottom, which makes the 'appendConfigureModels' option look
      // good, but makes the default case a bit too close to the bottom
      paddingBottom: 0,

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
  appendConfigureModels?: boolean; // appends a bottom option to open the Models panel
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
  const { label, larger = false, disabled = false, placeholder = LLM_TEXT_PLACEHOLDER, isHorizontal = false, autoRefreshDomain, appendConfigureModels = false } = options;
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
        acc.push(<Box key={'llm-sep-' + llm.id} sx={_styles.listVendor}>{vendor?.name}</Box>);

      let features = '';
      const isNotSymlink = !llm.label.startsWith('🔗');
      const seemsFree = !!getLLMPricing(llm)?.chat?._isFree;
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

      const showModelOptions = llm.id === llmId && !optimizeToSingleVisibleId;

      // the option component
      acc.push(
        <Option
          key={llm.id}
          value={llm.id}
          // Disabled to avoid regenerating the memo too frequently
          // sx={llm.id === llmId ? { fontWeight: 'md' } : undefined}
          label={llm.label}
        >
          {!noIcons && (
            <ListItemDecorator>
              {llm.userStarred ? <StarredNoXL2 /> : vendor?.id ? <LLMVendorIcon vendorId={vendor.id} /> : null}
            </ListItemDecorator>
          )}
          {/*<Tooltip title={llm.description}>*/}

          <div className='agi-ellipsize'>{llm.label}</div>

          {/* Features Chips - sync with `ModelsList.tsx` */}
          {!!features && !showModelOptions && <Chip size='sm' color={seemsFree ? 'success' : undefined} variant='plain' sx={_styles.chips}>{features.trim().replace(' ', ' ')}</Chip>}

          {/* Settings button on active model (only when not optimized) */}
          {showModelOptions && (
            <TooltipOutlined title='Model Settings'>
              <IconButton
                size='sm'
                // color='neutral'
                // variant='outlined'
                onClick={(e) => {
                  e.stopPropagation();
                  optimaActions().openModelOptions(llm.id);
                }}
                sx={_styles.configButton}
              >
                <PhGearSixIcon />
              </IconButton>
            </TooltipOutlined>
          )}

          {/*</Tooltip>*/}
          {/*{llm.gen === 'sdxl' && <Chip size='sm' variant='outlined'>XL</Chip>} {llm.label}*/}
        </Option>,
      );

      return acc;
    }, [] as React.JSX.Element[]);
  }, [_filteredLLMs, llmId, noIcons, optimizeToSingleVisibleId]);


  const onSelectChange = React.useCallback((_event: unknown, value: DLLMId | null) => {
    // special: open the Models panel
    if (value === LLM_SPECIAL_CONFIGURE_ID) return optimaOpenModels();
    // invoke the callback if the selection is non-null
    value && setLlmId(value);
  }, [setLlmId]);


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
        sx={options.sx ?? _styles.select}
      >

        {/* Model Options */}
        {optionsArray}

        {/* Models Modal Dialog Option */}
        {appendConfigureModels && !optimizeToSingleVisibleId && !hasNoModels && !showNoOptions && <ListDivider key='cm-sep' sx={_styles.listConfSep} />}
        {appendConfigureModels && !optimizeToSingleVisibleId && !hasNoModels && (
          <Option key='cm-option' variant='soft' value={LLM_SPECIAL_CONFIGURE_ID} sx={_styles.listConfigure}>
            <ListItemDecorator><BuildCircleIcon color='success' /></ListItemDecorator>
            Models
            <ArrowForwardRoundedIcon sx={{ ml: 'auto', fontSize: 'xl' }} />
          </Option>
        )}

      </Select>
      {/*</Box>*/}
    </FormControl>
  ), [appendConfigureModels, autoRefreshDomain, controlledOpen, disabled, hasNoModels, isHorizontal, isReasoning, label, larger, llmId, onSelectChange, optimizeToSingleVisibleId, options.color, options.sx, options.variant, optionsArray, placeholder, showNoOptions]);

  // Memo the vendor icon for the chat LLM
  const chatLLMVendorIconFC = React.useMemo(() => {
    return !llm?.vId ? undefined : llmsGetVendorIcon(llm.vId);
  }, [llm?.vId]);

  return [llm, llmSelectComponent, chatLLMVendorIconFC];
}