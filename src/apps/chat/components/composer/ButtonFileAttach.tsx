import { Box, Button, IconButton, Stack, Tooltip } from '@mui/joy';
import * as React from 'react';
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


export function ButtonFileAttach(props: { isMobile: boolean, onAttachFiles: (files: FileList) => Promise<void> }) {

  // state
  const attachmentFileInputRef = React.useRef<HTMLInputElement>(null);

  const handleShowFilePicker = () => attachmentFileInputRef.current?.click();

  const handleLoadAttachment = (event: React.ChangeEvent<HTMLInputElement>) => {
    // NOTE: resetting the target value allows for the selector dialog to pop-up again
    const files = event.target?.files;
    if (files && files.length >= 1)
      props.onAttachFiles(files).finally(() => event.target.value = '');
    else
      event.target.value = '';
  };

  return <>

    {/* Mobile icon or Desktop button */}
    {props.isMobile ? (
      <IconButton onClick={handleShowFilePicker}>
        <AttachFileOutlinedIcon />
      </IconButton>
    ) : (
      <Tooltip variant='solid' placement='top-start' title={attachFileLegend}>
        <Button fullWidth variant='plain' color='neutral' onClick={handleShowFilePicker} startDecorator={<AttachFileOutlinedIcon />}
                sx={{ justifyContent: 'flex-start' }}>
          Attach
        </Button>
      </Tooltip>
    )}

    <input type='file' multiple hidden ref={attachmentFileInputRef} onChange={handleLoadAttachment} />

  </>;
}