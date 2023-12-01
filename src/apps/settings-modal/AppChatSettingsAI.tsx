import * as React from 'react';

import { FormControl, Switch } from '@mui/joy';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { Link } from '~/common/components/Link';

import { useChatAutoAI } from '../chat/store-app-chat';


export function AppChatSettingsAI() {

  // external state
  const { autoSuggestDiagrams, autoSuggestQuestions, autoTitleChat, setAutoSuggestDiagrams, setAutoSuggestQuestions, setAutoTitleChat } = useChatAutoAI();

  const handleAutoSetChatTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => setAutoTitleChat(event.target.checked);

  const handleAutoSuggestDiagramsChange = (event: React.ChangeEvent<HTMLInputElement>) => setAutoSuggestDiagrams(event.target.checked);

  const handleAutoSuggestQuestionsChange = (event: React.ChangeEvent<HTMLInputElement>) => setAutoSuggestQuestions(event.target.checked);

  return <>

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
      <FormLabelStart title='Auto Chat Title'
                      description={autoTitleChat ? 'LLM Titling' : 'Manual only'} />
      <Switch checked={autoTitleChat} onChange={handleAutoSetChatTitleChange}
              endDecorator={autoTitleChat ? 'On' : 'Off'}
              slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />
    </FormControl>

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
      <FormLabelStart title='Auto Diagrams'
                      description={autoSuggestDiagrams ? 'LLM Diagrams' : 'Disabled'} />
      <Switch checked={autoSuggestDiagrams} onChange={handleAutoSuggestDiagramsChange}
              endDecorator={autoSuggestDiagrams ? 'On' : 'Off'}
              slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />
    </FormControl>

    <FormControl disabled orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
      <FormLabelStart title='Auto Questions'
                      description={autoSuggestQuestions ? 'LLM Questions' : 'Disabled'}
                      tooltip={<>Vote <Link href='https://github.com/enricoros/big-agi/issues/228' target='_blank'>#228</Link></>} />
      <Switch checked={autoSuggestQuestions} onChange={handleAutoSuggestQuestionsChange}
              endDecorator={autoSuggestQuestions ? 'On' : 'Off'}
              slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />
    </FormControl>

    <FormControl disabled orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
      <FormLabelStart title='Auto UI'
                      description={autoSuggestQuestions ? 'LLM User Interface' : 'Disabled'}
                      tooltip={<>Vote <Link href='https://github.com/enricoros/big-agi/issues/227' target='_blank'>#227</Link></>} />
      <Switch endDecorator={autoSuggestQuestions ? 'On' : 'Off'}
              slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />
    </FormControl>

  </>;
}
