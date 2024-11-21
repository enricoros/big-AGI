import Prism from 'prismjs';

// per-language JS plugins
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-mermaid';
import 'prismjs/components/prism-plant-uml';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-typescript';

// NOTE: must match Prism components imports
const hPrismLanguages = ['bash', 'css', 'java', 'javascript', 'json', 'markdown', 'mermaid', 'plant-uml', 'python', 'sql', 'typescript'];

const hFileExtensionsMap: { [key: string]: string } = {
  bash: 'bash', cs: 'csharp', html: 'html', java: 'java', js: 'javascript', json: 'json', jsx: 'javascript',
  md: 'markdown', mmd: 'mermaid', py: 'python', sh: 'bash', sql: 'sql', ts: 'typescript', tsx: 'typescript', xml: 'xml',
};

const hCodeIncipitMap: { starts: string[], language: string }[] = [
  { starts: ['<!DOCTYPE html', '<html'], language: 'html' },
  { starts: ['<'], language: 'xml' },
  { starts: ['from '], language: 'python' },
  { starts: ['import ', 'export '], language: 'typescript' }, // or python
  { starts: ['interface ', 'function '], language: 'typescript' }, // ambiguous
  { starts: ['package '], language: 'java' },
  { starts: ['using '], language: 'csharp' },
  { starts: ['#!/bin/'], language: 'bash' },
  { starts: ['@startuml', '@startmindmap', '@startsalt', '@startwbs', '@startgantt'], language: 'plant-uml' },
];


export function inferCodeLanguage(blockTitle: string, code: string): string | null {

  // if we have a block title, use it to infer the language
  if (blockTitle) {

    // single word: assume it's the syntax highlight language
    if (!blockTitle.includes('.'))
      return hFileExtensionsMap.hasOwnProperty(blockTitle) ? hFileExtensionsMap[blockTitle] : blockTitle;

    // file extension: map back to a language
    const extension = blockTitle.split('.').pop();
    if (extension && hFileExtensionsMap.hasOwnProperty(extension))
      return hFileExtensionsMap[extension];
  }

  // or, based on the first line of code, return the language
  for (const codeIncipit of hCodeIncipitMap)
    if (codeIncipit.starts.some((start) => code.startsWith(start)))
      return codeIncipit.language;

  // or, use Prism with language tokenization to and-detect the language
  // FIXME: this is a very poor way to detect the language, as it's tokenizing it in any language
  //        and getting the one with the most tokens - which may as well be the wrong one
  let detectedLanguage: string | null = null;
  let maxTokens = 0;
  hPrismLanguages.forEach((language) => {
    const grammar = Prism.languages[language];
    // Load the specified language if it's not loaded yet
    // NOTE: this is commented out because it inflates the size of the bundle by 200k
    // if (!Prism.languages[language]) {
    //   try {
    //     require(`prismjs/components/prism-${language}`);
    //   } catch (e) {
    //     console.warn(`Prism language '${language}' not found, falling back to 'typescript'`);
    //   }
    // }
    const tokens = Prism.tokenize(code, grammar);
    const tokenCount = tokens.filter((token) => typeof token !== 'string').length;
    if (tokenCount > maxTokens) {
      maxTokens = tokenCount;
      detectedLanguage = language;
    }
  });
  return detectedLanguage;
}

export function highlightCode(inferredCodeLanguage: string | null, blockCode: string, addLineNumbers: boolean): string {
  // NOTE: to save power, we could skip highlighting until the block is complete (future feature)
  const safeHighlightLanguage = inferredCodeLanguage || 'typescript';
  const code = Prism.highlight(
    blockCode,
    Prism.languages[safeHighlightLanguage] || Prism.languages.typescript,
    safeHighlightLanguage,
  );
  // add line numbers to the code block
  if (addLineNumbers) {
    // https://stackoverflow.com/questions/59508413/static-html-generation-with-prismjs-how-to-enable-line-numbers
    const linesMatcher = code.match(/\n(?!$)/g);
    const linesCount = linesMatcher ? linesMatcher.length + 1 : 1;
    const linesSpans = new Array(linesCount + 1).join('<span></span>');
    return code + `<span aria-hidden='true' class='line-numbers-rows'>${linesSpans}</span>`;
  }
  return code;
}