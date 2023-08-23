import Prism from 'prismjs';

// per-language JS plugins
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-typescript';


const hFileExtensionsMap: { [key: string]: string } = {
  cs: 'csharp', html: 'html', java: 'java', js: 'javascript', json: 'json', jsx: 'javascript',
  md: 'markdown', py: 'python', sh: 'bash', ts: 'typescript', tsx: 'typescript', xml: 'xml',
};

const hCodeIncipitMap: { starts: string[], language: string }[] = [
  { starts: ['<!DOCTYPE html', '<html'], language: 'html' },
  { starts: ['<'], language: 'xml' },
  { starts: ['from '], language: 'python' },
  { starts: ['import ', 'export '], language: 'typescript' }, // or python
  { starts: ['interface ', 'function '], language: 'typescript' }, // ambiguous
  { starts: ['package '], language: 'java' },
  { starts: ['using '], language: 'csharp' },
];

// NOTE: must match Prism components imports
const hPrismLanguages = ['bash', 'css', 'java', 'javascript', 'json', 'markdown', 'python', 'typescript'];


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

export function highlightCode(inferredCodeLanguage: string | null, blockCode: string): string {
  const safeHighlightLanguage = inferredCodeLanguage || 'typescript';
  return Prism.highlight(
    blockCode,
    Prism.languages[safeHighlightLanguage] || Prism.languages.typescript,
    safeHighlightLanguage,
  );
}