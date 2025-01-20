import * as React from 'react';

import { Box, Chip, Typography } from '@mui/joy';
import { useScaledTypographySx } from '~/modules/blocks/blocks.styles';

import { ExpanderControlledBox } from '~/common/components/ExpanderControlledBox';
import { adjustContentScaling, ContentScaling } from '~/common/app.theme';
import { useUIComplexityIsMinimal } from '~/common/state/store-ui';


const _styles = {

  block: {
    mx: 1.5,
  } as const,

  chip: {
    px: 1,
    py: 0.25,
  } as const,

  text: {
    backgroundColor: 'background.level1',
    borderRadius: 'md',
    boxShadow: 'inset 1px 1px 4px -3px var(--joy-palette-neutral-solidBg)',
    mt: 1,
    p: 1,

    // plain text style
    overflowWrap: 'anywhere',
    whiteSpace: 'break-spaces',
  } as const,

} as const;

export function BlockPartModelAux(props: {
  auxType: 'reasoning' | string,
  auxText: string,
  contentScaling: ContentScaling,
}) {

  // state
  const [expanded, setExpanded] = React.useState(false);

  // external state
  const zenMode = useUIComplexityIsMinimal();

  // memo
  const scaledTypographySx = useScaledTypographySx(adjustContentScaling(props.contentScaling, -1), false, false);
  const textSx = React.useMemo(() => ({ ..._styles.text, ...scaledTypographySx }), [scaledTypographySx]);

  let typeText = props.auxType === 'reasoning' ? 'Show Reasoning' : 'Show Auxiliary';
  if (!zenMode && props.auxType === 'reasoning')
    typeText = '🧠 ' + typeText;

  // create up to 3 dots '.' based on the length of the auxText (1 dot per 100 characters)
  // const dots = '.'.repeat(Math.floor(props.auxText.length / 100) % 5);

  return <Box sx={_styles.block}>

    {/* Chip to expand/collapse */}
    <Chip
      variant={expanded ? 'solid' : 'soft'}
      size="sm"
      onClick={() => setExpanded(on => !on)}
      sx={_styles.chip}
    >
      {typeText}
    </Chip>

    {/* Controlled Box */}
    <ExpanderControlledBox expanded={expanded}>

      <Typography sx={textSx}>
        {props.auxText}
      </Typography>

    </ExpanderControlledBox>

  </Box>;
}