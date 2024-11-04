import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box } from '@mui/joy';

import { ScaledTextBlockRenderer } from '~/modules/blocks/ScaledTextBlockRenderer';

import type { DMessageDocPart } from '~/common/stores/chat/chat.fragments';
import { GoodModal } from '~/common/components/modals/GoodModal';


const containerSx: SxProps = {
  maxHeight: '80vh',
  overflow: 'auto',
  display: 'grid',
  gap: 2,
};

const propGridSx: SxProps = {
  display: 'grid',
  gridTemplateColumns: 'auto 1fr auto 1fr',
  alignItems: 'center',
  columnGap: 2,
  rowGap: 1,
  '& > :nth-of-type(odd)': {
    color: 'text.secondary',
    fontSize: 'xs',
  },
};

const textPageSx: SxProps = {
  // style it up, as there's nothing
  backgroundColor: 'background.surface',
  boxShadow: 'xs',
  borderRadius: 'sm',

  // pad better the ScaledTextBlockRenderer (add 1.5 vertical as 1.5 hor is built in)
  '& > div': {
    py: 1.5,
  },
};


export function ViewDocPartModal(props: {
  docPart: DMessageDocPart,
  onClose: () => void,
}) {

  // state
  // const [forceCodeRender, setForceCodeRender] = React.useState(false);

  const { docPart } = props;

  const mimeType = docPart.data?.mimeType || '(unknown)';

  const renderAsMarkdown = mimeType === 'text/markdown';
  // const renderAsCode = docPart.vdt === 'application/vnd.agi.code';

  return (
    <GoodModal
      open={true}
      onClose={props.onClose}
      title='Text Attachment'
      noTitleBar={false}
      sx={{ maxWidth: '90vw', backgroundColor: 'background.level2' }}
    >

      <Box sx={containerSx}>

        <Box color='primary' sx={{ px: 1.5, fontSize: 'sm' }}>
          <Box sx={propGridSx}>
            <div>Doc Title</div>
            <div>{docPart.l1Title}</div>
            <div>Identifier</div>
            <div>{docPart.ref}</div>
            <div>Mime Type</div>
            <div>{docPart.data?.mimeType || '(unknown)'}</div>
            <div>Render Type</div>
            <div>{docPart.vdt}</div>
            <div>Rendering As</div>
            <div>{renderAsMarkdown ? 'Markdown' : /*renderAsCode ? 'Code' :*/ 'Text'} (auto)</div>
            <div>Doc Version</div>
            <div>{docPart.version || '(none)'}</div>
          </Box>
        </Box>

        <Box sx={textPageSx}>
          <ScaledTextBlockRenderer
            text={docPart.data.text}
            contentScaling='sm'
            textRenderVariant={renderAsMarkdown ? 'markdown' : 'text'}
          />
        </Box>

      </Box>
    </GoodModal>
  );
}
