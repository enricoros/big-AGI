import Prism from 'prismjs';

// per-language plugins
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-typescript';

// theme
import 'prismjs/themes/prism.css';


export type Block = TextBlock | CodeBlock | ImageBlock | HtmlBlock;
export type TextBlock = { type: 'text'; content: string; };
export type CodeBlock = { type: 'code'; content: string; language: string | null; complete: boolean; code: string; };
export type ImageBlock = { type: 'image'; url: string; };
export type HtmlBlock = { type: 'html'; html: string; };


/**
 * TODO: expensive function, especially as it's not been used in incremental fashion
 */
export const parseBlocks = (forceText: boolean, text: string): Block[] => {
  if (forceText)
    return [{ type: 'text', content: text }];

  if (text.startsWith('https://images.prodia.xyz/') && text.endsWith('.png') && text.length > 60 && text.length < 70)
    return [{ type: 'image', url: text.trim() }];

  if (text.startsWith('<!DOCTYPE html'))
    return [{ type: 'html', html: text }];

  const codeBlockRegex = /`{3,}([\w\\.+-_]+)?\n([\s\S]*?)(`{3,}|$)/g;
  const result: Block[] = [];

  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    const markdownLanguage = (match[1] || '').trim();
    const code = match[2].trim();
    const blockEnd: string = match[3];

    // Load the specified language if it's not loaded yet
    // NOTE: this is commented out because it inflates the size of the bundle by 200k
    // if (!Prism.languages[language]) {
    //   try {
    //     require(`prismjs/components/prism-${language}`);
    //   } catch (e) {
    //     console.warn(`Prism language '${language}' not found, falling back to 'typescript'`);
    //   }
    // }

    const codeLanguage = inferCodeLanguage(markdownLanguage, code);
    const highlightLanguage = codeLanguage || 'typescript';
    const highlightedCode = Prism.highlight(
      code,
      Prism.languages[highlightLanguage] || Prism.languages.typescript,
      highlightLanguage,
    );

    result.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    result.push({ type: 'code', content: highlightedCode, language: codeLanguage, complete: blockEnd.startsWith('```'), code });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    result.push({ type: 'text', content: text.slice(lastIndex) });
  }

  return result;
};


function inferCodeLanguage(markdownLanguage: string, code: string): string | null {
  let detectedLanguage;
  // we have an hint
  if (markdownLanguage) {
    // no dot: assume is the syntax-highlight name
    if (!markdownLanguage.includes('.'))
      return markdownLanguage;

    // dot: there's probably a file extension
    const extension = markdownLanguage.split('.').pop();
    if (extension) {
      const languageMap: { [key: string]: string } = {
        cs: 'csharp', html: 'html', java: 'java', js: 'javascript', json: 'json', jsx: 'javascript',
        md: 'markdown', py: 'python', sh: 'bash', ts: 'typescript', tsx: 'typescript', xml: 'xml',
      };
      detectedLanguage = languageMap[extension];
      if (detectedLanguage)
        return detectedLanguage;
    }
  }

  // based on how the code starts, return the language
  const codeStarts = [
    { starts: ['<!DOCTYPE html', '<html'], language: 'html' },
    { starts: ['<'], language: 'xml' },
    { starts: ['from '], language: 'python' },
    { starts: ['import ', 'export '], language: 'typescript' }, // or python
    { starts: ['interface ', 'function '], language: 'typescript' }, // ambiguous
    { starts: ['package '], language: 'java' },
    { starts: ['using '], language: 'csharp' },
  ];

  for (const codeStart of codeStarts) {
    if (codeStart.starts.some((start) => code.startsWith(start))) {
      return codeStart.language;
    }
  }

  // If no language detected based on code start, use Prism to tokenize and detect language
  const languages = ['bash', 'css', 'java', 'javascript', 'json', 'markdown', 'python', 'typescript']; // matches Prism component imports
  let maxTokens = 0;

  languages.forEach((language) => {
    const grammar = Prism.languages[language];
    const tokens = Prism.tokenize(code, grammar);
    const tokenCount = tokens.filter((token) => typeof token !== 'string').length;

    if (tokenCount > maxTokens) {
      maxTokens = tokenCount;
      detectedLanguage = language;
    }
  });
  return detectedLanguage || null;
}
