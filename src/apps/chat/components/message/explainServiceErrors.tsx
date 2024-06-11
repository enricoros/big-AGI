import * as React from 'react';

import { Link } from '~/common/components/Link';


export function explainServiceErrors(text: string, isAssistant: boolean, modelId?: string) {
  const isAssistantError = isAssistant && (text.startsWith('[Issue] ') || text.startsWith('[OpenAI Issue]'));
  let errorMessage: React.JSX.Element | null = null;
  if (!isAssistantError)
    return { errorMessage, isAssistantError };

  // [OpenAI] "Service Temporarily Unavailable (503)", {"code":503,"message":"Service Unavailable.","param":null,"type":"cf_service_unavailable"}
  if (text.includes('"cf_service_unavailable"')) {
    errorMessage = <>
      The OpenAI servers appear to be having trouble at the moment. Kindly follow
      the <Link noLinkStyle href='https://status.openai.com/' target='_blank'>OpenAI Status</Link> page
      for up to date information, and at your option try again.
    </>;
  }
  // ...
  else if (text.startsWith('OpenAI API error: 429 Too Many Requests')) {
    // TODO: retry at the api/chat level a few times instead of showing this error
    errorMessage = <>
      The model appears to be occupied at the moment. Kindly select <b>GPT-3.5 Turbo</b>,
      or give it another go by selecting <b>Run again</b> from the message menu.
    </>;
  } else if (text.includes('"model_not_found"')) {
    // note that "model_not_found" is different than "The model `gpt-xyz` does not exist" message
    errorMessage = <>
      The API key appears to be unauthorized for {modelId || 'this model'}. You can change to <b>GPT-3.5
      Turbo</b> and simultaneously <Link noLinkStyle href='https://openai.com/waitlist/gpt-4-api' target='_blank'>request
      access</Link> to the desired model.
    </>;
  } else if (text.includes('"context_length_exceeded"')) {
    // TODO: propose to summarize or split the input?
    const pattern = /maximum context length is (\d+) tokens.+resulted in (\d+) tokens/;
    const match = pattern.exec(text);
    const usedText = match ? <b>{parseInt(match[2] || '0').toLocaleString()} tokens &gt; {parseInt(match[1] || '0').toLocaleString()}</b> : '';
    errorMessage = <>
      This thread <b>surpasses the maximum size</b> allowed for {modelId || 'this model'}. {usedText}.
      Please consider removing some earlier messages from the conversation, start a new conversation,
      choose a model with larger context, or submit a shorter new message.
      {!usedText && ` -- ${text}`}
    </>;
  }
  // [OpenAI] {"error":{"message":"Incorrect API key provided: ...","type":"invalid_request_error","param":null,"code":"invalid_api_key"}}
  else if (text.includes('"invalid_api_key"')) {
    errorMessage = <>
      The API key appears to be incorrect or to have expired.
      Please <Link noLinkStyle href='https://platform.openai.com/account/api-keys' target='_blank'>check your
      API key</Link> and update it in <b>Models</b>.
    </>;
  } else if (text.includes('"insufficient_quota"')) {
    errorMessage = <>
      The API key appears to have <b>insufficient quota</b>. Please
      check <Link noLinkStyle href='https://platform.openai.com/account/usage' target='_blank'>your usage</Link> and
      make sure the usage is under <Link noLinkStyle href='https://platform.openai.com/account/billing/limits' target='_blank'>the limits</Link>.
    </>;
  }
  // else
  //  errorMessage = <>{text || 'Unknown error'}</>;

  return { isAssistantError, errorMessage };
}