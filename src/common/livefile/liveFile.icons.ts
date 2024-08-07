import { styled } from '@mui/joy';
// import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import FileOpenOutlinedIcon from '@mui/icons-material/FileOpenOutlined';
import MobiledataOffIcon from '@mui/icons-material/MobiledataOff';
import MultipleStopIcon from '@mui/icons-material/MultipleStop';
import SaveIcon from '@mui/icons-material/SaveOutlined';
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt';
// import UploadFileIcon from '@mui/icons-material/UploadFile';

export const LiveFileIcon = styled(MultipleStopIcon)({
  rotate: '90deg',
});

export { FileOpenOutlinedIcon as LiveFileChooseIcon };
export { MobiledataOffIcon as LiveFileCloseIcon };
export { SaveIcon as LiveFileSaveIcon };
export { SystemUpdateAltIcon as LiveFileReloadIcon };
