import * as React from 'react';

import { Box, Button, IconButton, Tooltip } from '@mui/joy';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';


const attachFileLegend =
  <Box sx={{ px: 1, py: 0.75, lineHeight: '1.5rem' }}>
    <b>Attach files</b><br />
    Drag & drop in chat for faster loads ⚡
  </Box>;


export const ButtonAttachFileMemo = React.memo(ButtonAttachFile);

function ButtonAttachFile(props: { isMobile?: boolean, onAttachFilePicker: () => void }) {
  return props.isMobile ? (
    <IconButton onClick={props.onAttachFilePicker}>
      <AttachFileOutlinedIcon />
    </IconButton>
  ) : (
    <Tooltip disableInteractive variant='solid' placement='top-start' title={attachFileLegend}>
      <Button fullWidth variant='plain' color='neutral' onClick={props.onAttachFilePicker} startDecorator={<AttachFileOutlinedIcon />}
              sx={{ justifyContent: 'flex-start' }}>
        File
      </Button>
    </Tooltip>
  );
}