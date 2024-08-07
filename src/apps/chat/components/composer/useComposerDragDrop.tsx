import * as React from 'react';

import { SvgIcon } from '@mui/joy';
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded';

import { useDragDropDataTransfer } from '~/common/components/useDragDropDataTransfer';


export function useComposerDragDrop(
  enabled: boolean,
  onDataTransfer: (dataTransfer: DataTransfer, type: 'paste' | 'drop', isDropOnTextarea: boolean) => Promise<any>,
) {

  // drop implementation for the composer
  const handleComposerDrop = React.useCallback(async (dataTransfer: DataTransfer) => {

    // VSCode: detect failure of dropping from VSCode, details below:
    //         https://github.com/microsoft/vscode/issues/98629#issuecomment-634475572
    if (dataTransfer.types.includes('codeeditors')) {

      // Get the file paths
      let filePaths: string[] = [];
      if (dataTransfer.types.includes('codefiles')) {
        filePaths = JSON.parse(dataTransfer.getData('codefiles'));
      } else if (dataTransfer.types.includes('text/plain')) {
        filePaths = dataTransfer.getData('text/plain').split('\n').filter(Boolean);
      }
      const fileNames = filePaths.map(path => path.split('\\').pop() || path.split('/').pop() || 'unknown file');

      // just show an old school alert message (save callbacks)
      return alert([
        `Dropped ${fileNames.length} file${fileNames.length > 1 ? 's' : ''} from VSCode:`,
        ...fileNames.map((name, index) => `${index + 1}. ${name}`),
        '',
        'VSCode does not drag-and-drop to browsers. https://github.com/microsoft/vscode/issues/98629#issuecomment-634475572.',
        '',
        'Upload 📎, paste 📋, or drag from a folder 📁.',
      ].join('\n'));
    }

    // textarea drop
    void onDataTransfer(dataTransfer, 'drop', true); // fire/forget

  }, [onDataTransfer]);

  return useDragDropDataTransfer(enabled, 'I will hold on to this for you.', AttachFileRoundedIcon as typeof SvgIcon, 'largeIcon', false, handleComposerDrop);
}
