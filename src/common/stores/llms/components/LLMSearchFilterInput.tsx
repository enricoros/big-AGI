import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { IconButton } from '@mui/joy';

import { DebouncedInputMemo } from '~/common/components/DebouncedInput';
import { StarredState } from '~/common/components/StarIcons';


const _styles = {
  filterBox: {
    m: 1.5,
    mb: 1,
    backgroundColor: 'background.level1',
    '&:focus-within': { backgroundColor: 'background.popup' },
  },
} as const satisfies Record<string, SxProps>;


/**
 * Model Selection Dropdowns: Shared search input with starred filter toggle
 */
export const LLMSearchFilterInput = React.memo(function LLMSearchFilterInput(props: {
  size?: 'sm' | 'md' | 'lg',
  llmsCount: number,
  onSearch: (search: string | null) => void,
  onStarredToggle?: () => void, // if provided, shows the starred filter button
  showStarredOnly?: boolean,
}) {
  return (
    <DebouncedInputMemo
      size={props.size}
      aggressiveRefocus
      debounceTimeout={300}
      onDebounce={props.onSearch}
      placeholder={`Search ${props.llmsCount} models...`}
      startDecorator={props.onStarredToggle ? (
        <IconButton
          size='sm'
          variant='plain'
          aria-label='Filter starred models'
          onClick={props.onStarredToggle}
        >
          <StarredState isStarred={!!props.showStarredOnly} />
          {/*<StarIconUnstyled isStarred={showStarredOnly} />*/}
        </IconButton>
      ) : undefined}
      sx={_styles.filterBox}
    />
  );
});
