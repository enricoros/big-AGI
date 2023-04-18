import { Button, Tooltip } from '@mui/joy';

interface CodeBlockProps {
  codeBlock: {
    code: string;
    language?: string;
  };
}

export function OpenInReplit({ codeBlock }: CodeBlockProps): JSX.Element {
  const { code, language } = codeBlock;

  const replitLanguageMap: { [key: string]: string } = {
    python: 'python3',
    csharp: 'csharp',
    java: 'java',
  };

  const handleOpenInReplit = () => {
    const replitLanguage = replitLanguageMap[language || 'python'];
    const url = new URL(`https://replit.com/languages/${replitLanguage}`);
    url.searchParams.set('code', code);
    url.searchParams.set('title', `GPT ${new Date().toISOString()}`);
    window.open(url.toString(), '_blank');
  };

  return (
    <Tooltip title='Open in Replit' variant='solid'>
      <Button variant='outlined' color='neutral' onClick={handleOpenInReplit}>
        Replit
      </Button>
    </Tooltip>
  );
}
