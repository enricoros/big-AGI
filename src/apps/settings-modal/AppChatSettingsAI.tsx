import * as React from 'react';

import { FormControl, Switch } from '@mui/joy';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';

import { ExternalLink } from '~/common/components/ExternalLink';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { GoodTooltip } from '~/common/components/GoodTooltip';

import { useChatAutoAI } from '../chat/store-app-chat';


export function AppChatSettingsAI() {

  // external state
  const { autoSuggestDiagrams, autoSuggestHTMLUI, autoSuggestQuestions, autoTitleChat, setAutoSuggestDiagrams, setAutoSuggestHTMLUI, setAutoSuggestQuestions, setAutoTitleChat } = useChatAutoAI();

  const handleAutoSetChatTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => setAutoTitleChat(event.target.checked);

  const handleAutoSuggestDiagramsChange = (event: React.ChangeEvent<HTMLInputElement>) => setAutoSuggestDiagrams(event.target.checked);

  const handleAutoSuggestHTMLUIChange = (event: React.ChangeEvent<HTMLInputElement>) => setAutoSuggestHTMLUI(event.target.checked);

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
                      description={autoSuggestDiagrams ? 'Add Diagrams' : 'No'} />
      <Switch checked={autoSuggestDiagrams} onChange={handleAutoSuggestDiagramsChange}
              endDecorator={autoSuggestDiagrams ? 'On' : 'Off'}
              slotProps={{ endDecorator: { sx: { minWidth: 26 } } }} />
    </FormControl>

    <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between' }}>
      <FormLabelStart
        title={<>
          Auto UI · <b>ALPHA</b>
          <GoodTooltip enableInteractive arrow title={<>
            SECUIRTY WARNING: THIS TURNS ON JS/HTML CODE EXECUTION WITHIN CHAT MESSAGES
            <hr />
            Alpha quality, for testing only. Does not include state synchronization. Use at your own risk.
            {' - '}<ExternalLink icon='issue' href='https://github.com/enricoros/big-agi/issues/227'>#227</ExternalLink>
            {', '}<ExternalLink icon='issue' href='https://github.com/enricoros/big-agi/issues/228'>#228</ExternalLink>
          </>}>
            <WarningRoundedIcon sx={{ cursor: 'pointer', color: autoSuggestHTMLUI ? 'red' : 'danger.solidBg' }} />
          </GoodTooltip>
        </>}
        description={autoSuggestHTMLUI ? 'Add UI (see warning)' : 'No'} />
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
