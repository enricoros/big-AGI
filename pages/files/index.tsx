import React, { useCallback, useEffect } from 'react';
import { shallow } from 'zustand/shallow';
import { Box, Button, Card, Grid, IconButton, List, Stack, Textarea, Tooltip, Typography, useTheme } from '@mui/joy';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DataArrayIcon from '@mui/icons-material/DataArray';
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { hideOnDesktop, hideOnMobile } from '@/common/theme';
import { pdfToText } from '@/common/util/pdfToText';
import { SxProps } from '@mui/joy/styles/types';
import { AppLayout } from '@/common/layouts/AppLayout';
import PanToolIcon from '@mui/icons-material/PanTool';
import StopOutlinedIcon from '@mui/icons-material/StopOutlined';
import { embedPdf, queryPdfEndpoint } from 'src/apps/chat/util/agi-immediate';
import { DMessage, createDMessage, useChatStore } from '@/common/state/store-chats';
import { useSettingsStore } from '@/common/state/store-settings';
import { ChatMessage } from 'src/apps/chat/components/message/ChatMessage';

function sanitizePineconeNamespace(text: string) {
  if (!text) return '';
  let finalText = text.replace(/\s/g, '');
  // remove file extension
  finalText = finalText.slice(0, finalText.lastIndexOf('.'));

  // use regex to replace all special characters in finalText
  finalText = finalText.replace(/[^a-zA-Z0-9]/g, '');
  return finalText;
}

