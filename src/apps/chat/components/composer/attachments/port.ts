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

  const handleAttachFiles = async (files: FileList, overrideFileNames?: string[]): Promise<void> => {

    // see how we fare on budget
    if (chatLLMId) {
      const newTextTokens = countModelTokens(newText, chatLLMId, 'reducer trigger') ?? 0;

      // simple trigger for the reduction dialog
      if (newTextTokens > remainingTokens) {
        setReducerTextTokens(newTextTokens);
        setReducerText(newText);
        return;
      }
    }

    // within the budget, so just append
    setComposeText(text => expandPromptTemplate(PromptTemplates.Concatenate, { text: newText })(text));



*/