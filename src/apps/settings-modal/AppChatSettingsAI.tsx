import * as React from 'react';

import { FormControl, Switch } from '@mui/joy';
import CodeIcon from '@mui/icons-material/Code';
import EngineeringIcon from '@mui/icons-material/Engineering';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';

import type { DModelDomainId } from '~/common/stores/llms/model.domains.types';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { useLLMSelect } from '~/common/components/forms/useLLMSelect';
import { useLabsDevMode } from '~/common/state/store-ux-labs';
import { useModelDomain } from '~/common/stores/llms/hooks/useModelDomain';

import { useChatAutoAI } from '../chat/store-app-chat';


function FormControlDomainModel(props: {
  domainId: DModelDomainId,
  title: React.ReactNode,
  description?: React.ReactNode,
  tooltip?: React.ReactNode,
}) {

  // external state
  const { domainModelId: fastModelId, assignDomainModelId: setFastModelId } = useModelDomain(props.domainId);
  const [_llm, llmComponent] = useLLMSelect(fastModelId, setFastModelId, { label: '', autoRefreshDomain: props.domainId });

  return (
    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
      <FormLabelStart
        title={props.title}
        description={props.description}
        tooltip={props.tooltip}
      />
      {llmComponent}
    </FormControl>
  );
}


export function AppChatSettingsAI() {

  const {
    autoSuggestAttachmentPrompts, setAutoSuggestAttachmentPrompts,
    autoSuggestDiagrams, setAutoSuggestDiagrams,
    autoSuggestHTMLUI, setAutoSuggestHTMLUI,
    // autoSuggestQuestions, setAutoSuggestQuestions,
    autoTitleChat, setAutoTitleChat,
  } = useChatAutoAI();

  const labsDevMode = useLabsDevMode();


  // callbacks

  const handleAutoSetChatTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => setAutoTitleChat(event.target.checked);

  const handleAutoSuggestAttachmentPromptsChange = (event: React.ChangeEvent<HTMLInputElement>) => setAutoSuggestAttachmentPrompts(event.target.checked);

  const handleAutoSuggestDiagramsChange = (event: React.ChangeEvent<HTMLInputElement>) => setAutoSuggestDiagrams(event.target.checked);

  const handleAutoSuggestHTMLUIChange = (event: React.ChangeEvent<HTMLInputElement>) => setAutoSuggestHTMLUI(event.target.checked);

  // const handleAutoSuggestQuestionsChange = (event: React.ChangeEvent<HTMLInputElement>) => setAutoSuggestQuestions(event.target.checked);

  return <>

    <FormControlDomainModel
      domainId='codeApply'
      title={<><CodeIcon color='primary' sx={{ fontSize: 'lg', mr: 0.5, mb: 0.25 }} />Coding Model</>}
      description='Best for code'
      tooltip={<>
        Smart <b>code editing</b> model (must support Tool Calls) with great conding skills and not too slow. Used for:
        <ul>
          <li>Diagrams generation</li>
          <li>HTML UI generation</li>
          <li>Forward compatibility</li>
        </ul>
        Ideally select a Sonnet 3.5-class model.
      </>}
    />

    <FormControlDomainModel
      domainId='fastUtil'
      title='Utility model'
      description='Fast, see info'
      tooltip={<>
        Lightweight model (must support Tool Calls) used for &quot;fast&quot;, low-cost operations, such as:
        <ul>
          <li>Chat title generation</li>
          <li>Attachment prompts</li>
          <li>Drawing prompts</li>
          <li>And more</li>
        </ul>
        For chat messages and similar high-quality content, the chat model is used instead.
      </>}
    />

    {labsDevMode && (
      <FormControlDomainModel
        domainId='primaryChat'
        title={<><EngineeringIcon color='warning' sx={{ fontSize: 'lg', mr: 0.5, mb: 0.25 }} />Last used model</>}
        description='Chat fallback model'
        tooltip='The last used chat model, used as default for new conversations. This is a develoment setting used to test out auto-detection of the most fitting initial chat model.'
      />
    )}


    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
      <FormLabelStart title='Auto Chat Title'
                      description={autoTitleChat ? 'Auto' : 'Manual only'}
                      tooltip='[Utility model]  Automatically generates relevant titles for new chat conversations.' />
      <Switch checked={autoTitleChat} onChange={handleAutoSetChatTitleChange}
              endDecorator={autoTitleChat ? 'On' : 'Off'}
              slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />
    </FormControl>

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
      <FormLabelStart title='Auto Attachment Prompts'
                      description={autoSuggestAttachmentPrompts ? 'Guess Actions' : 'Off'}
                      tooltip='[Utility model]  Suggests actions/prompts when attachments are added to the conversation.' />
      <Switch checked={autoSuggestAttachmentPrompts} onChange={handleAutoSuggestAttachmentPromptsChange}
              endDecorator={autoSuggestAttachmentPrompts ? 'On' : 'Off'}
              slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />
    </FormControl>

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
      <FormLabelStart title='Generative Diagrams'
                      description={autoSuggestDiagrams ? 'Add Diagrams' : 'Off'}
                      tooltip='[Coding model]  Automatically creates visual diagrams and flowcharts when the AI detects that a response would be clearer with a visual representation.' />
      <Switch checked={autoSuggestDiagrams} onChange={handleAutoSuggestDiagramsChange}
              endDecorator={autoSuggestDiagrams ? 'On' : 'Off'}
              slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />
    </FormControl>

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
      <FormLabelStart
        title='Generative UIs'
        description={autoSuggestHTMLUI ? 'Add HTML' : 'Off'}
        tooltipWarning={autoSuggestHTMLUI}
        tooltip={<>
          [Coding model] Creates interactive UI components within chat responses when appropriate.
          <hr />
          SECURITY WARNING: THIS TURNS ON JS/HTML CODE EXECUTION WITHIN CHAT MESSAGES
          <hr />
          ALPHA QUALITY FOR TESTING ONLY. Use at your own risk.
        </>}
      />
      <Switch checked={autoSuggestHTMLUI} onChange={handleAutoSuggestHTMLUIChange}
              endDecorator={autoSuggestHTMLUI ? <div>On{' '}<WarningRoundedIcon sx={{ cursor: 'pointer', color: 'red' }} /></div> : 'Off'}
              slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />
    </FormControl>

    {/*<FormControl disabled orientation='horizontal' sx={{ justifyContent: 'space-between' }}>*/}
    {/*  <FormLabelStart title='Auto Questions'*/}
    {/*                  description={autoSuggestQuestions ? 'LLM Questions' : 'No'}*/}
    {/*                  tooltip={<>Vote <Link href='https://github.com/enricoros/big-agi/issues/228' target='_blank'>#228</Link></>} />*/}
    {/*  <Switch checked={autoSuggestQuestions} onChange={handleAutoSuggestQuestionsChange}*/}
    {/*          endDecorator={autoSuggestQuestions ? 'On' : 'Off'}*/}
    {/*          slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />*/}
    {/*</FormControl>*/}

  </>;
}