async function getPineconeNamespaces() {
  let errorMessage: string;
  try {
    const response = await fetch('/api/pinecone/listNamespaces', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (response.ok) {
      const json = await response.json();
      return json;
    }
    // decode a possible error payload, if present, but ignore if missing
    let errorPayload: any = null;
    try {
      errorPayload = await response.json();
    } catch (error: any) {
      // ignore - it's expected there may not be a payload
    }
    errorMessage = `issue fetching: ${response.status} · ${response.statusText}${errorPayload ? ' · ' + JSON.stringify(errorPayload) : ''}`;
  } catch (error: any) {
    errorMessage = `fetch error: ${error?.message || error?.toString() || 'Unknown error'}`;
  }

  console.error(`getPineconeNamespaces error: ${errorMessage}`);
  throw new Error(errorMessage);
}

async function loadAndAttachFiles(files: FileList, appendToFilesArray) {
  // NOTE: we tried to get the common 'root prefix' of the files here, so that we could attach files with a name that's relative
  //       to the common root, but the files[].webkitRelativePath property is not providing that information

  const newFilesArray = [];
  for (let file of files) {
    let fileText = '';
    try {
      if (file.type === 'application/pdf') {
        fileText = await pdfToText(file);
        console.log('fileText', fileText.length, fileText.slice(0, 100));
      } else {
        fileText = await file.text();
      }
      let fileName = sanitizePineconeNamespace(file.name);
      newFilesArray.push({ name: fileName, text: fileText, type: file.type });
    } catch (error) {
      // show errors in the prompt box itself - FUTURE: show in a toast
      console.error(error);
    }
  }
  appendToFilesArray(newFilesArray);
}

const attachFileLegend = (
  <Stack sx={{ p: 1, gap: 1, fontSize: '16px', fontWeight: 400 }}>
    <Box sx={{ mb: 1, textAlign: 'center' }}>Upload a file</Box>
    <table>
      <tbody>
        <tr>
          <td width={36}>
            <PictureAsPdfIcon sx={{ width: 24, height: 24 }} />
          </td>
          <td>
            <b>PDF</b>
          </td>
        </tr>
        <tr>
          <td>
            <DataArrayIcon sx={{ width: 24, height: 24 }} />
          </td>
          <td>
            <b>Code</b>
          </td>
        </tr>
        <tr>
          <td>
            <FormatAlignCenterIcon sx={{ width: 24, height: 24 }} />
          </td>
          <td>
            <b>Text</b>
          </td>
        </tr>
      </tbody>
    </table>
    <Box sx={{ mt: 1, fontSize: '14px' }}>Drag & drop for faster loads ⚡</Box>
  </Stack>
);

export default function Files(props: { sx?: SxProps; conversationId: string }) {
  const attachmentFileInputRef = React.useRef<HTMLInputElement>(null);
  const handleShowFilePicker = () => attachmentFileInputRef.current?.click();
  const [isDragging, setIsDragging] = React.useState(false);
  const [filesArray, setFilesArray] = React.useState<any[]>([]);
  const [pineconeNamespaces, setPineconeNamespaces] = React.useState<any[]>([]);
  const [isParsingFiles, setIsParsingFiles] = React.useState<boolean>(false);
  const [isUploading, setIsUploading] = React.useState<boolean>(false);
  const [isSearchingDocuments, setIsSearchingDocuments] = React.useState<boolean>(false);
  const [composeText, setComposeText] = React.useState('');
  const theme = useTheme();

  const appendToFilesArray = useCallback(
    (newFilesArray: any[]) => {
      const finalFilesArray = [...filesArray, ...newFilesArray];
      setFilesArray(finalFilesArray);
    },
    [filesArray, setFilesArray],
  );

  const handleLoadAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target?.files;
    if (files && files.length >= 1) {
      setIsParsingFiles(true);
      await loadAndAttachFiles(files, appendToFilesArray);
      setIsParsingFiles(false);
      return true;
    }

    // this is needed to allow the same file to be selected again
    e.target.value = '';
  };

  const eatDragEvent = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleMessageDragEnter = (e: React.DragEvent) => {
    eatDragEvent(e);
    setIsDragging(true);
  };

  const handleOverlayDragLeave = (e: React.DragEvent) => {
    eatDragEvent(e);
    setIsDragging(false);
  };

  const handleOverlayDragOver = (e: React.DragEvent) => {
    eatDragEvent(e);
    // e.dataTransfer.dropEffect = 'copy';
  };

  const handleOverlayDrop = async (e: React.DragEvent) => {
    eatDragEvent(e);
    setIsDragging(false);

    // dropped files
    if (e.dataTransfer.files?.length >= 1) {
      setIsParsingFiles(true);
      await loadAndAttachFiles(e.dataTransfer.files, appendToFilesArray);
      setIsParsingFiles(false);
      return true;
    }

    // special case: detect failure of dropping from VSCode
    // fix this for this file
    // VSCode: Drag & Drop does not transfer the File object: https://github.com/microsoft/vscode/issues/98629#issuecomment-634475572
    // if ('codeeditors' in e.dataTransfer.types) return setComposeText((test) => test + 'Pasting from VSCode is not supported! Fixme. Anyone?');

    // dropped text
    // const droppedText = e.dataTransfer.getData('text');
    // if (droppedText?.length >= 1) return setComposeText((text) => expandPromptTemplate(PromptTemplates.PasteMarkdown, { clipboard: droppedText })(text));

    // future info for dropping
    console.log(
      'Unhandled Drop event. Contents: ',
      e.dataTransfer.types.map((t) => `${t}: ${e.dataTransfer.getData(t)}`),
    );
  };

  const handleSendClicked = () => {
    async function executeEmbedPdf(pdfText: string, pineconeNamespaceName: string) {
      const result = await embedPdf(pdfText, pineconeNamespaceName);
    }
    setIsUploading(true);
    // by default we are setting namespace to props.conversationId, instead we should have a textbox
    // to let the user input whatever namespace name they want when uploading files
    const promises = filesArray.map((file) => executeEmbedPdf(file?.text, 'files'));
    // option to also make this synchronous. Then we can show a progress for each file by updating a
    // state variable for each file [{name, progress}, {name, progress}, ...]
    Promise.allSettled(promises)
      .then((results) => {
        console.log('promise allsettled results', results);
        setIsUploading(false);
      })
      .catch((error) => {
        console.log('promise allsettled error', error);
      });
  };

  const _findConversation = (conversationId: string) =>
    conversationId ? useChatStore.getState().conversations.find((c) => c.id === conversationId) ?? null : null;

  const { createConversation, deleteConversation, setMessages, appendMessage, messages, tokenCount } = useChatStore((state) => {
    const conversation = state.conversations.find((conversation) => conversation.id === props.conversationId);
    return {
      messages: conversation ? conversation.messages : [],
      createConversation: state.createConversation,
      deleteConversation: state.deleteConversation,
      setMessages: state.setMessages,
      appendMessage: state.appendMessage,
      tokenCount: conversation ? conversation.tokenCount : 0,
    };
  }, shallow);

  const [localMessages, setLocalMessages] = React.useState<DMessage[]>([]);

  // create conversation on mount, delete conversation on unmount
  useEffect(() => {
    const conversation = _findConversation('files');
    if (!conversation && 'files') {
      console.log('creating conversation');
      createConversation('files');
    }

    // option to store conversation in localStorage, etc. instead
    return () => {
      console.log('deleting conversation');
      if ('files') {
        deleteConversation('files');
      }
    };
  }, []);

  const handleSearchClicked = async () => {
    const text = (composeText || '').trim();
    if (text.length) {
      setIsSearchingDocuments(true);
      const yourMessage: DMessage = createDMessage('user', text);

      setMessages('files', [yourMessage]);
      setLocalMessages([...localMessages, yourMessage]);

      const results = await queryPdfEndpoint(text);
      setIsSearchingDocuments(false);
      setComposeText('');

      appendMessage('files', createDMessage('assistant', results));
      setLocalMessages([...localMessages, yourMessage, createDMessage('assistant', results.text)]);
    }
  };

  useEffect(() => {
    getPineconeNamespaces().then((collections) => {
      if (collections?.namespaces) {
        const pineconeList = Object.keys(collections.namespaces).map((item) => {
          return {
            name: item,
            value: collections.namespaces[item],
          };
        });
        setPineconeNamespaces(pineconeList);
      }
    });
  }, []);

  const stopTyping = useChatStore((state) => state.stopTyping);
  const { enterToSend } = useSettingsStore((state) => ({ enterToSend: state.enterToSend }), shallow);

  const handleStopClicked = () => stopTyping('files');

  return (
    <AppLayout>
      <div style={{ height: '100%' }} onDragEnter={handleMessageDragEnter}>
        <Card
          color="primary"
          invertedColors
          variant="soft"
          sx={{
            display: isDragging ? 'flex' : 'none',
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            top: 0,
            alignItems: 'center',
            justifyContent: 'space-evenly',
            border: '2px dashed',
            zIndex: 10,
          }}
          onDragLeave={handleOverlayDragLeave}
          onDragOver={handleOverlayDragOver}
          onDrop={handleOverlayDrop}
        >
          <PanToolIcon sx={{ width: 40, height: 40, pointerEvents: 'none' }} />
          <Typography level="body2" sx={{ pointerEvents: 'none' }}>
            Drag and drop files here
          </Typography>
        </Card>

        <input type="file" multiple hidden ref={attachmentFileInputRef} onChange={handleLoadAttachment} />

        <div>
          <b>Files to Upload</b>
        </div>

        <IconButton variant="plain" color="neutral" onClick={handleShowFilePicker} sx={{ ...hideOnDesktop }}>
          <UploadFileIcon />
        </IconButton>
        <Tooltip variant="solid" placement="top-start" title={attachFileLegend}>
          <Button
            fullWidth
            variant="plain"
            color="neutral"
            onClick={handleShowFilePicker}
            startDecorator={<UploadFileIcon />}
            sx={{ ...hideOnMobile, justifyContent: 'flex-start' }}
          >
            Attach
          </Button>
        </Tooltip>

        <hr />
        {filesArray?.length > 0 ? (
          <>
            {filesArray?.map((file, index) => {
              return (
                <React.Fragment key={index}>
                  <div>File: {file?.name}</div>
                  <div>Length: {file?.text?.length}</div>
                </React.Fragment>
              );
            })}

            <Box sx={{ width: '50%', marginTop: '16px' }}>
              <Button
                fullWidth
                variant="solid"
                color="primary"
                disabled={filesArray?.length <= 0 || isUploading}
                loading={isUploading}
                onClick={handleSendClicked}
              >
                Upload
              </Button>
            </Box>
          </>
        ) : (
          <>
            <div>Drag and drop file(s) here</div>
            {isParsingFiles && <div>Processing files...</div>}
          </>
        )}

        {pineconeNamespaces?.length > 0 && (
          <>
          {/* Maybe use a MUI joy component with a margin here? :-D */}
            <br />
            <br />
            <br />
            <br />
            <br />
            <br />
            <br />
            <br />
            <br />
            <br />
            <hr />
            Loaded Pinecone Namespaces:
            {pineconeNamespaces?.map((item: any) => {
              return <div key={item.name}>{item.name}</div>;
            })}
          </>
        )}

        <hr />

        <Grid container spacing={{ xs: 1, md: 2 }}>
          {/* Left pane (buttons and Textarea) */}
          <Grid xs={12} md={9}>
            <Stack direction="row" spacing={{ xs: 1, md: 2 }}>
              <Stack>
                <Box sx={{ mt: { xs: 1, md: 2 } }} />
              </Stack>

              {/* Edit box, with Drop overlay */}
              <Box sx={{ flexGrow: 1, position: 'relative' }}>
                <Box sx={{ position: 'relative' }}>
                  <Textarea
                    variant="outlined"
                    color={'neutral'}
                    autoFocus
                    minRows={4}
                    maxRows={12}
                    // onKeyDown={handleKeyPress}
                    onDragEnter={handleMessageDragEnter}
                    placeholder={'Enter your prompt'}
                    value={composeText}
                    onChange={(e) => setComposeText(e.target.value)}
                    slotProps={{
                      textarea: {
                        enterKeyHint: enterToSend ? 'send' : 'enter',
                        sx: {
                          mb: 0.5,
                        },
                      },
                    }}
                    sx={{
                      background: theme.vars.palette.background.level1,
                      fontSize: '16px',
                      lineHeight: 1.75,
                    }}
                  />
                </Box>

                <Card
                  color="primary"
                  invertedColors
                  variant="soft"
                  sx={{
                    display: isDragging ? 'flex' : 'none',
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    top: 0,
                    alignItems: 'center',
                    justifyContent: 'space-evenly',
                    border: '2px dashed',
                    zIndex: 10,
                  }}
                  onDragLeave={handleOverlayDragLeave}
                  onDragOver={handleOverlayDragOver}
                  onDrop={handleOverlayDrop}
                >
                  <PanToolIcon sx={{ width: 40, height: 40, pointerEvents: 'none' }} />
                  <Typography level="body2" sx={{ pointerEvents: 'none' }}>
                    I will hold on to this for you
                  </Typography>
                </Card>
              </Box>
            </Stack>
          </Grid>

          {/* Send pane */}
          <Grid xs={12} md={3}>
            <Stack spacing={2}>
              <Box sx={{ display: 'flex', flexDirection: 'row' }}>
                {/* Send / Stop */}
                {
                  // assistantTyping
                  false ? (
                    <Button fullWidth variant="soft" color={'primary'} disabled={!'files'} onClick={handleStopClicked} endDecorator={<StopOutlinedIcon />}>
                      Stop
                    </Button>
                  ) : (
                    <>
                      {/* <Button
                        fullWidth
                        variant="solid"
                        color={'primary'}
                        disabled={isSearchingDocuments}
                        onClick={handleChatClicked}
                        // onDoubleClick={handleShowSendMode}
                        endDecorator={<TelegramIcon />}
                      >
                        Chat
                      </Button> */}
                      <Button
                        fullWidth
                        variant="solid"
                        color={'primary'}
                        disabled={isSearchingDocuments}
                        loading={isSearchingDocuments}
                        onClick={handleSearchClicked}
                        // onDoubleClick={handleShowSendMode}
                      >
                        Search documents
                      </Button>
                    </>
                  )
                }
              </Box>
            </Stack>
          </Grid>
        </Grid>

        <div>
          {localMessages.map((message, idx) => (
            <ChatMessage
              key={'msg-' + message.id}
              message={message}
              isBottom={idx === 0}
              onMessageDelete={() => {}}
              onMessageEdit={() => {}}
              onMessageRunFrom={() => {}}
              onImagine={() => {}}
            />
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
