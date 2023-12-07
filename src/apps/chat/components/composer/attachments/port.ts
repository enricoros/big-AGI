/*

/// REDUCER

import { ContentReducer } from '~/modules/aifn/summarize/ContentReducer';

  const [reducerText, setReducerText] = React.useState('');
  const [reducerTextTokens, setReducerTextTokens] = React.useState(0);

{reducerText?.length >= 1 &&
<ContentReducer
  initialText={reducerText} initialTokens={reducerTextTokens} tokenLimit={remainingTokens}
  onReducedText={handleReducedText} onClose={handleReducerClose}
  />
}
  const handleReducerClose = () => setReducerText('');

  const handleReducedText = (text: string) => {
    handleReducerClose();
    setComposeText(_t => _t + text);
  };
*/


/// Text template helpers

/*const PromptTemplates = {
  Concatenate: '{{input}}\n\n{{text}}',
  PasteFile: '{{input}}\n\n```{{fileName}}\n{{fileText}}\n```\n',
  PasteMarkdown: '{{input}}\n\n```\n{{clipboard}}\n```\n',
};

const expandPromptTemplate = (template: string, dict: object) => (inputValue: string): string => {
  let expanded = template.replaceAll('{{input}}', (inputValue || '').trim()).trim();
  for (const [key, value] of Object.entries(dict))
    expanded = expanded.replaceAll(`{{${key}}}`, value.trim());
  return expanded;
};*/



/*

  const handleAttachFiles = async (files: FileList, overrideFileNames?: string[]): Promise<void> => {


    // see how we fare on budget
    if (chatLLMId) {
      const newTextTokens = countModelTokens(newText, chatLLMId, 'reducer trigger');

      // simple trigger for the reduction dialog
      if (newTextTokens > remainingTokens) {
        setReducerTextTokens(newTextTokens);
        setReducerText(newText);
        return;
      }
    }

    // within the budget, so just append
    setComposeText(text => expandPromptTemplate(PromptTemplates.Concatenate, { text: newText })(text));
  };




  // Attachments: Text

  const handleCameraOCRText = (text: string) => {
    text && setComposeText(expandPromptTemplate(PromptTemplates.PasteMarkdown, { clipboard: text }));
  };
*/
