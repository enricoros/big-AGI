import * as React from 'react';

import { Button, Tooltip } from '@mui/joy';

interface CodeBlockProps {
  codeBlock: {
    code: string;
    language?: string;
  };
}

export function OpenInReplit({ codeBlock }: CodeBlockProps): React.JSX.Element {
  const { language } = codeBlock;

  const replitLanguageMap: { [key: string]: string } = {
    python: 'python3',
    csharp: 'csharp',
    java: 'java',
  };

  const handleOpenInReplit = () => {
    const replitLanguage = replitLanguageMap[language || 'python'];
    const url = new URL(`https://replit.com/languages/${replitLanguage}`);
    window.open(url.toString(), '_blank');
  };

  return (
    <Tooltip title={`Open in Replit (${codeBlock.language})`} variant='solid'>
      <Button variant='outlined' color='neutral' onClick={handleOpenInReplit}>
        Replit
      </Button>
    </Tooltip>
  );
}
