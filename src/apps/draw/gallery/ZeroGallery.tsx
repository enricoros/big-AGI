import * as React from 'react';

import { Card } from '@mui/joy';

import { AutoBlocksRenderer } from '~/modules/blocks/AutoBlocksRenderer';


const zeroGalleryMd = `
### {{title}}

You haven't created any images yet. To get started:

- Use **/draw your idea** in the **Chat** application.
- Open the **Draw** application to create images from text prompts.

You can switch between **Gallery** and **App Media** in the top bar at any time.

Your past creations will appear here once you start drawing. 
`.trim();


export function ZeroGallery(props: { domain: 'draw' | 'app' }) {
  const text = zeroGalleryMd.replace('{{title}}', props.domain === 'draw'
    ? 'Empty Gallery'
    : 'No App Media',
  );
  return (
    <Card variant='soft' sx={{
      maxWidth: 'max(50%, 340px)',
      mx: 'auto',
      my: '2rem',
      backgroundColor: 'background.surface',
      borderRadius: 'lg',
      boxShadow: 'lg',
      display: 'flex',
      flexDirection: 'column',
      gap: 1,
    }}>
      {/*<Typography level='h4'>*/}
      {/*  {Brand.Title.Base} No Images */}
      {/*</Typography>*/}
      {/*<Typography level='title-sm' sx={{ whiteSpace: 'balance' }}>*/}
      <AutoBlocksRenderer
        text={text}
        fromRole='assistant'
        contentScaling='sm'
        fitScreen
        textRenderVariant='markdown'
      />
      {/*</Typography>*/}
    </Card>
  );
}