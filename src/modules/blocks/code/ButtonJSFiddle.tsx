import * as React from 'react';

import { Tooltip } from '@mui/joy';

import { OverlayButton } from './RenderCode';


// JSFiidle is a web-based HTML, CSS, and JavaScript code editor
const _languages = ['html', 'css', 'javascript', 'json', 'typescript'];

export function isJSFiddleSupported(language: string | null, code: string) {
  return !!language && _languages.includes(language) && code?.length > 10;
}

const handleOpenInJsFiddle = (code: string, language: string) => {
  // heuristics to assing the code to one of the blocks
  const isHTML = language === 'html';
  const isCSS = language === 'css';
  const isJSorUnknown = !isHTML && !isCSS;

  const form = document.createElement('form');
  form.action = 'https://jsfiddle.net/api/post/library/pure/';
  form.method = 'POST';
  form.target = '_blank'; // Open in a new tab

  // Dynamically determine what to populate based on language or content type
  const inputHtml = document.createElement('input');
  inputHtml.type = 'hidden';
  inputHtml.name = 'html'; // For HTML content
  inputHtml.value = isHTML ? code : '';
  form.appendChild(inputHtml);

  const inputCss = document.createElement('input');
  inputCss.type = 'hidden';
  inputCss.name = 'css'; // For CSS content
  inputCss.value = isCSS ? code : '';
  form.appendChild(inputCss);

  const inputJs = document.createElement('input');
  inputJs.type = 'hidden';
  inputJs.name = 'js'; // For JavaScript content
  inputJs.value = isJSorUnknown ? code : '';
  form.appendChild(inputJs);

  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
};


export function ButtonJsFiddle(props: { code: string, language: string }): React.JSX.Element {
  return (
    <Tooltip title='Open in JSFiddle' variant='solid'>
      <OverlayButton variant='outlined' onClick={() => handleOpenInJsFiddle(props.code, props.language)}>
        JS
      </OverlayButton>
    </Tooltip>
  );
}