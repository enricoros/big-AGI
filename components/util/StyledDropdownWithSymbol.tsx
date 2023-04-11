import * as React from 'react';

import { StyledDropdown } from './StyledDropdown';
import { SxProps } from '@mui/joy/styles/types';


/**
 * Wrapper for StyledDropdown that adds a symbol in front of the title
 */
type Props<TValue extends string> = {
  value: TValue;
  items: Record<string, { title: string, symbol: string }>;
  onChange: (event: any, value: TValue | null) => void;
  sx?: SxProps;
};

export const StyledDropdownWithSymbol = <TValue extends string>({ value, items, onChange, sx }: Props<TValue>) => {
  const itemsWithSymbol = Object.keys(items).map((key: string) => ({
    key,
    value: (!!items[key].symbol ? items[key].symbol + ' ' : '') + items[key].title,
  }));

  return (
    <StyledDropdown
      value={value}
      items={Object.fromEntries(itemsWithSymbol.map(({ key, value }) => [key, { title: value }]))}
      onChange={onChange}
      sx={sx}
    />
  );
};