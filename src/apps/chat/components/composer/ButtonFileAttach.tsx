import * as React from 'react';

import { Box, Button, IconButton, Stack, Tooltip } from '@mui/joy';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';


const attachFileLegend =
  <Stack sx={{ p: 1, gap: 1 }}>
    <Box sx={{ mb: 1 }}>
      <b>Attach a file</b>
    </Box>
    <table>
      <tbody>
      <tr>
        <td><b>Text</b></td>
        <td align='center' style={{ opacity: 0.5 }}>→</td>
        <td>📝 As-is</td>
      </tr>
      <tr>
        <td><b>Code</b></td>
        <td align='center' style={{ opacity: 0.5 }}>→</td>
        <td>📚 Markdown</td>
      </tr>
      <tr>
        <td><b>PDF</b></td>
        <td width={36} align='center' style={{ opacity: 0.5 }}>→</td>
        <td>📝 Text (summarized)</td>
      </tr>
      </tbody>
    </table>
    <Box sx={{ mt: 1, fontSize: '14px' }}>
      Drag & drop in chat for faster loads ⚡
    </Box>
  </Stack>;


export const ButtonFileAttach = (props: { isMobile: boolean, onAttachFilePicker: () => void }) =>
  props.isMobile ? (
    <IconButton onClick={props.onAttachFilePicker}>
      <AttachFileOutlinedIcon />
    </IconButton>
  ) : (
    <Tooltip variant='solid' placement='top-start' title={attachFileLegend}>
      <Button fullWidth variant='plain' color='neutral' onClick={props.onAttachFilePicker} startDecorator={<AttachFileOutlinedIcon />}
              sx={{ justifyContent: 'flex-start' }}>
        Attach
      </Button>
    </Tooltip>
  );