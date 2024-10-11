import * as React from 'react';

import { Link } from '~/common/components/Link';


export function isErrorChatMessage(text: string) {
  if (!text) return false;
  return ['**[Service Issue] ', '[Issue] ', '[OpenAI Issue] '].some(prefix => text.startsWith(prefix));
}

export function explainServiceErrors(text: string, isAssistant: boolean) {
  const isAssistantError = isAssistant && isErrorChatMessage(text);
  if (!isAssistantError)
    return null;

  switch (true) {
    case text.includes('"insufficient_quota"'):
      return <>
        {/*The model appears to be occupied at the moment. Kindly try another model, try again after some time,*/}
        {/*or give it another go by selecting <b>Run again</b> from the message menu.*/}
        The OpenAI API key appears to have <b>insufficient quota</b>. Please
        check <Link noLinkStyle href='https://platform.openai.com/usage' target='_blank'>your usage</Link> and
        make sure the usage is under <Link noLinkStyle href='https://platform.openai.com/account/billing/limits' target='_blank'>the limits</Link>.
      </>;

    case text.includes('"invalid_api_key"'):
      return <>
        The OpenAI API key appears to be incorrect or to have expired.
        Please <Link noLinkStyle href='https://platform.openai.com/api-keys' target='_blank'>check your
        API key</Link> and update it in <b>Models</b>.
      </>;

    // [OpenAI] "Service Temporarily Unavailable (503)", {"code":503,"message":"Service Unavailable.","param":null,"type":"cf_service_unavailable"}
    case text.includes('"cf_service_unavailable"'):
      return <>
        The OpenAI servers appear to be having trouble at the moment. Kindly follow
        the <Link noLinkStyle href='https://status.openai.com/' target='_blank'>OpenAI Status</Link> page
        for up to date information, and at your option try again.
      </>;

    case text.includes('"context_length_exceeded"'):
      const pattern = /maximum context length is (\d+) tokens.+resulted in (\d+) tokens/;
      const match = pattern.exec(text);
      const usedText = match ? <b>{parseInt(match[2] || '0').toLocaleString()} tokens &gt; {parseInt(match[1] || '0').toLocaleString()}</b> : '';
      return <>
        This thread <b>surpasses the maximum size</b> allowed for this model. {usedText}.
        Please consider removing some earlier messages from the conversation, start a new conversation,
        choose a model with larger context, or submit a shorter new message.
        {!usedText && ` -- ${text}`}
      </>;
  }

  return null;
}