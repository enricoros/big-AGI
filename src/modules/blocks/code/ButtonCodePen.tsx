import * as React from 'react';

import { IconButton, Tooltip } from '@mui/joy';

import { CodePenIcon } from '~/common/components/icons/3rdparty/CodePenIcon';
import { Brand } from '~/common/app.config';


// CodePen is a web-based HTML, CSS, and JavaScript code editor
const _languages = ['html', 'css', 'javascript', 'json', 'typescript'];

export function isCodePenSupported(language: string | null, isSVG: boolean) {
  return isSVG || (!!language && _languages.includes(language));
}

const handleOpenInCodePen = (code: string, language: string) => {
  // CodePen has 3 editors: HTML, CSS, JS - we decide here where to put the code
  const hasCSS = language === 'css';
  const hasJS = language ? ['javascript', 'json', 'typescript'].includes(language) : false;
  const hasHTML = !hasCSS && !hasJS; // use HTML as fallback if an unanticipated frontend language is used

  const form = document.createElement('form');
  form.action = 'https://codepen.io/pen/define';
  form.method = 'POST';
  form.target = '_blank';

  const payload = {
    title: `${Brand.Title.Base} Code - ${new Date().toISOString()}`, // eg "GPT 2021-08-31T15:00:00.000Z"
    css: hasCSS ? code : '',
    html: hasHTML ? code : '',
    js: hasJS ? code : '',
    editors: `${hasHTML ? 1 : 0}${hasCSS ? 1 : 0}${hasJS ? 1 : 0}`, // eg '101' for HTML, JS
  };

  const input = document.createElement('input');
  input.type = 'hidden';
  input.name = 'data';
  input.value = JSON.stringify(payload);
  form.appendChild(input);

  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
};


export function ButtonCodePen(props: { code: string, language: string }): React.JSX.Element {
  return (
    <Tooltip title='Open in CodePen' variant='solid'>
      <IconButton variant='outlined' color='neutral' onClick={() => handleOpenInCodePen(props.code, props.language)}>
        <CodePenIcon />
      </IconButton>
    </Tooltip>
  );
}