import * as React from 'react';

import { Button, Tooltip } from '@mui/joy';

interface CodeBlockProps {
  codeBlock: {
    code: string;
    language?: string;
  };
}

export function OpenInCodepen({ codeBlock }: CodeBlockProps): React.JSX.Element {
  const { code, language } = codeBlock;
  const hasCSS = language === 'css';
  const hasJS = ['javascript', 'json', 'typescript'].includes(language || '');
  const hasHTML = !hasCSS && !hasJS; // use HTML as fallback if an unanticipated frontend language is used

  const handleOpenInCodepen = () => {
    const data = {
      title: `GPT ${new Date().toISOString()}`, // eg "GPT 2021-08-31T15:00:00.000Z"
      css: hasCSS ? code : '',
      html: hasHTML ? code : '',
      js: hasJS ? code : '',
      editors: `${hasHTML ? 1 : 0}${hasCSS ? 1 : 0}${hasJS ? 1 : 0}` // eg '101' for HTML, JS
    };

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = 'https://codepen.io/pen/define';
    form.target = '_blank';

    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'data';
    input.value = JSON.stringify(data);

    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  };

  return (
    <Tooltip title='Open in Codepen' variant='solid'>
      <Button variant='outlined' color='neutral' onClick={handleOpenInCodepen}>
        Codepen
      </Button>
    </Tooltip>
  );
}
