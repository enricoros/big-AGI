import * as React from 'react';

import { Alert, FormControl, Typography } from '@mui/joy';

import { useChatAutoAI } from '../../../../apps/chat/store-app-chat';

import type { DModelsServiceId } from '~/common/stores/llms/modelsservice.types';
import { AlreadySet } from '~/common/components/AlreadySet';
import { ExternalLink } from '~/common/components/ExternalLink';
import { FormInputKey } from '~/common/components/forms/FormInputKey';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { FormSwitchControl } from '~/common/components/forms/FormSwitchControl';
import { FormTextField } from '~/common/components/forms/FormTextField';
import { InlineError } from '~/common/components/InlineError';
import { Link } from '~/common/components/Link';
import { SetupFormRefetchButton } from '~/common/components/forms/SetupFormRefetchButton';
import { useToggleableBoolean } from '~/common/util/hooks/useToggleableBoolean';

import { ApproximateCosts } from '../ApproximateCosts';
import { useLlmUpdateModels } from '../../llm.client.hooks';
import { useServiceSetup } from '../useServiceSetup';

import { isValidAnthropicApiKey, ModelVendorAnthropic } from './anthropic.vendor';


export function AnthropicServiceSetup(props: { serviceId: DModelsServiceId }) {

  // state
  const advanced = useToggleableBoolean();

  // external state
  const { service, serviceAccess, serviceHasBackendCap, serviceHasLLMs, updateSettings } =
    useServiceSetup(props.serviceId, ModelVendorAnthropic);

  const { autoVndAntBreakpoints, setAutoVndAntBreakpoints } = useChatAutoAI();

  // derived state
  const { anthropicKey, anthropicHost, heliconeKey } = serviceAccess;
  const needsUserKey = !serviceHasBackendCap;

  const keyValid = isValidAnthropicApiKey(anthropicKey);
  const keyError = (/*needsUserKey ||*/ !!anthropicKey) && !keyValid;
  const shallFetchSucceed = anthropicKey ? keyValid : (!needsUserKey || !!anthropicHost);

  // fetch models
  const { isFetching, refetch, isError, error } =
    useLlmUpdateModels(!serviceHasLLMs && shallFetchSucceed, service);

  return <>

    <ApproximateCosts serviceId={service?.id} whoSaved='Big-AGI saved you'>
      <Alert variant='soft' color='success'>
        <div>
          Enjoy <b>Sonnet 3.5</b>, <b>Opus</b> and <b>Haiku 3</b>. Anthropic <ExternalLink level='body-sm' href='https://status.anthropic.com/'>server status</ExternalLink>.
        </div>
      </Alert>
    </ApproximateCosts>

    <FormInputKey
      autoCompleteId='anthropic-key' label={!!anthropicHost ? 'API Key' : 'Anthropic API Key'}
      rightLabel={<>{needsUserKey
        ? !anthropicKey && <Link level='body-sm' href='https://www.anthropic.com/earlyaccess' target='_blank'>request Key</Link>
        : <AlreadySet />
      } {anthropicKey && keyValid && <Link level='body-sm' href='https://console.anthropic.com/settings/usage' target='_blank'>show tokens usage</Link>}
      </>}
      value={anthropicKey} onChange={value => updateSettings({ anthropicKey: value })}
      required={needsUserKey} isError={keyError}
      placeholder='sk-...'
    />

    <FormControl orientation='horizontal' sx={{ flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
      <FormLabelStart
        title='Prompt Caching'
        description='Toggle per-Message'
        tooltip='You can turn on/off caching on the fly for each message. Caching makes new input a bit more expensive, and reusing the cached input much cheaper. See Anthropic docs for details and pricing.'
      />
      <Typography level='title-sm'>
        {autoVndAntBreakpoints ? 'User & Auto' : 'User-driven'}
      </Typography>
    </FormControl>

    <FormSwitchControl
      title='Auto-Caching' on='Enabled' off='Disabled'
      tooltip='Auto-breakpoints: 3 breakpoints are always set on the System instruction and on the last 2 User messages. This leaves the user with 1 breakpoint of their choice. (max 4)'
      description={autoVndAntBreakpoints ? <>Last 2 user messages</> : 'Disabled'}
      checked={autoVndAntBreakpoints}
      onChange={setAutoVndAntBreakpoints}
    />

    {advanced.on && <FormTextField
      autoCompleteId='anthropic-host'
      title='API Host'
      description={<>e.g., <Link level='body-sm' href='https://github.com/enricoros/big-agi/blob/main/docs/config-aws-bedrock.md' target='_blank'>bedrock-claude</Link></>}
      placeholder='deployment.service.region.amazonaws.com'
      isError={false}
      value={anthropicHost || ''}
      onChange={text => updateSettings({ anthropicHost: text })}
    />}

    {advanced.on && <FormTextField
      autoCompleteId='anthropic-helicone-key'
      title='Helicone Key' disabled={!!anthropicHost}
      description={<>Generate <Link level='body-sm' href='https://www.helicone.ai/keys' target='_blank'>here</Link></>}
      placeholder='sk-...'
      value={heliconeKey || ''}
      onChange={text => updateSettings({ heliconeKey: text })}
    />}

    {!!heliconeKey && <Alert variant='soft' color='success'>
      Advanced: You set the Helicone key, and Anthropic text will be routed through Helicone.
    </Alert>}

    <SetupFormRefetchButton refetch={refetch} disabled={!shallFetchSucceed || isFetching} loading={isFetching} error={isError} advanced={advanced} />

    {isError && <InlineError error={error} />}

  </>;
}