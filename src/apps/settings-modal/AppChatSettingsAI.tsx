import * as React from 'react';

import { FormControl, Switch } from '@mui/joy';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { useChatAutoAI } from '../chat/store-appchat';


export function AppChatSettingsAI() {

  // external state
  const {
    autoSetChatTitle, autoSuggestDiagrams, autoSuggestQuestions,
    setAutoSetChatTitle, setAutoSuggestDiagrams, setAutoSuggestQuestions,
  } = useChatAutoAI();

  const handleAutoSetChatTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => setAutoSetChatTitle(event.target.checked);

  const handleAutoSuggestDiagramsChange = (event: React.ChangeEvent<HTMLInputElement>) => setAutoSuggestDiagrams(event.target.checked);

  const handleAutoSuggestQuestionsChange = (event: React.ChangeEvent<HTMLInputElement>) => setAutoSuggestQuestions(event.target.checked);

  return <>

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
      <FormLabelStart title='Auto Chat Title'
                      description={autoSetChatTitle ? 'LLM Titling' : 'Manual only'} />
      <Switch checked={autoSetChatTitle} onChange={handleAutoSetChatTitleChange}
              endDecorator={autoSetChatTitle ? 'On' : 'Off'}
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
                      description={autoSuggestQuestions ? 'LLM Questions' : 'Disabled'} />
      <Switch checked={autoSuggestQuestions} onChange={handleAutoSuggestQuestionsChange}
              endDecorator={autoSuggestQuestions ? 'On' : 'Off'}
              slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />
    </FormControl>

  </>;
}
