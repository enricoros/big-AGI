import { styled } from '@mui/joy';
import FileOpenOutlinedIcon from '@mui/icons-material/FileOpenOutlined';
import MultipleStopIcon from '@mui/icons-material/MultipleStop';
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt';
import UploadFileIcon from '@mui/icons-material/UploadFile';

export const LiveFileIcon = styled(MultipleStopIcon)({
  rotate: '90deg',
});

export { FileOpenOutlinedIcon as LiveFileChooseIcon };
export { SystemUpdateAltIcon as LiveFileReloadIcon };
export { UploadFileIcon as LiveFileSaveIcon };
