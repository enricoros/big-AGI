import * as React from 'react';

import type { SelectSlotsAndSlotProps } from '@mui/joy/Select/SelectProps';
import { Box, ListDivider, listItemButtonClasses, ListItemDecorator, Option, optionClasses, Select, selectClasses } from '@mui/joy';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';


// set to true to enable the dense mode, which is default in the rest of the app
const useDenseDropdowns = false;
// set to false to use normal icons - check with similar menus
const useBigIcons = true;


const _selectSlotProps: SelectSlotsAndSlotProps<false>['slotProps'] = {
  root: {
    sx: {
      backgroundColor: 'transparent',
      // minWidth: selectMinWidth, // 160
      maxWidth: 'calc(100dvw - 4.5rem)', /* 36px * 2 buttons (2 * var(--Bar)) */
      // disappear when the 'agi-gone' class is set
      '&.agi-gone': {
        display: 'none',
      },
    },
  },
  button: {
    className: 'agi-ellipsize',
    sx: {
      // these + the ellipsize class will ellipsize the text in the button
      display: 'inline-block',
      maxWidth: 300,
    },
  },
  indicator: {
    sx: {
      // additive white 50%
      color: 'rgba(255 255 255 / 0.5)',
      // revolves around when clicked
      transition: '0.2s',
      [`&.${selectClasses.expanded}`]: {
        transform: 'rotate(-180deg)',
      },
    },
  },
  listbox: {
    // Note: we explored disablePortal, which could optimize performance, but it breaks the colors (as they'll look inverted)
    // disablePortal: false,
    variant: 'outlined',
    sx: {
      // in sync with CloseableMenu
      '--ListItem-minHeight': useDenseDropdowns
        ? '2.25rem' /* 2.25 is the default */
        : '2.75rem', /* we enlarge the default  */
      ...(useBigIcons && {
        '--Icon-fontSize': 'var(--joy-fontSize-xl2)',
        // '--ListItemDecorator-size': '2.75rem',
      }),

      // transfer the padding onto the scrollable box
      paddingBlock: 0,

      // v-size: do not exceed the height of the screen
      maxHeight: 'calc(100dvh - 56px - 24px)',

      // Option: clip width to 160...360px
      [`& .${optionClasses.root}`]: {
        maxWidth: 'min(360px, calc(100dvw - 1rem))',
        minWidth: 160,
      },

      // Button styles
      [`& .${listItemButtonClasses.root}`]: {
        minWidth: 160,
      },
    },
  },
};

const _styles = {

  prependGap: {
    height: 'var(--ListDivider-gap)',
  } as const,

  itemsScrollable: {
    overflow: 'auto',
    paddingBlock: 'var(--ListDivider-gap)',
  } as const,

  symbolDecorator: {
    fontSize: 'xl',
  } as const,

  divider: {
    my: 0,
  } as const,

} as const;


export type OptimaDropdownItems = Record<string, {
  title: string,
  symbol?: string,
  type?: 'separator'
  icon?: React.ReactNode,
}>;


export const OptimaBarDropdownMemo = React.memo(React.forwardRef(OptimaBarDropdown));

export type OptimaBarControlMethods = {
  openListbox: () => void,
  // closeListbox: () => void,
};

/**
 * A Select component that blends-in nicely (cleaner, easier to the eyes)
 */
function OptimaBarDropdown<TValue extends string>(props: {
  // required
  items: OptimaDropdownItems,
  value: TValue | null,
  onChange: (value: TValue | null) => void,
  // optional
  activeEndDecorator?: React.JSX.Element,
  prependOption?: React.JSX.Element
  appendOption?: React.JSX.Element,
  placeholder?: string,
  showSymbols?: boolean,
  showGone?: boolean,
}, ref: React.Ref<OptimaBarControlMethods>) {

  // state
  const [listboxOpen, setListboxOpen] = React.useState(false);

  // Expose control methods via the ref
  React.useImperativeHandle(ref, () => ({
    openListbox: () => {
      setListboxOpen(true);
    },
    // closeListbox: () => {
    //   setListboxOpen(false);
    // },
  }), []);

  // derived state
  const { onChange } = props;

  const handleOnChange = React.useCallback((_event: any, value: TValue | null) => {
    onChange(value);
  }, [onChange]);

  const handleOnOpenChange = React.useCallback((isOpen: boolean) => {
    if (isOpen !== listboxOpen)
      setListboxOpen(isOpen);
  }, [listboxOpen]);

  const itemsKeys = Object.keys(props.items);
  const hasItems = itemsKeys.length >= 1;

  return (
    <Select
      variant='plain'
      value={props.value}
      onChange={handleOnChange}
      placeholder={props.placeholder}
      listboxOpen={listboxOpen}
      onListboxOpenChange={handleOnOpenChange}
      indicator={<KeyboardArrowDownIcon />}
      slotProps={_selectSlotProps}
      className={props.showGone ? 'agi-gone' : ''}
    >

      {/* Prepender */}
      {!!props.prependOption && <Box sx={_styles.prependGap} />}
      {props.prependOption}
      {/*{!!props.prependOption && hasItems && <ListDivider sx={_styles.divider} />}*/}

      {/* Scrollable Items list*/}
      {hasItems && <Box sx={_styles.itemsScrollable}>
        {itemsKeys.map((_itemKey: string, idx: number) => {
          const _item = props.items[_itemKey];
          const isActive = _itemKey === props.value;

          // Label & Decorators
          let label = _item.title || '';
          let decorator: React.ReactNode = null;
          if (props.showSymbols) {
            if (_item.icon)
              decorator = <ListItemDecorator>{_item.icon}</ListItemDecorator>;
            else if (_item.symbol !== undefined)
              decorator = <ListItemDecorator sx={_styles.symbolDecorator}>{_item.symbol || ''}</ListItemDecorator>;
            if (_item.symbol)
              label = `${_item.symbol} ${label}`;
          }

          return _item.type === 'separator' ? (
            <ListDivider key={_itemKey || `sep-${idx}`}>
              {/*<Box sx={{ display: 'flex', alignItems: 'center', gap: 1, '--Icon-fontSize': 'var(--joy-fontSize-lg)' }}>*/}
              {/*{_item.icon} */}
              {_item.title}
              {/*</Box>*/}
            </ListDivider>
          ) : (
            <Option key={_itemKey} value={_itemKey} label={label}>
              {/* Icon / Symbol */}
              {decorator}

              {/* Text */}
              <div className='agi-ellipsize'>
                {_item.title}
              </div>

              {/* Optional End Decorator */}
              {isActive && props.activeEndDecorator}
            </Option>
          );
        })}
      </Box>}

      {/* Appender */}
      {!!props.appendOption && hasItems && <ListDivider sx={_styles.divider} />}
      {props.appendOption}
      {/*{!!props.appendOption && <Box sx={{ height: 'var(--ListDivider-gap)' }} />}*/}

    </Select>
  );
}