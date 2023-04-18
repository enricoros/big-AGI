import * as React from 'react';

import { AppBarDropdown } from './AppBarDropdown';
import { SxProps } from '@mui/joy/styles/types';


/**
 * Wrapper for AppBarDropdown that adds a symbol in front of the title
 */
type Props<TValue extends string> = {
  value: TValue;
  items: Record<string, { title: string, symbol: string }>;
  onChange: (event: any, value: TValue | null) => void;
  sx?: SxProps;
};

export const AppBarDropdownWithSymbol = <TValue extends string>({ value, items, onChange, sx }: Props<TValue>) => {
  const itemsWithSymbol = Object.keys(items).map((key: string) => ({
    key,
    value: (!!items[key].symbol ? items[key].symbol + ' ' : '') + items[key].title,
  }));

  return (
    <AppBarDropdown
      value={value}
      items={Object.fromEntries(itemsWithSymbol.map(({ key, value }) => [key, { title: value }]))}
      onChange={onChange}
      sx={sx}
    />
  );
};