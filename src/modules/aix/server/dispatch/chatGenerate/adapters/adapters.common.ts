import { escapeXml } from '~/server/wire';

import  { AixAPIChatGenerate_Request,
  AixMessages_ChatMessage, AixMessages_SystemMessage, AixMessages_UserMessage, AixParts_DocPart, AixParts_MetaInReferenceToPart } from '../../../api/aix.wiretypes';


/**
 * CGR Server-side approximate Helper
 * Finds a cut point (if any) in the system message to move everything after it to a user message.
 */
export function aixSpillSystemToUser(chatGenerate: AixAPIChatGenerate_Request, splitItems: AixMessages_SystemMessage['parts'][number]['pt'][] = ['inline_image']): AixAPIChatGenerate_Request & { systemSplit: boolean } {
  let systemSplit = false;
  let { systemMessage, chatSequence } = chatGenerate;

  // check if splittable
  if (systemMessage?.parts.length) {
    const splitIndex = systemMessage.parts.findIndex((p) => splitItems.includes(p.pt));
    if (splitIndex >= 0) {
      // perform the split
      const partsPreSplit = systemMessage.parts.slice(0, splitIndex);
      const partsPostSplit = systemMessage.parts.slice(splitIndex);

      // system message keeps the first part
      systemMessage = {
        ...systemMessage,
        parts: partsPreSplit
      };

      // user message gets the rest
      const userSynthMessage: AixMessages_UserMessage & { _FLUSH: true } = {
        role: 'user',
        parts: partsPostSplit,
        _FLUSH: true, // make sure we finalize this part; this is a bit of a hack
      };
      chatSequence = [userSynthMessage, ...chatSequence];
      systemSplit = true;
    }
  }

  return {
    ...chatGenerate,
    systemMessage,
    chatSequence: chatSequence,
    systemSplit,
  }
}

export function aixSpillShallFlush(message: AixMessages_ChatMessage): boolean {
  return '_FLUSH' in message && !!message._FLUSH;
}


// Approximate conversions - alternative approaches should be tried until we find the best one

export function approxDocPart_To_String({ ref, data }: AixParts_DocPart /*, wrapFormat?: 'markdown-code'*/): string {
  // NOTE: Consider a better representation here
  //
  // We use the 'legacy' markdown encoding, but we may consider:
  //  - '<doc id='ref' title='title' version='version'>\n...\n</doc>'
  //  - ```doc id='ref' title='title' version='version'\n...\n```
  //  - # Title [id='ref' version='version']\n...\n
  //  - ...more ideas...
  //
  return '```' + (ref || '') + '\n' + data.text + '\n```\n';
}

export function approxInReferenceTo_To_XMLString(irt: AixParts_MetaInReferenceToPart): string | null {
  const refs = irt.referTo.map(r => escapeXml(r.mText));
  if (!refs.length)
    return null; // `<context>User provides no specific references</context>`;
  return refs.length === 1
    ? `<context>User refers to this in particular:<ref>${refs[0]}</ref></context>`
    : `<context>User refers to ${refs.length} items:<ref>${refs.join('</ref><ref>')}</ref></context>`;
}