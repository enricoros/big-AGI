import * as React from 'react';

import { Box, Sheet, Typography } from '@mui/joy';
import { Attachment, AttachmentId, AttachmentSource } from './attachment.types';
import { fileOpen, FileWithHandle } from 'browser-fs-access';
import { getClipboardItems, supportsClipboardRead } from '~/common/util/clipboardUtils';


function Attachments(props: { attachments: Attachment[], setAttachments: (attachments: Attachment[]) => void }) {
  if (!props.attachments.length) return null;

  return (
    <Box sx={{ display: 'flex', overflowX: 'auto' }}>
      {props.attachments.map((attachment) => (
        <Sheet invertedColors key={attachment.id} sx={{ mb: 1 }}>
          <Typography>
            {attachment.id} {attachment.name} {attachment.input?.mimeType} {attachment.output?.outputType}
          </Typography>
        </Sheet>
      ))}
    </Box>
  );
}


export const useAttachments = () => {

  // state
  const [attachments, setAttachments] = React.useState<Attachment[]>([]);

  const removeAttachment = React.useCallback((id: AttachmentId) => {
    setAttachments(currentAttachments => currentAttachments.filter(a => a.id !== id));
  }, []);





  // Function to process the attachment queue
  const processAttachmentQueue = React.useCallback(() => {
    // Process the queue here, including showing conversion modals if necessary

  }, []);

  // Call processQueue when the conversionQueue changes
  React.useEffect(() => {
    processAttachmentQueue();
  }, [attachments, processAttachmentQueue]);


  // Components
  const component = React.useMemo(() => {
    return <Attachments attachments={attachments} setAttachments={setAttachments} />;
  }, [attachments, setAttachments]);




  const attachFromSources = React.useCallback((sources: AttachmentSource[]) => {

    console.log('attachFromSources', sources);

  }, []);

  const attachFromDialog = React.useCallback(async () => {
    try {
      let files: FileWithHandle[] = await fileOpen({ multiple: true });


      // TODO ...
      console.log(files);
    } catch (error) {
      // ignore...
    }
  }, []);

  const attachFromClipboard = React.useCallback(async () => {
    for (const clipboardItem of await getClipboardItems()) {

      clipboardItem.types



      console.log('clipboardItem', clipboardItem);



      /*


      // when pasting images, attach them as images
      try {
        const imageItem = await clipboardItem.getType('image/png');
        const imageFile = new File([imageItem], 'clipboard.png', { type: 'image/png' });
        attachFromSource([{
          type: 'file',
          file: imageFile,
          overrideName: 'clipboard.png',
        }]);
        continue;
      } catch (error) {
        // ignore missing image/png
      }
*/

      // when pasting html, onley process tables as markdown (e.g. from Excel), or fallback to text
      try {
        const htmlItem = await clipboardItem.getType('text/html');
        const htmlString = await htmlItem.text();
        // paste tables as markdown
        if (htmlString.startsWith('<table')) {
          console.log('Pasting html table as markdown', htmlString);
          // const markdownString = htmlTableToMarkdown(htmlString);
          // setComposeText(expandPromptTemplate(PromptTemplates.PasteMarkdown, { clipboard: markdownString }));
          continue;
        }
        // TODO: paste html to markdown (tried Turndown, but the gfm plugin is not good - need to find another lib with minimal footprint)
      } catch (error) {
        // ignore missing html: fallback to text/plain
      }
/*
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
*/
      // no text/html or text/plain item found
      console.log('Clipboard item has no text/html or text/plain item.', clipboardItem.types, clipboardItem);
    }
  }, []);



  const attachFiles = React.useCallback(async (files: { fileWithHandle: FileWithHandle, overrideName?: string }[]): Promise<void> => {
    for (const file of files) {
      attachFromSources([{
        type: 'file',
        file: file.file,
        overrideName: file.overrideName || file.name,
      }]);
    }


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


  }, []);

  const attachURLs = React.useCallback(async (urls: { url: string, refName: string }[]) => {
    for (const url of urls) {
      attachFromSources([{
        type: 'url',
        url: url.url,
        refName: url.refName,
      }]);
    }
  }, [attachFromSources]);


  return {
    // component
    AttachmentsList: component,

    // attach methods
    attachFromDialog,
    attachFromSources,

    // attachClipboard: async () => null,
    // attachFiles, // +attachFilesDialog? (ported from the attach button)
    // attachFilesPicker,
    // attachImages: async () => null,
    // attachURLs,

    // state
    attachmentsReady: false,

    // operations
    inlineAttachments: () => null,
  };
};