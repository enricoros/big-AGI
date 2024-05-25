import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { FormControl, Option, Select } from '@mui/joy';

import { TiktokenTokenizers } from '~/common/util/token-counter';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';


const tokenizerSelectSx: SxProps = {
  flex: 1,
  backgroundColor: 'background.popup',
};


/**
 * Select the Tokenizer
 *
 * @param initialTokenizerId (optional) the Tokenizer id
 * @param label label of the select, use '' to hide it
 * @param smaller if true, the select is smaller
 * @param disabled
 * @param placeholder placeholder of the select
 * @param isHorizontal if true, the select is horizontal (label - select)
 */
export function useTokenizerSelect(
  initialTokenizerId: string | null = null,
  label: string = 'Encoding',
  smaller: boolean = false,
  disabled: boolean = false,
  placeholder: string = 'Tokenizers …',
  isHorizontal: boolean = false,
): [string | null, string | null, React.JSX.Element | null] {

  // local state
  const [tokenizerId, setTokenizerId] = React.useState<string | null>(initialTokenizerId ? initialTokenizerId : TiktokenTokenizers[0].id);


  // derived state
  const selectedTokenizer = TiktokenTokenizers.find(t => t.id === tokenizerId);


  // callbacks
  const onSelectChange = React.useCallback((_event: unknown, value: string | null) => setTokenizerId(value), []);


  // memoed components
  const componentOptions = React.useMemo(() => {
    return TiktokenTokenizers.map(tokenizer => (
      <Option key={'tokenizer-' + tokenizer.id} value={tokenizer.id}>
        OpenAI · {tokenizer.label}
      </Option>
    ));
  }, []);

  const tokenizerSelectComponent = React.useMemo(() => (
    <FormControl orientation={isHorizontal ? 'horizontal' : undefined}>
      {!!label && <FormLabelStart title={label} />}
      <Select
        variant='outlined'
        value={tokenizerId}
        size={smaller ? 'sm' : undefined}
        disabled={disabled}
        onChange={onSelectChange}
        placeholder={placeholder}
        slotProps={{
          listbox: {
            sx: {
              '--ListItem-paddingLeft': '1rem',
              '--ListItem-minHeight': '2.5rem',
            },
          },
          button: {
            sx: {
              whiteSpace: 'inherit',
            },
          },
        }}
        sx={tokenizerSelectSx}
      >
        {componentOptions}
      </Select>
    </FormControl>
  ), [tokenizerId, componentOptions, disabled, isHorizontal, label, onSelectChange, placeholder, smaller]);

  return [tokenizerId, selectedTokenizer?.label || null, tokenizerSelectComponent];
}