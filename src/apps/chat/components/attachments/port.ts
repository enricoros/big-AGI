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
  // Attachments: Files

           {isDownloading && <Card
              color='success' invertedColors variant='soft'
              sx={{
                display: 'flex',
                position: 'absolute', bottom: 0, left: 0, right: 0, top: 0,
                alignItems: 'center', justifyContent: 'center',
                border: '1px solid',
                borderColor: 'success.solidBg',
                borderRadius: 'xs',
                zIndex: 20,
              }}>
              <CircularProgress />
              <Typography level='title-md' sx={{ mt: 1 }}>
                Loading & Attaching Website
              </Typography>
              <Typography level='body-xs'>
                This will take up to 15 seconds
              </Typography>
            </Card>}


const [isDownloading, setIsDownloading] = React.useState(false);

  const handleAttachWebpage = React.useCallback(async (url: string, fileName: string) => {
    setIsDownloading(true);
    let urlContent: string | null;
    try {
      urlContent = await callBrowseFetchPage(url);
    } catch (error: any) {
      // ignore errors
      urlContent = `[Web Download] Issue loading website: ${error?.message || typeof error === 'string' ? error : JSON.stringify(error)}`;
    }
    setIsDownloading(false);
    if (urlContent) {
      setComposeText(expandPromptTemplate(PromptTemplates.PasteFile, { fileName, fileText: urlContent }));
      return true;
    }
    return false;
  }, [setComposeText]);

  const handleAttachFiles = async (files: FileList, overrideFileNames?: string[]): Promise<void> => {

    // NOTE: we tried to get the common 'root prefix' of the files here, so that we could attach files with a name that's relative
    //       to the common root, but the files[].webkitRelativePath property is not providing that information

    // perform loading and expansion
    let newText = '';
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileName = overrideFileNames?.length === files.length ? overrideFileNames[i] : file.name;
      let fileText = '';
      try {
        if (file.type === 'application/pdf')
          fileText = await pdfToText(file);
        else
          fileText = await file.text();
        newText = expandPromptTemplate(PromptTemplates.PasteFile, { fileName: fileName, fileText })(newText);
      } catch (error: any) {
        // show errors in the prompt box itself - FUTURE: show in a toast
        console.error(error);
        newText = `${newText}\n\nError loading file ${fileName}: ${JSON.stringify(error)}\n`;
      }
    }

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

  const handlePasteFromClipboard = React.useCallback(async () => {
    for (const clipboardItem of await getClipboardItems()) {

      // when pasting html, onley process tables as markdown (e.g. from Excel), or fallback to text
      try {
        const htmlItem = await clipboardItem.getType('text/html');
        const htmlString = await htmlItem.text();
        // paste tables as markdown
        if (htmlString.startsWith('<table')) {
          const markdownString = htmlTableToMarkdown(htmlString);
          setComposeText(expandPromptTemplate(PromptTemplates.PasteMarkdown, { clipboard: markdownString }));
          continue;
        }
        // TODO: paste html to markdown (tried Turndown, but the gfm plugin is not good - need to find another lib with minimal footprint)
      } catch (error) {
        // ignore missing html: fallback to text/plain
      }

      // find the text/plain item if any
      try {
        const textItem = await clipboardItem.getType('text/plain');
        const textString = await textItem.text();
        const textIsUrl = asValidURL(textString);
        if (browsingInComposer) {
          if (textIsUrl && await handleAttachWebpage(textIsUrl, textString))
            continue;
        }
        setComposeText(expandPromptTemplate(PromptTemplates.PasteMarkdown, { clipboard: textString }));
        continue;
      } catch (error) {
        // ignore missing text
      }

      // no text/html or text/plain item found
      console.log('Clipboard item has no text/html or text/plain item.', clipboardItem.types, clipboardItem);
    }
  }, [browsingInComposer, handleAttachWebpage, setComposeText]);

  useGlobalShortcut(supportsClipboardRead ? 'v' : false, true, true, false, handlePasteFromClipboard);
*/
