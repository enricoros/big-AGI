import * as React from 'react';

import { DropdownItems, PageBarDropdownMemo } from '~/common/layout/optima/components/PageBarDropdown';
import { Box } from '@mui/joy';
import { Link } from '~/common/components/Link';
import { ROUTE_INDEX } from '~/common/app.routes';
import { AgiSquircleIcon } from '~/common/components/icons/AgiSquircleIcon';


export type DrawSection = 'create' | 'browse' | 'media';

const drawDropdownItems: DropdownItems = {
  create: {
    title: 'Create Image',
  },
  browse: {
    title: 'View Gallery',
  },
  media: {
    title: 'App Media',
  },
};


function DrawSectionDropdown(props: {
  drawSection: DrawSection | null,
  setDrawSection: (drawSection: DrawSection | null) => void,
}) {

  const { setDrawSection } = props;

  const handleSystemPurposeChange = React.useCallback((value: string | null) => {
    setDrawSection(value as (DrawSection | null));
  }, [setDrawSection]);

  return (
    <PageBarDropdownMemo
      items={drawDropdownItems}
      value={props.drawSection}
      onChange={handleSystemPurposeChange}
    />
  );

}

export function useDrawSectionDropdown() {
  // state
  const [drawSection, setDrawSection] = React.useState<DrawSection | null>('create');

  const drawSectionDropdown = React.useMemo(() => (
    <Box sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1,
    }}>
      <Link href={ROUTE_INDEX}>
        <AgiSquircleIcon inverted sx={{ width: 32, height: 32, color: 'white' }} />
      </Link>

      <DrawSectionDropdown
        drawSection={drawSection}
        setDrawSection={setDrawSection}
      />
    </Box>
  ), [drawSection]);

  return { drawSection, drawSectionDropdown };
}
