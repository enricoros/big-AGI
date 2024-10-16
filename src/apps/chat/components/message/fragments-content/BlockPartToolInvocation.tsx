import * as React from 'react';

import type { ColorPaletteProp, SxProps, VariantProp } from '@mui/joy/styles/types';
import { Sheet } from '@mui/joy';

import { BlocksContainer } from '~/modules/blocks/BlocksContainers';
import { useScaledTypographySx } from '~/modules/blocks/blocks.styles';

import type { ContentScaling } from '~/common/app.theme';
import type { DMessageToolInvocationPart } from '~/common/stores/chat/chat.fragments';


const keyValueGridSx = {
  border: '1px solid',
  borderRadius: 'sm',
  boxShadow: 'inset 2px 0 4px -2px rgba(0, 0, 0, 0.2)',
  p: 1.5,

  // Grid layout with 2 columns
  display: 'grid',
  gridTemplateColumns: 'auto 1fr',
  // alignItems: 'baseline',
  columnGap: 2,
  rowGap: 0.5,

  // fade the text of the first column
  // '& > :nth-of-type(odd)': {
  //   opacity: 0.67,
  //   // fontSize: '90%',
  // },
} as const;


export type KeyValueData = { label: string, value: React.ReactNode, asCode?: boolean }[];

export function KeyValueGrid(props: {
  data: KeyValueData,
  contentScaling: ContentScaling,
  color?: ColorPaletteProp,
  variant?: VariantProp,
  stableSx?: SxProps,
}) {

  const { fontSize, lineHeight } = useScaledTypographySx(props.contentScaling, false, false);

  const gridSx = React.useMemo(() => ({
    ...keyValueGridSx,
    // fontWeight,
    fontSize,
    lineHeight,
    ...props.stableSx,
  }), [fontSize, lineHeight, props.stableSx]);

  return (
    <Sheet color={props.color} variant={props.variant || 'soft'} sx={gridSx}>
      {props.data.map(({ label, value }, index) => (
        <React.Fragment key={index}>
          <div>{label}</div>
          <div>{value}</div>
        </React.Fragment>
      ))}
    </Sheet>
  );
}


export function BlockPartToolInvocation(props: {
  toolInvocationPart: DMessageToolInvocationPart,
  contentScaling: ContentScaling,
  onDoubleClick?: (event: React.MouseEvent) => void;
}) {

  const part = props.toolInvocationPart;

  const kvData: KeyValueData = React.useMemo(() => {
    switch (part.invocation.type) {
      case 'function_call':
        return [
          { label: 'Name', value: <strong>{part.invocation.name}</strong> },
          { label: 'Args', value: part.invocation.args || 'None', asCode: true },
          { label: 'Id', value: part.id },
        ];
      case 'code_execution':
        return [
          { label: 'Language', value: part.invocation.language },
          { label: 'Author', value: part.invocation.author },
          {
            label: 'Code',
            value: <div style={{ whiteSpace: 'pre-wrap' }}>{part.invocation.code.trim()}</div>,
          },
          { label: 'Id', value: part.id },
        ];
    }
  }, [part]);

  return (
    <BlocksContainer onDoubleClick={props.onDoubleClick}>
      <KeyValueGrid
        data={kvData}
        contentScaling={props.contentScaling}
      />
    </BlocksContainer>
  );
}
