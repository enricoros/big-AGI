import * as React from 'react';

import { FormControl, Switch } from '@mui/joy';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';

import type { DModelDomainId } from '~/common/stores/llms/model.domains.types';
import { ExternalLink } from '~/common/components/ExternalLink';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { GoodTooltip } from '~/common/components/GoodTooltip';
import { useModelDomain } from '~/common/stores/llms/hooks/useModelDomain';
import { useLLMSelect } from '~/common/components/forms/useLLMSelect';

import { useChatAutoAI } from '../chat/store-app-chat';


// configuration
const SHOW_ALL_MODEL_DOMAINS = false;


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


  // callbacks

  const handleAutoSetChatTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => setAutoTitleChat(event.target.checked);

  const handleAutoSuggestAttachmentPromptsChange = (event: React.ChangeEvent<HTMLInputElement>) => setAutoSuggestAttachmentPrompts(event.target.checked);

  const handleAutoSuggestDiagramsChange = (event: React.ChangeEvent<HTMLInputElement>) => setAutoSuggestDiagrams(event.target.checked);

  const handleAutoSuggestHTMLUIChange = (event: React.ChangeEvent<HTMLInputElement>) => setAutoSuggestHTMLUI(event.target.checked);

  // const handleAutoSuggestQuestionsChange = (event: React.ChangeEvent<HTMLInputElement>) => setAutoSuggestQuestions(event.target.checked);

  return <>

    {SHOW_ALL_MODEL_DOMAINS && <FormControlDomainModel domainId='primaryChat' title='Chat' description='Fallback model' />}

    {SHOW_ALL_MODEL_DOMAINS && <FormControlDomainModel domainId='codeApply' title='Code' description='Edits model' />}

    <FormControlDomainModel
      domainId='fastUtil'
      title='Utility Model'
      description='Fast, see info'
      tooltip={<>
        Lightweight model used for &quot;fast&quot;, low-cost operations, such as:
        <ul>
          <li>Chat title generation</li>
          <li>Attachment prompts</li>
          <li>Diagrams generation</li>
          <li>Drawing prompts</li>
          <li>And more</li>
        </ul>
        For chat messages and similar high-quality content, the chat model is used instead.
      </>}
    />

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
      <FormLabelStart title='Auto Chat Title'
                      description={autoTitleChat ? 'LLM Titling' : 'Manual only'} />
      <Switch checked={autoTitleChat} onChange={handleAutoSetChatTitleChange}
              endDecorator={autoTitleChat ? 'On' : 'Off'}
              slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />
    </FormControl>

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
      <FormLabelStart title='Auto Attachment Prompts'
                      description={autoSuggestAttachmentPrompts ? 'LLM Prompts' : 'No'} />
      <Switch checked={autoSuggestAttachmentPrompts} onChange={handleAutoSuggestAttachmentPromptsChange}
              endDecorator={autoSuggestAttachmentPrompts ? 'On' : 'Off'}
              slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />
    </FormControl>

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
      <FormLabelStart title='Generative Diagrams'
                      description={autoSuggestDiagrams ? 'Add Diagrams' : 'No'} />
      <Switch checked={autoSuggestDiagrams} onChange={handleAutoSuggestDiagramsChange}
              endDecorator={autoSuggestDiagrams ? 'On' : 'Off'}
              slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />
    </FormControl>

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
      <FormLabelStart
        title={<>
          <b>Generative UI · Alpha</b>
          <GoodTooltip enableInteractive arrow title={<>
            SECURITY WARNING: THIS TURNS ON JS/HTML CODE EXECUTION WITHIN CHAT MESSAGES
            <hr />
            Alpha quality, for testing only. Does not include state synchronization. Use at your own risk.
            {' - '}<ExternalLink icon='issue' href='https://github.com/enricoros/big-agi/issues/227'>#227</ExternalLink>
            {', '}<ExternalLink icon='issue' href='https://github.com/enricoros/big-agi/issues/228'>#228</ExternalLink>
          </>}>
            <WarningRoundedIcon sx={{ cursor: 'pointer', color: autoSuggestHTMLUI ? 'red' : 'orangered' }} />
          </GoodTooltip>
        </>}
        description={autoSuggestHTMLUI ? 'Auto-Render HTML' : 'No'} />
      <Switch checked={autoSuggestHTMLUI} onChange={handleAutoSuggestHTMLUIChange}
              endDecorator={autoSuggestHTMLUI ? 'On' : 'Off'}
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
